"""
Migration script to create master_chemicals and chemical_warehouse_settings tables,
and migrate existing chemical data to the new schema.

Run with: python migrations/create_master_chemicals_tables.py
"""

import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db, Chemical, MasterChemical, ChemicalWarehouseSetting, Warehouse
from sqlalchemy import inspect, text
import json

def migrate():
    app = create_app()

    with app.app_context():
        inspector = inspect(db.engine)

        print("=" * 80)
        print("Master Chemical Migration Script")
        print("=" * 80)
        print()

        # Step 1: Create new tables
        print("Step 1: Creating new tables...")
        print("-" * 80)

        if "master_chemicals" not in inspector.get_table_names():
            MasterChemical.__table__.create(db.engine)
            print("  ✓ Created master_chemicals table")
        else:
            print("  - master_chemicals table already exists")

        if "chemical_warehouse_settings" not in inspector.get_table_names():
            ChemicalWarehouseSetting.__table__.create(db.engine)
            print("  ✓ Created chemical_warehouse_settings table")
        else:
            print("  - chemical_warehouse_settings table already exists")

        print()

        # Step 2: Add new columns to chemicals table
        print("Step 2: Adding new columns to chemicals table...")
        print("-" * 80)

        columns = [col["name"] for col in inspector.get_columns("chemicals")]

        if "master_chemical_id" not in columns:
            db.session.execute(text(
                "ALTER TABLE chemicals ADD COLUMN master_chemical_id INTEGER REFERENCES master_chemicals(id) ON DELETE RESTRICT"
            ))
            db.session.execute(text(
                "CREATE INDEX idx_chemicals_master_chemical_id ON chemicals(master_chemical_id)"
            ))
            print("  ✓ Added master_chemical_id column and index")
        else:
            print("  - master_chemical_id column already exists")

        if "expiration_date_override" not in columns:
            db.session.execute(text(
                "ALTER TABLE chemicals ADD COLUMN expiration_date_override BOOLEAN DEFAULT FALSE NOT NULL"
            ))
            print("  ✓ Added expiration_date_override column")
        else:
            print("  - expiration_date_override column already exists")

        if "manufacture_date" not in columns:
            db.session.execute(text(
                "ALTER TABLE chemicals ADD COLUMN manufacture_date TIMESTAMP"
            ))
            print("  ✓ Added manufacture_date column")
        else:
            print("  - manufacture_date column already exists")

        if "received_date" not in columns:
            db.session.execute(text(
                "ALTER TABLE chemicals ADD COLUMN received_date TIMESTAMP"
            ))
            print("  ✓ Added received_date column")
        else:
            print("  - received_date column already exists")

        db.session.commit()
        print()

        # Step 3: Analyze existing chemicals
        print("Step 3: Analyzing existing chemicals...")
        print("-" * 80)

        existing_chemicals = Chemical.query.all()
        print(f"  Found {len(existing_chemicals)} existing chemical lot records")

        # Group by part_number to identify unique chemicals
        chemical_groups = defaultdict(list)
        for chem in existing_chemicals:
            chemical_groups[chem.part_number].append(chem)

        print(f"  Found {len(chemical_groups)} unique part numbers")
        print()

        # Step 4: Create master chemicals
        print("Step 4: Creating master chemicals from existing data...")
        print("-" * 80)

        master_chemical_map = {}  # part_number -> MasterChemical
        created_count = 0
        skipped_count = 0

        for part_number, lots in chemical_groups.items():
            # Check if master chemical already exists
            existing_master = MasterChemical.query.filter_by(part_number=part_number).first()
            if existing_master:
                master_chemical_map[part_number] = existing_master
                skipped_count += 1
                continue

            # Use the first lot's data as template for master chemical
            template = lots[0]

            # Estimate shelf life from existing lots with expiration dates
            shelf_life_days = None
            for lot in lots:
                if lot.expiration_date and lot.date_added:
                    days_diff = (lot.expiration_date - lot.date_added).days
                    if days_diff > 0 and days_diff < 7300:  # Reasonable range
                        shelf_life_days = days_diff
                        break

            # Create master chemical
            master_chemical = MasterChemical(
                part_number=part_number,
                description=template.description or f"Migrated chemical {part_number}",
                manufacturer=template.manufacturer,
                category=template.category or "General",
                unit=template.unit or "each",
                shelf_life_days=shelf_life_days,
                is_active=True,
            )

            db.session.add(master_chemical)
            db.session.flush()  # Get ID

            master_chemical_map[part_number] = master_chemical
            created_count += 1

            if created_count % 50 == 0:
                print(f"  Created {created_count} master chemicals...")

        print(f"  ✓ Created {created_count} new master chemicals")
        if skipped_count > 0:
            print(f"  - Skipped {skipped_count} existing master chemicals")
        db.session.commit()
        print()

        # Step 5: Link existing chemical lots to master chemicals
        print("Step 5: Linking existing chemical lots to master chemicals...")
        print("-" * 80)

        linked_count = 0
        for chem in existing_chemicals:
            if chem.master_chemical_id:
                continue  # Already linked

            master_chemical = master_chemical_map.get(chem.part_number)
            if master_chemical:
                chem.master_chemical_id = master_chemical.id

                # Set received_date to date_added if not set
                if not chem.received_date:
                    chem.received_date = chem.date_added

                # Mark existing expiration dates as overrides
                # (since we don't know if they were calculated)
                if chem.expiration_date:
                    chem.expiration_date_override = True

                linked_count += 1

                if linked_count % 100 == 0:
                    print(f"  Linked {linked_count} chemical lots...")

        print(f"  ✓ Linked {linked_count} chemical lots to master chemicals")
        db.session.commit()
        print()

        # Step 6: Migrate minimum_stock_level to warehouse settings
        print("Step 6: Migrating minimum stock levels to warehouse settings...")
        print("-" * 80)

        settings_created = 0

        for part_number, master_chemical in master_chemical_map.items():
            lots = chemical_groups[part_number]

            # Group by warehouse
            warehouse_groups = defaultdict(list)
            for lot in lots:
                if lot.warehouse_id:
                    warehouse_groups[lot.warehouse_id].append(lot)

            # Create warehouse settings
            for warehouse_id, warehouse_lots in warehouse_groups.items():
                # Find the highest minimum_stock_level across all lots in this warehouse
                min_levels = [lot.minimum_stock_level for lot in warehouse_lots if lot.minimum_stock_level]
                if not min_levels:
                    continue

                min_stock = max(min_levels)

                # Check if setting already exists
                existing_setting = ChemicalWarehouseSetting.query.filter_by(
                    master_chemical_id=master_chemical.id,
                    warehouse_id=warehouse_id
                ).first()

                if existing_setting:
                    continue

                # Create setting
                setting = ChemicalWarehouseSetting(
                    master_chemical_id=master_chemical.id,
                    warehouse_id=warehouse_id,
                    minimum_stock_level=min_stock,
                    maximum_stock_level=min_stock * 2,  # Estimate: 2x minimum
                )

                db.session.add(setting)
                settings_created += 1

        print(f"  ✓ Created {settings_created} warehouse settings")
        db.session.commit()
        print()

        # Step 7: Verification
        print("=" * 80)
        print("Migration Verification")
        print("=" * 80)

        master_count = MasterChemical.query.count()
        settings_count = ChemicalWarehouseSetting.query.count()
        linked_lots = Chemical.query.filter(Chemical.master_chemical_id.isnot(None)).count()
        unlinked_lots = Chemical.query.filter(Chemical.master_chemical_id.is_(None)).count()

        print(f"  Master chemicals created: {master_count}")
        print(f"  Warehouse settings created: {settings_count}")
        print(f"  Chemical lots linked: {linked_lots}")
        print(f"  Chemical lots unlinked: {unlinked_lots}")
        print()

        if unlinked_lots > 0:
            print(f"  ⚠ WARNING: {unlinked_lots} chemical lots are not linked to master chemicals")
            print("  These may need manual review.")
            print()

        # Data integrity checks
        print("Running integrity checks...")
        print("-" * 80)

        # Check for invalid references
        invalid_refs = db.session.execute(text("""
            SELECT COUNT(*) FROM chemicals c
            LEFT JOIN master_chemicals mc ON c.master_chemical_id = mc.id
            WHERE c.master_chemical_id IS NOT NULL AND mc.id IS NULL
        """)).scalar()

        if invalid_refs > 0:
            print(f"  ⚠ CRITICAL: {invalid_refs} chemicals with invalid master_chemical_id")
        else:
            print("  ✓ All master_chemical_id references are valid")

        # Check for part number mismatches
        mismatched = db.session.execute(text("""
            SELECT COUNT(*) FROM chemicals c
            INNER JOIN master_chemicals mc ON c.master_chemical_id = mc.id
            WHERE c.part_number != mc.part_number
        """)).scalar()

        if mismatched > 0:
            print(f"  ⚠ WARNING: {mismatched} chemicals with mismatched part numbers")
        else:
            print("  ✓ All part numbers match between chemicals and master chemicals")

        print()
        print("=" * 80)
        print("Migration Complete!")
        print("=" * 80)
        print()
        print("Next steps:")
        print("  1. Review any warnings above")
        print("  2. Test the new master chemicals functionality")
        print("  3. Register routes_master_chemicals in app.py")
        print("  4. Deploy frontend changes")
        print()


