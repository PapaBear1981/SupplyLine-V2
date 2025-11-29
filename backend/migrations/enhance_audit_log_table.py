"""
Migration to enhance audit_log table with additional fields
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db
from sqlalchemy import text


def migrate():
    """Add new columns to audit_log table"""
    app = create_app()

    with app.app_context():
        print("Enhancing audit_log table...")

        # Add new columns if they don't exist
        with db.engine.connect() as conn:
            # Check if columns already exist (SQLite version)
            result = conn.execute(text("PRAGMA table_info(audit_log)"))
            existing_columns = {row[1] for row in result}  # row[1] is the column name

            # SQLite requires adding columns one at a time
            columns_to_add = []

            if 'user_id' not in existing_columns:
                columns_to_add.append(("user_id", "INTEGER"))

            if 'action' not in existing_columns:
                columns_to_add.append(("action", "VARCHAR"))

            if 'resource_type' not in existing_columns:
                columns_to_add.append(("resource_type", "VARCHAR"))

            if 'resource_id' not in existing_columns:
                columns_to_add.append(("resource_id", "INTEGER"))

            if 'details' not in existing_columns:
                columns_to_add.append(("details", "JSON"))

            if 'ip_address' not in existing_columns:
                columns_to_add.append(("ip_address", "VARCHAR"))

            if columns_to_add:
                for col_name, col_type in columns_to_add:
                    alter_statement = f"ALTER TABLE audit_log ADD COLUMN {col_name} {col_type}"
                    print(f"Executing: {alter_statement}")
                    conn.execute(text(alter_statement))
                    conn.commit()
                print(f"Added {len(columns_to_add)} new column(s) to audit_log table")
            else:
                print("All columns already exist in audit_log table")

        print("\nMigration complete!")


if __name__ == '__main__':
    migrate()
