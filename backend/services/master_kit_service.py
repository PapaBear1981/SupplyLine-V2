"""
Master Kit service.

Centralises the master-kit propagation logic so route handlers stay thin.

Design notes:
- Seeding never auto-creates KitItem rows for tool/chemical entries (we can't conjure
  a serialized Tool or pick a specific Chemical lot from thin air). Those entries are
  surfaced via compliance until populated through the wizard, a transfer, or admin
  action.
- Seeding never auto-creates KitExpendable rows either: KitExpendable.validate_tracking
  rejects rows without a lot_number or serial_number, so placeholders would fail.
  Expendable entries are populated explicitly during the wizard step 3.5 (manual entry
  or CSV import) or via subsequent transfers.
- min_stock_level inheritance is lazy: callers read through `effective_min_stock(row)`
  rather than materialising the master's value onto each kit row. Avoids UPDATE storms
  when the master changes.
- Deletion is soft: on_master_entry_deleted clears the link on kit rows and flips
  is_custom=True so historical issuances and reorders remain intact.
"""

from collections import defaultdict

from models import db


# ----------------------------- seeding -----------------------------

def seed_kit_from_master(kit, master, skip_entry_ids=None):
    """
    Populate ``kit`` with boxes from ``master``. Returns a dict reporting what was
    created and what was deferred to compliance.

    The kit must already be in the session (caller is responsible for db.session.add).
    Caller is also responsible for committing.
    """
    from models_kits import KitBox, MasterKitBox, MasterKitEntry

    skip_entry_ids = set(skip_entry_ids or [])

    existing_box_numbers = {b.box_number for b in kit.boxes.all()}
    created_boxes = []

    for mb in master.boxes.order_by(MasterKitBox.sort_order).all():
        if mb.box_number in existing_box_numbers:
            # Re-link an existing box to its master counterpart without disturbing
            # contents. Useful when running seed on an already-populated kit (relink).
            kb = kit.boxes.filter_by(box_number=mb.box_number).first()
            if kb is not None and kb.master_box_id != mb.id:
                kb.master_box_id = mb.id
                kb.is_custom = False
            continue
        kb = KitBox(
            kit_id=kit.id,
            box_number=mb.box_number,
            box_type=mb.box_type,
            description=mb.description,
            master_box_id=mb.id,
            is_custom=False,
        )
        db.session.add(kb)
        created_boxes.append(kb)

    db.session.flush()

    deferred = []
    for entry in master.entries.order_by(MasterKitEntry.sort_order).all():
        if entry.id in skip_entry_ids:
            continue
        # Seeding never creates KitItem/KitExpendable rows — see module docstring.
        deferred.append({
            "master_entry_id": entry.id,
            "entry_type": entry.entry_type,
            "part_number": entry.part_number,
            "required_quantity": entry.required_quantity,
        })

    kit.master_kit_id = master.id

    return {
        "boxes_created": len(created_boxes),
        "entries_deferred_to_population": deferred,
    }


# ----------------------------- propagation -----------------------------

def on_master_entry_created(entry):
    """Hook for after a new master entry is added.

    No-op in the current design: compliance is computed lazily so newly added entries
    automatically show as "missing" for every linked kit on the next read. This function
    exists so route handlers have a stable seam to call.
    """
    return {"action": "deferred_to_compliance", "entry_id": entry.id}


def on_master_entry_updated(entry, changed_fields):
    """
    Hook for after a master entry is updated.

    Most fields propagate lazily via ``effective_min_stock`` / compliance. The exceptions
    are ``entry_type`` and ``part_number`` — both feed the kit-side match key, so we must
    re-link kit rows whose old key no longer matches.
    """
    if not any(f in changed_fields for f in ("entry_type", "part_number")):
        return {"action": "lazy", "entry_id": entry.id}

    from models_kits import KitExpendable, KitItem

    # Anything currently linked to this entry whose (entry_type, part_number) no longer
    # matches must be unlinked.
    items = KitItem.query.filter_by(master_entry_id=entry.id).all()
    unlinked = 0
    for item in items:
        if item.item_type != entry.entry_type or (item.part_number or "").strip() != (entry.part_number or "").strip():
            item.master_entry_id = None
            item.is_custom = True
            unlinked += 1
    expendables = KitExpendable.query.filter_by(master_entry_id=entry.id).all()
    for exp in expendables:
        if entry.entry_type != "expendable" or (exp.part_number or "").strip() != (entry.part_number or "").strip():
            exp.master_entry_id = None
            exp.is_custom = True
            unlinked += 1

    return {"action": "rekeyed", "entry_id": entry.id, "rows_unlinked": unlinked}


