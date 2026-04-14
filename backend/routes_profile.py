"""Profile Routes for SupplyLine MRO Suite.

Canonical user-profile endpoints, consolidated from an earlier split
between routes_profile.py and routes.py's /api/user/* handlers.

Endpoints:
    GET  /api/profile           — current user's profile
    PUT  /api/profile           — update profile (first/last name, email,
                                  plus legacy name/department/avatar fields)
    PUT  /api/profile/password  — change password with OWASP ASVS 3.1.4
                                  stale-JWT protection
    POST /api/profile/avatar    — upload avatar with magic-byte validation
    GET  /api/profile/activity  — recent activity log for the current user
    GET  /api/profile/stats     — high-level usage stats for the profile page
"""

import logging
import os
from datetime import UTC, datetime

from flask import Blueprint, current_app, jsonify, request

import utils as password_utils
from auth.jwt_manager import jwt_required as login_required
from models import AuditLog, Checkout, ChemicalIssuance, User, UserActivity, db
from utils.file_validation import FileValidationError, validate_image_upload


logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__)


def register_profile_routes(app):
    """Register profile routes under /api."""
    app.register_blueprint(profile_bp, url_prefix="/api")


@profile_bp.route("/profile", methods=["GET"])
@login_required
def get_profile():
    """Return the current user's profile."""
    user = db.session.get(User, request.current_user["user_id"])
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict(include_roles=True)), 200


@profile_bp.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    """Update the current user's profile.

    Accepts both the new-style payload (first_name/last_name/email)
    used by the React client and the legacy name/department/avatar
    fields so older callers keep working.
    """
    user = db.session.get(User, request.current_user["user_id"])
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip()

    # New-style name update
    if first_name or last_name:
        if not first_name or not last_name:
            return jsonify({"error": "First name and last name are required"}), 400
        user.name = f"{first_name} {last_name}"
    elif "name" in data:
        # Legacy callers send a single "name" field
        user.name = data["name"]

    if email:
        if "@" not in email:
            return jsonify({"error": "Invalid email address"}), 400
        if email != user.email:
            existing = User.query.filter_by(email=email).first()
            if existing and existing.id != user.id:
                return jsonify({"error": "Email already in use"}), 400
        user.email = email

    # Legacy field support
    if "department" in data:
        user.department = data["department"]
    if "avatar" in data:
        user.avatar = data["avatar"]

    try:
        db.session.commit()
    except Exception:
        logger.exception("Error updating profile")
        db.session.rollback()
        return jsonify({"error": "Failed to update profile"}), 500

    activity = UserActivity(
        user_id=user.id,
        activity_type="profile_update",
        description="Profile information updated",
        ip_address=request.remote_addr,
    )
    db.session.add(activity)

    try:
        AuditLog.log(
            user_id=user.id,
            action="profile_update",
            resource_type="user",
            resource_id=user.id,
            details={"user_name": user.name, "email": user.email},
            ip_address=request.remote_addr,
        )
    except Exception:
        # AuditLog.log shouldn't fail the request if it has a problem.
        logger.exception("Error writing AuditLog entry for profile update")

    db.session.commit()

    return jsonify(user.to_dict()), 200


