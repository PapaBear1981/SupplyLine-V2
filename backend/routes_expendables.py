"""
Routes for Expendable Management (Kit-Only Consumables)

This module provides API endpoints for managing expendables - consumable items
that are added directly to kits without warehouse management.

Key features:
- Add expendables directly to kits with auto-generated lot/serial numbers
- Update expendable quantities and details
- Transfer expendables between kits
- Generate barcodes for lot/serial tracking
- Full audit trail via AuditLog

Policy:
- All expendables MUST have either a serial number OR a lot number for tracking
- The combination of part_number + serial/lot must be unique across the system
- Partial issuances of lot-tracked items create child lots for full traceability
- Serial-tracked items must be transferred/issued as whole items
"""

import logging
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from auth import department_required, jwt_required
from models import AuditLog, Expendable, LotNumberSequence, db
from models_kits import Kit, KitBox, KitExpendable, KitItem
from utils.error_handler import ValidationError, handle_errors
from utils.lot_utils import create_child_expendable, get_expendable_lot_lineage
from utils.serial_lot_validation import (
    SerialLotValidationError,
    check_lot_number_unique,
    check_serial_number_unique,
    validate_item_tracking,
    validate_serial_lot_required,
)


logger = logging.getLogger(__name__)

expendables_bp = Blueprint("expendables", __name__)

# Decorator for Materials department access
materials_required = department_required("Materials")


def generate_serial_number(part_number):
    """
    Generate a unique serial number for an expendable.
    Format: SN-{part_number}-{timestamp}

    Args:
        part_number (str): Part number of the expendable

    Returns:
        str: Generated serial number
    """
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"SN-{part_number}-{timestamp}"


@expendables_bp.route("/kits/<int:kit_id>/expendables", methods=["POST"])
@materials_required
@handle_errors
def add_expendable_to_kit(kit_id):
    """
    Add a new expendable directly to a kit.

    Required fields:
        - box_id: ID of the box within the kit
        - part_number: Part number of the expendable
        - description: Description of the expendable
        - quantity: Quantity to add
        - unit: Unit of measurement (each, oz, ml, ft, etc.)
        - tracking_type: 'lot' or 'serial' (REQUIRED - all items must be tracked)

    Optional fields:
        - lot_number: Lot number (auto-generated if not provided and tracking_type='lot')
        - serial_number: Serial number (auto-generated if not provided and tracking_type='serial')
        - manufacturer: Manufacturer name
        - location: Location within the box
        - category: Category (default: 'General')
        - minimum_stock_level: Minimum stock level for reorder alerts
        - notes: Additional notes

    Policy:
        - All expendables must have either a lot number or serial number
        - The combination of part_number + lot/serial must be unique across the system
    """
    kit = Kit.query.get_or_404(kit_id)
    data = request.get_json() or {}

    # Validate required fields
    required_fields = ["box_id", "part_number", "description", "quantity", "unit", "tracking_type"]
    for field in required_fields:
        if not data.get(field):
            raise ValidationError(f"Missing required field: {field}")

    # Validate box belongs to kit
    box = KitBox.query.get_or_404(data["box_id"])
    if box.kit_id != kit_id:
        raise ValidationError("Box does not belong to this kit")

    # Validate tracking type - 'none' is no longer allowed
    tracking_type = data["tracking_type"].lower()
    if tracking_type not in ["lot", "serial"]:
        raise ValidationError(
            "tracking_type must be 'lot' or 'serial'. All expendables must be tracked for audit purposes."
        )

    part_number = data["part_number"].strip()

    # Auto-generate lot or serial number if not provided
    if tracking_type == "lot":
        lot_number = data.get("lot_number")
        if not lot_number:
            lot_number = LotNumberSequence.generate_lot_number()
        else:
            lot_number = lot_number.strip()
        serial_number = None

        # Validate lot number uniqueness across the system
        try:
            check_lot_number_unique(part_number, lot_number)
        except SerialLotValidationError as e:
            raise ValidationError(str(e))

    else:  # serial
        serial_number = data.get("serial_number")
        if not serial_number:
            serial_number = generate_serial_number(part_number)
        else:
            serial_number = serial_number.strip()
        lot_number = None

        # Validate serial number uniqueness across the system
        try:
            check_serial_number_unique(part_number, serial_number)
        except SerialLotValidationError as e:
            raise ValidationError(str(e))

    logger.info(f"Creating expendable {part_number} with {tracking_type}={lot_number or serial_number}")

    try:
        # Create expendable (warehouse_id will be forced to None in __init__)
        expendable = Expendable(
            part_number=data["part_number"],
            serial_number=serial_number,
            lot_number=lot_number,
            description=data["description"],
            manufacturer=data.get("manufacturer"),
            quantity=float(data["quantity"]),
            unit=data["unit"],
            location=data.get("location"),
            category=data.get("category", "General"),
            status="available",
            minimum_stock_level=data.get("minimum_stock_level"),
            notes=data.get("notes")
        )

        db.session.add(expendable)
        db.session.flush()  # Get expendable ID

        # Create KitItem to link expendable to kit
        kit_item = KitItem(
            kit_id=kit_id,
            box_id=data["box_id"],
            item_type="expendable",
            item_id=expendable.id,
            part_number=expendable.part_number,
            serial_number=expendable.serial_number,
            lot_number=expendable.lot_number,
            description=expendable.description,
            quantity=expendable.quantity,
            location=expendable.location,
            status="available",
            added_date=datetime.now(),
            last_updated=datetime.now()
        )

        db.session.add(kit_item)

        # Log action
        log = AuditLog(
            action_type="expendable_added_to_kit",
            action_details=f"Added expendable {expendable.part_number} ({tracking_type}={lot_number or serial_number}) to kit {kit.name}, box {box.box_number}"
        )
        db.session.add(log)

        db.session.commit()

        logger.info(f"Successfully added expendable {expendable.id} to kit {kit_id}")

        return jsonify({
            "message": "Expendable added to kit successfully",
            "expendable": expendable.to_dict(),
            "kit_item": kit_item.to_dict()
        }), 201

    except ValueError as e:
        db.session.rollback()
        raise ValidationError(str(e))
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding expendable to kit: {e}")
        raise


