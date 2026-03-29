"""
AI Agent Framework for SupplyLine MRO Suite

This package provides an extensible AI agent system for:
- System monitoring and health checks
- User assistance with daily tasks
- Error diagnosis and auto-remediation
- Analytics and anomaly detection
"""

from ai_agents.base_agent import BaseAgent
from ai_agents.agent_manager import AgentManager

__all__ = ["BaseAgent", "AgentManager"]
