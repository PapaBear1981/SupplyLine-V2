"""Feature flag helpers for deactivating UI surfaces without deleting code.

Flags live in ``backend/config.py`` and are loaded onto the Flask ``app.config``
at startup. The :func:`require_feature` decorator short-circuits routes with
``410 Gone`` when the corresponding flag is off.
"""

from __future__ import annotations

from functools import wraps

from flask import current_app, jsonify, request


_FEATURE_CONFIG_KEYS = {
    "kit_management": "FEATURE_KIT_MANAGEMENT",
    "requests": "FEATURE_REQUESTS",
    "chemical_reorder": "FEATURE_CHEMICAL_REORDER",
}


def feature_enabled(feature: str) -> bool:
    """Return True if the named feature flag is on for the current app."""
    config_key = _FEATURE_CONFIG_KEYS.get(feature)
    if config_key is None:
        raise ValueError(f"Unknown feature flag: {feature!r}")
    return bool(current_app.config.get(config_key, False))


def require_feature(feature: str):
    """Decorator that returns ``410 Gone`` when ``feature`` is disabled.

    Lets ``OPTIONS`` preflight requests through so CORS isn't broken while a
    feature is turned off.
    """

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return ("", 204)
            if not feature_enabled(feature):
                return (
                    jsonify(
                        {
                            "error": "feature_disabled",
                            "feature": feature,
                            "message": (
                                f"The '{feature}' feature is currently deactivated."
                            ),
                        }
                    ),
                    410,
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator
