"""
Base Agent - Abstract base class for all AI agents.

All agents inherit from this class and implement their specific logic
in the `run_cycle` method, which is called periodically by the AgentManager.
"""

import json
import logging
import threading
import time
from abc import ABC, abstractmethod
from datetime import datetime

from flask import Flask

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base class for all AI agents."""

    def __init__(self, name: str, agent_type: str, description: str, interval: int = 60):
        """
        Initialize the base agent.

        Args:
            name: Unique name for this agent
            agent_type: Category of agent (monitor, assistant, diagnostic, analytics)
            description: Human-readable description
            interval: Seconds between run_cycle invocations
        """
        self.name = name
        self.agent_type = agent_type
        self.description = description
        self.interval = interval
        self.status = "initialized"
        self.error_message = None
        self._running = False
        self._thread = None
        self._app = None
        self._db_agent_id = None

    def bind_app(self, app: Flask):
        """Bind a Flask app so the agent can use app context."""
        self._app = app

    @property
    def app(self) -> Flask:
        if self._app is None:
            raise RuntimeError(f"Agent '{self.name}' has no Flask app bound. Call bind_app() first.")
        return self._app

    def start(self):
        """Start the agent's background loop."""
        if self._running:
            logger.warning("Agent '%s' is already running", self.name)
            return

        self._running = True
        self.status = "active"
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"agent-{self.name}")
        self._thread.start()
        logger.info("Agent '%s' started with interval %ds", self.name, self.interval)

    def stop(self):
        """Stop the agent's background loop."""
        self._running = False
        self.status = "stopped"
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10)
        logger.info("Agent '%s' stopped", self.name)

    def _loop(self):
        """Main loop that periodically calls run_cycle within app context."""
        while self._running:
            try:
                with self.app.app_context():
                    self._update_heartbeat()
                    self.run_cycle()
            except Exception as e:
                self.status = "error"
                self.error_message = str(e)
                logger.error("Agent '%s' cycle error: %s", self.name, e, exc_info=True)
                self._record_error(str(e))
            time.sleep(self.interval)

    @abstractmethod
    def run_cycle(self):
        """
        Execute one cycle of the agent's work.
        Called periodically by the background loop.
        Must be implemented by subclasses.
        """
        pass

    def handle_message(self, user_id: int, message: str, conversation_id: int | None = None) -> dict:
        """
        Handle an incoming user message. Override in agents that support chat.

        Args:
            user_id: The ID of the user sending the message
            message: The user's message text
            conversation_id: Optional existing conversation ID

        Returns:
            dict with 'response' text and optional 'message_type', 'metadata'
        """
        return {
            "response": f"Agent '{self.name}' does not support direct messaging.",
            "message_type": "text",
        }

    def _update_heartbeat(self):
        """Update the agent's heartbeat in the database."""
        try:
            from models import db
            from models_ai import AIAgent

            db_agent = AIAgent.query.filter_by(name=self.name).first()
            if db_agent:
                db_agent.last_heartbeat = datetime.now()
                db_agent.status = self.status
                db_agent.error_message = self.error_message
                db.session.commit()
                self._db_agent_id = db_agent.id
        except Exception as e:
            logger.debug("Heartbeat update failed for '%s': %s", self.name, e)

    def _record_error(self, error_msg: str):
        """Record an error in the database."""
        try:
            with self.app.app_context():
                from models import db
                from models_ai import AIAgent

                db_agent = AIAgent.query.filter_by(name=self.name).first()
                if db_agent:
                    db_agent.status = "error"
                    db_agent.error_message = error_msg
                    db.session.commit()
        except Exception:
            pass

    def create_alert(self, severity: str, category: str, title: str, description: str, details: dict | None = None):
        """
        Create an alert in the database and emit via Socket.IO.

        Args:
            severity: critical, warning, or info
            category: performance, error, security, inventory, maintenance
            title: Short alert title
            description: Detailed description
            details: Optional structured details dict
        """
        try:
            from models import db
            from models_ai import AIAlert

            alert = AIAlert(
                agent_id=self._get_db_id(),
                severity=severity,
                category=category,
                title=title,
                description=description,
                details_json=json.dumps(details) if details else None,
            )
            db.session.add(alert)
            db.session.commit()

            # Emit real-time notification
            self._emit_alert(alert.to_dict())

            logger.info("Agent '%s' created %s alert: %s", self.name, severity, title)
            return alert
        except Exception as e:
            logger.error("Failed to create alert: %s", e)
            return None

    def record_metric(self, metric_name: str, value: float, unit: str | None = None,
                      category: str = "system", tags: dict | None = None):
        """Record a metric data point."""
        try:
            from models import db
            from models_ai import AIMetric

            metric = AIMetric(
                metric_name=metric_name,
                metric_value=value,
                metric_unit=unit,
                category=category,
                tags_json=json.dumps(tags) if tags else None,
            )
            db.session.add(metric)
            db.session.commit()
        except Exception as e:
            logger.debug("Failed to record metric '%s': %s", metric_name, e)

    def log_action(self, action_type: str, description: str, target: str | None = None,
                   result: str = "success", details: dict | None = None):
        """Log an action taken by this agent."""
        try:
            from models import db
            from models_ai import AIActionLog

            action = AIActionLog(
                agent_id=self._get_db_id(),
                action_type=action_type,
                description=description,
                target=target,
                result=result,
                details_json=json.dumps(details) if details else None,
            )
            db.session.add(action)
            db.session.commit()
        except Exception as e:
            logger.debug("Failed to log action: %s", e)

    def _get_db_id(self) -> int:
        """Get or create the database record for this agent."""
        if self._db_agent_id:
            return self._db_agent_id

        from models import db
        from models_ai import AIAgent

        db_agent = AIAgent.query.filter_by(name=self.name).first()
        if not db_agent:
            db_agent = AIAgent(
                name=self.name,
                agent_type=self.agent_type,
                description=self.description,
                status=self.status,
            )
            db.session.add(db_agent)
            db.session.commit()
        self._db_agent_id = db_agent.id
        return self._db_agent_id

    def _emit_alert(self, alert_data: dict):
        """Emit an alert via Socket.IO to connected admin clients."""
        try:
            from socketio_config import socketio
            socketio.emit("ai_alert", alert_data, namespace="/")
        except Exception as e:
            logger.debug("Failed to emit alert via Socket.IO: %s", e)

    def get_info(self) -> dict:
        """Return agent info for API responses."""
        return {
            "name": self.name,
            "agent_type": self.agent_type,
            "description": self.description,
            "status": self.status,
            "interval": self.interval,
            "error_message": self.error_message,
        }
