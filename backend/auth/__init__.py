"""
Authentication module for SupplyLine MRO Suite

This module provides JWT-based authentication functionality.
"""

from .jwt_manager import (
    JWTManager,
    admin_required,
    csrf_required,
    department_required,
    is_jti_revoked,
    jwt_required,
    permission_required,
    permission_required_any,
    revoke_refresh_jti,
)
from .trusted_devices import (
    TRUSTED_DEVICE_COOKIE,
    clear_trusted_device_cookie,
    get_current_prefix_from_request,
    issue_trusted_device,
    revoke_all_for_user,
    revoke_device,
    set_trusted_device_cookie,
    touch_trusted_device,
    validate_trusted_device_token,
)


__all__ = [
    "TRUSTED_DEVICE_COOKIE",
    "JWTManager",
    "admin_required",
    "clear_trusted_device_cookie",
    "csrf_required",
    "department_required",
    "get_current_prefix_from_request",
    "is_jti_revoked",
    "issue_trusted_device",
    "jwt_required",
    "permission_required",
    "permission_required_any",
    "revoke_all_for_user",
    "revoke_device",
    "revoke_refresh_jti",
    "set_trusted_device_cookie",
    "touch_trusted_device",
    "validate_trusted_device_token",
]
