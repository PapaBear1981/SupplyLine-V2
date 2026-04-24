"""
Tool Checkout Routes

This module provides comprehensive API endpoints for the tool checkout system,
including checkout, check-in, damage reporting, and history tracking.
"""

import logging
from datetime import datetime, timedelta

from flask import jsonify, request

from auth.jwt_manager import jwt_required, permission_required
from models import (
    AuditLog,
    Checkout,
    Tool,
    ToolCalibration,
    ToolHistory,
    ToolServiceRecord,
    User,
    UserActivity,
    db,
)
from utils.error_handler import ValidationError
from utils.transaction_helper import record_tool_checkout, record_tool_return
from utils.warehouse_scope import (
    assert_active_warehouse_matches,
    current_warehouse_scope,
)


logger = logging.getLogger(__name__)


def register_tool_checkout_routes(app):
    """Register all tool checkout related routes"""

        # ============================================
    # Tool Availability Check
    # ============================================
    @app.route("/api/tools/<int:tool_id>/availability", methods=["GET"])
    @jwt_required
    def check_tool_availability(tool_id):
        """
        Check if a tool is available for checkout.
        Returns detailed status including any blocking reasons.
        """
        tool = db.session.get(Tool, tool_id)
        if not tool:
            return jsonify({"error": "Tool not found"}), 404

        availability = {
            "tool_id": tool_id,
            "tool_number": tool.tool_number,
            "serial_number": tool.serial_number,
            "available": True,
            "blocking_reasons": [],
            "warnings": [],
            "current_status": tool.status,
            "condition": tool.condition,
            "calibration_status": tool.calibration_status,
        }

        # Check if tool is already checked out
        active_checkout = Checkout.query.filter_by(
            tool_id=tool_id,
            return_date=None
        ).first()

        if active_checkout:
            availability["available"] = False
            availability["blocking_reasons"].append({
                "reason": "already_checked_out",
                "message": f"Tool is currently checked out to {active_checkout.user.name if active_checkout.user else 'Unknown'}",
                "checkout_id": active_checkout.id,
                "checkout_date": active_checkout.checkout_date.isoformat() if active_checkout.checkout_date else None,
                "expected_return_date": active_checkout.expected_return_date.isoformat() if active_checkout.expected_return_date else None,
            })

        # Check calibration status - block if overdue
        if tool.requires_calibration and tool.calibration_status == "overdue":
            availability["available"] = False
            availability["blocking_reasons"].append({
                "reason": "calibration_overdue",
                "message": "Tool calibration is overdue and must be recalibrated before checkout",
                "next_calibration_date": tool.next_calibration_date.isoformat() if tool.next_calibration_date else None,
            })

        # Warn if calibration is due soon
        if tool.requires_calibration and tool.calibration_status == "due_soon":
            availability["warnings"].append({
                "type": "calibration_due_soon",
                "message": "Tool calibration is due soon",
                "next_calibration_date": tool.next_calibration_date.isoformat() if tool.next_calibration_date else None,
            })

        # Check if tool is in maintenance
        if tool.status == "maintenance":
            availability["available"] = False
            availability["blocking_reasons"].append({
                "reason": "in_maintenance",
                "message": f"Tool is currently in maintenance: {tool.status_reason or 'No reason provided'}",
            })

        # Check if tool is retired
        if tool.status == "retired":
            availability["available"] = False
            availability["blocking_reasons"].append({
                "reason": "retired",
                "message": f"Tool has been retired: {tool.status_reason or 'No reason provided'}",
            })

        # Check if tool condition is damaged/unusable
        if tool.condition and tool.condition.lower() in ["damaged", "unusable", "broken"]:
            availability["available"] = False
            availability["blocking_reasons"].append({
                "reason": "damaged",
                "message": f"Tool is marked as {tool.condition} and cannot be checked out",
            })

        return jsonify(availability), 200

    # ============================================
    # Get Active Checkout for a Tool
    # ============================================
    @app.route("/api/tools/<int:tool_id>/active-checkout", methods=["GET"])
    @permission_required("checkout.view")
    def get_tool_active_checkout(tool_id):
        """
        Return the active (not-yet-returned) checkout record for a specific tool.
        Used by the mobile scan-to-return flow.
        Returns 404 if the tool is not currently checked out, or if the tool
        isn't in the caller's active warehouse (non-admin).
        """
        tool = db.session.get(Tool, tool_id)
        if not tool:
            return jsonify({"error": "Tool not found"}), 404

        is_admin, active_warehouse_id = current_warehouse_scope()
        if not is_admin and (
            active_warehouse_id is None or tool.warehouse_id != active_warehouse_id
        ):
            return jsonify({"error": "Tool not found"}), 404

        checkout = Checkout.query.filter_by(tool_id=tool_id, return_date=None).first()
        if not checkout:
            return jsonify({"error": "This tool is not currently checked out"}), 404
        return jsonify({"checkout": checkout.to_dict()}), 200

    # ============================================
    # Enhanced Checkout Endpoint
    # ============================================
    @app.route("/api/tool-checkout", methods=["POST"])
    @permission_required("checkout.create")
    def create_tool_checkout():
        """
        Create a new tool checkout with enhanced tracking.
        Includes blocking logic for unavailable tools.
        """
        try:
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")
            user_payload = request.current_user

            # Required fields
            tool_id = data.get("tool_id")
            if not tool_id:
                return jsonify({"error": "tool_id is required"}), 400

            # User performing the checkout (defaults to current user)
            checkout_user_id = data.get("user_id") or user_payload.get("user_id")

            # Get the tool
            tool = db.session.get(Tool, tool_id)
            if not tool:
                return jsonify({"error": f"Tool with ID {tool_id} not found"}), 404

            # Enforce warehouse scope — user must be working in this tool's warehouse
            try:
                assert_active_warehouse_matches(tool)
            except ValidationError as scope_err:
                return jsonify({"error": str(scope_err), "code": "WAREHOUSE_SCOPE"}), 409

            # Get the user checking out the tool
            checkout_user = db.session.get(User, checkout_user_id)
            if not checkout_user:
                return jsonify({"error": f"User with ID {checkout_user_id} not found"}), 404

            # ==========================================
            # Blocking Logic - Check availability
            # ==========================================

            blocking_reasons = []

            # Check if already checked out
            active_checkout = Checkout.query.filter_by(
                tool_id=tool_id,
                return_date=None
            ).first()
            if active_checkout:
                blocking_reasons.append(
                    f"Tool is already checked out to {active_checkout.user.name if active_checkout.user else 'Unknown'}"
                )

            # Check calibration status
            if tool.requires_calibration and tool.calibration_status == "overdue":
                blocking_reasons.append("Tool calibration is overdue")

            # Check tool status
            if tool.status == "maintenance":
                blocking_reasons.append(f"Tool is in maintenance: {tool.status_reason or 'No reason provided'}")
            if tool.status == "retired":
                blocking_reasons.append(f"Tool has been retired: {tool.status_reason or 'No reason provided'}")

            # Check condition
            if tool.condition and tool.condition.lower() in ["damaged", "unusable", "broken"]:
                blocking_reasons.append(f"Tool is marked as {tool.condition}")

            # If there are blocking reasons, return error
            if blocking_reasons:
                return jsonify({
                    "error": "Tool cannot be checked out",
                    "blocking_reasons": blocking_reasons
                }), 409

            # ==========================================
            # Create the checkout
            # ==========================================

            # Parse expected return date
            expected_return_date = data.get("expected_return_date")
            if expected_return_date:
                try:
                    if isinstance(expected_return_date, str):
                        # Handle ISO format or common date formats
                        expected_return_date = datetime.fromisoformat(
                            expected_return_date.replace("Z", "+00:00").replace("+00:00", "")
                        )
                except (ValueError, TypeError):
                    expected_return_date = datetime.now() + timedelta(days=7)
            else:
                expected_return_date = datetime.now() + timedelta(days=7)

            # Create checkout record
            checkout = Checkout(
                tool_id=tool_id,
                user_id=checkout_user_id,
                expected_return_date=expected_return_date,
                checkout_notes=data.get("notes") or data.get("checkout_notes"),
                condition_at_checkout=data.get("condition_at_checkout") or tool.condition,
                work_order=data.get("work_order"),
                project=data.get("project"),
            )
            db.session.add(checkout)

            # Update tool status
            old_status = tool.status
            tool.status = "checked_out"

            db.session.flush()  # Get the checkout ID

            # Record in tool history
            history_entry = ToolHistory.create_event(
                tool_id=tool_id,
                event_type="checkout",
                user_id=user_payload.get("user_id"),
                description=f"Checked out to {checkout_user.name}",
                details={
                    "checkout_user_id": checkout_user_id,
                    "checkout_user_name": checkout_user.name,
                    "expected_return_date": expected_return_date.isoformat() if expected_return_date else None,
                    "work_order": data.get("work_order"),
                    "project": data.get("project"),
                    "notes": data.get("notes"),
                },
                related_checkout_id=checkout.id,
                old_status=old_status,
                new_status="checked_out",
            )
            db.session.add(history_entry)

            # Record transaction for audit
            try:
                record_tool_checkout(
                    tool_id=tool_id,
                    user_id=checkout_user_id,
                    expected_return_date=expected_return_date,
                    notes=f"Checked out to {checkout_user.name}"
                )
            except Exception as e:
                logger.warning(f"Failed to record checkout transaction: {e}")

            # Add audit log
            AuditLog.log(
                user_id=current_user_id,
                action="tool_checkout",
                resource_type="tool",
                resource_id=tool_id,
                details={
                    "tool_number": tool.tool_number,
                    "checkout_user_id": checkout_user_id,
                    "checkout_user_name": checkout_user.name,
                    "checkout_id": checkout.id
                },
                ip_address=request.remote_addr
            )

            # Add user activity
            activity = UserActivity(
                user_id=user_payload.get("user_id"),
                activity_type="tool_checkout",
                description=f"Checked out tool {tool.tool_number} to {checkout_user.name}",
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            db.session.commit()

            logger.info(f"Tool {tool.tool_number} checked out to {checkout_user.name}")

            return jsonify({
                "message": f"Tool {tool.tool_number} checked out successfully",
                "checkout": checkout.to_dict()
            }), 201

        except Exception as e:
            db.session.rollback()
            logger.exception("Error during tool checkout")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Batch Checkout Endpoint
    # ============================================
    @app.route("/api/tool-checkout/batch", methods=["POST"])
    @permission_required("checkout.create")
    def batch_tool_checkout():
        """
        Check out multiple tools at once to the same user.
        Each tool is processed independently; partial failures are reported
        without rolling back successful checkouts.
        Returns a per-tool result list along with aggregate counts.
        """
        try:
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")
            user_payload = request.current_user

            tool_ids = data.get("tool_ids")
            if not tool_ids or not isinstance(tool_ids, list) or len(tool_ids) == 0:
                return jsonify({"error": "tool_ids must be a non-empty list"}), 400

            # Deduplicate while preserving order
            seen = set()
            unique_tool_ids = []
            for tid in tool_ids:
                if tid not in seen:
                    seen.add(tid)
                    unique_tool_ids.append(tid)

            checkout_user_id = data.get("user_id") or user_payload.get("user_id")
            checkout_user = db.session.get(User, checkout_user_id)
            if not checkout_user:
                return jsonify({"error": f"User with ID {checkout_user_id} not found"}), 404

            # Parse expected return date once for all tools
            expected_return_date = data.get("expected_return_date")
            if expected_return_date:
                try:
                    if isinstance(expected_return_date, str):
                        expected_return_date = datetime.fromisoformat(
                            expected_return_date.replace("Z", "+00:00").replace("+00:00", "")
                        )
                except (ValueError, TypeError):
                    expected_return_date = datetime.now() + timedelta(days=7)
            else:
                expected_return_date = datetime.now() + timedelta(days=7)

            results = []
            succeeded = 0
            failed = 0

            for tool_id in unique_tool_ids:
                tool = db.session.get(Tool, tool_id)
                if not tool:
                    results.append({
                        "tool_id": tool_id,
                        "tool_number": None,
                        "success": False,
                        "error": f"Tool with ID {tool_id} not found",
                    })
                    failed += 1
                    continue

                # Enforce warehouse scope per tool
                try:
                    assert_active_warehouse_matches(tool)
                except ValidationError as scope_err:
                    results.append({
                        "tool_id": tool_id,
                        "tool_number": tool.tool_number,
                        "success": False,
                        "error": str(scope_err),
                        "code": "WAREHOUSE_SCOPE",
                    })
                    failed += 1
                    continue

                # Check availability
                blocking_reasons = []

                active_checkout = Checkout.query.filter_by(
                    tool_id=tool_id, return_date=None
                ).first()
                if active_checkout:
                    blocking_reasons.append(
                        f"Already checked out to {active_checkout.user.name if active_checkout.user else 'Unknown'}"
                    )

                if tool.requires_calibration and tool.calibration_status == "overdue":
                    blocking_reasons.append("Calibration is overdue")

                if tool.status == "maintenance":
                    blocking_reasons.append(
                        f"In maintenance: {tool.status_reason or 'No reason provided'}"
                    )
                if tool.status == "retired":
                    blocking_reasons.append(
                        f"Retired: {tool.status_reason or 'No reason provided'}"
                    )

                if tool.condition and tool.condition.lower() in ["damaged", "unusable", "broken"]:
                    blocking_reasons.append(f"Marked as {tool.condition}")

                if blocking_reasons:
                    results.append({
                        "tool_id": tool_id,
                        "tool_number": tool.tool_number,
                        "success": False,
                        "error": "; ".join(blocking_reasons),
                    })
                    failed += 1
                    continue

                # Create the checkout
                try:
                    checkout = Checkout(
                        tool_id=tool_id,
                        user_id=checkout_user_id,
                        expected_return_date=expected_return_date,
                        checkout_notes=data.get("notes") or data.get("checkout_notes"),
                        condition_at_checkout=data.get("condition_at_checkout") or tool.condition,
                        work_order=data.get("work_order"),
                        project=data.get("project"),
                    )
                    db.session.add(checkout)

                    old_status = tool.status
                    tool.status = "checked_out"

                    db.session.flush()

                    history_entry = ToolHistory.create_event(
                        tool_id=tool_id,
                        event_type="checkout",
                        user_id=current_user_id,
                        description=f"Checked out to {checkout_user.name} (batch)",
                        details={
                            "checkout_user_id": checkout_user_id,
                            "checkout_user_name": checkout_user.name,
                            "expected_return_date": expected_return_date.isoformat(),
                            "work_order": data.get("work_order"),
                            "project": data.get("project"),
                            "notes": data.get("notes"),
                            "batch": True,
                        },
                        related_checkout_id=checkout.id,
                        old_status=old_status,
                        new_status="checked_out",
                    )
                    db.session.add(history_entry)

                    AuditLog.log(
                        user_id=current_user_id,
                        action="tool_checkout_batch",
                        resource_type="tool",
                        resource_id=tool_id,
                        details={
                            "tool_number": tool.tool_number,
                            "checkout_user_id": checkout_user_id,
                            "checkout_user_name": checkout_user.name,
                            "checkout_id": checkout.id,
                            "batch": True,
                        },
                        ip_address=request.remote_addr,
                    )

                    db.session.commit()

                    results.append({
                        "tool_id": tool_id,
                        "tool_number": tool.tool_number,
                        "success": True,
                        "checkout": checkout.to_dict(),
                    })
                    succeeded += 1
                    logger.info(f"Batch: tool {tool.tool_number} checked out to {checkout_user.name}")

                except Exception as tool_error:
                    db.session.rollback()
                    logger.warning(f"Batch checkout failed for tool {tool_id}: {tool_error}")
                    results.append({
                        "tool_id": tool_id,
                        "tool_number": tool.tool_number if tool else None,
                        "success": False,
                        "error": str(tool_error),
                    })
                    failed += 1

            # Log a single user activity for the whole batch
            try:
                tool_numbers = [r["tool_number"] for r in results if r["success"]]
                if tool_numbers:
                    activity = UserActivity(
                        user_id=current_user_id,
                        activity_type="tool_checkout_batch",
                        description=f"Batch checkout of {len(tool_numbers)} tool(s) to {checkout_user.name}: {', '.join(tool_numbers)}",
                        ip_address=request.remote_addr,
                    )
                    db.session.add(activity)
                    db.session.commit()
            except Exception as e:
                logger.warning(f"Failed to record batch checkout activity: {e}")

            status_code = 201 if failed == 0 else (207 if succeeded > 0 else 409)
            return jsonify({
                "results": results,
                "total": len(results),
                "succeeded": succeeded,
                "failed": failed,
            }), status_code

        except Exception as e:
            db.session.rollback()
            logger.exception("Error during batch tool checkout")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Enhanced Check-In Endpoint
    # ============================================
    @app.route("/api/tool-checkout/<int:checkout_id>/checkin", methods=["POST"])
    @permission_required("checkout.return")
    def checkin_tool(checkout_id):
        """
        Check in a tool with enhanced tracking including damage reporting.
        """
        try:
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")
            user_payload = request.current_user
            current_user_id = user_payload.get("user_id")

            # Get the checkout record
            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
                return jsonify({"error": f"Checkout with ID {checkout_id} not found"}), 404

            # Check if already returned
            if checkout.return_date:
                return jsonify({"error": "This tool has already been returned"}), 400

            # Get the tool
            tool = checkout.tool
            if not tool:
                return jsonify({"error": "Tool not found for this checkout"}), 404

            # Enforce warehouse scope — you check tools in to their home warehouse
            try:
                assert_active_warehouse_matches(tool)
            except ValidationError as scope_err:
                return jsonify({"error": str(scope_err), "code": "WAREHOUSE_SCOPE"}), 409

            # Location is required on check-in
            location = (data.get("location") or "").strip()
            if not location:
                return jsonify({"error": "Return location is required"}), 400

            # Process return details
            condition_at_return = data.get("condition_at_return") or data.get("condition")
            return_notes = data.get("return_notes") or data.get("notes")
            damage_reported = data.get("damage_reported", False)
            damage_description = data.get("damage_description")
            damage_severity = data.get("damage_severity")

            # Update checkout record
            checkout.return_date = datetime.now()
            checkout.condition_at_return = condition_at_return
            checkout.return_notes = return_notes
            checkout.checked_in_by_id = current_user_id
            checkout.damage_reported = damage_reported

            if damage_reported:
                checkout.damage_description = damage_description
                checkout.damage_severity = damage_severity
                checkout.damage_reported_date = datetime.now()

            # Update tool status, condition, and location
            old_status = tool.status
            old_condition = tool.condition

            tool.location = location

            if damage_reported and damage_severity in ["severe", "unusable"]:
                # Put tool in maintenance if severely damaged
                tool.status = "maintenance"
                tool.status_reason = f"Damage reported on return: {damage_description}"
                tool.condition = "Damaged"
            else:
                tool.status = "available"
                if condition_at_return:
                    tool.condition = condition_at_return

            # Record in tool history - return event
            history_entry = ToolHistory.create_event(
                tool_id=tool.id,
                event_type="return",
                user_id=current_user_id,
                description=f"Returned by {checkout.user.name if checkout.user else 'Unknown'}",
                details={
                    "checkout_id": checkout_id,
                    "original_user_id": checkout.user_id,
                    "original_user_name": checkout.user.name if checkout.user else "Unknown",
                    "checked_in_by_id": current_user_id,
                    "condition_at_return": condition_at_return,
                    "return_location": location,
                    "notes": return_notes,
                    "checkout_date": checkout.checkout_date.isoformat() if checkout.checkout_date else None,
                },
                related_checkout_id=checkout_id,
                old_status=old_status,
                new_status=tool.status,
                old_condition=old_condition,
                new_condition=tool.condition,
            )
            db.session.add(history_entry)

            # If damage was reported, create a separate damage event
            if damage_reported:
                damage_history = ToolHistory.create_event(
                    tool_id=tool.id,
                    event_type="damage_reported",
                    user_id=current_user_id,
                    description=f"Damage reported: {damage_severity or 'Unknown severity'}",
                    details={
                        "checkout_id": checkout_id,
                        "damage_severity": damage_severity,
                        "damage_description": damage_description,
                        "reported_by_id": current_user_id,
                    },
                    related_checkout_id=checkout_id,
                    old_condition=old_condition,
                    new_condition=tool.condition,
                )
                db.session.add(damage_history)

            # Record transaction for audit
            try:
                record_tool_return(
                    tool_id=tool.id,
                    user_id=current_user_id,
                    condition=condition_at_return,
                    notes=f"Returned. {return_notes or ''} {'Damage: ' + damage_description if damage_reported else ''}"
                )
            except Exception as e:
                logger.warning(f"Failed to record return transaction: {e}")

            # Add audit log
            AuditLog.log(
                user_id=current_user_id,
                action="tool_return",
                resource_type="tool",
                resource_id=tool.id,
                details={
                    "tool_number": tool.tool_number,
                    "checkout_id": checkout_id,
                    "condition_at_return": condition_at_return,
                    "damage_reported": damage_reported,
                    "damage_severity": damage_severity if damage_reported else None
                },
                ip_address=request.remote_addr
            )

            # Add user activity
            activity = UserActivity(
                user_id=current_user_id,
                activity_type="tool_return",
                description=f"Returned tool {tool.tool_number}" + (f" (Damage reported: {damage_severity})" if damage_reported else ""),
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            db.session.commit()

            logger.info(f"Tool {tool.tool_number} returned successfully")

            return jsonify({
                "message": f"Tool {tool.tool_number} returned successfully",
                "checkout": checkout.to_dict(),
                "damage_reported": damage_reported,
            }), 200

        except Exception as e:
            db.session.rollback()
            logger.exception("Error during tool check-in")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Get Active Checkouts
    # ============================================
    @app.route("/api/tool-checkouts/active", methods=["GET"])
    @permission_required("checkout.view")
    def get_active_checkouts():
        """Get all currently active (not returned) checkouts"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)
            search = request.args.get("q", "")
            department = request.args.get("department")
            overdue_only = request.args.get("overdue_only", "false").lower() == "true"

            is_admin, active_warehouse_id = current_warehouse_scope()

            # Non-admins with no active warehouse see nothing.
            if not is_admin and active_warehouse_id is None:
                return jsonify({
                    "checkouts": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }), 200

            query = Checkout.query.filter(Checkout.return_date.is_(None))

            # Track whether Tool / User have already been joined so we don't
            # re-join them below (duplicate joins raise in SQLAlchemy).
            tool_joined = False
            user_joined = False

            # Scope to the user's active warehouse (admins see everything).
            if not is_admin:
                query = query.join(Tool, Checkout.tool_id == Tool.id).filter(
                    Tool.warehouse_id == active_warehouse_id
                )
                tool_joined = True

            # Filter by overdue
            if overdue_only:
                now = datetime.now()
                query = query.filter(
                    Checkout.expected_return_date < now
                )

            # Search by tool number, serial number, or user name
            if search:
                if not tool_joined:
                    query = query.join(Tool, Checkout.tool_id == Tool.id)
                    tool_joined = True
                query = query.join(User, Checkout.user_id == User.id).filter(
                    db.or_(
                        Tool.tool_number.ilike(f"%{search}%"),
                        Tool.serial_number.ilike(f"%{search}%"),
                        Tool.description.ilike(f"%{search}%"),
                        User.name.ilike(f"%{search}%"),
                        User.employee_number.ilike(f"%{search}%"),
                    )
                )
                user_joined = True

            # Filter by department
            if department:
                if not user_joined:
                    query = query.join(User, Checkout.user_id == User.id)
                    user_joined = True
                query = query.filter(User.department == department)

            # Order by checkout date (most recent first)
            query = query.order_by(Checkout.checkout_date.desc())

            # Paginate
            total = query.count()
            checkouts = query.offset((page - 1) * per_page).limit(per_page).all()

            return jsonify({
                "checkouts": [c.to_dict() for c in checkouts],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }), 200

        except Exception as e:
            logger.exception("Error getting active checkouts")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Get User's Checkouts
    # ============================================
    @app.route("/api/tool-checkouts/my", methods=["GET"])
    @jwt_required
    def get_my_checkouts():
        """Get current user's checkouts (scoped to active warehouse)."""
        try:
            user_id = request.current_user.get("user_id")
            include_returned = request.args.get("include_returned", "false").lower() == "true"
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)

            is_admin, active_warehouse_id = current_warehouse_scope()

            if not is_admin and active_warehouse_id is None:
                return jsonify({
                    "checkouts": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }), 200

            query = Checkout.query.filter(Checkout.user_id == user_id)

            if not is_admin:
                query = query.join(Tool, Checkout.tool_id == Tool.id).filter(
                    Tool.warehouse_id == active_warehouse_id
                )

            if not include_returned:
                query = query.filter(Checkout.return_date.is_(None))

            query = query.order_by(Checkout.checkout_date.desc())

            total = query.count()
            checkouts = query.offset((page - 1) * per_page).limit(per_page).all()

            return jsonify({
                "checkouts": [c.to_dict() for c in checkouts],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }), 200

        except Exception as e:
            logger.exception("Error getting user checkouts")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Get Overdue Checkouts
    # ============================================
    @app.route("/api/tool-checkouts/overdue", methods=["GET"])
    @permission_required("checkout.view")
    def get_overdue_tool_checkouts():
        """Get all overdue checkouts (scoped to the user's active warehouse)."""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)

            is_admin, active_warehouse_id = current_warehouse_scope()

            if not is_admin and active_warehouse_id is None:
                return jsonify({
                    "checkouts": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }), 200

            now = datetime.now()
            query = Checkout.query.filter(
                Checkout.return_date.is_(None),
                Checkout.expected_return_date < now
            )

            if not is_admin:
                query = query.join(Tool, Checkout.tool_id == Tool.id).filter(
                    Tool.warehouse_id == active_warehouse_id
                )

            query = query.order_by(Checkout.expected_return_date.asc())  # Most overdue first

            total = query.count()
            checkouts = query.offset((page - 1) * per_page).limit(per_page).all()

            return jsonify({
                "checkouts": [c.to_dict() for c in checkouts],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }), 200

        except Exception as e:
            logger.exception("Error getting overdue checkouts")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Get Due Today Checkouts
    # ============================================
    @app.route("/api/tool-checkouts/due-today", methods=["GET"])
    @permission_required("checkout.view")
    def get_due_today_checkouts():
        """Get active checkouts due today (scoped to the user's active warehouse)."""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)

            is_admin, active_warehouse_id = current_warehouse_scope()

            if not is_admin and active_warehouse_id is None:
                return jsonify({
                    "checkouts": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }), 200

            now = datetime.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

            query = Checkout.query.filter(
                Checkout.return_date.is_(None),
                Checkout.expected_return_date >= today_start,
                Checkout.expected_return_date <= today_end,
            )

            if not is_admin:
                query = query.join(Tool, Checkout.tool_id == Tool.id).filter(
                    Tool.warehouse_id == active_warehouse_id
                )

            query = query.order_by(Checkout.expected_return_date.asc())

            total = query.count()
            checkouts = query.offset((page - 1) * per_page).limit(per_page).all()

            return jsonify({
                "checkouts": [c.to_dict() for c in checkouts],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }), 200

        except Exception as e:
            logger.exception("Error getting due today checkouts")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Get Checkout Details
    # ============================================
    @app.route("/api/tool-checkouts/<int:checkout_id>", methods=["GET"])
    @jwt_required
    def get_checkout_details(checkout_id):
        """Get detailed information about a specific checkout.

        Non-admins can only view checkouts whose tool is in their active
        warehouse.
        """
        try:
            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
                return jsonify({"error": "Checkout not found"}), 404

            is_admin, active_warehouse_id = current_warehouse_scope()
            if not is_admin:
                tool_warehouse_id = checkout.tool.warehouse_id if checkout.tool else None
                if (
                    active_warehouse_id is None
                    or tool_warehouse_id != active_warehouse_id
                ):
                    return jsonify({"error": "Checkout not found"}), 404

            result = checkout.to_dict()

            # Add tool details
            if checkout.tool:
                result["tool"] = checkout.tool.to_dict()

            # Add user details
            if checkout.user:
                result["user"] = {
                    "id": checkout.user.id,
                    "name": checkout.user.name,
                    "employee_number": checkout.user.employee_number,
                    "department": checkout.user.department,
                    "email": checkout.user.email,
                }

            return jsonify(result), 200

        except Exception as e:
            logger.exception("Error getting checkout details")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Get Checkout History for a Tool
    # ============================================
    @app.route("/api/tools/<int:tool_id>/checkout-history", methods=["GET"])
    @jwt_required
    def get_tool_checkout_history(tool_id):
        """Get complete checkout history for a tool (scoped to active warehouse)."""
        try:
            tool = db.session.get(Tool, tool_id)
            if not tool:
                return jsonify({"error": "Tool not found"}), 404

            is_admin, active_warehouse_id = current_warehouse_scope()
            # Non-admins can only view history for tools in their active warehouse.
            if not is_admin and (
                active_warehouse_id is None or tool.warehouse_id != active_warehouse_id
            ):
                return jsonify({"error": "Tool not found"}), 404

            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)

            query = Checkout.query.filter(
                Checkout.tool_id == tool_id
            ).order_by(Checkout.checkout_date.desc())

            total = query.count()
            checkouts = query.offset((page - 1) * per_page).limit(per_page).all()

            return jsonify({
                "tool": tool.to_dict(),
                "checkouts": [c.to_dict() for c in checkouts],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }), 200

        except Exception as e:
            logger.exception("Error getting tool checkout history")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Tool Timeline (Comprehensive History)
    # ============================================
    @app.route("/api/tools/<int:tool_id>/timeline", methods=["GET"])
    @jwt_required
    def get_tool_timeline(tool_id):
        """
        Get comprehensive timeline for a tool including all events:
        checkouts, returns, calibrations, maintenance, damage reports, etc.

        Non-admins can only view timelines for tools in their active warehouse.
        """
        try:
            tool = db.session.get(Tool, tool_id)
            if not tool:
                return jsonify({"error": "Tool not found"}), 404

            is_admin, active_warehouse_id = current_warehouse_scope()
            if not is_admin and (
                active_warehouse_id is None or tool.warehouse_id != active_warehouse_id
            ):
                return jsonify({"error": "Tool not found"}), 404

            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 100, type=int)
            event_type = request.args.get("event_type")  # Filter by event type

            query = ToolHistory.query.filter(ToolHistory.tool_id == tool_id)

            if event_type:
                query = query.filter(ToolHistory.event_type == event_type)

            query = query.order_by(ToolHistory.event_date.desc())

            total = query.count()
            events = query.offset((page - 1) * per_page).limit(per_page).all()

            # Get summary statistics
            stats = {
                "total_checkouts": Checkout.query.filter(Checkout.tool_id == tool_id).count(),
                "active_checkout": Checkout.query.filter(
                    Checkout.tool_id == tool_id,
                    Checkout.return_date.is_(None)
                ).first() is not None,
                "damage_reports": ToolHistory.query.filter(
                    ToolHistory.tool_id == tool_id,
                    ToolHistory.event_type == "damage_reported"
                ).count(),
                "calibrations": ToolCalibration.query.filter(
                    ToolCalibration.tool_id == tool_id
                ).count(),
                "service_records": ToolServiceRecord.query.filter(
                    ToolServiceRecord.tool_id == tool_id
                ).count(),
            }

            return jsonify({
                "tool": tool.to_dict(),
                "timeline": [e.to_dict() for e in events],
                "stats": stats,
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page,
            }), 200

        except Exception as e:
            logger.exception("Error getting tool timeline")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Checkout Statistics/Dashboard
    # ============================================
    @app.route("/api/tool-checkouts/stats", methods=["GET"])
    @jwt_required
    def get_checkout_stats():
        """Get checkout statistics for dashboard (scoped to active warehouse)."""
        try:
            now = datetime.now()
            thirty_days_ago = now - timedelta(days=30)
            seven_days_ago = now - timedelta(days=7)

            is_admin, active_warehouse_id = current_warehouse_scope()

            # Non-admins with no active warehouse get empty stats rather than
            # an error, so the dashboard still renders.
            if not is_admin and active_warehouse_id is None:
                return jsonify({
                    "active_checkouts": 0,
                    "overdue_checkouts": 0,
                    "checkouts_today": 0,
                    "returns_today": 0,
                    "checkouts_this_week": 0,
                    "checkouts_this_month": 0,
                    "damage_reports_this_month": 0,
                    "popular_tools": [],
                    "active_users": [],
                }), 200

            def scoped(query):
                """Apply warehouse scope to a Checkout-based query."""
                if is_admin:
                    return query
                return query.join(Tool, Checkout.tool_id == Tool.id).filter(
                    Tool.warehouse_id == active_warehouse_id
                )

            # Active checkouts count
            active_checkouts = scoped(Checkout.query.filter(
                Checkout.return_date.is_(None)
            )).count()

            # Overdue checkouts count
            overdue_checkouts = scoped(Checkout.query.filter(
                Checkout.return_date.is_(None),
                Checkout.expected_return_date < now
            )).count()

            # Checkouts today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            checkouts_today = scoped(Checkout.query.filter(
                Checkout.checkout_date >= today_start
            )).count()

            # Returns today
            returns_today = scoped(Checkout.query.filter(
                Checkout.return_date >= today_start
            )).count()

            # Checkouts this week
            checkouts_this_week = scoped(Checkout.query.filter(
                Checkout.checkout_date >= seven_days_ago
            )).count()

            # Checkouts this month
            checkouts_this_month = scoped(Checkout.query.filter(
                Checkout.checkout_date >= thirty_days_ago
            )).count()

            # Damage reports this month
            damage_reports = scoped(Checkout.query.filter(
                Checkout.damage_reported,
                Checkout.damage_reported_date >= thirty_days_ago
            )).count()

            # Most frequently checked out tools
            from sqlalchemy import func
            popular_tools_q = db.session.query(
                Tool.id,
                Tool.tool_number,
                Tool.description,
                func.count(Checkout.id).label("checkout_count")
            ).join(
                Checkout, Tool.id == Checkout.tool_id
            ).filter(
                Checkout.checkout_date >= thirty_days_ago
            )
            if not is_admin:
                popular_tools_q = popular_tools_q.filter(
                    Tool.warehouse_id == active_warehouse_id
                )
            popular_tools = popular_tools_q.group_by(
                Tool.id
            ).order_by(
                func.count(Checkout.id).desc()
            ).limit(10).all()

            # Most active users
            active_users_q = db.session.query(
                User.id,
                User.name,
                User.department,
                func.count(Checkout.id).label("checkout_count")
            ).join(
                Checkout, User.id == Checkout.user_id
            ).filter(
                Checkout.checkout_date >= thirty_days_ago
            )
            if not is_admin:
                active_users_q = active_users_q.join(
                    Tool, Checkout.tool_id == Tool.id
                ).filter(Tool.warehouse_id == active_warehouse_id)
            active_users = active_users_q.group_by(
                User.id
            ).order_by(
                func.count(Checkout.id).desc()
            ).limit(10).all()

            return jsonify({
                "active_checkouts": active_checkouts,
                "overdue_checkouts": overdue_checkouts,
                "checkouts_today": checkouts_today,
                "returns_today": returns_today,
                "checkouts_this_week": checkouts_this_week,
                "checkouts_this_month": checkouts_this_month,
                "damage_reports_this_month": damage_reports,
                "popular_tools": [
                    {
                        "id": t.id,
                        "tool_number": t.tool_number,
                        "description": t.description,
                        "checkout_count": t.checkout_count
                    } for t in popular_tools
                ],
                "active_users": [
                    {
                        "id": u.id,
                        "name": u.name,
                        "department": u.department,
                        "checkout_count": u.checkout_count
                    } for u in active_users
                ],
            }), 200

        except Exception as e:
            logger.exception("Error getting checkout stats")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Search Tools for Quick Checkout
    # ============================================
    @app.route("/api/tool-checkout/search", methods=["GET"])
    @jwt_required
    def search_tools_for_checkout():
        """Search for tools available for checkout.

        Non-admins only see tools that live in their active warehouse, so the
        checkout UI can never list a tool the user isn't allowed to check out.
        Admins see all tools to support cross-warehouse troubleshooting.
        """
        try:
            q = request.args.get("q", "")
            if len(q) < 2:
                return jsonify({"tools": []}), 200

            is_admin, active_warehouse_id = current_warehouse_scope()

            # Non-admins with no active warehouse have nothing to check out.
            if not is_admin and active_warehouse_id is None:
                return jsonify({"tools": []}), 200

            query = Tool.query.filter(
                db.or_(
                    Tool.tool_number.ilike(f"%{q}%"),
                    Tool.serial_number.ilike(f"%{q}%"),
                    Tool.description.ilike(f"%{q}%"),
                )
            )

            if not is_admin:
                query = query.filter(Tool.warehouse_id == active_warehouse_id)

            tools = query.limit(20).all()

            results = []
            for tool in tools:
                # Check availability for each tool
                active_checkout = Checkout.query.filter_by(
                    tool_id=tool.id,
                    return_date=None
                ).first()

                available = (
                    not active_checkout and
                    tool.status not in ["maintenance", "retired"] and
                    not (tool.requires_calibration and tool.calibration_status == "overdue") and
                    tool.condition not in ["Damaged", "Unusable", "Broken"]
                )

                results.append({
                    "id": tool.id,
                    "tool_number": tool.tool_number,
                    "serial_number": tool.serial_number,
                    "description": tool.description,
                    "category": tool.category,
                    "condition": tool.condition,
                    "status": tool.status,
                    "calibration_status": tool.calibration_status,
                    "available": available,
                    "checked_out_to": active_checkout.user.name if active_checkout and active_checkout.user else None,
                    "location": tool.location,
                })

            return jsonify({"tools": results}), 200

        except Exception as e:
            logger.exception("Error searching tools")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Report Damage on Active Checkout
    # ============================================
    @app.route("/api/tool-checkouts/<int:checkout_id>/report-damage", methods=["POST"])
    @jwt_required
    def report_checkout_damage(checkout_id):
        """Report damage on an active checkout without returning the tool"""
        try:
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")
            user_payload = request.current_user
            current_user_id = user_payload.get("user_id")

            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
                return jsonify({"error": "Checkout not found"}), 404

            # Warehouse scope: only allow damage reports on checkouts for
            # tools in the caller's active warehouse (admins bypass).
            is_admin, active_warehouse_id = current_warehouse_scope()
            if not is_admin:
                tool_warehouse_id = checkout.tool.warehouse_id if checkout.tool else None
                if (
                    active_warehouse_id is None
                    or tool_warehouse_id != active_warehouse_id
                ):
                    return jsonify({"error": "Checkout not found"}), 404

            if checkout.return_date:
                return jsonify({"error": "Cannot report damage on returned checkout"}), 400

            damage_description = data.get("damage_description")
            damage_severity = data.get("damage_severity")

            if not damage_description:
                return jsonify({"error": "damage_description is required"}), 400

            # Update checkout record
            checkout.damage_reported = True
            checkout.damage_description = damage_description
            checkout.damage_severity = damage_severity
            checkout.damage_reported_date = datetime.now()

            # Record in tool history
            tool = checkout.tool
            old_condition = tool.condition

            history_entry = ToolHistory.create_event(
                tool_id=tool.id,
                event_type="damage_reported",
                user_id=current_user_id,
                description=f"Damage reported during checkout: {damage_severity or 'Unknown severity'}",
                details={
                    "checkout_id": checkout_id,
                    "damage_severity": damage_severity,
                    "damage_description": damage_description,
                    "reported_by_id": current_user_id,
                },
                related_checkout_id=checkout_id,
                old_condition=old_condition,
            )
            db.session.add(history_entry)

            # Add audit log
            AuditLog.log(
                user_id=current_user_id,
                action="damage_reported",
                resource_type="tool",
                resource_id=tool.id,
                details={
                    "tool_number": tool.tool_number,
                    "checkout_id": checkout_id,
                    "damage_description": damage_description,
                    "damage_severity": damage_severity
                },
                ip_address=request.remote_addr
            )

            db.session.commit()

            return jsonify({
                "message": "Damage reported successfully",
                "checkout": checkout.to_dict()
            }), 200

        except Exception as e:
            db.session.rollback()
            logger.exception("Error reporting damage")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Extend Checkout Duration
    # ============================================
    @app.route("/api/tool-checkouts/<int:checkout_id>/extend", methods=["POST"])
    @jwt_required
    def extend_checkout(checkout_id):
        """Extend the expected return date for a checkout"""
        try:
            data = request.get_json() or {}
            user_payload = request.current_user

            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
                return jsonify({"error": "Checkout not found"}), 404

            # Warehouse scope: extending a checkout on a tool outside the
            # user's active warehouse is disallowed (admins bypass).
            is_admin, active_warehouse_id = current_warehouse_scope()
            if not is_admin:
                tool_warehouse_id = checkout.tool.warehouse_id if checkout.tool else None
                if (
                    active_warehouse_id is None
                    or tool_warehouse_id != active_warehouse_id
                ):
                    return jsonify({"error": "Checkout not found"}), 404

            if checkout.return_date:
                return jsonify({"error": "Cannot extend returned checkout"}), 400

            new_date = data.get("new_expected_return_date")
            if not new_date:
                return jsonify({"error": "new_expected_return_date is required"}), 400

            try:
                new_date = datetime.fromisoformat(new_date.replace("Z", "+00:00").replace("+00:00", ""))
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid date format"}), 400

            old_date = checkout.expected_return_date
            checkout.expected_return_date = new_date

            # Record in tool history
            history_entry = ToolHistory.create_event(
                tool_id=checkout.tool_id,
                event_type="checkout_extended",
                user_id=user_payload.get("user_id"),
                description=f"Checkout extended to {new_date.strftime('%Y-%m-%d')}",
                details={
                    "checkout_id": checkout_id,
                    "old_date": old_date.isoformat() if old_date else None,
                    "new_date": new_date.isoformat(),
                    "reason": data.get("reason"),
                },
                related_checkout_id=checkout_id,
            )
            db.session.add(history_entry)

            db.session.commit()

            return jsonify({
                "message": "Checkout extended successfully",
                "checkout": checkout.to_dict()
            }), 200

        except Exception as e:
            db.session.rollback()
            logger.exception("Error extending checkout")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Cross-Tool Audit History
    # ============================================
    @app.route("/api/tool-history", methods=["GET"])
    @permission_required("checkout.view")
    def get_tool_audit_history():
        """Cross-tool history for auditing — paginated, filterable.

        Non-admins only see history entries for tools in their active
        warehouse. Admins see entries across all warehouses.
        """
        try:
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)
            if page is None or per_page is None:
                return jsonify({"error": "page and per_page must be integers"}), 400
            page = max(1, page)
            per_page = min(max(1, per_page), 100)
            tool_id = request.args.get("tool_id", type=int)
            user_id = request.args.get("user_id", type=int)
            event_type = request.args.get("event_type")
            tool_search = request.args.get("tool_search")
            start_date_str = request.args.get("start_date")
            end_date_str = request.args.get("end_date")

            is_admin, active_warehouse_id = current_warehouse_scope()

            # Non-admins with no active warehouse see no history.
            if not is_admin and active_warehouse_id is None:
                return jsonify({
                    "history": [],
                    "total": 0,
                    "page": page,
                    "per_page": per_page,
                    "pages": 0,
                }), 200

            query = ToolHistory.query
            tool_joined = False

            # Warehouse scope — constrain history to tools in the active
            # warehouse for non-admins.
            if not is_admin:
                query = query.join(Tool, ToolHistory.tool_id == Tool.id).filter(
                    Tool.warehouse_id == active_warehouse_id
                )
                tool_joined = True

            if tool_id:
                query = query.filter(ToolHistory.tool_id == tool_id)
            if user_id:
                query = query.filter(ToolHistory.user_id == user_id)
            if event_type:
                query = query.filter(ToolHistory.event_type == event_type)
            if tool_search:
                if not tool_joined:
                    query = query.join(Tool, ToolHistory.tool_id == Tool.id)
                    tool_joined = True
                query = query.filter(
                    db.or_(
                        Tool.tool_number.ilike(f"%{tool_search}%"),
                        Tool.description.ilike(f"%{tool_search}%"),
                    )
                )
            if start_date_str:
                try:
                    start_date = datetime.fromisoformat(start_date_str.replace("Z", ""))
                    query = query.filter(ToolHistory.event_date >= start_date)
                except (ValueError, TypeError):
                    return jsonify({"error": "Invalid start_date format, use ISO 8601"}), 400
            if end_date_str:
                try:
                    end_date = datetime.fromisoformat(end_date_str.replace("Z", ""))
                    # Date-only strings (YYYY-MM-DD) parse to midnight; advance by one day
                    # so the full end day is included in the results.
                    if len(end_date_str) == 10:
                        query = query.filter(ToolHistory.event_date < end_date + timedelta(days=1))
                    else:
                        query = query.filter(ToolHistory.event_date <= end_date)
                except (ValueError, TypeError):
                    return jsonify({"error": "Invalid end_date format, use ISO 8601"}), 400

            query = query.order_by(ToolHistory.event_date.desc())
            paginated = query.paginate(page=page, per_page=per_page, error_out=False)

            return jsonify({
                "history": [event.to_dict() for event in paginated.items],
                "total": paginated.total,
                "page": page,
                "per_page": per_page,
                "pages": paginated.pages,
            }), 200

        except Exception as e:
            logger.exception("Error fetching tool audit history")
            return jsonify({"error": str(e)}), 500

    logger.info("Tool checkout routes registered")
