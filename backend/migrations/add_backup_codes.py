"""Migration script to add backup codes fields to users table."""

import logging
import sys

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_backup_codes_columns(inspector):
    """Ensure backup codes columns exist on the users table."""
    from models import db

    columns = {column['name'] for column in inspector.get_columns('users')}

    if 'backup_codes' not in columns:
        logger.info("Adding backup_codes column to users table")
        with db.engine.connect() as conn:
            conn.execute(db.text(
                "ALTER TABLE users ADD COLUMN backup_codes TEXT"
            ))
            conn.commit()

    if 'backup_codes_generated_at' not in columns:
        logger.info("Adding backup_codes_generated_at column to users table")
        with db.engine.connect() as conn:
            conn.execute(db.text(
                "ALTER TABLE users ADD COLUMN backup_codes_generated_at TIMESTAMP"
            ))
            conn.commit()


def run_migration():
    """Run the backup codes fields migration."""
    from models import db

    inspector = inspect(db.engine)
    ensure_backup_codes_columns(inspector)


def main():
    try:
        # Import here to avoid circular dependencies
        from app import create_app

        app = create_app()

        with app.app_context():
            logger.info("Running backup codes fields migration")
            run_migration()
            logger.info("Backup codes fields migration completed successfully")
            return True

    except SQLAlchemyError as exc:
        logger.error("Database error during migration: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected error during migration: %s", exc)

    return False


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
