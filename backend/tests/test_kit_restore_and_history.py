"""Tests for kit-restore on the unified mark-received path and for
cancellation propagation from a user request down to its linked
KitReorderRequest.

These tests cover the new behavior introduced when wiring the kit
fulfillment helper into routes_user_requests so that completing a
kit-generated request through the unified API still refills the kit.
"""

import json
import uuid

import pytest

from models import RequestItem, UserRequest, db
from models_kits import (
    AircraftType,
    Kit,
    KitBox,
    KitExpendable,
    KitItem,
    KitReorderRequest,
)


@pytest.fixture
def aircraft_type(db_session):
    at = AircraftType.query.filter_by(name="Q400").first()
    if not at:
        at = AircraftType(name="Q400", description="Test Aircraft", is_active=True)
        db_session.add(at)
        db_session.commit()
    return at


def _make_kit(db_session, aircraft_type, with_expendable=False, exp_quantity=10.0):
    kit = Kit(
        name=f"Restore Kit {uuid.uuid4().hex[:8]}",
        aircraft_type_id=aircraft_type.id,
        description="Restore-on-receive test kit",
        status="active",
        created_by=1,
    )
    db_session.add(kit)
    db_session.flush()

    box = KitBox(
        kit_id=kit.id,
        box_number="1",
        box_type="expendable",
        description="Expendables",
    )
    db_session.add(box)
    db_session.flush()

    expendable = None
    if with_expendable:
        expendable = KitExpendable(
            kit_id=kit.id,
            box_id=box.id,
            part_number="EXP-RESTORE",
            description="Restorable expendable",
            quantity=exp_quantity,
            unit="ea",
            status="low_stock",
        )
        db_session.add(expendable)

    db_session.commit()
    return kit, box, expendable


def _create_and_approve_reorder(
    client, auth_headers_admin, auth_headers_materials, kit, part_number, item_id=None
):
    """Create a kit reorder, push it through approve so it lands at status='ordered'."""
    reorder_payload = {
        "item_type": "expendable",
        "part_number": part_number,
        "description": "Restore-on-receive test item",
        "quantity_requested": 25.0,
        "priority": "high",
        "notes": "Restore test",
    }
    if item_id is not None:
        reorder_payload["item_id"] = item_id

    resp = client.post(
        f"/api/kits/{kit.id}/reorder",
        json=reorder_payload,
        headers=auth_headers_admin,
    )
    assert resp.status_code == 201, resp.data
    reorder_dict = json.loads(resp.data)
    reorder_id = reorder_dict["id"]
    request_number = reorder_dict["user_request"]["request_number"]

    # Approve → status moves to 'ordered' and a ProcurementOrder is created
    resp = client.put(
        f"/api/reorder-requests/{reorder_id}/approve",
        headers=auth_headers_materials,
    )
    assert resp.status_code == 200, resp.data
    assert json.loads(resp.data)["status"] == "ordered"
    return reorder_id, request_number


class TestKitRestoreViaMarkReceived:
    """The unified mark-received endpoint must refill the originating kit."""

    def test_mark_received_creates_new_kit_item_for_new_expendable(
        self,
        client,
        auth_headers_admin,
        auth_headers_materials,
        aircraft_type,
        db_session,
    ):
        """A reorder without item_id is for a brand-new part — receiving it
        through the unified API should add a fresh Expendable + KitItem to the
        kit, mirroring the legacy /fulfill endpoint."""
        kit, _, _ = _make_kit(db_session, aircraft_type)
        reorder_id, _ = _create_and_approve_reorder(
            client, auth_headers_admin, auth_headers_materials, kit, "EXP-NEW-VIA-UNIFIED"
        )

        request_item = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_id
        ).first()
        assert request_item is not None
        ur_id = request_item.request_id

        resp = client.post(
            f"/api/user-requests/{ur_id}/items/mark-received",
            json={"item_ids": [request_item.id]},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200, resp.data

        # KitReorderRequest is now fulfilled
        reorder = db_session.get(KitReorderRequest, reorder_id)
        db_session.refresh(reorder)
        assert reorder.status == "fulfilled"
        assert reorder.fulfillment_date is not None

        # UserRequest rolled up to fulfilled
        ur = db_session.get(UserRequest, ur_id)
        db_session.refresh(ur)
        assert ur.status == "fulfilled"

        # A KitItem now exists for the new part in this kit, filling the hole.
        kit_items = KitItem.query.filter_by(
            kit_id=kit.id, part_number="EXP-NEW-VIA-UNIFIED"
        ).all()
        assert len(kit_items) == 1
        assert kit_items[0].status == "available"
        assert kit_items[0].quantity == 25.0
        assert kit_items[0].lot_number  # an auto-generated lot number is attached

    def test_mark_received_tops_up_existing_expendable(
        self,
        client,
        auth_headers_admin,
        auth_headers_materials,
        aircraft_type,
        db_session,
    ):
        """A reorder against an existing KitExpendable should restore the
        depleted quantity when the request is fulfilled through the unified
        mark-received API."""
        kit, _, expendable = _make_kit(
            db_session, aircraft_type, with_expendable=True, exp_quantity=10.0
        )
        starting_qty = expendable.quantity
        reorder_id, _ = _create_and_approve_reorder(
            client,
            auth_headers_admin,
            auth_headers_materials,
            kit,
            expendable.part_number,
            item_id=expendable.id,
        )

        request_item = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_id
        ).first()
        assert request_item is not None

        resp = client.post(
            f"/api/user-requests/{request_item.request_id}/items/mark-received",
            json={"item_ids": [request_item.id]},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200, resp.data

        db_session.refresh(expendable)
        assert expendable.quantity == starting_qty + 25.0
        assert expendable.status == "available"

        reorder = db_session.get(KitReorderRequest, reorder_id)
        db_session.refresh(reorder)
        assert reorder.status == "fulfilled"

    def test_mark_received_is_idempotent_on_kit_restore(
        self,
        client,
        auth_headers_admin,
        auth_headers_materials,
        aircraft_type,
        db_session,
    ):
        """Calling mark-received on an already-fulfilled reorder must not
        double-add to the kit."""
        kit, _, expendable = _make_kit(
            db_session, aircraft_type, with_expendable=True, exp_quantity=10.0
        )
        starting_qty = expendable.quantity
        reorder_id, _ = _create_and_approve_reorder(
            client,
            auth_headers_admin,
            auth_headers_materials,
            kit,
            expendable.part_number,
            item_id=expendable.id,
        )

        request_item = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_id
        ).first()

        # First call — kit gets refilled and reorder goes to fulfilled.
        first = client.post(
            f"/api/user-requests/{request_item.request_id}/items/mark-received",
            json={"item_ids": [request_item.id]},
            headers=auth_headers_admin,
        )
        assert first.status_code == 200
        db_session.refresh(expendable)
        after_first = expendable.quantity
        assert after_first == starting_qty + 25.0

        # Second call against an already-received item — must not change kit qty
        # again. Reorder is no longer in 'ordered' state, so restore is a no-op.
        second = client.post(
            f"/api/user-requests/{request_item.request_id}/items/mark-received",
            json={"item_ids": [request_item.id]},
            headers=auth_headers_admin,
        )
        assert second.status_code == 200
        db_session.refresh(expendable)
        assert expendable.quantity == after_first  # no double-restore


