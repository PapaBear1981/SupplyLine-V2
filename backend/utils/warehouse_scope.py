"""
Warehouse-scope enforcement helpers.

Used by checkout / check-in / chemical issue / chemical return handlers
(and equivalent AI-tool handlers) to make sure the user is acting on an
item that belongs to the warehouse they're currently working in.

Admins bypass the check (matching the existing `@permission_required`
behavior). If no active warehouse is set, writes are blocked.
"""
from flask import request

from .error_handler import ValidationError


MSG_NO_ACTIVE_WAREHOUSE = (
    "No active warehouse selected. Pick one from the warehouse switcher in the header."
)


def _current_user_payload():
    """Pull the JWT payload attached by the auth middleware. May be None."""
    return getattr(request, "current_user", None)


def get_active_warehouse_id():
    """Return the currently active warehouse id from the JWT payload, or None.

    Falls back to a live DB lookup when the JWT was issued before the
    active_warehouse_id claim was added (tokens that pre-date the migration).
    This lets existing sessions continue to work without a forced re-login.
    """
    payload = _current_user_payload() or {}
    value = payload.get("active_warehouse_id")
    if value not in (None, ""):
        try:
            return int(value)
        except (TypeError, ValueError):
            pass

    # Token predates the claim — fall back to the database so the user
    # doesn't have to log out and back in after a migration.
    user_id = payload.get("user_id")
    if user_id:
        try:
            from models import User  # local import to avoid circular dependency
            user = User.query.get(int(user_id))
            if user and user.active_warehouse_id:
                return int(user.active_warehouse_id)
        except Exception:
            pass

    return None


def current_warehouse_scope(allow_superadmin_override=True):
    """
    Return the (is_admin, active_warehouse_id) pair for the current request.

    Use this in read-only list endpoints to filter results to the user's
    active warehouse. Admins bypass (is_admin=True) when
    ``allow_superadmin_override`` is True, and callers should treat that as
    "no warehouse filter needed".
    """
    payload = _current_user_payload() or {}
    is_admin = bool(payload.get("is_admin")) if allow_superadmin_override else False
    return is_admin, get_active_warehouse_id()


def assert_active_warehouse_matches(item, *, allow_superadmin_override=True):
    """
    Ensure the given item (Tool / Chemical / any model with `warehouse_id`)
    lives in the user's active warehouse.

    Admins bypass the check when ``allow_superadmin_override`` is True.

    Raises ``ValidationError`` on mismatch.
    """
    payload = _current_user_payload() or {}

    if allow_superadmin_override and payload.get("is_admin"):
        return

    active = get_active_warehouse_id()
    if active is None:
        raise ValidationError(MSG_NO_ACTIVE_WAREHOUSE)

    item_warehouse_id = getattr(item, "warehouse_id", None)
    if item_warehouse_id is None:
        # Unassigned items aren't part of any warehouse inventory; block writes
        # so the admin has to assign a warehouse first.
        raise ValidationError(
            "This item has no warehouse assignment. An admin must assign it before it can be used."
        )

    if item_warehouse_id != active:
        raise ValidationError(
            "This item is in a different warehouse. "
            "Switch warehouses or request a transfer."
        )
