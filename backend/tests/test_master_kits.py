"""
Integration tests for the master-kit feature: service module, routes,
wizard, import endpoints, and basic transfer-service behaviour.
"""

import io
import uuid

import pytest

from models import ChemicalPart, Chemical, Warehouse, db


pytestmark = pytest.mark.integration
from models_kits import (
    AircraftType, Kit, KitBox, KitExpendable, KitItem, KitTransfer,
    MasterKit, MasterKitBox, MasterKitEntry,
)
from services import master_kit_service
from services import transfer_service


# ─── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def aircraft_type(db_session):
    at = AircraftType(name=f"TestAC-{uuid.uuid4().hex[:6]}", is_active=True)
    db_session.add(at)
    db_session.commit()
    return at


@pytest.fixture
def warehouse(db_session):
    wh = Warehouse(name=f"TestWH-{uuid.uuid4().hex[:6]}", is_active=True)
    db_session.add(wh)
    db_session.commit()
    return wh


@pytest.fixture
def master_kit_with_entries(db_session, aircraft_type):
    """A master kit with two boxes and three entries (expendable + chemical part)."""
    cp = ChemicalPart(part_number=f"CP-{uuid.uuid4().hex[:6]}", description="Test sealant",
                     manufacturer="Test", category="Sealant", default_unit="tube")
    db_session.add(cp)
    db_session.commit()

    master = MasterKit(aircraft_type_id=aircraft_type.id, name="Test Master", is_active=True)
    db_session.add(master)
    db_session.commit()
    box1 = MasterKitBox(master_kit_id=master.id, box_number="Box1", box_type="expendable",
                        description="Expendables", sort_order=0)
    box2 = MasterKitBox(master_kit_id=master.id, box_number="Box2", box_type="tooling",
                        description="Tools", sort_order=1)
    db_session.add_all([box1, box2])
    db_session.commit()

    e1 = MasterKitEntry(master_kit_id=master.id, master_box_id=box1.id,
                       entry_type="expendable", part_number="EXP-001",
                       description="O-ring kit", required_quantity=10,
                       unit="each", tracking_type="lot", is_required=True)
    e2 = MasterKitEntry(master_kit_id=master.id, master_box_id=box1.id,
                       entry_type="chemical", ref_chemical_part_id=cp.id,
                       part_number=cp.part_number, description=cp.description,
                       required_quantity=2, unit="tube", is_required=True)
    e3 = MasterKitEntry(master_kit_id=master.id, master_box_id=box2.id,
                       entry_type="expendable", part_number="EXP-002",
                       description="Cotter pin", required_quantity=20,
                       unit="each", tracking_type="lot", is_required=True)
    db_session.add_all([e1, e2, e3])
    db_session.commit()
    return {"master": master, "box1": box1, "box2": box2, "entries": [e1, e2, e3], "chemical_part": cp}


@pytest.fixture
def linked_kit(db_session, master_kit_with_entries, admin_user):
    """A kit linked to the master, seeded via seed_kit_from_master."""
    m = master_kit_with_entries["master"]
    kit = Kit(name=f"TestKit-{uuid.uuid4().hex[:6]}", aircraft_type_id=m.aircraft_type_id,
              status="active", created_by=admin_user.id, master_kit_id=m.id)
    db_session.add(kit)
    db_session.commit()
    master_kit_service.seed_kit_from_master(kit, m)
    db_session.commit()
    return kit


# ─── Service: seeding ────────────────────────────────────────────────────────


