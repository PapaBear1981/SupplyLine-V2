"""
Migration: add ``assigned_user_id`` column to the ``kits`` table.

The assigned user is the admin-designated point of contact for a kit so the
team can divvy up workload. The column carries no extra permissions.
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
    print("Adding assigned_user_id column to kits table...")

    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(kits)")
        columns = [c[1] for c in cursor.fetchall()]

        if "assigned_user_id" not in columns:
            cursor.execute(
                "ALTER TABLE kits ADD COLUMN assigned_user_id INTEGER REFERENCES users(id)"
            )
            print("Added kits.assigned_user_id")
        else:
            print("kits.assigned_user_id already exists")

        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='ix_kits_assigned_user_id'"
        )
        if not cursor.fetchone():
            cursor.execute("CREATE INDEX ix_kits_assigned_user_id ON kits(assigned_user_id)")
            print("Created index ix_kits_assigned_user_id")

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