class TestCancelPropagatesToKitReorder:
    """Cancelling a kit-generated user request must mark its KitReorderRequest
    as cancelled so it stops occupying buyer queues."""

    def test_cancel_entire_request_cancels_linked_kit_reorder(
        self,
        client,
        auth_headers_admin,
        auth_headers_materials,
        aircraft_type,
        db_session,
    ):
        kit, _, _ = _make_kit(db_session, aircraft_type)
        reorder_id, _ = _create_and_approve_reorder(
            client, auth_headers_admin, auth_headers_materials, kit, "EXP-CANCEL-FULL"
        )
        request_item = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_id
        ).first()
        ur_id = request_item.request_id

        resp = client.delete(
            f"/api/user-requests/{ur_id}",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200, resp.data

        ur = db_session.get(UserRequest, ur_id)
        db_session.refresh(ur)
        assert ur.status == "cancelled"

        reorder = db_session.get(KitReorderRequest, reorder_id)
        db_session.refresh(reorder)
        assert reorder.status == "cancelled"

    def test_cancel_specific_items_cancels_linked_kit_reorder(
        self,
        client,
        auth_headers_admin,
        auth_headers_materials,
        aircraft_type,
        db_session,
    ):
        kit, _, _ = _make_kit(db_session, aircraft_type)
        reorder_id, _ = _create_and_approve_reorder(
            client, auth_headers_admin, auth_headers_materials, kit, "EXP-CANCEL-ITEM"
        )
        request_item = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_id
        ).first()

        resp = client.post(
            f"/api/user-requests/{request_item.request_id}/items/cancel",
            json={
                "item_ids": [request_item.id],
                "reason": "No longer needed - test cancel propagation",
            },
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200, resp.data

        reorder = db_session.get(KitReorderRequest, reorder_id)
        db_session.refresh(reorder)
        assert reorder.status == "cancelled"


class TestUserRequestsHistoryFilter:
    """The unified list endpoint accepts comma-separated status filters that
    the new History tab relies on to scope its query."""

    def test_history_status_filter_excludes_open_requests(
        self,
        client,
        auth_headers_admin,
        auth_headers_materials,
        aircraft_type,
        db_session,
    ):
        kit_a, _, _ = _make_kit(db_session, aircraft_type)
        kit_b, _, _ = _make_kit(db_session, aircraft_type)

        # Reorder A → fulfilled
        reorder_a_id, _ = _create_and_approve_reorder(
            client, auth_headers_admin, auth_headers_materials, kit_a, "EXP-HIST-A"
        )
        ri_a = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_a_id
        ).first()
        client.post(
            f"/api/user-requests/{ri_a.request_id}/items/mark-received",
            json={"item_ids": [ri_a.id]},
            headers=auth_headers_admin,
        )

        # Reorder B → still ordered/active
        reorder_b_id, _ = _create_and_approve_reorder(
            client, auth_headers_admin, auth_headers_materials, kit_b, "EXP-HIST-B"
        )
        ri_b = RequestItem.query.filter_by(
            source_type="kit_reorder", kit_reorder_request_id=reorder_b_id
        ).first()

        resp = client.get(
            "/api/user-requests?status=fulfilled,cancelled,received",
            headers=auth_headers_admin,
        )
        assert resp.status_code == 200
        rows = json.loads(resp.data)
        ids = {row["id"] for row in rows}
        assert ri_a.request_id in ids, "Fulfilled request must appear in history filter"
        assert ri_b.request_id not in ids, "Active request must be excluded from history filter"
        for row in rows:
            assert row["status"] in {"fulfilled", "cancelled", "received"}