class TestSeeding:
    def test_seed_creates_linked_boxes(self, db_session, master_kit_with_entries, admin_user):
        m = master_kit_with_entries["master"]
        kit = Kit(name=f"K-{uuid.uuid4().hex[:6]}", aircraft_type_id=m.aircraft_type_id,
                  status="active", created_by=admin_user.id, master_kit_id=m.id)
        db_session.add(kit)
        db_session.commit()
        result = master_kit_service.seed_kit_from_master(kit, m)
        db_session.commit()
        assert result["boxes_created"] == 2
        assert kit.boxes.count() == 2
        # All boxes are linked to their master counterparts.
        for kb in kit.boxes.all():
            assert kb.master_box_id is not None
            assert kb.is_custom is False

    def test_seed_does_not_create_kit_rows(self, linked_kit):
        # Per the design, no KitExpendable/KitItem rows are auto-created.
        assert linked_kit.expendables.count() == 0
        assert linked_kit.items.count() == 0

    def test_seed_is_idempotent(self, db_session, linked_kit, master_kit_with_entries):
        result = master_kit_service.seed_kit_from_master(linked_kit, master_kit_with_entries["master"])
        db_session.commit()
        # No new boxes created on re-run.
        assert result["boxes_created"] == 0
        assert linked_kit.boxes.count() == 2

    def test_seed_skip_entry_ids(self, db_session, master_kit_with_entries, admin_user):
        m = master_kit_with_entries["master"]
        skip = {master_kit_with_entries["entries"][0].id}
        kit = Kit(name=f"K-{uuid.uuid4().hex[:6]}", aircraft_type_id=m.aircraft_type_id,
                  status="active", created_by=admin_user.id, master_kit_id=m.id)
        db_session.add(kit)
        db_session.commit()
        result = master_kit_service.seed_kit_from_master(kit, m, skip_entry_ids=skip)
        db_session.commit()
        deferred_ids = {d["master_entry_id"] for d in result["entries_deferred_to_population"]}
        assert master_kit_with_entries["entries"][0].id not in deferred_ids


# ─── Service: compliance ─────────────────────────────────────────────────────


class TestCompliance:
    def test_unlinked_kit_returns_not_linked(self, db_session, aircraft_type, admin_user):
        kit = Kit(name=f"K-{uuid.uuid4().hex[:6]}", aircraft_type_id=aircraft_type.id,
                  status="active", created_by=admin_user.id)
        db_session.add(kit)
        db_session.commit()
        report = master_kit_service.compute_compliance(kit)
        assert report["linked_to_master"] is False

    def test_empty_kit_all_missing(self, linked_kit, master_kit_with_entries):
        report = master_kit_service.compute_compliance(linked_kit)
        assert report["linked_to_master"] is True
        assert len(report["missing"]) == 3
        assert report["percent_compliant"] == 0.0

    def test_added_extra_appears(self, db_session, linked_kit, master_kit_with_entries):
        # Add an expendable for one of the master entries.
        entry = master_kit_with_entries["entries"][0]  # EXP-001
        box = linked_kit.boxes.first()
        exp = KitExpendable(
            kit_id=linked_kit.id, box_id=box.id,
            part_number=entry.part_number, lot_number="LOT-X",
            tracking_type="lot", description=entry.description,
            quantity=entry.required_quantity, unit="each",
            master_entry_id=entry.id, is_custom=False,
        )
        db_session.add(exp)
        db_session.commit()
        report = master_kit_service.compute_compliance(linked_kit)
        missing_pns = {m["part_number"] for m in report["missing"]}
        assert entry.part_number not in missing_pns
        assert report["percent_compliant"] > 0

    def test_quantity_deviation_flagged(self, db_session, linked_kit, master_kit_with_entries):
        entry = master_kit_with_entries["entries"][0]  # required_quantity=10
        box = linked_kit.boxes.first()
        exp = KitExpendable(
            kit_id=linked_kit.id, box_id=box.id,
            part_number=entry.part_number, lot_number="LOT-Y",
            tracking_type="lot", description=entry.description,
            quantity=3, unit="each", master_entry_id=entry.id, is_custom=False,
        )
        db_session.add(exp)
        db_session.commit()
        report = master_kit_service.compute_compliance(linked_kit)
        dev_pns = {d["part_number"] for d in report["deviations"]}
        assert entry.part_number in dev_pns

    def test_extra_custom_row_in_extras(self, db_session, linked_kit):
        box = linked_kit.boxes.first()
        exp = KitExpendable(
            kit_id=linked_kit.id, box_id=box.id,
            part_number="EXP-WILDCARD", lot_number="LOT-Z",
            tracking_type="lot", description="not in master",
            quantity=1, unit="each", is_custom=True,
        )
        db_session.add(exp)
        db_session.commit()
        report = master_kit_service.compute_compliance(linked_kit)
        extras_pns = {e["part_number"] for e in report["extras"]}
        assert "EXP-WILDCARD" in extras_pns

    def test_on_entry_deleted_soft_unlinks_kit_rows(self, db_session, linked_kit,
                                                   master_kit_with_entries):
        entry = master_kit_with_entries["entries"][0]
        box = linked_kit.boxes.first()
        exp = KitExpendable(
            kit_id=linked_kit.id, box_id=box.id,
            part_number=entry.part_number, lot_number="LOT-DEL",
            tracking_type="lot", description=entry.description, quantity=1,
            unit="each", master_entry_id=entry.id, is_custom=False,
        )
        db_session.add(exp)
        db_session.commit()
        master_kit_service.on_master_entry_deleted(entry.id)
        db_session.commit()
        db_session.refresh(exp)
        assert exp.master_entry_id is None
        assert exp.is_custom is True


