"""
Migration script to update announcements table schema
- Rename 'content' column to 'message'
- Add 'target_departments' JSON column
"""
import sqlite3
import os
import json

def run_migration():
    # Get the database path
    # Check if running in Docker (path starts with /) or locally
    if os.path.exists('/database/tools.db'):
        db_path = '/database/tools.db'
    else:
        db_path = os.path.join('database', 'tools.db')

    # Check if the database exists
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False

    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check current table structure
        cursor.execute("PRAGMA table_info(announcements)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]

        print(f"Current columns in announcements table: {column_names}")

        # Check if we need to rename 'content' to 'message'
        if 'content' in column_names and 'message' not in column_names:
            print("Renaming 'content' column to 'message'...")
            # SQLite doesn't support RENAME COLUMN directly in older versions
            # We need to recreate the table

            # Get the current table structure
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='announcements'")
            create_table_sql = cursor.fetchone()[0]

            # Get all existing data
            cursor.execute("SELECT * FROM announcements")
            existing_data = cursor.fetchall()

            # Drop the old table
            cursor.execute("DROP TABLE announcements")

            # Create new table with updated schema
            # Replace 'content' with 'message' in the CREATE TABLE statement
            new_create_table_sql = create_table_sql.replace('content ', 'message ')
            cursor.execute(new_create_table_sql)

            # Re-insert the data
            if existing_data:
                # Get column count to build the INSERT statement
                placeholders = ','.join(['?' for _ in range(len(columns))])
                insert_sql = f"INSERT INTO announcements VALUES ({placeholders})"  # nosec B608 - placeholders are safely constructed from column count, not user input
                cursor.executemany(insert_sql, existing_data)
                print(f"Migrated {len(existing_data)} announcement records")

            conn.commit()
            print("Successfully renamed 'content' column to 'message'")
        elif 'message' in column_names:
            print("Column 'message' already exists (migration may have already run)")
        else:
            print("Warning: Neither 'content' nor 'message' column found in announcements table")

        # Check if target_departments column exists
        cursor.execute("PRAGMA table_info(announcements)")
        columns = cursor.fetchall()
        column_names = [column[1] for column in columns]

        if 'target_departments' not in column_names:
            print("Adding 'target_departments' column...")
            cursor.execute("ALTER TABLE announcements ADD COLUMN target_departments TEXT")
            conn.commit()
            print("Successfully added 'target_departments' column")
        else:
            print("Column 'target_departments' already exists")

        # Verify the final schema
        cursor.execute("PRAGMA table_info(announcements)")
        final_columns = cursor.fetchall()
        print("\nFinal announcements table schema:")
        for col in final_columns:
            print(f"  {col[1]} ({col[2]})")

        # Close the connection
        conn.close()
        return True
    except Exception as e:
        print(f"Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    exit(0 if success else 1)
