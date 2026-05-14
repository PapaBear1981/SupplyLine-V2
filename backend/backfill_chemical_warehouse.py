"""
One-off recovery script: assign a warehouse to chemical lots that were
imported without one.

The bulk chemical import used to leave ``warehouse_id`` NULL on every
imported lot when the CSV didn't carry a ``warehouse_id`` column. Those
lots are invisible in the warehouse-scoped chemical inventory views (the
part shows a rolled-up quantity of 0 and no lot detail). The import code
has since been fixed to default to the importing admin's active
warehouse, but lots imported before that fix still need to be backfilled.

Run it from inside the backend container (working dir /app):
    python backfill_chemical_warehouse.py --dry-run   # preview only
    python backfill_chemical_warehouse.py             # assign to "GEG", apply
    python backfill_chemical_warehouse.py --warehouse "Main Warehouse"
    python backfill_chemical_warehouse.py --warehouse 3
"""

import argparse
import sys

from models import Chemical, Warehouse, db
from run import app


DEFAULT_WAREHOUSE = "GEG"


def resolve_warehouse(identifier):
    """Look up a warehouse by numeric id or by (case-insensitive) name."""
    if isinstance(identifier, str) and identifier.isdigit():
        identifier = int(identifier)

    if isinstance(identifier, int):
        return db.session.get(Warehouse, identifier)

    return Warehouse.query.filter(
        db.func.lower(Warehouse.name) == identifier.lower()
    ).first()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--warehouse",
        default=DEFAULT_WAREHOUSE,
        help=f'Target warehouse name or id (default: "{DEFAULT_WAREHOUSE}")',
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing to the database",
    )
    args = parser.parse_args()

    with app.app_context():
        warehouse = resolve_warehouse(args.warehouse)
        if warehouse is None:
            print(f'ERROR: No warehouse matching "{args.warehouse}".')
            print("Available warehouses:")
            for w in Warehouse.query.order_by(Warehouse.name).all():
                active = "" if w.is_active else " (inactive)"
                print(f"  [{w.id}] {w.name}{active}")
            sys.exit(1)

        if not warehouse.is_active:
            print(
                f'ERROR: Warehouse "{warehouse.name}" is inactive. '
                "Reactivate it or pick another."
            )
            sys.exit(1)

        orphans = Chemical.query.filter(Chemical.warehouse_id.is_(None)).all()
        if not orphans:
            print("No chemical lots with a NULL warehouse. Nothing to do.")
            return

        print(
            f"Found {len(orphans)} chemical lot(s) with no warehouse. "
            f"Target: [{warehouse.id}] {warehouse.name}"
        )
        for chemical in orphans:
            print(
                f"  - {chemical.part_number} / lot {chemical.lot_number} "
                f"(qty {chemical.quantity} {chemical.unit})"
            )

        if args.dry_run:
            print("\n--dry-run: no changes written.")
            return

        for chemical in orphans:
            chemical.warehouse_id = warehouse.id

        db.session.commit()
        print(
            f"\nDone. Assigned {len(orphans)} lot(s) to "
            f'"{warehouse.name}".'
        )


if __name__ == "__main__":
    main()
