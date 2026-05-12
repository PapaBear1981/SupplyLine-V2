"""
Transfer service.

Provides field-vs-permanent transfer semantics for kit-involving moves.

Status of the existing system (as of this migration):
- ``routes_transfers.transfer_warehouse_to_kit`` and ``transfer_kit_to_warehouse``
  ALREADY mutate ``warehouse_id`` (so historically every kit↔warehouse move was
  effectively permanent). We keep that behaviour for ``mode='permanent'``.
- ``KitToolCheckout`` (separate model) is the canonical "field deployment" path for
  tools — a tool is sent to a kit while retaining ``previous_warehouse_id`` for
  restoration on return. ``mode='field'`` for tools dispatches there.
- ``mode='field'`` for chemicals/expendables is the existing
  ``routes_kit_transfers.create_transfer`` behaviour (pending → /complete) which
  does not change ``warehouse_id``.

This service centralises the dispatch so callers like the wizard's
``populate_from_wizard`` and the new compliance "Transfer in from warehouse"
shortcut don't have to know which underlying mechanism to invoke.
"""

from datetime import datetime

from models import AuditLog, Chemical, ChemicalPart, Tool, Warehouse, db
from models_kits import (
    Kit,
    KitBox,
    KitExpendable,
    KitItem,
    KitToolCheckout,
    KitTransfer,
)


VALID_MODES = ("field", "permanent")


def _record_kit_transfer(*, item_type, item_id, from_location_type, from_location_id,
                         to_location_type, to_location_id, quantity, transferred_by,
                         mode, status="completed", notes=None, reverts_transfer_id=None):
    """Insert a KitTransfer row and return it. Caller is responsible for committing."""
    transfer = KitTransfer(
        item_type=item_type,
        item_id=item_id,
        from_location_type=from_location_type,
        from_location_id=from_location_id,
        to_location_type=to_location_type,
        to_location_id=to_location_id,
        quantity=quantity,
        transferred_by=transferred_by,
        status=status,
        transfer_mode=mode,
        notes=notes,
        completed_date=datetime.now() if status == "completed" else None,
        reverts_transfer_id=reverts_transfer_id,
    )
    db.session.add(transfer)
    db.session.flush()
    return transfer


def _audit(audit_log_fn, *, user_id, action, resource_type, resource_id, details):
    if audit_log_fn:
        audit_log_fn(
            user_id=user_id, action=action, resource_type=resource_type,
            resource_id=resource_id, details=details,
        )
    else:
        AuditLog.log(
            user_id=user_id, action=action, resource_type=resource_type,
            resource_id=resource_id, details=details,
        )


# ----------------------------- warehouse -> kit -----------------------------

