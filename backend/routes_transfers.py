"""
Warehouse transfer routes.
Handles transfers between warehouses and kits.

The warehouse-to-warehouse flow is a two-step process:

    1. ``POST /api/transfers/initiate`` — the source-warehouse user creates
       a transfer record with status ``pending_receipt``. The item's
       ``warehouse_id`` is **not** reassigned at this point.
    2. ``POST /api/transfers/<id>/receive`` — the destination-warehouse user
       acknowledges receipt, assigns a destination location, and the item's
       ``warehouse_id`` flips to the destination.

Cancellation (``POST /api/transfers/<id>/cancel``) is a no-op on inventory.
"""

import logging
from datetime import datetime

from flask import Blueprint, jsonify, request

from auth import jwt_required
from auth.jwt_manager import permission_required
from models import AuditLog, Chemical, Tool, ToolHistory, User, Warehouse, WarehouseTransfer, db
from models_kits import Kit, KitBox, KitItem
from utils.lot_utils import create_child_chemical
from utils.transaction_helper import record_transaction
from utils.warehouse_scope import get_active_warehouse_id


logger = logging.getLogger(__name__)

transfers_bp = Blueprint("transfers", __name__)


STATUS_PENDING = "pending_receipt"
STATUS_RECEIVED = "received"
STATUS_CANCELLED = "cancelled"
STATUS_COMPLETED = "completed"  # legacy + kit transfers


def _user_has_permission(permission_name):
    payload = getattr(request, "current_user", None) or {}
    if payload.get("is_admin"):
        return True
    return permission_name in (payload.get("permissions") or [])


def _current_user_id():
    payload = getattr(request, "current_user", None) or {}
    return payload.get("user_id")


def _load_tool_or_chemical(item_type, item_id):
    if item_type == "tool":
        return db.session.get(Tool, item_id)
    if item_type == "chemical":
        return db.session.get(Chemical, item_id)
    return None


