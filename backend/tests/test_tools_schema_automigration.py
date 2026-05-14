"""Regression test for the tools-table startup auto-migration.

A deployment whose ``tools`` table predates the columns the Tool model gained
over time (``lot_number`` had no migration anywhere) makes ``SELECT * FROM
tools`` fail, so ``GET /api/tools`` 500s and the inventory page renders empty.
``db.create_all()`` does not add columns to a table that already exists, so the
self-healing has to come from the ``_auto_add_col`` block in ``create_app()``.

This test stands up a legacy-shaped ``tools`` table, boots the app against it,
and asserts the missing columns are backfilled and the pre-existing row is
still queryable through the ORM.
"""

import sqlite3

import pytest
from sqlalchemy import inspect as sa_inspect


# Columns the Tool model carries that an older `tools` table can be missing.
EXPECTED_BACKFILLED = {
    "lot_number",
    "category",
    "status",
    "status_reason",
    "maintenance_return_date",
    "requires_calibration",
    "calibration_frequency_days",
    "last_calibration_date",
    "next_calibration_date",
    "calibration_status",
}


def _noop(*args, **kwargs):
    """Stand-in for background-service initializers during the test."""


def _create_legacy_tools_db(db_path):
    """Create a `tools` table with only the original, pre-expansion columns."""
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE tools (
                id INTEGER PRIMARY KEY,
                tool_number VARCHAR NOT NULL,
                serial_number VARCHAR NOT NULL,
                description VARCHAR,
                condition VARCHAR,
                location VARCHAR,
                warehouse_id INTEGER,
                created_at DATETIME
            )
            """
        )
        conn.execute(
            "INSERT INTO tools (tool_number, serial_number, description, "
            "condition, location, created_at) VALUES "
            "('T-100', 'SN-100', 'Legacy wrench', 'good', 'Bench A', "
            "'2024-01-01 00:00:00')"
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def legacy_db_url(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy_tools.db"
    _create_legacy_tools_db(str(db_path))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    # Running create_app() outside testing mode triggers the production
    # security-config check; the CI flag makes it generate ephemeral keys
    # instead of demanding real ones.
    monkeypatch.setenv("CI", "true")
    # Neuter the background schedulers create_app() spins up in non-testing
    # mode so no threads leak into the test session.
    monkeypatch.setattr("app.init_scheduled_backup", _noop)
    monkeypatch.setattr("app.init_scheduled_maintenance", _noop)
    return f"sqlite:///{db_path}"


def test_startup_backfills_missing_tool_columns(legacy_db_url, monkeypatch):
    # create_app() treats pytest as a testing environment and skips both
    # create_all() and the auto-migration. The signals are PYTEST_CURRENT_TEST
    # (which pytest re-sets at the start of the call phase, so it must be
    # dropped here in the test body, not the fixture) and FLASK_ENV=testing
    # (set by the CI test job). Drop both so the real startup migration runs.
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("FLASK_ENV", raising=False)

    # create_app() applies the DATABASE_URL override at call time, so building
    # an app here boots the startup auto-migration against the legacy DB.
    from app import create_app, db

    application = create_app()

    with application.app_context():
        inspector = sa_inspect(db.engine)
        tool_cols = {c["name"] for c in inspector.get_columns("tools")}

        missing = EXPECTED_BACKFILLED - tool_cols
        assert not missing, f"auto-migration left columns missing: {sorted(missing)}"

        # The legacy row must survive and be readable through the ORM now that
        # every mapped column exists in the table.
        from models import Tool

        tool = Tool.query.filter_by(tool_number="T-100").one()
        assert tool.serial_number == "SN-100"
        assert tool.lot_number is None