# ─── Service: effective_min_stock ────────────────────────────────────────────


class TestMinStockInheritance:
    def test_inherits_from_master_when_no_override(self, db_session, master_kit_with_entries, admin_user):
        m = master_kit_with_entries["master"]
        entry = master_kit_with_entries["entries"][0]
        entry.minimum_stock_level = 5
        db_session.commit()

        kit = Kit(name=f"K-{uuid.uuid4().hex[:6]}", aircraft_type_id=m.aircraft_type_id,
                  status="active", created_by=admin_user.id, master_kit_id=m.id)
        db_session.add(kit)
        db_session.commit()
        master_kit_service.seed_kit_from_master(kit, m)
        db_session.commit()
        box = kit.boxes.first()
        exp = KitExpendable(
            kit_id=kit.id, box_id=box.id, part_number=entry.part_number,
            lot_number="LOT-1", tracking_type="lot", description="x",
            quantity=10, unit="each", master_entry_id=entry.id,
        )
        db_session.add(exp)
        db_session.commit()
        assert master_kit_service.effective_min_stock(exp) == 5

    def test_override_takes_precedence(self, db_session, master_kit_with_entries, admin_user):
        m = master_kit_with_entries["master"]
        entry = master_kit_with_entries["entries"][0]
        entry.minimum_stock_level = 5
        db_session.commit()
        kit = Kit(name=f"K-{uuid.uuid4().hex[:6]}", aircraft_type_id=m.aircraft_type_id,
                  status="active", created_by=admin_user.id, master_kit_id=m.id)
        db_session.add(kit)
        db_session.commit()
        master_kit_service.seed_kit_from_master(kit, m)
        db_session.commit()
        box = kit.boxes.first()
        exp = KitExpendable(
            kit_id=kit.id, box_id=box.id, part_number=entry.part_number,
            lot_number="LOT-O", tracking_type="lot", description="x",
            quantity=10, unit="each", master_entry_id=entry.id,
            min_stock_override=2.0,
        )
        db_session.add(exp)
        db_session.commit()
        assert master_kit_service.effective_min_stock(exp) == 2.0


# ─── Routes ──────────────────────────────────────────────────────────────────


class TestMasterKitRoutes:
    def test_create_master_kit_requires_admin(self, client, auth_headers_user, aircraft_type):
        r = client.post("/api/master-kits", json={
            "aircraft_type_id": aircraft_type.id, "name": "X",
        }, headers=auth_headers_user)
        assert r.status_code == 403

    def test_create_master_kit_409_on_duplicate_aircraft_type(self, client, auth_headers_admin,
                                                              aircraft_type, db_session):
        r1 = client.post("/api/master-kits", json={
            "aircraft_type_id": aircraft_type.id, "name": "First",
        }, headers=auth_headers_admin)
        assert r1.status_code == 201
        r2 = client.post("/api/master-kits", json={
            "aircraft_type_id": aircraft_type.id, "name": "Second",
        }, headers=auth_headers_admin)
        assert r2.status_code == 409
        assert "existing_master_kit_id" in r2.get_json()

    def test_list_filter_by_aircraft_type(self, client, auth_headers_admin, aircraft_type, db_session):
        client.post("/api/master-kits", json={
            "aircraft_type_id": aircraft_type.id, "name": "First",
        }, headers=auth_headers_admin)
        r = client.get(f"/api/master-kits?aircraft_type_id={aircraft_type.id}",
                       headers=auth_headers_admin)
        assert r.status_code == 200
        assert len(r.get_json()["master_kits"]) == 1

    def test_get_master_for_aircraft_type(self, client, auth_headers_admin, aircraft_type):
        client.post("/api/master-kits", json={
            "aircraft_type_id": aircraft_type.id, "name": "Type Master",
        }, headers=auth_headers_admin)
        r = client.get(f"/api/aircraft-types/{aircraft_type.id}/master-kit",
                       headers=auth_headers_admin)
        assert r.status_code == 200
        assert r.get_json()["master_kit"] is not None

    def test_entry_uniqueness_409(self, client, auth_headers_admin, aircraft_type, db_session):
        r1 = client.post("/api/master-kits", json={
            "aircraft_type_id": aircraft_type.id, "name": "M",
        }, headers=auth_headers_admin)
        mid = r1.get_json()["id"]
        rb = client.post(f"/api/master-kits/{mid}/boxes", json={
            "box_number": "Box1", "box_type": "expendable",
        }, headers=auth_headers_admin)
        bid = rb.get_json()["id"]
        # First entry succeeds.
        r2 = client.post(f"/api/master-kits/{mid}/entries", json={
            "master_box_id": bid, "entry_type": "expendable", "part_number": "PN-1",
            "description": "x", "tracking_type": "lot",
        }, headers=auth_headers_admin)
        assert r2.status_code == 201
        # Duplicate is 409.
        r3 = client.post(f"/api/master-kits/{mid}/entries", json={
            "master_box_id": bid, "entry_type": "expendable", "part_number": "PN-1",
            "description": "y", "tracking_type": "lot",
        }, headers=auth_headers_admin)
        assert r3.status_code == 409


