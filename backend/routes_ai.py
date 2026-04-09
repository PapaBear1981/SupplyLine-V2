"""AI assistant routes — settings management and provider-agnostic chat proxy."""

import logging

import requests
from flask import jsonify, request

from auth import jwt_required, permission_required
from models import AuditLog, Chemical, Checkout, SystemSetting, Tool, ToolCalibration, User, db

logger = logging.getLogger(__name__)

# ─── Setting keys ────────────────────────────────────────────────────────────
AI_ENABLED_KEY   = "ai.enabled"
AI_PROVIDER_KEY  = "ai.provider"
AI_API_KEY_KEY   = "ai.api_key"
AI_MODEL_KEY     = "ai.model"
AI_BASE_URL_KEY  = "ai.base_url"

VALID_PROVIDERS = {"claude", "openai", "openrouter", "ollama"}

DEFAULT_MODELS = {
    "claude":      "claude-sonnet-4-6",
    "openai":      "gpt-4o",
    "openrouter":  "openai/gpt-4o",
    "ollama":      "gemma3:4b",
}

DEFAULT_BASE_URLS = {
    "openrouter": "https://openrouter.ai",
    "ollama":     "http://localhost:11434",
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_setting(key: str) -> SystemSetting | None:
    return SystemSetting.query.filter_by(key=key).first()


def _set_setting(key: str, value: str, *, sensitive: bool = False, user_id: int | None = None) -> SystemSetting:
    setting = SystemSetting.query.filter_by(key=key).first()
    if setting is None:
        setting = SystemSetting(key=key, category="ai", is_sensitive=sensitive)
        db.session.add(setting)
    setting.value = value
    setting.updated_by_id = user_id
    return setting


def _load_ai_config() -> dict:
    """Return all AI settings as a dict (never exposes raw api_key)."""
    rows = SystemSetting.query.filter_by(category="ai").all()
    data = {r.key: r.value for r in rows}
    return {
        "enabled":       data.get(AI_ENABLED_KEY, "false") == "true",
        "provider":      data.get(AI_PROVIDER_KEY, "claude"),
        "model":         data.get(AI_MODEL_KEY, ""),
        "base_url":      data.get(AI_BASE_URL_KEY, ""),
        "api_key_configured": bool(data.get(AI_API_KEY_KEY, "").strip()),
    }


def _build_system_prompt(current_user: dict) -> str:
    """Build a rich system prompt with live DB context."""
    try:
        total_tools      = Tool.query.count()
        available_tools  = Tool.query.filter_by(status="available").count()
        checked_out      = Tool.query.filter_by(status="checked_out").count()
        maintenance      = Tool.query.filter_by(status="maintenance").count()

        active_checkouts = Checkout.query.filter(Checkout.return_date.is_(None)).count()

        from datetime import date, timedelta
        today = date.today()
        overdue_cal = (
            ToolCalibration.query
            .filter(ToolCalibration.next_calibration_date < today)
            .count()
        )
        due_soon_cal = (
            ToolCalibration.query
            .filter(
                ToolCalibration.next_calibration_date >= today,
                ToolCalibration.next_calibration_date <= today + timedelta(days=30),
            )
            .count()
        )

        total_chemicals  = Chemical.query.count()
        expiring_soon    = (
            Chemical.query
            .filter(
                Chemical.expiration_date.isnot(None),
                Chemical.expiration_date <= today + timedelta(days=30),
            )
            .count()
        )

        user_obj = db.session.get(User, current_user.get("user_id"))
        user_name  = user_obj.name if user_obj else "Unknown"
        user_role  = "Administrator" if (user_obj and user_obj.is_admin) else "Standard User"

    except Exception:
        logger.exception("Failed to gather AI context stats")
        total_tools = available_tools = checked_out = maintenance = 0
        active_checkouts = overdue_cal = due_soon_cal = 0
        total_chemicals = expiring_soon = 0
        user_name = current_user.get("name", "Unknown")
        user_role = "Unknown"

    return f"""You are the SupplyLine AI Assistant, a knowledgeable helper embedded in the SupplyLine MRO Suite — an inventory management system for aviation/aerospace Maintenance, Repair, and Operations (MRO) organizations.

You help users understand inventory status, find information about tools, chemicals, kits, and procurement orders, and navigate the system efficiently.

## Current User
- Name: {user_name}
- Role: {user_role}

## Live Inventory Snapshot (as of this conversation)
### Tools
- Total tools: {total_tools}
- Available: {available_tools}
- Checked out: {checked_out}
- In maintenance: {maintenance}
- Active checkouts: {active_checkouts}

### Calibration Status
- Overdue calibrations: {overdue_cal}
- Due within 30 days: {due_soon_cal}

### Chemicals
- Total chemicals: {total_chemicals}
- Expiring within 30 days: {expiring_soon}

## System Capabilities
SupplyLine manages:
- **Tools**: Tool inventory, serial numbers, checkout/return, calibration tracking, service records
- **Chemicals**: Chemical inventory, lot numbers, expiration dates, issuance and waste tracking
- **Kits**: Mobile warehouse kits deployed to aircraft or field locations, with geolocation
- **Expendables**: Consumable items tracked by quantity
- **Procurement**: Purchase orders and user fulfillment requests (RFQ workflow)
- **Warehouses**: Multiple warehouse locations with transfer tracking
- **Users**: Role-based access control, departments, 2FA
- **Reports**: PDF/Excel exports for all major data sets
- **Messaging**: Real-time channel-based communication

## Guidelines
- Be concise and accurate. If you don't know a specific number or record, say so rather than guessing.
- For specific lookups beyond the snapshot above (e.g. a specific tool's status), tell the user to check the relevant page in the system.
- Suggest the appropriate menu section when directing users to a feature.
- You can discuss calibration compliance, inventory levels, trends, and best practices for MRO operations.
- Do not make up inventory records, serial numbers, or part numbers."""


def _call_claude(api_key: str, model: str, system_prompt: str, messages: list) -> str:
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": messages,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


def _call_openai_compat(api_key: str, model: str, base_url: str, system_prompt: str, messages: list) -> str:
    """Handles OpenAI, OpenRouter, and Ollama (all OpenAI-compatible)."""
    headers = {"content-type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload_messages = [{"role": "system", "content": system_prompt}] + messages

    resp = requests.post(
        f"{base_url.rstrip('/')}/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": payload_messages,
            "max_tokens": 1024,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


# ─── Route registration ───────────────────────────────────────────────────────

def register_ai_routes(app):

    @app.route("/api/ai/settings", methods=["GET"])
    @jwt_required
    def get_ai_settings():
        return jsonify(_load_ai_config())

    @app.route("/api/ai/settings", methods=["PUT"])
    @permission_required("system.settings")
    def update_ai_settings():
        payload = request.get_json() or {}
        user_id = request.current_user.get("user_id")

        provider = payload.get("provider", "").strip()
        if provider and provider not in VALID_PROVIDERS:
            return jsonify({"error": f"Invalid provider. Must be one of: {', '.join(VALID_PROVIDERS)}"}), 400

        if "enabled" in payload:
            _set_setting(AI_ENABLED_KEY, "true" if payload["enabled"] else "false", user_id=user_id)

        if provider:
            _set_setting(AI_PROVIDER_KEY, provider, user_id=user_id)

        # Only update api_key if a non-empty value is sent (empty string clears it)
        if "api_key" in payload:
            _set_setting(AI_API_KEY_KEY, payload["api_key"], sensitive=True, user_id=user_id)

        if "model" in payload:
            _set_setting(AI_MODEL_KEY, payload["model"], user_id=user_id)

        if "base_url" in payload:
            _set_setting(AI_BASE_URL_KEY, payload["base_url"], user_id=user_id)

        db.session.add(AuditLog(
            action_type="update_ai_settings",
            action_details=f"User {user_id} updated AI assistant settings (provider={provider or 'unchanged'})",
        ))
        db.session.commit()

        return jsonify(_load_ai_config())

    @app.route("/api/ai/chat", methods=["POST"])
    @jwt_required
    def ai_chat():
        config = _load_ai_config()

        if not config["enabled"]:
            return jsonify({"error": "AI assistant is not enabled. Ask an administrator to enable it."}), 503

        if not config["api_key_configured"] and config["provider"] != "ollama":
            return jsonify({"error": "AI assistant is not configured. Ask an administrator to set an API key."}), 503

        payload = request.get_json() or {}
        messages = payload.get("messages", [])
        if not messages:
            return jsonify({"error": "messages array is required"}), 400

        # Validate message format
        for msg in messages:
            if msg.get("role") not in ("user", "assistant"):
                return jsonify({"error": "Each message must have role 'user' or 'assistant'"}), 400
            if not isinstance(msg.get("content"), str):
                return jsonify({"error": "Each message must have a string content field"}), 400

        provider  = config["provider"]
        api_key_row = _get_setting(AI_API_KEY_KEY)
        api_key   = api_key_row.value if api_key_row else ""
        model_row = _get_setting(AI_MODEL_KEY)
        model     = (model_row.value if model_row and model_row.value else None) or DEFAULT_MODELS.get(provider, "")
        base_url_row = _get_setting(AI_BASE_URL_KEY)
        base_url  = (base_url_row.value if base_url_row and base_url_row.value else None) or DEFAULT_BASE_URLS.get(provider, "")

        system_prompt = _build_system_prompt(request.current_user)

        try:
            if provider == "claude":
                reply = _call_claude(api_key, model, system_prompt, messages)
            elif provider in ("openai", "openrouter", "ollama"):
                reply = _call_openai_compat(api_key, model, base_url, system_prompt, messages)
            else:
                return jsonify({"error": f"Unsupported provider: {provider}"}), 400

        except requests.exceptions.ConnectionError:
            logger.exception("AI provider connection error")
            return jsonify({"error": "Could not connect to the AI provider. Check the base URL and network connectivity."}), 502
        except requests.exceptions.Timeout:
            return jsonify({"error": "AI provider request timed out. Try again."}), 504
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else 500
            try:
                detail = exc.response.json()
            except Exception:
                detail = exc.response.text if exc.response is not None else str(exc)
            logger.error("AI provider HTTP error %s: %s", status, detail)
            if status == 401:
                return jsonify({"error": "Invalid API key. Check the AI settings."}), 502
            if status == 429:
                return jsonify({"error": "AI provider rate limit reached. Try again in a moment."}), 502
            return jsonify({"error": f"AI provider returned an error ({status}). Check settings and try again."}), 502
        except Exception:
            logger.exception("Unexpected AI chat error")
            return jsonify({"error": "An unexpected error occurred. Please try again."}), 500

        return jsonify({"reply": reply, "provider": provider, "model": model})