@profile_bp.route("/profile/password", methods=["PUT"])
@login_required
def change_password():
    """Change the current user's password.

    Enforces OWASP ASVS 3.1.4 — reject password changes that use a JWT
    issued before the last password change — so stolen or stale tokens
    cannot be used to hijack the account.
    """
    user = db.session.get(User, request.current_user["user_id"])
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    # Stale-JWT check (OWASP ASVS 3.1.4)
    if getattr(user, "password_changed_at", None):
        jwt_iat = request.current_user.get("iat")
        if jwt_iat:
            jwt_issued_at = datetime.fromtimestamp(jwt_iat, tz=UTC)
            password_changed_at = user.password_changed_at
            if password_changed_at.tzinfo is None:
                password_changed_at = password_changed_at.replace(tzinfo=UTC)
            if jwt_issued_at < password_changed_at:
                logger.warning(
                    "Password change attempt with stale JWT token for user %s",
                    user.id,
                )
                return jsonify({
                    "error": "Your session is outdated. Please log in again to change your password.",
                    "code": "STALE_SESSION",
                }), 401

    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    # confirm_password is optional; if present it must match.
    confirm_password = data.get("confirm_password")

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400

    if confirm_password is not None and confirm_password != new_password:
        return jsonify({"error": "New passwords do not match"}), 400

    if not user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 400

    is_valid, errors = password_utils.validate_password_strength(new_password)
    if not is_valid:
        return jsonify({
            "error": "Password does not meet security requirements",
            "details": errors,
        }), 400

    if hasattr(user, "is_password_reused") and user.is_password_reused(new_password):
        return jsonify({"error": "New password cannot match any of your last 5 passwords"}), 400

    user.set_password(new_password)
    if hasattr(user, "force_password_change"):
        user.force_password_change = False

    try:
        db.session.commit()
    except Exception:
        logger.exception("Error changing password")
        db.session.rollback()
        return jsonify({"error": "Failed to change password"}), 500

    activity = UserActivity(
        user_id=user.id,
        activity_type="password_change",
        description="Password changed",
        ip_address=request.remote_addr,
    )
    db.session.add(activity)
    db.session.commit()

    return jsonify({"message": "Password changed successfully"}), 200


@profile_bp.route("/profile/avatar", methods=["POST"])
@login_required
def upload_avatar():
    """Upload a new avatar for the current user.

    Uses magic-byte validation (validate_image_upload) so renamed
    binaries cannot be smuggled in with an image extension.
    """
    user = db.session.get(User, request.current_user["user_id"])
    if not user:
        return jsonify({"error": "User not found"}), 404

    if "avatar" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["avatar"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    try:
        max_size = current_app.config.get("MAX_AVATAR_FILE_SIZE")
        safe_filename = validate_image_upload(file, max_size=max_size)
    except FileValidationError as exc:
        return jsonify({"error": str(exc)}), getattr(exc, "status_code", 400)

    avatar_dir = os.path.join(current_app.static_folder, "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    file_path = os.path.join(avatar_dir, safe_filename)
    file.save(file_path)

    avatar_url = f"/api/static/avatars/{safe_filename}"
    user.avatar = avatar_url
    db.session.commit()

    activity = UserActivity(
        user_id=user.id,
        activity_type="avatar_update",
        description="Profile avatar updated",
        ip_address=request.remote_addr,
    )
    db.session.add(activity)
    db.session.commit()

    return jsonify({
        "message": "Avatar uploaded successfully",
        "avatar": avatar_url,
        "avatar_url": avatar_url,  # backward-compat alias
    }), 200


@profile_bp.route("/profile/activity", methods=["GET"])
@login_required
def get_activity():
    """Return the last 50 activity entries for the current user."""
    user_id = request.current_user["user_id"]
    activities = (
        UserActivity.query.filter_by(user_id=user_id)
        .order_by(UserActivity.timestamp.desc())
        .limit(50)
        .all()
    )
    return jsonify([a.to_dict() for a in activities]), 200


@profile_bp.route("/profile/stats", methods=["GET"])
@login_required
def get_stats():
    """Return high-level usage statistics for the profile page."""
    user_id = request.current_user["user_id"]

    tools_checked_out = Checkout.query.filter_by(
        user_id=user_id,
        return_date=None,
    ).count()

    chemicals_used = ChemicalIssuance.query.filter_by(user_id=user_id).count()

    # Kits-assembled is not currently tracked per-user.
    kits_assembled = 0

    last_activity = (
        UserActivity.query.filter_by(user_id=user_id)
        .order_by(UserActivity.timestamp.desc())
        .first()
    )
    last_activity_iso = last_activity.timestamp.isoformat() if last_activity else ""

    return jsonify({
        "tools_checked_out": tools_checked_out,
        "chemicals_used": chemicals_used,
        "kits_assembled": kits_assembled,
        "last_activity": last_activity_iso,
    }), 200
