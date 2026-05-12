"""Shared helpers for fulfilling kit reorder requests.

The kit-replenishment side-effects (adding a new part/lot back to the kit,
auto-creating warehouse stock, recording warehouse transfers, etc.) are
needed from two places:

  * ``PUT /api/reorder-requests/<id>/fulfill`` — the legacy materials-team
    fulfillment endpoint.
  * ``POST /api/user-requests/<id>/items/mark-received`` — the unified
    request-completion endpoint used from the new Requests UI.

Centralising the logic here ensures that no matter which path a buyer
takes, marking a kit-generated request fulfilled restores the "hole" in
the kit by adding the new part/lot number that just arrived.
"""

from __future__ import annotations

import logging
from datetime import datetime

from models import (
    AuditLog,
    Chemical,
    ChemicalPart,
    Tool,
    Warehouse,
    WarehouseTransfer,
    db,
)
from models_kits import KitBox, KitExpendable, KitItem, KitReorderRequest
from utils.error_handler import ValidationError


logger = logging.getLogger(__name__)


def restore_kit_from_reorder(
    reorder: KitReorderRequest,
    box_id: int | None = None,
    current_user_id: int | None = None,
    remote_addr: str | None = None,
) -> None:
    """Mark ``reorder`` as fulfilled and add the new part/lot back to its kit.

    The caller is responsible for committing the surrounding transaction.
    No commit happens here so the kit-restore can participate in larger
    operations (e.g. marking multiple request items received in a single
    request).
    """

    if reorder.status == "fulfilled":
        # Idempotent — restoration already happened on a previous call
        return

    if reorder.status != "ordered":
        raise ValidationError("Can only fulfill ordered requests")

    if reorder.quantity_requested is None or reorder.quantity_requested <= 0:
        raise ValidationError("Quantity requested must be greater than zero")

    if reorder.item_type == "tool" and reorder.quantity_requested != 1:
        raise ValidationError("Tool quantity must be 1 (tools are individual items)")

    if box_id:
        box = KitBox.query.filter_by(id=box_id, kit_id=reorder.kit_id).first()
        if not box:
            raise ValidationError("Invalid box_id for this kit")
    else:
        # Prefer the originating KitItem's box when the caller didn't specify
        # one, so the new lot ends up where the consumed one was issued from.
        # The unified mark-received path always omits box_id; falling back to
        # box #1 silently re-routed stock to the wrong location.
        box = None
        if reorder.item_id and reorder.item_type in ("tool", "chemical"):
            prior = db.session.get(KitItem, reorder.item_id)
            if prior and prior.kit_id == reorder.kit_id and prior.box_id:
                box = KitBox.query.filter_by(
                    id=prior.box_id, kit_id=reorder.kit_id
                ).first()
        elif reorder.item_id and reorder.item_type == "expendable":
            prior = db.session.get(KitExpendable, reorder.item_id)
            if prior and prior.kit_id == reorder.kit_id and prior.box_id:
                box = KitBox.query.filter_by(
                    id=prior.box_id, kit_id=reorder.kit_id
                ).first()
        if box is None:
            box = (
                KitBox.query.filter_by(kit_id=reorder.kit_id)
                .order_by(KitBox.box_number)
                .first()
            )
        if not box:
            raise ValidationError("box_id is required to fulfill reorder")
        box_id = box.id

    reorder.status = "fulfilled"
    reorder.fulfillment_date = datetime.now()

    if reorder.item_type == "expendable":
        _restore_expendable(reorder, box, current_user_id, remote_addr)
    elif reorder.item_type in ("tool", "chemical"):
        _restore_tool_or_chemical(reorder, box, box_id, current_user_id, remote_addr)
    else:
        raise ValidationError(f"Unsupported item_type: {reorder.item_type}")


# ---------------------------------------------------------------------------
# Expendable restoration
# ---------------------------------------------------------------------------

