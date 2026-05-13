"""Feature-flag deactivation tests.

When ``FEATURE_KIT_MANAGEMENT`` / ``FEATURE_REQUESTS`` are off, the deprecated
endpoints must return ``410 Gone`` with a documented payload. Endpoints kept
live to back the Field Locations admin + Tools-page send/return flow must
still respond.
"""

import uuid

import pytest

from models_kits import AircraftType, Kit


def _flag_off(app, flag: str):
    """Context-managed override that flips a flag off for the duration of a test."""
    return app.test_request_context() if False else _Override(app, flag)


class _Override:
    def __init__(self, app, flag):
        self.app = app
        self.flag = flag
        self.original = None

    def __enter__(self):
        self.original = self.app.config.get(self.flag, False)
        self.app.config[self.flag] = False
        return self

    def __exit__(self, *exc):
        self.app.config[self.flag] = self.original


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
        name=f"Flag Kit {uuid.uuid4().hex[:6]}",
        aircraft_type_id=aircraft_type.id,
        status="active",
        created_by=admin_user.id,
    )
    db_session.add(kit)
    db_session.commit()
    return kit


class TestKitManagementDisabled:
    def test_wizard_returns_410(self, app, client, auth_headers_materials):
        with _Override(app, "FEATURE_KIT_MANAGEMENT"):
            resp = client.post(
                "/api/kits/wizard",
                json={"step": 1},
                headers=auth_headers_materials,
            )
            assert resp.status_code == 410
            body = resp.get_json()
            assert body["feature"] == "kit_management"
            assert body["error"] == "feature_disabled"

    def test_master_kits_returns_410(self, app, client, auth_headers_admin):
        with _Override(app, "FEATURE_KIT_MANAGEMENT"):
            resp = client.get("/api/master-kits", headers=auth_headers_admin)
            assert resp.status_code == 410

    def test_kit_list_still_live(self, app, client, auth_headers_materials):
        # The slim kit list backs the Field Locations admin and must stay live.
        with _Override(app, "FEATURE_KIT_MANAGEMENT"):
            resp = client.get("/api/kits", headers=auth_headers_materials)
            assert resp.status_code == 200

    def test_kit_locations_still_live(self, app, client, auth_headers_materials):
        with _Override(app, "FEATURE_KIT_MANAGEMENT"):
            resp = client.get("/api/kits/locations", headers=auth_headers_materials)
            assert resp.status_code == 200

    def test_kit_detail_still_live(
        self, app, client, auth_headers_materials, test_kit
    ):
        with _Override(app, "FEATURE_KIT_MANAGEMENT"):
            resp = client.get(
                f"/api/kits/{test_kit.id}", headers=auth_headers_materials
            )
            assert resp.status_code == 200

    def test_kit_subresource_returns_410(
        self, app, client, auth_headers_materials, test_kit
    ):
        with _Override(app, "FEATURE_KIT_MANAGEMENT"):
            resp = client.get(
                f"/api/kits/{test_kit.id}/items", headers=auth_headers_materials
            )
            assert resp.status_code == 410


class TestRequestsDisabled:
    def test_user_requests_list_returns_410(
        self, app, client, auth_headers_materials
    ):
        with _Override(app, "FEATURE_REQUESTS"):
            resp = client.get(
                "/api/user-requests", headers=auth_headers_materials
            )
            assert resp.status_code == 410
            assert resp.get_json()["feature"] == "requests"

    def test_orders_returns_410(self, app, client, auth_headers_materials):
        with _Override(app, "FEATURE_REQUESTS"):
            resp = client.get("/api/orders", headers=auth_headers_materials)
            assert resp.status_code == 410
