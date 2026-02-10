"""
Tests for AI Agent API Routes

Tests all /api/ai/* endpoints including:
- Agent management (list, toggle)
- Chat conversations
- Alert management (CRUD)
- Metrics retrieval
- Dashboard data
"""

import json
from datetime import datetime, timedelta

import pytest


# ─── Fixtures ─────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _init_agent_manager(app, db_session):
    """Initialize the AgentManager singleton for route tests."""
    from ai_agents.agent_manager import AgentManager

    AgentManager._instance = None
    manager = AgentManager.get_instance()

    with app.app_context():
        manager.init_app(app)

    yield

    AgentManager._instance = None


# ─── Helpers ──────────────────────────────────────────────────────


def _setup_ai_agents(db_session):
    """Get or create AI agent DB records for testing.

    Since the autouse fixture already creates DB records via init_app,
    this retrieves existing records or creates new ones.
    """
    from models_ai import AIAgent

    agents = []
    for name, atype in [
        ("system_monitor", "monitor"),
        ("user_assistant", "assistant"),
        ("diagnostic", "diagnostic"),
        ("analytics", "analytics"),
    ]:
        existing = AIAgent.query.filter_by(name=name).first()
        if existing:
            existing.status = "active"
            agents.append(existing)
        else:
            agent = AIAgent(name=name, agent_type=atype, status="active")
            db_session.add(agent)
            agents.append(agent)
    db_session.commit()
    return agents


def _setup_alerts(db_session, agent_id, count=3):
    """Create test alerts."""
    from models_ai import AIAlert

    alerts = []
    for i in range(count):
        severity = ["critical", "warning", "info"][i % 3]
        alert = AIAlert(
            agent_id=agent_id,
            severity=severity,
            category="performance",
            title=f"Test Alert {i}",
            description=f"Test description {i}",
            status="active",
        )
        db_session.add(alert)
        alerts.append(alert)
    db_session.commit()
    return alerts


def _setup_metrics(db_session, count=5):
    """Create test metrics."""
    from models_ai import AIMetric

    metrics = []
    for i in range(count):
        m = AIMetric(
            metric_name=f"test_metric_{i}",
            metric_value=float(i * 10),
            metric_unit="count",
            category="system",
        )
        db_session.add(m)
        metrics.append(m)
    db_session.commit()
    return metrics


# ─── Agent Management ─────────────────────────────────────────────


