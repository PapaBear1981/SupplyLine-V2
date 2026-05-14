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
    "warehouse_id",
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


def _create_warehouses_table(conn):
    """Create a `warehouses` table matching the Warehouse model schema."""
    conn.execute(
        """
        CREATE TABLE warehouses (
            id INTEGER PRIMARY KEY,
            name VARCHAR(200) NOT NULL UNIQUE,
            address VARCHAR(500),
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            country VARCHAR(100) DEFAULT 'USA',
            warehouse_type VARCHAR(50) NOT NULL DEFAULT 'satellite',
            is_active BOOLEAN NOT NULL DEFAULT 1,
            contact_person VARCHAR(200),
            contact_phone VARCHAR(50),
            contact_email VARCHAR(200),
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            created_by_id INTEGER
        )
        """
    )


def _create_legacy_tools_db_with_warehouse(db_path):
    """Legacy `tools` table that already has a NULL `warehouse_id` column,
    alongside a `warehouses` table holding an active main warehouse.

    This is the real-world bug state: the warehouse_id column exists (added by
    an earlier startup) but pre-existing rows are NULL, so the warehouse-scoped
    Tools view hides them.
    """
    conn = sqlite3.connect(db_path)
    try:
        _create_warehouses_table(conn)
        conn.execute(
            "INSERT INTO warehouses (id, name, warehouse_type, is_active, "
            "created_at, updated_at) VALUES "
            "(1, 'Main', 'main', 1, '2024-01-01 00:00:00', "
            "'2024-01-01 00:00:00')"
        )
        conn.execute(
            """
            CREATE TABLE tools (
                id INTEGER PRIMARY KEY,
                tool_number VARCHAR NOT NULL,
                serial_number VARCHAR NOT NULL,
                description VARCHAR,
                condition VARCHAR,
                location VARCHAR,
                created_at DATETIME,
                warehouse_id INTEGER REFERENCES warehouses(id)
            )
            """
        )
        conn.execute(
            "INSERT INTO tools (tool_number, serial_number, description, "
            "condition, location, created_at, warehouse_id) VALUES "
            "('T-200', 'SN-200', 'Unscoped drill', 'good', 'Bench B', "
            "'2024-01-01 00:00:00', NULL)"
        )
        conn.commit()
    finally:
        conn.close()


def _prepare_startup_env(monkeypatch):
    """Shared monkeypatching so create_app() runs the real startup migration."""
    # Running create_app() outside testing mode triggers the production
    # security-config check; the CI flag makes it generate ephemeral keys
    # instead of demanding real ones.
    monkeypatch.setenv("CI", "true")
    # Neuter the background schedulers create_app() spins up in non-testing
    # mode so no threads leak into the test session.
    monkeypatch.setattr("app.init_scheduled_backup", _noop)
    monkeypatch.setattr("app.init_scheduled_maintenance", _noop)


@pytest.fixture
def legacy_db_url(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy_tools.db"
    _create_legacy_tools_db(str(db_path))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    _prepare_startup_env(monkeypatch)
    return f"sqlite:///{db_path}"


@pytest.fixture
def legacy_db_url_with_warehouse(tmp_path, monkeypatch):
    db_path = tmp_path / "legacy_tools_wh.db"
    _create_legacy_tools_db_with_warehouse(str(db_path))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    _prepare_startup_env(monkeypatch)
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


def test_startup_backfills_null_tool_warehouse_id(
    legacy_db_url_with_warehouse, monkeypatch
):
    """Tools with a NULL warehouse_id must be backfilled to the main warehouse.

    Otherwise the warehouse-scoped Tools view (filtered to the user's active
    warehouse) hides them, and they only appear under "All warehouses".
    """
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("FLASK_ENV", raising=False)

    from app import create_app

    application = create_app()

    with application.app_context():
        from models import Tool, Warehouse

        main = Warehouse.query.filter_by(warehouse_type="main").one()
        tool = Tool.query.filter_by(tool_number="T-200").one()
        assert tool.warehouse_id == main.id