def _restore_expendable(reorder, box, current_user_id, remote_addr):
    if reorder.item_id:
        existing_expendable = db.session.get(KitExpendable, reorder.item_id)
        if not existing_expendable:
            raise ValidationError("Referenced expendable not found")

        existing_expendable.quantity += reorder.quantity_requested
        existing_expendable.last_updated = datetime.now()
        existing_expendable.status = "available"

        logger.info(
            "Updated existing expendable",
            extra={
                "expendable_id": existing_expendable.id,
                "quantity_added": reorder.quantity_requested,
            },
        )

        AuditLog.log(
            user_id=current_user_id,
            action="expendable_quantity_updated_via_reorder",
            resource_type="expendable",
            resource_id=existing_expendable.id,
            details={
                "part_number": existing_expendable.part_number,
                "quantity_added": reorder.quantity_requested,
                "reorder_id": reorder.id,
            },
            ip_address=remote_addr,
        )
        return

    # Create a brand-new expendable with an auto-generated lot number
    from models import Expendable, LotNumberSequence

    lot_number = LotNumberSequence.generate_lot_number()

    logger.info(
        "Creating new expendable",
        extra={"part_number": reorder.part_number, "lot_number": lot_number},
    )

    expendable = Expendable(
        part_number=reorder.part_number,
        serial_number=None,
        lot_number=lot_number,
        description=reorder.description or f"Expendable {reorder.part_number}",
        manufacturer=None,
        quantity=reorder.quantity_requested,
        unit="ea",
        location=f"Box {box.box_number}",
        category="General",
        status="available",
        minimum_stock_level=None,
        notes=f"Created via reorder request {reorder.id}",
    )
    db.session.add(expendable)
    db.session.flush()

    kit_item = KitItem(
        kit_id=reorder.kit_id,
        box_id=box.id,
        item_type="expendable",
        item_id=expendable.id,
        part_number=expendable.part_number,
        serial_number=None,
        lot_number=expendable.lot_number,
        description=expendable.description,
        quantity=expendable.quantity,
        location=expendable.location,
        status="available",
        added_date=datetime.now(),
        last_updated=datetime.now(),
    )
    db.session.add(kit_item)

    AuditLog.log(
        user_id=current_user_id,
        action="expendable_added_via_reorder",
        resource_type="expendable",
        resource_id=expendable.id,
        details={
            "part_number": expendable.part_number,
            "lot_number": lot_number,
            "kit_id": reorder.kit_id,
            "kit_name": reorder.kit.name if reorder.kit else None,
            "reorder_id": reorder.id,
        },
        ip_address=remote_addr,
    )

    logger.info(
        "Created expendable and kit item for reorder",
        extra={"expendable_id": expendable.id, "reorder_id": reorder.id},
    )


# ---------------------------------------------------------------------------
# Tool / Chemical restoration
# ---------------------------------------------------------------------------

def _restore_tool_or_chemical(reorder, box, box_id, current_user_id, remote_addr):
    if reorder.item_id:
        existing_kit_item = db.session.get(KitItem, reorder.item_id)

        if existing_kit_item and existing_kit_item.item_type == reorder.item_type:
            _transfer_existing_part_number(
                reorder, existing_kit_item, box, box_id, current_user_id
            )
        else:
            _transfer_specific_warehouse_item(
                reorder, box, box_id, current_user_id
            )
        return

    # No item_id — auto-create the item in a warehouse and transfer
    _autocreate_and_transfer(reorder, box, box_id, current_user_id)


