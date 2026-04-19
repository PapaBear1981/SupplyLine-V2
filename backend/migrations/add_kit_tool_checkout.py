"""
Migration: Add kit_tool_checkouts table

Tracks tools temporarily deployed to field kits.
Different from kit_items (permanent transfers) and checkouts (user checkouts).
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
    print("Starting migration: add_kit_tool_checkout...")

    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='kit_tool_checkouts'"
        )
        if cursor.fetchone() is None:
            print("Creating kit_tool_checkouts table...")
            cursor.execute(
                """
                CREATE TABLE kit_tool_checkouts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tool_id INTEGER NOT NULL REFERENCES tools(id),
                    kit_id INTEGER NOT NULL REFERENCES kits(id),
                    checked_out_by_id INTEGER NOT NULL REFERENCES users(id),
                    checkout_date DATETIME NOT NULL,
                    expected_return_date DATETIME,
                    return_date DATETIME,
                    returned_by_id INTEGER REFERENCES users(id),
                    previous_location TEXT,
                    previous_warehouse_id INTEGER,
                    notes TEXT,
                    return_notes TEXT,
                    status TEXT NOT NULL DEFAULT 'active'
                )
                """
            )
            cursor.execute(
                "CREATE INDEX idx_kit_tool_checkouts_tool ON kit_tool_checkouts(tool_id)"
            )
            cursor.execute(
                "CREATE INDEX idx_kit_tool_checkouts_kit ON kit_tool_checkouts(kit_id)"
            )
            cursor.execute(
                "CREATE INDEX idx_kit_tool_checkouts_status ON kit_tool_checkouts(status)"
            )
            print("kit_tool_checkouts table created.")
        else:
            print("kit_tool_checkouts table already exists, skipping.")

        conn.commit()
        print("Migration completed successfully.")

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