def warehouse_to_kit(*, item_type, item_id, kit_id, quantity, transferred_by,
                     mode="field", box_id=None, notes=None, audit_log_fn=None):
    """
    Move a tool or chemical from a warehouse into a kit.

    - ``mode='permanent'`` reassigns ``warehouse_id=NULL`` on the source record
      (chemicals are archived at the warehouse).
    - ``mode='field'`` for tools uses ``KitToolCheckout`` (retains ``previous_warehouse_id``);
      for chemicals it creates a KitItem without mutating ``warehouse_id``.
    """
    if mode not in VALID_MODES:
        raise ValueError(f"Invalid mode: {mode!r}; expected one of {VALID_MODES}")
    if item_type not in ("tool", "chemical"):
        raise ValueError(f"Unsupported item_type for warehouse->kit: {item_type!r}")

    kit = db.session.get(Kit, kit_id)
    if kit is None:
        raise ValueError(f"Kit {kit_id} not found.")
    box = None
    if box_id is not None:
        box = db.session.get(KitBox, box_id)
        if box is None or box.kit_id != kit.id:
            raise ValueError("Box does not belong to the specified kit.")
    else:
        box = kit.boxes.first()
        if box is None:
            raise ValueError(f"Kit {kit.id} has no boxes; specify box_id or seed boxes first.")

    if item_type == "tool":
        tool = db.session.get(Tool, item_id)
        if tool is None:
            raise ValueError(f"Tool {item_id} not found.")

        if mode == "field":
            # Field deployment: KitToolCheckout retains the warehouse link for return.
            checkout = KitToolCheckout(
                tool_id=tool.id,
                kit_id=kit.id,
                checked_out_by_id=transferred_by,
                previous_location=tool.location,
                previous_warehouse_id=tool.warehouse_id,
                status="active",
                notes=notes,
            )
            db.session.add(checkout)
            # We still record a KitItem so the kit UI shows the tool.
            ki = KitItem(
                kit_id=kit.id, box_id=box.id, item_type="tool", item_id=tool.id,
                part_number=tool.tool_number, serial_number=tool.serial_number,
                description=tool.description, quantity=1, status="available",
            )
            db.session.add(ki)
            from_warehouse_id = tool.warehouse_id or 0
            transfer = _record_kit_transfer(
                item_type="tool", item_id=tool.id,
                from_location_type="warehouse", from_location_id=from_warehouse_id,
                to_location_type="kit", to_location_id=kit.id,
                quantity=1, transferred_by=transferred_by, mode="field",
                status="completed", notes=notes,
            )
            _audit(audit_log_fn, user_id=transferred_by, action="transfer_field",
                   resource_type="kit_transfer", resource_id=transfer.id,
                   details={"item_type": "tool", "tool_id": tool.id, "kit_id": kit.id})
            return transfer

        # Permanent
        from_warehouse_id = tool.warehouse_id or 0
        tool.warehouse_id = None
        ki = KitItem(
            kit_id=kit.id, box_id=box.id, item_type="tool", item_id=tool.id,
            part_number=tool.tool_number, serial_number=tool.serial_number,
            description=tool.description, quantity=1, status="available",
        )
        db.session.add(ki)
        transfer = _record_kit_transfer(
            item_type="tool", item_id=tool.id,
            from_location_type="warehouse", from_location_id=from_warehouse_id,
            to_location_type="kit", to_location_id=kit.id,
            quantity=1, transferred_by=transferred_by, mode="permanent",
            status="completed", notes=notes,
        )
        _audit(audit_log_fn, user_id=transferred_by, action="transfer_permanent",
               resource_type="kit_transfer", resource_id=transfer.id,
               details={"item_type": "tool", "tool_id": tool.id, "kit_id": kit.id,
                        "from_warehouse_id": from_warehouse_id})
        return transfer

    # Chemical
    chem = db.session.get(Chemical, item_id)
    if chem is None:
        raise ValueError(f"Chemical {item_id} not found.")
    from_warehouse_id = chem.warehouse_id or 0
    full_lot = quantity >= (chem.quantity or 0)
    moved_chem = chem
    if mode == "permanent":
        if full_lot:
            # Whole lot moves to the kit — detach and archive the source row.
            chem.warehouse_id = None
            chem.is_archived = True
            chem.archived_reason = "moved_to_kit_permanent"
            chem.archived_date = datetime.now()
        else:
            # Partial move — decrement the warehouse lot and materialize a
            # new Chemical row carrying the moved quantity so the KitItem
            # points at a distinct lot record. Existing lot history at the
            # warehouse is preserved.
            chem.quantity = (chem.quantity or 0) - quantity
            moved_chem = Chemical(
                chemical_part_id=getattr(chem, "chemical_part_id", None),
                part_number=chem.part_number,
                lot_number=chem.lot_number,
                description=chem.description,
                manufacturer=getattr(chem, "manufacturer", None),
                category=getattr(chem, "category", None),
                quantity=quantity,
                unit=getattr(chem, "unit", None) or "each",
                warehouse_id=None,
                is_archived=True,
                archived_reason="moved_to_kit_permanent_split",
                archived_date=datetime.now(),
                date_added=datetime.now(),
            )
            db.session.add(moved_chem)
            db.session.flush()
    ki = KitItem(
        kit_id=kit.id, box_id=box.id, item_type="chemical", item_id=moved_chem.id,
        part_number=moved_chem.part_number, lot_number=moved_chem.lot_number,
        description=moved_chem.description, quantity=quantity, status="available",
    )
    db.session.add(ki)
    transfer = _record_kit_transfer(
        item_type="chemical", item_id=moved_chem.id,
        from_location_type="warehouse", from_location_id=from_warehouse_id,
        to_location_type="kit", to_location_id=kit.id,
        quantity=quantity, transferred_by=transferred_by, mode=mode,
        status="completed", notes=notes,
    )
    _audit(audit_log_fn, user_id=transferred_by,
           action="transfer_permanent" if mode == "permanent" else "transfer_field",
           resource_type="kit_transfer", resource_id=transfer.id,
           details={"item_type": "chemical", "chemical_id": chem.id, "kit_id": kit.id,
                    "from_warehouse_id": from_warehouse_id})
    return transfer


