import logging
import time
from datetime import UTC, datetime, timedelta

from flask import current_app, jsonify, request, session

import utils as password_utils
from auth import admin_required, department_required, jwt_required
from models import (
    AuditLog,
    Checkout,
    Chemical,
    Tool,
    User,
    UserActivity,
    db,
)
from routes_admin import register_admin_routes
from routes_announcements import register_announcement_routes
from routes_attachments import register_attachments_routes
from routes_auth import register_auth_routes
from routes_barcode import barcode_bp
from routes_bulk_import import register_bulk_import_routes
from routes_calibration import register_calibration_routes
from routes_channels import register_channels_routes
from routes_chemical_analytics import register_chemical_analytics_routes
from routes_chemicals import register_chemical_routes
from routes_database import register_database_routes
from routes_departments import register_department_routes
from routes_expendables import expendables_bp
from routes_history import register_history_routes
from routes_inventory import register_inventory_routes
from routes_kit_messages import register_kit_message_routes
from routes_kit_reorders import register_kit_reorder_routes
from routes_kit_transfers import register_kit_transfer_routes
from routes_kits import register_kit_routes
from routes_message_search import register_message_search_routes
from routes_orders import register_order_routes
from routes_password_reset import register_password_reset_routes
from routes_permissions import register_permission_routes
from routes_profile import register_profile_routes
from routes_totp import register_totp_routes
from routes_rbac import register_rbac_routes
from routes_reports import register_report_routes
from routes_scanner import register_scanner_routes
from routes_ai import register_ai_routes
from routes_analytics import register_analytics_routes
from routes_audit import register_audit_routes
from routes_checkouts import register_checkout_routes
from routes_security import register_security_routes
from routes_tool_checkout import register_tool_checkout_routes
from routes_tools import register_tool_routes
from routes_transfers import transfers_bp
from routes_user_requests import register_user_request_routes
from routes_users import register_user_routes
from routes_warehouses import warehouses_bp
from utils.error_handler import handle_errors
from utils.password_reset_security import get_password_reset_tracker
from utils.rate_limiter import rate_limit


logger = logging.getLogger(__name__)

# Aliases matching the pattern used by other route modules:
# both "tool manager" and "materials manager" are Materials-department access
# (admins bypass the check inside department_required).
login_required = jwt_required
tool_manager_required = department_required("Materials")
materials_manager_required = department_required("Materials")