@expendables_bp.route("/kits/<int:kit_id>/expendables/<int:expendable_id>", methods=["PUT"])
@materials_required
@handle_errors
def update_expendable(kit_id, expendable_id):
    """
    Update an expendable in a kit.

    Updatable fields:
        - quantity: Update quantity
        - location: Update location within box
        - status: Update status (available, low_stock, out_of_stock)
        - minimum_stock_level: Update minimum stock level
        - notes: Update notes
    """
    kit = Kit.query.get_or_404(kit_id)
    expendable = Expendable.query.get_or_404(expendable_id)

    # Verify expendable is in this kit
    kit_item = KitItem.query.filter_by(
        kit_id=kit_id,
        item_type="expendable",
        item_id=expendable_id
    ).first()

    if not kit_item:
        raise ValidationError("Expendable not found in this kit")

    data = request.get_json() or {}

    # Update allowed fields
    if "quantity" in data:
        old_quantity = expendable.quantity
        expendable.quantity = float(data["quantity"])
        kit_item.quantity = expendable.quantity
        logger.info(f"Updated expendable {expendable_id} quantity from {old_quantity} to {expendable.quantity}")

    if "location" in data:
        expendable.location = data["location"]
        kit_item.location = data["location"]

    if "status" in data:
        expendable.status = data["status"]
        kit_item.status = data["status"]

    if "minimum_stock_level" in data:
        expendable.minimum_stock_level = data.get("minimum_stock_level")

    if "notes" in data:
        expendable.notes = data["notes"]

    kit_item.last_updated = datetime.now()

    # Log action
    log = AuditLog(
        action_type="expendable_updated",
        action_details=f"Updated expendable {expendable.part_number} in kit {kit.name}"
    )
    db.session.add(log)

    db.session.commit()

    return jsonify({
        "message": "Expendable updated successfully",
        "expendable": expendable.to_dict(),
        "kit_item": kit_item.to_dict()
    }), 200


