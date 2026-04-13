"""Utilities for managing system-level security settings."""


from flask import current_app

from models import SystemSetting, db


SESSION_TIMEOUT_KEY = "session_inactivity_timeout_minutes"
DEFAULT_SESSION_TIMEOUT_MINUTES = 30
MIN_SESSION_TIMEOUT_MINUTES = 5
MAX_SESSION_TIMEOUT_MINUTES = 240

# Mobile admin access toggle — allows admins to expose a trimmed-down
# mobile admin surface to mobile users. Disabled by default because
# most admin operations are dangerous to execute on a small screen.
MOBILE_ADMIN_ENABLED_KEY = "mobile_admin_enabled"
DEFAULT_MOBILE_ADMIN_ENABLED = False


def _coerce_timeout_value(raw_value: int | str | None, default: int) -> int:
    """Convert the stored timeout value to a safe integer within bounds."""
    try:
        minutes = int(raw_value)
    except (TypeError, ValueError):
        return default

    if minutes < MIN_SESSION_TIMEOUT_MINUTES or minutes > MAX_SESSION_TIMEOUT_MINUTES:
        return default

    return minutes


def get_session_timeout_value(default: int | None = None) -> int:
    """Return the configured inactivity timeout, falling back to defaults."""
    if default is None:
        default = int(
            current_app.config.get(
                "SESSION_INACTIVITY_TIMEOUT_MINUTES_DEFAULT",
                current_app.config.get(
                    "SESSION_INACTIVITY_TIMEOUT_MINUTES",
                    DEFAULT_SESSION_TIMEOUT_MINUTES,
                ),
            )
        )

    setting = SystemSetting.query.filter_by(key=SESSION_TIMEOUT_KEY).first()
    if not setting:
        return _coerce_timeout_value(default, DEFAULT_SESSION_TIMEOUT_MINUTES)

    return _coerce_timeout_value(setting.value, default)


def set_session_timeout_value(minutes: int, user_id: int | None = None, commit: bool = True) -> SystemSetting:
    """Persist the inactivity timeout and optionally commit the change."""
    if minutes < MIN_SESSION_TIMEOUT_MINUTES or minutes > MAX_SESSION_TIMEOUT_MINUTES:
        raise ValueError(
            f"Timeout must be between {MIN_SESSION_TIMEOUT_MINUTES} and {MAX_SESSION_TIMEOUT_MINUTES} minutes",
        )

    setting = SystemSetting.query.filter_by(key=SESSION_TIMEOUT_KEY).first()
    if not setting:
        setting = SystemSetting(
            key=SESSION_TIMEOUT_KEY,
            value=str(minutes),
            category="security",
            description="Session inactivity timeout in minutes",
            is_sensitive=False,
        )
        db.session.add(setting)
    else:
        setting.value = str(minutes)

    setting.updated_by_id = user_id

    if commit:
        db.session.commit()

    return setting


def _coerce_bool_value(raw_value, default: bool) -> bool:
    """Convert a stored SystemSetting string value to a bool with a default fallback."""
    if raw_value is None:
        return default
    if isinstance(raw_value, bool):
        return raw_value
    if isinstance(raw_value, (int, float)):
        return bool(raw_value)
    if isinstance(raw_value, str):
        normalized = raw_value.strip().lower()
        if normalized in ("1", "true", "yes", "on"):
            return True
        if normalized in ("0", "false", "no", "off", ""):
            return False
    return default


def get_mobile_admin_enabled(default: bool = DEFAULT_MOBILE_ADMIN_ENABLED) -> bool:
    """Return whether mobile admin access is enabled system-wide."""
    setting = SystemSetting.query.filter_by(key=MOBILE_ADMIN_ENABLED_KEY).first()
    if not setting:
        return default
    return _coerce_bool_value(setting.value, default)


def set_mobile_admin_enabled(
    enabled: bool, user_id: int | None = None, commit: bool = True
) -> SystemSetting:
    """Persist the mobile_admin_enabled flag and optionally commit."""
    setting = SystemSetting.query.filter_by(key=MOBILE_ADMIN_ENABLED_KEY).first()
    value = "true" if enabled else "false"

    if not setting:
        setting = SystemSetting(
            key=MOBILE_ADMIN_ENABLED_KEY,
            value=value,
            category="mobile",
            description="When true, admin users may access admin pages from the mobile app",
            is_sensitive=False,
        )
        db.session.add(setting)
    else:
        setting.value = value

    setting.updated_by_id = user_id

    if commit:
        db.session.commit()

    return setting


def load_security_settings(app) -> int:
    """Load persisted security settings into the Flask app config."""
    with app.app_context():
        baseline_default = int(
            app.config.get(
                "SESSION_INACTIVITY_TIMEOUT_MINUTES",
                DEFAULT_SESSION_TIMEOUT_MINUTES,
            )
        )
        app.config.setdefault(
            "SESSION_INACTIVITY_TIMEOUT_MINUTES_DEFAULT",
            baseline_default,
        )

        minutes = get_session_timeout_value(default=baseline_default)
        app.config["SESSION_INACTIVITY_TIMEOUT_MINUTES"] = minutes
        return minutes
