"""
Migration: Multi-warehouse scoping + two-step transfer workflow.

Changes:
1. Adds users.active_warehouse_id (FK -> warehouses.id) + index.
2. Adds receipt/cancellation columns to warehouse_transfers.
3. Backfills users.active_warehouse_id to the main warehouse when one exists.
"""
import os
import sqlite3


USER_COLUMN_DEFINITIONS = [
    ("active_warehouse_id", "INTEGER REFERENCES warehouses(id)"),
]

TRANSFER_COLUMN_DEFINITIONS = [
    ("received_by_id", "INTEGER REFERENCES users(id)"),
    ("received_date", "DATETIME"),
    ("source_location", "VARCHAR(200)"),
    ("destination_location", "VARCHAR(200)"),
    ("cancelled_by_id", "INTEGER REFERENCES users(id)"),
    ("cancelled_date", "DATETIME"),
    ("cancel_reason", "VARCHAR(500)"),
]


def _existing_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def _existing_indexes(cursor, table):
    cursor.execute(f"PRAGMA index_list({table})")
    return {row[1] for row in cursor.fetchall()}


def _add_missing_columns(cursor, table, definitions):
    existing = _existing_columns(cursor, table)
    added = []
    for name, ddl in definitions:
        if name in existing:
            continue
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
        added.append(name)
    return added


def run_migration():
    db_path = os.path.join("database", "tools.db")
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()

        user_added = _add_missing_columns(cursor, "users", USER_COLUMN_DEFINITIONS)
        transfer_added = _add_missing_columns(
            cursor, "warehouse_transfers", TRANSFER_COLUMN_DEFINITIONS
        )

        indexes = _existing_indexes(cursor, "users")
        if "ix_users_active_warehouse_id" not in indexes:
            cursor.execute(
                "CREATE INDEX ix_users_active_warehouse_id "
                "ON users(active_warehouse_id)"
            )

        indexes = _existing_indexes(cursor, "warehouse_transfers")
        if "ix_warehouse_transfers_received_by_id" not in indexes:
            cursor.execute(
                "CREATE INDEX ix_warehouse_transfers_received_by_id "
                "ON warehouse_transfers(received_by_id)"
            )

        # Backfill: assign the 'main' warehouse as default active warehouse for
        # users who don't have one.
        cursor.execute(
            "SELECT id FROM warehouses "
            "WHERE warehouse_type = 'main' AND is_active = 1 "
            "ORDER BY id LIMIT 1"
        )
        row = cursor.fetchone()
        if row:
            main_id = row[0]
            cursor.execute(
                "UPDATE users SET active_warehouse_id = ? "
                "WHERE active_warehouse_id IS NULL",
                (main_id,),
            )
            print(f"Backfilled {cursor.rowcount} users with main warehouse id={main_id}")
        else:
            print("No 'main' warehouse found; skipping user backfill")

        conn.commit()
        print(
            f"Added columns to users: {user_added or 'none'}; "
            f"to warehouse_transfers: {transfer_added or 'none'}"
        )
        return True
    except Exception as exc:  # pragma: no cover - debug output
        conn.rollback()
        print(f"Migration failed: {exc}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