@expendables_bp.route("/kits/<int:kit_id>/expendables/<int:expendable_id>", methods=["DELETE"])
@materials_required
@handle_errors
def remove_expendable_from_kit(kit_id, expendable_id):
    """
    Remove an expendable from a kit.
    This deletes both the KitItem and the Expendable record.
    """
    kit = Kit.query.get_or_404(kit_id)
    expendable = Expendable.query.get_or_404(expendable_id)

    # Verify expendable is in this kit
    kit_item = KitItem.query.filter_by(
        kit_id=kit_id,
        item_type="expendable",
        item_id=expendable_id
    ).first()

    if not kit_item:
        raise ValidationError("Expendable not found in this kit")

    # Log action before deletion
    log = AuditLog(
        action_type="expendable_removed_from_kit",
        action_details=f"Removed expendable {expendable.part_number} from kit {kit.name}"
    )
    db.session.add(log)

    # Delete KitItem and Expendable
    db.session.delete(kit_item)
    db.session.delete(expendable)

    db.session.commit()

    logger.info(f"Removed expendable {expendable_id} from kit {kit_id}")

    return jsonify({"message": "Expendable removed from kit successfully"}), 200



@expendables_bp.route("/inventory/expendable/<int:expendable_id>/detail", methods=["GET"])
@jwt_required
def get_expendable_detail(expendable_id):
    """
    Get detailed information about an expendable.

    Args:
        expendable_id (int): ID of the expendable

    Returns:
        JSON response with expendable details
    """
    expendable = Expendable.query.get_or_404(expendable_id)

    # Get all kit items that reference this expendable
    kit_items = KitItem.query.filter_by(item_type="expendable", item_id=expendable.id).all()

    # Build kit locations list
    kit_locations = []
    for kit_item in kit_items:
        kit = db.session.get(Kit, kit_item.kit_id)
        box = db.session.get(KitBox, kit_item.box_id) if kit_item.box_id else None
        kit_locations.append({
            "kit_id": kit.id,
            "kit_name": kit.name,
            "box_id": box.id if box else None,
            "box_number": box.box_number if box else None,
            "quantity": kit_item.quantity,
            "status": kit_item.status
        })

    return jsonify({
        "id": expendable.id,
        "part_number": expendable.part_number,
        "description": expendable.description,
        "manufacturer": expendable.manufacturer,
        "serial_number": expendable.serial_number,
        "lot_number": expendable.lot_number,
        "tracking_type": "serial" if expendable.serial_number else "lot",
        "quantity": expendable.quantity,
        "unit": expendable.unit,
        "location": expendable.location,
        "category": expendable.category,
        "status": expendable.status,
        "warehouse_id": expendable.warehouse_id,
        "date_added": expendable.date_added.isoformat() if expendable.date_added else None,
        "minimum_stock_level": expendable.minimum_stock_level,
        "notes": expendable.notes,
        "kit_locations": kit_locations
    }), 200


@expendables_bp.route("/expendables/<int:expendable_id>/barcode", methods=["GET"])
@jwt_required
def get_expendable_barcode(expendable_id):
    """
    Get barcode data for an expendable.
    Returns barcode string and QR code URL for printing labels.
    """
    expendable = Expendable.query.get_or_404(expendable_id)

    # Create barcode data - use lot_number or serial_number
    if expendable.lot_number:
        barcode_data = f"{expendable.part_number}-LOT-{expendable.lot_number}"
    else:
        barcode_data = f"{expendable.part_number}-{expendable.serial_number}"

    # Get the base URL for QR code
    base_url = current_app.config.get("PUBLIC_URL")
    base_url = request.host_url.rstrip("/") if not base_url else base_url.rstrip("/")

    # Create QR code URL that points to the expendable view page
    qr_url = f"{base_url}/expendable-view/{expendable.id}"

    return jsonify({
        "barcode_data": barcode_data,
        "qr_url": qr_url,
        "part_number": expendable.part_number,
        "lot_number": expendable.lot_number,
        "serial_number": expendable.serial_number,
        "description": expendable.description,
        "quantity": expendable.quantity,
        "unit": expendable.unit,
        "location": expendable.location,
        "category": expendable.category,
        "date_added": expendable.date_added.isoformat() if expendable.date_added else None
    }), 200


