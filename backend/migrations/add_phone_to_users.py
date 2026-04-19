"""Migration: Add phone column to users table."""

import os
import sqlite3
import sys

db_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "database",
)
db_path = os.path.join(db_dir, "tools.db")


def run_migration():
    print("Starting migration: add_phone_to_users...")

    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]

        if "phone" not in columns:
            print("Adding phone column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT")
            print("Done.")
        else:
            print("phone column already exists, skipping.")

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