def rollback():
    """
    Rollback script for master chemicals migration.
    Use only if migration needs to be reversed.
    """
    app = create_app()

    with app.app_context():
        print("=" * 80)
        print("Rolling back master chemicals migration")
        print("=" * 80)
        print()

        # Remove foreign key references
        print("Step 1: Removing master_chemical_id references...")
        db.session.execute(text("UPDATE chemicals SET master_chemical_id = NULL"))
        db.session.commit()
        print("  ✓ Cleared all master_chemical_id references")
        print()

        # Drop new columns
        print("Step 2: Dropping new columns from chemicals table...")
        db.session.execute(text("DROP INDEX IF EXISTS idx_chemicals_master_chemical_id"))
        db.session.execute(text("ALTER TABLE chemicals DROP COLUMN IF EXISTS master_chemical_id"))
        db.session.execute(text("ALTER TABLE chemicals DROP COLUMN IF EXISTS expiration_date_override"))
        db.session.execute(text("ALTER TABLE chemicals DROP COLUMN IF EXISTS manufacture_date"))
        db.session.execute(text("ALTER TABLE chemicals DROP COLUMN IF EXISTS received_date"))
        db.session.commit()
        print("  ✓ Dropped new columns")
        print()

        # Drop new tables
        print("Step 3: Dropping new tables...")
        db.session.execute(text("DROP TABLE IF EXISTS chemical_warehouse_settings"))
        db.session.execute(text("DROP TABLE IF EXISTS master_chemicals"))
        db.session.commit()
        print("  ✓ Dropped new tables")
        print()

        print("=" * 80)
        print("Rollback Complete")
        print("=" * 80)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Master Chemicals Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    args = parser.parse_args()

    if args.rollback:
        response = input("Are you sure you want to rollback the migration? This will delete all master chemical data! (yes/no): ")
        if response.lower() == 'yes':
            rollback()
        else:
            print("Rollback cancelled")
    else:
        migrate()
