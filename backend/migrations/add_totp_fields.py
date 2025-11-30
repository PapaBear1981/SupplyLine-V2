"""Migration script to add TOTP two-factor authentication fields to users table."""

import logging
import sys

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_totp_columns(inspector):
    """Ensure TOTP columns exist on the users table."""
    from models import db

    columns = {column['name'] for column in inspector.get_columns('users')}
    dialect = db.engine.dialect.name

    if 'totp_secret' not in columns:
        logger.info("Adding totp_secret column to users table")
        with db.engine.connect() as conn:
            conn.execute(db.text(
                "ALTER TABLE users ADD COLUMN totp_secret VARCHAR(32)"
            ))
            conn.commit()

    if 'is_totp_enabled' not in columns:
        logger.info("Adding is_totp_enabled column to users table")
        default_value = '0' if dialect == 'sqlite' else 'FALSE'
        with db.engine.connect() as conn:
            conn.execute(db.text(
                f"ALTER TABLE users ADD COLUMN is_totp_enabled BOOLEAN DEFAULT {default_value}"
            ))
            conn.commit()


def run_migration():
    """Run the TOTP fields migration."""
    from models import db

    inspector = inspect(db.engine)
    ensure_totp_columns(inspector)


def main():
    try:
        # Import here to avoid circular dependencies
        from app import create_app

        app = create_app()

        with app.app_context():
            logger.info("Running TOTP fields migration")
            run_migration()
            logger.info("TOTP fields migration completed successfully")
            return True

    except SQLAlchemyError as exc:
        logger.error("Database error during migration: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected error during migration: %s", exc)

    return False


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