def register_routes(app):
    # db.init_app(app) is now called in app.py, not here
    with app.app_context():
        db.create_all()

        # Create admin user if none exists - using secure initialization
        # Skip in testing mode (admin user is created by test fixtures)
        is_testing = app.config.get("TESTING", False)
        if not is_testing:
            from utils.admin_init import create_secure_admin
            success, message, password = create_secure_admin()
            if success and password:
                current_app.logger.warning("SECURITY NOTICE: %s", message)
                # Emit a *single* structured log entry flagged as secret; do not expose raw password.
                current_app.logger.warning(
                    "INITIAL ADMIN PASSWORD GENERATED – copy from env-var not from logs"
                )
            elif not success:
                logger.error("Admin user creation failed", extra={
                    "operation": "admin_initialization",
                    "error_message": message
                })

    # Register report routes
    register_report_routes(app)

    # Register chemical routes
    register_chemical_routes(app)

    # Register chemical analytics routes
    register_chemical_analytics_routes(app)

    # Register calibration routes
    register_calibration_routes(app)

    # Register RBAC routes
    register_rbac_routes(app)

    # Register permission management routes
    register_permission_routes(app)

    # Register department routes
    register_department_routes(app)

    # Register announcement routes
    register_announcement_routes(app)

    # Register admin routes
    register_admin_routes(app)

    # Register scanner routes
    register_scanner_routes(app)

    # Register bulk import routes
    register_bulk_import_routes(app)

    # Register JWT authentication routes
    register_auth_routes(app)

    # Register TOTP two-factor authentication routes
    register_totp_routes(app)

    # Register password reset routes
    register_password_reset_routes(app)

    # Register security configuration routes
    register_security_routes(app)
    register_ai_routes(app)

    # Register audit log routes
    register_audit_routes(app)

    # Register usage analytics routes
    register_analytics_routes(app)

    # Register tool CRUD / service / search routes
    register_tool_routes(app)

    # Register legacy tool checkout routes
    register_checkout_routes(app)

    # Register kit/mobile warehouse routes
    register_kit_routes(app)
    register_kit_transfer_routes(app)
    register_kit_reorder_routes(app)
    register_kit_message_routes(app)
    register_order_routes(app)
    register_user_request_routes(app)

    # Register enhanced messaging routes (channels, real-time chat)
    register_channels_routes(app)
    register_attachments_routes(app)
    register_message_search_routes(app)

    # Register inventory tracking routes (lot/serial numbers, transactions)
    register_inventory_routes(app)

    # Register item history lookup routes
    register_history_routes(app)

    # Register tool checkout system routes
    register_tool_checkout_routes(app)

    # Register warehouse management routes
    app.register_blueprint(warehouses_bp, url_prefix="/api")

    # Register warehouse transfer routes
    app.register_blueprint(transfers_bp, url_prefix="/api")

    # Register expendables routes (kit-only consumables)
    app.register_blueprint(expendables_bp, url_prefix="/api")

    # Register barcode label generation routes
    app.register_blueprint(barcode_bp)

    # Register database management routes
    register_database_routes(app)

    # Add direct routes for chemicals management
    @app.route("/api/chemicals/reorder-needed", methods=["GET"])
    @materials_manager_required
    def chemicals_reorder_needed_direct_route():
        try:
            logger.debug("Chemicals reorder-needed requested", extra={
                "user_id": request.current_user.get("user_id") if hasattr(request, "current_user") else session.get("user_id"),
                "department": request.current_user.get("department") if hasattr(request, "current_user") else session.get("department")
            })
            # Get chemicals that need to be reordered
            chemicals = Chemical.query.filter_by(needs_reorder=True, reorder_status="needed").all()

            # Convert to list of dictionaries
            result = [c.to_dict() for c in chemicals]

            return jsonify(result)
        except Exception:
            logger.exception("Error in chemicals reorder needed route")
            return jsonify({"error": "An error occurred while fetching chemicals that need reordering"}), 500

    @app.route("/api/chemicals/on-order", methods=["GET"])
    @materials_manager_required
    @handle_errors
    def chemicals_on_order_direct_route():
        logger.info(f"Chemicals on order requested by user {request.current_user.get('user_id')}")

        # Get chemicals that are on order
        chemicals = Chemical.query.filter_by(reorder_status="ordered").all()

        # Convert to list of dictionaries
        result = [c.to_dict() for c in chemicals]

        return jsonify(result)

    @app.route("/api/chemicals/expiring-soon", methods=["GET"])
    @materials_manager_required
    def chemicals_expiring_soon_direct_route():
        try:
            logger.debug("Chemicals expiring-soon requested", extra={
                "user_id": request.current_user.get("user_id"),
                "department": request.current_user.get("department")
            })
            # Get days parameter (default to 30)
            days = request.args.get("days", 30, type=int)

            # Get all non-archived chemicals
            chemicals = Chemical.query.filter_by(is_archived=False).all()

            # Filter to only those expiring soon
            expiring_soon = [c for c in chemicals if c.is_expiring_soon(days)]

            # Convert to list of dictionaries
            result = [c.to_dict() for c in expiring_soon]

            return jsonify(result)
        except Exception:
            logger.exception("Error in chemicals expiring soon route")
            return jsonify({"error": "An error occurred while fetching chemicals expiring soon"}), 500

    @app.route("/api/chemicals/archived", methods=["GET"])
    @materials_manager_required
    def archived_chemicals_direct_route():
        try:
            # Get query parameters for filtering
            category = request.args.get("category")
            reason = request.args.get("reason")
            search = request.args.get("q")

            # Start with base query for archived chemicals.
            # NB: `Chemical.is_archived is True` is a Python identity check,
            # not a SQLAlchemy comparison — it always evaluates to False
            # before any SQL is emitted, so the previous version silently
            # returned an empty list. Use `.is_(True)` to get the correct
            # column comparison.
            try:
                query = Chemical.query.filter(Chemical.is_archived.is_(True))
            except Exception:
                # If the column doesn't exist, return an empty list
                return jsonify([])

            # Apply filters if provided
            if category:
                query = query.filter(Chemical.category == category)
            if reason:
                query = query.filter(Chemical.archived_reason.ilike(f"%{reason}%"))
            if search:
                query = query.filter(
                    db.or_(
                        Chemical.part_number.ilike(f"%{search}%"),
                        Chemical.lot_number.ilike(f"%{search}%"),
                        Chemical.description.ilike(f"%{search}%"),
                        Chemical.manufacturer.ilike(f"%{search}%")
                    )
                )

            # Execute query and convert to list of dictionaries
            chemicals = query.order_by(Chemical.archived_date.desc()).all()
            result = [c.to_dict() for c in chemicals]

            return jsonify(result)
        except Exception:
            logger.exception("Error in archived chemicals route")
            return jsonify({"error": "An error occurred while fetching archived chemicals"}), 500

    # Health check endpoint for Docker
    @app.route("/api/health", methods=["GET"])
    @app.route("/health", methods=["GET"])
    def health_check():
        # Use standard datetime
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "timezone": str(time.tzname)
        })

    # Database initialization endpoint
    @app.route("/api/admin/init-database", methods=["POST"])
    def init_database():
        """Initialize the database with tables and default data"""
        try:
            # Check if database is already initialized
            try:
                user_count = User.query.count()
                if user_count > 0:
                    return jsonify({
                        "success": False,
                        "message": "Database already initialized",
                        "user_count": user_count
                    }), 400
            except Exception:
                # Tables don't exist, proceed with initialization
                pass

            # Create all tables
            db.create_all()
            logger.info("Database tables created")

            # Run the initialization script
            # Note: init_db.py file does not exist - initialization is handled by migrations
            # from init_db import init_db  # type: ignore[import-not-found]
            # init_db()

            return jsonify({
                "success": True,
                "message": "Database initialized successfully"
            })

        except Exception as e:
            logger.error(f"Database initialization failed: {e!s}")
            return jsonify({
                "success": False,
                "message": f"Database initialization failed: {e!s}"
            }), 500

    # Time API endpoint
    @app.route("/api/time", methods=["GET"])
    def time_api_endpoint():
        """
        Time API endpoint that returns current time information.

        Returns:
            JSON response containing:
            - status: 'ok' if successful
            - utc_time: Current UTC time in ISO 8601 format
            - local_time: Current local time in ISO 8601 format
            - timezone: System timezone information
            - using_time_utils: Boolean indicating if time utilities are being used
        """
        logger.debug("Time API endpoint called")
        try:
            from time_utils import format_datetime, get_local_timestamp, get_utc_timestamp
            result = {
                "status": "ok",
                "utc_time": format_datetime(get_utc_timestamp()),
                "local_time": format_datetime(get_local_timestamp()),
                "timezone": str(time.tzname),
                "using_time_utils": True
            }
            logger.debug("Time API endpoint executed successfully")
            return jsonify(result)
        except ImportError:
            logger.exception("time_utils import failed in time_api_endpoint")
            result = {
                "status": "ok",
                "utc_time": datetime.now(UTC).isoformat(),
                "local_time": datetime.now().isoformat(),
                "timezone": str(time.tzname),
                "using_time_utils": False
            }
            logger.debug("Time API endpoint fallback executed")
            return jsonify(result)

    # Time test endpoint
    @app.route("/api/time-test", methods=["GET"])
    def time_test_endpoint():
        """
        Time test endpoint for debugging time functionality.
        """
        logger.debug("Time test endpoint called")
        try:
            from time_utils import format_datetime, get_local_timestamp, get_utc_timestamp
            result = {
                "status": "ok",
                "message": "Time test endpoint working",
                "utc_time": format_datetime(get_utc_timestamp()),
                "local_time": format_datetime(get_local_timestamp()),
                "timezone": str(time.tzname),
                "using_time_utils": True,
                "timestamp": datetime.now().isoformat()
            }
            logger.debug("Time test endpoint executed successfully")
            return jsonify(result)
        except ImportError:
            logger.exception("time_utils import failed in time_test_endpoint")
            result = {
                "status": "ok",
                "message": "Time test endpoint working (fallback)",
                "utc_time": datetime.now(UTC).isoformat(),
                "local_time": datetime.now().isoformat(),
                "timezone": str(time.tzname),
                "using_time_utils": False,
                "timestamp": datetime.now().isoformat()
            }
            logger.debug("Time test endpoint fallback executed")
            return jsonify(result)

    # Test endpoint for admin dashboard
    @app.route("/api/admin/dashboard/test", methods=["GET"])
    def admin_dashboard_test():
        logger.debug("Admin dashboard test endpoint called")
        return jsonify({
            "status": "success",
            "message": "Admin dashboard test endpoint works",
            "timestamp": datetime.now().isoformat()
        })

    # Admin dashboard endpoints
    @app.route("/api/admin/registration-requests", methods=["GET"])
    @admin_required
    def get_registration_requests():
        from models import RegistrationRequest

        # Get status filter (default to 'pending')
        status = request.args.get("status", "pending")

        if status == "all":
            requests = RegistrationRequest.query.order_by(RegistrationRequest.created_at.desc()).all()
        else:
            requests = RegistrationRequest.query.filter_by(status=status).order_by(RegistrationRequest.created_at.desc()).all()

        return jsonify([req.to_dict() for req in requests]), 200

    @app.route("/api/admin/registration-requests/<int:id>/approve", methods=["POST"])
    @admin_required
    def approve_registration_request(id):
        current_user_id = request.current_user.get("user_id")
        from models import RegistrationRequest

        # Get the registration request
        reg_request = RegistrationRequest.query.get_or_404(id)

        # Check if it's already processed
        if reg_request.status != "pending":
            return jsonify({"error": f"Registration request is already {reg_request.status}"}), 400

        # Create a new user from the registration request
        user = User(
            name=reg_request.name,
            employee_number=reg_request.employee_number,
            department=reg_request.department,
            password_hash=reg_request.password_hash,  # Copy the hashed password
            is_admin=False,
            is_active=True
        )

        # Update the registration request status
        reg_request.status = "approved"
        reg_request.processed_at = datetime.utcnow()
        reg_request.processed_by = request.current_user["user_id"]
        reg_request.admin_notes = request.json.get("notes", "")

        # Save changes
        db.session.add(user)
        db.session.commit()

        # Log the approval
        AuditLog.log(
            user_id=current_user_id,
            action="approve_registration",
            resource_type="registration_request",
            resource_id=reg_request.id,
            details={
                "name": reg_request.name,
                "employee_number": reg_request.employee_number
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        return jsonify({
            "message": "Registration request approved",
            "user_id": user.id,
            "request_id": reg_request.id
        }), 200

    @app.route("/api/admin/registration-requests/<int:id>/deny", methods=["POST"])
    @admin_required
    def deny_registration_request(id):
        current_user_id = request.current_user.get("user_id")
        from models import RegistrationRequest

        # Get the registration request
        reg_request = RegistrationRequest.query.get_or_404(id)

        # Check if it's already processed
        if reg_request.status != "pending":
            return jsonify({"error": f"Registration request is already {reg_request.status}"}), 400

        # Update the registration request status
        reg_request.status = "denied"
        reg_request.processed_at = datetime.utcnow()
        reg_request.processed_by = request.current_user["user_id"]
        reg_request.admin_notes = request.json.get("notes", "")

        # Save changes
        db.session.commit()

        # Log the denial
        AuditLog.log(
            user_id=current_user_id,
            action="deny_registration",
            resource_type="registration_request",
            resource_id=reg_request.id,
            details={
                "name": reg_request.name,
                "employee_number": reg_request.employee_number
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        return jsonify({
            "message": "Registration request denied",
            "request_id": reg_request.id
        }), 200

    @app.route("/api/admin/dashboard/stats", methods=["GET"])
    @admin_required
    def get_admin_dashboard_stats():
        logger.debug("Admin dashboard stats requested", extra={"user_id": request.current_user.get("user_id")})

        # Get counts from various tables
        user_count = User.query.count()
        active_user_count = User.query.filter_by(is_active=True).count()
        tool_count = Tool.query.count()
        available_tool_count = Tool.query.filter_by(status="available").count()
        checkout_count = Checkout.query.count()
        active_checkout_count = Checkout.query.filter(Checkout.return_date.is_(None)).count()

        # Get pending registration requests count
        from models import RegistrationRequest
        pending_requests_count = RegistrationRequest.query.filter_by(status="pending").count()

        # Get recent activity
        recent_logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(10).all()

        # Get system activity over time (last 30 days)
        from sqlalchemy import func

        start_date = datetime.now() - timedelta(days=30)

        # Get activity counts by day
        daily_activity = db.session.query(
            func.date(AuditLog.timestamp).label("date"),
            func.count().label("count")
        ).filter(
            AuditLog.timestamp >= start_date
        ).group_by(
            func.date(AuditLog.timestamp)
        ).all()

        # Format the results
        activity_data = [{
            "date": str(day.date),
            "count": day.count
        } for day in daily_activity]

        # Get department distribution
        dept_distribution = db.session.query(
            User.department.label("department"),
            func.count(User.id).label("count")
        ).group_by(
            User.department
        ).all()

        dept_data = [{
            "department": dept.department or "Unknown",
            "count": dept.count
        } for dept in dept_distribution]

        return jsonify({
            "counts": {
                "users": user_count,
                "activeUsers": active_user_count,
                "tools": tool_count,
                "availableTools": available_tool_count,
                "checkouts": checkout_count,
                "activeCheckouts": active_checkout_count,
                "pendingRegistrations": pending_requests_count
            },
            "recentActivity": [{
                "id": log.id,
                "action_type": log.action_type,
                "action_details": log.action_details,
                "timestamp": log.timestamp.isoformat()
            } for log in recent_logs],
            "activityOverTime": activity_data,
            "departmentDistribution": dept_data
        }), 200

    # Serve static files
    @app.route("/api/static/<path:filename>")
    def serve_static(filename):
        return current_app.send_static_file(filename)

    @app.route("/api/calibrations/notifications", methods=["GET"])
    def get_calibration_notifications():
        """Get calibration notifications for tools due for calibration."""
        try:
            now = datetime.now()

            # Get tools that require calibration
            tools_requiring_calibration = Tool.query.filter_by(requires_calibration=True).all()

            notifications = []

            for tool in tools_requiring_calibration:
                # Check calibration status
                if tool.calibration_status == "overdue":
                    notifications.append({
                        "id": tool.id,
                        "tool_number": tool.tool_number,
                        "description": tool.description,
                        "type": "overdue",
                        "message": f"Tool {tool.tool_number} calibration is overdue",
                        "priority": "high",
                        "last_calibration_date": tool.last_calibration_date.isoformat() if tool.last_calibration_date else None,
                        "next_calibration_date": tool.next_calibration_date.isoformat() if tool.next_calibration_date else None
                    })
                elif tool.calibration_status == "due_soon":
                    # Check if due within 30 days
                    if tool.next_calibration_date and tool.next_calibration_date <= now + timedelta(days=30):
                        days_until_due = (tool.next_calibration_date - now).days
                        notifications.append({
                            "id": tool.id,
                            "tool_number": tool.tool_number,
                            "description": tool.description,
                            "type": "due_soon",
                            "message": f"Tool {tool.tool_number} calibration due in {days_until_due} days",
                            "priority": "medium",
                            "days_until_due": days_until_due,
                            "last_calibration_date": tool.last_calibration_date.isoformat() if tool.last_calibration_date else None,
                            "next_calibration_date": tool.next_calibration_date.isoformat() if tool.next_calibration_date else None
                        })

            # Sort by priority (overdue first, then by days until due)
            notifications.sort(key=lambda x: (
                0 if x["type"] == "overdue" else 1,
                x.get("days_until_due", 999)
            ))

            return jsonify({
                "notifications": notifications,
                "count": len(notifications),
                "overdue_count": len([n for n in notifications if n["type"] == "overdue"]),
                "due_soon_count": len([n for n in notifications if n["type"] == "due_soon"])
            }), 200

        except Exception:
            logger.exception("Error getting calibration notifications")
            return jsonify({"error": "Unable to fetch calibration notifications"}), 500

    # Register user routes
    register_user_routes(app)

    # Register profile routes
    register_profile_routes(app)

    # JWT-based login route is now handled by routes_auth.py

    # JWT-based logout route is now handled by routes_auth.py

    # JWT-based auth status route is now handled by routes_auth.py

    @app.route("/api/auth/register", methods=["POST"])
    def register():
        data = request.get_json() or {}

        # Validate required fields
        required_fields = ["name", "employee_number", "department", "password"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Validate password confirmation if provided
        if "confirm_password" in data and data.get("password") != data.get("confirm_password"):
            return jsonify({"error": "Password and confirmation do not match"}), 400

        # Check if employee number already exists in users or registration requests
        if User.query.filter_by(employee_number=data["employee_number"]).first():
            return jsonify({"error": "Employee number already registered"}), 400

        from models import RegistrationRequest
        if RegistrationRequest.query.filter_by(employee_number=data["employee_number"], status="pending").first():
            return jsonify({"error": "A registration request with this employee number is already pending approval"}), 400

        # Validate password strength
        is_valid, errors = password_utils.validate_password_strength(data.get("password"))
        if not is_valid:
            return jsonify({"error": "Password does not meet security requirements", "details": errors}), 400

        # Create new registration request instead of user
        reg_request = RegistrationRequest(
            name=data["name"],
            employee_number=data["employee_number"],
            department=data["department"],
            status="pending"
        )
        reg_request.set_password(data["password"])

        db.session.add(reg_request)
        db.session.commit()

        # Log the registration request
        AuditLog.log(
            user_id=None,  # No user yet, this is a registration
            action="registration_request",
            resource_type="registration_request",
            resource_id=reg_request.id,
            details={
                "name": reg_request.name,
                "employee_number": reg_request.employee_number,
                "department": reg_request.department
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        return jsonify({"message": "Registration request submitted. An administrator will review your request."}), 201

    @app.route("/api/auth/reset-password/request", methods=["POST"])
    @rate_limit(limit=3, window=3600)  # 3 requests per hour per IP
    def request_password_reset():
        data = request.get_json() or {}

        if not data.get("employee_number"):
            return jsonify({"error": "Employee number is required"}), 400

        # Generic response message to prevent user enumeration
        # This message is returned for both existing and non-existing users
        generic_message = "If your employee number is registered, a password reset code has been sent to your registered contact method"

        user = User.query.filter_by(employee_number=data["employee_number"]).first()
        if not user:
            # Don't reveal that the user doesn't exist - return same message
            app.logger.info(
                "Password reset requested for non-existent employee number. "
                f"IP: {request.remote_addr}"
            )
            return jsonify({"message": generic_message}), 200

        # Generate reset token
        user.generate_reset_token()
        db.session.commit()

        # TODO: Implement email/SMS delivery for password reset codes
        # SECURITY: PII REDACTION - Never log reset codes, email addresses, or employee numbers
        # These are sensitive credentials that could be used for account takeover
        app.logger.info(
            f"Password reset requested for user ID {user.id}. "
            "Token expires in 15 minutes. "
            f"IP: {request.remote_addr}"
        )

        # Log the password reset request (without PII)
        activity = UserActivity(
            user_id=user.id,
            activity_type="password_reset_request",
            description="Password reset requested",
            ip_address=request.remote_addr
        )
        db.session.add(activity)
        db.session.commit()

        # Return same generic message to prevent user enumeration
        return jsonify({"message": generic_message}), 200

    @app.route("/api/auth/reset-password/confirm", methods=["POST"])
    @rate_limit(limit=5, window=3600)  # 5 attempts per hour per IP
    def confirm_password_reset():
        data = request.get_json() or {}

        # Validate required fields
        required_fields = ["employee_number", "reset_code", "new_password"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        user = User.query.filter_by(employee_number=data["employee_number"]).first()
        if not user:
            return jsonify({"error": "Invalid employee number"}), 400

        tracker = get_password_reset_tracker()

        # Enforce account-level exponential backoff
        is_locked, retry_after = tracker.is_locked(user.employee_number)
        if is_locked:
            return jsonify({
                "error": "Too many password reset attempts. Please try again later.",
                "retry_after": retry_after
            }), 429

        # Verify reset code
        if not user.check_reset_token(data["reset_code"]):
            remaining_attempts, delay_seconds = tracker.record_failure(user.employee_number)

            # Invalidate the reset token after repeated failures
            if tracker.should_invalidate_token(user.employee_number):
                user.clear_reset_token()
                db.session.commit()
                tracker.reset(user.employee_number)
                return jsonify({
                    "error": "Invalid or expired reset code. Reset token invalidated after multiple failed attempts."
                }), 400

            return jsonify({
                "error": "Invalid or expired reset code",
                "attempts_remaining": remaining_attempts,
                "retry_after": delay_seconds
            }), 400

        # Validate password strength
        is_valid, errors = password_utils.validate_password_strength(data["new_password"])
        if not is_valid:
            return jsonify({"error": "Password does not meet security requirements", "details": errors}), 400

        if hasattr(user, "is_password_reused") and user.is_password_reused(data["new_password"]):
            return jsonify({"error": "New password cannot match any of your last 5 passwords"}), 400

        # Update password
        user.set_password(data["new_password"])
        user.clear_reset_token()
        if hasattr(user, "force_password_change"):
            user.force_password_change = False
        db.session.commit()

        # Successful reset clears any tracking
        tracker.reset(user.employee_number)

        # Log the password reset
        activity = UserActivity(
            user_id=user.id,
            activity_type="password_reset",
            description="Password reset completed",
            ip_address=request.remote_addr
        )
        db.session.add(activity)
        db.session.commit()

        return jsonify({"message": "Password reset successful"}), 200

    @app.route("/api/auth/user", methods=["GET"])
    @login_required
    def get_profile():
        # Get user_id from JWT token
        user = db.session.get(User, request.current_user["user_id"])
        return jsonify(user.to_dict(include_roles=True, include_permissions=True)), 200

    # Removed duplicate get_checkout_details - now handled by routes_tool_checkout.py

