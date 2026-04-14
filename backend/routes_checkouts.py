"""Tool checkout routes.

List / create checkouts, return a checked-out tool, and user-centric
views of overdue / active checkouts. Extracted from routes.py.
"""

import logging
from datetime import datetime, timedelta

from flask import jsonify, request

from auth import department_required, jwt_required
from models import AuditLog, Checkout, Tool, User, UserActivity, db, get_current_time
from utils.error_handler import log_security_event


logger = logging.getLogger(__name__)

# Decorator aliases matching other route modules
login_required = jwt_required
tool_manager_required = department_required("Materials")


def register_checkout_routes(app):
    @app.route("/api/checkouts", methods=["GET", "POST"])
    @jwt_required
    def checkouts_route():
        try:
            current_user_id = request.current_user.get("user_id") if hasattr(request, "current_user") else None
            if request.method == "GET":
                checkouts = Checkout.query.all()
                return jsonify([{
                    "id": c.id,
                    "tool_id": c.tool_id,
                    "tool_number": c.tool.tool_number if c.tool else "Unknown",
                    "serial_number": c.tool.serial_number if c.tool else "Unknown",
                    "description": c.tool.description if c.tool else "",
                    "user_id": c.user_id,
                    "user_name": c.user.name if c.user else "Unknown",
                    "checkout_date": c.checkout_date.isoformat(),
                    "return_date": c.return_date.isoformat() if c.return_date else None,
                    "expected_return_date": c.expected_return_date.isoformat() if c.expected_return_date else None,
                    "status": "Returned" if c.return_date else "Checked Out"
                } for c in checkouts])

            # POST - Create new checkout
            data = request.get_json() or {}
            logger.debug("Checkout request received", extra={"tool_id": data.get("tool_id")})

            # Validate required fields
            required_fields = ["tool_id"]
            for field in required_fields:
                if field not in data or data.get(field) is None:
                    return jsonify({"error": f"Missing required field: {field}"}), 400

            # Validate tool exists
            try:
                tool_id = int(data.get("tool_id"))
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid tool ID format"}), 400

            tool = db.session.get(Tool, tool_id)
            if not tool:
                return jsonify({"error": f"Tool with ID {tool_id} does not exist"}), 404

            # Get user ID - either from request data or from session
            user_id = data.get("user_id")

            # Convert user_id to integer if it's a string
            if user_id is not None:
                try:
                    user_id = int(user_id)
                except (ValueError, TypeError):
                    user_id = None

            if not user_id:
                # If user_id not provided in request, use the logged-in user's ID from JWT
                from auth.jwt_manager import JWTManager
                user_payload = JWTManager.get_current_user()
                if not user_payload:
                    return jsonify({"error": "Authentication required"}), 401
                user_id = user_payload["user_id"]

            # Validate user exists
            user = db.session.get(User, user_id)
            if not user:
                return jsonify({"error": f"User with ID {user_id} does not exist"}), 404

            logger.debug("Checkout user validated", extra={"user_id": user.id})

            # Check if tool is already checked out
            active_checkout = Checkout.query.filter_by(tool_id=tool_id, return_date=None).first()
            if active_checkout:
                return jsonify({"error": f"Tool {tool.tool_number} is already checked out"}), 400

            # Create checkout
            expected_return_date = data.get("expected_return_date")
            logger.debug("Creating checkout", extra={"tool_id": tool_id, "user_id": user_id})

            # Parse expected_return_date if it's a string
            parsed_date = None
            if expected_return_date:
                try:
                    if isinstance(expected_return_date, str):
                        # Handle different date formats
                        if "Z" in expected_return_date:
                            parsed_date = datetime.fromisoformat(expected_return_date.replace("Z", "+00:00"))
                        elif "T" in expected_return_date:
                            parsed_date = datetime.fromisoformat(expected_return_date)
                        else:
                            # Simple date format (YYYY-MM-DD)
                            parsed_date = datetime.strptime(expected_return_date, "%Y-%m-%d")
                    else:
                        parsed_date = expected_return_date
                except Exception:
                    # Use a default date (7 days from now) if parsing fails
                    parsed_date = datetime.now() + timedelta(days=7)
            else:
                # Default to 7 days from now if no date provided
                parsed_date = datetime.now() + timedelta(days=7)

            # Create and save the checkout
            try:
                c = Checkout(
                    tool_id=tool_id,
                    user_id=user_id,
                    expected_return_date=parsed_date
                )
                db.session.add(c)
                db.session.commit()
                logger.debug("Checkout created", extra={"checkout_id": c.id})

                # Record transaction
                from utils.transaction_helper import record_tool_checkout
                try:
                    record_tool_checkout(
                        tool_id=tool_id,
                        user_id=user_id,
                        expected_return_date=parsed_date,
                        notes=f"Checked out to {user.name}"
                    )
                except Exception as e:
                    logger.error(f"Error recording checkout transaction: {e!s}")

                # Log the action
                AuditLog.log(
                    user_id=current_user_id,
                    action="checkout_tool",
                    resource_type="tool",
                    resource_id=tool_id,
                    details={
                        "tool_number": tool.tool_number,
                        "checkout_user_id": user_id,
                        "checkout_user_name": user.name
                    },
                    ip_address=request.remote_addr
                )

                # Add user activity (use user_id from checkout, not session)
                activity = UserActivity(
                    user_id=user_id,
                    activity_type="tool_checkout",
                    description=f"Checked out tool {tool.tool_number}",
                    ip_address=request.remote_addr
                )
                db.session.add(activity)

                db.session.commit()

                return jsonify({
                    "id": c.id,
                    "message": f"Tool {tool.tool_number} checked out successfully"
                }), 201
            except Exception:
                db.session.rollback()
                logger.exception("Database error during checkout")
                return jsonify({"error": "Database error during checkout"}), 500

        except Exception:
            logger.exception("Unexpected error in checkouts route")
            return jsonify({"error": "An unexpected error occurred while processing the checkout request"}), 500

    @app.route("/api/checkouts/<int:id>/return", methods=["POST", "PUT"])
    @login_required
    def return_route(id):
        try:
            current_user_id = request.current_user.get("user_id")
            logger.debug("Return request received", extra={"checkout_id": id, "method": request.method})

            # Check if user is authorized through admin flag, department, or explicit permission
            user_payload = request.current_user
            permissions = set(user_payload.get("permissions", []))
            is_admin = user_payload.get("is_admin", False)
            is_materials = user_payload.get("department") == "Materials"
            has_return_permission = "tool.return" in permissions

            if not (is_admin or is_materials or has_return_permission):
                log_security_event(
                    "insufficient_permissions",
                    f"Tool return access denied for user {user_payload.get('user_id')}"
                )
                return jsonify({"error": "You do not have permission to return tools"}), 403

            # Validate checkout exists
            c = db.session.get(Checkout, id)
            if not c:
                return jsonify({"error": f"Checkout with ID {id} not found"}), 404
            logger.debug("Checkout record found", extra={"checkout_id": c.id, "tool_id": c.tool_id, "user_id": c.user_id})

            # Check if already returned
            if c.return_date:
                return jsonify({"error": "This tool has already been returned"}), 400

            # Get tool and user info for better logging
            tool = db.session.get(Tool, c.tool_id)
            user = db.session.get(User, c.user_id)

            if not tool:
                return jsonify({"error": f"Tool with ID {c.tool_id} not found"}), 404

            if not user:
                logger.warning("Return processing user not found", extra={"checkout_id": c.id, "missing_user_id": c.user_id})

            logger.debug("Processing return", extra={"tool_id": tool.id if tool else None, "user_id": user.id if user else None})

            # Get data from request if provided
            data = request.get_json() or {}
            condition = data.get("condition")
            returned_by = data.get("returned_by")
            found = data.get("found", False)
            notes = data.get("notes", "")
            logger.debug("Return details parsed", extra={"checkout_id": id, "has_condition": bool(condition), "found_flag": bool(found)})

            try:
                # Mark as returned
                c.return_date = get_current_time()

                # Update tool condition if provided
                if condition and tool:
                    old_condition = tool.condition
                    tool.condition = condition

                # Update tool status to available
                if tool:
                    old_status = tool.status
                    tool.status = "available"

                # Persist return details on the real Checkout columns.
                # Historical versions of this handler assigned to
                # `return_condition` / `returned_by` / `found`, none of
                # which are mapped columns on the Checkout model, so the
                # data was silently dropped. Use the actual column names
                # and record the non-mapped `found` flag in return_notes
                # so it isn't lost either.
                if condition:
                    c.condition_at_return = condition
                if isinstance(returned_by, int):
                    c.checked_in_by_id = returned_by
                note_parts = []
                if notes:
                    note_parts.append(notes)
                if found:
                    note_parts.append("[found]")
                if note_parts:
                    c.return_notes = " ".join(note_parts)

                db.session.commit()

                # Record transaction
                from utils.transaction_helper import record_tool_return
                try:
                    record_tool_return(
                        tool_id=c.tool_id,
                        user_id=user_payload["user_id"],
                        condition=condition,
                        notes=notes
                    )
                except Exception as e:
                    logger.error(f"Error recording return transaction: {e!s}")

                # Prepare action details for logging
                action_details = f'User {user.name if user else "Unknown"} (ID: {c.user_id}) returned tool {tool.tool_number if tool else "Unknown"} (ID: {c.tool_id})'

                # Add additional return details to the log
                if returned_by:
                    action_details += f", returned by: {returned_by}"
                if found:
                    action_details += ", tool was found on production floor"
                if notes:
                    action_details += f", notes: {notes}"

                # Log the action
                AuditLog.log(
                    user_id=current_user_id,
                    action="return_tool",
                    resource_type="tool",
                    resource_id=c.tool_id,
                    details={
                        "tool_number": tool.tool_number,
                        "condition": condition,
                        "checkout_id": c.id if c else None
                    },
                    ip_address=request.remote_addr
                )

                # Add user activity (use user_id from JWT token)
                activity = UserActivity(
                    user_id=user_payload["user_id"],
                    activity_type="tool_return",
                    description=f'Returned tool {tool.tool_number if tool else "Unknown"}',
                    ip_address=request.remote_addr
                )
                db.session.add(activity)

                db.session.commit()

                # Return a more detailed response
                return jsonify({
                    "id": c.id,
                    "tool_id": c.tool_id,
                    "tool_number": tool.tool_number if tool else "Unknown",
                    "serial_number": tool.serial_number if tool else "Unknown",
                    "description": tool.description if tool else "",
                    "condition": tool.condition if tool else "",
                    "user_id": c.user_id,
                    "user_name": user.name if user else "Unknown",
                    "checkout_date": c.checkout_date.isoformat(),
                    "return_date": c.return_date.isoformat() if c.return_date else None,
                    "expected_return_date": c.expected_return_date.isoformat() if c.expected_return_date else None,
                    "returned_by": returned_by,
                    "found": found,
                    "return_notes": notes,
                    "status": "Returned",
                    "message": f'Tool {tool.tool_number if tool else "Unknown"} returned successfully'
                }), 200
            except Exception as e:
                db.session.rollback()
                logger.error("Database error during tool return", exc_info=True, extra={
                    "operation": "tool_return",
                    "tool_id": c.tool_id,
                    "user_id": user_payload.get("user_id"),
                    "error_type": type(e).__name__,
                    "error_message": str(e)
                })
                return jsonify({"error": "Database error during tool return"}), 500

        except Exception as e:
            checkout_record = locals().get("c")
            logger.error("Unexpected error in return route", exc_info=True, extra={
                "operation": "tool_return",
                "tool_id": checkout_record.tool_id if checkout_record else None,
                "user_id": user_payload.get("user_id") if "user_payload" in locals() else None,
                "error_type": type(e).__name__
            })
            return jsonify({"error": "An unexpected error occurred while processing the return"}), 500

    @app.route("/api/checkouts/user", methods=["GET"])
    @login_required
    def get_user_checkouts():
        # Get the current user's checkouts from JWT token
        user_id = request.current_user["user_id"]

        # Get all checkouts for the user (both active and past)
        checkouts = Checkout.query.filter_by(user_id=user_id).all()

        return jsonify([{
            "id": c.id,
            "tool_id": c.tool_id,
            "tool_number": c.tool.tool_number if c.tool else "Unknown",
            "serial_number": c.tool.serial_number if c.tool else "Unknown",
            "description": c.tool.description if c.tool else "",
            "status": "Checked Out" if not c.return_date else "Returned",
            "checkout_date": c.checkout_date.isoformat(),
            "return_date": c.return_date.isoformat() if c.return_date else None,
            "expected_return_date": c.expected_return_date.isoformat() if c.expected_return_date else None
        } for c in checkouts]), 200

    @app.route("/api/checkouts/overdue", methods=["GET"])
    @tool_manager_required
    def get_overdue_checkouts():
        # Get all overdue checkouts (expected_return_date < current date and not returned).
        # Use the project's timezone-aware "now" helper to stay consistent
        # with timezone-aware DB values and avoid false positives/negatives.
        now = get_current_time()
        overdue_checkouts = Checkout.query.filter(
            Checkout.return_date.is_(None),
            Checkout.expected_return_date < now
        ).all()

        result = []
        for c in overdue_checkouts:
            # Calculate days overdue
            expected_date = c.expected_return_date
            days_overdue = (now - expected_date).days if expected_date else 0

            result.append({
                "id": c.id,
                "tool_id": c.tool_id,
                "tool_number": c.tool.tool_number if c.tool else "Unknown",
                "serial_number": c.tool.serial_number if c.tool else "Unknown",
                "description": c.tool.description if c.tool else "",
                "user_id": c.user_id,
                "user_name": c.user.name if c.user else "Unknown",
                "checkout_date": c.checkout_date.isoformat(),
                "expected_return_date": c.expected_return_date.isoformat() if c.expected_return_date else None,
                "days_overdue": days_overdue
            })

        return jsonify(result), 200
