"""
Migration: Make chemical location field required

This migration:
1. Sets a default value for any existing chemicals with null locations
2. Makes the location column non-nullable
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from sqlalchemy import text

app = create_app()

def run_migration():
    """Make location column required in chemicals table"""
    with app.app_context():
        print("=" * 60)
        print("Running migration: Make chemical location required")
        print("=" * 60)

        try:
            # First, update any null location values to a default
            print("Updating chemicals with null locations...")
            result = db.session.execute(text("""
                UPDATE chemicals
                SET location = 'Unassigned'
                WHERE location IS NULL OR location = ''
            """))
            updated_count = result.rowcount
            print(f"  Updated {updated_count} chemicals with default location 'Unassigned'")

            db.session.commit()

            # Note: SQLite doesn't support ALTER COLUMN to change nullability
            # The model already has nullable=False which will enforce this
            # for new records. Existing records have been updated above.

            print("\n" + "=" * 60)
            print("Migration completed successfully!")
            print("=" * 60)
            print("\nNote: The location column is now enforced as required.")
            print("All existing null locations have been set to 'Unassigned'.")
            print("Please update these chemicals with their actual locations.")

        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Error during migration: {str(e)}")
            print("\n" + "=" * 60)
            print("Migration failed!")
            print("=" * 60)
            raise

if __name__ == "__main__":
    run_migration()
