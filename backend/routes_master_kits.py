"""
Routes for Master Kit List management.

Mirrors the ChemicalPart route style: admin-only writes, jwt-only reads. All
master-entry mutations route through ``services.master_kit_service`` so propagation
side-effects live in one place.
"""

import logging

from flask import jsonify, request

from auth import admin_required, jwt_required
from models import AuditLog, db
from models_kits import (
    AircraftType,
    Kit,
    MasterKit,
    MasterKitBox,
    MasterKitEntry,
)
from services import master_kit_service
from utils.error_handler import ValidationError, handle_errors


logger = logging.getLogger(__name__)


def register_master_kit_routes(app):
    """Register all master-kit related routes."""

    # -------------------- master kit CRUD --------------------

    @app.route("/api/master-kits", methods=["GET"])
    @jwt_required
    @handle_errors
    def list_master_kits():
        q = MasterKit.query
        aircraft_type_id = request.args.get("aircraft_type_id", type=int)
        if aircraft_type_id is not None:
            q = q.filter(MasterKit.aircraft_type_id == aircraft_type_id)
        is_active = request.args.get("is_active")
        if is_active is not None:
            q = q.filter(MasterKit.is_active == (is_active.lower() in ("1", "true", "yes")))
        rows = q.order_by(MasterKit.aircraft_type_id.asc(), MasterKit.id.asc()).all()
        return jsonify({"master_kits": [m.to_dict() for m in rows]}), 200

    @app.route("/api/master-kits/<int:master_kit_id>", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_master_kit(master_kit_id):
        master = MasterKit.query.get_or_404(master_kit_id)
        return jsonify(master.to_dict(include_boxes=True, include_entries=True)), 200

    @app.route("/api/master-kits", methods=["POST"])
    @admin_required
    @handle_errors
    def create_master_kit():
        data = request.get_json() or {}
        if not data.get("aircraft_type_id"):
            raise ValidationError("aircraft_type_id is required")
        if not data.get("name"):
            raise ValidationError("name is required")

        at = db.session.get(AircraftType, data["aircraft_type_id"])
        if at is None:
            raise ValidationError("Aircraft type not found")

        # 409 on aircraft_type collision among active masters.
        existing = MasterKit.query.filter_by(
            aircraft_type_id=at.id, is_active=True,
        ).first()
        if existing is not None:
            return jsonify({
                "error": "An active master kit already exists for this aircraft type.",
                "existing_master_kit_id": existing.id,
            }), 409

        master = MasterKit(
            aircraft_type_id=at.id,
            name=data["name"],
            description=data.get("description"),
            is_active=bool(data.get("is_active", True)),
            created_by=request.current_user.get("user_id"),
        )
        db.session.add(master)
        db.session.commit()
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_created",
            resource_type="master_kit",
            resource_id=master.id,
            details={"name": master.name, "aircraft_type_id": at.id},
        )
        return jsonify(master.to_dict()), 201

    @app.route("/api/master-kits/<int:master_kit_id>", methods=["PUT"])
    @admin_required
    @handle_errors
    def update_master_kit(master_kit_id):
        master = MasterKit.query.get_or_404(master_kit_id)
        data = request.get_json() or {}
        for f in ("name", "description"):
            if f in data:
                setattr(master, f, data[f])
        if "is_active" in data:
            master.is_active = bool(data["is_active"])
        db.session.commit()
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_updated",
            resource_type="master_kit",
            resource_id=master.id,
            details={k: v for k, v in data.items() if k in ("name", "description", "is_active")},
        )
        return jsonify(master.to_dict()), 200

    @app.route("/api/master-kits/<int:master_kit_id>", methods=["DELETE"])
    @admin_required
    @handle_errors
    def delete_master_kit(master_kit_id):
        master = MasterKit.query.get_or_404(master_kit_id)
        # Soft delete: set is_active=False, unlink kits.
        master.is_active = False
        for kit in Kit.query.filter_by(master_kit_id=master.id).all():
            kit.master_kit_id = None
        db.session.commit()
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_deleted",
            resource_type="master_kit",
            resource_id=master.id,
            details={"name": master.name},
        )
        return jsonify({"message": "Master kit deactivated"}), 200

    # -------------------- master kit boxes --------------------

    @app.route("/api/master-kits/<int:master_kit_id>/boxes", methods=["POST"])
    @admin_required
    @handle_errors
    def create_master_kit_box(master_kit_id):
        master = MasterKit.query.get_or_404(master_kit_id)
        data = request.get_json() or {}
        if not data.get("box_number"):
            raise ValidationError("box_number is required")
        if not data.get("box_type"):
            raise ValidationError("box_type is required")
        # Uniqueness inside the master.
        if MasterKitBox.query.filter_by(master_kit_id=master.id, box_number=data["box_number"]).first():
            return jsonify({"error": f"Box {data['box_number']!r} already exists"}), 409
        box = MasterKitBox(
            master_kit_id=master.id,
            box_number=data["box_number"],
            box_type=data["box_type"],
            description=data.get("description"),
            sort_order=int(data.get("sort_order") or 0),
        )
        db.session.add(box)
        db.session.commit()
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_box_created",
            resource_type="master_kit_box",
            resource_id=box.id,
            details={"master_kit_id": master.id, "box_number": box.box_number},
        )
        return jsonify(box.to_dict()), 201

    @app.route("/api/master-kits/boxes/<int:box_id>", methods=["PUT"])
    @admin_required
    @handle_errors
    def update_master_kit_box(box_id):
        box = MasterKitBox.query.get_or_404(box_id)
        data = request.get_json() or {}
        for f in ("box_number", "box_type", "description"):
            if f in data:
                setattr(box, f, data[f])
        if "sort_order" in data:
            box.sort_order = int(data["sort_order"] or 0)
        db.session.commit()
        return jsonify(box.to_dict()), 200

    @app.route("/api/master-kits/boxes/<int:box_id>", methods=["DELETE"])
    @admin_required
    @handle_errors
    def delete_master_kit_box(box_id):
        box = MasterKitBox.query.get_or_404(box_id)
        # If the box has entries, soft-unlink all of them (treat as bulk on_master_entry_deleted).
        for entry in box.entries.all():
            master_kit_service.on_master_entry_deleted(entry.id)
            db.session.delete(entry)
        db.session.delete(box)
        db.session.commit()
        return jsonify({"message": "Master box deleted"}), 200

    # -------------------- master kit entries --------------------

    @app.route("/api/master-kits/<int:master_kit_id>/entries", methods=["POST"])
    @admin_required
    @handle_errors
    def create_master_kit_entry(master_kit_id):
        master = MasterKit.query.get_or_404(master_kit_id)
        data = request.get_json() or {}
        if not data.get("master_box_id"):
            raise ValidationError("master_box_id is required")
        box = db.session.get(MasterKitBox, data["master_box_id"])
        if box is None or box.master_kit_id != master.id:
            raise ValidationError("master_box_id does not belong to this master kit")

        entry = MasterKitEntry(
            master_kit_id=master.id,
            master_box_id=box.id,
            entry_type=(data.get("entry_type") or "").strip().lower(),
            ref_tool_id=data.get("ref_tool_id"),
            ref_chemical_part_id=data.get("ref_chemical_part_id"),
            part_number=(data.get("part_number") or "").strip() or None,
            description=data.get("description"),
            required_quantity=float(data.get("required_quantity") or 1.0),
            minimum_stock_level=data.get("minimum_stock_level"),
            unit=data.get("unit") or "each",
            tracking_type=data.get("tracking_type"),
            is_required=bool(data.get("is_required", True)),
            notes=data.get("notes"),
            sort_order=int(data.get("sort_order") or 0),
        )
        ok, err = entry.validate_refs()
        if not ok:
            raise ValidationError(err)

        # Uniqueness inside the master.
        dup = MasterKitEntry.query.filter_by(
            master_kit_id=master.id, entry_type=entry.entry_type, part_number=entry.part_number,
        ).first()
        if dup is not None:
            return jsonify({"error": "Entry with this entry_type+part_number already exists",
                            "existing_id": dup.id}), 409

        db.session.add(entry)
        db.session.commit()
        master_kit_service.on_master_entry_created(entry)
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_entry_created",
            resource_type="master_kit_entry",
            resource_id=entry.id,
            details={"master_kit_id": master.id, "entry_type": entry.entry_type,
                     "part_number": entry.part_number},
        )
        return jsonify(entry.to_dict()), 201

    @app.route("/api/master-kits/entries/<int:entry_id>", methods=["PUT"])
    @admin_required
    @handle_errors
    def update_master_kit_entry(entry_id):
        entry = MasterKitEntry.query.get_or_404(entry_id)
        data = request.get_json() or {}
        before = {
            "entry_type": entry.entry_type,
            "part_number": entry.part_number,
        }
        for f in ("entry_type", "part_number", "description", "unit",
                  "tracking_type", "notes"):
            if f in data:
                setattr(entry, f, data[f])
        for f, cast in (
            ("required_quantity", float), ("minimum_stock_level", lambda v: None if v is None else float(v)),
            ("ref_tool_id", lambda v: None if v is None else int(v)),
            ("ref_chemical_part_id", lambda v: None if v is None else int(v)),
            ("sort_order", int), ("master_box_id", int),
        ):
            if f in data:
                setattr(entry, f, cast(data[f]))
        if "is_required" in data:
            entry.is_required = bool(data["is_required"])
        ok, err = entry.validate_refs()
        if not ok:
            raise ValidationError(err)
        db.session.commit()
        changed = set(data.keys())
        master_kit_service.on_master_entry_updated(entry, changed)
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_entry_updated",
            resource_type="master_kit_entry",
            resource_id=entry.id,
            details={"changes": list(changed), "before": before},
        )
        return jsonify(entry.to_dict()), 200

    @app.route("/api/master-kits/entries/<int:entry_id>", methods=["DELETE"])
    @admin_required
    @handle_errors
    def delete_master_kit_entry(entry_id):
        entry = MasterKitEntry.query.get_or_404(entry_id)
        master_kit_service.on_master_entry_deleted(entry.id)
        db.session.delete(entry)
        db.session.commit()
        AuditLog.log(
            user_id=request.current_user.get("user_id"),
            action="master_kit_entry_deleted",
            resource_type="master_kit_entry",
            resource_id=entry_id,
            details={},
        )
        return jsonify({"message": "Entry deleted"}), 200

    # -------------------- compliance + linkage --------------------

    @app.route("/api/kits/<int:kit_id>/compliance", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_kit_compliance(kit_id):
        kit = Kit.query.get_or_404(kit_id)
        report = master_kit_service.compute_compliance(kit)
        return jsonify(report), 200

    @app.route("/api/kits/<int:kit_id>/sync-from-master", methods=["POST"])
    @admin_required
    @handle_errors
    def sync_kit_from_master(kit_id):
        kit = Kit.query.get_or_404(kit_id)
        if kit.master_kit is None:
            raise ValidationError("Kit is not linked to a master kit.")
        force = request.args.get("force", "false").lower() in ("1", "true", "yes")
        result = master_kit_service.seed_kit_from_master(kit, kit.master_kit)
        if force:
            # Drop is_custom flags so the kit inherits everything from the master.
            for box in kit.boxes.all():
                if box.master_box_id is not None:
                    box.is_custom = False
            for item in kit.items.all():
                if item.master_entry_id is not None:
                    item.is_custom = False
            for exp in kit.expendables.all():
                if exp.master_entry_id is not None:
                    exp.is_custom = False
        db.session.commit()
        return jsonify({"message": "Sync complete", "result": result}), 200

    @app.route("/api/kits/<int:kit_id>/relink", methods=["POST"])
    @admin_required
    @handle_errors
    def relink_kit(kit_id):
        kit = Kit.query.get_or_404(kit_id)
        data = request.get_json() or {}
        master_kit_id = data.get("master_kit_id")
        if master_kit_id is None:
            kit.master_kit_id = None
            db.session.commit()
            return jsonify({"message": "Kit unlinked from master"}), 200
        master = MasterKit.query.get_or_404(master_kit_id)
        if master.aircraft_type_id != kit.aircraft_type_id:
            raise ValidationError("Master kit's aircraft type does not match the kit's.")
        kit.master_kit_id = master.id
        db.session.commit()
        return jsonify({"message": "Kit relinked", "master_kit_id": master.id}), 200

    @app.route("/api/aircraft-types/<int:aircraft_type_id>/master-kit", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_master_for_aircraft_type(aircraft_type_id):
        master = MasterKit.query.filter_by(
            aircraft_type_id=aircraft_type_id, is_active=True,
        ).first()
        if master is None:
            return jsonify({"master_kit": None}), 200
        return jsonify({"master_kit": master.to_dict(include_boxes=True, include_entries=True)}), 200

    @app.route("/api/master-kits/<int:master_kit_id>/usage", methods=["GET"])
    @jwt_required
    @handle_errors
    def master_kit_usage(master_kit_id):
        master = MasterKit.query.get_or_404(master_kit_id)
        kits = Kit.query.filter_by(master_kit_id=master.id).all()
        return jsonify({
            "master_kit_id": master.id,
            "kit_count": len(kits),
            "kits": [{"id": k.id, "name": k.name, "status": k.status} for k in kits],
        }), 200
