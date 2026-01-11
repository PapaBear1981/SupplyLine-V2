"""
Routes for Master Chemical management.

This module handles:
- Master chemical CRUD operations
- Warehouse-specific settings for chemicals (min/max stock levels)
"""

import json
import logging
from flask import jsonify, request
from sqlalchemy import or_

from auth import jwt_required, department_required
from models import (
    db,
    MasterChemical,
    ChemicalWarehouseSetting,
    Chemical,
    AuditLog,
    UserActivity,
)
from utils.validation import validate_schema, validate_master_chemical_reference, ValidationError
from utils.error_handler import handle_errors

logger = logging.getLogger(__name__)

materials_manager_required = department_required("Materials")


def register_master_chemical_routes(app):
    """Register all master chemical routes with the Flask app."""

    # ============================================================================
    # MASTER CHEMICALS CRUD
    # ============================================================================

    @app.route("/api/master-chemicals", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_master_chemicals():
        """Get all master chemicals with optional filtering."""
        # Query params
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 50, type=int)
        search = request.args.get("q", "").strip()
        category = request.args.get("category", "").strip()
        include_inactive = request.args.get("include_inactive", "false").lower() == "true"

        # Build query
        query = MasterChemical.query

        # Filter by active status
        if not include_inactive:
            query = query.filter(MasterChemical.is_active == True)

        # Search filter (part number, description, manufacturer, alternatives)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    MasterChemical.part_number.ilike(search_pattern),
                    MasterChemical.description.ilike(search_pattern),
                    MasterChemical.manufacturer.ilike(search_pattern),
                    MasterChemical.alternative_part_numbers.ilike(search_pattern),
                )
            )

        # Category filter
        if category:
            query = query.filter(MasterChemical.category == category)

        # Order by part number
        query = query.order_by(MasterChemical.part_number)

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            "master_chemicals": [mc.to_dict(include_inventory_count=True) for mc in pagination.items],
            "pagination": {
                "page": pagination.page,
                "per_page": pagination.per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
            }
        })

    @app.route("/api/master-chemicals/<int:id>", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_master_chemical(id):
        """Get single master chemical by ID."""
        master_chemical = MasterChemical.query.get_or_404(id)

        result = master_chemical.to_dict(include_inventory_count=True)

        # Include warehouse settings
        result["warehouse_settings"] = [
            setting.to_dict() for setting in master_chemical.warehouse_settings
        ]

        return jsonify(result)

    @app.route("/api/master-chemicals", methods=["POST"])
    @materials_manager_required
    @handle_errors
    def create_master_chemical():
        """Create new master chemical."""
        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")

        # Validate schema
        validated_data = validate_schema(data, "master_chemical")

        # Check for duplicate part number
        existing = MasterChemical.query.filter_by(
            part_number=validated_data["part_number"]
        ).first()
        if existing:
            raise ValidationError(
                f"Master chemical with part number '{validated_data['part_number']}' already exists"
            )

        # Serialize alternative part numbers to JSON
        alternatives = validated_data.get("alternative_part_numbers", [])
        if alternatives:
            validated_data["alternative_part_numbers"] = json.dumps(alternatives)

        # Create master chemical
        master_chemical = MasterChemical(
            part_number=validated_data["part_number"],
            description=validated_data["description"],
            manufacturer=validated_data.get("manufacturer"),
            category=validated_data.get("category", "General"),
            unit=validated_data["unit"],
            shelf_life_days=validated_data.get("shelf_life_days"),
            alternative_part_numbers=validated_data.get("alternative_part_numbers"),
            hazard_class=validated_data.get("hazard_class"),
            storage_requirements=validated_data.get("storage_requirements"),
            sds_link=validated_data.get("sds_link"),
            is_active=True,
            created_by_id=current_user_id,
        )

        db.session.add(master_chemical)
        db.session.flush()  # Get ID for logging

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="master_chemical_created",
            resource_type="master_chemical",
            resource_id=master_chemical.id,
            details={"part_number": master_chemical.part_number},
            ip_address=request.remote_addr,
        )

        # Log user activity
        if hasattr(request, "current_user"):
            activity = UserActivity(
                user_id=current_user_id,
                activity_type="master_chemical_created",
                description=f"Created master chemical {master_chemical.part_number}",
            )
            db.session.add(activity)

        db.session.commit()

        logger.info(
            f"Master chemical created: {master_chemical.part_number} (ID: {master_chemical.id})"
        )
        return jsonify(master_chemical.to_dict()), 201

    @app.route("/api/master-chemicals/<int:id>", methods=["PUT"])
    @materials_manager_required
    @handle_errors
    def update_master_chemical(id):
        """Update existing master chemical."""
        master_chemical = MasterChemical.query.get_or_404(id)
        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")

        # Validate schema
        validated_data = validate_schema(data, "master_chemical")

        # Check for duplicate part number (if changing)
        if validated_data["part_number"] != master_chemical.part_number:
            existing = MasterChemical.query.filter_by(
                part_number=validated_data["part_number"]
            ).first()
            if existing:
                raise ValidationError(
                    f"Master chemical with part number '{validated_data['part_number']}' already exists"
                )

        # Update fields
        master_chemical.part_number = validated_data["part_number"]
        master_chemical.description = validated_data["description"]
        master_chemical.manufacturer = validated_data.get("manufacturer")
        master_chemical.category = validated_data.get("category", "General")
        master_chemical.unit = validated_data["unit"]
        master_chemical.shelf_life_days = validated_data.get("shelf_life_days")

        # Update alternatives
        alternatives = validated_data.get("alternative_part_numbers", [])
        master_chemical.alternative_part_numbers = (
            json.dumps(alternatives) if alternatives else None
        )

        # Update safety fields
        master_chemical.hazard_class = validated_data.get("hazard_class")
        master_chemical.storage_requirements = validated_data.get("storage_requirements")
        master_chemical.sds_link = validated_data.get("sds_link")

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="master_chemical_updated",
            resource_type="master_chemical",
            resource_id=master_chemical.id,
            details={"part_number": master_chemical.part_number},
            ip_address=request.remote_addr,
        )

        # Log user activity
        if hasattr(request, "current_user"):
            activity = UserActivity(
                user_id=current_user_id,
                activity_type="master_chemical_updated",
                description=f"Updated master chemical {master_chemical.part_number}",
            )
            db.session.add(activity)

        db.session.commit()

        logger.info(f"Master chemical updated: {master_chemical.part_number}")
        return jsonify(master_chemical.to_dict())

    @app.route("/api/master-chemicals/<int:id>", methods=["DELETE"])
    @materials_manager_required
    @handle_errors
    def delete_master_chemical(id):
        """Delete (soft delete) master chemical."""
        master_chemical = MasterChemical.query.get_or_404(id)
        current_user_id = request.current_user.get("user_id")

        # Check for active inventory
        active_inventory_count = master_chemical.inventory_lots.filter(
            Chemical.is_archived == False
        ).count()

        if active_inventory_count > 0:
            raise ValidationError(
                f"Cannot delete master chemical '{master_chemical.part_number}' - "
                f"it has {active_inventory_count} active inventory lot(s). "
                f"Please archive all inventory lots first."
            )

        # Soft delete
        master_chemical.is_active = False

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="master_chemical_deactivated",
            resource_type="master_chemical",
            resource_id=master_chemical.id,
            details={"part_number": master_chemical.part_number},
            ip_address=request.remote_addr,
        )

        # Log user activity
        if hasattr(request, "current_user"):
            activity = UserActivity(
                user_id=current_user_id,
                activity_type="master_chemical_deactivated",
                description=f"Deactivated master chemical {master_chemical.part_number}",
            )
            db.session.add(activity)

        db.session.commit()

        logger.info(f"Master chemical deactivated: {master_chemical.part_number}")
        return jsonify({"message": "Master chemical deactivated successfully"}), 200

    # ============================================================================
    # WAREHOUSE SETTINGS
    # ============================================================================

    @app.route(
        "/api/master-chemicals/<int:master_chemical_id>/warehouse-settings",
        methods=["GET"],
    )
    @jwt_required
    @handle_errors
    def get_warehouse_settings(master_chemical_id):
        """Get all warehouse settings for a master chemical."""
        master_chemical = MasterChemical.query.get_or_404(master_chemical_id)

        settings = [s.to_dict() for s in master_chemical.warehouse_settings]
        return jsonify(settings)

    @app.route(
        "/api/master-chemicals/<int:master_chemical_id>/warehouse-settings",
        methods=["POST"],
    )
    @materials_manager_required
    @handle_errors
    def create_warehouse_setting(master_chemical_id):
        """Create warehouse setting for master chemical."""
        master_chemical = MasterChemical.query.get_or_404(master_chemical_id)
        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")

        # Add master_chemical_id to data
        data["master_chemical_id"] = master_chemical_id

        # Validate
        validated_data = validate_schema(data, "chemical_warehouse_setting")

        # Check for duplicate
        existing = ChemicalWarehouseSetting.query.filter_by(
            master_chemical_id=master_chemical_id,
            warehouse_id=validated_data["warehouse_id"],
        ).first()
        if existing:
            raise ValidationError(
                "Warehouse setting already exists for this chemical and warehouse"
            )

        # Create setting
        setting = ChemicalWarehouseSetting(
            master_chemical_id=master_chemical_id,
            warehouse_id=validated_data["warehouse_id"],
            minimum_stock_level=validated_data.get("minimum_stock_level"),
            maximum_stock_level=validated_data.get("maximum_stock_level"),
            preferred_location=validated_data.get("preferred_location"),
            notes=validated_data.get("notes"),
        )

        db.session.add(setting)

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="warehouse_setting_created",
            resource_type="chemical_warehouse_setting",
            resource_id=setting.id,
            details={
                "master_chemical": master_chemical.part_number,
                "warehouse_id": validated_data["warehouse_id"],
            },
            ip_address=request.remote_addr,
        )

        db.session.commit()

        logger.info(
            f"Warehouse setting created for {master_chemical.part_number}, warehouse {validated_data['warehouse_id']}"
        )
        return jsonify(setting.to_dict()), 201

    @app.route(
        "/api/master-chemicals/<int:master_chemical_id>/warehouse-settings/<int:setting_id>",
        methods=["PUT"],
    )
    @materials_manager_required
    @handle_errors
    def update_warehouse_setting(master_chemical_id, setting_id):
        """Update warehouse setting."""
        setting = ChemicalWarehouseSetting.query.get_or_404(setting_id)
        current_user_id = request.current_user.get("user_id")

        # Verify it belongs to the master chemical
        if setting.master_chemical_id != master_chemical_id:
            raise ValidationError("Setting does not belong to this master chemical")

        data = request.get_json() or {}
        data["master_chemical_id"] = master_chemical_id
        data["warehouse_id"] = setting.warehouse_id  # Can't change warehouse

        validated_data = validate_schema(data, "chemical_warehouse_setting")

        # Update
        setting.minimum_stock_level = validated_data.get("minimum_stock_level")
        setting.maximum_stock_level = validated_data.get("maximum_stock_level")
        setting.preferred_location = validated_data.get("preferred_location")
        setting.notes = validated_data.get("notes")

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="warehouse_setting_updated",
            resource_type="chemical_warehouse_setting",
            resource_id=setting.id,
            details={
                "master_chemical": setting.master_chemical.part_number,
                "warehouse_id": setting.warehouse_id,
            },
            ip_address=request.remote_addr,
        )

        db.session.commit()

        logger.info(f"Warehouse setting updated: ID {setting_id}")
        return jsonify(setting.to_dict())

    @app.route(
        "/api/master-chemicals/<int:master_chemical_id>/warehouse-settings/<int:setting_id>",
        methods=["DELETE"],
    )
    @materials_manager_required
    @handle_errors
    def delete_warehouse_setting(master_chemical_id, setting_id):
        """Delete warehouse setting."""
        setting = ChemicalWarehouseSetting.query.get_or_404(setting_id)
        current_user_id = request.current_user.get("user_id")

        # Verify it belongs to the master chemical
        if setting.master_chemical_id != master_chemical_id:
            raise ValidationError("Setting does not belong to this master chemical")

        # Log action before deletion
        AuditLog.log(
            user_id=current_user_id,
            action="warehouse_setting_deleted",
            resource_type="chemical_warehouse_setting",
            resource_id=setting.id,
            details={
                "master_chemical": setting.master_chemical.part_number,
                "warehouse_id": setting.warehouse_id,
            },
            ip_address=request.remote_addr,
        )

        db.session.delete(setting)
        db.session.commit()

        logger.info(f"Warehouse setting deleted: ID {setting_id}")
        return jsonify({"message": "Warehouse setting deleted successfully"}), 200