# ----------------------------- kit -> warehouse -----------------------------

def kit_to_warehouse(*, kit_id, kit_row, to_warehouse_id, transferred_by,
                     mode="field", notes=None, audit_log_fn=None):
    """
    Move a kit row (KitItem or KitExpendable) back to a warehouse.

    Field mode is only meaningful for tools (via KitToolCheckout return). For chemicals
    and expendables field mode is functionally equivalent to permanent in this codebase
    because there's no temporary-ownership concept; we still write a KitTransfer with
    transfer_mode='field' so the audit trail reflects the user's intent.

    Permanent mode for expendables requires a backing ChemicalPart to materialize a
    Chemical lot at the warehouse. Raises ValueError(409-style) if unsatisfiable.
    """
    if mode not in VALID_MODES:
        raise ValueError(f"Invalid mode: {mode!r}; expected one of {VALID_MODES}")

    kit = db.session.get(Kit, kit_id)
    warehouse = db.session.get(Warehouse, to_warehouse_id)
    if kit is None:
        raise ValueError(f"Kit {kit_id} not found.")
    if warehouse is None:
        raise ValueError(f"Warehouse {to_warehouse_id} not found.")
    # Defend against the caller passing a row from another kit.
    if getattr(kit_row, "kit_id", None) != kit.id:
        raise ValueError(
            f"kit_row {getattr(kit_row, 'id', None)} does not belong to kit {kit.id}."
        )

    if isinstance(kit_row, KitItem):
        if kit_row.item_type == "tool":
            tool = db.session.get(Tool, kit_row.item_id)
            if tool is None:
                raise ValueError(f"Underlying tool {kit_row.item_id} not found.")
            # Field-mode tool returns must close the active KitToolCheckout
            # (if any) and restore the tool's saved pre-checkout state,
            # otherwise the field-tools tab keeps showing the deployment as
            # active forever.
            if mode == "field":
                checkout = KitToolCheckout.query.filter_by(
                    tool_id=tool.id, kit_id=kit.id, status="active",
                ).order_by(KitToolCheckout.id.desc()).first()
                if checkout is not None:
                    checkout.status = "returned"
                    checkout.return_date = datetime.now()
                    checkout.returned_by_id = transferred_by
                    # Restore the saved warehouse_id and location if present,
                    # otherwise land at the requested destination warehouse.
                    target_warehouse_id = checkout.previous_warehouse_id or warehouse.id
                    tool.warehouse_id = target_warehouse_id
                    if checkout.previous_location is not None:
                        tool.location = checkout.previous_location
                else:
                    tool.warehouse_id = warehouse.id
            else:
                tool.warehouse_id = warehouse.id
            transfer = _record_kit_transfer(
                item_type="tool", item_id=tool.id,
                from_location_type="kit", from_location_id=kit.id,
                to_location_type="warehouse", to_location_id=warehouse.id,
                quantity=1, transferred_by=transferred_by, mode=mode,
                status="completed", notes=notes,
            )
            db.session.delete(kit_row)
            _audit(audit_log_fn, user_id=transferred_by,
                   action="transfer_permanent" if mode == "permanent" else "transfer_field",
                   resource_type="kit_transfer", resource_id=transfer.id,
                   details={"item_type": "tool", "tool_id": tool.id, "kit_id": kit.id,
                            "to_warehouse_id": warehouse.id})
            return transfer

        # Chemical kit-item
        chem = db.session.get(Chemical, kit_row.item_id)
        if chem is None:
            raise ValueError(f"Underlying chemical {kit_row.item_id} not found.")
        chem.warehouse_id = warehouse.id
        chem.is_archived = False
        transfer = _record_kit_transfer(
            item_type="chemical", item_id=chem.id,
            from_location_type="kit", from_location_id=kit.id,
            to_location_type="warehouse", to_location_id=warehouse.id,
            quantity=kit_row.quantity, transferred_by=transferred_by, mode=mode,
            status="completed", notes=notes,
        )
        db.session.delete(kit_row)
        _audit(audit_log_fn, user_id=transferred_by,
               action="transfer_permanent" if mode == "permanent" else "transfer_field",
               resource_type="kit_transfer", resource_id=transfer.id,
               details={"item_type": "chemical", "chemical_id": chem.id, "kit_id": kit.id,
                        "to_warehouse_id": warehouse.id})
        return transfer

    if isinstance(kit_row, KitExpendable):
        if mode != "permanent":
            raise ValueError(
                "Expendables can only be transferred to a warehouse in 'permanent' mode "
                "(they don't have a warehouse-side counterpart for temporary deployment)."
            )
        part = ChemicalPart.query.filter_by(part_number=kit_row.part_number).first()
        if part is None:
            raise ValueError(
                f"Cannot permanently transfer expendable to warehouse: no ChemicalPart "
                f"exists for part_number={kit_row.part_number!r}. Create a ChemicalPart first."
            )
        if not kit_row.lot_number:
            raise ValueError(
                "Cannot permanently transfer expendable to warehouse: expendable has no "
                "lot_number (serial-tracked expendables cannot be materialized as chemical lots)."
            )
        chem = Chemical(
            chemical_part_id=part.id,
            part_number=kit_row.part_number,
            lot_number=kit_row.lot_number,
            description=kit_row.description or part.description,
            quantity=kit_row.quantity,
            unit=kit_row.unit or "each",
            warehouse_id=warehouse.id,
            date_added=datetime.now(),
        )
        db.session.add(chem)
        db.session.flush()
        transfer = _record_kit_transfer(
            item_type="expendable", item_id=kit_row.id,
            from_location_type="kit", from_location_id=kit.id,
            to_location_type="warehouse", to_location_id=warehouse.id,
            quantity=kit_row.quantity, transferred_by=transferred_by, mode="permanent",
            status="completed",
            notes=(notes or "") + f" [materialized as chemical_id={chem.id}]",
        )
        db.session.delete(kit_row)
        _audit(audit_log_fn, user_id=transferred_by, action="transfer_permanent",
               resource_type="kit_transfer", resource_id=transfer.id,
               details={"item_type": "expendable", "kit_id": kit.id,
                        "to_warehouse_id": warehouse.id, "materialized_chemical_id": chem.id})
        return transfer

    raise ValueError(f"Unsupported kit_row type: {type(kit_row).__name__}")


