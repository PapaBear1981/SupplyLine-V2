"""
Tool Checkout Routes

This module provides comprehensive API endpoints for the tool checkout system,
including checkout, check-in, damage reporting, and history tracking.
"""

import logging
from datetime import datetime, timedelta

from flask import jsonify, request

from auth.jwt_manager import login_required
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
from utils.transaction_helper import record_tool_checkout, record_tool_return

logger = logging.getLogger(__name__)


def register_tool_checkout_routes(app):
    """Register all tool checkout related routes"""

    # ============================================
    # Tool Availability Check
    # ============================================
    @app.route("/api/tools/<int:tool_id>/availability", methods=["GET"])
    @login_required
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
    # Enhanced Checkout Endpoint
    # ============================================
    @app.route("/api/tool-checkout", methods=["POST"])
    @login_required
    def create_tool_checkout():
        """
        Create a new tool checkout with enhanced tracking.
        Includes blocking logic for unavailable tools.
        """
        try:
            data = request.get_json() or {}
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
            audit_log = AuditLog(
                action_type="tool_checkout",
                action_details=f"Tool {tool.tool_number} (ID: {tool_id}) checked out to {checkout_user.name} (ID: {checkout_user_id})"
            )
            db.session.add(audit_log)

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
    # Enhanced Check-In Endpoint
    # ============================================
    @app.route("/api/tool-checkout/<int:checkout_id>/checkin", methods=["POST"])
    @login_required
    def checkin_tool(checkout_id):
        """
        Check in a tool with enhanced tracking including damage reporting.
        """
        try:
            data = request.get_json() or {}
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

            # Update tool status and condition
            old_status = tool.status
            old_condition = tool.condition

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
            audit_log = AuditLog(
                action_type="tool_return",
                action_details=f"Tool {tool.tool_number} (ID: {tool.id}) returned. Condition: {condition_at_return or 'Not specified'}. Damage: {damage_reported}"
            )
            db.session.add(audit_log)

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
    @login_required
    def get_active_checkouts():
        """Get all currently active (not returned) checkouts"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)
            search = request.args.get("q", "")
            department = request.args.get("department")
            overdue_only = request.args.get("overdue_only", "false").lower() == "true"

            query = Checkout.query.filter(Checkout.return_date.is_(None))

            # Filter by overdue
            if overdue_only:
                now = datetime.now()
                query = query.filter(
                    Checkout.expected_return_date < now
                )

            # Search by tool number, serial number, or user name
            if search:
                query = query.join(Tool, Checkout.tool_id == Tool.id).join(
                    User, Checkout.user_id == User.id
                ).filter(
                    db.or_(
                        Tool.tool_number.ilike(f"%{search}%"),
                        Tool.serial_number.ilike(f"%{search}%"),
                        Tool.description.ilike(f"%{search}%"),
                        User.name.ilike(f"%{search}%"),
                        User.employee_number.ilike(f"%{search}%"),
                    )
                )

            # Filter by department
            if department:
                if not search:
                    query = query.join(User, Checkout.user_id == User.id)
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
    @login_required
    def get_my_checkouts():
        """Get current user's checkouts"""
        try:
            user_id = request.current_user.get("user_id")
            include_returned = request.args.get("include_returned", "false").lower() == "true"
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)

            query = Checkout.query.filter(Checkout.user_id == user_id)

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
    @login_required
    def get_overdue_tool_checkouts():
        """Get all overdue checkouts"""
        try:
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)

            now = datetime.now()
            query = Checkout.query.filter(
                Checkout.return_date.is_(None),
                Checkout.expected_return_date < now
            ).order_by(Checkout.expected_return_date.asc())  # Most overdue first

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
    # Get Checkout Details
    # ============================================
    @app.route("/api/tool-checkouts/<int:checkout_id>", methods=["GET"])
    @login_required
    def get_checkout_details(checkout_id):
        """Get detailed information about a specific checkout"""
        try:
            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
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
    @login_required
    def get_tool_checkout_history(tool_id):
        """Get complete checkout history for a tool"""
        try:
            tool = db.session.get(Tool, tool_id)
            if not tool:
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
    @login_required
    def get_tool_timeline(tool_id):
        """
        Get comprehensive timeline for a tool including all events:
        checkouts, returns, calibrations, maintenance, damage reports, etc.
        """
        try:
            tool = db.session.get(Tool, tool_id)
            if not tool:
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
    @login_required
    def get_checkout_stats():
        """Get checkout statistics for dashboard"""
        try:
            now = datetime.now()
            thirty_days_ago = now - timedelta(days=30)
            seven_days_ago = now - timedelta(days=7)

            # Active checkouts count
            active_checkouts = Checkout.query.filter(
                Checkout.return_date.is_(None)
            ).count()

            # Overdue checkouts count
            overdue_checkouts = Checkout.query.filter(
                Checkout.return_date.is_(None),
                Checkout.expected_return_date < now
            ).count()

            # Checkouts today
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            checkouts_today = Checkout.query.filter(
                Checkout.checkout_date >= today_start
            ).count()

            # Returns today
            returns_today = Checkout.query.filter(
                Checkout.return_date >= today_start
            ).count()

            # Checkouts this week
            checkouts_this_week = Checkout.query.filter(
                Checkout.checkout_date >= seven_days_ago
            ).count()

            # Checkouts this month
            checkouts_this_month = Checkout.query.filter(
                Checkout.checkout_date >= thirty_days_ago
            ).count()

            # Damage reports this month
            damage_reports = Checkout.query.filter(
                Checkout.damage_reported == True,
                Checkout.damage_reported_date >= thirty_days_ago
            ).count()

            # Most frequently checked out tools
            from sqlalchemy import func
            popular_tools = db.session.query(
                Tool.id,
                Tool.tool_number,
                Tool.description,
                func.count(Checkout.id).label("checkout_count")
            ).join(
                Checkout, Tool.id == Checkout.tool_id
            ).filter(
                Checkout.checkout_date >= thirty_days_ago
            ).group_by(
                Tool.id
            ).order_by(
                func.count(Checkout.id).desc()
            ).limit(10).all()

            # Most active users
            active_users = db.session.query(
                User.id,
                User.name,
                User.department,
                func.count(Checkout.id).label("checkout_count")
            ).join(
                Checkout, User.id == Checkout.user_id
            ).filter(
                Checkout.checkout_date >= thirty_days_ago
            ).group_by(
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
    @login_required
    def search_tools_for_checkout():
        """Search for tools available for checkout"""
        try:
            q = request.args.get("q", "")
            if len(q) < 2:
                return jsonify({"tools": []}), 200

            # Search tools
            tools = Tool.query.filter(
                db.or_(
                    Tool.tool_number.ilike(f"%{q}%"),
                    Tool.serial_number.ilike(f"%{q}%"),
                    Tool.description.ilike(f"%{q}%"),
                )
            ).limit(20).all()

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
                })

            return jsonify({"tools": results}), 200

        except Exception as e:
            logger.exception("Error searching tools")
            return jsonify({"error": str(e)}), 500

    # ============================================
    # Report Damage on Active Checkout
    # ============================================
    @app.route("/api/tool-checkouts/<int:checkout_id>/report-damage", methods=["POST"])
    @login_required
    def report_checkout_damage(checkout_id):
        """Report damage on an active checkout without returning the tool"""
        try:
            data = request.get_json() or {}
            user_payload = request.current_user
            current_user_id = user_payload.get("user_id")

            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
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
            audit_log = AuditLog(
                action_type="damage_reported",
                action_details=f"Damage reported on tool {tool.tool_number} during checkout {checkout_id}: {damage_description}"
            )
            db.session.add(audit_log)

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
    @login_required
    def extend_checkout(checkout_id):
        """Extend the expected return date for a checkout"""
        try:
            data = request.get_json() or {}
            user_payload = request.current_user

            checkout = db.session.get(Checkout, checkout_id)
            if not checkout:
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

    logger.info("Tool checkout routes registered")
