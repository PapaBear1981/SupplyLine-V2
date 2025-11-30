"""
Admin-specific routes for managing users, departments, announcements, and roles
"""
import logging
from datetime import UTC, datetime

from flask import jsonify, request
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

import utils as password_utils
from auth import admin_required
from models import Announcement, AuditLog, Department, Role, User, UserRole, db


logger = logging.getLogger(__name__)


def register_admin_routes(app):
    """Register admin-specific routes"""

    # Admin Statistics
    @app.route("/api/admin/stats", methods=["GET"])
    @admin_required
    def get_admin_stats():
        """Get admin dashboard statistics"""
        try:
            total_users = User.query.count()
            active_users = User.query.filter_by(is_active=True).count()

            # Count locked users
            now = datetime.now(UTC)
            locked_users = User.query.filter(
                User.account_locked_until > now
            ).count()

            total_departments = Department.query.count()
            active_announcements = Announcement.query.filter(
                Announcement.is_active.is_(True),
                db.or_(
                    Announcement.expiration_date.is_(None),
                    Announcement.expiration_date > now
                )
            ).count()
            total_roles = Role.query.count()

            return jsonify({
                "total_users": total_users,
                "active_users": active_users,
                "locked_users": locked_users,
                "total_departments": total_departments,
                "active_announcements": active_announcements,
                "total_roles": total_roles
            })
        except SQLAlchemyError:
            logger.exception("Error fetching admin stats")
            return jsonify({"error": "Failed to fetch admin statistics"}), 500

    # Announcements Management (Admin)
    @app.route("/api/admin/announcements", methods=["GET"])
    @admin_required
    def admin_get_announcements():
        """Get all announcements for admin (including inactive)"""
        try:
            announcements = Announcement.query.order_by(Announcement.created_at.desc()).all()
            return jsonify([a.to_dict() for a in announcements])
        except SQLAlchemyError:
            logger.exception("Error fetching announcements")
            return jsonify({"error": "Failed to fetch announcements"}), 500

    @app.route("/api/admin/announcements", methods=["POST"])
    @admin_required
    def admin_create_announcement():
        """Create a new announcement"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            # Validate required fields
            if not data.get("title"):
                return jsonify({"error": "Title is required"}), 400
            if not data.get("message"):
                return jsonify({"error": "Message is required"}), 400
            if not data.get("priority"):
                return jsonify({"error": "Priority is required"}), 400

            # Validate priority
            valid_priorities = ["low", "medium", "high", "urgent"]
            if data["priority"] not in valid_priorities:
                return jsonify({"error": f"Priority must be one of: {', '.join(valid_priorities)}"}), 400

            # Create announcement
            announcement = Announcement(
                title=data["title"],
                message=data["message"],
                priority=data["priority"],
                is_active=data.get("is_active", True),
                created_by=current_user["user_id"],
                target_departments=data.get("target_departments"),
                expiration_date=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None
            )

            db.session.add(announcement)
            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="announcement.create",
                resource_type="announcement",
                resource_id=announcement.id,
                details={"title": announcement.title}
            )

            return jsonify(announcement.to_dict()), 201
        except SQLAlchemyError:
            logger.exception("Error creating announcement")
            db.session.rollback()
            return jsonify({"error": "Failed to create announcement"}), 500

    @app.route("/api/admin/announcements/<int:id>", methods=["PUT"])
    @admin_required
    def admin_update_announcement(id):
        """Update an announcement"""
        try:
            announcement = Announcement.query.get_or_404(id)
            data = request.get_json() or {}
            current_user = request.current_user

            # Update fields
            if "title" in data:
                announcement.title = data["title"]
            if "message" in data:
                announcement.message = data["message"]
            if "priority" in data:
                valid_priorities = ["low", "medium", "high", "urgent"]
                if data["priority"] not in valid_priorities:
                    return jsonify({"error": f"Priority must be one of: {', '.join(valid_priorities)}"}), 400
                announcement.priority = data["priority"]
            if "is_active" in data:
                announcement.is_active = data["is_active"]
            if "target_departments" in data:
                announcement.target_departments = data["target_departments"]
            if "expires_at" in data:
                announcement.expiration_date = datetime.fromisoformat(data["expires_at"]) if data["expires_at"] else None

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="announcement.update",
                resource_type="announcement",
                resource_id=announcement.id,
                details={"title": announcement.title}
            )

            return jsonify(announcement.to_dict())
        except SQLAlchemyError:
            logger.exception("Error updating announcement %s", id)
            db.session.rollback()
            return jsonify({"error": "Failed to update announcement"}), 500

    @app.route("/api/admin/announcements/<int:id>", methods=["DELETE"])
    @admin_required
    def admin_delete_announcement(id):
        """Delete an announcement"""
        try:
            announcement = Announcement.query.get_or_404(id)
            current_user = request.current_user

            # Log audit before deletion
            AuditLog.log(
                user_id=current_user["user_id"],
                action="announcement.delete",
                resource_type="announcement",
                resource_id=announcement.id,
                details={"title": announcement.title}
            )

            db.session.delete(announcement)
            db.session.commit()

            return "", 204
        except SQLAlchemyError:
            logger.exception("Error deleting announcement %s", id)
            db.session.rollback()
            return jsonify({"error": "Failed to delete announcement"}), 500

    # User Management (Admin)
    @app.route("/api/admin/users/reset-password", methods=["POST"])
    @admin_required
    def admin_reset_user_password():
        """Reset a user's password"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            user_id = data.get("user_id")
            new_password = data.get("new_password")
            force_change = data.get("force_change", True)

            if not user_id or not new_password:
                return jsonify({"error": "user_id and new_password are required"}), 400

            user = User.query.get_or_404(user_id)

            # Validate password strength
            is_valid, errors = password_utils.validate_password_strength(new_password)
            if not is_valid:
                return jsonify({"error": "Password does not meet security requirements", "details": errors}), 400

            # Update password
            user.set_password(new_password)
            if force_change:
                user.force_password_change = True
            user.password_changed_at = datetime.now(UTC)

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="user.password_reset",
                resource_type="user",
                resource_id=user.id,
                details={"target_user": user.employee_number, "force_change": force_change}
            )

            return jsonify({"message": "Password reset successfully"})
        except SQLAlchemyError:
            logger.exception("Error resetting password")
            db.session.rollback()
            return jsonify({"error": "Failed to reset password"}), 500

    @app.route("/api/admin/users/toggle-status", methods=["POST"])
    @admin_required
    def admin_toggle_user_status():
        """Enable or disable a user account"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            user_id = data.get("user_id")
            is_active = data.get("is_active")

            if user_id is None or is_active is None:
                return jsonify({"error": "user_id and is_active are required"}), 400

            # Prevent self-disable
            if user_id == current_user["user_id"] and not is_active:
                return jsonify({"error": "Cannot disable your own account"}), 400

            user = User.query.get_or_404(user_id)
            user.is_active = is_active

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="user.toggle_status",
                resource_type="user",
                resource_id=user.id,
                details={"target_user": user.employee_number, "is_active": is_active}
            )

            return jsonify({"message": f"User {'enabled' if is_active else 'disabled'} successfully"})
        except SQLAlchemyError:
            logger.exception("Error toggling user status")
            db.session.rollback()
            return jsonify({"error": "Failed to update user status"}), 500

    @app.route("/api/admin/users/unlock", methods=["POST"])
    @admin_required
    def admin_unlock_user():
        """Unlock a locked user account"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            user_id = data.get("user_id")
            if not user_id:
                return jsonify({"error": "user_id is required"}), 400

            user = User.query.get_or_404(user_id)

            # Unlock the account
            user.account_locked_until = None
            user.failed_login_attempts = 0
            user.last_failed_login = None

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="user.unlock",
                resource_type="user",
                resource_id=user.id,
                details={"target_user": user.employee_number}
            )

            return jsonify({"message": "User account unlocked successfully"})
        except SQLAlchemyError:
            logger.exception("Error unlocking user")
            db.session.rollback()
            return jsonify({"error": "Failed to unlock user"}), 500

    @app.route("/api/admin/users/permissions", methods=["POST"])
    @admin_required
    def admin_update_user_permissions():
        """Update a user's role assignments"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            user_id = data.get("user_id")
            role_ids = data.get("role_ids", [])

            if not user_id:
                return jsonify({"error": "user_id is required"}), 400

            user = User.query.get_or_404(user_id)

            # Prevent admins from removing their own admin privileges
            if user_id == current_user["user_id"]:
                admin_role = Role.query.filter_by(name="admin").first()
                if admin_role and admin_role.id not in role_ids:
                    return jsonify({"error": "Cannot remove your own admin role"}), 400

            # Remove existing roles
            UserRole.query.filter_by(user_id=user_id).delete()

            # Add new roles
            for role_id in role_ids:
                role = Role.query.get(role_id)
                if role:
                    user_role = UserRole(user_id=user_id, role_id=role_id)
                    db.session.add(user_role)

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="user.permissions_update",
                resource_type="user",
                resource_id=user.id,
                details={"target_user": user.employee_number, "role_count": len(role_ids)}
            )

            return jsonify({"message": "User permissions updated successfully"})
        except SQLAlchemyError:
            logger.exception("Error updating user permissions")
            db.session.rollback()
            return jsonify({"error": "Failed to update user permissions"}), 500

    # Department Management (Admin)
    @app.route("/api/admin/departments", methods=["GET"])
    @admin_required
    def admin_get_departments():
        """Get all departments (including inactive)"""
        try:
            departments = Department.query.all()
            return jsonify([dept.to_dict() for dept in departments])
        except SQLAlchemyError:
            logger.exception("Error fetching departments")
            return jsonify({"error": "Failed to fetch departments"}), 500

    @app.route("/api/admin/departments", methods=["POST"])
    @admin_required
    def admin_create_department():
        """Create a new department"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            if not data.get("name"):
                return jsonify({"error": "Department name is required"}), 400

            # Check if department name already exists
            if Department.query.filter_by(name=data["name"]).first():
                return jsonify({"error": "Department name already exists"}), 400

            department = Department(
                name=data["name"],
                description=data.get("description"),
                is_active=data.get("is_active", True)
            )

            db.session.add(department)
            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="department.create",
                resource_type="department",
                resource_id=department.id,
                details={"name": department.name}
            )

            return jsonify(department.to_dict()), 201
        except IntegrityError:
            logger.exception("Error creating department - integrity error")
            db.session.rollback()
            return jsonify({"error": "Department name already exists"}), 400
        except SQLAlchemyError:
            logger.exception("Error creating department")
            db.session.rollback()
            return jsonify({"error": "Failed to create department"}), 500

    @app.route("/api/admin/departments/<int:id>", methods=["PUT"])
    @admin_required
    def admin_update_department(id):
        """Update a department"""
        try:
            department = Department.query.get_or_404(id)
            data = request.get_json() or {}
            current_user = request.current_user

            if "name" in data:
                # Check if new name conflicts with existing
                existing = Department.query.filter_by(name=data["name"]).first()
                if existing and existing.id != id:
                    return jsonify({"error": "Department name already exists"}), 400
                department.name = data["name"]

            if "description" in data:
                department.description = data["description"]
            if "is_active" in data:
                department.is_active = data["is_active"]

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="department.update",
                resource_type="department",
                resource_id=department.id,
                details={"name": department.name}
            )

            return jsonify(department.to_dict())
        except IntegrityError:
            logger.exception("Error updating department - integrity error")
            db.session.rollback()
            return jsonify({"error": "Department name already exists"}), 400
        except SQLAlchemyError:
            logger.exception("Error updating department %s", id)
            db.session.rollback()
            return jsonify({"error": "Failed to update department"}), 500

    @app.route("/api/admin/departments/<int:id>", methods=["DELETE"])
    @admin_required
    def admin_delete_department(id):
        """Delete a department"""
        try:
            department = Department.query.get_or_404(id)
            current_user = request.current_user

            # Check if department is in use
            users_count = User.query.filter_by(department=department.name).count()
            if users_count > 0:
                return jsonify({"error": f"Cannot delete department with {users_count} assigned users"}), 400

            # Log audit before deletion
            AuditLog.log(
                user_id=current_user["user_id"],
                action="department.delete",
                resource_type="department",
                resource_id=department.id,
                details={"name": department.name}
            )

            db.session.delete(department)
            db.session.commit()

            return "", 204
        except SQLAlchemyError:
            logger.exception("Error deleting department %s", id)
            db.session.rollback()
            return jsonify({"error": "Failed to delete department"}), 500

    # Role Management (Admin)
    @app.route("/api/admin/roles", methods=["GET"])
    @admin_required
    def admin_get_roles():
        """Get all roles"""
        try:
            roles = Role.query.all()
            return jsonify([role.to_dict() for role in roles])
        except SQLAlchemyError:
            logger.exception("Error fetching roles")
            return jsonify({"error": "Failed to fetch roles"}), 500

    @app.route("/api/admin/roles", methods=["POST"])
    @admin_required
    def admin_create_role():
        """Create a new role"""
        try:
            data = request.get_json() or {}
            current_user = request.current_user

            if not data.get("name"):
                return jsonify({"error": "Role name is required"}), 400

            # Check if role name already exists
            if Role.query.filter_by(name=data["name"]).first():
                return jsonify({"error": "Role name already exists"}), 400

            role = Role(
                name=data["name"],
                description=data.get("description"),
                is_system_role=False
            )

            db.session.add(role)
            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="role.create",
                resource_type="role",
                resource_id=role.id,
                details={"name": role.name}
            )

            return jsonify(role.to_dict()), 201
        except IntegrityError:
            logger.exception("Error creating role - integrity error")
            db.session.rollback()
            return jsonify({"error": "Role name already exists"}), 400
        except SQLAlchemyError:
            logger.exception("Error creating role")
            db.session.rollback()
            return jsonify({"error": "Failed to create role"}), 500

    @app.route("/api/admin/roles/<int:id>", methods=["PUT"])
    @admin_required
    def admin_update_role(id):
        """Update a role"""
        try:
            role = Role.query.get_or_404(id)
            data = request.get_json() or {}
            current_user = request.current_user

            # Prevent editing system roles
            if role.is_system_role:
                return jsonify({"error": "Cannot edit system roles"}), 403

            if "name" in data:
                # Check if new name conflicts with existing
                existing = Role.query.filter_by(name=data["name"]).first()
                if existing and existing.id != id:
                    return jsonify({"error": "Role name already exists"}), 400
                role.name = data["name"]

            if "description" in data:
                role.description = data["description"]

            db.session.commit()

            # Log audit
            AuditLog.log(
                user_id=current_user["user_id"],
                action="role.update",
                resource_type="role",
                resource_id=role.id,
                details={"name": role.name}
            )

            return jsonify(role.to_dict())
        except IntegrityError:
            logger.exception("Error updating role - integrity error")
            db.session.rollback()
            return jsonify({"error": "Role name already exists"}), 400
        except SQLAlchemyError:
            logger.exception("Error updating role %s", id)
            db.session.rollback()
            return jsonify({"error": "Failed to update role"}), 500

    @app.route("/api/admin/roles/<int:id>", methods=["DELETE"])
    @admin_required
    def admin_delete_role(id):
        """Delete a role"""
        try:
            role = Role.query.get_or_404(id)
            current_user = request.current_user

            # Prevent deleting system roles
            if role.is_system_role:
                return jsonify({"error": "Cannot delete system roles"}), 403

            # Check if role is in use
            users_count = UserRole.query.filter_by(role_id=id).count()
            if users_count > 0:
                return jsonify({"error": f"Cannot delete role assigned to {users_count} users"}), 400

            # Log audit before deletion
            AuditLog.log(
                user_id=current_user["user_id"],
                action="role.delete",
                resource_type="role",
                resource_id=role.id,
                details={"name": role.name}
            )

            db.session.delete(role)
            db.session.commit()

            return "", 204
        except SQLAlchemyError:
            logger.exception("Error deleting role %s", id)
            db.session.rollback()
            return jsonify({"error": "Failed to delete role"}), 500
