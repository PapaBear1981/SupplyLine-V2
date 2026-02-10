"""
Tests for AI Agent Database Models

Tests model creation, relationships, serialization, and constraints.
"""

import json

import pytest


class TestAIAgentModel:
    """Tests for the AIAgent model."""

    def test_create_agent(self, db_session):
        from models_ai import AIAgent

        agent = AIAgent(
            name="test_agent",
            agent_type="monitor",
            description="A test monitoring agent",
            status="active",
        )
        db_session.add(agent)
        db_session.commit()

        assert agent.id is not None
        assert agent.name == "test_agent"
        assert agent.agent_type == "monitor"
        assert agent.status == "active"
        assert agent.created_at is not None
        assert agent.updated_at is not None

    def test_agent_to_dict(self, db_session):
        from models_ai import AIAgent

        agent = AIAgent(
            name="dict_agent",
            agent_type="assistant",
            description="Test dict serialization",
        )
        db_session.add(agent)
        db_session.commit()

        data = agent.to_dict()
        assert data["name"] == "dict_agent"
        assert data["agent_type"] == "assistant"
        assert data["status"] == "active"  # default
        assert "created_at" in data
        assert "updated_at" in data

    def test_agent_unique_name(self, db_session):
        from models_ai import AIAgent
        from sqlalchemy.exc import IntegrityError

        a1 = AIAgent(name="unique_agent", agent_type="monitor")
        db_session.add(a1)
        db_session.commit()

        a2 = AIAgent(name="unique_agent", agent_type="assistant")
        db_session.add(a2)
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    def test_agent_default_status(self, db_session):
        from models_ai import AIAgent

        agent = AIAgent(name="default_status_agent", agent_type="diagnostic")
        db_session.add(agent)
        db_session.commit()

        assert agent.status == "active"

    def test_agent_relationships(self, db_session):
        from models_ai import AIAgent, AIConversation, AIAlert, AIActionLog
        from models import User

        # Create a user for conversation
        user = User(
            name="AI Test User",
            employee_number="AITEST001",
            department="IT",
            is_admin=False,
            is_active=True,
        )
        user.set_password("test123")
        db_session.add(user)
        db_session.commit()

        agent = AIAgent(name="rel_agent", agent_type="monitor")
        db_session.add(agent)
        db_session.commit()

        # Create related objects
        conv = AIConversation(agent_id=agent.id, user_id=user.id, title="Test convo")
        alert = AIAlert(
            agent_id=agent.id,
            severity="info",
            category="performance",
            title="Test alert",
            description="Test description",
        )
        action = AIActionLog(
            agent_id=agent.id,
            action_type="notification",
            description="Test action",
            result="success",
        )
        db_session.add_all([conv, alert, action])
        db_session.commit()

        assert len(agent.conversations) == 1
        assert len(agent.alerts) == 1
        assert len(agent.action_logs) == 1


class TestAIConversationModel:
    """Tests for the AIConversation model."""

    def test_create_conversation(self, db_session):
        from models_ai import AIAgent, AIConversation
        from models import User

        user = User(
            name="Conv User",
            employee_number="CONV001",
            department="IT",
            is_admin=False,
            is_active=True,
        )
        user.set_password("test123")
        db_session.add(user)

        agent = AIAgent(name="conv_agent", agent_type="assistant")
        db_session.add(agent)
        db_session.commit()

        conv = AIConversation(
            agent_id=agent.id,
            user_id=user.id,
            title="Test Conversation",
        )
        db_session.add(conv)
        db_session.commit()

        assert conv.id is not None
        assert conv.status == "active"
        assert conv.agent.name == "conv_agent"

    def test_conversation_to_dict(self, db_session):
        from models_ai import AIAgent, AIConversation
        from models import User

        user = User(
            name="Dict Conv User",
            employee_number="DCONV001",
            department="IT",
            is_admin=False,
            is_active=True,
        )
        user.set_password("test123")
        db_session.add(user)

        agent = AIAgent(name="dict_conv_agent", agent_type="assistant")
        db_session.add(agent)
        db_session.commit()

        conv = AIConversation(agent_id=agent.id, user_id=user.id, title="Serialization test")
        db_session.add(conv)
        db_session.commit()

        data = conv.to_dict()
        assert data["title"] == "Serialization test"
        assert data["status"] == "active"
        assert data["message_count"] == 0


