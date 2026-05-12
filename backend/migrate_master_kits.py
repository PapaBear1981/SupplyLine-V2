"""
Migration: introduce Master Kit Lists.

Adds three new tables (master_kits, master_kit_boxes, master_kit_entries) plus
override columns on kits, kit_boxes, kit_items, kit_expendables, and kit_transfers.
After the schema is in place, infers one MasterKit per AircraftType from the
existing population (most-populous kit as the template, entries that appear in
>=50% of that aircraft type's kits) and backfills master_entry_id on linked rows.

Usage:
    python migrate_master_kits.py                # apply migration
    python migrate_master_kits.py --dry-run      # report only, no writes
    python migrate_master_kits.py --threshold .5 # adjust inference threshold

Idempotent: safe to re-run. Skips tables/columns that already exist and skips
aircraft types that already have an active master.
"""

import argparse
import sys
from collections import defaultdict
from statistics import median

from sqlalchemy import inspect, text


def _existing_columns(inspector, table):
    if table not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(table)}


def _add_column(conn, dialect, table, column_def):
    """ALTER TABLE ... ADD COLUMN ... with portable syntax."""
    sql = f"ALTER TABLE {table} ADD COLUMN {column_def}"
    conn.execute(text(sql))


def _ensure_columns(conn, inspector, dialect, dry_run, report):
    """Add the override columns the new feature needs."""
    targets = {
        "kits": [
            ("master_kit_id", "INTEGER"),
        ],
        "kit_boxes": [
            ("master_box_id", "INTEGER"),
            ("is_custom", "BOOLEAN NOT NULL DEFAULT 0" if dialect == "sqlite" else "BOOLEAN NOT NULL DEFAULT FALSE"),
        ],
        "kit_items": [
            ("master_entry_id", "INTEGER"),
            ("is_custom", "BOOLEAN NOT NULL DEFAULT 0" if dialect == "sqlite" else "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("min_stock_override", "FLOAT"),
        ],
        "kit_expendables": [
            ("master_entry_id", "INTEGER"),
            ("is_custom", "BOOLEAN NOT NULL DEFAULT 0" if dialect == "sqlite" else "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("min_stock_override", "FLOAT"),
        ],
        "kit_transfers": [
            ("transfer_mode", "VARCHAR(20) NOT NULL DEFAULT 'field'"),
            ("reverts_transfer_id", "INTEGER"),
        ],
    }
    for table, cols in targets.items():
        existing = _existing_columns(inspector, table)
        for name, type_ in cols:
            if name in existing:
                report["columns_skipped"].append(f"{table}.{name}")
                continue
            report["columns_added"].append(f"{table}.{name}")
            if not dry_run:
                _add_column(conn, dialect, table, f"{name} {type_}")


def _create_new_tables(db, inspector, dry_run, report):
    """Create master_kits, master_kit_boxes, master_kit_entries via SQLAlchemy."""
    from models_kits import MasterKit, MasterKitBox, MasterKitEntry  # noqa: F401

    needed = ["master_kits", "master_kit_boxes", "master_kit_entries"]
    missing = [t for t in needed if t not in inspector.get_table_names()]
    report["tables_to_create"] = missing
    if missing and not dry_run:
        db.metadata.create_all(bind=db.engine, tables=[db.metadata.tables[t] for t in missing])


def _infer_masters(db, threshold, dry_run, report):
    """For each AircraftType, build a MasterKit from its existing kits."""
    from models import ChemicalPart, Tool
    from models_kits import (
        AircraftType,
        Kit,
        KitBox,
        MasterKit,
        MasterKitBox,
        MasterKitEntry,
    )

    aircraft_types = AircraftType.query.filter_by(is_active=True).all()
    for at in aircraft_types:
        existing = MasterKit.query.filter_by(aircraft_type_id=at.id, is_active=True).first()
        if existing:
            report["aircraft_skipped_existing_master"].append(at.name)
            continue

        kits = Kit.query.filter_by(aircraft_type_id=at.id).all()
        if not kits:
            report["aircraft_skipped_no_kits"].append(at.name)
            continue

        def score(kit):
            return (kit.boxes.count() + kit.items.count() + kit.expendables.count(),
                    kit.updated_at)
        template_kit = max(kits, key=score)

        # Aggregate entry occurrences across all kits of this aircraft type.
        # Key: (entry_type, part_number); Value: list of (quantity, source_row)
        occurrences = defaultdict(list)
        for kit in kits:
            seen_in_kit = set()
            for item in kit.items.all():
                key = (item.item_type, (item.part_number or "").strip())
                if not key[1] or key in seen_in_kit:
                    continue
                seen_in_kit.add(key)
                occurrences[key].append((item.quantity or 1.0, item))
            for exp in kit.expendables.all():
                key = ("expendable", (exp.part_number or "").strip())
                if not key[1] or key in seen_in_kit:
                    continue
                seen_in_kit.add(key)
                occurrences[key].append((exp.quantity or 1.0, exp))

        total_kits = len(kits)
        kept_entries = {
            key: rows for key, rows in occurrences.items()
            if len(rows) / total_kits >= threshold
        }

        report["masters"].append({
            "aircraft_type": at.name,
            "template_kit": template_kit.name,
            "kits_considered": total_kits,
            "boxes": template_kit.boxes.count(),
            "entries_inferred": len(kept_entries),
            "entries_dropped_below_threshold": len(occurrences) - len(kept_entries),
        })

        if dry_run:
            continue

        # Per-aircraft-type atomicity: anything we write below is wrapped in a
        # savepoint so a single bad entry rolls back the partial master, the
        # boxes, and any kit-row backfill we'd already applied for THIS
        # aircraft type. Other aircraft types keep their commits.
        validation_failures_this_pass = []
        try:
            sp = db.session.begin_nested()
        except Exception:
            # SQLAlchemy raises if the session has no outer transaction; rare in
            # the migrate flow but harmless to fall through without a savepoint.
            sp = None

        master = MasterKit(
            aircraft_type_id=at.id,
            name=f"{at.name} Master Kit",
            description=f"Inferred from {template_kit.name} on initial migration",
            is_active=True,
        )
        db.session.add(master)
        db.session.flush()

        # Boxes are taken from the template kit so box numbers match what users
        # already know. We sort them by box_number for deterministic ordering.
        master_boxes_by_number = {}
        for sort_order, box in enumerate(template_kit.boxes.order_by(KitBox.box_number).all()):
            mb = MasterKitBox(
                master_kit_id=master.id,
                box_number=box.box_number,
                box_type=box.box_type,
                description=box.description,
                sort_order=sort_order,
            )
            db.session.add(mb)
            db.session.flush()
            master_boxes_by_number[box.box_number] = mb

        # Default any unmatched entries into the first box (sorted) — they still
        # need to live somewhere. Operators can re-bucket them in the admin UI.
        default_box = next(iter(master_boxes_by_number.values()), None)
        if default_box is None:
            # Edge case: template kit has no boxes. Create a single 'Default' box.
            default_box = MasterKitBox(
                master_kit_id=master.id,
                box_number="Default",
                box_type="loose",
                description="Auto-created",
                sort_order=0,
            )
            db.session.add(default_box)
            db.session.flush()
            master_boxes_by_number["Default"] = default_box

        # Decide which template box each entry lives in by inspecting the template_kit rows.
        template_box_by_part = {}
        for item in template_kit.items.all():
            if item.part_number:
                template_box_by_part[(item.item_type, item.part_number.strip())] = item.box.box_number if item.box else None
        for exp in template_kit.expendables.all():
            template_box_by_part[("expendable", exp.part_number.strip())] = exp.box.box_number if exp.box else None

        for (entry_type, part_number), rows in kept_entries.items():
            box_number = template_box_by_part.get((entry_type, part_number))
            target_box = master_boxes_by_number.get(box_number) or default_box

            qty_median = median([r[0] for r in rows])
            sample_row = rows[0][1]
            description = getattr(sample_row, "description", None) or part_number
            unit = getattr(sample_row, "unit", None) or "each"
            tracking_type = getattr(sample_row, "tracking_type", None) if entry_type == "expendable" else None
            min_stock = getattr(sample_row, "minimum_stock_level", None)

            ref_tool_id = None
            ref_chemical_part_id = None
            if entry_type == "tool":
                tool = Tool.query.filter_by(tool_number=part_number).first()
                ref_tool_id = tool.id if tool else None
            elif entry_type == "chemical":
                part = ChemicalPart.query.filter_by(part_number=part_number).first()
                ref_chemical_part_id = part.id if part else None
                if ref_chemical_part_id is None:
                    # Chemical entries require a ChemicalPart ref — skip if none found,
                    # but record it so operators can clean up.
                    report["chemical_entries_missing_part"].append(f"{at.name}: {part_number}")
                    continue

            entry = MasterKitEntry(
                master_kit_id=master.id,
                master_box_id=target_box.id,
                entry_type=entry_type,
                ref_tool_id=ref_tool_id,
                ref_chemical_part_id=ref_chemical_part_id,
                part_number=part_number,
                description=description,
                required_quantity=qty_median,
                minimum_stock_level=min_stock,
                unit=unit,
                tracking_type=tracking_type if entry_type == "expendable" else None,
                is_required=True,
                sort_order=0,
            )
            ok, err = entry.validate_refs()
            if not ok:
                msg = f"{at.name}: {entry_type} {part_number} — {err}"
                report["entries_validation_failed"].append(msg)
                validation_failures_this_pass.append(msg)
                continue
            db.session.add(entry)
            db.session.flush()

        # Link the kits + their rows back to this master.
        master_entries = MasterKitEntry.query.filter_by(master_kit_id=master.id).all()
        entry_lookup = {(e.entry_type, e.part_number): e.id for e in master_entries}

        for kit in kits:
            kit.master_kit_id = master.id
            # Link boxes by box_number.
            for box in kit.boxes.all():
                mb = master_boxes_by_number.get(box.box_number)
                box.master_box_id = mb.id if mb else None
                box.is_custom = mb is None
            # Link items / expendables.
            for item in kit.items.all():
                eid = entry_lookup.get((item.item_type, (item.part_number or "").strip()))
                item.master_entry_id = eid
                item.is_custom = eid is None
            for exp in kit.expendables.all():
                eid = entry_lookup.get(("expendable", (exp.part_number or "").strip()))
                exp.master_entry_id = eid
                exp.is_custom = eid is None

        if validation_failures_this_pass and sp is not None:
            # One or more entries failed validation — undo everything we
            # inserted for this aircraft type so re-running can complete it
            # cleanly once the underlying data is fixed.
            sp.rollback()
            report.setdefault("aircraft_rolled_back", []).append(at.name)
            continue
        if sp is not None:
            sp.commit()
        db.session.commit()


def _build_report():
    return {
        "tables_to_create": [],
        "columns_added": [],
        "columns_skipped": [],
        "aircraft_skipped_existing_master": [],
        "aircraft_skipped_no_kits": [],
        "masters": [],
        "chemical_entries_missing_part": [],
        "entries_validation_failed": [],
    }


def _print_report(report, dry_run):
    print()
    print("=" * 70)
    print("Master Kit migration report" + (" (DRY RUN — no changes written)" if dry_run else ""))
    print("=" * 70)
    print(f"Tables to create: {report['tables_to_create']}")
    print(f"Columns added:    {len(report['columns_added'])}  ({', '.join(report['columns_added']) or 'none'})")
    if report["columns_skipped"]:
        print(f"Columns skipped (already present): {len(report['columns_skipped'])}")
    if report["aircraft_skipped_existing_master"]:
        print(f"Skipped (existing master): {report['aircraft_skipped_existing_master']}")
    if report["aircraft_skipped_no_kits"]:
        print(f"Skipped (no kits): {report['aircraft_skipped_no_kits']}")
    print()
    print("Inferred masters:")
    for m in report["masters"]:
        print(f"  - {m['aircraft_type']}: template={m['template_kit']} kits={m['kits_considered']} "
              f"boxes={m['boxes']} entries={m['entries_inferred']} "
              f"(dropped {m['entries_dropped_below_threshold']} below threshold)")
    if report["chemical_entries_missing_part"]:
        print()
        print("Chemical entries skipped (no ChemicalPart found):")
        for line in report["chemical_entries_missing_part"]:
            print(f"  - {line}")
    if report["entries_validation_failed"]:
        print()
        print("Entry validation failures (entry NOT inserted):")
        for line in report["entries_validation_failed"]:
            print(f"  - {line}")
    print("=" * 70)


def migrate_database(dry_run=False, threshold=0.5):
    """Apply the migration. Returns the report dict."""
    from app import create_app
    from models import db
    app = create_app()

    report = _build_report()
    with app.app_context():
        inspector = inspect(db.engine)
        dialect = db.engine.dialect.name

        _create_new_tables(db, inspector, dry_run, report)
        # Refresh inspector after potentially creating tables.
        inspector = inspect(db.engine)

        with db.engine.begin() as conn:
            _ensure_columns(conn, inspector, dialect, dry_run, report)

        if not dry_run:
            _infer_masters(db, threshold, dry_run, report)
        else:
            # In dry-run mode we still want to compute what the inference would produce,
            # but without committing. Use a SAVEPOINT-style approach: run within a
            # transaction we'll rollback at the end.
            try:
                _infer_masters(db, threshold, dry_run, report)
            except Exception as e:
                report["dry_run_inference_error"] = str(e)

    return report


def main():
    parser = argparse.ArgumentParser(description="Migrate database to support Master Kit Lists.")
    parser.add_argument("--dry-run", action="store_true", help="Report only; do not write.")
    parser.add_argument(
        "--threshold", type=float, default=0.5,
        help="Fraction of kits an entry must appear in to be inferred (default 0.5).",
    )
    args = parser.parse_args()
    if not 0.0 <= args.threshold <= 1.0:
        parser.error("--threshold must be between 0 and 1")

    report = migrate_database(dry_run=args.dry_run, threshold=args.threshold)
    _print_report(report, dry_run=args.dry_run)

    if report.get("entries_validation_failed") and not args.dry_run:
        # Validation issues should surface as a non-zero exit so CI catches them.
        sys.exit(1)


if __name__ == "__main__":
    main()
