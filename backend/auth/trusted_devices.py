"""Trusted device token service.

Issues, validates, and revokes long-lived per-device tokens that let a user
skip the TOTP challenge on subsequent logins. Tokens are stored only as
SHA-256 hashes (never plaintext). A short non-secret prefix lets us narrow
lookups before performing a constant-time hash comparison.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from flask import current_app, request

from models import TrustedDevice, db, get_current_time


logger = logging.getLogger(__name__)

TRUSTED_DEVICE_COOKIE = "trusted_device_token"
TOKEN_BYTES = 48
PREFIX_LEN = 12


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _prefix(token: str) -> str:
    return token[:PREFIX_LEN]


def _ttl_days() -> int:
    return int(current_app.config.get("TRUSTED_DEVICE_TTL_DAYS", 30))


def _max_per_user() -> int:
    return int(current_app.config.get("TRUSTED_DEVICE_MAX_PER_USER", 10))


_BROWSER_RE = re.compile(r"(Firefox|Chrome|Edg|Safari|OPR)/[\d.]+")
_OS_RE = re.compile(r"(Windows NT [\d.]+|Mac OS X [\d_.]+|Android [\d.]+|iPhone OS [\d_]+|Linux)")


def _derive_label(user_agent: str | None) -> str:
    if not user_agent:
        return "Unknown device"
    browser = _BROWSER_RE.search(user_agent)
    os_match = _OS_RE.search(user_agent)
    if browser and os_match:
        browser_name = browser.group(1).replace("Edg", "Edge").replace("OPR", "Opera")
        os_name = os_match.group(1).replace("_", ".")
        return f"{browser_name} on {os_name}"[:120]
    return user_agent[:120]


def issue_trusted_device(user, user_agent: str | None, ip_address: str | None):
    """Create a new trusted_devices row. Returns (raw_token, TrustedDevice).

    Enforces TRUSTED_DEVICE_MAX_PER_USER by revoking the oldest active rows
    for the user when adding this one would exceed the cap.
    Caller is responsible for committing the session.
    """
    ttl_days = _ttl_days()
    if ttl_days <= 0:
        raise RuntimeError("TRUSTED_DEVICE_TTL_DAYS must be > 0 to issue trusted devices")

    token = secrets.token_urlsafe(TOKEN_BYTES)
    now = get_current_time()

    # Prune the oldest active devices before adding the new row so the cap is
    # enforced whether or not SQLAlchemy's autoflush has materialised the insert.
    max_per_user = _max_per_user()
    if max_per_user > 0:
        active = (
            TrustedDevice.query
            .filter_by(user_id=user.id, revoked_at=None)
            .filter(TrustedDevice.expires_at > now)
            .order_by(TrustedDevice.created_at.asc())
            .all()
        )
        excess = (len(active) + 1) - max_per_user
        for old in active[: max(excess, 0)]:
            old.revoked_at = now

    device = TrustedDevice(
        user_id=user.id,
        token_hash=_hash_token(token),
        token_prefix=_prefix(token),
        device_label=_derive_label(user_agent),
        user_agent=(user_agent or "")[:512] or None,
        ip_address=(ip_address or "")[:64] or None,
        created_at=now,
        expires_at=now + timedelta(days=ttl_days),
    )
    db.session.add(device)
    db.session.flush()
    return token, device


def validate_trusted_device_token(token: str | None, user_id: int):
    """Return the active TrustedDevice row for (token, user_id) or None."""
    if not token or len(token) < PREFIX_LEN + 1:
        return None

    candidates = (
        TrustedDevice.query
        .filter_by(token_prefix=_prefix(token), user_id=user_id)
        .all()
    )
    expected = _hash_token(token)
    for candidate in candidates:
        if hmac.compare_digest(candidate.token_hash, expected):
            return candidate if candidate.is_active else None
    return None


def touch_trusted_device(device: TrustedDevice, ip_address: str | None) -> None:
    device.last_used_at = get_current_time()
    if ip_address:
        device.ip_address = ip_address[:64]


def revoke_device(device: TrustedDevice) -> None:
    if device.revoked_at is None:
        device.revoked_at = get_current_time()


def revoke_all_for_user(user_id: int, reason: str) -> int:
    """Revoke every active trusted device for a user. Returns count."""
    now = get_current_time()
    active = (
        TrustedDevice.query
        .filter_by(user_id=user_id, revoked_at=None)
        .filter(TrustedDevice.expires_at > now)
        .all()
    )
    for device in active:
        device.revoked_at = now
    if active:
        logger.info(
            "Revoked %d trusted devices for user %s (reason=%s)",
            len(active), user_id, reason,
        )
    return len(active)


def set_trusted_device_cookie(response, token: str) -> None:
    max_age = _ttl_days() * 86400
    response.set_cookie(
        TRUSTED_DEVICE_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=current_app.config.get("SESSION_COOKIE_SECURE", True),
        samesite=current_app.config.get("COOKIE_SAMESITE", "Lax"),
        path="/",
    )


def clear_trusted_device_cookie(response) -> None:
    response.set_cookie(
        TRUSTED_DEVICE_COOKIE,
        value="",
        max_age=0,
        httponly=True,
        secure=current_app.config.get("SESSION_COOKIE_SECURE", True),
        samesite=current_app.config.get("COOKIE_SAMESITE", "Lax"),
        path="/",
    )


def get_current_prefix_from_request() -> str | None:
    token = request.cookies.get(TRUSTED_DEVICE_COOKIE)
    if not token or len(token) < PREFIX_LEN + 1:
        return None
    return _prefix(token)


__all__ = [
    "TRUSTED_DEVICE_COOKIE",
    "clear_trusted_device_cookie",
    "get_current_prefix_from_request",
    "issue_trusted_device",
    "revoke_all_for_user",
    "revoke_device",
    "set_trusted_device_cookie",
    "touch_trusted_device",
    "validate_trusted_device_token",
]
