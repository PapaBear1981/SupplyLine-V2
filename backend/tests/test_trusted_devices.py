"""Tests for the trusted-device feature — login shortcut, issuance, revocation."""

import json
import uuid
from datetime import timedelta

import pyotp
import pytest

from auth import JWTManager
from auth.trusted_devices import TRUSTED_DEVICE_COOKIE
from models import TrustedDevice, User, UserActivity, db, get_current_time


def _make_totp_user(db_session, password="user123"):
    emp = f"TDU{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Trusted Device User",
        employee_number=emp,
        department="Engineering",
        is_admin=False,
        is_active=True,
    )
    user.set_password(password)
    # Generate a real TOTP secret and enable 2FA.
    secret = pyotp.random_base32()
    user.set_totp_secret_encrypted(secret)
    user.is_totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return user, secret, password


def _current_totp(secret):
    return pyotp.TOTP(secret).now()


def _login(client, user, password):
    return client.post(
        "/api/auth/login",
        json={"employee_number": user.employee_number, "password": password},
    )


def _verify_totp(client, user, secret, trust_device=False):
    return client.post(
        "/api/auth/totp/verify",
        json={
            "employee_number": user.employee_number,
            "code": _current_totp(secret),
            "trust_device": trust_device,
        },
    )


def _set_client_cookie(client, name, value):
    client.set_cookie(name, value, domain="localhost")


def _clear_client_cookie(client, name):
    client.delete_cookie(name, domain="localhost")


def _all_set_cookies(response):
    """Join every Set-Cookie header so we can substring-match across cookies."""
    return "\n".join(response.headers.getlist("Set-Cookie"))


class TestTotpVerifyIssuesTrustedDeviceCookie:
    def test_cookie_issued_when_trust_device_true(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)

        response = _verify_totp(client, user, secret, trust_device=True)
        assert response.status_code == 200
        data = response.get_json()
        assert data["trusted_device_issued"] is True

        set_cookie = _all_set_cookies(response)
        assert "trusted_device_token=" in set_cookie

        rows = TrustedDevice.query.filter_by(user_id=user.id).all()
        assert len(rows) == 1
        assert rows[0].revoked_at is None
        assert rows[0].expires_at > get_current_time()
        # Token is never stored in plaintext — only the sha256 hash.
        assert len(rows[0].token_hash) == 64

    def test_cookie_not_issued_when_flag_absent(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)

        response = _verify_totp(client, user, secret, trust_device=False)
        assert response.status_code == 200

        set_cookie = _all_set_cookies(response)
        assert "trusted_device_token=" not in set_cookie
        assert TrustedDevice.query.filter_by(user_id=user.id).count() == 0


