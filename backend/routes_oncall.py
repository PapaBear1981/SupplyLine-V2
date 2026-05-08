"""Routes for managing and retrieving on-call personnel."""

import logging
from datetime import UTC, date, datetime, timedelta

from flask import jsonify, request
from sqlalchemy.exc import SQLAlchemyError

from auth import admin_required, jwt_required
from models import AuditLog, OnCallSchedule, SystemSetting, User, db


logger = logging.getLogger(__name__)

MATERIALS_ONCALL_KEY = "oncall_materials_user_id"
MAINTENANCE_ONCALL_KEY = "oncall_maintenance_user_id"

ONCALL_KEYS = {
    "materials": MATERIALS_ONCALL_KEY,
    "maintenance": MAINTENANCE_ONCALL_KEY,
}

VALID_ROLES = ("materials", "maintenance")


def _parse_date(value, field_name):
    if not value:
        raise ValueError(f"{field_name} is required")
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format")


def _serialize_user_brief(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "employee_number": user.employee_number,
        "department": user.department,
        "email": user.email,
        "phone": user.phone,
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


def _serialize_oncall_entry(role: str) -> dict:
    """Resolve who is on call for ``role`` right now.

    Prefers an active schedule entry covering today; otherwise falls back
    to the manual SystemSetting override. The ``source`` field tells the
    caller which one was used so the UI can label it.

    The schedule lookup is wrapped defensively: if the ``oncall_schedules``
    table or any of its columns are missing (e.g. on a deploy where the
    Phase 2 auto-migration hasn't run yet), we log and fall back to the
    manual override instead of 500-ing the entire dashboard.
    """
    today = datetime.now(UTC).date()
    schedule = None
    try:
        schedule = (
            OnCallSchedule.query.filter(
                OnCallSchedule.role == role,
                OnCallSchedule.start_date <= today,
                OnCallSchedule.end_date >= today,
            )
            .order_by(OnCallSchedule.start_date.desc(), OnCallSchedule.id.desc())
            .first()
        )
    except SQLAlchemyError:
        logger.warning(
            "Could not read oncall_schedules for role=%s; falling back to "
            "manual override. The Phase 2 auto-migration may not have run.",
            role,
            exc_info=True,
        )
        db.session.rollback()

    if schedule and schedule.user:
        # Whoever last touched the schedule row matches updated_at; fall back to
        # the creator only for legacy rows that pre-date the updated_by column.
        attributed = None
        try:
            attributed = schedule.updated_by or schedule.created_by
        except SQLAlchemyError:
            logger.warning(
                "Failed to load updated_by/created_by for schedule id=%s",
                schedule.id,
                exc_info=True,
            )
            db.session.rollback()
        updated_by = None
        if attributed:
            updated_by = {
                "id": attributed.id,
                "name": attributed.name,
                "employee_number": attributed.employee_number,
            }
        return {
            "user": _serialize_user_brief(schedule.user),
            "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
            "updated_by": updated_by,
            "source": "schedule",
            "schedule": {
                "id": schedule.id,
                "start_date": schedule.start_date.isoformat(),
                "end_date": schedule.end_date.isoformat(),
                "notes": schedule.notes,
            },
        }

    setting_key = ONCALL_KEYS[role]
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
        "source": "manual",
        "schedule": None,
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
                "materials": _serialize_oncall_entry("materials"),
                "maintenance": _serialize_oncall_entry("maintenance"),
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
                "materials": _serialize_oncall_entry("materials"),
                "maintenance": _serialize_oncall_entry("maintenance"),
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
                "materials": _serialize_oncall_entry("materials"),
                "maintenance": _serialize_oncall_entry("maintenance"),
            })
        except SQLAlchemyError:
            logger.exception("Error updating on-call personnel")
            db.session.rollback()
            return jsonify({"error": "Failed to update on-call personnel"}), 500

    def _query_schedules():
        role = request.args.get("role")
        start_param = request.args.get("start")
        end_param = request.args.get("end")

        query = OnCallSchedule.query

        if role:
            if role not in VALID_ROLES:
                return None, (jsonify({"error": f"role must be one of {VALID_ROLES}"}), 400)
            query = query.filter(OnCallSchedule.role == role)

        try:
            if start_param:
                start = _parse_date(start_param, "start")
                query = query.filter(OnCallSchedule.end_date >= start)
            if end_param:
                end = _parse_date(end_param, "end")
                query = query.filter(OnCallSchedule.start_date <= end)
        except ValueError as exc:
            return None, (jsonify({"error": str(exc)}), 400)

        schedules = query.order_by(OnCallSchedule.start_date.asc(), OnCallSchedule.role.asc()).all()
        return schedules, None

    @app.route("/api/oncall/schedule", methods=["GET"])
    @jwt_required
    def get_oncall_schedule():
        """Return scheduled on-call assignments. Visible to all authenticated users.

        Query params: ``role`` (materials|maintenance), ``start`` (YYYY-MM-DD),
        ``end`` (YYYY-MM-DD). When ``start`` and ``end`` are omitted the next
        90 days are returned.
        """
        try:
            role = request.args.get("role")
            if role and role not in VALID_ROLES:
                return jsonify({"error": f"role must be one of {VALID_ROLES}"}), 400

            try:
                if request.args.get("start"):
                    start = _parse_date(request.args.get("start"), "start")
                else:
                    start = datetime.now(UTC).date()
                if request.args.get("end"):
                    end = _parse_date(request.args.get("end"), "end")
                else:
                    end = start + timedelta(days=90)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400

            try:
                query = OnCallSchedule.query.filter(
                    OnCallSchedule.end_date >= start,
                    OnCallSchedule.start_date <= end,
                )
                if role:
                    query = query.filter(OnCallSchedule.role == role)
                schedules = query.order_by(
                    OnCallSchedule.start_date.asc(), OnCallSchedule.role.asc()
                ).all()
                return jsonify({"schedules": [s.to_dict() for s in schedules]})
            except SQLAlchemyError:
                logger.exception(
                    "Error fetching on-call schedule; returning empty list. "
                    "Likely a missing column on oncall_schedules — check that "
                    "the Phase 2 auto-migration applied."
                )
                db.session.rollback()
                return jsonify({"schedules": [], "schedule_unavailable": True})
        except SQLAlchemyError:
            logger.exception("Error fetching on-call schedule")
            return jsonify({"error": "Failed to fetch on-call schedule"}), 500

    @app.route("/api/admin/oncall/schedule", methods=["GET"])
    @admin_required
    def admin_list_oncall_schedule():
        try:
            try:
                schedules, err = _query_schedules()
            except SQLAlchemyError:
                logger.exception(
                    "Error fetching on-call schedule for admin; returning "
                    "empty list. Likely a missing column on oncall_schedules — "
                    "check that the Phase 2 auto-migration applied."
                )
                db.session.rollback()
                return jsonify({"schedules": [], "schedule_unavailable": True})
            if err is not None:
                return err
            try:
                return jsonify({"schedules": [s.to_dict() for s in schedules]})
            except SQLAlchemyError:
                logger.exception(
                    "Error serializing on-call schedule rows for admin; "
                    "returning empty list."
                )
                db.session.rollback()
                return jsonify({"schedules": [], "schedule_unavailable": True})
        except SQLAlchemyError:
            logger.exception("Error fetching on-call schedule for admin")
            return jsonify({"error": "Failed to fetch on-call schedule"}), 500

    @app.route("/api/admin/oncall/schedule", methods=["POST"])
    @admin_required
    def admin_create_oncall_schedule():
        try:
            data = request.get_json() or {}
            current_user = request.current_user
            created_by_id = current_user["user_id"]

            role = data.get("role")
            user_id = data.get("user_id")
            allow_overlap = bool(data.get("allow_overlap", False))

            if role not in VALID_ROLES:
                return jsonify({"error": f"role must be one of {VALID_ROLES}"}), 400

            try:
                user_id = int(user_id) if user_id is not None else None
            except (TypeError, ValueError):
                return jsonify({"error": "user_id must be an integer"}), 400
            if not user_id or not db.session.get(User, user_id):
                return jsonify({"error": "user_id is required and must reference an existing user"}), 400

            try:
                start = _parse_date(data.get("start_date"), "start_date")
                end = _parse_date(data.get("end_date"), "end_date")
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400

            if end < start:
                return jsonify({"error": "end_date must be on or after start_date"}), 400

            if not allow_overlap:
                overlap = OnCallSchedule.query.filter(
                    OnCallSchedule.role == role,
                    OnCallSchedule.start_date <= end,
                    OnCallSchedule.end_date >= start,
                ).first()
                if overlap:
                    return jsonify({
                        "error": "Overlapping schedule exists for this role. Pass allow_overlap=true to create anyway.",
                        "conflict": overlap.to_dict(),
                    }), 409

            schedule = OnCallSchedule(
                role=role,
                user_id=user_id,
                start_date=start,
                end_date=end,
                notes=(data.get("notes") or None),
                created_by_id=created_by_id,
                updated_by_id=created_by_id,
            )
            db.session.add(schedule)
            db.session.commit()

            AuditLog.log(
                user_id=created_by_id,
                action="oncall.schedule.create",
                resource_type="oncall_schedule",
                resource_id=schedule.id,
                details={
                    "role": role,
                    "user_id": user_id,
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                },
            )

            return jsonify(schedule.to_dict()), 201
        except SQLAlchemyError:
            logger.exception("Error creating on-call schedule")
            db.session.rollback()
            return jsonify({"error": "Failed to create on-call schedule"}), 500

    @app.route("/api/admin/oncall/schedule/<int:schedule_id>", methods=["PUT"])
    @admin_required
    def admin_update_oncall_schedule(schedule_id):
        try:
            schedule = db.session.get(OnCallSchedule, schedule_id)
            if not schedule:
                return jsonify({"error": "Schedule not found"}), 404

            data = request.get_json() or {}
            current_user = request.current_user
            updated_by_id = current_user["user_id"]
            allow_overlap = bool(data.get("allow_overlap", False))

            if "role" in data:
                if data["role"] not in VALID_ROLES:
                    db.session.rollback()
                    return jsonify({"error": f"role must be one of {VALID_ROLES}"}), 400
                schedule.role = data["role"]

            if "user_id" in data:
                try:
                    new_user_id = int(data["user_id"])
                except (TypeError, ValueError):
                    db.session.rollback()
                    return jsonify({"error": "user_id must be an integer"}), 400
                if not db.session.get(User, new_user_id):
                    db.session.rollback()
                    return jsonify({"error": f"User {new_user_id} not found"}), 404
                schedule.user_id = new_user_id

            try:
                if "start_date" in data:
                    schedule.start_date = _parse_date(data["start_date"], "start_date")
                if "end_date" in data:
                    schedule.end_date = _parse_date(data["end_date"], "end_date")
            except ValueError as exc:
                db.session.rollback()
                return jsonify({"error": str(exc)}), 400

            if schedule.end_date < schedule.start_date:
                db.session.rollback()
                return jsonify({"error": "end_date must be on or after start_date"}), 400

            if "notes" in data:
                schedule.notes = data["notes"] or None

            if not allow_overlap:
                overlap = OnCallSchedule.query.filter(
                    OnCallSchedule.id != schedule.id,
                    OnCallSchedule.role == schedule.role,
                    OnCallSchedule.start_date <= schedule.end_date,
                    OnCallSchedule.end_date >= schedule.start_date,
                ).first()
                if overlap:
                    db.session.rollback()
                    return jsonify({
                        "error": "Overlapping schedule exists for this role. Pass allow_overlap=true to update anyway.",
                        "conflict": overlap.to_dict(),
                    }), 409

            schedule.updated_by_id = updated_by_id
            db.session.commit()

            AuditLog.log(
                user_id=updated_by_id,
                action="oncall.schedule.update",
                resource_type="oncall_schedule",
                resource_id=schedule.id,
                details={
                    "role": schedule.role,
                    "user_id": schedule.user_id,
                    "start_date": schedule.start_date.isoformat(),
                    "end_date": schedule.end_date.isoformat(),
                },
            )

            return jsonify(schedule.to_dict())
        except SQLAlchemyError:
            logger.exception("Error updating on-call schedule")
            db.session.rollback()
            return jsonify({"error": "Failed to update on-call schedule"}), 500

    @app.route("/api/admin/oncall/schedule/<int:schedule_id>", methods=["DELETE"])
    @admin_required
    def admin_delete_oncall_schedule(schedule_id):
        try:
            schedule = db.session.get(OnCallSchedule, schedule_id)
            if not schedule:
                return jsonify({"error": "Schedule not found"}), 404

            current_user = request.current_user
            details = {
                "role": schedule.role,
                "user_id": schedule.user_id,
                "start_date": schedule.start_date.isoformat(),
                "end_date": schedule.end_date.isoformat(),
            }

            db.session.delete(schedule)
            db.session.commit()

            AuditLog.log(
                user_id=current_user["user_id"],
                action="oncall.schedule.delete",
                resource_type="oncall_schedule",
                resource_id=schedule_id,
                details=details,
            )

            return jsonify({"deleted": True, "id": schedule_id})
        except SQLAlchemyError:
            logger.exception("Error deleting on-call schedule")
            db.session.rollback()
            return jsonify({"error": "Failed to delete on-call schedule"}), 500
