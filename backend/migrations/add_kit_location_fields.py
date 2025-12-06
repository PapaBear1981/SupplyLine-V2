"""
Migration script to add location fields to the Kit model for map display.
This adds the following fields:
- location_address: Street address
- location_city: City name
- location_state: State/Province
- location_zip: ZIP/Postal code
- location_country: Country (defaults to USA)
- latitude: GPS latitude coordinate
- longitude: GPS longitude coordinate
- location_notes: Additional location notes (e.g., "Hangar 3, Bay 2")
"""

import sqlite3
import os
import sys

# Get the database path
db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'database')
db_path = os.path.join(db_dir, 'tools.db')


def run_migration():
    print("Starting migration to add location fields to Kit model...")

    # Check if database file exists
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        sys.exit(1)

    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(kits)")
        columns = [column[1] for column in cursor.fetchall()]

        # Location fields to add
        location_fields = [
            ('location_address', 'TEXT'),
            ('location_city', 'TEXT'),
            ('location_state', 'TEXT'),
            ('location_zip', 'TEXT'),
            ('location_country', "TEXT DEFAULT 'USA'"),
            ('latitude', 'REAL'),
            ('longitude', 'REAL'),
            ('location_notes', 'TEXT'),
        ]

        for field_name, field_type in location_fields:
            if field_name not in columns:
                print(f"Adding {field_name} column to kits table...")
                cursor.execute(f"ALTER TABLE kits ADD COLUMN {field_name} {field_type}")  # nosec B608 - field_name and field_type are from hardcoded location_fields list, not user input
            else:
                print(f"{field_name} column already exists in kits table")

        # Create index on latitude/longitude for faster geospatial queries
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_kits_location'")
        if not cursor.fetchone():
            print("Creating index on kits location columns...")
            cursor.execute("CREATE INDEX idx_kits_location ON kits(latitude, longitude)")
        else:
            print("Location index already exists")

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
