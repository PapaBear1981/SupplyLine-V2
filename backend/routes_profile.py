"""
Profile Routes for SupplyLine MRO Suite

This module provides endpoints for user profile management including:
- View profile
- Update profile information
- Change password
- Upload avatar
"""

import logging
import os
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from auth.jwt_manager import jwt_required as login_required
from models import AuditLog, User, UserActivity, db

logger = logging.getLogger(__name__)

# Create blueprint
profile_bp = Blueprint("profile", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def register_profile_routes(app):
    """Register profile routes"""
    app.register_blueprint(profile_bp, url_prefix="/api")


@profile_bp.route("/profile", methods=["GET"])
@login_required
def get_profile():
    """Get current user's profile"""
    try:
        user_payload = request.current_user
        user_id = user_payload.get("user_id")

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Split name into first_name and last_name for frontend compatibility
        name_parts = user.name.split(" ", 1) if user.name else ["", ""]
        first_name = name_parts[0] if len(name_parts) > 0 else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        profile_data = {
            "id": user.id,
            "first_name": first_name,
            "last_name": last_name,
            "employee_number": user.employee_number,
            "email": user.email,
            "role": "admin" if user.is_admin else "user",
            "department_id": user.department,
            "is_active": user.is_active,
            "avatar": user.avatar
        }

        return jsonify(profile_data), 200

    except Exception as e:
        logger.error(f"Error getting profile: {e!s}")
        return jsonify({"error": "Failed to get profile"}), 500


@profile_bp.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    """Update current user's profile"""
    try:
        user_payload = request.current_user
        user_id = user_payload.get("user_id")

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")

        # Update fields
        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()
        email = data.get("email", "").strip()

        # Validate inputs
        if not first_name or not last_name:
            return jsonify({"error": "First name and last name are required"}), 400

        if email and "@" not in email:
            return jsonify({"error": "Invalid email address"}), 400

        # Check if email is already in use by another user
        if email and email != user.email:
            existing_user = User.query.filter_by(email=email).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({"error": "Email already in use"}), 400

        # Update user
        user.name = f"{first_name} {last_name}"
        if email:
            user.email = email

        db.session.commit()

        # Log activity
        activity = UserActivity(
            user_id=user.id,
            activity_type="profile_updated",
            description="User updated profile information",
            ip_address=request.remote_addr
        )
        db.session.add(activity)

        AuditLog.log(
            user_id=current_user_id,
            action="profile_update",
            resource_type="user",
            resource_id=user.id,
            details={
                "user_name": user.name,
                "email": user.email
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        logger.info(f"Profile updated for user {user.id}")

        # Return updated profile
        name_parts = user.name.split(" ", 1) if user.name else ["", ""]
        return jsonify({
            "id": user.id,
            "first_name": name_parts[0] if len(name_parts) > 0 else "",
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "employee_number": user.employee_number,
            "email": user.email,
            "role": "admin" if user.is_admin else "user",
            "department_id": user.department,
            "is_active": user.is_active,
            "avatar": user.avatar
        }), 200

    except Exception as e:
        logger.error(f"Error updating profile: {e!s}")
        db.session.rollback()
        return jsonify({"error": "Failed to update profile"}), 500


@profile_bp.route("/profile/password", methods=["PUT"])
@login_required
def change_password():
    """Change current user's password"""
    try:
        user_payload = request.current_user
        user_id = user_payload.get("user_id")

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")
        current_password = data.get("current_password", "").strip()
        new_password = data.get("new_password", "").strip()
        confirm_password = data.get("confirm_password", "").strip()

        # Validate inputs
        if not current_password or not new_password or not confirm_password:
            return jsonify({"error": "All password fields are required"}), 400

        if new_password != confirm_password:
            return jsonify({"error": "New passwords do not match"}), 400

        # Verify current password
        if not user.check_password(current_password):
            return jsonify({"error": "Current password is incorrect"}), 401

        # Validate new password strength
        if len(new_password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400

        if not any(c.isupper() for c in new_password):
            return jsonify({"error": "Password must contain at least one uppercase letter"}), 400

        if not any(c.islower() for c in new_password):
            return jsonify({"error": "Password must contain at least one lowercase letter"}), 400

        if not any(c.isdigit() for c in new_password):
            return jsonify({"error": "Password must contain at least one number"}), 400

        # Check password reuse
        if user.is_password_reused(new_password):
            return jsonify({"error": "Cannot reuse a recent password"}), 400

        # Update password
        user.set_password(new_password)
        user.force_password_change = False
        db.session.commit()

        # Log activity
        activity = UserActivity(
            user_id=user.id,
            activity_type="password_changed",
            description="User changed password",
            ip_address=request.remote_addr
        )
        db.session.add(activity)

        AuditLog.log(
            user_id=current_user_id,
            action="password_change",
            resource_type="user",
            resource_id=user.id,
            details={
                "user_name": user.name
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        logger.info(f"Password changed for user {user.id}")

        return jsonify({"message": "Password changed successfully"}), 200

    except Exception as e:
        logger.error(f"Error changing password: {e!s}")
        db.session.rollback()
        return jsonify({"error": "Failed to change password"}), 500


@profile_bp.route("/profile/avatar", methods=["POST"])
@login_required
def upload_avatar():
    """Upload user avatar"""
    try:
        user_payload = request.current_user
        user_id = user_payload.get("user_id")

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Check if file is in request
        if "avatar" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files["avatar"]

        if file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Allowed: png, jpg, jpeg, gif"}), 400

        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_FILE_SIZE:
            return jsonify({"error": "File too large. Maximum size is 2MB"}), 400

        # Generate secure filename
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"avatar_{user_id}_{timestamp}_{filename}"

        # Ensure upload directory exists
        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "avatars")
        os.makedirs(upload_dir, exist_ok=True)

        # Save file
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)

        # Update user avatar path
        avatar_url = f"/static/uploads/avatars/{filename}"

        # Delete old avatar if exists
        if user.avatar:
            old_filepath = os.path.join(current_app.root_path, user.avatar.lstrip("/"))
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                except Exception as e:
                    logger.warning(f"Failed to delete old avatar: {e!s}")

        user.avatar = avatar_url
        db.session.commit()

        # Log activity
        activity = UserActivity(
            user_id=user.id,
            activity_type="avatar_uploaded",
            description="User uploaded avatar",
            ip_address=request.remote_addr
        )
        db.session.add(activity)
        db.session.commit()

        logger.info(f"Avatar uploaded for user {user.id}")

        return jsonify({"avatar_url": avatar_url}), 200

    except Exception as e:
        logger.error(f"Error uploading avatar: {e!s}")
        db.session.rollback()
        return jsonify({"error": "Failed to upload avatar"}), 500
