"""End-to-end tests for the tool-centric field deployment endpoints.

Covers:

- ``POST /api/tools/<id>/send-to-field``
- ``POST /api/tools/<id>/return-from-field``
- ``GET  /api/tools/<id>/field-history``
"""

import uuid

import pytest

from models_kits import AircraftType, Kit, KitToolCheckout


@pytest.fixture
def aircraft_type(db_session):
    at = AircraftType.query.filter_by(name="Q400").first()
    if not at:
        at = AircraftType(name="Q400", description="Test", is_active=True)
        db_session.add(at)
        db_session.commit()
    return at


@pytest.fixture
def field_kit(db_session, admin_user, aircraft_type):
    """A pre-registered field location (kit) with tail + tanker numbers."""
    kit = Kit(
        name=f"Field Kit {uuid.uuid4().hex[:8]}",
        aircraft_type_id=aircraft_type.id,
        status="active",
        created_by=admin_user.id,
        aircraft_tail_number=f"N{uuid.uuid4().hex[:5].upper()}",
        tanker_scooper_number=f"T-{uuid.uuid4().hex[:3].upper()}",
        trailer_number=f"TR-{uuid.uuid4().hex[:3].upper()}",
    )
    db_session.add(kit)
    db_session.commit()
    return kit


@pytest.fixture
def inactive_field_kit(db_session, admin_user, aircraft_type):
    kit = Kit(
        name=f"Retired Kit {uuid.uuid4().hex[:8]}",
        aircraft_type_id=aircraft_type.id,
        status="retired",
        created_by=admin_user.id,
    )
    db_session.add(kit)
    db_session.commit()
    return kit


class TestSendToField:
    def test_materials_user_can_send_tool(
        self, client, auth_headers_materials, test_tool, field_kit, db_session
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": field_kit.id, "notes": "test deploy"},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        assert body["kit_tool_checkout"]["tool_id"] == test_tool.id
        assert body["kit_tool_checkout"]["kit_id"] == field_kit.id
        assert body["kit_tool_checkout"]["status"] == "active"
        # Tool itself reflects deployment.
        db_session.refresh(test_tool)
        assert test_tool.status == "checked_out"

    def test_send_requires_kit_id(
        self, client, auth_headers_materials, test_tool
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 400
        assert "kit_id" in resp.get_json()["error"]

    def test_send_rejects_unknown_kit(
        self, client, auth_headers_materials, test_tool
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": 999_999},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 404

    def test_send_rejects_inactive_kit(
        self, client, auth_headers_materials, test_tool, inactive_field_kit
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": inactive_field_kit.id},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 409

    def test_non_materials_user_forbidden(
        self, client, auth_headers_user, test_tool, field_kit
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": field_kit.id},
            headers=auth_headers_user,
        )
        assert resp.status_code == 403

    def test_admin_can_send(
        self, client, auth_headers_admin, test_tool, field_kit
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": field_kit.id},
            headers=auth_headers_admin,
        )
        assert resp.status_code == 201


class TestReturnFromField:
    def test_return_active_deployment(
        self, client, auth_headers_materials, test_tool, field_kit, db_session
    ):
        # Send first.
        send = client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": field_kit.id},
            headers=auth_headers_materials,
        )
        assert send.status_code == 201

        resp = client.post(
            f"/api/tools/{test_tool.id}/return-from-field",
            json={"return_notes": "back safely"},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 200, resp.get_json()
        assert resp.get_json()["kit_tool_checkout"]["status"] == "returned"

        db_session.refresh(test_tool)
        assert test_tool.status == "available"

    def test_return_404_when_no_active_deployment(
        self, client, auth_headers_materials, test_tool
    ):
        resp = client.post(
            f"/api/tools/{test_tool.id}/return-from-field",
            json={},
            headers=auth_headers_materials,
        )
        assert resp.status_code == 404


class TestFieldHistory:
    def test_history_includes_active_and_returned(
        self, client, auth_headers_materials, test_tool, field_kit
    ):
        client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": field_kit.id},
            headers=auth_headers_materials,
        )
        client.post(
            f"/api/tools/{test_tool.id}/return-from-field",
            json={},
            headers=auth_headers_materials,
        )
        client.post(
            f"/api/tools/{test_tool.id}/send-to-field",
            json={"kit_id": field_kit.id},
            headers=auth_headers_materials,
        )

        resp = client.get(
            f"/api/tools/{test_tool.id}/field-history",
            headers=auth_headers_materials,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total"] == 2
        assert body["active_deployment"] is not None
        assert body["active_kit"]["aircraft_tail_number"] == field_kit.aircraft_tail_number
        assert body["active_kit"]["trailer_number"] == field_kit.trailer_number

    def test_history_404_for_unknown_tool(
        self, client, auth_headers_materials
    ):
        resp = client.get(
            "/api/tools/9999999/field-history",
            headers=auth_headers_materials,
        )
        assert resp.status_code == 404