def on_master_entry_deleted(entry_id):
    """Soft-unlink kit rows that referenced this entry. Caller deletes the entry itself."""
    from models_kits import KitExpendable, KitItem

    unlinked = 0
    for row in KitItem.query.filter_by(master_entry_id=entry_id).all():
        row.master_entry_id = None
        row.is_custom = True
        unlinked += 1
    for row in KitExpendable.query.filter_by(master_entry_id=entry_id).all():
        row.master_entry_id = None
        row.is_custom = True
        unlinked += 1

    # Boxes linked to a deleted master box: same treatment.
    from models_kits import KitBox, MasterKitEntry
    entry = db.session.get(MasterKitEntry, entry_id)
    if entry and entry.master_box_id:
        # Only unlink boxes if THIS was the last entry referencing the master box —
        # otherwise we leave the box link intact.
        siblings = MasterKitEntry.query.filter(
            MasterKitEntry.master_box_id == entry.master_box_id,
            MasterKitEntry.id != entry_id,
        ).count()
        if siblings == 0:
            for kb in KitBox.query.filter_by(master_box_id=entry.master_box_id).all():
                kb.master_box_id = None
                kb.is_custom = True

    return {"action": "soft_unlinked", "entry_id": entry_id, "rows_unlinked": unlinked}


# ----------------------------- compliance -----------------------------

def effective_min_stock(row):
    """Return the minimum stock level for a kit row, honouring override + inheritance."""
    override = getattr(row, "min_stock_override", None)
    if override is not None:
        return override
    if row.master_entry_id and row.master_entry:
        return row.master_entry.minimum_stock_level
    return getattr(row, "minimum_stock_level", None)


def compute_compliance(kit):
    """
    Diff a kit against its master. Returns
    ``{ missing: [...], extras: [...], deviations: [...], percent_compliant: float }``.

    Match key: (entry_type, part_number). For chemicals, dereference the Chemical lot to
    its ChemicalPart.part_number for comparison so legacy lots and lots created from
    the same ChemicalPart both match.
    """
    if not kit.master_kit_id or kit.master_kit is None:
        return {
            "missing": [],
            "extras": [],
            "deviations": [],
            "percent_compliant": None,
            "linked_to_master": False,
        }

    master = kit.master_kit
    master_entries = list(master.entries.all())

    # Build the present-in-kit index from KitItem + KitExpendable.
    present = defaultdict(list)
    from models import Chemical
    for item in kit.items.all():
        if item.item_type == "chemical":
            chem = db.session.get(Chemical, item.item_id)
            if chem and getattr(chem, "chemical_part_id", None) is not None:
                # Use the ChemicalPart.part_number as the canonical key.
                pn = (chem.chemical_part.part_number if chem.chemical_part else chem.part_number) or ""
                present[("chemical", pn.strip())].append(item)
                continue
        pn = (item.part_number or "").strip()
        present[(item.item_type, pn)].append(item)
    for exp in kit.expendables.all():
        pn = (exp.part_number or "").strip()
        present[("expendable", pn)].append(exp)

    missing = []
    deviations = []
    matched_keys = set()
    required_total = 0
    for entry in master_entries:
        key = (entry.entry_type, (entry.part_number or "").strip())
        # Optional entries are tracked for matching (so they're not counted as extras)
        # but never add to missing/deviations or the compliance denominator.
        if entry.is_required:
            required_total += 1
        rows = present.get(key, [])
        if not rows:
            if entry.is_required:
                missing.append({
                    "master_entry_id": entry.id,
                    "entry_type": entry.entry_type,
                    "part_number": entry.part_number,
                    "description": entry.description,
                    "required_quantity": entry.required_quantity,
                    "unit": entry.unit,
                })
            continue
        matched_keys.add(key)
        total_qty = sum((r.quantity or 0.0) for r in rows)
        if entry.is_required and entry.required_quantity and total_qty + 1e-9 < entry.required_quantity:
            deviations.append({
                "master_entry_id": entry.id,
                "entry_type": entry.entry_type,
                "part_number": entry.part_number,
                "expected_quantity": entry.required_quantity,
                "actual_quantity": total_qty,
                "reason": "quantity_short",
            })

    extras = []
    for key, rows in present.items():
        if key in matched_keys:
            continue
        entry_type, part_number = key
        # If any row carries a master_entry_id (master entry was deleted, kept as custom)
        # surface as orphan; otherwise it's a user-added extra.
        for row in rows:
            extras.append({
                "kit_row_id": row.id,
                "row_kind": "expendable" if entry_type == "expendable" else "item",
                "entry_type": entry_type,
                "part_number": part_number,
                "description": getattr(row, "description", None),
                "quantity": row.quantity,
                "is_orphan": row.master_entry_id is not None,
            })

    compliant_count = required_total - len(missing) - len(deviations)
    pct = (compliant_count / required_total * 100.0) if required_total else 100.0

    return {
        "missing": missing,
        "extras": extras,
        "deviations": deviations,
        "percent_compliant": round(pct, 1),
        "linked_to_master": True,
        "master_kit_id": master.id,
        "master_kit_name": master.name,
    }


