"""
Test-mode flag gating.

Centralizes the logic for honoring DISABLE_* env vars that exist solely to
make the Playwright E2E suite runnable. Each flag is only effective when
FLASK_ENV is explicitly `testing` or `development`. In production, the flag
is ignored and app startup aborts so a misconfigured Render env var cannot
silently disable rate limiting, mandatory 2FA, or other controls.
"""

import os


# Env vars that, if truthy in production, indicate a misconfigured deployment.
# Keep this list in sync with every place we honor a DISABLE_* flag.
_PRODUCTION_FORBIDDEN_FLAGS = (
    "DISABLE_MANDATORY_2FA",
    "DISABLE_RATE_LIMIT",
    "DISABLE_CSRF",
)

_TEST_ENVS = {"testing", "development", "dev"}
_TRUTHY = {"true", "1", "yes", "on"}


def _flask_env() -> str:
    return os.environ.get("FLASK_ENV", "").strip().lower()


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in _TRUTHY


def test_mode_allowed(flag_name: str) -> bool:
    """
    True only if FLASK_ENV is a non-production value AND the named env var
    is set to a truthy value. Any other combination returns False, which
    means the production-path code runs and the flag is ignored.
    """
    if _flask_env() not in _TEST_ENVS:
        return False
    return _is_truthy(os.environ.get(flag_name))


def validate_no_test_flags_in_production() -> None:
    """
    Fail fast at app startup if any DISABLE_* flag is truthy while FLASK_ENV
    is production (or unset, which Render treats as production).

    Raises RuntimeError with the offending flag name so the operator can
    find it in the Render dashboard and remove it.
    """
    env = _flask_env()
    if env in _TEST_ENVS:
        return
    offenders = [f for f in _PRODUCTION_FORBIDDEN_FLAGS if _is_truthy(os.environ.get(f))]
    if offenders:
        raise RuntimeError(
            "Refusing to start: test-mode env var(s) set in production: "
            f"{', '.join(offenders)}. These are E2E-only escape hatches and "
            "must be unset on the Render dashboard."
        )
