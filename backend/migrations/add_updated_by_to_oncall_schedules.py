"""Add updated_by_id to oncall_schedules and backfill from created_by_id.

The original `add_oncall_schedules_table` migration created the table without
an updater column, so we relied on `created_by` for the dashboard's
"updated by" label. That misattributed edits to the original creator. This
migration adds `updated_by_id` and backfills it to `created_by_id` for any
existing rows so the dashboard label is at least correct as of now.
"""

import logging
import sys

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def ensure_updated_by_column():
    from models import db

    inspector = inspect(db.engine)
    table_names = inspector.get_table_names()
    if "oncall_schedules" not in table_names:
        logger.info("oncall_schedules table does not exist yet — nothing to do")
        return

    columns = {column["name"] for column in inspector.get_columns("oncall_schedules")}
    if "updated_by_id" in columns:
        logger.info("updated_by_id already present on oncall_schedules")
        return

    logger.info("Adding updated_by_id column to oncall_schedules")
    with db.engine.connect() as conn:
        conn.execute(db.text(
            "ALTER TABLE oncall_schedules ADD COLUMN updated_by_id INTEGER "
            "REFERENCES users(id)"
        ))
        conn.execute(db.text(
            "UPDATE oncall_schedules SET updated_by_id = created_by_id "
            "WHERE updated_by_id IS NULL"
        ))
        conn.commit()


def main():
    try:
        from app import create_app

        app = create_app()
        with app.app_context():
            logger.info("Running oncall_schedules updated_by_id migration")
            ensure_updated_by_column()
            logger.info("Migration completed successfully")
            return True
    except SQLAlchemyError as exc:
        logger.error("Database error during migration: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected error during migration: %s", exc)
    return False


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