@expendables_bp.route("/transfers/kit-to-kit/expendable", methods=["POST"])
@materials_required
@handle_errors
def transfer_expendable_between_kits():
    """
    Transfer an expendable from one kit to another.

    Required fields:
        - from_kit_id: Source kit ID
        - to_kit_id: Destination kit ID
        - to_box_id: Destination box ID within the destination kit
        - expendable_id: ID of the expendable to transfer

    Optional fields:
        - quantity: Quantity to transfer (for partial transfers of lot-tracked items)
        - location: New location within the destination box
        - notes: Transfer notes

    Policy:
        - Serial-tracked expendables must be transferred as whole items
        - Partial transfers of lot-tracked items create child lots for traceability
    """
    data = request.get_json() or {}

    # Validate required fields
    required_fields = ["from_kit_id", "to_kit_id", "to_box_id", "expendable_id"]
    for field in required_fields:
        if not data.get(field):
            raise ValidationError(f"Missing required field: {field}")

    # Get kits and box
    from_kit = Kit.query.get_or_404(data["from_kit_id"])
    to_kit = Kit.query.get_or_404(data["to_kit_id"])
    to_box = KitBox.query.get_or_404(data["to_box_id"])

    # Validate box belongs to destination kit
    if to_box.kit_id != to_kit.id:
        raise ValidationError("Box does not belong to the destination kit")

    # Get expendable and verify it's in the source kit
    expendable = Expendable.query.get_or_404(data["expendable_id"])

    from_kit_item = KitItem.query.filter_by(
        kit_id=from_kit.id,
        item_type="expendable",
        item_id=expendable.id
    ).first()

    if not from_kit_item:
        raise ValidationError("Expendable not found in source kit")

    # Validate tracking - all expendables must have serial or lot number
    try:
        validate_serial_lot_required(expendable.serial_number, expendable.lot_number, "expendable")
    except SerialLotValidationError as e:
        raise ValidationError(str(e))

    # Get transfer quantity (default to full quantity)
    transfer_quantity = data.get("quantity", expendable.quantity)
    try:
        transfer_quantity = float(transfer_quantity)
    except (ValueError, TypeError):
        raise ValidationError("Quantity must be a valid number")

    if transfer_quantity <= 0:
        raise ValidationError("Quantity must be greater than zero")

    if transfer_quantity > expendable.quantity:
        raise ValidationError(f"Insufficient quantity. Available: {expendable.quantity}")

    # Determine tracking type
    tracking_type = "serial" if expendable.serial_number else "lot"
    tracking_id = expendable.serial_number or expendable.lot_number

    # Serial-tracked items must be transferred as whole items
    if tracking_type == "serial" and transfer_quantity != expendable.quantity:
        raise ValidationError(
            f"Serial-tracked expendables must be transferred as whole items. "
            f"Cannot partially transfer serial number '{expendable.serial_number}'."
        )

    is_partial_transfer = transfer_quantity < expendable.quantity
    child_lot_info = None

    if is_partial_transfer and tracking_type == "lot":
        # Create a KitExpendable (child lot) in the destination kit
        # First we need to find or create a KitExpendable record for the source
        source_kit_exp = KitExpendable.query.filter_by(
            kit_id=from_kit.id,
            part_number=expendable.part_number,
            lot_number=expendable.lot_number
        ).first()

        if source_kit_exp:
            # Create child from existing KitExpendable
            child_expendable = create_child_expendable(
                parent_expendable=source_kit_exp,
                quantity=transfer_quantity,
                destination_kit_id=to_kit.id,
                destination_box_id=to_box.id
            )
            db.session.add(child_expendable)

            # Update source KitItem to reflect reduced quantity
            from_kit_item.quantity -= transfer_quantity
            if from_kit_item.quantity <= 0:
                db.session.delete(from_kit_item)

            child_lot_info = {
                "child_lot_number": child_expendable.lot_number,
                "parent_lot_number": expendable.lot_number,
                "quantity": transfer_quantity
            }

            # Log child lot creation
            log_child = AuditLog(
                action_type="expendable_child_lot_created",
                action_details=f"Child lot {child_expendable.lot_number} created from {expendable.lot_number} during kit-to-kit transfer: {transfer_quantity} {expendable.unit}"
            )
            db.session.add(log_child)
        else:
            # No KitExpendable exists, just transfer the Expendable record
            # This shouldn't happen in normal flow, but handle gracefully
            raise ValidationError(
                "Cannot perform partial transfer - source expendable tracking record not found. "
                "Please transfer the full quantity or add the item to a kit first."
            )
    else:
        # Full transfer - remove from source kit
        db.session.delete(from_kit_item)

        # Validate uniqueness in destination kit for full transfer
        existing_in_dest = KitItem.query.filter_by(
            kit_id=to_kit.id,
            item_type="expendable",
            part_number=expendable.part_number
        ).first()

        if existing_in_dest:
            if tracking_type == "lot" and existing_in_dest.lot_number == expendable.lot_number:
                raise ValidationError(
                    f"An expendable with part number '{expendable.part_number}' and lot number "
                    f"'{expendable.lot_number}' already exists in kit '{to_kit.name}'."
                )
            if tracking_type == "serial" and existing_in_dest.serial_number == expendable.serial_number:
                raise ValidationError(
                    f"An expendable with part number '{expendable.part_number}' and serial number "
                    f"'{expendable.serial_number}' already exists in kit '{to_kit.name}'."
                )

        # Add to destination kit
        to_kit_item = KitItem(
            kit_id=to_kit.id,
            box_id=to_box.id,
            item_type="expendable",
            item_id=expendable.id,
            part_number=expendable.part_number,
            serial_number=expendable.serial_number,
            lot_number=expendable.lot_number,
            description=expendable.description,
            quantity=transfer_quantity,
            location=data.get("location", expendable.location),
            status="available",
            added_date=datetime.now(),
            last_updated=datetime.now()
        )

        db.session.add(to_kit_item)

        # Update expendable location if provided
        if "location" in data:
            expendable.location = data["location"]

    # Log action
    log = AuditLog(
        action_type="expendable_transferred_between_kits",
        action_details=f"Transferred expendable {expendable.part_number} ({tracking_type}={tracking_id}) qty {transfer_quantity} from kit {from_kit.name} to kit {to_kit.name}, box {to_box.box_number}"
    )
    db.session.add(log)

    db.session.commit()

    logger.info(f"Transferred expendable {expendable.id} from kit {from_kit.id} to kit {to_kit.id}")

    response = {
        "message": "Expendable transferred successfully",
        "expendable": expendable.to_dict(),
        "from_kit": from_kit.name,
        "to_kit": to_kit.name,
        "to_box": to_box.box_number,
        "quantity_transferred": transfer_quantity,
        "is_partial_transfer": is_partial_transfer
    }

    if child_lot_info:
        response["child_lot"] = child_lot_info
        response["message"] = f"Expendable transferred with child lot {child_lot_info['child_lot_number']} created for traceability."

    return jsonify(response), 200


@expendables_bp.route("/expendables/<int:expendable_id>/lineage", methods=["GET"])
@jwt_required
@handle_errors
def get_expendable_lineage(expendable_id):
    """
    Get the lot lineage for an expendable (parent and children).

    This endpoint allows users to trace a lot back to its origin or see
    all child lots that have been created from partial issuances.

    Returns:
        JSON object with:
        - current: The expendable's details
        - parent: Parent lot details (if this is a child lot)
        - children: List of child lots created from this lot
        - siblings: Other lots created from the same parent
    """
    # First check if it's a KitExpendable
    kit_expendable = KitExpendable.query.get(expendable_id)
    if kit_expendable:
        lineage = get_expendable_lot_lineage(kit_expendable)
        return jsonify(lineage), 200

    # Then check if it's an Expendable
    expendable = Expendable.query.get_or_404(expendable_id)

    # Build a simplified lineage response for Expendable model
    response = {
        "current": expendable.to_dict(),
        "parent": None,
        "children": [],
        "siblings": []
    }

    return jsonify(response), 200