# ----------------------------- kit -> kit -----------------------------

def kit_to_kit(*, source_kit_id, source_row, dest_kit_id, dest_box_id,
               quantity, transferred_by, mode="field", notes=None, audit_log_fn=None):
    """
    Move a kit row to another kit. Carries master_entry_id over when both kits share
    the same master_kit_id; otherwise the destination row is marked is_custom=True.

    Returns the new KitItem or KitExpendable plus the KitTransfer record.
    """
    if mode not in VALID_MODES:
        raise ValueError(f"Invalid mode: {mode!r}; expected one of {VALID_MODES}")

    source_kit = db.session.get(Kit, source_kit_id)
    dest_kit = db.session.get(Kit, dest_kit_id)
    dest_box = db.session.get(KitBox, dest_box_id)
    if source_kit is None:
        raise ValueError(f"Source kit {source_kit_id} not found.")
    if dest_kit is None:
        raise ValueError(f"Destination kit {dest_kit_id} not found.")
    if dest_box is None or dest_box.kit_id != dest_kit.id:
        raise ValueError("Destination box does not belong to the specified kit.")
    if getattr(source_row, "kit_id", None) != source_kit.id:
        raise ValueError(
            f"source_row {getattr(source_row, 'id', None)} does not belong to source kit {source_kit.id}."
        )

    same_master = (
        source_kit.master_kit_id is not None
        and source_kit.master_kit_id == dest_kit.master_kit_id
    )

    if isinstance(source_row, KitItem):
        carry = source_row.master_entry_id if same_master else None
        new_item = KitItem(
            kit_id=dest_kit.id, box_id=dest_box.id,
            item_type=source_row.item_type, item_id=source_row.item_id,
            part_number=source_row.part_number, serial_number=source_row.serial_number,
            lot_number=source_row.lot_number, description=source_row.description,
            quantity=quantity, status="available",
            master_entry_id=carry, is_custom=(carry is None),
        )
        db.session.add(new_item)
        # Partial transfers leave the remainder behind. Tools are always
        # whole-item (quantity==1) so this branch only matters for chemical
        # KitItems where partial quantities are meaningful.
        if quantity < (source_row.quantity or 0):
            source_row.quantity = (source_row.quantity or 0) - quantity
        else:
            db.session.delete(source_row)
        item_type = new_item.item_type
        moved_row = new_item

    elif isinstance(source_row, KitExpendable):
        carry = source_row.master_entry_id if same_master else None
        # Partial transfer: spawn child lot via create_child_expendable helper.
        if quantity < source_row.quantity:
            from utils.lot_utils import create_child_expendable
            new_exp = create_child_expendable(source_row, quantity, dest_kit.id, dest_box.id)
            new_exp.master_entry_id = carry
            new_exp.is_custom = (carry is None)
        else:
            new_exp = KitExpendable(
                kit_id=dest_kit.id, box_id=dest_box.id,
                part_number=source_row.part_number,
                serial_number=source_row.serial_number,
                lot_number=source_row.lot_number,
                tracking_type=source_row.tracking_type,
                description=source_row.description,
                quantity=quantity, unit=source_row.unit,
                minimum_stock_level=source_row.minimum_stock_level,
                master_entry_id=carry, is_custom=(carry is None),
            )
            ok, err = new_exp.validate_tracking()
            if not ok:
                raise ValueError(f"Destination expendable invalid: {err}")
            db.session.add(new_exp)
            db.session.delete(source_row)
        item_type = "expendable"
        moved_row = new_exp

    else:
        raise ValueError(f"Unsupported source_row type: {type(source_row).__name__}")

    db.session.flush()

    transfer = _record_kit_transfer(
        item_type=item_type, item_id=moved_row.id,
        from_location_type="kit", from_location_id=source_kit.id,
        to_location_type="kit", to_location_id=dest_kit.id,
        quantity=quantity, transferred_by=transferred_by, mode=mode,
        status="completed", notes=notes,
    )
    _audit(audit_log_fn, user_id=transferred_by,
           action="transfer_permanent" if mode == "permanent" else "transfer_field",
           resource_type="kit_transfer", resource_id=transfer.id,
           details={"item_type": item_type, "source_kit_id": source_kit.id,
                    "dest_kit_id": dest_kit.id, "carried_master_entry_id": moved_row.master_entry_id})

    return moved_row, transfer