class TestAIAgentEndpoints:
    """Tests for /api/ai/agents endpoints."""

    def test_get_agents_unauthenticated(self, client):
        """Unauthenticated request should return 401."""
        response = client.get("/api/ai/agents")
        assert response.status_code == 401

    def test_get_agents(self, client, auth_headers, db_session):
        """Authenticated user can list all AI agents."""
        _setup_ai_agents(db_session)

        response = client.get("/api/ai/agents", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "agents" in data
        assert "total_agents" in data

    def test_toggle_agent_admin_only(self, client, user_auth_headers, db_session):
        """Non-admin users cannot toggle agents."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/agents/system_monitor/toggle",
            json={"action": "stop"},
            headers=user_auth_headers,
        )
        assert response.status_code == 403

    def test_toggle_agent_not_found(self, client, auth_headers, db_session):
        """Toggling nonexistent agent returns 404."""
        response = client.post(
            "/api/ai/agents/nonexistent_agent/toggle",
            json={"action": "stop"},
            headers=auth_headers,
        )
        assert response.status_code == 404


# ─── Chat ─────────────────────────────────────────────────────────


class TestAIChatEndpoints:
    """Tests for /api/ai/chat endpoints."""

    def test_chat_unauthenticated(self, client):
        """Unauthenticated chat request should return 401."""
        response = client.post("/api/ai/chat", json={"message": "hello"})
        assert response.status_code == 401

    def test_chat_empty_message(self, client, auth_headers, db_session):
        """Empty message should return 400."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            json={"message": ""},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_chat_no_body(self, client, auth_headers, db_session):
        """Missing request body should return 400."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            data="not json",
            content_type="text/plain",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_chat_success(self, client, auth_headers, db_session):
        """Sending a message should return an AI response."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            json={"message": "help", "agent_name": "user_assistant"},
            headers=auth_headers,
        )
        assert response.status_code == 200

        data = response.get_json()
        assert "conversation_id" in data
        assert "message" in data
        assert data["message"]["role"] == "assistant"
        assert len(data["message"]["content"]) > 0

    def test_chat_creates_conversation(self, client, auth_headers, db_session):
        """First message should create a new conversation."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            json={"message": "hello", "agent_name": "user_assistant"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        conv_id = response.get_json()["conversation_id"]
        assert conv_id is not None

        # Second message to same conversation
        response2 = client.post(
            "/api/ai/chat",
            json={"message": "help", "agent_name": "user_assistant", "conversation_id": conv_id},
            headers=auth_headers,
        )
        assert response2.status_code == 200
        assert response2.get_json()["conversation_id"] == conv_id

    def test_chat_with_monitor_agent(self, client, auth_headers, db_session):
        """Chat with the system_monitor agent."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            json={"message": "system status", "agent_name": "system_monitor"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "CPU" in data["message"]["content"] or "System" in data["message"]["content"]

    def test_chat_with_diagnostic_agent(self, client, auth_headers, db_session):
        """Chat with the diagnostic agent."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            json={"message": "diagnose", "agent_name": "diagnostic"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_chat_with_analytics_agent(self, client, auth_headers, db_session):
        """Chat with the analytics agent."""
        _setup_ai_agents(db_session)

        response = client.post(
            "/api/ai/chat",
            json={"message": "analytics report", "agent_name": "analytics"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert "Report" in response.get_json()["message"]["content"]

    def test_chat_nonexistent_agent(self, client, auth_headers, db_session):
        """Chat with non-existent agent should return 404."""
        response = client.post(
            "/api/ai/chat",
            json={"message": "hello", "agent_name": "nonexistent"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_get_conversations(self, client, auth_headers, db_session):
        """Get user's conversation list."""
        _setup_ai_agents(db_session)

        # Create a conversation via chat
        client.post(
            "/api/ai/chat",
            json={"message": "hello", "agent_name": "user_assistant"},
            headers=auth_headers,
        )

        response = client.get("/api/ai/conversations", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "conversations" in data
        assert len(data["conversations"]) >= 1

    def test_get_conversation_messages(self, client, auth_headers, db_session):
        """Get messages for a specific conversation."""
        _setup_ai_agents(db_session)

        # Create conversation
        chat_resp = client.post(
            "/api/ai/chat",
            json={"message": "hello", "agent_name": "user_assistant"},
            headers=auth_headers,
        )
        conv_id = chat_resp.get_json()["conversation_id"]

        response = client.get(f"/api/ai/conversations/{conv_id}/messages", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "messages" in data
        assert len(data["messages"]) == 2  # user + assistant

    def test_get_conversation_messages_not_found(self, client, auth_headers, db_session):
        """Non-existent conversation should return 404."""
        response = client.get("/api/ai/conversations/99999/messages", headers=auth_headers)
        assert response.status_code == 404

    def test_get_conversation_messages_wrong_user(self, client, auth_headers, user_auth_headers, db_session):
        """User cannot access another user's conversations."""
        _setup_ai_agents(db_session)

        # Admin creates a conversation
        chat_resp = client.post(
            "/api/ai/chat",
            json={"message": "hello", "agent_name": "user_assistant"},
            headers=auth_headers,
        )
        conv_id = chat_resp.get_json()["conversation_id"]

        # Regular user tries to access it
        response = client.get(f"/api/ai/conversations/{conv_id}/messages", headers=user_auth_headers)
        assert response.status_code == 404


# ─── Alerts ───────────────────────────────────────────────────────


class TestAIAlertEndpoints:
    """Tests for /api/ai/alerts endpoints."""

    def test_get_alerts(self, client, auth_headers, db_session):
        """Get active alerts."""
        agents = _setup_ai_agents(db_session)
        _setup_alerts(db_session, agents[0].id)

        response = client.get("/api/ai/alerts", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "alerts" in data
        assert "active_counts" in data
        assert data["total"] == 3

    def test_get_alerts_filtered(self, client, auth_headers, db_session):
        """Filter alerts by severity."""
        agents = _setup_ai_agents(db_session)
        _setup_alerts(db_session, agents[0].id, count=6)

        response = client.get(
            "/api/ai/alerts?severity=critical",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        for alert in data["alerts"]:
            assert alert["severity"] == "critical"

    def test_get_alerts_all_status(self, client, auth_headers, db_session):
        """Get alerts with all statuses."""
        agents = _setup_ai_agents(db_session)
        _setup_alerts(db_session, agents[0].id)

        response = client.get("/api/ai/alerts?status=all", headers=auth_headers)
        assert response.status_code == 200

    def test_acknowledge_alert(self, client, auth_headers, db_session):
        """Acknowledge an active alert."""
        agents = _setup_ai_agents(db_session)
        alerts = _setup_alerts(db_session, agents[0].id)

        response = client.post(
            f"/api/ai/alerts/{alerts[0].id}/acknowledge",
            headers=auth_headers,
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["alert"]["status"] == "acknowledged"

    def test_resolve_alert(self, client, auth_headers, db_session):
        """Resolve an active alert."""
        agents = _setup_ai_agents(db_session)
        alerts = _setup_alerts(db_session, agents[0].id)

        response = client.post(
            f"/api/ai/alerts/{alerts[0].id}/resolve",
            headers=auth_headers,
        )
        assert response.status_code == 200

        data = response.get_json()
        assert data["alert"]["status"] == "resolved"
        assert data["alert"]["resolved_at"] is not None

    def test_dismiss_alert(self, client, auth_headers, db_session):
        """Dismiss an alert."""
        agents = _setup_ai_agents(db_session)
        alerts = _setup_alerts(db_session, agents[0].id)

        response = client.post(
            f"/api/ai/alerts/{alerts[0].id}/dismiss",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.get_json()["message"] == "Alert dismissed"

    def test_alert_not_found(self, client, auth_headers, db_session):
        """Operating on non-existent alert returns 404."""
        response = client.post("/api/ai/alerts/99999/acknowledge", headers=auth_headers)
        assert response.status_code == 404

        response = client.post("/api/ai/alerts/99999/resolve", headers=auth_headers)
        assert response.status_code == 404

        response = client.post("/api/ai/alerts/99999/dismiss", headers=auth_headers)
        assert response.status_code == 404


# ─── Metrics ──────────────────────────────────────────────────────


class TestAIMetricEndpoints:
    """Tests for /api/ai/metrics endpoints."""

    def test_get_metrics(self, client, auth_headers, db_session):
        """Get metrics."""
        _setup_metrics(db_session)

        response = client.get("/api/ai/metrics", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "metrics" in data
        assert data["total"] == 5

    def test_get_metrics_filtered(self, client, auth_headers, db_session):
        """Filter metrics by category."""
        _setup_metrics(db_session)

        response = client.get(
            "/api/ai/metrics?category=system",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_get_metrics_summary(self, client, auth_headers, db_session):
        """Get latest metric values."""
        _setup_metrics(db_session)

        response = client.get("/api/ai/metrics/summary", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "summary" in data


# ─── Action Logs ──────────────────────────────────────────────────


class TestAIActionEndpoints:
    """Tests for /api/ai/actions endpoints."""

    def test_get_actions(self, client, auth_headers, db_session):
        """Get action logs."""
        from models_ai import AIAgent, AIActionLog

        agents = _setup_ai_agents(db_session)
        action = AIActionLog(
            agent_id=agents[0].id,
            action_type="auto_remediation",
            description="Cleared connection pool",
            result="success",
        )
        db_session.add(action)
        db_session.commit()

        response = client.get("/api/ai/actions", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "actions" in data
        assert data["total"] >= 1

    def test_get_actions_filtered(self, client, auth_headers, db_session):
        """Filter actions by type."""
        from models_ai import AIAgent, AIActionLog

        agents = _setup_ai_agents(db_session)
        for action_type in ["auto_remediation", "notification", "notification"]:
            a = AIActionLog(
                agent_id=agents[0].id,
                action_type=action_type,
                description=f"Test {action_type}",
                result="success",
            )
            db_session.add(a)
        db_session.commit()

        response = client.get(
            "/api/ai/actions?action_type=notification",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        for action in data["actions"]:
            assert action["action_type"] == "notification"


# ─── Dashboard ────────────────────────────────────────────────────


class TestAIDashboardEndpoint:
    """Tests for /api/ai/dashboard endpoint."""

    def test_dashboard_unauthenticated(self, client):
        """Unauthenticated request should return 401."""
        response = client.get("/api/ai/dashboard")
        assert response.status_code == 401

    def test_dashboard(self, client, auth_headers, db_session):
        """Get comprehensive dashboard data."""
        agents = _setup_ai_agents(db_session)
        _setup_alerts(db_session, agents[0].id)
        _setup_metrics(db_session)

        response = client.get("/api/ai/dashboard", headers=auth_headers)
        assert response.status_code == 200

        data = response.get_json()
        assert "agents" in data
        assert "alert_counts" in data
        assert "recent_alerts" in data
        assert "recent_actions" in data
        assert "system_metrics" in data
        assert "conversation_count" in data

        # Validate system metrics structure
        sm = data["system_metrics"]
        assert "cpu_percent" in sm
        assert "memory_percent" in sm
        assert "disk_percent" in sm

        # Validate alert counts structure
        ac = data["alert_counts"]
        assert "active_critical" in ac
        assert "active_warning" in ac
        assert "active_info" in ac
        assert "resolved_today" in ac
