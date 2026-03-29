"""
Agent Manager - Orchestrates all AI agents.

Responsible for:
- Registering, starting, and stopping agents
- Providing access to agents by name or type
- Ensuring agents are properly initialized with Flask app context
- Managing agent lifecycle
"""

import logging

from flask import Flask

from ai_agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class AgentManager:
    """Central manager for all AI agents."""

    _instance = None

    def __init__(self):
        self._agents: dict[str, BaseAgent] = {}
        self._app: Flask | None = None

    @classmethod
    def get_instance(cls) -> "AgentManager":
        """Get the singleton AgentManager instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def init_app(self, app: Flask):
        """Bind the Flask app and register default agents."""
        self._app = app

        # Register built-in agents
        from ai_agents.monitor_agent import SystemMonitorAgent
        from ai_agents.assistant_agent import UserAssistantAgent
        from ai_agents.diagnostic_agent import DiagnosticAgent
        from ai_agents.analytics_agent import AnalyticsAgent

        self.register(SystemMonitorAgent())
        self.register(UserAssistantAgent())
        self.register(DiagnosticAgent())
        self.register(AnalyticsAgent())

        # Ensure database records exist for all agents
        with app.app_context():
            self._sync_db_records()

        logger.info("AgentManager initialized with %d agents", len(self._agents))

    def register(self, agent: BaseAgent):
        """Register an agent with the manager."""
        if agent.name in self._agents:
            logger.warning("Agent '%s' already registered, replacing", agent.name)
        if self._app:
            agent.bind_app(self._app)
        self._agents[agent.name] = agent
        logger.info("Registered agent: %s (%s)", agent.name, agent.agent_type)

    def start_all(self):
        """Start all registered agents."""
        for agent in self._agents.values():
            try:
                agent.start()
            except Exception as e:
                logger.error("Failed to start agent '%s': %s", agent.name, e)

    def stop_all(self):
        """Stop all registered agents."""
        for agent in self._agents.values():
            try:
                agent.stop()
            except Exception as e:
                logger.error("Failed to stop agent '%s': %s", agent.name, e)

    def get_agent(self, name: str) -> BaseAgent | None:
        """Get an agent by name."""
        return self._agents.get(name)

    def get_agents_by_type(self, agent_type: str) -> list[BaseAgent]:
        """Get all agents of a specific type."""
        return [a for a in self._agents.values() if a.agent_type == agent_type]

    def get_all_agents(self) -> list[BaseAgent]:
        """Get all registered agents."""
        return list(self._agents.values())

    def get_status(self) -> dict:
        """Get status of all agents."""
        return {
            "total_agents": len(self._agents),
            "agents": [agent.get_info() for agent in self._agents.values()],
        }

    def handle_user_message(self, agent_name: str, user_id: int, message: str,
                            conversation_id: int | None = None) -> dict:
        """Route a user message to the specified agent."""
        agent = self._agents.get(agent_name)
        if not agent:
            return {"error": f"Agent '{agent_name}' not found"}
        return agent.handle_message(user_id, message, conversation_id)

    def _sync_db_records(self):
        """Ensure all agents have corresponding database records."""
        try:
            from models import db
            from models_ai import AIAgent

            for agent in self._agents.values():
                existing = AIAgent.query.filter_by(name=agent.name).first()
                if not existing:
                    db_agent = AIAgent(
                        name=agent.name,
                        agent_type=agent.agent_type,
                        description=agent.description,
                        status="initialized",
                    )
                    db.session.add(db_agent)
            db.session.commit()
        except Exception as e:
            logger.error("Failed to sync agent DB records: %s", e)
