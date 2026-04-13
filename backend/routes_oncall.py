"""Routes for managing and retrieving on-call personnel."""

import logging

from flask import jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from auth import admin_required, jwt_required
from models import AuditLog, SystemSetting, User, db


logger = logging.getLogger(__name__)

MATERIALS_ONCALL_KEY = "oncall_materials_user_id"
MAINTENANCE_ONCALL_KEY = "oncall_maintenance_user_id"

ONCALL_KEYS = {
    "materials": MATERIALS_ONCALL_KEY,
    "maintenance": MAINTENANCE_ONCALL_KEY,
}


def _serialize_user_brief(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "employee_number": user.employee_number,
        "department": user.department,
        "email": user.email,
        "avatar": user.avatar,
    }


def _get_oncall_user(setting_key: str) -> tuple[User | None, SystemSetting | None]:
    setting = SystemSetting.query.filter_by(key=setting_key).first()
    if not setting or not setting.value:
        return None, setting

    try:
        user_id = int(setting.value)
    except (TypeError, ValueError):
        return None, setting

    user = db.session.get(User, user_id)
    return user, setting


def _serialize_oncall_entry(setting_key: str) -> dict:
    user, setting = _get_oncall_user(setting_key)
    updated_by = None
    if setting and setting.updated_by:
        updated_by = {
            "id": setting.updated_by.id,
            "name": setting.updated_by.name,
            "employee_number": setting.updated_by.employee_number,
        }

    return {
        "user": _serialize_user_brief(user),
        "updated_at": setting.updated_at.isoformat() if setting and setting.updated_at else None,
        "updated_by": updated_by,
    }


def _set_oncall_user(setting_key: str, category: str, description: str, user_id: int | None, updated_by_id: int) -> SystemSetting:
    setting = SystemSetting.query.filter_by(key=setting_key).first()
    value = str(user_id) if user_id is not None else ""

    if not setting:
        setting = SystemSetting(
            key=setting_key,
            value=value,
            category=category,
            description=description,
            is_sensitive=False,
        )
        db.session.add(setting)
    else:
        setting.value = value

    setting.updated_by_id = updated_by_id
    return setting


def register_oncall_routes(app):
    """Register on-call personnel routes."""

    @app.route("/api/oncall", methods=["GET"])
    @jwt_required
    def get_oncall_personnel():
        """Return the currently configured on-call personnel for all tracked roles."""
        try:
            return jsonify({
                "materials": _serialize_oncall_entry(MATERIALS_ONCALL_KEY),
                "maintenance": _serialize_oncall_entry(MAINTENANCE_ONCALL_KEY),
            })
        except SQLAlchemyError:
            logger.exception("Error fetching on-call personnel")
            return jsonify({"error": "Failed to fetch on-call personnel"}), 500

    @app.route("/api/admin/oncall", methods=["GET"])
    @admin_required
    def admin_get_oncall_personnel():
        """Admin view of the current on-call assignments."""
        try:
            return jsonify({
                "materials": _serialize_oncall_entry(MATERIALS_ONCALL_KEY),
                "maintenance": _serialize_oncall_entry(MAINTENANCE_ONCALL_KEY),
            })
        except SQLAlchemyError:
            logger.exception("Error fetching on-call personnel for admin")
            return jsonify({"error": "Failed to fetch on-call personnel"}), 500

    @app.route("/api/admin/oncall", methods=["PUT"])
    @admin_required
    def admin_update_oncall_personnel():
        """Update on-call assignments for materials and/or maintenance.

        Request body may include ``materials_user_id`` and/or ``maintenance_user_id``.
        Pass ``null`` to clear an assignment.
        """
        try:
            data = request.get_json() or {}
            current_user = request.current_user
            updated_by_id = current_user["user_id"]

            provided_materials = "materials_user_id" in data
            provided_maintenance = "maintenance_user_id" in data

            if not provided_materials and not provided_maintenance:
                return jsonify({
                    "error": "At least one of materials_user_id or maintenance_user_id is required"
                }), 400

            details: dict[str, int | None] = {}

            if provided_materials:
                materials_user_id = data.get("materials_user_id")
                if materials_user_id is not None:
                    try:
                        materials_user_id = int(materials_user_id)
                    except (TypeError, ValueError):
                        return jsonify({"error": "materials_user_id must be an integer or null"}), 400
                    if not db.session.get(User, materials_user_id):
                        return jsonify({"error": f"User {materials_user_id} not found"}), 404
                _set_oncall_user(
                    MATERIALS_ONCALL_KEY,
                    category="oncall",
                    description="Current Materials department on-call user",
                    user_id=materials_user_id,
                    updated_by_id=updated_by_id,
                )
                details["materials_user_id"] = materials_user_id

            if provided_maintenance:
                maintenance_user_id = data.get("maintenance_user_id")
                if maintenance_user_id is not None:
                    try:
                        maintenance_user_id = int(maintenance_user_id)
                    except (TypeError, ValueError):
                        return jsonify({"error": "maintenance_user_id must be an integer or null"}), 400
                    if not db.session.get(User, maintenance_user_id):
                        return jsonify({"error": f"User {maintenance_user_id} not found"}), 404
                _set_oncall_user(
                    MAINTENANCE_ONCALL_KEY,
                    category="oncall",
                    description="Current Maintenance department on-call user",
                    user_id=maintenance_user_id,
                    updated_by_id=updated_by_id,
                )
                details["maintenance_user_id"] = maintenance_user_id

            db.session.commit()

            AuditLog.log(
                user_id=updated_by_id,
                action="oncall.update",
                resource_type="system_setting",
                resource_id=None,
                details=details,
            )

            return jsonify({
                "materials": _serialize_oncall_entry(MATERIALS_ONCALL_KEY),
                "maintenance": _serialize_oncall_entry(MAINTENANCE_ONCALL_KEY),
            })
        except SQLAlchemyError:
            logger.exception("Error updating on-call personnel")
            db.session.rollback()
            return jsonify({"error": "Failed to update on-call personnel"}), 500
