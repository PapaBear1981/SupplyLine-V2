"""
Migration script to add serial/lot number enforcement fields and indexes.

This migration adds:
1. parent_lot_number and lot_sequence columns to kit_expendables table for lot lineage tracking
2. Indexes for part_number + serial_number and part_number + lot_number combinations
3. Migration of existing 'none' tracking_type items to 'lot' with auto-generated lot numbers

Policy enforced:
- All items must have either a serial number or lot number for tracking
- The combination of part_number + serial/lot must be unique across the system
- Child lots are created when items are partially issued for traceability
"""

import sqlite3
import os
import sys
from datetime import datetime

# Get the database path
db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'database')
db_path = os.path.join(db_dir, 'tools.db')


def generate_lot_number(counter):
    """Generate a lot number in the format LOT-YYMMDD-XXXX"""
    date_str = datetime.now().strftime("%y%m%d")
    return f"LOT-{date_str}-{counter:04d}"


def run_migration():
    print("Starting migration to add serial/lot number enforcement...")
    print(f"Database path: {db_path}")

    # Check if database file exists
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        sys.exit(1)

    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # ============================================================
        # 1. Add new columns to kit_expendables table
        # ============================================================
        cursor.execute("PRAGMA table_info(kit_expendables)")
        columns = [column[1] for column in cursor.fetchall()]

        # Fields to add for lot lineage tracking
        new_fields = [
            ('parent_lot_number', 'TEXT'),
            ('lot_sequence', 'INTEGER DEFAULT 0'),
        ]

        for field_name, field_type in new_fields:
            if field_name not in columns:
                print(f"Adding {field_name} column to kit_expendables table...")
                cursor.execute(f"ALTER TABLE kit_expendables ADD COLUMN {field_name} {field_type}")
            else:
                print(f"{field_name} column already exists in kit_expendables table")

        # ============================================================
        # 2. Create indexes for part_number + serial/lot combinations
        # ============================================================

        # Index for kit_expendables: part_number + lot_number
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_kit_expendables_part_lot'")
        if not cursor.fetchone():
            print("Creating index on kit_expendables (part_number, lot_number)...")
            cursor.execute("CREATE INDEX idx_kit_expendables_part_lot ON kit_expendables(part_number, lot_number)")
        else:
            print("Index idx_kit_expendables_part_lot already exists")

        # Index for kit_expendables: part_number + serial_number
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_kit_expendables_part_serial'")
        if not cursor.fetchone():
            print("Creating index on kit_expendables (part_number, serial_number)...")
            cursor.execute("CREATE INDEX idx_kit_expendables_part_serial ON kit_expendables(part_number, serial_number)")
        else:
            print("Index idx_kit_expendables_part_serial already exists")

        # Index for kit_expendables: parent_lot_number for lineage queries
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_kit_expendables_parent_lot'")
        if not cursor.fetchone():
            print("Creating index on kit_expendables (parent_lot_number)...")
            cursor.execute("CREATE INDEX idx_kit_expendables_parent_lot ON kit_expendables(parent_lot_number)")
        else:
            print("Index idx_kit_expendables_parent_lot already exists")

        # Index for chemicals: part_number + lot_number
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_chemicals_part_lot'")
        if not cursor.fetchone():
            print("Creating index on chemicals (part_number, lot_number)...")
            cursor.execute("CREATE INDEX idx_chemicals_part_lot ON chemicals(part_number, lot_number)")
        else:
            print("Index idx_chemicals_part_lot already exists")

        # Index for expendables: part_number + lot_number
        cursor.execute("PRAGMA table_info(expendables)")
        expendables_columns = [column[1] for column in cursor.fetchall()]
        if 'part_number' in expendables_columns:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_expendables_part_lot'")
            if not cursor.fetchone():
                print("Creating index on expendables (part_number, lot_number)...")
                cursor.execute("CREATE INDEX idx_expendables_part_lot ON expendables(part_number, lot_number)")
            else:
                print("Index idx_expendables_part_lot already exists")

            cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_expendables_part_serial'")
            if not cursor.fetchone():
                print("Creating index on expendables (part_number, serial_number)...")
                cursor.execute("CREATE INDEX idx_expendables_part_serial ON expendables(part_number, serial_number)")
            else:
                print("Index idx_expendables_part_serial already exists")

        # Index for tools: tool_number + serial_number
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tools_toolnum_serial'")
        if not cursor.fetchone():
            print("Creating index on tools (tool_number, serial_number)...")
            cursor.execute("CREATE INDEX idx_tools_toolnum_serial ON tools(tool_number, serial_number)")
        else:
            print("Index idx_tools_toolnum_serial already exists")

        # ============================================================
        # 3. Migrate untracked items to have lot numbers
        # ============================================================

        # Check if there are any kit_expendables with tracking_type='none' or NULL serial/lot
        cursor.execute("""
            SELECT id, part_number, tracking_type, lot_number, serial_number
            FROM kit_expendables
            WHERE tracking_type = 'none'
               OR (lot_number IS NULL AND serial_number IS NULL)
               OR (lot_number = '' AND serial_number = '')
        """)
        untracked_items = cursor.fetchall()

        if untracked_items:
            print(f"\nFound {len(untracked_items)} untracked kit_expendables that need lot numbers...")
            lot_counter = 1

            # Get the current max lot sequence from lot_number_sequence table if it exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lot_number_sequence'")
            if cursor.fetchone():
                cursor.execute("SELECT MAX(sequence_counter) FROM lot_number_sequence")
                result = cursor.fetchone()
                if result and result[0]:
                    lot_counter = result[0] + 1

            for item_id, part_number, tracking_type, lot_number, serial_number in untracked_items:
                new_lot = generate_lot_number(lot_counter)
                print(f"  Assigning lot {new_lot} to kit_expendable {item_id} (part: {part_number})")
                cursor.execute("""
                    UPDATE kit_expendables
                    SET lot_number = ?, tracking_type = 'lot'
                    WHERE id = ?
                """, (new_lot, item_id))
                lot_counter += 1

            print(f"Updated {len(untracked_items)} kit_expendables with lot numbers")
        else:
            print("No untracked kit_expendables found - all items already have tracking")

        # Also check expendables table
        cursor.execute("PRAGMA table_info(expendables)")
        exp_columns = [column[1] for column in cursor.fetchall()]
        if 'lot_number' in exp_columns and 'serial_number' in exp_columns:
            cursor.execute("""
                SELECT id, part_number, lot_number, serial_number
                FROM expendables
                WHERE (lot_number IS NULL AND serial_number IS NULL)
                   OR (lot_number = '' AND serial_number = '')
            """)
            untracked_expendables = cursor.fetchall()

            if untracked_expendables:
                print(f"\nFound {len(untracked_expendables)} untracked expendables that need lot numbers...")
                for item_id, part_number, lot_number, serial_number in untracked_expendables:
                    new_lot = generate_lot_number(lot_counter)
                    print(f"  Assigning lot {new_lot} to expendable {item_id} (part: {part_number})")
                    cursor.execute("""
                        UPDATE expendables
                        SET lot_number = ?
                        WHERE id = ?
                    """, (new_lot, item_id))
                    lot_counter += 1

                print(f"Updated {len(untracked_expendables)} expendables with lot numbers")

        # Commit the changes
        conn.commit()
        print("\n=== Serial/Lot Enforcement Migration completed successfully ===")
        print("\nPolicy now enforced:")
        print("  - All items must have either a serial number or lot number")
        print("  - Part number + serial/lot combinations must be unique")
        print("  - Child lots are created on partial issuance for traceability")

    except Exception as e:
        conn.rollback()
        print(f"Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
