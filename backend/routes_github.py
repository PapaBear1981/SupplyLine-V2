"""GitHub integration settings routes."""

import logging

from flask import jsonify, request

from auth import jwt_required, permission_required
from models import SystemSetting, db

logger = logging.getLogger(__name__)

GITHUB_ENABLED_KEY = "github.enabled"
GITHUB_TOKEN_KEY   = "github.token"
GITHUB_OWNER_KEY   = "github.owner"
GITHUB_REPO_KEY    = "github.repo"


def _get_setting(key: str):
    return SystemSetting.query.filter_by(key=key).first()


def _set_setting(key: str, value: str, *, sensitive: bool = False, user_id=None):
    setting = SystemSetting.query.filter_by(key=key).first()
    if setting is None:
        setting = SystemSetting(key=key, category="github", is_sensitive=sensitive)
        db.session.add(setting)
    setting.value = value
    setting.updated_by_id = user_id


def register_github_routes(app):

    @app.route("/api/github/settings", methods=["GET"])
    @jwt_required
    @permission_required("admin")
    def get_github_settings():
        enabled_row = _get_setting(GITHUB_ENABLED_KEY)
        token_row   = _get_setting(GITHUB_TOKEN_KEY)
        owner_row   = _get_setting(GITHUB_OWNER_KEY)
        repo_row    = _get_setting(GITHUB_REPO_KEY)

        return jsonify({
            "enabled":   (enabled_row.value == "true") if enabled_row else False,
            "token_set": bool(token_row and token_row.value),
            "owner":     owner_row.value if owner_row else "",
            "repo":      repo_row.value if repo_row else "",
        })

    @app.route("/api/github/settings", methods=["PUT"])
    @jwt_required
    @permission_required("system.settings")
    def update_github_settings():
        data    = request.get_json() or {}
        user_id = getattr(request.current_user, "id", None) or (
            request.current_user.get("user_id") if isinstance(request.current_user, dict) else None
        )

        if "enabled" in data:
            _set_setting(GITHUB_ENABLED_KEY, "true" if data["enabled"] else "false", user_id=user_id)

        if "token" in data and data["token"] not in ("", None):
            _set_setting(GITHUB_TOKEN_KEY, data["token"], sensitive=True, user_id=user_id)

        if "owner" in data:
            owner = (data["owner"] or "").strip()
            if not owner:
                return jsonify({"error": "owner is required"}), 400
            _set_setting(GITHUB_OWNER_KEY, owner, user_id=user_id)

        if "repo" in data:
            repo = (data["repo"] or "").strip()
            if not repo:
                return jsonify({"error": "repo is required"}), 400
            _set_setting(GITHUB_REPO_KEY, repo, user_id=user_id)

        db.session.commit()

        enabled_row = _get_setting(GITHUB_ENABLED_KEY)
        token_row   = _get_setting(GITHUB_TOKEN_KEY)
        owner_row   = _get_setting(GITHUB_OWNER_KEY)
        repo_row    = _get_setting(GITHUB_REPO_KEY)

        return jsonify({
            "enabled":   (enabled_row.value == "true") if enabled_row else False,
            "token_set": bool(token_row and token_row.value),
            "owner":     owner_row.value if owner_row else "",
            "repo":      repo_row.value if repo_row else "",
        })
