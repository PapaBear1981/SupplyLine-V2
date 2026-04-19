"""
Kit Tool Checkout Routes

Handles temporarily deploying tools to field kits and returning them.
This is distinct from:
- Checkout (tool checked out to a user)
- KitItem (tool permanently transferred to a kit's inventory)

Flow:
  POST /api/kits/<kit_id>/tool-checkouts        — send a tool to a kit
  POST /api/kit-tool-checkouts/<id>/return      — return a tool from a kit
  GET  /api/kits/<kit_id>/tool-checkouts        — tools currently at a kit
  GET  /api/kit-tool-checkouts/active           — all active field deployments
  GET  /api/kit-tool-checkouts/stats            — counts for dashboard card
"""

import logging
from datetime import datetime

from flask import jsonify, request

from auth.jwt_manager import jwt_required, permission_required
from models import AuditLog, Checkout, Tool, ToolHistory, UserActivity, db
from models_kits import Kit, KitToolCheckout

logger = logging.getLogger(__name__)


def _is_tool_available(tool: Tool) -> tuple[bool, list[str]]:
    """
    Return (available, [blocking_reason_strings]).
    Checks the regular Checkout table AND the KitToolCheckout table.
    """
    reasons: list[str] = []

    # Already checked out to a user
    active_user_checkout = Checkout.query.filter_by(
        tool_id=tool.id, return_date=None
    ).first()
    if active_user_checkout:
        user_name = (
            active_user_checkout.user.name if active_user_checkout.user else "Unknown"
        )
        reasons.append(f"Tool is already checked out to {user_name}")

    # Already deployed to a kit
    active_kit_checkout = KitToolCheckout.query.filter_by(
        tool_id=tool.id, status="active"
    ).first()
    if active_kit_checkout:
        kit_name = (
            active_kit_checkout.kit.name if active_kit_checkout.kit else "Unknown"
        )
        reasons.append(f"Tool is already deployed to kit {kit_name}")

    if tool.status == "maintenance":
        reasons.append(
            f"Tool is in maintenance: {tool.status_reason or 'No reason provided'}"
        )
    if tool.status == "retired":
        reasons.append(
            f"Tool has been retired: {tool.status_reason or 'No reason provided'}"
        )
    if tool.condition and tool.condition.lower() in ["damaged", "unusable", "broken"]:
        reasons.append(f"Tool is marked as {tool.condition}")
    if tool.requires_calibration and tool.calibration_status == "overdue":
        reasons.append("Tool calibration is overdue")

    return len(reasons) == 0, reasons


