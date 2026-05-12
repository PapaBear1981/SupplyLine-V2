"""
Routes for Kit Reorder Request Management

This module provides API endpoints for managing reorder requests for kits.
"""

import logging
import os
from datetime import datetime

from flask import current_app, jsonify, request

from auth import department_required, jwt_required
from models import AuditLog, ProcurementOrder, db
from models_kits import Kit, KitBox, KitReorderRequest
from utils.error_handler import ValidationError, handle_errors
from utils.file_validation import FileValidationError, validate_image_upload


logger = logging.getLogger(__name__)

materials_required = department_required("Materials")


def register_kit_reorder_routes(app):
    """Register all kit reorder routes"""

    @app.route("/api/kits/<int:kit_id>/reorder", methods=["POST"])
    @jwt_required
    @handle_errors
    def create_reorder_request(kit_id):
        """Create a reorder request for a kit (supports both JSON and multipart/form-data for image uploads)"""
        kit = Kit.query.get_or_404(kit_id)
        current_user_id = request.current_user.get("user_id")

        # Check if this is a multipart request (with image) or JSON
        if request.content_type and "multipart/form-data" in request.content_type:
            # Handle multipart form data (with image)
            data = request.form.to_dict()
            image_file = request.files.get("image")
        else:
            # Handle JSON data (no image)
            data = request.get_json() or {}
            image_file = None

        # Validate required fields
        if not data.get("part_number"):
            raise ValidationError("Part number is required")
        if not data.get("description"):
            raise ValidationError("Description is required")
        if not data.get("quantity_requested"):
            raise ValidationError("Quantity requested is required")

        # Handle image upload if provided
        image_path = None
        if image_file and image_file.filename:
            try:
                max_size = current_app.config.get("MAX_REORDER_IMAGE_SIZE", 5 * 1024 * 1024)  # 5MB default
                safe_filename = validate_image_upload(image_file, max_size=max_size)

                # Create reorder_images directory if it doesn't exist
                static_folder = current_app.static_folder or os.path.join(os.path.dirname(__file__), "static")
                upload_dir = os.path.join(static_folder, "reorder_images")
                os.makedirs(upload_dir, exist_ok=True)

                # Save the file
                file_path = os.path.join(upload_dir, safe_filename)
                image_file.save(file_path)

                # Store relative path
                image_path = f"/api/static/reorder_images/{safe_filename}"
                logger.info("Saved reorder request image", extra={"image_path": image_path})
            except FileValidationError as exc:
                raise ValidationError(f"Image upload failed: {exc!s}")

        # Create reorder request
        reorder = KitReorderRequest(
            kit_id=kit_id,
            item_type=data.get("item_type", "expendable"),
            item_id=data.get("item_id"),
            part_number=data["part_number"],
            description=data["description"],
            quantity_requested=float(data["quantity_requested"]),
            priority=data.get("priority", "medium"),
            requested_by=request.current_user["user_id"],
            status="pending",
            notes=data.get("notes", ""),
            is_automatic=False,
            image_path=image_path
        )

        db.session.add(reorder)
        db.session.flush()  # Get the ID before creating unified request

        # Create unified request for the kit reorder
        from utils.unified_requests import create_kit_reorder_request
        user_request = create_kit_reorder_request(
            kit=kit,
            reorder_request=reorder,
            requester_id=request.current_user["user_id"]
        )

        db.session.commit()

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="kit_reorder_requested",
            resource_type="kit_reorder",
            resource_id=reorder.id,
            details={
                "kit_id": kit.id,
                "kit_name": kit.name,
                "part_number": reorder.part_number,
                "request_number": user_request.request_number,
                "has_image": image_path is not None
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        logger.info("Reorder request created", extra={"reorder_id": reorder.id, "request_number": user_request.request_number})
        result = reorder.to_dict()
        result["user_request"] = user_request.to_dict()
        return jsonify(result), 201

    @app.route("/api/reorder-requests", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_reorder_requests():
        """Get all reorder requests with optional filtering"""
        kit_id = request.args.get("kit_id", type=int)
        status = request.args.get("status")
        priority = request.args.get("priority")
        is_automatic = request.args.get("is_automatic")

        query = KitReorderRequest.query

        if kit_id:
            query = query.filter_by(kit_id=kit_id)
        if status:
            query = query.filter_by(status=status)
        if priority:
            query = query.filter_by(priority=priority)
        if is_automatic is not None:
            query = query.filter_by(is_automatic=is_automatic.lower() == "true")

        reorders = query.order_by(
            KitReorderRequest.priority.desc(),
            KitReorderRequest.requested_date.desc()
        ).all()

        return jsonify([reorder.to_dict() for reorder in reorders]), 200

    @app.route("/api/reorder-requests/<int:id>", methods=["GET"])
    @jwt_required
    @handle_errors
    def get_reorder_request(id):
        """Get reorder request details"""
        reorder = KitReorderRequest.query.get_or_404(id)
        return jsonify(reorder.to_dict()), 200

    @app.route("/api/reorder-requests/<int:id>/approve", methods=["PUT"])
    @materials_required
    @handle_errors
    def approve_reorder_request(id):
        """Approve a reorder request and create procurement order"""
        current_user_id = request.current_user.get("user_id")
        reorder = KitReorderRequest.query.get_or_404(id)

        if reorder.status != "pending":
            raise ValidationError("Can only approve pending requests")

        reorder.status = "ordered"
        reorder.approved_by = request.current_user["user_id"]
        reorder.approved_date = datetime.now()

        # Create a ProcurementOrder to track this on the Orders page
        # Map kit reorder priority to procurement order priority
        priority_map = {
            "low": "low",
            "medium": "normal",
            "high": "high",
            "urgent": "critical"
        }
        procurement_priority = priority_map.get(reorder.priority, "normal")

        procurement_order = ProcurementOrder(
            title=f"Kit Reorder: {reorder.part_number}",
            order_type=reorder.item_type,
            part_number=reorder.part_number,
            description=reorder.description,
            priority=procurement_priority,
            status="new",
            reference_type="kit_reorder",
            reference_number=str(reorder.id),
            notes=f"Auto-created from kit reorder request #{reorder.id}. {reorder.notes or ''}",
            quantity=int(reorder.quantity_requested) if reorder.quantity_requested else 1,
            unit="ea",
            kit_id=reorder.kit_id,
            requester_id=reorder.requested_by,
            buyer_id=request.current_user["user_id"]
        )
        db.session.add(procurement_order)

        # Update the unified request system if a request item exists for this kit reorder
        from utils.unified_requests import update_request_item_status
        update_request_item_status(
            source_type="kit_reorder",
            source_id=reorder.id,
            new_status="ordered",
            ordered_date=datetime.now(),
            order_notes=f"Procurement Order #{procurement_order.id}"
        )

        db.session.commit()

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="kit_reorder_approved",
            resource_type="kit_reorder",
            resource_id=reorder.id,
            details={
                "procurement_order_id": procurement_order.id,
                "kit_id": reorder.kit_id,
                "part_number": reorder.part_number
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        logger.info("Created procurement order on approval", extra={
            "reorder_id": reorder.id,
            "procurement_order_id": procurement_order.id
        })

        return jsonify(reorder.to_dict()), 200

    @app.route("/api/reorder-requests/<int:id>/order", methods=["PUT"])
    @materials_required
    @handle_errors
    def mark_reorder_ordered(id):
        """Mark a reorder request as ordered"""
        current_user_id = request.current_user.get("user_id")
        reorder = KitReorderRequest.query.get_or_404(id)

        if reorder.status not in ["pending", "approved"]:
            raise ValidationError("Can only mark pending or approved requests as ordered")

        reorder.status = "ordered"

        # Create a ProcurementOrder to track this on the Orders page
        # Map kit reorder priority to procurement order priority
        priority_map = {
            "low": "low",
            "medium": "normal",
            "high": "high",
            "urgent": "critical"
        }
        procurement_priority = priority_map.get(reorder.priority, "normal")

        procurement_order = ProcurementOrder(
            title=f"Kit Reorder: {reorder.part_number}",
            order_type=reorder.item_type,
            part_number=reorder.part_number,
            description=reorder.description,
            priority=procurement_priority,
            status="new",
            reference_type="kit_reorder",
            reference_number=str(reorder.id),
            notes=f"Auto-created from kit reorder request #{reorder.id}. {reorder.notes or ''}",
            quantity=int(reorder.quantity_requested) if reorder.quantity_requested else 1,
            unit="ea",
            kit_id=reorder.kit_id,
            requester_id=reorder.requested_by,
            buyer_id=request.current_user["user_id"]
        )
        db.session.add(procurement_order)

        # Update the unified request system if a request item exists for this kit reorder
        from utils.unified_requests import update_request_item_status
        update_request_item_status(
            source_type="kit_reorder",
            source_id=reorder.id,
            new_status="ordered",
            ordered_date=datetime.now(),
            order_notes=f"Procurement Order #{procurement_order.id}"
        )

        db.session.commit()

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="kit_reorder_ordered",
            resource_type="kit_reorder",
            resource_id=reorder.id,
            details={
                "procurement_order_id": procurement_order.id,
                "kit_id": reorder.kit_id,
                "part_number": reorder.part_number
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        logger.info("Created procurement order for kit reorder", extra={
            "reorder_id": reorder.id,
            "procurement_order_id": procurement_order.id
        })

        return jsonify(reorder.to_dict()), 200

    @app.route("/api/reorder-requests/<int:id>/fulfill", methods=["PUT"])
    @materials_required
    @handle_errors
    def fulfill_reorder_request(id):
        """Mark a reorder request as fulfilled"""
        from utils.kit_fulfillment import restore_kit_from_reorder

        current_user_id = request.current_user.get("user_id")
        reorder = KitReorderRequest.query.get_or_404(id)

        logger.info("Fulfilling reorder request", extra={
            "reorder_id": id,
            "item_type": reorder.item_type,
            "item_id": reorder.item_id,
            "status": reorder.status
        })

        data = request.get_json(silent=True) or {}
        box_id = data.get("box_id")

        restore_kit_from_reorder(
            reorder,
            box_id=box_id,
            current_user_id=current_user_id,
            remote_addr=request.remote_addr,
        )

        # Resolve the box used (re-query in case helper picked the default)
        box = KitBox.query.filter_by(id=box_id, kit_id=reorder.kit_id).first() if box_id else (
            KitBox.query.filter_by(kit_id=reorder.kit_id).order_by(KitBox.box_number).first()
        )

        # Update the unified request system if a request item exists for this kit reorder
        from utils.unified_requests import update_request_item_status
        update_request_item_status(
            source_type="kit_reorder",
            source_id=reorder.id,
            new_status="received",
            received_date=datetime.now(),
            received_quantity=int(reorder.quantity_requested),
        )

        db.session.commit()

        AuditLog.log(
            user_id=current_user_id,
            action="kit_reorder_fulfilled",
            resource_type="kit_reorder",
            resource_id=reorder.id,
            details={
                "kit_id": reorder.kit_id,
                "box_id": box.id if box else None,
                "box_number": box.box_number if box else None,
                "item_type": reorder.item_type,
            },
            ip_address=request.remote_addr,
        )
        db.session.commit()

        return jsonify(reorder.to_dict()), 200

    @app.route("/api/reorder-requests/<int:id>/cancel", methods=["PUT"])
    @jwt_required
    @handle_errors
    def cancel_reorder_request(id):
        """Cancel a reorder request"""
        current_user_id = request.current_user.get("user_id")
        reorder = KitReorderRequest.query.get_or_404(id)

        if reorder.status in ["fulfilled", "cancelled"]:
            raise ValidationError("Cannot cancel fulfilled or already cancelled requests")

        # Check if user has permission to cancel
        user_id = request.current_user["user_id"]
        is_admin = request.current_user.get("is_admin", False)
        is_materials = request.current_user.get("department") == "Materials"

        if not (is_admin or is_materials or reorder.requested_by == user_id):
            raise ValidationError("You do not have permission to cancel this request")

        reorder.status = "cancelled"

        db.session.commit()

        # Log action
        AuditLog.log(
            user_id=current_user_id,
            action="kit_reorder_cancelled",
            resource_type="kit_reorder",
            resource_id=reorder.id,
            details={
                "kit_id": reorder.kit_id,
                "part_number": reorder.part_number
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        return jsonify(reorder.to_dict()), 200

    @app.route("/api/reorder-requests/<int:id>", methods=["PUT"])
    @jwt_required
    @handle_errors
    def update_reorder_request(id):
        """Update a reorder request"""
        reorder = KitReorderRequest.query.get_or_404(id)
        data = request.get_json() or {}

        # Only allow updates to pending requests
        if reorder.status != "pending":
            raise ValidationError("Can only update pending requests")

        # Check if user has permission to update
        user_id = request.current_user["user_id"]
        is_admin = request.current_user.get("is_admin", False)
        is_materials = request.current_user.get("department") == "Materials"

        if not (is_admin or is_materials or reorder.requested_by == user_id):
            raise ValidationError("You do not have permission to update this request")

        # Update fields
        if "quantity_requested" in data:
            reorder.quantity_requested = float(data["quantity_requested"])
        if "priority" in data:
            reorder.priority = data["priority"]
        if "notes" in data:
            reorder.notes = data["notes"]

        db.session.commit()

        return jsonify(reorder.to_dict()), 200
