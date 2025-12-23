"""
Migration script to add enhanced tool checkout system.
This includes:
1. New fields on the checkouts table for damage tracking and enhanced audit
2. New tool_history table for comprehensive timeline tracking
"""

import sqlite3
import os
import sys

# Get the database path
db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'database')
db_path = os.path.join(db_dir, 'tools.db')


def run_migration():
    print("Starting migration to add enhanced tool checkout system...")

    # Check if database file exists
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        sys.exit(1)

    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # ===========================================
        # Part 1: Enhance checkouts table
        # ===========================================
        print("\n--- Enhancing checkouts table ---")
        cursor.execute("PRAGMA table_info(checkouts)")
        checkout_columns = [column[1] for column in cursor.fetchall()]

        # Enhanced checkout tracking fields
        checkout_fields = [
            ('checkout_notes', 'TEXT'),
            ('condition_at_checkout', 'TEXT'),
            ('work_order', 'TEXT'),
            ('project', 'TEXT'),
            ('condition_at_return', 'TEXT'),
            ('checked_in_by_id', 'INTEGER'),
            ('damage_reported', 'BOOLEAN DEFAULT 0'),
            ('damage_description', 'TEXT'),
            ('damage_severity', 'TEXT'),
            ('damage_reported_date', 'DATETIME'),
            ('created_at', 'DATETIME'),
            ('updated_at', 'DATETIME'),
        ]

        for field_name, field_type in checkout_fields:
            if field_name not in checkout_columns:
                print(f"Adding {field_name} column to checkouts...")
                cursor.execute(f"ALTER TABLE checkouts ADD COLUMN {field_name} {field_type}")  # nosec B608 - field_name and field_type are from hardcoded checkout_fields list, not user input
            else:
                print(f"{field_name} column already exists in checkouts")

        # ===========================================
        # Part 2: Create tool_history table
        # ===========================================
        print("\n--- Creating tool_history table ---")

        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tool_history'")
        if cursor.fetchone() is None:
            print("Creating tool_history table...")
            cursor.execute("""
                CREATE TABLE tool_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tool_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    event_date DATETIME NOT NULL,
                    user_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    details TEXT,
                    related_checkout_id INTEGER,
                    related_calibration_id INTEGER,
                    related_service_record_id INTEGER,
                    old_status TEXT,
                    new_status TEXT,
                    old_condition TEXT,
                    new_condition TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (tool_id) REFERENCES tools(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (related_checkout_id) REFERENCES checkouts(id),
                    FOREIGN KEY (related_calibration_id) REFERENCES tool_calibrations(id),
                    FOREIGN KEY (related_service_record_id) REFERENCES tool_service_records(id)
                )
            """)

            # Create indexes for better query performance
            print("Creating indexes on tool_history table...")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_history_tool_id ON tool_history(tool_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_history_event_type ON tool_history(event_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_history_event_date ON tool_history(event_date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tool_history_related_checkout ON tool_history(related_checkout_id)")
        else:
            print("tool_history table already exists")

        # ===========================================
        # Part 3: Create indexes on checkouts if they don't exist
        # ===========================================
        print("\n--- Creating indexes on checkouts table ---")

        # Get existing indexes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='checkouts'")
        existing_indexes = [row[0] for row in cursor.fetchall()]

        checkout_indexes = [
            ('idx_checkouts_tool_id', 'tool_id'),
            ('idx_checkouts_user_id', 'user_id'),
            ('idx_checkouts_checkout_date', 'checkout_date'),
            ('idx_checkouts_return_date', 'return_date'),
            ('idx_checkouts_expected_return_date', 'expected_return_date'),
        ]

        for index_name, column_name in checkout_indexes:
            if index_name not in existing_indexes:
                print(f"Creating index {index_name}...")
                cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON checkouts({column_name})")  # nosec B608 - index_name and column_name are from hardcoded checkout_indexes list, not user input
            else:
                print(f"Index {index_name} already exists")

        # Commit the changes
        conn.commit()
        print("\n=== Migration completed successfully ===")

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