# ----------------------------- cancel / revert -----------------------------

def cancel_permanent_transfer(*, transfer_id, user_id, audit_log_fn=None):
    """
    Cancel a completed permanent transfer by writing a compensating transfer in the
    opposite direction. Both rows are linked via ``reverts_transfer_id``.

    Raises ValueError if the transfer is not eligible (not completed, not permanent,
    or already reverted).
    """
    original = db.session.get(KitTransfer, transfer_id)
    if original is None:
        raise ValueError(f"Transfer {transfer_id} not found.")
    if original.status != "completed":
        raise ValueError("Only completed transfers can be cancelled.")
    if original.transfer_mode != "permanent":
        raise ValueError("Only permanent transfers require compensating reverts.")
    existing = KitTransfer.query.filter_by(reverts_transfer_id=original.id).first()
    if existing is not None:
        raise ValueError(f"Transfer {transfer_id} already reverted by transfer {existing.id}.")

    # Swap directions and apply the corresponding ownership change.
    if original.from_location_type == "warehouse" and original.to_location_type == "kit":
        # Originally warehouse -> kit (permanent). Revert: kit -> warehouse.
        kit = db.session.get(Kit, original.to_location_id)
        if original.item_type == "tool":
            tool = db.session.get(Tool, original.item_id)
            tool.warehouse_id = original.from_location_id
            kit_item = KitItem.query.filter_by(
                kit_id=kit.id, item_type="tool", item_id=tool.id,
            ).order_by(KitItem.id.desc()).first()
            if kit_item:
                db.session.delete(kit_item)
        elif original.item_type == "chemical":
            chem = db.session.get(Chemical, original.item_id)
            chem.warehouse_id = original.from_location_id
            chem.is_archived = False
            chem.archived_reason = None
            kit_item = KitItem.query.filter_by(
                kit_id=kit.id, item_type="chemical", item_id=chem.id,
            ).order_by(KitItem.id.desc()).first()
            if kit_item:
                db.session.delete(kit_item)
    elif original.from_location_type == "kit" and original.to_location_type == "warehouse":
        # Recreate the source-kit row so the audit trail and runtime state agree
        # (otherwise the item appears to have moved back but is unassigned).
        src_kit = db.session.get(Kit, original.from_location_id)
        if src_kit is None:
            raise ValueError(f"Source kit {original.from_location_id} no longer exists; cannot revert.")
        src_box = src_kit.boxes.first()
        if src_box is None:
            raise ValueError(
                "Source kit has no boxes; create one before reverting this transfer."
            )
        if original.item_type == "tool":
            tool = db.session.get(Tool, original.item_id)
            if tool is None:
                raise ValueError(f"Tool {original.item_id} no longer exists; cannot revert.")
            # Detach from the destination warehouse and re-add to the source kit.
            tool.warehouse_id = None
            db.session.add(KitItem(
                kit_id=src_kit.id, box_id=src_box.id,
                item_type="tool", item_id=tool.id,
                part_number=tool.tool_number, serial_number=tool.serial_number,
                description=tool.description, quantity=1, status="available",
            ))
        elif original.item_type == "chemical":
            chem = db.session.get(Chemical, original.item_id)
            if chem is None:
                raise ValueError(f"Chemical {original.item_id} no longer exists; cannot revert.")
            chem.warehouse_id = None
            db.session.add(KitItem(
                kit_id=src_kit.id, box_id=src_box.id,
                item_type="chemical", item_id=chem.id,
                part_number=chem.part_number, lot_number=chem.lot_number,
                description=chem.description, quantity=original.quantity, status="available",
            ))
        elif original.item_type == "expendable":
            # Expendable kit->warehouse permanent transfers materialize a Chemical
            # lot at the destination. Recreating the original KitExpendable from
            # that lot needs the originating lot/serial/tracking_type, which
            # aren't reliably recoverable after the Chemical was created. Reject
            # rather than leave the system in a half-reverted state.
            raise NotImplementedError(
                "Reverting an expendable kit->warehouse permanent transfer is not "
                "supported (the source expendable identity is lost on materialization)."
            )
    elif original.from_location_type == "kit" and original.to_location_type == "kit":
        # Swap directions: we can't undo a delete, so we move the destination row back.
        # Implement only for KitItem-with-tool (single asset); chemicals/expendables
        # would need partial-lot reversal which is out of scope for this revert.
        dest_kit = db.session.get(Kit, original.to_location_id)
        src_kit = db.session.get(Kit, original.from_location_id)
        if original.item_type == "tool":
            dest_item = KitItem.query.filter_by(
                kit_id=dest_kit.id, item_type="tool", item_id=original.item_id,
            ).order_by(KitItem.id.desc()).first()
            if dest_item:
                # Move back: pick any box on the source kit.
                src_box = src_kit.boxes.first()
                if src_box is None:
                    raise ValueError("Source kit has no boxes for revert; create a box first.")
                back = KitItem(
                    kit_id=src_kit.id, box_id=src_box.id,
                    item_type=dest_item.item_type, item_id=dest_item.item_id,
                    part_number=dest_item.part_number, serial_number=dest_item.serial_number,
                    description=dest_item.description, quantity=dest_item.quantity,
                    status="available",
                )
                db.session.add(back)
                db.session.delete(dest_item)

    compensating = _record_kit_transfer(
        item_type=original.item_type, item_id=original.item_id,
        from_location_type=original.to_location_type, from_location_id=original.to_location_id,
        to_location_type=original.from_location_type, to_location_id=original.from_location_id,
        quantity=original.quantity, transferred_by=user_id, mode="permanent",
        status="completed",
        notes=f"Compensating revert of transfer {original.id}",
        reverts_transfer_id=original.id,
    )

    _audit(audit_log_fn, user_id=user_id, action="transfer_permanent_reverted",
           resource_type="kit_transfer", resource_id=compensating.id,
           details={"original_transfer_id": original.id, "item_type": original.item_type,
                    "item_id": original.item_id})

    return compensating