class TestLoginShortcutWithTrustedDevice:
    def test_login_with_valid_cookie_skips_totp(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        # Second login on same client should skip TOTP_REQUIRED.
        response = _login(client, user, password)
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("used_trusted_device") is True
        assert "access_token" in data
        assert data.get("code") != "TOTP_REQUIRED"
        assert data.get("requires_totp") is not True

    def test_login_with_expired_cookie_falls_back_to_totp(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        # Expire the row.
        device = TrustedDevice.query.filter_by(user_id=user.id).first()
        device.expires_at = get_current_time() - timedelta(days=1)
        db.session.commit()

        response = _login(client, user, password)
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("code") == "TOTP_REQUIRED"
        assert data.get("used_trusted_device") is not True

        # The bad cookie should be cleared on the response.
        set_cookie = _all_set_cookies(response)
        assert "trusted_device_token=" in set_cookie
        assert "Max-Age=0" in set_cookie or "max-age=0" in set_cookie.lower()

        # A trusted_device_rejected activity must have been logged.
        rejected = UserActivity.query.filter_by(
            user_id=user.id, activity_type="trusted_device_rejected"
        ).first()
        assert rejected is not None

    def test_login_with_revoked_cookie_falls_back_to_totp(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        device = TrustedDevice.query.filter_by(user_id=user.id).first()
        device.revoked_at = get_current_time()
        db.session.commit()

        response = _login(client, user, password)
        data = response.get_json()
        assert data.get("code") == "TOTP_REQUIRED"

    def test_cookie_for_other_user_is_rejected(self, client, db_session):
        # User A gets a trusted-device cookie.
        user_a, secret_a, pw_a = _make_totp_user(db_session)
        _login(client, user_a, pw_a)
        verify_resp = _verify_totp(client, user_a, secret_a, trust_device=True)
        assert verify_resp.status_code == 200

        # Pull the raw cookie the client is holding for user A.
        raw_cookie = client.get_cookie(TRUSTED_DEVICE_COOKIE, domain="localhost")
        assert raw_cookie is not None
        token_value = raw_cookie.value

        # Switch to user B with the same cookie.
        user_b, _secret_b, pw_b = _make_totp_user(db_session)
        _clear_client_cookie(client, TRUSTED_DEVICE_COOKIE)
        _set_client_cookie(client, TRUSTED_DEVICE_COOKIE, token_value)

        response = _login(client, user_b, pw_b)
        data = response.get_json()
        assert data.get("code") == "TOTP_REQUIRED"

        rejected = UserActivity.query.filter_by(
            user_id=user_b.id, activity_type="trusted_device_rejected"
        ).first()
        assert rejected is not None


class TestBackupCodeTrustDevice:
    def test_backup_code_verify_issues_cookie(self, client, db_session):
        import json as _json

        from werkzeug.security import generate_password_hash

        user, _secret, _password = _make_totp_user(db_session)
        # Seed a single backup code.
        user.backup_codes = _json.dumps([generate_password_hash("ABCD1234")])
        db.session.commit()

        response = client.post(
            "/api/auth/totp/verify-backup-code",
            json={
                "employee_number": user.employee_number,
                "code": "ABCD1234",
                "trust_device": True,
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["trusted_device_issued"] is True
        assert TrustedDevice.query.filter_by(user_id=user.id).count() == 1


class TestTrustedDeviceManagementRoutes:
    def _auth_headers(self, app, user):
        with app.app_context():
            tokens = JWTManager.generate_tokens(user)
        return {"Authorization": f"Bearer {tokens['access_token']}"}

    def test_list_marks_current_device(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        response = client.get("/api/auth/trusted-devices")
        assert response.status_code == 200
        payload = response.get_json()
        assert len(payload["devices"]) == 1
        assert payload["devices"][0]["is_current"] is True

    def test_revoke_single_device(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)
        device_id = TrustedDevice.query.filter_by(user_id=user.id).first().id

        response = client.delete(f"/api/auth/trusted-devices/{device_id}")
        assert response.status_code == 200

        row = TrustedDevice.query.get(device_id)
        assert row.revoked_at is not None

        # Next login falls back to TOTP.
        follow = _login(client, user, password)
        assert follow.get_json().get("code") == "TOTP_REQUIRED"

    def test_revoke_all_devices(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        response = client.delete("/api/auth/trusted-devices")
        assert response.status_code == 200
        assert response.get_json()["count"] == 1

        rows = TrustedDevice.query.filter_by(user_id=user.id).all()
        assert all(r.revoked_at is not None for r in rows)

        set_cookie = _all_set_cookies(response)
        assert "trusted_device_token=" in set_cookie
        assert "Max-Age=0" in set_cookie or "max-age=0" in set_cookie.lower()


class TestRevocationOnPasswordAndTotpChanges:
    def test_totp_disable_wipes_devices(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        # /api/auth/totp/disable needs an authenticated request.
        response = client.post(
            "/api/auth/totp/disable", json={"password": password}
        )
        assert response.status_code == 200
        assert response.get_json().get("revoked_trusted_devices") == 1

        rows = TrustedDevice.query.filter_by(user_id=user.id).all()
        assert all(r.revoked_at is not None for r in rows)

    def test_profile_password_change_wipes_devices(self, client, db_session):
        user, secret, password = _make_totp_user(db_session)
        _login(client, user, password)
        _verify_totp(client, user, secret, trust_device=True)

        new_password = "NewPassword9"
        response = client.put(
            "/api/profile/password",
            json={
                "current_password": password,
                "new_password": new_password,
                "confirm_password": new_password,
            },
        )
        assert response.status_code == 200

        rows = TrustedDevice.query.filter_by(user_id=user.id).all()
        assert rows, "expected a trusted_devices row to exist"
        assert all(r.revoked_at is not None for r in rows)


class TestMaxPerUserPruning:
    def test_issuing_beyond_max_revokes_oldest(self, client, db_session, monkeypatch):
        monkeypatch.setitem(client.application.config, "TRUSTED_DEVICE_MAX_PER_USER", 3)

        user, secret, password = _make_totp_user(db_session)
        # Issue 4 devices on separate "clients" by re-creating cookies.
        created_ids = []
        for i in range(4):
            _clear_client_cookie(client, TRUSTED_DEVICE_COOKIE)
            _login(client, user, password)
            resp = _verify_totp(client, user, secret, trust_device=True)
            assert resp.status_code == 200
            latest = (
                TrustedDevice.query
                .filter_by(user_id=user.id)
                .order_by(TrustedDevice.created_at.desc())
                .first()
            )
            created_ids.append(latest.id)

        active = (
            TrustedDevice.query
            .filter_by(user_id=user.id, revoked_at=None)
            .count()
        )
        assert active == 3

        # The very first device should be the one that was pruned.
        first = TrustedDevice.query.get(created_ids[0])
        assert first.revoked_at is not None