def register_kit_tool_checkout_routes(app):
    """Register all kit tool checkout routes."""

    # ------------------------------------------------------------------ #
    # Send a tool to a kit                                                 #
    # ------------------------------------------------------------------ #
    @app.route("/api/kits/<int:kit_id>/tool-checkouts", methods=["POST"])
    @permission_required("checkout.create")
    def send_tool_to_kit(kit_id):
        """
        Deploy a tool from the warehouse to a field kit.

        Body:
          tool_id             (required) int
          notes               (optional) str
          expected_return_date (optional) ISO date string
        """
        try:
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")

            kit = db.session.get(Kit, kit_id)
            if not kit:
                return jsonify({"error": "Kit not found"}), 404
            if kit.status not in ("active", "deployed"):
                return jsonify({"error": f"Kit is not active (status: {kit.status})"}), 409

            tool_id = data.get("tool_id")
            if not tool_id:
                return jsonify({"error": "tool_id is required"}), 400

            tool = db.session.get(Tool, tool_id)
            if not tool:
                return jsonify({"error": f"Tool {tool_id} not found"}), 404

            available, blocking_reasons = _is_tool_available(tool)
            if not available:
                return jsonify(
                    {"error": "Tool cannot be sent to kit", "blocking_reasons": blocking_reasons}
                ), 409

            # Parse expected return date
            expected_return_date = None
            raw_date = data.get("expected_return_date")
            if raw_date:
                try:
                    expected_return_date = datetime.fromisoformat(
                        raw_date.replace("Z", "").replace("+00:00", "")
                    )
                except (ValueError, TypeError):
                    pass

            # Save current state so we can restore it on return
            previous_location = tool.location
            previous_warehouse_id = tool.warehouse_id

            # Create the kit tool checkout record
            ktc = KitToolCheckout(
                tool_id=tool_id,
                kit_id=kit_id,
                checked_out_by_id=current_user_id,
                expected_return_date=expected_return_date,
                previous_location=previous_location,
                previous_warehouse_id=previous_warehouse_id,
                notes=data.get("notes"),
                status="active",
            )
            db.session.add(ktc)

            # Update tool to reflect it is now in the field
            old_status = tool.status
            tool.status = "checked_out"
            tool.location = f"Kit: {kit.name}"

            db.session.flush()  # obtain ktc.id

            # Record tool history
            history = ToolHistory.create_event(
                tool_id=tool_id,
                event_type="kit_deployment",
                user_id=current_user_id,
                description=f"Deployed to kit {kit.name}",
                details={
                    "kit_id": kit_id,
                    "kit_name": kit.name,
                    "notes": data.get("notes"),
                    "expected_return_date": (
                        expected_return_date.isoformat() if expected_return_date else None
                    ),
                },
                old_status=old_status,
                new_status="checked_out",
            )
            db.session.add(history)

            AuditLog.log(
                user_id=current_user_id,
                action="kit_tool_checkout",
                resource_type="tool",
                resource_id=tool_id,
                details={
                    "tool_number": tool.tool_number,
                    "kit_id": kit_id,
                    "kit_name": kit.name,
                    "kit_tool_checkout_id": ktc.id,
                },
                ip_address=request.remote_addr,
            )

            activity = UserActivity(
                user_id=current_user_id,
                activity_type="kit_tool_checkout",
                description=f"Sent tool {tool.tool_number} to kit {kit.name}",
                ip_address=request.remote_addr,
            )
            db.session.add(activity)

            db.session.commit()

            logger.info(
                "Tool %s sent to kit %s by user %s",
                tool.tool_number,
                kit.name,
                current_user_id,
            )

            return jsonify(
                {
                    "message": f"Tool {tool.tool_number} sent to kit {kit.name}",
                    "kit_tool_checkout": ktc.to_dict(),
                }
            ), 201

        except Exception:
            db.session.rollback()
            logger.exception("Error sending tool to kit")
            return jsonify({"error": "An unexpected error occurred"}), 500

    # ------------------------------------------------------------------ #
    # Return a tool from a kit                                            #
    # ------------------------------------------------------------------ #
    @app.route("/api/kit-tool-checkouts/<int:checkout_id>/return", methods=["POST"])
    @permission_required("checkout.checkin")
    def return_tool_from_kit(checkout_id):
        """
        Return a tool from a field kit back to the hangar.

        Body:
          return_notes  (optional) str
        """
        try:
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")

            ktc = db.session.get(KitToolCheckout, checkout_id)
            if not ktc:
                return jsonify({"error": "Kit tool checkout not found"}), 404
            if ktc.status != "active":
                return jsonify({"error": "This tool has already been returned"}), 409

            tool = db.session.get(Tool, ktc.tool_id)
            if not tool:
                return jsonify({"error": "Tool not found"}), 404

            # Close the checkout record
            ktc.return_date = datetime.now()
            ktc.returned_by_id = current_user_id
            ktc.return_notes = data.get("return_notes")
            ktc.status = "returned"

            # Restore the tool's previous state
            tool.status = "available"
            tool.location = ktc.previous_location or tool.location
            if ktc.previous_warehouse_id:
                tool.warehouse_id = ktc.previous_warehouse_id

            kit_name = ktc.kit.name if ktc.kit else f"Kit {ktc.kit_id}"

            # Record tool history
            history = ToolHistory.create_event(
                tool_id=tool.id,
                event_type="kit_return",
                user_id=current_user_id,
                description=f"Returned from kit {kit_name}",
                details={
                    "kit_id": ktc.kit_id,
                    "kit_name": kit_name,
                    "return_notes": data.get("return_notes"),
                    "kit_tool_checkout_id": ktc.id,
                },
                old_status="checked_out",
                new_status="available",
            )
            db.session.add(history)

            AuditLog.log(
                user_id=current_user_id,
                action="kit_tool_return",
                resource_type="tool",
                resource_id=tool.id,
                details={
                    "tool_number": tool.tool_number,
                    "kit_id": ktc.kit_id,
                    "kit_name": kit_name,
                    "kit_tool_checkout_id": ktc.id,
                },
                ip_address=request.remote_addr,
            )

            activity = UserActivity(
                user_id=current_user_id,
                activity_type="kit_tool_return",
                description=f"Returned tool {tool.tool_number} from kit {kit_name}",
                ip_address=request.remote_addr,
            )
            db.session.add(activity)

            db.session.commit()

            logger.info(
                "Tool %s returned from kit %s by user %s",
                tool.tool_number,
                kit_name,
                current_user_id,
            )

            return jsonify(
                {
                    "message": f"Tool {tool.tool_number} returned from {kit_name}",
                    "kit_tool_checkout": ktc.to_dict(),
                }
            ), 200

        except Exception:
            db.session.rollback()
            logger.exception("Error returning tool from kit")
            return jsonify({"error": "An unexpected error occurred"}), 500

    # ------------------------------------------------------------------ #
    # List tools currently at a specific kit                              #
    # ------------------------------------------------------------------ #
    @app.route("/api/kits/<int:kit_id>/tool-checkouts", methods=["GET"])
    @permission_required("checkout.view")
    def get_kit_tool_checkouts(kit_id):
        """Return all active (and optionally historical) tool checkouts for a kit."""
        kit = db.session.get(Kit, kit_id)
        if not kit:
            return jsonify({"error": "Kit not found"}), 404

        include_returned = request.args.get("include_returned", "false").lower() == "true"

        query = KitToolCheckout.query.filter_by(kit_id=kit_id)
        if not include_returned:
            query = query.filter_by(status="active")

        checkouts = query.order_by(KitToolCheckout.checkout_date.desc()).all()

        return jsonify(
            {
                "kit_id": kit_id,
                "kit_name": kit.name,
                "checkouts": [c.to_dict() for c in checkouts],
                "total": len(checkouts),
            }
        ), 200

    # ------------------------------------------------------------------ #
    # List all active kit tool checkouts (for dashboard)                  #
    # ------------------------------------------------------------------ #
    @app.route("/api/kit-tool-checkouts/active", methods=["GET"])
    @permission_required("checkout.view")
    def get_active_kit_tool_checkouts():
        """Return all tools currently deployed to any kit in the field."""
        checkouts = (
            KitToolCheckout.query.filter_by(status="active")
            .order_by(KitToolCheckout.checkout_date.desc())
            .all()
        )

        return jsonify(
            {
                "checkouts": [c.to_dict() for c in checkouts],
                "total": len(checkouts),
            }
        ), 200

    # ------------------------------------------------------------------ #
    # Stats for dashboard card                                             #
    # ------------------------------------------------------------------ #
    @app.route("/api/kit-tool-checkouts/stats", methods=["GET"])
    @jwt_required
    def get_kit_tool_checkout_stats():
        """Return counts for the dashboard field-tools card."""
        active_count = KitToolCheckout.query.filter_by(status="active").count()

        # Count how many distinct kits have tools deployed
        from sqlalchemy import func
        kits_with_tools = (
            db.session.query(func.count(func.distinct(KitToolCheckout.kit_id)))
            .filter(KitToolCheckout.status == "active")
            .scalar()
            or 0
        )

        # Overdue (expected return date in the past, still active)
        now = datetime.now()
        overdue_count = KitToolCheckout.query.filter(
            KitToolCheckout.status == "active",
            KitToolCheckout.expected_return_date.isnot(None),
            KitToolCheckout.expected_return_date < now,
        ).count()

        return jsonify(
            {
                "total_in_field": active_count,
                "kits_with_tools": kits_with_tools,
                "overdue": overdue_count,
            }
        ), 200

    # ------------------------------------------------------------------ #
    # Get a specific kit tool checkout record                             #
    # ------------------------------------------------------------------ #
    @app.route("/api/kit-tool-checkouts/<int:checkout_id>", methods=["GET"])
    @permission_required("checkout.view")
    def get_kit_tool_checkout(checkout_id):
        """Return a single kit tool checkout record by ID."""
        ktc = db.session.get(KitToolCheckout, checkout_id)
        if not ktc:
            return jsonify({"error": "Kit tool checkout not found"}), 404
        return jsonify({"kit_tool_checkout": ktc.to_dict()}), 200