class TestAIMessageModel:
    """Tests for the AIMessage model."""

    def test_create_message(self, db_session):
        from models_ai import AIAgent, AIConversation, AIMessage
        from models import User

        user = User(
            name="Msg User",
            employee_number="MSG001",
            department="IT",
            is_admin=False,
            is_active=True,
        )
        user.set_password("test123")
        db_session.add(user)

        agent = AIAgent(name="msg_agent", agent_type="assistant")
        db_session.add(agent)
        db_session.commit()

        conv = AIConversation(agent_id=agent.id, user_id=user.id, title="Messages")
        db_session.add(conv)
        db_session.commit()

        msg = AIMessage(
            conversation_id=conv.id,
            role="user",
            content="Hello, AI!",
            message_type="text",
        )
        db_session.add(msg)
        db_session.commit()

        assert msg.id is not None
        assert msg.role == "user"
        assert msg.content == "Hello, AI!"
        assert msg.message_type == "text"

    def test_message_to_dict(self, db_session):
        from models_ai import AIAgent, AIConversation, AIMessage
        from models import User

        user = User(
            name="MsgDict User",
            employee_number="MSGD001",
            department="IT",
            is_admin=False,
            is_active=True,
        )
        user.set_password("test123")
        db_session.add(user)

        agent = AIAgent(name="msgdict_agent", agent_type="assistant")
        db_session.add(agent)
        db_session.commit()

        conv = AIConversation(agent_id=agent.id, user_id=user.id)
        db_session.add(conv)
        db_session.commit()

        msg = AIMessage(
            conversation_id=conv.id,
            role="assistant",
            content="Hi there!",
            message_type="suggestion",
            metadata_json=json.dumps({"key": "value"}),
        )
        db_session.add(msg)
        db_session.commit()

        data = msg.to_dict()
        assert data["role"] == "assistant"
        assert data["content"] == "Hi there!"
        assert data["message_type"] == "suggestion"
        assert json.loads(data["metadata_json"])["key"] == "value"

    def test_conversation_message_ordering(self, db_session):
        from models_ai import AIAgent, AIConversation, AIMessage
        from models import User
        import time

        user = User(
            name="Order User",
            employee_number="ORD001",
            department="IT",
            is_admin=False,
            is_active=True,
        )
        user.set_password("test123")
        db_session.add(user)

        agent = AIAgent(name="order_agent", agent_type="assistant")
        db_session.add(agent)
        db_session.commit()

        conv = AIConversation(agent_id=agent.id, user_id=user.id)
        db_session.add(conv)
        db_session.commit()

        m1 = AIMessage(conversation_id=conv.id, role="user", content="First")
        db_session.add(m1)
        db_session.commit()

        m2 = AIMessage(conversation_id=conv.id, role="assistant", content="Second")
        db_session.add(m2)
        db_session.commit()

        # Verify messages are associated
        assert len(conv.messages) == 2


class TestAIAlertModel:
    """Tests for the AIAlert model."""

    def test_create_alert(self, db_session):
        from models_ai import AIAgent, AIAlert

        agent = AIAgent(name="alert_agent", agent_type="monitor")
        db_session.add(agent)
        db_session.commit()

        alert = AIAlert(
            agent_id=agent.id,
            severity="warning",
            category="performance",
            title="High CPU",
            description="CPU usage above 80%",
            details_json=json.dumps({"cpu_percent": 85}),
        )
        db_session.add(alert)
        db_session.commit()

        assert alert.id is not None
        assert alert.severity == "warning"
        assert alert.status == "active"  # default
        assert alert.auto_resolved is False

    def test_alert_to_dict(self, db_session):
        from models_ai import AIAgent, AIAlert

        agent = AIAgent(name="alert_dict_agent", agent_type="monitor")
        db_session.add(agent)
        db_session.commit()

        alert = AIAlert(
            agent_id=agent.id,
            severity="critical",
            category="error",
            title="DB Down",
            description="Cannot connect to database",
        )
        db_session.add(alert)
        db_session.commit()

        data = alert.to_dict()
        assert data["severity"] == "critical"
        assert data["category"] == "error"
        assert data["title"] == "DB Down"
        assert data["status"] == "active"
        assert data["auto_resolved"] is False


class TestAIMetricModel:
    """Tests for the AIMetric model."""

    def test_create_metric(self, db_session):
        from models_ai import AIMetric

        metric = AIMetric(
            metric_name="cpu_usage",
            metric_value=45.5,
            metric_unit="percent",
            category="system",
        )
        db_session.add(metric)
        db_session.commit()

        assert metric.id is not None
        assert metric.metric_value == 45.5
        assert metric.metric_unit == "percent"

    def test_metric_to_dict(self, db_session):
        from models_ai import AIMetric

        metric = AIMetric(
            metric_name="memory_usage",
            metric_value=72.3,
            metric_unit="percent",
            category="system",
            tags_json=json.dumps({"host": "web1"}),
        )
        db_session.add(metric)
        db_session.commit()

        data = metric.to_dict()
        assert data["metric_name"] == "memory_usage"
        assert data["metric_value"] == 72.3
        assert json.loads(data["tags_json"])["host"] == "web1"


class TestAIActionLogModel:
    """Tests for the AIActionLog model."""

    def test_create_action_log(self, db_session):
        from models_ai import AIAgent, AIActionLog

        agent = AIAgent(name="action_agent", agent_type="diagnostic")
        db_session.add(agent)
        db_session.commit()

        action = AIActionLog(
            agent_id=agent.id,
            action_type="auto_remediation",
            description="Cleared database connection pool",
            target="db_pool",
            result="success",
            details_json=json.dumps({"connections_freed": 5}),
        )
        db_session.add(action)
        db_session.commit()

        assert action.id is not None
        assert action.action_type == "auto_remediation"
        assert action.result == "success"

    def test_action_log_to_dict(self, db_session):
        from models_ai import AIAgent, AIActionLog

        agent = AIAgent(name="action_dict_agent", agent_type="diagnostic")
        db_session.add(agent)
        db_session.commit()

        action = AIActionLog(
            agent_id=agent.id,
            action_type="notification",
            description="Sent alert to admin",
            result="success",
        )
        db_session.add(action)
        db_session.commit()

        data = action.to_dict()
        assert data["action_type"] == "notification"
        assert data["result"] == "success"
        assert "created_at" in data