@transfers_bp.route("/transfers/warehouse-to-kit", methods=["POST"])
@jwt_required
def transfer_warehouse_to_kit():
    """
    Transfer a tool or chemical from warehouse to kit.
    Required fields:
        - from_warehouse_id: Source warehouse ID
        - to_kit_id: Destination kit ID
        - box_id: Destination box ID within the kit
        - item_type: 'tool' or 'chemical'
        - item_id: ID of the tool or chemical
        - quantity: Quantity to transfer (default: 1)
        - location: Optional location within the box
        - notes: Optional transfer notes
    """
    try:
        data = request.get_json()
        current_user_id = request.current_user.get("user_id")

        # Validate required fields
        required_fields = ["from_warehouse_id", "to_kit_id", "box_id", "item_type", "item_id"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Validate item_type
        if data["item_type"] not in ["tool", "chemical"]:
            return jsonify({"error": 'item_type must be "tool" or "chemical"'}), 400

        # Get warehouse, kit, and box
        warehouse = db.session.get(Warehouse, data["from_warehouse_id"])
        kit = db.session.get(Kit, data["to_kit_id"])
        box = db.session.get(KitBox, data["box_id"])

        if not warehouse:
            return jsonify({"error": "Warehouse not found"}), 404
        if not kit:
            return jsonify({"error": "Kit not found"}), 404
        if not box:
            return jsonify({"error": "Box not found"}), 404
        if box.kit_id != kit.id:
            return jsonify({"error": "Box does not belong to the specified kit"}), 400

        # Get the item
        if data["item_type"] == "tool":
            item = db.session.get(Tool, data["item_id"])
            if not item:
                return jsonify({"error": "Tool not found"}), 404
            if item.warehouse_id != warehouse.id:
                return jsonify({"error": "Tool is not in the specified warehouse"}), 400

            # Create kit item
            kit_item = KitItem(
                kit_id=kit.id,
                box_id=box.id,
                item_type="tool",
                item_id=item.id,
                part_number=item.tool_number,
                serial_number=item.serial_number,
                description=item.description,
                quantity=data.get("quantity", 1),
                location=data.get("location"),
                status="available",
                added_date=datetime.now(),
                last_updated=datetime.now()
            )

            # Remove from warehouse
            item.warehouse_id = None

        else:  # chemical
            item = db.session.get(Chemical, data["item_id"])
            if not item:
                return jsonify({"error": "Chemical not found"}), 404
            if item.warehouse_id != warehouse.id:
                return jsonify({"error": "Chemical is not in the specified warehouse"}), 400

            # Create kit item
            kit_item = KitItem(
                kit_id=kit.id,
                box_id=box.id,
                item_type="chemical",
                item_id=item.id,
                part_number=item.part_number,
                lot_number=item.lot_number,
                description=item.description,
                quantity=data.get("quantity", 1),
                location=data.get("location"),
                status="available",
                added_date=datetime.now(),
                last_updated=datetime.now()
            )

            # Remove from warehouse
            item.warehouse_id = None

        # Create transfer record
        transfer = WarehouseTransfer(
            from_warehouse_id=warehouse.id,
            to_kit_id=kit.id,
            item_type=data["item_type"],
            item_id=data["item_id"],
            quantity=data.get("quantity", 1),
            transfer_date=datetime.now(),
            transferred_by_id=current_user_id,
            notes=data.get("notes"),
            status="completed"
        )

        # Record transaction
        record_transaction(
            db=db,
            item_type=data["item_type"],
            item_id=data["item_id"],
            transaction_type="transfer",
            quantity=data.get("quantity", 1),
            user_id=current_user_id,
            from_location=warehouse.name,
            to_location=f"{kit.name} - {box.box_number}",
            notes=data.get("notes", f"Transferred from {warehouse.name} to kit {kit.name}")
        )

        db.session.add(kit_item)
        db.session.add(transfer)
        db.session.commit()

        return jsonify({
            "message": "Transfer completed successfully",
            "transfer": transfer.to_dict(),
            "kit_item": kit_item.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@transfers_bp.route("/transfers/kit-to-warehouse", methods=["POST"])
@jwt_required
def transfer_kit_to_warehouse():
    """
    Transfer a tool or chemical from kit back to warehouse.
    Required fields:
        - from_kit_id: Source kit ID
        - kit_item_id: ID of the kit item to transfer
        - to_warehouse_id: Destination warehouse ID
        - notes: Optional transfer notes
    """
    try:
        data = request.get_json()
        current_user_id = request.current_user.get("user_id")

        # Validate required fields
        required_fields = ["from_kit_id", "kit_item_id", "to_warehouse_id"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Get kit, kit item, and warehouse
        kit = db.session.get(Kit, data["from_kit_id"])
        kit_item = db.session.get(KitItem, data["kit_item_id"])
        warehouse = db.session.get(Warehouse, data["to_warehouse_id"])

        if not kit:
            return jsonify({"error": "Kit not found"}), 404
        if not kit_item:
            return jsonify({"error": "Kit item not found"}), 404
        if not warehouse:
            return jsonify({"error": "Warehouse not found"}), 404
        if kit_item.kit_id != kit.id:
            return jsonify({"error": "Kit item does not belong to the specified kit"}), 400

        # Get the actual item and move it to warehouse
        if kit_item.item_type == "tool":
            item = db.session.get(Tool, kit_item.item_id)
            if item:
                item.warehouse_id = warehouse.id
        else:  # chemical
            item = db.session.get(Chemical, kit_item.item_id)
            if item:
                item.warehouse_id = warehouse.id

        # Create transfer record
        transfer = WarehouseTransfer(
            from_kit_id=kit.id,
            to_warehouse_id=warehouse.id,
            item_type=kit_item.item_type,
            item_id=kit_item.item_id,
            quantity=kit_item.quantity,
            transfer_date=datetime.now(),
            transferred_by_id=current_user_id,
            notes=data.get("notes"),
            status="completed"
        )

        # Record transaction
        record_transaction(
            db=db,
            item_type=kit_item.item_type,
            item_id=kit_item.item_id,
            transaction_type="transfer",
            quantity=kit_item.quantity,
            user_id=current_user_id,
            from_location=f"{kit.name} - {kit_item.box.box_number if kit_item.box else 'Unknown'}",
            to_location=warehouse.name,
            notes=data.get("notes", f"Returned from kit {kit.name} to {warehouse.name}")
        )

        # Remove kit item
        db.session.delete(kit_item)
        db.session.add(transfer)
        db.session.commit()

        return jsonify({
            "message": "Transfer completed successfully",
            "transfer": transfer.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@transfers_bp.route("/transfers/warehouse-to-warehouse", methods=["POST"])
@jwt_required
def transfer_warehouse_to_warehouse_legacy():
    """
    Legacy instant warehouse-to-warehouse transfer (admins only).

    Preserved so internal scripts that call this endpoint keep working, but
    new UI / AI flows should use ``/api/transfers/initiate`` + ``/receive``.
    """
    payload = getattr(request, "current_user", None) or {}
    if not payload.get("is_admin"):
        return jsonify({
            "error": "Direct warehouse-to-warehouse transfers require admin. "
                     "Use /api/transfers/initiate for the two-step flow.",
            "code": "USE_TWO_STEP_TRANSFER",
        }), 403

    try:
        data = request.get_json() or {}
        current_user_id = payload.get("user_id")

        required_fields = ["from_warehouse_id", "to_warehouse_id", "item_type", "item_id"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        if data["item_type"] not in ["tool", "chemical"]:
            return jsonify({"error": 'item_type must be "tool" or "chemical"'}), 400

        from_warehouse = db.session.get(Warehouse, data["from_warehouse_id"])
        to_warehouse = db.session.get(Warehouse, data["to_warehouse_id"])

        if not from_warehouse:
            return jsonify({"error": "Source warehouse not found"}), 404
        if not to_warehouse:
            return jsonify({"error": "Destination warehouse not found"}), 404
        if from_warehouse.id == to_warehouse.id:
            return jsonify({"error": "Source and destination warehouses must be different"}), 400

        item = _load_tool_or_chemical(data["item_type"], data["item_id"])
        if not item:
            return jsonify({"error": f"{data['item_type'].title()} not found"}), 404
        if item.warehouse_id != from_warehouse.id:
            return jsonify({"error": f"{data['item_type'].title()} is not in the source warehouse"}), 400

        item.warehouse_id = to_warehouse.id

        transfer = WarehouseTransfer(
            from_warehouse_id=from_warehouse.id,
            to_warehouse_id=to_warehouse.id,
            item_type=data["item_type"],
            item_id=data["item_id"],
            quantity=data.get("quantity", 1),
            transfer_date=datetime.now(),
            transferred_by_id=current_user_id,
            received_by_id=current_user_id,
            received_date=datetime.now(),
            notes=data.get("notes"),
            status=STATUS_COMPLETED,
        )

        record_transaction(
            db=db,
            item_type=data["item_type"],
            item_id=data["item_id"],
            transaction_type="transfer",
            quantity=data.get("quantity", 1),
            user_id=current_user_id,
            from_location=from_warehouse.name,
            to_location=to_warehouse.name,
            notes=data.get("notes", f"Transferred from {from_warehouse.name} to {to_warehouse.name}"),
        )

        db.session.add(transfer)
        db.session.commit()

        return jsonify({
            "message": "Transfer completed successfully",
            "transfer": transfer.to_dict(),
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception("Legacy warehouse-to-warehouse transfer failed")
        return jsonify({"error": str(e)}), 500


# =======================================================================
# Two-step warehouse-to-warehouse workflow
# =======================================================================


def _initiate_transfer(*, to_warehouse_id, item_type, item_id, quantity, notes,
                       user_id, source_warehouse_id):
    """
    Shared implementation used by both the HTTP endpoint and the AI tool.

    Returns (transfer, error_message, error_status). On success error_* are None.
    """
    if item_type not in ("tool", "chemical"):
        return None, 'item_type must be "tool" or "chemical"', 400

    from_warehouse = db.session.get(Warehouse, source_warehouse_id)
    if not from_warehouse:
        return None, "Active warehouse not found", 400

    to_warehouse = db.session.get(Warehouse, to_warehouse_id)
    if not to_warehouse:
        return None, "Destination warehouse not found", 404
    if from_warehouse.id == to_warehouse.id:
        return None, "Source and destination warehouses must be different", 400
    if not to_warehouse.is_active:
        return None, "Destination warehouse is inactive", 400

    item = _load_tool_or_chemical(item_type, item_id)
    if not item:
        return None, f"{item_type.title()} not found", 404
    if item.warehouse_id != from_warehouse.id:
        return None, f"{item_type.title()} is not in your active warehouse", 400

    # Tools in use can't be transferred
    if item_type == "tool" and item.status == "checked_out":
        return None, "Tool is checked out — must be returned first", 409

    qty = max(1, int(quantity or 1))
    if item_type == "chemical" and qty > (item.quantity or 0):
        return None, f"Only {item.quantity} {item.unit or 'units'} available", 400

    transfer = WarehouseTransfer(
        from_warehouse_id=from_warehouse.id,
        to_warehouse_id=to_warehouse.id,
        item_type=item_type,
        item_id=item.id,
        quantity=qty,
        transfer_date=datetime.now(),
        transferred_by_id=user_id,
        notes=notes,
        source_location=getattr(item, "location", None),
        status=STATUS_PENDING,
    )
    db.session.add(transfer)
    db.session.flush()

    if item_type == "tool":
        history = ToolHistory.create_event(
            tool_id=item.id,
            event_type="transferred_out",
            user_id=user_id,
            description=(
                f"Transfer initiated to {to_warehouse.name} "
                f"(awaiting receipt)"
            ),
            details={
                "transfer_id": transfer.id,
                "from_warehouse_id": from_warehouse.id,
                "from_warehouse_name": from_warehouse.name,
                "to_warehouse_id": to_warehouse.id,
                "to_warehouse_name": to_warehouse.name,
                "source_location": transfer.source_location,
            },
        )
        db.session.add(history)

    AuditLog.log(
        user_id=user_id,
        action="transfer_initiated",
        resource_type="transfer",
        resource_id=transfer.id,
        details={
            "item_type": item_type,
            "item_id": item.id,
            "from_warehouse_id": from_warehouse.id,
            "to_warehouse_id": to_warehouse.id,
            "quantity": qty,
        },
        ip_address=request.remote_addr if request else None,
    )

    return transfer, None, None


def _receive_transfer(*, transfer_id, destination_location, received_notes, user_id,
                      active_warehouse_id, is_admin=False):
    transfer = db.session.get(WarehouseTransfer, transfer_id)
    if not transfer:
        return None, "Transfer not found", 404
    if transfer.status != STATUS_PENDING:
        return None, f"Transfer is not awaiting receipt (status={transfer.status})", 400
    if not destination_location or not str(destination_location).strip():
        return None, "destination_location is required", 422

    if not is_admin and transfer.to_warehouse_id != active_warehouse_id:
        return None, "You can only receive transfers arriving at your active warehouse", 403

    item = _load_tool_or_chemical(transfer.item_type, transfer.item_id)
    if not item:
        return None, f"Underlying {transfer.item_type} no longer exists", 404

    # Guard against tool being checked out while transfer was pending
    if transfer.item_type == "tool" and item.status == "checked_out":
        return None, "Tool was checked out while transfer was pending — cancel the transfer and re-initiate", 409

    to_warehouse = db.session.get(Warehouse, transfer.to_warehouse_id)
    from_warehouse = db.session.get(Warehouse, transfer.from_warehouse_id)

    now = datetime.now()
    dest_location = str(destination_location).strip()

    if transfer.item_type == "tool":
        item.warehouse_id = to_warehouse.id
        item.location = dest_location
    else:  # chemical
        # Partial-quantity transfer → split the lot on receipt.
        if transfer.quantity and transfer.quantity < (item.quantity or 0):
            child = create_child_chemical(
                parent_chemical=item,
                quantity=transfer.quantity,
                destination_warehouse_id=to_warehouse.id,
            )
            child.location = dest_location
            db.session.add(child)
        else:
            item.warehouse_id = to_warehouse.id
            item.location = dest_location

    transfer.status = STATUS_RECEIVED
    transfer.received_by_id = user_id
    transfer.received_date = now
    transfer.destination_location = dest_location
    if received_notes:
        transfer.notes = (
            f"{transfer.notes}\n\nReceipt notes: {received_notes}"
            if transfer.notes
            else f"Receipt notes: {received_notes}"
        )

    record_transaction(
        db=db,
        item_type=transfer.item_type,
        item_id=transfer.item_id,
        transaction_type="transfer",
        quantity=transfer.quantity or 1,
        user_id=user_id,
        from_location=from_warehouse.name if from_warehouse else None,
        to_location=f"{to_warehouse.name} / {dest_location}" if to_warehouse else dest_location,
        notes=f"Received into {to_warehouse.name if to_warehouse else 'destination'} at {dest_location}",
    )

    if transfer.item_type == "tool":
        history = ToolHistory.create_event(
            tool_id=item.id,
            event_type="transferred_in",
            user_id=user_id,
            description=(
                f"Received into {to_warehouse.name if to_warehouse else 'destination'} "
                f"at {dest_location}"
            ),
            details={
                "transfer_id": transfer.id,
                "destination_location": dest_location,
                "from_warehouse_id": transfer.from_warehouse_id,
                "to_warehouse_id": transfer.to_warehouse_id,
            },
        )
        db.session.add(history)

    AuditLog.log(
        user_id=user_id,
        action="transfer_received",
        resource_type="transfer",
        resource_id=transfer.id,
        details={
            "item_type": transfer.item_type,
            "item_id": transfer.item_id,
            "destination_location": dest_location,
        },
        ip_address=request.remote_addr if request else None,
    )

    return transfer, None, None


def _cancel_transfer(*, transfer_id, cancel_reason, user_id, is_admin):
    transfer = db.session.get(WarehouseTransfer, transfer_id)
    if not transfer:
        return None, "Transfer not found", 404
    if transfer.status != STATUS_PENDING:
        return None, f"Only pending transfers can be cancelled (status={transfer.status})", 400
    if not cancel_reason or not str(cancel_reason).strip():
        return None, "cancel_reason is required", 422

    if not is_admin and transfer.transferred_by_id != user_id:
        return None, "Only the initiator or an admin can cancel this transfer", 403

    transfer.status = STATUS_CANCELLED
    transfer.cancelled_by_id = user_id
    transfer.cancelled_date = datetime.now()
    transfer.cancel_reason = str(cancel_reason).strip()

    AuditLog.log(
        user_id=user_id,
        action="transfer_cancelled",
        resource_type="transfer",
        resource_id=transfer.id,
        details={
            "item_type": transfer.item_type,
            "item_id": transfer.item_id,
            "reason": transfer.cancel_reason,
        },
        ip_address=request.remote_addr if request else None,
    )

    return transfer, None, None


@transfers_bp.route("/transfers/initiate", methods=["POST"])
@permission_required("transfer.initiate")
def initiate_transfer_route():
    """
    Initiate a warehouse-to-warehouse transfer.
    Source warehouse is always the current user's active warehouse.

    Body:
        to_warehouse_id (int, required)
        item_type (str): 'tool' | 'chemical'
        item_id (int)
        quantity (int, optional, default 1)
        notes (str, optional)
    """
    data = request.get_json() or {}

    to_warehouse_id = data.get("to_warehouse_id")
    item_type = data.get("item_type")
    item_id = data.get("item_id")

    for name, value in [("to_warehouse_id", to_warehouse_id),
                        ("item_type", item_type),
                        ("item_id", item_id)]:
        if value in (None, ""):
            return jsonify({"error": f"Missing required field: {name}"}), 400

    active = get_active_warehouse_id()
    if active is None:
        return jsonify({
            "error": "No active warehouse selected. Pick one from the header.",
            "code": "NO_ACTIVE_WAREHOUSE",
        }), 400

    try:
        transfer, err, status = _initiate_transfer(
            to_warehouse_id=int(to_warehouse_id),
            item_type=item_type,
            item_id=int(item_id),
            quantity=data.get("quantity", 1),
            notes=data.get("notes"),
            user_id=_current_user_id(),
            source_warehouse_id=active,
        )
        if err:
            db.session.rollback()
            return jsonify({"error": err}), status

        db.session.commit()
        return jsonify({
            "message": "Transfer initiated. Awaiting receipt at destination.",
            "transfer": transfer.to_dict(),
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to initiate transfer")
        return jsonify({"error": str(e)}), 500


@transfers_bp.route("/transfers/<int:transfer_id>/receive", methods=["POST"])
@permission_required("transfer.receive")
def receive_transfer_route(transfer_id):
    """
    Acknowledge receipt of a pending transfer. Assigns the item to the
    destination warehouse and stores its location there.

    Body:
        destination_location (str, required)
        received_notes (str, optional)
    """
    data = request.get_json() or {}
    payload = getattr(request, "current_user", None) or {}

    try:
        transfer, err, status = _receive_transfer(
            transfer_id=transfer_id,
            destination_location=data.get("destination_location"),
            received_notes=data.get("received_notes"),
            user_id=_current_user_id(),
            active_warehouse_id=get_active_warehouse_id(),
            is_admin=bool(payload.get("is_admin")),
        )
        if err:
            db.session.rollback()
            return jsonify({"error": err}), status

        db.session.commit()
        return jsonify({
            "message": "Transfer received.",
            "transfer": transfer.to_dict(),
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to receive transfer")
        return jsonify({"error": str(e)}), 500


@transfers_bp.route("/transfers/<int:transfer_id>/cancel", methods=["POST"])
@jwt_required
def cancel_transfer_route(transfer_id):
    """
    Cancel a pending transfer. Initiator or admin only. No inventory changes.

    Body:
        cancel_reason (str, required)
    """
    data = request.get_json() or {}
    payload = getattr(request, "current_user", None) or {}
    is_admin = bool(payload.get("is_admin"))

    # Non-admins must have transfer.cancel_own
    if not is_admin and "transfer.cancel_own" not in (payload.get("permissions") or []):
        return jsonify({
            "error": "Permission transfer.cancel_own required",
            "code": "PERMISSION_REQUIRED",
        }), 403

    try:
        transfer, err, status = _cancel_transfer(
            transfer_id=transfer_id,
            cancel_reason=data.get("cancel_reason"),
            user_id=_current_user_id(),
            is_admin=is_admin,
        )
        if err:
            db.session.rollback()
            return jsonify({"error": err}), status

        db.session.commit()
        return jsonify({
            "message": "Transfer cancelled.",
            "transfer": transfer.to_dict(),
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception("Failed to cancel transfer")
        return jsonify({"error": str(e)}), 500


@transfers_bp.route("/transfers/inbound", methods=["GET"])
@permission_required("transfer.view")
def list_inbound_transfers():
    """
    List transfers arriving at the user's active warehouse.
    Defaults to ``status=pending_receipt`` when not specified.
    """
    active = get_active_warehouse_id()
    if active is None:
        return jsonify({"transfers": [], "total": 0, "page": 1, "per_page": 0, "pages": 0}), 200

    status_filter = request.args.get("status", STATUS_PENDING)
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    query = WarehouseTransfer.query.filter(
        WarehouseTransfer.to_warehouse_id == active,
        WarehouseTransfer.from_warehouse_id.isnot(None),
    )
    if status_filter and status_filter != "all":
        query = query.filter(WarehouseTransfer.status == status_filter)

    pagination = query.order_by(WarehouseTransfer.transfer_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False,
    )
    return jsonify({
        "transfers": [t.to_dict() for t in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@transfers_bp.route("/transfers/outbound", methods=["GET"])
@permission_required("transfer.view")
def list_outbound_transfers():
    """
    List transfers leaving the user's active warehouse (any status).
    """
    active = get_active_warehouse_id()
    if active is None:
        return jsonify({"transfers": [], "total": 0, "page": 1, "per_page": 0, "pages": 0}), 200

    status_filter = request.args.get("status")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    query = WarehouseTransfer.query.filter(
        WarehouseTransfer.from_warehouse_id == active,
        WarehouseTransfer.to_warehouse_id.isnot(None),
    )
    if status_filter and status_filter != "all":
        query = query.filter(WarehouseTransfer.status == status_filter)

    pagination = query.order_by(WarehouseTransfer.transfer_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False,
    )
    return jsonify({
        "transfers": [t.to_dict() for t in pagination.items],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
        "pages": pagination.pages,
    }), 200


@transfers_bp.route("/transfers/<int:transfer_id>", methods=["GET"])
@permission_required("transfer.view")
def get_transfer_detail(transfer_id):
    transfer = db.session.get(WarehouseTransfer, transfer_id)
    if not transfer:
        return jsonify({"error": "Transfer not found"}), 404
    payload = transfer.to_dict()

    item = _load_tool_or_chemical(transfer.item_type, transfer.item_id)
    if item is not None:
        payload["item_snapshot"] = {
            "id": item.id,
            "description": getattr(item, "description", None),
            "identifier": (
                getattr(item, "tool_number", None)
                or getattr(item, "part_number", None)
            ),
            "serial_number": getattr(item, "serial_number", None),
            "lot_number": getattr(item, "lot_number", None),
            "current_warehouse_id": getattr(item, "warehouse_id", None),
            "current_location": getattr(item, "location", None),
        }

    return jsonify({"transfer": payload}), 200


# =======================================================================
# Active warehouse selection
# =======================================================================


@transfers_bp.route("/me/active-warehouse", methods=["GET"])
@jwt_required
def get_active_warehouse():
    """Return the current user's active warehouse (if any)."""
    user_id = _current_user_id()
    user = db.session.get(User, user_id) if user_id else None
    if not user:
        return jsonify({"active_warehouse": None}), 200

    warehouse = user.active_warehouse
    return jsonify({
        "active_warehouse": warehouse.to_dict() if warehouse else None,
        "active_warehouse_id": user.active_warehouse_id,
    }), 200


@transfers_bp.route("/me/active-warehouse", methods=["POST"])
@permission_required("warehouse.switch_active")
def set_active_warehouse():
    """
    Switch the current user's active warehouse.

    Body: ``{"warehouse_id": <int | null>}``.

    Returns the updated user row + a freshly issued JWT so the client
    doesn't need to wait for the next refresh cycle.
    """
    from auth.jwt_manager import JWTManager  # local to avoid circular import

    data = request.get_json() or {}
    user_id = _current_user_id()
    user = db.session.get(User, user_id) if user_id else None
    if not user:
        return jsonify({"error": "User not found"}), 404

    warehouse_id = data.get("warehouse_id")
    if warehouse_id in (None, ""):
        user.active_warehouse_id = None
    else:
        try:
            wh_id = int(warehouse_id)
        except (TypeError, ValueError):
            return jsonify({"error": "warehouse_id must be an integer or null"}), 400

        warehouse = db.session.get(Warehouse, wh_id)
        if not warehouse or not warehouse.is_active:
            return jsonify({"error": "Warehouse not found or inactive"}), 404
        user.active_warehouse_id = wh_id

    AuditLog.log(
        user_id=user.id,
        action="active_warehouse_changed",
        resource_type="user",
        resource_id=user.id,
        details={"active_warehouse_id": user.active_warehouse_id},
        ip_address=request.remote_addr,
    )

    db.session.commit()

    tokens = JWTManager.generate_tokens(user)

    return jsonify({
        "message": "Active warehouse updated",
        "active_warehouse_id": user.active_warehouse_id,
        "active_warehouse": (
            user.active_warehouse.to_dict() if user.active_warehouse else None
        ),
        "tokens": tokens,
    }), 200


@transfers_bp.route("/transfers", methods=["GET"])
@jwt_required
def get_transfers():
    """
    Get transfer history with filters.
    Query params:
        - warehouse_id: Filter by warehouse (from or to)
        - kit_id: Filter by kit (from or to)
        - item_type: Filter by item type (tool/chemical)
        - item_id: Filter by specific item
        - status: Filter by status
        - start_date: Filter by start date (ISO format)
        - end_date: Filter by end date (ISO format)
        - page: Page number (default: 1)
        - per_page: Items per page (default: 50)
    """
    try:
        # Get query parameters
        warehouse_id = request.args.get("warehouse_id", type=int)
        kit_id = request.args.get("kit_id", type=int)
        item_type = request.args.get("item_type")
        item_id = request.args.get("item_id", type=int)
        status = request.args.get("status")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 50))

        # Build query
        query = WarehouseTransfer.query

        # Apply filters
        if warehouse_id:
            query = query.filter(
                db.or_(
                    WarehouseTransfer.from_warehouse_id == warehouse_id,
                    WarehouseTransfer.to_warehouse_id == warehouse_id
                )
            )

        if kit_id:
            query = query.filter(
                db.or_(
                    WarehouseTransfer.from_kit_id == kit_id,
                    WarehouseTransfer.to_kit_id == kit_id
                )
            )

        if item_type:
            query = query.filter_by(item_type=item_type)

        if item_id:
            query = query.filter_by(item_id=item_id)

        if status:
            query = query.filter_by(status=status)

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                query = query.filter(WarehouseTransfer.transfer_date >= start_dt)
            except ValueError:
                return jsonify({"error": "Invalid start_date format. Use ISO format."}), 400

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                query = query.filter(WarehouseTransfer.transfer_date <= end_dt)
            except ValueError:
                return jsonify({"error": "Invalid end_date format. Use ISO format."}), 400

        # Paginate
        pagination = query.order_by(WarehouseTransfer.transfer_date.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )

        return jsonify({
            "transfers": [transfer.to_dict() for transfer in pagination.items],
            "total": pagination.total,
            "page": page,
            "per_page": per_page,
            "pages": pagination.pages
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
