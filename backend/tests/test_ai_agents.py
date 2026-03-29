"""
Tests for AI Agent Framework

Tests BaseAgent lifecycle, AgentManager orchestration,
and individual agent behavior.
"""

import json
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest


class TestBaseAgent:
    """Tests for the BaseAgent abstract base class."""

    def test_agent_initialization(self, app):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        assert agent.name == "system_monitor"
        assert agent.agent_type == "monitor"
        assert agent.status == "initialized"
        assert agent.interval == 30
        assert agent._running is False

    def test_agent_bind_app(self, app):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)
        assert agent._app is app

    def test_agent_app_raises_without_bind(self):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        with pytest.raises(RuntimeError, match="has no Flask app bound"):
            _ = agent.app

    def test_agent_get_info(self, app):
        from ai_agents.assistant_agent import UserAssistantAgent

        agent = UserAssistantAgent()
        info = agent.get_info()
        assert info["name"] == "user_assistant"
        assert info["agent_type"] == "assistant"
        assert info["status"] == "initialized"
        assert "description" in info
        assert "interval" in info

    def test_agent_start_stop(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        # Override interval to keep test fast
        agent.interval = 600

        agent.start()
        assert agent._running is True
        assert agent.status == "active"
        assert agent._thread is not None
        assert agent._thread.is_alive()

        agent.stop()
        assert agent._running is False
        assert agent.status == "stopped"

    def test_agent_double_start(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)
        agent.interval = 600

        agent.start()
        thread1 = agent._thread

        # Starting again should be a no-op
        agent.start()
        assert agent._thread is thread1

        agent.stop()

    def test_agent_create_alert(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent
        from models_ai import AIAgent, AIAlert

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            # Ensure the DB record exists
            db_agent = AIAgent(name="system_monitor", agent_type="monitor")
            db_session.add(db_agent)
            db_session.commit()

            alert = agent.create_alert(
                severity="warning",
                category="performance",
                title="Test Alert",
                description="This is a test alert",
                details={"test_key": "test_value"},
            )

            assert alert is not None
            assert alert.severity == "warning"
            assert alert.title == "Test Alert"

            # Verify in DB
            saved = AIAlert.query.filter_by(title="Test Alert").first()
            assert saved is not None
            assert json.loads(saved.details_json)["test_key"] == "test_value"

    def test_agent_record_metric(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent
        from models_ai import AIMetric

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            agent.record_metric("test_metric", 42.0, unit="count", category="test")

            metric = AIMetric.query.filter_by(metric_name="test_metric").first()
            assert metric is not None
            assert metric.metric_value == 42.0
            assert metric.metric_unit == "count"

    def test_agent_log_action(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent
        from models_ai import AIAgent, AIActionLog

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="diagnostic", agent_type="diagnostic")
            db_session.add(db_agent)
            db_session.commit()

            agent.log_action(
                action_type="auto_remediation",
                description="Freed connection pool",
                target="database",
                result="success",
                details={"connections_freed": 3},
            )

            action = AIActionLog.query.filter_by(description="Freed connection pool").first()
            assert action is not None
            assert action.result == "success"


class TestAgentManager:
    """Tests for the AgentManager singleton."""

    def test_singleton(self):
        from ai_agents.agent_manager import AgentManager

        m1 = AgentManager.get_instance()
        m2 = AgentManager.get_instance()
        assert m1 is m2

        # Reset for isolation
        AgentManager._instance = None

    def test_init_app_registers_agents(self, app, db_session):
        from ai_agents.agent_manager import AgentManager

        # Reset singleton
        AgentManager._instance = None
        manager = AgentManager.get_instance()

        with app.app_context():
            manager.init_app(app)

            agents = manager.get_all_agents()
            assert len(agents) == 4

            names = {a.name for a in agents}
            assert "system_monitor" in names
            assert "user_assistant" in names
            assert "diagnostic" in names
            assert "analytics" in names

        # Reset for other tests
        AgentManager._instance = None

    def test_get_agent_by_name(self, app, db_session):
        from ai_agents.agent_manager import AgentManager

        AgentManager._instance = None
        manager = AgentManager.get_instance()

        with app.app_context():
            manager.init_app(app)

            agent = manager.get_agent("system_monitor")
            assert agent is not None
            assert agent.name == "system_monitor"

            missing = manager.get_agent("nonexistent")
            assert missing is None

        AgentManager._instance = None

    def test_get_agents_by_type(self, app, db_session):
        from ai_agents.agent_manager import AgentManager

        AgentManager._instance = None
        manager = AgentManager.get_instance()

        with app.app_context():
            manager.init_app(app)

            monitors = manager.get_agents_by_type("monitor")
            assert len(monitors) == 1
            assert monitors[0].name == "system_monitor"

            assistants = manager.get_agents_by_type("assistant")
            assert len(assistants) == 1

        AgentManager._instance = None

    def test_get_status(self, app, db_session):
        from ai_agents.agent_manager import AgentManager

        AgentManager._instance = None
        manager = AgentManager.get_instance()

        with app.app_context():
            manager.init_app(app)

            status = manager.get_status()
            assert status["total_agents"] == 4
            assert len(status["agents"]) == 4

        AgentManager._instance = None

    def test_handle_user_message(self, app, db_session):
        from ai_agents.agent_manager import AgentManager
        from models import User

        AgentManager._instance = None
        manager = AgentManager.get_instance()

        with app.app_context():
            manager.init_app(app)

            user = User(
                name="Chat User",
                employee_number="CHAT001",
                department="IT",
                is_admin=False,
                is_active=True,
            )
            user.set_password("test123")
            db_session.add(user)
            db_session.commit()

            result = manager.handle_user_message("user_assistant", user.id, "help")
            assert "response" in result
            assert "error" not in result

            # Test with non-existent agent
            result = manager.handle_user_message("nonexistent", user.id, "hi")
            assert "error" in result

        AgentManager._instance = None

    def test_db_sync(self, app, db_session):
        from ai_agents.agent_manager import AgentManager
        from models_ai import AIAgent

        AgentManager._instance = None
        manager = AgentManager.get_instance()

        with app.app_context():
            manager.init_app(app)

            # All 4 agents should have DB records
            db_agents = AIAgent.query.all()
            agent_names = {a.name for a in db_agents}
            assert "system_monitor" in agent_names
            assert "user_assistant" in agent_names
            assert "diagnostic" in agent_names
            assert "analytics" in agent_names

        AgentManager._instance = None


class TestSystemMonitorAgent:
    """Tests for the System Monitor Agent."""

    def test_handle_message_status(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent
        from models_ai import AIAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="system_monitor", agent_type="monitor")
            db_session.add(db_agent)
            db_session.commit()

            result = agent.handle_message(1, "system status")
            assert "response" in result
            assert "CPU" in result["response"] or "System Health" in result["response"]

    def test_handle_message_cpu(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "what is cpu usage?")
            assert "CPU" in result["response"]

    def test_handle_message_memory(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "memory usage")
            assert "Memory" in result["response"] or "memory" in result["response"]

    def test_handle_message_disk(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "disk space")
            assert "response" in result

    def test_handle_message_alerts(self, app, db_session):
        from ai_agents.monitor_agent import SystemMonitorAgent
        from models_ai import AIAgent

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="system_monitor", agent_type="monitor")
            db_session.add(db_agent)
            db_session.commit()

            result = agent.handle_message(1, "show alerts")
            assert "response" in result

    def test_run_cycle(self, app, db_session):
        """Test that run_cycle executes without errors."""
        from ai_agents.monitor_agent import SystemMonitorAgent
        from models_ai import AIAgent, AIMetric

        agent = SystemMonitorAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="system_monitor", agent_type="monitor")
            db_session.add(db_agent)
            db_session.commit()

            # Run one monitoring cycle
            agent.run_cycle()

            # Should have recorded metrics
            metrics = AIMetric.query.filter_by(category="system").all()
            assert len(metrics) > 0

            metric_names = {m.metric_name for m in metrics}
            assert "cpu_usage" in metric_names
            assert "memory_usage" in metric_names


class TestUserAssistantAgent:
    """Tests for the User Assistant Agent."""

    def test_handle_help(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "help")
            assert "response" in result
            assert "SupplyLine AI Assistant" in result["response"]

    def test_handle_greeting(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent
        from models import User

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            user = User(
                name="Greeting User",
                employee_number="GREET001",
                department="IT",
                is_admin=False,
                is_active=True,
            )
            user.set_password("test123")
            db_session.add(user)
            db_session.commit()

            result = agent.handle_message(user.id, "hello")
            assert "Hello" in result["response"]
            assert "Greeting User" in result["response"]

    def test_handle_tool_query_count(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent
        from models import Tool, Warehouse

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            # Create some tools
            wh = Warehouse(name="Test WH", address="123 Test St", is_active=True)
            db_session.add(wh)
            db_session.commit()

            for i in range(3):
                t = Tool(
                    tool_number=f"T{i:03d}",
                    serial_number=f"S{i:03d}",
                    description=f"Tool {i}",
                    status="available",
                    warehouse_id=wh.id,
                )
                db_session.add(t)
            db_session.commit()

            result = agent.handle_message(1, "how many tools total?")
            assert "3" in result["response"]
            assert "Tool" in result["response"]

    def test_handle_tool_available(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent
        from models import Tool, Warehouse

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            wh = Warehouse(name="Avail WH", address="123 Test St", is_active=True)
            db_session.add(wh)
            db_session.commit()

            t = Tool(
                tool_number="AVAIL001",
                serial_number="SA001",
                description="Available Tool",
                status="available",
                warehouse_id=wh.id,
            )
            db_session.add(t)
            db_session.commit()

            result = agent.handle_message(1, "show available tools")
            assert "Available" in result["response"] or "AVAIL001" in result["response"]

    def test_handle_chemical_query(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent
        from models import Chemical, Warehouse

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            wh = Warehouse(name="Chem WH", address="456 Test St", is_active=True)
            db_session.add(wh)
            db_session.commit()

            c = Chemical(
                part_number="CH001",
                lot_number="L001",
                description="Test Chemical",
                quantity=5,
                minimum_stock_level=10,
                unit="ml",
                status="available",
                warehouse_id=wh.id,
            )
            db_session.add(c)
            db_session.commit()

            result = agent.handle_message(1, "low stock chemicals")
            assert "Low Stock" in result["response"] or "Test Chemical" in result["response"]

    def test_handle_summary(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "system summary")
            assert "Summary" in result["response"]

    def test_handle_search(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent
        from models import Tool, Warehouse

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            wh = Warehouse(name="Search WH", address="789 Test St", is_active=True)
            db_session.add(wh)
            db_session.commit()

            t = Tool(
                tool_number="SRCH001",
                serial_number="SS001",
                description="Wrench",
                status="available",
                warehouse_id=wh.id,
            )
            db_session.add(t)
            db_session.commit()

            result = agent.handle_message(1, "search wrench")
            assert "Wrench" in result["response"] or "SRCH001" in result["response"]

    def test_handle_search_short_term(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "search a")
            assert "at least 2 characters" in result["response"]

    def test_handle_unknown(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "xyzzy blorp flub")
            assert "response" in result
            assert result["message_type"] == "suggestion"

    def test_handle_thanks(self, app, db_session):
        from ai_agents.assistant_agent import UserAssistantAgent

        agent = UserAssistantAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "thanks!")
            assert "welcome" in result["response"].lower()


class TestDiagnosticAgent:
    """Tests for the Diagnostic Agent."""

    def test_handle_message_default(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "hello")
            assert "Diagnostic Agent" in result["response"]

    def test_handle_message_recent_errors(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "show recent errors")
            assert "response" in result
            # With no errors buffered, should say running smoothly
            assert "smoothly" in result["response"] or "Recent Errors" in result["response"]

    def test_handle_message_diagnose(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "diagnose the system")
            assert "response" in result

    def test_record_error(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent
        from models_ai import AIAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="diagnostic", agent_type="diagnostic")
            db_session.add(db_agent)
            db_session.commit()

            agent.record_error("TypeError", "NoneType has no attribute 'id'", context={"endpoint": "/api/test"})

            assert len(agent._error_buffer) == 1
            assert agent._error_patterns["TypeError"] == 1

    def test_error_buffer_limit(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent
        from models_ai import AIAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="diagnostic", agent_type="diagnostic")
            db_session.add(db_agent)
            db_session.commit()

            # Fill buffer beyond limit
            for i in range(1005):
                agent.record_error("TestError", f"Error {i}")

            # Buffer should be trimmed (keeps last 500 when exceeding 1000)
            assert len(agent._error_buffer) <= 1000

    def test_diagnose_known_error(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        diagnosis = agent._diagnose_error("database_locked", "database is locked")
        assert "SQLite" in diagnosis["analysis"]

    def test_diagnose_unknown_error(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        diagnosis = agent._diagnose_error("WeirdError", "something weird happened")
        assert "category" in diagnosis

    def test_run_cycle(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent
        from models_ai import AIAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="diagnostic", agent_type="diagnostic")
            db_session.add(db_agent)
            db_session.commit()

            # Should run without errors
            agent.run_cycle()

    def test_handle_incidents(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "show active incidents")
            assert "response" in result
            assert "incident" in result["response"].lower() or "stable" in result["response"].lower()

    def test_handle_remediation_status(self, app, db_session):
        from ai_agents.diagnostic_agent import DiagnosticAgent

        agent = DiagnosticAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "what was fixed recently?")
            assert "response" in result


class TestAnalyticsAgent:
    """Tests for the Analytics Agent."""

    def test_handle_message_default(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "hello")
            assert "Analytics Agent" in result["response"]

    def test_handle_trends(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "show usage trends")
            assert "Trends" in result["response"] or "Usage" in result["response"]

    def test_handle_anomalies(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "any anomalies detected?")
            assert "response" in result

    def test_handle_top_items(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "show top used tools")
            assert "response" in result

    def test_handle_predictions(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "inventory predictions")
            assert "Prediction" in result["response"]

    def test_handle_report(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            result = agent.handle_message(1, "analytics report")
            assert "Analytics Report" in result["response"] or "Report" in result["response"]

    def test_run_cycle(self, app, db_session):
        from ai_agents.analytics_agent import AnalyticsAgent
        from models_ai import AIAgent

        agent = AnalyticsAgent()
        agent.bind_app(app)

        with app.app_context():
            db_agent = AIAgent(name="analytics", agent_type="analytics")
            db_session.add(db_agent)
            db_session.commit()

            # Should run without errors
            agent.run_cycle()
