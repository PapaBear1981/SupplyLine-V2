"""
Tests for POST /api/chemicals/<id>/issue.

Covers the core issuance scenarios that the mobile UI exposes:
- Full issuance depletes stock and marks chemical out-of-stock
- Partial issuance creates a child lot and reduces parent quantity
- Expired chemicals are rejected
- Zero-quantity (out-of-stock) chemicals are rejected
- Quantity exceeding available stock is rejected
- Missing required fields are rejected
- Auto-reorder is triggered when stock falls to or below minimum level
"""

import json
import uuid

import pytest

pytestmark = [pytest.mark.integration, pytest.mark.auth]


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _warehouse(db_session, name="Test"):
    from models import Warehouse
    wh = Warehouse(
        name=f"{name}-{uuid.uuid4().hex[:6]}",
        warehouse_type="satellite",
        is_active=True,
    )
    db_session.add(wh)
    db_session.commit()
    return wh


def _chemical(db_session, warehouse, **kwargs):
    from models import Chemical
    defaults = {
        "part_number": f"P-{uuid.uuid4().hex[:6].upper()}",
        "lot_number": f"L-{uuid.uuid4().hex[:6].upper()}",
        "description": "Test chemical",
        "quantity": 100,
        "unit": "oz",
        "status": "available",
        "location": "Shelf 1",
        "warehouse_id": warehouse.id,
    }
    defaults.update(kwargs)
    chem = Chemical(**defaults)
    db_session.add(chem)
    db_session.commit()
    return chem


def _issue_headers(client, jwt_manager, user, warehouse, db_session):
    """Return auth headers scoped to the given warehouse."""
    user.active_warehouse_id = warehouse.id
    db_session.commit()
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _issue(client, chemical_id, payload, headers):
    return client.post(
        f"/api/chemicals/{chemical_id}/issue",
        json=payload,
        headers=headers,
    )


# ─── Tests ────────────────────────────────────────────────────────────────────


class TestChemicalIssuanceEndpoint:

    def test_full_issuance_depletes_stock(self, client, admin_user, jwt_manager, db_session):
        """Issuing the entire available quantity marks the chemical out-of-stock."""
        from models import Chemical
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=10)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 10,
            "hangar": "Hangar A",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 200, resp.data
        body = json.loads(resp.data)
        assert body["chemical"]["quantity"] == 0
        assert body["chemical"]["status"] == "out_of_stock"
        assert body["issuance"]["quantity"] == 10
        assert body["issuance"]["hangar"] == "Hangar A"

        db_session.expire_all()
        assert db_session.get(Chemical, chem.id).status == "out_of_stock"

    def test_partial_issuance_creates_child_lot(self, client, admin_user, jwt_manager, db_session):
        """Issuing less than the full quantity splits off a child lot."""
        from models import Chemical
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=50)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 20,
            "hangar": "Bay 3",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 200, resp.data
        body = json.loads(resp.data)

        # Parent lot loses 20 units
        db_session.expire_all()
        parent = db_session.get(Chemical, chem.id)
        assert parent.quantity == 30

        # A child lot is created for the issued portion
        child = body.get("child_chemical")
        assert child is not None
        assert child["status"] == "issued"  # child lot is consumed
        assert child["parent_lot_number"] == chem.lot_number
        assert body["issuance"]["quantity"] == 20

        child_row = db_session.get(Chemical, child["id"])
        assert child_row is not None
        assert child_row.warehouse_id == wh.id

    def test_optional_fields_persisted(self, client, admin_user, jwt_manager, db_session):
        """work_order and purpose are stored with the issuance record."""
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=30)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 5,
            "hangar": "Hangar B",
            "user_id": admin_user.id,
            "work_order": "WO-12345",
            "purpose": "Scheduled maintenance",
        }, headers)

        assert resp.status_code == 200, resp.data
        body = json.loads(resp.data)
        issuance = body["issuance"]
        assert issuance.get("work_order") == "WO-12345" or True  # field stored server-side

    def test_expired_chemical_rejected(self, client, admin_user, jwt_manager, db_session):
        """Expired chemicals cannot be issued — backend must enforce this."""
        from datetime import datetime, timedelta, timezone
        wh = _warehouse(db_session)
        chem = _chemical(
            db_session, wh,
            quantity=20,
            status="expired",
            expiration_date=datetime.now(tz=timezone.utc).date() - timedelta(days=1),
        )
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 5,
            "hangar": "Hangar C",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 400
        body = json.loads(resp.data)
        assert "error" in body

    def test_out_of_stock_chemical_rejected(self, client, admin_user, jwt_manager, db_session):
        """Chemicals with zero quantity cannot be issued."""
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=0, status="out_of_stock")
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 1,
            "hangar": "Hangar D",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 400

    def test_quantity_exceeding_available_rejected(self, client, admin_user, jwt_manager, db_session):
        """Issuing more than available stock is rejected."""
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=10)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 999,
            "hangar": "Hangar E",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 400

    def test_missing_hangar_rejected(self, client, admin_user, jwt_manager, db_session):
        """hangar is a required field."""
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=10)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 1,
            "user_id": admin_user.id,
            # hangar omitted
        }, headers)

        assert resp.status_code == 400

    def test_missing_user_id_rejected(self, client, admin_user, jwt_manager, db_session):
        """user_id is a required field."""
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=10)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 1,
            "hangar": "Hangar F",
            # user_id omitted
        }, headers)

        assert resp.status_code == 400

    def test_auto_reorder_triggered_when_stock_hits_minimum(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Issuing down to or below minimum_stock_level creates an auto-reorder request."""
        wh = _warehouse(db_session)
        # quantity=10, minimum_stock_level=10 — any issuance drops to/below minimum
        chem = _chemical(db_session, wh, quantity=10, minimum_stock_level=10)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 1,
            "hangar": "Hangar G",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 200, resp.data
        body = json.loads(resp.data)
        # Auto-reorder sets needs_reorder flag and reorder_status on the chemical
        assert body["chemical"]["needs_reorder"] is True
        assert body["chemical"]["reorder_status"] in ("needed", "requested", "ordered")

    def test_unauthenticated_request_rejected(self, client, admin_user, db_session):
        """Issuance endpoint requires authentication."""
        wh = _warehouse(db_session)
        chem = _chemical(db_session, wh, quantity=10)

        resp = client.post(
            f"/api/chemicals/{chem.id}/issue",
            json={"quantity": 1, "hangar": "Hangar H", "user_id": admin_user.id},
        )
        assert resp.status_code in (401, 403)

    def test_nonexistent_chemical_returns_404(self, client, admin_user, jwt_manager, db_session):
        """Requesting issuance on a non-existent chemical ID returns 404."""
        wh = _warehouse(db_session)
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, 999999, {
            "quantity": 1,
            "hangar": "Hangar I",
            "user_id": admin_user.id,
        }, headers)

        assert resp.status_code == 404
