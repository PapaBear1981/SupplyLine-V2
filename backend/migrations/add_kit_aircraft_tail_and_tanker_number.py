"""
Migration: add ``aircraft_tail_number`` and ``tanker_scooper_number`` columns
to the ``kits`` table.

These fields let admins associate a kit with a specific aircraft tail and a
tanker/scooper number. The values surface on the kits list, the edit modal,
and the TV display.
"""

import os
import sqlite3
import sys


db_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "database",
)
db_path = os.path.join(db_dir, "tools.db")


def run_migration():
    print("Adding aircraft_tail_number and tanker_scooper_number columns to kits table...")

    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(kits)")
        columns = [c[1] for c in cursor.fetchall()]

        new_fields = [
            ("aircraft_tail_number", "TEXT"),
            ("tanker_scooper_number", "TEXT"),
        ]

        for field_name, field_type in new_fields:
            if field_name not in columns:
                # nosec B608 - field name/type come from a hardcoded list, not user input
                cursor.execute(f"ALTER TABLE kits ADD COLUMN {field_name} {field_type}")
                print(f"Added kits.{field_name}")
            else:
                print(f"kits.{field_name} already exists")

        conn.commit()
        print("Migration completed successfully")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
