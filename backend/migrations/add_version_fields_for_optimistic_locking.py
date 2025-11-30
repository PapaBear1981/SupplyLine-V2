"""
Migration: Add version fields for optimistic locking

This migration adds version columns to key models to enable concurrent update
collision detection (optimistic locking). When two users try to update the
same resource simultaneously, the system will detect the conflict and prevent
data loss.

Affected tables:
- tools
- chemicals
- kits
- warehouses
- procurement_orders
- user_requests

To run this migration:
    python migrations/add_version_fields_for_optimistic_locking.py

Author: Claude (Anthropic)
Date: 2024
"""

import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Tables that need version fields added
TABLES_TO_UPDATE = [
    "tools",
    "chemicals",
    "kits",
    "warehouses",
    "procurement_orders",
    "user_requests",
]


def column_exists(connection, table_name, column_name):
    """Check if a column exists in a table."""
    try:
        # SQLite approach
        result = connection.execute(
            text(f"PRAGMA table_info({table_name})")
        )
        columns = [row[1] for row in result]
        return column_name in columns
    except Exception:
        # PostgreSQL approach
        try:
            result = connection.execute(
                text("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = :table_name AND column_name = :column_name
                """),
                {"table_name": table_name, "column_name": column_name}
            )
            return result.fetchone() is not None
        except Exception as e:
            logger.warning(f"Could not check column existence: {e}")
            return False


def add_version_column(connection, table_name):
    """Add version column to a table if it doesn't exist."""
    if column_exists(connection, table_name, "version"):
        logger.info(f"  Column 'version' already exists in {table_name}, skipping")
        return False

    try:
        # Add the version column with default value 1
        connection.execute(
            text(f"ALTER TABLE {table_name} ADD COLUMN version INTEGER NOT NULL DEFAULT 1")
        )
        logger.info(f"  Added 'version' column to {table_name}")
        return True
    except OperationalError as e:
        if "duplicate column" in str(e).lower():
            logger.info(f"  Column 'version' already exists in {table_name}")
            return False
        raise


def run_migration():
    """Run the migration to add version fields."""
    from app import create_app
    from models import db

    app = create_app()

    with app.app_context():
        logger.info("Starting migration: Add version fields for optimistic locking")
        logger.info("=" * 60)

        with db.engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                tables_updated = 0

                for table_name in TABLES_TO_UPDATE:
                    logger.info(f"Processing table: {table_name}")
                    if add_version_column(connection, table_name):
                        tables_updated += 1

                logger.info("=" * 60)
                logger.info(f"Migration complete. Updated {tables_updated} tables.")

                if tables_updated > 0:
                    logger.info("Version fields added successfully!")
                    logger.info("")
                    logger.info("IMPORTANT: All existing records have version=1.")
                    logger.info("Frontend clients should include 'version' in update requests")
                    logger.info("to enable conflict detection.")
                else:
                    logger.info("No changes needed - all tables already have version fields.")


def rollback_migration():
    """Rollback the migration by removing version fields."""
    from app import create_app
    from models import db

    app = create_app()

    with app.app_context():
        logger.info("Rolling back migration: Remove version fields")
        logger.info("=" * 60)

        with db.engine.connect() as connection:
            with connection.begin():
                for table_name in TABLES_TO_UPDATE:
                    if column_exists(connection, table_name, "version"):
                        try:
                            # SQLite doesn't support DROP COLUMN directly
                            # For SQLite, we'd need to recreate the table
                            # For PostgreSQL, this works:
                            connection.execute(
                                text(f"ALTER TABLE {table_name} DROP COLUMN version")
                            )
                            logger.info(f"  Removed 'version' column from {table_name}")
                        except Exception as e:
                            logger.warning(
                                f"  Could not remove 'version' from {table_name}: {e}"
                            )
                            logger.warning(
                                "  (SQLite doesn't support DROP COLUMN - manual table recreation needed)"
                            )

        logger.info("=" * 60)
        logger.info("Rollback complete.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Add version fields for optimistic locking"
    )
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback the migration (remove version fields)"
    )

    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
