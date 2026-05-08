"""Tests for the on-call schedule routes (/api/oncall/schedule + admin CRUD)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from models import OnCallSchedule, User, db


def _today():
    """Timezone-aware "today" used everywhere in this test module (DTZ011)."""
    return datetime.now(UTC).date()


@pytest.fixture
def schedule_user(db_session):
    """A second non-admin user used as a schedule assignee."""
    emp = f"ONC{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="On-Call Assignee",
        employee_number=emp,
        department="Maintenance",
        is_admin=False,
        is_active=True,
    )
    user.set_password("oncall123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(autouse=True)
def _clean_schedules(db_session):
    """Each test starts with a clean oncall_schedules table."""
    db_session.query(OnCallSchedule).delete()
    db_session.commit()
    yield
    db_session.query(OnCallSchedule).delete()
    db_session.commit()


def _payload(user_id, role="materials", days_ahead=0, length=7, notes=None):
    start = _today() + timedelta(days=days_ahead)
    end = start + timedelta(days=length - 1)
    body = {
        "role": role,
        "user_id": user_id,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
    if notes is not None:
        body["notes"] = notes
    return body, start, end


class TestOnCallScheduleAuth:
    def test_get_schedule_requires_auth(self, client):
        response = client.get("/api/oncall/schedule")
        assert response.status_code == 401

    def test_admin_endpoints_reject_regular_user(
        self, client, auth_headers_user, schedule_user
    ):
        body, _, _ = _payload(schedule_user.id)
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_user
        )
        assert response.status_code == 403

    def test_regular_user_can_view_schedule(
        self, client, auth_headers_user, auth_headers_admin, schedule_user
    ):
        body, _, _ = _payload(schedule_user.id)
        client.post("/api/admin/oncall/schedule", json=body, headers=auth_headers_admin)

        response = client.get("/api/oncall/schedule", headers=auth_headers_user)
        assert response.status_code == 200
        data = response.get_json()
        assert "schedules" in data
        assert len(data["schedules"]) == 1
        assert data["schedules"][0]["role"] == "materials"
        assert data["schedules"][0]["user"]["id"] == schedule_user.id


class TestCreateSchedule:
    def test_admin_can_create_schedule(
        self, client, auth_headers_admin, schedule_user
    ):
        body, start, end = _payload(schedule_user.id, notes="Holiday coverage")
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data["role"] == "materials"
        assert data["user"]["id"] == schedule_user.id
        assert data["start_date"] == start.isoformat()
        assert data["end_date"] == end.isoformat()
        assert data["notes"] == "Holiday coverage"
        assert data["created_by"] is not None

    def test_invalid_role_rejected(self, client, auth_headers_admin, schedule_user):
        body, _, _ = _payload(schedule_user.id, role="janitorial")
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_missing_user_id_rejected(self, client, auth_headers_admin):
        start = _today()
        body = {
            "role": "materials",
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=3)).isoformat(),
        }
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_unknown_user_rejected(self, client, auth_headers_admin):
        body, _, _ = _payload(999_999)
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_end_before_start_rejected(self, client, auth_headers_admin, schedule_user):
        start = _today()
        body = {
            "role": "materials",
            "user_id": schedule_user.id,
            "start_date": start.isoformat(),
            "end_date": (start - timedelta(days=1)).isoformat(),
        }
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_bad_date_format_rejected(self, client, auth_headers_admin, schedule_user):
        body = {
            "role": "materials",
            "user_id": schedule_user.id,
            "start_date": "tomorrow",
            "end_date": "2026-01-01",
        }
        response = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestOverlapDetection:
    def test_overlap_returns_409_with_conflict(
        self, client, auth_headers_admin, schedule_user
    ):
        first, _, _ = _payload(schedule_user.id, days_ahead=1, length=7)
        r1 = client.post(
            "/api/admin/oncall/schedule", json=first, headers=auth_headers_admin
        )
        assert r1.status_code == 201

        # Overlapping window for same role
        second, _, _ = _payload(schedule_user.id, days_ahead=4, length=7)
        r2 = client.post(
            "/api/admin/oncall/schedule", json=second, headers=auth_headers_admin
        )
        assert r2.status_code == 409
        data = r2.get_json()
        assert "conflict" in data
        assert data["conflict"]["role"] == "materials"

    def test_allow_overlap_creates_anyway(
        self, client, auth_headers_admin, schedule_user
    ):
        first, _, _ = _payload(schedule_user.id, days_ahead=1, length=7)
        client.post(
            "/api/admin/oncall/schedule", json=first, headers=auth_headers_admin
        )

        second, _, _ = _payload(schedule_user.id, days_ahead=4, length=7)
        second["allow_overlap"] = True
        r2 = client.post(
            "/api/admin/oncall/schedule", json=second, headers=auth_headers_admin
        )
        assert r2.status_code == 201

    def test_overlap_only_within_same_role(
        self, client, auth_headers_admin, schedule_user
    ):
        first, _, _ = _payload(schedule_user.id, role="materials", days_ahead=1)
        r1 = client.post(
            "/api/admin/oncall/schedule", json=first, headers=auth_headers_admin
        )
        assert r1.status_code == 201

        second, _, _ = _payload(schedule_user.id, role="maintenance", days_ahead=1)
        r2 = client.post(
            "/api/admin/oncall/schedule", json=second, headers=auth_headers_admin
        )
        assert r2.status_code == 201


class TestUpdateAndDelete:
    def _create(self, client, auth_headers_admin, schedule_user, **kwargs):
        body, _, _ = _payload(schedule_user.id, **kwargs)
        r = client.post(
            "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
        )
        assert r.status_code == 201
        return r.get_json()

    def test_update_changes_fields(
        self, client, auth_headers_admin, schedule_user
    ):
        created = self._create(client, auth_headers_admin, schedule_user)
        new_end = (_today() + timedelta(days=14)).isoformat()
        r = client.put(
            f"/api/admin/oncall/schedule/{created['id']}",
            json={"end_date": new_end, "notes": "Extended coverage"},
            headers=auth_headers_admin,
        )
        assert r.status_code == 200
        data = r.get_json()
        assert data["end_date"] == new_end
        assert data["notes"] == "Extended coverage"

    def test_update_invalid_date_order_rejected(
        self, client, auth_headers_admin, schedule_user
    ):
        created = self._create(client, auth_headers_admin, schedule_user)
        bad_end = (_today() - timedelta(days=10)).isoformat()
        r = client.put(
            f"/api/admin/oncall/schedule/{created['id']}",
            json={"end_date": bad_end},
            headers=auth_headers_admin,
        )
        assert r.status_code == 400

    def test_update_missing_returns_404(self, client, auth_headers_admin):
        r = client.put(
            "/api/admin/oncall/schedule/999999",
            json={"notes": "x"},
            headers=auth_headers_admin,
        )
        assert r.status_code == 404

    def test_delete_removes_schedule(
        self, client, auth_headers_admin, schedule_user
    ):
        created = self._create(client, auth_headers_admin, schedule_user)
        r = client.delete(
            f"/api/admin/oncall/schedule/{created['id']}",
            headers=auth_headers_admin,
        )
        assert r.status_code == 200
        assert r.get_json()["deleted"] is True
        assert db.session.get(OnCallSchedule, created["id"]) is None

    def test_delete_missing_returns_404(self, client, auth_headers_admin):
        r = client.delete(
            "/api/admin/oncall/schedule/999999", headers=auth_headers_admin
        )
        assert r.status_code == 404


class TestListAndFilters:
    def _seed(self, client, auth_headers_admin, schedule_user):
        # Three entries: past (materials), current (materials), future (maintenance)
        today = _today()
        rows = [
            {
                "role": "materials",
                "user_id": schedule_user.id,
                "start_date": (today - timedelta(days=14)).isoformat(),
                "end_date": (today - timedelta(days=8)).isoformat(),
            },
            {
                "role": "materials",
                "user_id": schedule_user.id,
                "start_date": (today - timedelta(days=1)).isoformat(),
                "end_date": (today + timedelta(days=5)).isoformat(),
            },
            {
                "role": "maintenance",
                "user_id": schedule_user.id,
                "start_date": (today + timedelta(days=10)).isoformat(),
                "end_date": (today + timedelta(days=20)).isoformat(),
            },
        ]
        for body in rows:
            r = client.post(
                "/api/admin/oncall/schedule", json=body, headers=auth_headers_admin
            )
            assert r.status_code == 201

    def test_default_window_excludes_past(
        self, client, auth_headers_user, auth_headers_admin, schedule_user
    ):
        self._seed(client, auth_headers_admin, schedule_user)
        r = client.get("/api/oncall/schedule", headers=auth_headers_user)
        assert r.status_code == 200
        schedules = r.get_json()["schedules"]
        # Should include the current materials and the future maintenance, but not the past one.
        assert len(schedules) == 2
        roles = {s["role"] for s in schedules}
        assert roles == {"materials", "maintenance"}

    def test_role_filter(
        self, client, auth_headers_user, auth_headers_admin, schedule_user
    ):
        self._seed(client, auth_headers_admin, schedule_user)
        r = client.get(
            "/api/oncall/schedule?role=maintenance", headers=auth_headers_user
        )
        assert r.status_code == 200
        schedules = r.get_json()["schedules"]
        assert len(schedules) == 1
        assert schedules[0]["role"] == "maintenance"

    def test_explicit_window_includes_past(
        self, client, auth_headers_user, auth_headers_admin, schedule_user
    ):
        self._seed(client, auth_headers_admin, schedule_user)
        start = (_today() - timedelta(days=30)).isoformat()
        end = (_today() + timedelta(days=30)).isoformat()
        r = client.get(
            f"/api/oncall/schedule?start={start}&end={end}",
            headers=auth_headers_user,
        )
        assert r.status_code == 200
        schedules = r.get_json()["schedules"]
        assert len(schedules) == 3

    def test_invalid_role_filter_rejected(self, client, auth_headers_user):
        r = client.get("/api/oncall/schedule?role=bogus", headers=auth_headers_user)
        assert r.status_code == 400


class TestActiveScheduleOverridesManual:
    """The dashboard's /api/oncall endpoint should reflect the schedule when
    a schedule entry covers today, falling back to the manual SystemSetting
    override otherwise."""

    def _set_manual(self, client, auth_headers_admin, materials_id=None, maintenance_id=None):
        body = {}
        if materials_id is not None:
            body["materials_user_id"] = materials_id
        if maintenance_id is not None:
            body["maintenance_user_id"] = maintenance_id
        r = client.put("/api/admin/oncall", json=body, headers=auth_headers_admin)
        assert r.status_code == 200

    def _create_schedule(self, client, auth_headers_admin, user_id, role, days_offset=0):
        start = _today() + timedelta(days=days_offset)
        end = start + timedelta(days=6)
        r = client.post(
            "/api/admin/oncall/schedule",
            json={
                "role": role,
                "user_id": user_id,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            },
            headers=auth_headers_admin,
        )
        assert r.status_code == 201
        return r.get_json()

    def test_dashboard_falls_back_to_manual_when_no_schedule_today(
        self, client, auth_headers_admin, admin_user, auth_headers_user
    ):
        self._set_manual(client, auth_headers_admin, materials_id=admin_user.id)

        r = client.get("/api/oncall", headers=auth_headers_user)
        assert r.status_code == 200
        data = r.get_json()
        assert data["materials"]["user"]["id"] == admin_user.id
        assert data["materials"]["source"] == "manual"
        assert data["materials"]["schedule"] is None

    def test_dashboard_uses_active_schedule_over_manual(
        self, client, auth_headers_admin, admin_user, schedule_user, auth_headers_user
    ):
        # Manual fallback says admin
        self._set_manual(client, auth_headers_admin, materials_id=admin_user.id)
        # Active schedule says schedule_user (today is inside the range)
        self._create_schedule(
            client, auth_headers_admin, schedule_user.id, "materials", days_offset=0
        )

        r = client.get("/api/oncall", headers=auth_headers_user)
        assert r.status_code == 200
        data = r.get_json()
        assert data["materials"]["user"]["id"] == schedule_user.id
        assert data["materials"]["source"] == "schedule"
        assert data["materials"]["schedule"] is not None
        assert data["materials"]["schedule"]["start_date"] == _today().isoformat()

    def test_future_schedule_does_not_override_manual(
        self, client, auth_headers_admin, admin_user, schedule_user, auth_headers_user
    ):
        self._set_manual(client, auth_headers_admin, materials_id=admin_user.id)
        # Schedule starts tomorrow — should not affect today
        self._create_schedule(
            client, auth_headers_admin, schedule_user.id, "materials", days_offset=1
        )

        r = client.get("/api/oncall", headers=auth_headers_user)
        data = r.get_json()
        assert data["materials"]["user"]["id"] == admin_user.id
        assert data["materials"]["source"] == "manual"

    def test_admin_endpoint_also_reflects_schedule(
        self, client, auth_headers_admin, admin_user, schedule_user
    ):
        self._set_manual(client, auth_headers_admin, materials_id=admin_user.id)
        self._create_schedule(
            client, auth_headers_admin, schedule_user.id, "materials", days_offset=0
        )

        r = client.get("/api/admin/oncall", headers=auth_headers_admin)
        data = r.get_json()
        assert data["materials"]["user"]["id"] == schedule_user.id
        assert data["materials"]["source"] == "schedule"

    def test_schedule_for_one_role_does_not_affect_other(
        self, client, auth_headers_admin, admin_user, schedule_user, auth_headers_user
    ):
        self._set_manual(
            client,
            auth_headers_admin,
            materials_id=admin_user.id,
            maintenance_id=admin_user.id,
        )
        # Active schedule only for materials
        self._create_schedule(
            client, auth_headers_admin, schedule_user.id, "materials", days_offset=0
        )

        r = client.get("/api/oncall", headers=auth_headers_user)
        data = r.get_json()
        assert data["materials"]["source"] == "schedule"
        assert data["materials"]["user"]["id"] == schedule_user.id
        assert data["maintenance"]["source"] == "manual"
        assert data["maintenance"]["user"]["id"] == admin_user.id
