"""Migration script to add the trusted_devices table."""

import logging
import sys

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_trusted_devices_table(inspector):
    """Ensure the trusted_devices table and its indexes exist."""
    from models import db

    table_exists = "trusted_devices" in inspector.get_table_names()

    dialect = db.engine.dialect.name
    if dialect == "sqlite":
        pk_clause = "id INTEGER PRIMARY KEY AUTOINCREMENT"
        timestamp_type = "DATETIME"
    else:
        pk_clause = "id SERIAL PRIMARY KEY"
        timestamp_type = "TIMESTAMP"

    if not table_exists:
        logger.info("Creating trusted_devices table")
        with db.engine.connect() as conn:
            conn.execute(db.text(
                f"""
                CREATE TABLE IF NOT EXISTS trusted_devices (
                    {pk_clause},
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR(64) NOT NULL UNIQUE,
                    token_prefix VARCHAR(12) NOT NULL,
                    device_label VARCHAR(120) NOT NULL DEFAULT 'Unknown device',
                    user_agent VARCHAR(512),
                    ip_address VARCHAR(64),
                    created_at {timestamp_type} NOT NULL,
                    last_used_at {timestamp_type},
                    expires_at {timestamp_type} NOT NULL,
                    revoked_at {timestamp_type}
                )
                """
            ))
            conn.commit()

    logger.info("Creating indexes on trusted_devices")
    with db.engine.connect() as conn:
        for stmt in (
            "CREATE INDEX IF NOT EXISTS ix_trusted_devices_user_id ON trusted_devices (user_id)",
            "CREATE INDEX IF NOT EXISTS ix_trusted_devices_token_prefix ON trusted_devices (token_prefix)",
            "CREATE INDEX IF NOT EXISTS ix_trusted_devices_revoked_at ON trusted_devices (revoked_at)",
        ):
            conn.execute(db.text(stmt))
        conn.commit()


def run_migration():
    """Run the trusted_devices table migration."""
    from models import db

    inspector = inspect(db.engine)
    ensure_trusted_devices_table(inspector)


def main():
    try:
        from app import create_app

        app = create_app()

        with app.app_context():
            logger.info("Running trusted_devices migration")
            run_migration()
            logger.info("trusted_devices migration completed successfully")
            return True

    except SQLAlchemyError as exc:
        logger.error("Database error during migration: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected error during migration: %s", exc)

    return False


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