def _transfer_existing_part_number(reorder, existing_kit_item, box, box_id, current_user_id):
    """Find another instance of the same part number in a warehouse and transfer it."""
    logger.info(
        "Reordering existing item - searching for warehouse stock",
        extra={"part_number": existing_kit_item.part_number},
    )

    if reorder.item_type == "tool":
        warehouse_item = Tool.query.filter(
            Tool.tool_number == existing_kit_item.part_number,
            Tool.warehouse_id.isnot(None),
        ).first()
    else:
        warehouse_item = Chemical.query.filter(
            Chemical.part_number == existing_kit_item.part_number,
            Chemical.warehouse_id.isnot(None),
        ).first()

    if not warehouse_item:
        raise ValidationError(
            f"No {reorder.item_type} with part number {existing_kit_item.part_number} "
            "found in warehouse. Please add stock to warehouse first."
        )

    if reorder.item_type == "chemical":
        if warehouse_item.quantity < reorder.quantity_requested:
            raise ValidationError(
                f"Insufficient quantity in warehouse. Available: {warehouse_item.quantity}, "
                f"Requested: {reorder.quantity_requested}"
            )

    kit_item = KitItem(
        kit_id=reorder.kit_id,
        box_id=box_id,
        item_type=reorder.item_type,
        item_id=warehouse_item.id,
        part_number=existing_kit_item.part_number,
        serial_number=warehouse_item.serial_number if reorder.item_type == "tool" else None,
        lot_number=warehouse_item.lot_number,
        description=existing_kit_item.description,
        quantity=round(reorder.quantity_requested, 2),
        location=f"Box {box.box_number}",
        status="available",
    )
    db.session.add(kit_item)
    db.session.flush()

    transfer = WarehouseTransfer(
        from_warehouse_id=warehouse_item.warehouse_id,
        to_kit_id=reorder.kit_id,
        item_type=reorder.item_type,
        item_id=warehouse_item.id,
        quantity=reorder.quantity_requested,
        transferred_by_id=current_user_id,
        notes=f"Transferred to fulfill reorder request #{reorder.id}",
        status="completed",
    )
    db.session.add(transfer)
    _consume_warehouse_stock(warehouse_item, reorder)


def _transfer_specific_warehouse_item(reorder, box, box_id, current_user_id):
    if reorder.item_type == "tool":
        warehouse_item = db.session.get(Tool, reorder.item_id)
    else:
        warehouse_item = db.session.get(Chemical, reorder.item_id)

    if not warehouse_item:
        raise ValidationError(f"{reorder.item_type.capitalize()} not found")

    if not warehouse_item.warehouse_id:
        raise ValidationError(
            f"{reorder.item_type.capitalize()} is not in a warehouse. "
            "Please add it to a warehouse first."
        )

    if reorder.item_type == "chemical":
        if warehouse_item.chemical_part_id is None:
            raise ValidationError(
                f"Chemical '{warehouse_item.part_number}' is not linked to the "
                "master chemical list. Add the part to the master list before "
                "transferring it to a kit."
            )
        if warehouse_item.quantity < reorder.quantity_requested:
            raise ValidationError(
                f"Insufficient quantity in warehouse. Available: {warehouse_item.quantity}, "
                f"Requested: {reorder.quantity_requested}"
            )

    kit_item = KitItem(
        kit_id=reorder.kit_id,
        box_id=box_id,
        item_type=reorder.item_type,
        item_id=warehouse_item.id,
        part_number=warehouse_item.tool_number if reorder.item_type == "tool" else warehouse_item.part_number,
        serial_number=warehouse_item.serial_number if reorder.item_type == "tool" else None,
        lot_number=warehouse_item.lot_number,
        description=warehouse_item.description,
        quantity=round(reorder.quantity_requested, 2),
        location=f"Box {box.box_number}",
        status="available",
    )
    db.session.add(kit_item)
    db.session.flush()

    transfer = WarehouseTransfer(
        from_warehouse_id=warehouse_item.warehouse_id,
        to_kit_id=reorder.kit_id,
        item_type=reorder.item_type,
        item_id=warehouse_item.id,
        quantity=reorder.quantity_requested,
        transferred_by_id=current_user_id,
        notes=f"Transferred to fulfill reorder request #{reorder.id}",
        status="completed",
    )
    db.session.add(transfer)
    _consume_warehouse_stock(warehouse_item, reorder)


