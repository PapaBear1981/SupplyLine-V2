"""
One-off recovery script: assign a warehouse to tools that were imported
without one.

The bulk tool import used to leave ``warehouse_id`` NULL on every imported
tool when the CSV didn't carry a ``warehouse_id`` column. Those tools are
invisible in the warehouse-scoped tools inventory view (the table only
populates them when "All warehouses" is toggled on). The import code has
since been fixed to default to the importing admin's active warehouse, but
tools imported before that fix still need to be backfilled.

Usage:
    python scripts/backfill_tool_warehouse.py            # assign to "GEG", apply
    python scripts/backfill_tool_warehouse.py --dry-run  # preview only
    python scripts/backfill_tool_warehouse.py --warehouse "Main Warehouse"
    python scripts/backfill_tool_warehouse.py --warehouse 3
"""

import argparse
import os
import sys

# Add parent directory to path so ``backend`` is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.models import Tool, Warehouse, db
from backend.run import app


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

        orphans = Tool.query.filter(Tool.warehouse_id.is_(None)).all()
        if not orphans:
            print("No tools with a NULL warehouse. Nothing to do.")
            return

        print(
            f"Found {len(orphans)} tool(s) with no warehouse. "
            f'Target: [{warehouse.id}] {warehouse.name}'
        )
        for tool in orphans:
            print(
                f"  - {tool.tool_number} / serial {tool.serial_number} "
                f"({tool.description})"
            )

        if args.dry_run:
            print("\n--dry-run: no changes written.")
            return

        for tool in orphans:
            tool.warehouse_id = warehouse.id

        db.session.commit()
        print(
            f"\nDone. Assigned {len(orphans)} tool(s) to "
            f'"{warehouse.name}".'
        )


if __name__ == "__main__":
    main()
