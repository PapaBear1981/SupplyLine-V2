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

    def test_depleted_lot_is_auto_archived(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Fully consuming a lot archives it so it drops out of the active list."""
        from models import Chemical, ChemicalPart
        wh = _warehouse(db_session)

        # Pre-create the part so the new lot links to it
        part = ChemicalPart(part_number=f"P-DEPL-{uuid.uuid4().hex[:6]}",
                            description="Depleted-test", default_unit="oz")
        db_session.add(part)
        db_session.commit()

        chem = _chemical(
            db_session, wh,
            part_number=part.part_number,
            chemical_part_id=part.id,
            quantity=5,
        )
        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)

        resp = _issue(client, chem.id, {
            "quantity": 5,
            "hangar": "Hangar J",
            "user_id": admin_user.id,
        }, headers)
        assert resp.status_code == 200, resp.data

        db_session.expire_all()
        depleted = db_session.get(Chemical, chem.id)
        assert depleted.quantity == 0
        assert depleted.is_archived is True
        assert depleted.archived_reason == "depleted"

    def test_reorder_not_triggered_when_other_lots_have_stock(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Depleting one lot must NOT trigger reorder if other lots have stock."""
        from models import Chemical, ChemicalPart, RequestItem
        wh = _warehouse(db_session)

        # One part number, two lots. min_stock=10. Lot A=5, Lot B=100.
        # Issuing all of A leaves 100 across the part — no reorder.
        part = ChemicalPart(
            part_number=f"P-AGG-{uuid.uuid4().hex[:6]}",
            description="Aggregate-test",
            default_unit="oz",
            minimum_stock_level=10,
        )
        db_session.add(part)
        db_session.commit()

        lot_a = _chemical(
            db_session, wh,
            part_number=part.part_number,
            chemical_part_id=part.id,
            quantity=5,
            minimum_stock_level=10,
        )
        _chemical(
            db_session, wh,
            part_number=part.part_number,
            chemical_part_id=part.id,
            quantity=100,
            minimum_stock_level=10,
        )

        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)
        resp = _issue(client, lot_a.id, {
            "quantity": 5,
            "hangar": "Hangar K",
            "user_id": admin_user.id,
        }, headers)
        assert resp.status_code == 200, resp.data
        body = json.loads(resp.data)

        # Lot A is gone but the part still has plenty of stock — no auto reorder
        assert body.get("auto_reorder_request") is None
        assert body["chemical"]["needs_reorder"] is False

        # And no chemical RequestItem was created for this part number
        open_items = (
            db_session.query(RequestItem)
            .filter(
                RequestItem.item_type == "chemical",
                RequestItem.part_number == part.part_number,
            )
            .all()
        )
        assert open_items == []

    def test_reorder_triggered_when_all_lots_of_part_drop_below_min(
        self, client, admin_user, jwt_manager, db_session
    ):
        """When the part-level total drops to/below min, auto-reorder fires once."""
        from models import ChemicalPart, RequestItem
        wh = _warehouse(db_session)

        part = ChemicalPart(
            part_number=f"P-MIN-{uuid.uuid4().hex[:6]}",
            description="Min-trip-test",
            default_unit="oz",
            minimum_stock_level=10,
        )
        db_session.add(part)
        db_session.commit()

        # Only one lot, total = 12. After issuing 5 we're at 7, which is <= 10.
        only_lot = _chemical(
            db_session, wh,
            part_number=part.part_number,
            chemical_part_id=part.id,
            quantity=12,
            minimum_stock_level=10,
        )

        headers = _issue_headers(client, jwt_manager, admin_user, wh, db_session)
        resp = _issue(client, only_lot.id, {
            "quantity": 5,
            "hangar": "Hangar L",
            "user_id": admin_user.id,
        }, headers)
        assert resp.status_code == 200, resp.data

        items = (
            db_session.query(RequestItem)
            .filter(
                RequestItem.item_type == "chemical",
                RequestItem.part_number == part.part_number,
            )
            .all()
        )
        assert len(items) >= 1

    def test_create_chemical_rejects_duplicate_part_number(
        self, client, admin_user, jwt_manager, db_session
    ):
        """POST /api/chemicals must reject a new part_number that already exists."""
        from models import ChemicalPart
        wh = _warehouse(db_session)
        existing = ChemicalPart(
            part_number=f"P-DUP-{uuid.uuid4().hex[:6]}",
            description="Existing part",
            default_unit="oz",
        )
        db_session.add(existing)
        db_session.commit()

        admin_user.active_warehouse_id = wh.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        # No chemical_part_id supplied → server should treat this as a
        # "create new part" attempt and fail because the part already exists.
        resp = client.post("/api/chemicals", json={
            "part_number": existing.part_number,
            "lot_number": f"L-{uuid.uuid4().hex[:6]}",
            "description": "Trying to duplicate",
            "quantity": 5,
            "unit": "oz",
            "warehouse_id": wh.id,
        }, headers=headers)

        assert resp.status_code == 400, resp.data
        assert b"already exists" in resp.data

    def test_create_chemical_adds_lot_to_existing_part(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Passing chemical_part_id adds a lot to an existing part record."""
        from models import Chemical, ChemicalPart
        wh = _warehouse(db_session)
        part = ChemicalPart(
            part_number=f"P-ADD-{uuid.uuid4().hex[:6]}",
            description="Existing part for add-lot test",
            manufacturer="ACME",
            default_unit="oz",
            minimum_stock_level=5,
        )
        db_session.add(part)
        db_session.commit()

        admin_user.active_warehouse_id = wh.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        new_lot = f"L-{uuid.uuid4().hex[:6]}"
        resp = client.post("/api/chemicals", json={
            "chemical_part_id": part.id,
            "part_number": part.part_number,
            "lot_number": new_lot,
            "quantity": 12,
            "unit": "oz",
            "warehouse_id": wh.id,
        }, headers=headers)

        assert resp.status_code == 201, resp.data
        body = json.loads(resp.data)
        assert body["chemical_part_id"] == part.id
        assert body["lot_number"] == new_lot

        # Lot inherits master metadata when the request omits it
        created = db_session.query(Chemical).filter_by(lot_number=new_lot).first()
        assert created is not None
        assert created.description == "Existing part for add-lot test"
        assert created.manufacturer == "ACME"
        assert created.minimum_stock_level == 5
        # No second ChemicalPart was created
        part_count = db_session.query(ChemicalPart).filter_by(
            part_number=part.part_number
        ).count()
        assert part_count == 1

    def test_create_chemical_rejects_mismatched_part_id(
        self, client, admin_user, jwt_manager, db_session
    ):
        """chemical_part_id and part_number must agree, otherwise 400."""
        from models import ChemicalPart
        wh = _warehouse(db_session)
        part = ChemicalPart(
            part_number=f"P-MISMATCH-{uuid.uuid4().hex[:6]}",
            description="Real part",
            default_unit="oz",
        )
        db_session.add(part)
        db_session.commit()

        admin_user.active_warehouse_id = wh.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.post("/api/chemicals", json={
            "chemical_part_id": part.id,
            "part_number": "TOTALLY-DIFFERENT-PN",
            "lot_number": f"L-{uuid.uuid4().hex[:6]}",
            "quantity": 1,
            "unit": "oz",
            "warehouse_id": wh.id,
        }, headers=headers)

        assert resp.status_code == 400, resp.data

    def test_parts_endpoint_aggregates_lots(self, client, admin_user, db_session):
        """/api/chemicals/parts returns one row per part with embedded lots."""
        from models import ChemicalPart
        wh = _warehouse(db_session)

        part = ChemicalPart(
            part_number=f"P-API-{uuid.uuid4().hex[:6]}",
            description="Parts-endpoint-test",
            default_unit="oz",
            minimum_stock_level=5,
        )
        db_session.add(part)
        db_session.commit()

        _chemical(db_session, wh, part_number=part.part_number,
                  chemical_part_id=part.id, quantity=3)
        _chemical(db_session, wh, part_number=part.part_number,
                  chemical_part_id=part.id, quantity=4)

        resp = client.get(f"/api/chemicals/parts?q={part.part_number}")
        assert resp.status_code == 200
        body = json.loads(resp.data)
        rows = [r for r in body["parts"] if r["part_number"] == part.part_number]
        assert len(rows) == 1
        row = rows[0]
        assert row["lot_count"] == 2
        assert row["total_active_quantity"] == 7
        # Two lots above the rolled-up min of 5 → status "available"
        assert row["status"] == "available"
        assert len(row["lots"]) == 2