class TestComplianceEndpoint:
    def test_returns_shape(self, client, auth_headers_admin, linked_kit):
        r = client.get(f"/api/kits/{linked_kit.id}/compliance", headers=auth_headers_admin)
        assert r.status_code == 200
        payload = r.get_json()
        for key in ("missing", "extras", "deviations", "percent_compliant", "linked_to_master"):
            assert key in payload


# ─── Wizard ──────────────────────────────────────────────────────────────────


class TestWizard:
    def test_step1_includes_has_master(self, client, auth_headers_admin, aircraft_type, db_session):
        # No master yet: has_master should be False.
        r = client.post("/api/kits/wizard", json={"step": 1}, headers=auth_headers_admin)
        assert r.status_code == 200
        payload = r.get_json()
        ours = next((at for at in payload["aircraft_types"] if at["id"] == aircraft_type.id), None)
        assert ours is not None
        assert ours["has_master"] is False

        # Create a master, then expect has_master=True.
        mk = MasterKit(aircraft_type_id=aircraft_type.id, name="X", is_active=True)
        db_session.add(mk)
        db_session.commit()
        r2 = client.post("/api/kits/wizard", json={"step": 1}, headers=auth_headers_admin)
        ours2 = next((at for at in r2.get_json()["aircraft_types"] if at["id"] == aircraft_type.id), None)
        assert ours2["has_master"] is True
        assert ours2["master_kit_id"] == mk.id

    def test_step3_default_mode_when_no_master(self, client, auth_headers_admin, aircraft_type):
        r = client.post("/api/kits/wizard", json={"step": 3, "aircraft_type_id": aircraft_type.id},
                        headers=auth_headers_admin)
        assert r.status_code == 200
        payload = r.get_json()
        assert payload["mode"] == "default"
        assert payload["master_kit_id"] is None
        assert len(payload["suggested_boxes"]) == 5

    def test_step3_master_mode(self, client, auth_headers_admin, master_kit_with_entries):
        m = master_kit_with_entries["master"]
        r = client.post("/api/kits/wizard", json={"step": 3, "aircraft_type_id": m.aircraft_type_id},
                        headers=auth_headers_admin)
        assert r.status_code == 200
        payload = r.get_json()
        assert payload["mode"] == "master"
        assert payload["master_kit_id"] == m.id
        # Master has 2 boxes; both should be returned with entries embedded.
        assert len(payload["suggested_boxes"]) == 2
        assert "entries" in payload["suggested_boxes"][0]

    def test_step4_links_kit_to_master(self, client, auth_headers_admin, master_kit_with_entries):
        m = master_kit_with_entries["master"]
        kit_name = f"WizKit-{uuid.uuid4().hex[:6]}"
        r = client.post("/api/kits/wizard", json={
            "step": 4, "name": kit_name, "aircraft_type_id": m.aircraft_type_id,
            "master_kit_id": m.id, "use_master": True,
        }, headers=auth_headers_admin)
        assert r.status_code == 201, r.get_data(as_text=True)
        payload = r.get_json()
        assert payload["kit"]["master_kit_id"] == m.id

    def test_step4_without_master_creates_default_boxes(self, client, auth_headers_admin,
                                                       aircraft_type):
        kit_name = f"NoMaster-{uuid.uuid4().hex[:6]}"
        r = client.post("/api/kits/wizard", json={
            "step": 4, "name": kit_name, "aircraft_type_id": aircraft_type.id,
            "use_master": False,
        }, headers=auth_headers_admin)
        assert r.status_code == 201
        payload = r.get_json()
        assert payload["kit"]["master_kit_id"] is None


