"""Tests for routes_ai.py.

routes_ai.py is 4000+ lines with three public routes and a lot of
helper logic. These tests focus on:
  * The three public routes (/api/ai/settings GET/PUT, /api/ai/chat)
  * SSRF protection in `_validate_provider_base_url`
  * DNS-based private-network check in `_hostname_resolves_to_private_network`
  * Sliding-window rate limiter in `_is_ai_chat_rate_limited`
  * Chat dispatch wiring (mocking the provider loops)
  * A couple of happy-path tool executor tests so regressions in the
    DB-backed helpers get caught early

They do NOT make real HTTP calls to any AI provider — the provider
loops are monkeypatched.
"""

from __future__ import annotations

import socket
from datetime import timedelta

import pytest
import requests

import routes_ai
from models import (
    Checkout,
    SystemSetting,
    Tool,
    db,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clean_ai_rate_limiter_and_settings(app):
    """Reset the shared AI rate-limit bucket and AI settings between tests."""
    with app.app_context():
        routes_ai._ai_chat_request_times.clear()
        SystemSetting.query.filter_by(category="ai").delete()
        db.session.commit()
    yield
    with app.app_context():
        routes_ai._ai_chat_request_times.clear()
        SystemSetting.query.filter_by(category="ai").delete()
        db.session.commit()


def _enable_ai(
    app,
    *,
    provider: str = "claude",
    api_key: str = "test-api-key",
    model: str = "",
    base_url: str = "",
) -> None:
    """Seed the SystemSetting rows that make the chat endpoint active."""
    with app.app_context():
        rows = {
            routes_ai.AI_ENABLED_KEY: "true",
            routes_ai.AI_PROVIDER_KEY: provider,
            routes_ai.AI_API_KEY_KEY: api_key,
            routes_ai.AI_MODEL_KEY: model,
            routes_ai.AI_BASE_URL_KEY: base_url,
        }
        for key, value in rows.items():
            existing = SystemSetting.query.filter_by(key=key).first()
            if existing is None:
                db.session.add(SystemSetting(
                    key=key,
                    value=value,
                    category="ai",
                    is_sensitive=(key == routes_ai.AI_API_KEY_KEY),
                ))
            else:
                existing.value = value
        db.session.commit()


# ─────────────────────────────────────────────────────────────────────────────
# /api/ai/settings GET
# ─────────────────────────────────────────────────────────────────────────────


class TestAiSettingsGet:
    def test_unauthenticated_returns_401(self, client):
        response = client.get("/api/ai/settings")
        assert response.status_code == 401

    def test_defaults_when_no_settings(self, client, auth_headers_user):
        response = client.get("/api/ai/settings", headers=auth_headers_user)
        assert response.status_code == 200
        body = response.get_json()
        assert body["enabled"] is False
        assert body["provider"] == "claude"
        assert body["model"] == ""
        assert body["base_url"] == ""
        assert body["api_key_configured"] is False

    def test_reflects_seeded_settings(self, app, client, auth_headers_user):
        _enable_ai(app, provider="openai", api_key="sk-test", model="gpt-4o")
        response = client.get("/api/ai/settings", headers=auth_headers_user)
        assert response.status_code == 200
        body = response.get_json()
        assert body["enabled"] is True
        assert body["provider"] == "openai"
        assert body["model"] == "gpt-4o"
        assert body["api_key_configured"] is True

    def test_api_key_is_never_returned(self, app, client, auth_headers_user):
        _enable_ai(app, api_key="super-secret-key")
        response = client.get("/api/ai/settings", headers=auth_headers_user)
        body = response.get_json()
        assert "api_key" not in body
        assert "super-secret-key" not in response.get_data(as_text=True)


# ─────────────────────────────────────────────────────────────────────────────
# /api/ai/settings PUT
# ─────────────────────────────────────────────────────────────────────────────


class TestAiSettingsPut:
    def test_unauthenticated_returns_401(self, client):
        response = client.put("/api/ai/settings", json={"enabled": True})
        assert response.status_code == 401

    def test_non_admin_without_permission_returns_403(self, client, auth_headers_user):
        response = client.put(
            "/api/ai/settings",
            headers=auth_headers_user,
            json={"enabled": True},
        )
        assert response.status_code == 403

    def test_admin_can_enable(self, app, client, auth_headers_admin):
        response = client.put(
            "/api/ai/settings",
            headers=auth_headers_admin,
            json={"enabled": True, "provider": "claude", "api_key": "sk-test"},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["enabled"] is True
        assert body["provider"] == "claude"
        assert body["api_key_configured"] is True

    def test_admin_rejects_invalid_provider(self, client, auth_headers_admin):
        response = client.put(
            "/api/ai/settings",
            headers=auth_headers_admin,
            json={"provider": "bogus-provider"},
        )
        assert response.status_code == 400
        assert "Invalid provider" in response.get_json()["error"]

    def test_updates_persist_to_system_settings(self, app, client, auth_headers_admin):
        client.put(
            "/api/ai/settings",
            headers=auth_headers_admin,
            json={"enabled": True, "provider": "openai", "api_key": "sk-abc", "model": "gpt-4o"},
        )
        with app.app_context():
            enabled_row = SystemSetting.query.filter_by(key=routes_ai.AI_ENABLED_KEY).first()
            provider_row = SystemSetting.query.filter_by(key=routes_ai.AI_PROVIDER_KEY).first()
            key_row = SystemSetting.query.filter_by(key=routes_ai.AI_API_KEY_KEY).first()
            model_row = SystemSetting.query.filter_by(key=routes_ai.AI_MODEL_KEY).first()
            assert enabled_row.value == "true"
            assert provider_row.value == "openai"
            assert key_row.value == "sk-abc"
            assert key_row.is_sensitive is True
            assert model_row.value == "gpt-4o"

    def test_rejects_base_url_with_invalid_scheme(self, client, auth_headers_admin):
        response = client.put(
            "/api/ai/settings",
            headers=auth_headers_admin,
            json={"provider": "openai", "base_url": "ftp://example.com/"},
        )
        assert response.status_code == 400
        assert "http://" in response.get_json()["error"]

    def test_rejects_localhost_base_url_for_hosted_provider(self, client, auth_headers_admin):
        response = client.put(
            "/api/ai/settings",
            headers=auth_headers_admin,
            json={"provider": "openai", "base_url": "http://localhost:8080/"},
        )
        assert response.status_code == 400
        assert "Localhost" in response.get_json()["error"]

    def test_allows_localhost_base_url_for_ollama(self, client, auth_headers_admin):
        response = client.put(
            "/api/ai/settings",
            headers=auth_headers_admin,
            json={"provider": "ollama", "base_url": "http://localhost:11434"},
        )
        assert response.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# /api/ai/chat — validation and guardrails
# ─────────────────────────────────────────────────────────────────────────────


class TestAiChatGuards:
    def test_unauthenticated_returns_401(self, client):
        response = client.post("/api/ai/chat", json={"messages": []})
        assert response.status_code == 401

    def test_returns_503_when_disabled(self, client, auth_headers_user):
        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
        assert response.status_code == 503
        assert "not enabled" in response.get_json()["error"]

    def test_returns_503_when_api_key_missing_for_hosted_provider(
        self, app, client, auth_headers_user
    ):
        _enable_ai(app, provider="openai", api_key="")
        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hi"}]},
        )
        assert response.status_code == 503
        assert "not configured" in response.get_json()["error"]

    def test_rejects_empty_messages(self, app, client, auth_headers_user):
        _enable_ai(app)
        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": []},
        )
        assert response.status_code == 400
        assert "messages array is required" in response.get_json()["error"]

    def test_rejects_invalid_message_role(self, app, client, auth_headers_user):
        _enable_ai(app)
        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "system", "content": "hi"}]},
        )
        assert response.status_code == 400
        assert "role" in response.get_json()["error"]

    def test_rejects_non_string_content(self, app, client, auth_headers_user):
        _enable_ai(app)
        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": {"not": "a string"}}]},
        )
        assert response.status_code == 400
        assert "string" in response.get_json()["error"]

    def test_rate_limited_after_exceeding_window(
        self, app, client, auth_headers_user, regular_user, monkeypatch
    ):
        _enable_ai(app)
        # Fill the user's bucket so the next request is rejected.
        fake_now = 1_700_000_000.0
        monkeypatch.setattr(routes_ai.time, "time", lambda: fake_now)
        with app.app_context():
            bucket = routes_ai._ai_chat_request_times[regular_user.id]
            for _ in range(routes_ai.AI_CHAT_MAX_REQUESTS_PER_WINDOW):
                bucket.append(fake_now)

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 429
        assert "rate limit" in response.get_json()["error"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# /api/ai/chat — dispatch to provider loops (monkey-patched)
# ─────────────────────────────────────────────────────────────────────────────


class TestAiChatDispatch:
    def test_claude_provider_routes_to_claude_loop(
        self, app, client, auth_headers_user, monkeypatch
    ):
        _enable_ai(app, provider="claude", api_key="sk-test")
        calls = {}

        def fake_claude_loop(api_key, model, system_prompt, messages, **kwargs):
            calls["called"] = True
            calls["api_key"] = api_key
            calls["messages"] = messages
            return "claude-reply"

        def fake_openai_loop(*args, **kwargs):
            raise AssertionError("openai loop should not be called for claude provider")

        monkeypatch.setattr(routes_ai, "_run_claude_loop", fake_claude_loop)
        monkeypatch.setattr(routes_ai, "_run_openai_loop", fake_openai_loop)

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 200
        body = response.get_json()
        assert body["reply"] == "claude-reply"
        assert body["provider"] == "claude"
        assert calls["called"] is True
        assert calls["messages"] == [{"role": "user", "content": "hello"}]

    def test_openai_provider_routes_to_openai_loop(
        self, app, client, auth_headers_user, monkeypatch
    ):
        _enable_ai(app, provider="openai", api_key="sk-test")
        calls = {}

        def fake_openai_loop(api_key, model, base_url, system_prompt, messages, **kwargs):
            calls["called"] = True
            calls["base_url"] = base_url
            return "openai-reply"

        def fake_claude_loop(*args, **kwargs):
            raise AssertionError("claude loop should not be called for openai provider")

        monkeypatch.setattr(routes_ai, "_run_openai_loop", fake_openai_loop)
        monkeypatch.setattr(routes_ai, "_run_claude_loop", fake_claude_loop)
        # Avoid a real DNS lookup for api.openai.com during the base URL
        # validation that happens inside the route.
        monkeypatch.setattr(
            routes_ai, "_hostname_resolves_to_private_network", lambda _host: False
        )

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 200
        assert response.get_json()["reply"] == "openai-reply"
        assert calls["called"] is True

    def test_connection_error_returns_502(
        self, app, client, auth_headers_user, monkeypatch
    ):
        _enable_ai(app, provider="claude", api_key="sk-test")

        def boom(*args, **kwargs):
            raise requests.exceptions.ConnectionError("nope")

        monkeypatch.setattr(routes_ai, "_run_claude_loop", boom)

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 502
        assert "Could not connect" in response.get_json()["error"]

    def test_timeout_returns_504(self, app, client, auth_headers_user, monkeypatch):
        _enable_ai(app, provider="claude", api_key="sk-test")

        def boom(*args, **kwargs):
            raise requests.exceptions.Timeout("slow")

        monkeypatch.setattr(routes_ai, "_run_claude_loop", boom)

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 504

    def test_provider_401_is_translated(self, app, client, auth_headers_user, monkeypatch):
        _enable_ai(app, provider="claude", api_key="sk-test")

        class FakeResponse:
            status_code = 401
            headers = {"x-request-id": "req-123"}

        def boom(*args, **kwargs):
            err = requests.exceptions.HTTPError("unauthorised")
            err.response = FakeResponse()
            raise err

        monkeypatch.setattr(routes_ai, "_run_claude_loop", boom)

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 502
        assert "Invalid API key" in response.get_json()["error"]

    def test_provider_429_is_translated(self, app, client, auth_headers_user, monkeypatch):
        _enable_ai(app, provider="claude", api_key="sk-test")

        class FakeResponse:
            status_code = 429
            headers = {}

        def boom(*args, **kwargs):
            err = requests.exceptions.HTTPError("rate limited")
            err.response = FakeResponse()
            raise err

        monkeypatch.setattr(routes_ai, "_run_claude_loop", boom)

        response = client.post(
            "/api/ai/chat",
            headers=auth_headers_user,
            json={"messages": [{"role": "user", "content": "hello"}]},
        )
        assert response.status_code == 502
        assert "rate limit" in response.get_json()["error"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# _validate_provider_base_url (unit)
# ─────────────────────────────────────────────────────────────────────────────


class TestValidateProviderBaseUrl:
    def test_empty_url_rejected(self):
        ok, err = routes_ai._validate_provider_base_url("openai", "")
        assert ok is False
        assert "required" in err.lower()

    def test_invalid_scheme_rejected(self):
        ok, err = routes_ai._validate_provider_base_url("openai", "ftp://example.com/")
        assert ok is False
        assert "http://" in err

    def test_javascript_scheme_rejected(self):
        ok, _ = routes_ai._validate_provider_base_url(
            "openai", "javascript:alert(1)"
        )
        assert ok is False

    def test_missing_hostname_rejected(self):
        ok, _ = routes_ai._validate_provider_base_url("openai", "https://")
        assert ok is False

    def test_localhost_blocked_for_openai(self):
        ok, err = routes_ai._validate_provider_base_url("openai", "http://localhost:8080")
        assert ok is False
        assert "Localhost" in err

    def test_localhost_blocked_for_openrouter(self):
        ok, _ = routes_ai._validate_provider_base_url(
            "openrouter", "http://localhost:3000"
        )
        assert ok is False

    def test_local_tld_blocked_for_hosted_provider(self):
        ok, _ = routes_ai._validate_provider_base_url("openai", "http://foo.local")
        assert ok is False

    def test_localhost_allowed_for_ollama(self):
        ok, err = routes_ai._validate_provider_base_url(
            "ollama", "http://localhost:11434"
        )
        assert ok is True
        assert err is None

    def test_private_network_blocked_for_openai(self, monkeypatch):
        # Force _hostname_resolves_to_private_network to return True.
        monkeypatch.setattr(
            routes_ai, "_hostname_resolves_to_private_network", lambda _host: True
        )
        ok, err = routes_ai._validate_provider_base_url("openai", "https://evil.example")
        assert ok is False
        assert "Private" in err or "loopback" in err

    def test_public_url_accepted_for_openai(self, monkeypatch):
        monkeypatch.setattr(
            routes_ai, "_hostname_resolves_to_private_network", lambda _host: False
        )
        ok, err = routes_ai._validate_provider_base_url(
            "openai", "https://api.openai.com/v1"
        )
        assert ok is True
        assert err is None


# ─────────────────────────────────────────────────────────────────────────────
# _hostname_resolves_to_private_network (unit)
# ─────────────────────────────────────────────────────────────────────────────


class TestHostnamePrivateCheck:
    def test_unresolvable_hostname_returns_false(self, monkeypatch):
        def boom(*args, **kwargs):
            raise socket.gaierror("no such host")

        monkeypatch.setattr(socket, "getaddrinfo", boom)
        assert routes_ai._hostname_resolves_to_private_network("does-not-exist") is False

    def test_loopback_ip_returns_true(self, monkeypatch):
        def fake_getaddrinfo(*args, **kwargs):
            return [(socket.AF_INET, None, None, "", ("127.0.0.1", 0))]

        monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
        assert routes_ai._hostname_resolves_to_private_network("example") is True

    def test_private_rfc1918_returns_true(self, monkeypatch):
        def fake_getaddrinfo(*args, **kwargs):
            return [(socket.AF_INET, None, None, "", ("192.168.1.50", 0))]

        monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
        assert routes_ai._hostname_resolves_to_private_network("example") is True

    def test_link_local_returns_true(self, monkeypatch):
        def fake_getaddrinfo(*args, **kwargs):
            return [(socket.AF_INET, None, None, "", ("169.254.169.254", 0))]

        monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
        assert routes_ai._hostname_resolves_to_private_network("example") is True

    def test_public_ip_returns_false(self, monkeypatch):
        def fake_getaddrinfo(*args, **kwargs):
            return [(socket.AF_INET, None, None, "", ("1.1.1.1", 0))]

        monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
        assert routes_ai._hostname_resolves_to_private_network("example") is False


# ─────────────────────────────────────────────────────────────────────────────
# _is_ai_chat_rate_limited (unit)
# ─────────────────────────────────────────────────────────────────────────────


class TestAiChatRateLimiter:
    def test_missing_user_id_is_blocked(self):
        assert routes_ai._is_ai_chat_rate_limited(None) is True
        assert routes_ai._is_ai_chat_rate_limited(0) is True

    def test_under_limit_allowed(self, monkeypatch):
        monkeypatch.setattr(routes_ai.time, "time", lambda: 1000.0)
        for _ in range(routes_ai.AI_CHAT_MAX_REQUESTS_PER_WINDOW - 1):
            assert routes_ai._is_ai_chat_rate_limited(42) is False

    def test_at_limit_blocks_next(self, monkeypatch):
        monkeypatch.setattr(routes_ai.time, "time", lambda: 2000.0)
        for _ in range(routes_ai.AI_CHAT_MAX_REQUESTS_PER_WINDOW):
            assert routes_ai._is_ai_chat_rate_limited(43) is False
        # Next call exceeds the window and must be rejected.
        assert routes_ai._is_ai_chat_rate_limited(43) is True

    def test_window_expires_and_allows_new_requests(self, monkeypatch):
        # Fill the bucket at t=3000.
        monkeypatch.setattr(routes_ai.time, "time", lambda: 3000.0)
        for _ in range(routes_ai.AI_CHAT_MAX_REQUESTS_PER_WINDOW):
            routes_ai._is_ai_chat_rate_limited(44)
        assert routes_ai._is_ai_chat_rate_limited(44) is True

        # Advance past the window — old entries should be dropped.
        monkeypatch.setattr(
            routes_ai.time,
            "time",
            lambda: 3000.0 + routes_ai.AI_CHAT_WINDOW_SECONDS + 1,
        )
        assert routes_ai._is_ai_chat_rate_limited(44) is False


# ─────────────────────────────────────────────────────────────────────────────
# Tool executor happy paths
# ─────────────────────────────────────────────────────────────────────────────


class TestToolExecutors:
    def test_search_tools_by_description_returns_matching_tool(self, app, db_session):
        with app.app_context():
            tool = Tool(
                tool_number="T-TEST-001",
                serial_number="SN-TEST-001",
                description="Precision torque wrench",
                category="Hand Tools",
                location="Bay 3",
                status="available",
            )
            db_session.add(tool)
            db_session.commit()

            result = routes_ai._tool_search_tools(query="torque")

            assert "tools" in result
            tool_numbers = [t["tool_number"] for t in result["tools"]]
            assert "T-TEST-001" in tool_numbers

    def test_search_tools_returns_empty_message_when_nothing_matches(
        self, app, db_session
    ):
        with app.app_context():
            result = routes_ai._tool_search_tools(query="no-such-tool-zzzzz")
            assert "No tools found" in result.get("result", "")

    def test_get_active_checkouts_returns_rows_for_open_checkouts(
        self, app, db_session, regular_user
    ):
        from datetime import datetime

        with app.app_context():
            tool = Tool(
                tool_number="T-CO-001",
                serial_number="SN-CO-001",
                description="Checkout test tool",
                status="checked_out",
            )
            db_session.add(tool)
            db_session.flush()

            checkout = Checkout(
                tool_id=tool.id,
                user_id=regular_user.id,
                checkout_date=datetime.utcnow(),
                expected_return_date=datetime.utcnow() + timedelta(days=2),
            )
            db_session.add(checkout)
            db_session.commit()

            result = routes_ai._tool_get_active_checkouts()

            assert "checkouts" in result
            tool_numbers = [row["tool_number"] for row in result["checkouts"]]
            assert "T-CO-001" in tool_numbers


# ─────────────────────────────────────────────────────────────────────────────
# Configuration constants / sanity
# ─────────────────────────────────────────────────────────────────────────────


class TestConfigurationConstants:
    def test_valid_providers_are_known(self):
        assert {"claude", "openai", "openrouter", "ollama"} == routes_ai.VALID_PROVIDERS

    def test_default_models_cover_all_providers(self):
        for provider in routes_ai.VALID_PROVIDERS:
            assert provider in routes_ai.DEFAULT_MODELS
            assert routes_ai.DEFAULT_MODELS[provider]

    def test_default_base_urls_cover_non_claude_providers(self):
        # Anthropic's SDK uses a hardcoded endpoint so `claude` does not
        # appear in DEFAULT_BASE_URLS by design. The remote providers do
        # need base URL defaults.
        for provider in routes_ai.VALID_PROVIDERS - {"claude"}:
            assert provider in routes_ai.DEFAULT_BASE_URLS
            assert routes_ai.DEFAULT_BASE_URLS[provider]