# ----------------------------- wizard population -----------------------------

def populate_from_wizard(kit, entry_population, current_user_id, audit_log_fn=None):
    """
    Given a list of populated entries from the wizard's step 3.5 payload, create the
    corresponding KitItem/KitExpendable rows. For tool entries and chemical entries
    pulled from inventory, ALSO fire a warehouse->kit transfer via transfer_service.

    ``entry_population`` is a list of dicts:
        {
          "master_entry_id": int,
          "mode": "manual" | "import" | "inventory",
          "items": [
            { "serial_number"?: str, "lot_number"?: str, "quantity"?: float,
              "tool_id"?: int, "chemical_id"?: int }
          ]
        }

    Returns ``{ "items_created": int, "expendables_created": int, "transfers_created": [ids...] }``.

    Raises ValueError on validation failures so the caller can wrap with handle_errors.
    """
    from models import Tool
    from models_kits import KitBox, KitExpendable, KitItem, MasterKitEntry

    summary = {"items_created": 0, "expendables_created": 0, "transfers_created": []}

    if not entry_population:
        return summary

    # Pre-load entries we'll reference.
    entry_ids = {e.get("master_entry_id") for e in entry_population if e.get("master_entry_id")}
    entries_by_id = {e.id: e for e in MasterKitEntry.query.filter(MasterKitEntry.id.in_(entry_ids)).all()}

    # Identify the destination box for each entry.
    def _box_for(entry):
        kb = KitBox.query.filter_by(kit_id=kit.id, master_box_id=entry.master_box_id).first()
        if kb is None:
            # Fall back to the first kit box if seeding didn't link the master box (legacy kits).
            kb = kit.boxes.first()
        return kb

    for ep in entry_population:
        entry = entries_by_id.get(ep.get("master_entry_id"))
        if entry is None:
            raise ValueError(f"Unknown master_entry_id: {ep.get('master_entry_id')}")
        if entry.master_kit_id != kit.master_kit_id:
            raise ValueError(
                f"master_entry_id {entry.id} does not belong to this kit's master "
                f"(kit.master_kit_id={kit.master_kit_id}, entry.master_kit_id={entry.master_kit_id})"
            )

        box = _box_for(entry)
        if box is None:
            raise ValueError(f"Kit {kit.id} has no boxes; cannot place entry {entry.id}.")

        # ep["mode"] ('manual' | 'import' | 'inventory') is informational and currently
        # affects only the dispatch within this loop; the result is identical regardless.
        rows = ep.get("items") or []
        for row in rows:
            if entry.entry_type == "expendable":
                serial = row.get("serial_number") or None
                lot = row.get("lot_number") or None
                # Run the same global uniqueness check the regular add-expendable
                # API uses so wizard imports can't smuggle in duplicate
                # serial/lot identities.
                from utils.serial_lot_validation import (
                    SerialLotValidationError,
                    validate_item_tracking,
                )
                try:
                    validate_item_tracking(
                        part_number=entry.part_number,
                        serial_number=serial,
                        lot_number=lot,
                        item_type="expendable",
                    )
                except SerialLotValidationError as e:
                    raise ValueError(f"Expendable validation failed for entry {entry.id}: {e}")
                exp = KitExpendable(
                    kit_id=kit.id,
                    box_id=box.id,
                    part_number=entry.part_number,
                    serial_number=serial,
                    lot_number=lot,
                    tracking_type=entry.tracking_type or "lot",
                    description=row.get("description") or entry.description or entry.part_number,
                    quantity=float(row.get("quantity") or 1.0),
                    unit=entry.unit or "each",
                    minimum_stock_level=entry.minimum_stock_level,
                    master_entry_id=entry.id,
                    is_custom=False,
                )
                ok, err = exp.validate_tracking()
                if not ok:
                    raise ValueError(f"Expendable validation failed for entry {entry.id}: {err}")
                db.session.add(exp)
                summary["expendables_created"] += 1

            elif entry.entry_type == "tool":
                tool_id = row.get("tool_id")
                serial = row.get("serial_number")
                tool = None
                if tool_id is not None:
                    tool = db.session.get(Tool, tool_id)
                if tool is None and serial:
                    tool = Tool.query.filter_by(serial_number=serial).first()
                if tool is None:
                    raise ValueError(
                        f"Tool not found for entry {entry.id}: tool_id={tool_id} serial={serial}"
                    )
                # The chosen tool must actually match the master entry — by
                # ref_tool_id when the entry pins a specific tool, otherwise
                # by part_number (the canonical compliance key).
                if entry.ref_tool_id is not None and tool.id != entry.ref_tool_id:
                    raise ValueError(
                        f"Tool {tool.id} does not match master entry {entry.id} "
                        f"(expected tool_id={entry.ref_tool_id})."
                    )
                if entry.part_number and (tool.tool_number or "").strip() != entry.part_number.strip():
                    raise ValueError(
                        f"Tool part_number {tool.tool_number!r} does not match master entry "
                        f"{entry.part_number!r}."
                    )
                # Defer field-mode warehouse->kit transfer to transfer_service so the
                # source warehouse_id handling lives in one place.
                from services.transfer_service import warehouse_to_kit
                t = warehouse_to_kit(
                    item_type="tool", item_id=tool.id, kit_id=kit.id,
                    quantity=1.0, transferred_by=current_user_id, mode="field",
                    audit_log_fn=audit_log_fn,
                )
                summary["transfers_created"].append(t.id)
                # warehouse_to_kit creates the KitItem; just link it back to the master entry.
                ki = KitItem.query.filter_by(
                    kit_id=kit.id, item_type="tool", item_id=tool.id,
                ).order_by(KitItem.id.desc()).first()
                if ki is not None:
                    ki.master_entry_id = entry.id
                    ki.is_custom = False
                    ki.box_id = box.id
                    summary["items_created"] += 1

            elif entry.entry_type == "chemical":
                chemical_id = row.get("chemical_id")
                if chemical_id is None:
                    raise ValueError(
                        f"Chemical entry {entry.id} requires chemical_id (selected from inventory)."
                    )
                # The chosen chemical lot must point at the same ChemicalPart the
                # master entry references; otherwise the kit row would satisfy
                # the wrong line.
                from models import Chemical
                chem = db.session.get(Chemical, chemical_id)
                if chem is None:
                    raise ValueError(f"Chemical {chemical_id} not found.")
                if entry.ref_chemical_part_id and getattr(chem, "chemical_part_id", None) != entry.ref_chemical_part_id:
                    raise ValueError(
                        f"Chemical lot {chem.id} (part_id={chem.chemical_part_id}) does not "
                        f"match master entry {entry.id} (expected part_id={entry.ref_chemical_part_id})."
                    )
                from services.transfer_service import warehouse_to_kit
                t = warehouse_to_kit(
                    item_type="chemical", item_id=chemical_id, kit_id=kit.id,
                    quantity=float(row.get("quantity") or 1.0),
                    transferred_by=current_user_id, mode="field",
                    audit_log_fn=audit_log_fn,
                )
                summary["transfers_created"].append(t.id)
                ki = KitItem.query.filter_by(
                    kit_id=kit.id, item_type="chemical", item_id=chemical_id,
                ).order_by(KitItem.id.desc()).first()
                if ki is not None:
                    ki.master_entry_id = entry.id
                    ki.is_custom = False
                    ki.box_id = box.id
                    summary["items_created"] += 1
            else:
                raise ValueError(f"Unknown entry_type: {entry.entry_type}")

    return summary
