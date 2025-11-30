"""
Migration: Add procurement_order_id to request_items table

This migration adds a procurement_order_id foreign key to link request items
to procurement orders when items are marked as ordered.
"""

import sqlite3
import sys
from pathlib import Path


def run_migration(db_path: str = None):
    """Add procurement_order_id column to request_items table"""
    if db_path is None:
        db_path = Path(__file__).parent.parent / "instance" / "supplyline.db"

    try:
        print("Running migration: Add procurement_order_id to request_items")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if column already exists
        cursor.execute("PRAGMA table_info(request_items)")
        columns = [col[1] for col in cursor.fetchall()]

        if "procurement_order_id" in columns:
            print("✓ procurement_order_id column already exists in request_items table")
            conn.close()
            return True

        # Add the column
        print("Adding procurement_order_id column to request_items table...")
        cursor.execute("""
            ALTER TABLE request_items
            ADD COLUMN procurement_order_id INTEGER
            REFERENCES procurement_orders(id)
        """)

        # Create index for better query performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_items_procurement_order_id
            ON request_items(procurement_order_id)
        """)

        conn.commit()
        print("✓ Successfully added procurement_order_id column to request_items table")
        conn.close()
        return True

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        return False


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else None
    success = run_migration(db_path)
    sys.exit(0 if success else 1)