def _consume_warehouse_stock(warehouse_item, reorder):
    """Reduce warehouse stock by the transferred amount.

    Tools and serialised items are 1-per-row, so the whole row leaves the
    warehouse. Chemicals are quantity-tracked, so only ``quantity_requested``
    units come out; the remaining stock stays in the warehouse until depleted.
    Without this, transferring 5 L from a 50 L drum stranded the other 45 L
    on a row with ``warehouse_id=NULL`` and no kit link.
    """
    if reorder.item_type == "tool":
        warehouse_item.warehouse_id = None
        return
    if reorder.item_type == "chemical":
        new_qty = round((warehouse_item.quantity or 0) - reorder.quantity_requested, 4)
        if new_qty <= 0:
            warehouse_item.quantity = 0
            warehouse_item.warehouse_id = None
        else:
            warehouse_item.quantity = new_qty
        return
    # Other types (defensive — current callers only pass tool/chemical here)
    warehouse_item.warehouse_id = None


def _autocreate_and_transfer(reorder, box, box_id, current_user_id):
    """Auto-create the item in the default warehouse, then transfer it to the kit."""
    default_warehouse = Warehouse.query.filter_by(
        warehouse_type="main", is_active=True
    ).first()
    if not default_warehouse:
        default_warehouse = Warehouse.query.filter_by(is_active=True).first()
    if not default_warehouse:
        raise ValidationError(
            "No active warehouse found. Please create a warehouse before fulfilling new item requests."
        )

    logger.info(
        "Auto-creating new item in warehouse",
        extra={"item_type": reorder.item_type, "warehouse_name": default_warehouse.name},
    )

    if reorder.item_type == "tool":
        serial_number = (
            reorder.notes
            or f'SN-{reorder.part_number}-{datetime.now().strftime("%Y%m%d%H%M%S")}'
        )
        warehouse_item = Tool(
            tool_number=reorder.part_number,
            serial_number=serial_number,
            description=reorder.description,
            condition="new",
            location=f"Warehouse {default_warehouse.name}",
            category="General",
            status="available",
            warehouse_id=default_warehouse.id,
            created_at=datetime.now(),
        )
    else:  # chemical
        chemical_part = ChemicalPart.query.filter_by(
            part_number=reorder.part_number
        ).first()
        if chemical_part is None:
            raise ValidationError(
                f"Part number '{reorder.part_number}' is not on the master chemical "
                "list. Add the chemical part to the master list before fulfilling "
                "this reorder."
            )

        lot_number = (
            reorder.notes
            or f'LOT-{reorder.part_number}-{datetime.now().strftime("%Y%m%d%H%M%S")}'
        )
        warehouse_item = Chemical(
            part_number=reorder.part_number,
            chemical_part_id=chemical_part.id,
            lot_number=lot_number,
            description=reorder.description or chemical_part.description,
            manufacturer=chemical_part.manufacturer or "Unknown",
            # Match the precision used when writing the KitItem below so the
            # warehouse and kit rows agree (e.g. 2.75 L stays 2.75, not 2).
            quantity=round(reorder.quantity_requested, 2),
            unit=chemical_part.default_unit or "ea",
            location=f"Warehouse {default_warehouse.name}",
            category=chemical_part.category or "General",
            status="available",
            warehouse_id=default_warehouse.id,
            minimum_stock_level=chemical_part.minimum_stock_level,
            date_added=datetime.now(),
        )

    db.session.add(warehouse_item)
    db.session.flush()

    kit_item = KitItem(
        kit_id=reorder.kit_id,
        box_id=box_id,
        item_type=reorder.item_type,
        item_id=warehouse_item.id,
        part_number=warehouse_item.tool_number if reorder.item_type == "tool" else warehouse_item.part_number,
        serial_number=warehouse_item.serial_number if reorder.item_type == "tool" else None,
        lot_number=warehouse_item.lot_number,
        description=warehouse_item.description,
        quantity=round(reorder.quantity_requested, 2),
        location=f"Box {box.box_number}",
        status="available",
    )
    db.session.add(kit_item)
    db.session.flush()

    transfer = WarehouseTransfer(
        from_warehouse_id=default_warehouse.id,
        to_kit_id=reorder.kit_id,
        item_type=reorder.item_type,
        item_id=warehouse_item.id,
        quantity=reorder.quantity_requested,
        transferred_by_id=current_user_id,
        notes=f"Auto-created and transferred to fulfill reorder request #{reorder.id}",
        status="completed",
    )
    db.session.add(transfer)
    warehouse_item.warehouse_id = None
