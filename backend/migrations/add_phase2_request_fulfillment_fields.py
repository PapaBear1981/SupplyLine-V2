"""Phase 2: Add request/fulfillment workflow fields.

Adds columns to support the Phase 2 workflow model:

user_requests:
  - request_type: manual, kit_replenishment, warehouse_replenishment, transfer, repairable_return
  - source_trigger: manual, kit_issuance, low_stock, transfer, return_obligation
  - destination_type: mobile_kit, warehouse, person_team, base_location
  - destination_location: free-text destination description
  - related_kit_id: FK to kits (optional)
  - item_class: tool, part, chemical, expendable, repairable, other
  - repairable: boolean flag
  - core_required: boolean flag
  - return_status: issued_core_expected, in_return_transit, returned_to_stores, closed
  - return_destination: defaults to 'Main Warehouse / Stores'
  - external_reference: optional external system reference (read-only operational tracking)

procurement_orders (fulfillment actions):
  - request_id: FK to user_requests (link fulfillment action to parent request)
  - source_location: where this fulfillment comes from
  - fulfillment_action_type: stock_fulfillment, transfer, kit_replenishment, external_procurement, return_tracking
  - fulfillment_quantity: how much this action fulfills
  - is_internal_fulfillment: internal stock vs external procurement

Also migrates legacy priority and status values:
  Priority: low/normal -> routine, high -> urgent, critical -> aog
  Status:   awaiting_info -> needs_info, in_progress/ordered -> pending_fulfillment,
            partially_ordered/partially_received -> partially_fulfilled, received -> fulfilled
"""

import os
import sys

from sqlalchemy import inspect, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db


def migrate():
    """Apply Phase 2 schema additions."""
    app = create_app()

    with app.app_context():
        inspector = inspect(db.engine)
        tables = set(inspector.get_table_names())

        # ------------------------------------------------------------------ #
        # user_requests — new operational context fields
        # ------------------------------------------------------------------ #
        if "user_requests" not in tables:
            print("user_requests table does not exist. Run prior migrations first.")
            return

        req_cols = {col["name"] for col in inspector.get_columns("user_requests")}
        added = []

        def _add_req(col_sql, col_name):
            if col_name not in req_cols:
                db.session.execute(
                    text(f"ALTER TABLE user_requests ADD COLUMN {col_sql}")
                )
                added.append(f"user_requests.{col_name}")
                print(f"  + user_requests.{col_name}")
            else:
                print(f"  . user_requests.{col_name} already exists")

        print("Updating user_requests...")
        _add_req("request_type VARCHAR(50) NOT NULL DEFAULT 'manual'", "request_type")
        _add_req("source_trigger VARCHAR(50) NULL", "source_trigger")
        _add_req("destination_type VARCHAR(50) NULL", "destination_type")
        _add_req("destination_location VARCHAR(200) NULL", "destination_location")
        _add_req("related_kit_id INTEGER NULL", "related_kit_id")
        _add_req("item_class VARCHAR(50) NULL", "item_class")
        _add_req("repairable BOOLEAN NOT NULL DEFAULT 0", "repairable")
        _add_req("core_required BOOLEAN NOT NULL DEFAULT 0", "core_required")
        _add_req("return_status VARCHAR(50) NULL", "return_status")
        _add_req(
            "return_destination VARCHAR(200) NOT NULL DEFAULT 'Main Warehouse / Stores'",
            "return_destination",
        )
        _add_req("external_reference VARCHAR(200) NULL", "external_reference")

        # ------------------------------------------------------------------ #
        # procurement_orders — fulfillment-action linkage fields
        # ------------------------------------------------------------------ #
        if "procurement_orders" not in tables:
            print("procurement_orders table does not exist.")
            return

        ord_cols = {col["name"] for col in inspector.get_columns("procurement_orders")}

        def _add_ord(col_sql, col_name):
            if col_name not in ord_cols:
                db.session.execute(
                    text(f"ALTER TABLE procurement_orders ADD COLUMN {col_sql}")
                )
                added.append(f"procurement_orders.{col_name}")
                print(f"  + procurement_orders.{col_name}")
            else:
                print(f"  . procurement_orders.{col_name} already exists")

        print("Updating procurement_orders...")
        _add_ord("request_id INTEGER NULL", "request_id")
        if "request_id" not in ord_cols:
            db.session.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_procurement_orders_request_id "
                    "ON procurement_orders(request_id)"
                )
            )
        _add_ord("source_location VARCHAR(200) NULL", "source_location")
        _add_ord("fulfillment_action_type VARCHAR(50) NULL", "fulfillment_action_type")
        _add_ord("fulfillment_quantity INTEGER NULL", "fulfillment_quantity")
        _add_ord(
            "is_internal_fulfillment BOOLEAN NOT NULL DEFAULT 0",
            "is_internal_fulfillment",
        )

        # ------------------------------------------------------------------ #
        # Migrate legacy priority values on user_requests
        # low / normal -> routine   |   high -> urgent   |   critical -> aog
        # ------------------------------------------------------------------ #
        print("Migrating user_requests priority values...")
        db.session.execute(
            text(
                "UPDATE user_requests SET priority = 'routine' "
                "WHERE priority IN ('low', 'normal')"
            )
        )
        db.session.execute(
            text(
                "UPDATE user_requests SET priority = 'urgent' "
                "WHERE priority = 'high'"
            )
        )
        db.session.execute(
            text(
                "UPDATE user_requests SET priority = 'aog' "
                "WHERE priority = 'critical'"
            )
        )

        # ------------------------------------------------------------------ #
        # Migrate legacy status values on user_requests
        # ------------------------------------------------------------------ #
        print("Migrating user_requests status values...")
        db.session.execute(
            text(
                "UPDATE user_requests SET status = 'needs_info' "
                "WHERE status = 'awaiting_info'"
            )
        )
        db.session.execute(
            text(
                "UPDATE user_requests SET status = 'pending_fulfillment' "
                "WHERE status IN ('in_progress', 'ordered')"
            )
        )
        db.session.execute(
            text(
                "UPDATE user_requests SET status = 'partially_fulfilled' "
                "WHERE status IN ('partially_ordered', 'partially_received')"
            )
        )
        db.session.execute(
            text(
                "UPDATE user_requests SET status = 'fulfilled' "
                "WHERE status = 'received'"
            )
        )

        db.session.commit()

        if added:
            print(f"\nMigration complete. Added {len(added)} column(s):")
            for col in added:
                print(f"  {col}")
        else:
            print("\nMigration complete. All Phase 2 columns already present.")


if __name__ == "__main__":
    migrate()