# ─── Wizard import endpoint ──────────────────────────────────────────────────


class TestWizardImport:
    def test_template_csv(self, client, auth_headers_admin):
        r = client.get("/api/kits/wizard/import-template?entry_type=expendable",
                       headers=auth_headers_admin)
        assert r.status_code == 200
        body = r.get_data(as_text=True)
        assert "master_entry_id" in body and "lot_number" in body

    def test_import_valid_csv(self, client, auth_headers_admin, master_kit_with_entries):
        m = master_kit_with_entries["master"]
        entry = master_kit_with_entries["entries"][0]
        csv = (
            "master_entry_id,part_number,lot_number,serial_number,quantity\n"
            f"{entry.id},EXP-001,LOT-A,,5\n"
            f"{entry.id},EXP-001,LOT-B,,3\n"
        )
        r = client.post("/api/kits/wizard/import-entries",
                        data={"master_kit_id": str(m.id),
                              "file": (io.BytesIO(csv.encode()), "rows.csv")},
                        content_type="multipart/form-data",
                        headers=auth_headers_admin)
        assert r.status_code == 200, r.get_data(as_text=True)
        payload = r.get_json()
        assert len(payload["rows"]) == 2
        assert payload["errors"] == []

    def test_import_rejects_unknown_master_entry_id(self, client, auth_headers_admin,
                                                   master_kit_with_entries):
        m = master_kit_with_entries["master"]
        csv = (
            "master_entry_id,part_number,lot_number,serial_number,quantity\n"
            "99999,EXP-001,LOT-A,,5\n"
        )
        r = client.post("/api/kits/wizard/import-entries",
                        data={"master_kit_id": str(m.id),
                              "file": (io.BytesIO(csv.encode()), "rows.csv")},
                        content_type="multipart/form-data",
                        headers=auth_headers_admin)
        assert r.status_code == 200
        payload = r.get_json()
        assert payload["rows"] == []
        assert any("does not belong" in e["error"] for e in payload["errors"])

    def test_import_rejects_expendable_without_lot_or_serial(self, client, auth_headers_admin,
                                                            master_kit_with_entries):
        m = master_kit_with_entries["master"]
        entry = master_kit_with_entries["entries"][0]
        csv = (
            "master_entry_id,part_number,lot_number,serial_number,quantity\n"
            f"{entry.id},EXP-001,,,1\n"
        )
        r = client.post("/api/kits/wizard/import-entries",
                        data={"master_kit_id": str(m.id),
                              "file": (io.BytesIO(csv.encode()), "rows.csv")},
                        content_type="multipart/form-data",
                        headers=auth_headers_admin)
        payload = r.get_json()
        assert payload["rows"] == []
        assert payload["errors"]


# ─── Transfer service ────────────────────────────────────────────────────────


class TestTransferService:
    def test_cancel_requires_permanent(self, db_session, linked_kit, admin_user, warehouse):
        # Make a field-mode transfer; cancellation should fail.
        t = KitTransfer(
            item_type="chemical", item_id=1,
            from_location_type="warehouse", from_location_id=warehouse.id,
            to_location_type="kit", to_location_id=linked_kit.id,
            quantity=1, transferred_by=admin_user.id, status="completed",
            transfer_mode="field",
        )
        db_session.add(t)
        db_session.commit()
        with pytest.raises(ValueError, match="permanent"):
            transfer_service.cancel_permanent_transfer(transfer_id=t.id, user_id=admin_user.id)

    def test_cancel_creates_compensating_row(self, db_session, linked_kit, admin_user, warehouse):
        from models import Tool
        tool = Tool(tool_number=f"T-{uuid.uuid4().hex[:6]}",
                    serial_number=f"S-{uuid.uuid4().hex[:6]}",
                    description="t", warehouse_id=warehouse.id, status="available")
        db_session.add(tool)
        db_session.commit()

        # Use the service for a real permanent transfer so the state changes are
        # consistent and the revert has something to undo.
        t = transfer_service.warehouse_to_kit(
            item_type="tool", item_id=tool.id, kit_id=linked_kit.id,
            quantity=1, transferred_by=admin_user.id, mode="permanent",
        )
        db_session.commit()
        assert tool.warehouse_id is None  # permanent mode cleared origin

        compensating = transfer_service.cancel_permanent_transfer(
            transfer_id=t.id, user_id=admin_user.id,
        )
        db_session.commit()
        assert compensating.reverts_transfer_id == t.id
        assert tool.warehouse_id == warehouse.id  # restored
