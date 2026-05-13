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
from models import Tool, db
from models_kits import Kit, KitToolCheckout
from services.kit_tool_checkout_service import (
    is_tool_available,
    return_kit_tool_checkout,
    send_tool_to_kit,
)
from utils.warehouse_scope import current_warehouse_scope


logger = logging.getLogger(__name__)


# Backwards-compatible alias for tests that previously imported this name.
_is_tool_available = is_tool_available


def register_kit_tool_checkout_routes(app):
    """Register all kit tool checkout routes."""

    # ------------------------------------------------------------------ #
    # Send a tool to a kit                                                 #
    # ------------------------------------------------------------------ #
    @app.route("/api/kits/<int:kit_id>/tool-checkouts", methods=["POST"])
    @permission_required("checkout.create")
    def send_tool_to_kit_route(kit_id):
        """
        Deploy a tool from the warehouse to a field kit.

        Body:
          tool_id             (required) int
          notes               (optional) str
          expected_return_date (optional) ISO date string
        """
        try:
            data = request.get_json() or {}
            tool_id = data.get("tool_id")
            if not tool_id:
                return jsonify({"error": "tool_id is required"}), 400

            payload, status = send_tool_to_kit(
                tool_id=tool_id,
                kit_id=kit_id,
                current_user_id=request.current_user.get("user_id"),
                notes=data.get("notes"),
                expected_return_date_raw=data.get("expected_return_date"),
            )
            return jsonify(payload), status
        except Exception:
            db.session.rollback()
            logger.exception("Error sending tool to kit")
            return jsonify({"error": "An unexpected error occurred"}), 500

    # ------------------------------------------------------------------ #
    # Return a tool from a kit                                            #
    # ------------------------------------------------------------------ #
    @app.route("/api/kit-tool-checkouts/<int:checkout_id>/return", methods=["POST"])
    @permission_required("checkout.checkin")
    def return_tool_from_kit_route(checkout_id):
        """
        Return a tool from a field kit back to the hangar.

        Body:
          return_notes  (optional) str
        """
        try:
            data = request.get_json() or {}
            ktc = db.session.get(KitToolCheckout, checkout_id)
            if not ktc:
                return jsonify({"error": "Kit tool checkout not found"}), 404

            payload, status = return_kit_tool_checkout(
                ktc=ktc,
                current_user_id=request.current_user.get("user_id"),
                return_notes=data.get("return_notes"),
            )
            return jsonify(payload), status
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
        """Return all tools currently deployed to any kit in the field.

        Non-admins are always scoped to their active warehouse (based on the
        source warehouse of the tool). Admins see every warehouse by default
        and may narrow the list via an optional ``warehouse_id`` query param.
        """
        is_admin, active_warehouse_id = current_warehouse_scope()
        requested_warehouse_id = request.args.get("warehouse_id", type=int)

        # Non-admins without an active warehouse get an empty list — same
        # pattern as /api/tool-checkouts/active.
        if not is_admin and active_warehouse_id is None:
            return jsonify({"checkouts": [], "total": 0}), 200

        if is_admin:
            effective_warehouse_id = requested_warehouse_id
        else:
            # Non-admins are pinned to their active warehouse regardless of
            # any warehouse_id hint from the client.
            effective_warehouse_id = active_warehouse_id

        query = KitToolCheckout.query.filter_by(status="active")
        if effective_warehouse_id is not None:
            query = query.join(Tool, KitToolCheckout.tool_id == Tool.id).filter(
                Tool.warehouse_id == effective_warehouse_id
            )

        checkouts = query.order_by(KitToolCheckout.checkout_date.desc()).all()

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
