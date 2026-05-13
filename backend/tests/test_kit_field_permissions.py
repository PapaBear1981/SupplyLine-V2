"""Permission tests for the field-deployment refactor.

After deactivating Kit Management, Materials users must still be able to
update a kit's *location* (address / lat / lng / trailer number) but must
NOT be able to register or rewrite the strict identifiers
``aircraft_tail_number`` and ``tanker_scooper_number`` — those are
admin-only.
"""

import uuid

import pytest

from models_kits import AircraftType, Kit


@pytest.fixture
def aircraft_type(db_session):
    at = AircraftType.query.filter_by(name="Q400").first()
    if not at:
        at = AircraftType(name="Q400", description="Test", is_active=True)
        db_session.add(at)
        db_session.commit()
    return at


@pytest.fixture
def test_kit(db_session, admin_user, aircraft_type):
    kit = Kit(
        name=f"Perm Kit {uuid.uuid4().hex[:8]}",
        aircraft_type_id=aircraft_type.id,
        status="active",
        created_by=admin_user.id,
        aircraft_tail_number="N123AB",
        tanker_scooper_number="T-7",
        trailer_number="TR-42",
    )
    db_session.add(kit)
    db_session.commit()
    return kit


class TestAdminOnlyKitFields:
    """Tail / tanker numbers may only be modified by admins."""

    def test_materials_cannot_set_tail_number_on_create(
        self, client, auth_headers_materials, aircraft_type
    ):
        resp = client.post(
            "/api/kits",
            json={
                "name": f"Forbidden {uuid.uuid4().hex[:6]}",
                "aircraft_type_id": aircraft_type.id,
                "aircraft_tail_number": "N999XX",
            },
            headers=auth_headers_materials,
        )
        assert resp.status_code == 403
        body = resp.get_json()
        assert body["code"] == "ADMIN_REQUIRED"
        assert "aircraft_tail_number" in body["fields"]

    def test_materials_cannot_set_tanker_number_on_create(
        self, client, auth_headers_materials, aircraft_type
    ):
        resp = client.post(
            "/api/kits",
            json={
                "name": f"Forbidden {uuid.uuid4().hex[:6]}",
                "aircraft_type_id": aircraft_type.id,
                "tanker_scooper_number": "T-99",
            },
            headers=auth_headers_materials,
        )
        assert resp.status_code == 403
        body = resp.get_json()
        assert "tanker_scooper_number" in body["fields"]

    def test_materials_cannot_change_tail_number_on_update(
        self, client, auth_headers_materials, test_kit
    ):
        resp = client.put(
            f"/api/kits/{test_kit.id}",
            json={"aircraft_tail_number": "N999XX"},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 403

    def test_admin_can_set_tail_and_tanker(
        self, client, auth_headers_admin, aircraft_type
    ):
        resp = client.post(
            "/api/kits",
            json={
                "name": f"Admin Kit {uuid.uuid4().hex[:6]}",
                "aircraft_type_id": aircraft_type.id,
                "aircraft_tail_number": "N42HQ",
                "tanker_scooper_number": "T-12",
            },
            headers=auth_headers_admin,
        )
        assert resp.status_code == 201
        body = resp.get_json()
        assert body["aircraft_tail_number"] == "N42HQ"
        assert body["tanker_scooper_number"] == "T-12"


class TestMaterialsLocationEdits:
    """Materials users should still be able to update location + trailer."""

    def test_materials_can_update_location_address(
        self, client, auth_headers_materials, test_kit
    ):
        resp = client.put(
            f"/api/kits/{test_kit.id}",
            json={
                "location_address": "456 New Apron",
                "location_city": "Seattle",
                "trailer_number": "TR-99",
            },
            headers=auth_headers_materials,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["location_address"] == "456 New Apron"
        assert body["trailer_number"] == "TR-99"

    def test_materials_can_update_location_only_endpoint(
        self, client, auth_headers_materials, test_kit
    ):
        resp = client.put(
            f"/api/kits/{test_kit.id}/location",
            json={"location_address": "789 Hangar Row"},
            headers=auth_headers_materials,
        )
        # Endpoint exists with @materials_required; should succeed.
        assert resp.status_code in (200, 204)
