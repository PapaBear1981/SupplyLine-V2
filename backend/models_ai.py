"""
AI Agent Database Models for SupplyLine MRO Suite

This module defines the database models for the AI agent system including:
- Agent configurations and state
- Conversation history (user <-> agent interactions)
- System alerts and incidents detected by monitoring agents
- Performance metrics collected by agents
- Agent action logs (audit trail of automated actions)
"""

import logging
from datetime import datetime

from models import db

try:
    from time_utils import get_local_timestamp

    def get_current_time():
        return get_local_timestamp()
except ImportError:

    def get_current_time():
        return datetime.now()


logger = logging.getLogger(__name__)


class AIAgent(db.Model):
    """Represents a configured AI agent instance."""

    __tablename__ = "ai_agents"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    agent_type = db.Column(
        db.String(50), nullable=False
    )  # monitor, assistant, diagnostic, analytics
    description = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(20), nullable=False, default="active"
    )  # active, paused, error, disabled
    config = db.Column(db.Text, nullable=True)  # JSON config string
    last_heartbeat = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=get_current_time)
    updated_at = db.Column(db.DateTime, nullable=False, default=get_current_time, onupdate=get_current_time)

    # Relationships
    conversations = db.relationship("AIConversation", back_populates="agent", cascade="all, delete-orphan")
    alerts = db.relationship("AIAlert", back_populates="agent", cascade="all, delete-orphan")
    action_logs = db.relationship("AIActionLog", back_populates="agent", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "agent_type": self.agent_type,
            "description": self.description,
            "status": self.status,
            "config": self.config,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AIConversation(db.Model):
    """Stores conversation threads between users and AI agents."""

    __tablename__ = "ai_conversations"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("ai_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active")  # active, archived, resolved
    created_at = db.Column(db.DateTime, nullable=False, default=get_current_time)
    updated_at = db.Column(db.DateTime, nullable=False, default=get_current_time, onupdate=get_current_time)

    # Relationships
    agent = db.relationship("AIAgent", back_populates="conversations")
    messages = db.relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan",
                               order_by="AIMessage.created_at")

    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "user_id": self.user_id,
            "title": self.title,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "message_count": len(self.messages) if self.messages else 0,
        }


class AIMessage(db.Model):
    """Individual messages within an AI conversation."""

    __tablename__ = "ai_messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(
        db.Integer, db.ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = db.Column(db.String(20), nullable=False)  # user, assistant, system
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(
        db.String(30), nullable=False, default="text"
    )  # text, suggestion, action, alert, chart
    metadata_json = db.Column(db.Text, nullable=True)  # JSON metadata for rich messages
    created_at = db.Column(db.DateTime, nullable=False, default=get_current_time)

    # Relationships
    conversation = db.relationship("AIConversation", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "message_type": self.message_type,
            "metadata_json": self.metadata_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AIAlert(db.Model):
    """Alerts generated by AI monitoring agents."""

    __tablename__ = "ai_alerts"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("ai_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False)  # critical, warning, info
    category = db.Column(
        db.String(50), nullable=False
    )  # performance, error, security, inventory, maintenance
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    details_json = db.Column(db.Text, nullable=True)  # JSON with structured details
    status = db.Column(db.String(20), nullable=False, default="active")  # active, acknowledged, resolved, dismissed
    acknowledged_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    resolved_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)
    auto_resolved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=get_current_time)

    # Relationships
    agent = db.relationship("AIAgent", back_populates="alerts")

    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "severity": self.severity,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "details_json": self.details_json,
            "status": self.status,
            "acknowledged_by": self.acknowledged_by,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "auto_resolved": self.auto_resolved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AIMetric(db.Model):
    """Time-series performance metrics collected by AI agents."""

    __tablename__ = "ai_metrics"

    id = db.Column(db.Integer, primary_key=True)
    metric_name = db.Column(db.String(100), nullable=False, index=True)
    metric_value = db.Column(db.Float, nullable=False)
    metric_unit = db.Column(db.String(30), nullable=True)  # percent, ms, count, bytes
    category = db.Column(
        db.String(50), nullable=False, index=True
    )  # system, application, database, api
    tags_json = db.Column(db.Text, nullable=True)  # JSON tags for filtering
    recorded_at = db.Column(db.DateTime, nullable=False, default=get_current_time, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "metric_name": self.metric_name,
            "metric_value": self.metric_value,
            "metric_unit": self.metric_unit,
            "category": self.category,
            "tags_json": self.tags_json,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }


class AIActionLog(db.Model):
    """Audit log of actions taken by AI agents (auto-remediation, suggestions acted upon)."""

    __tablename__ = "ai_action_logs"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("ai_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = db.Column(
        db.String(50), nullable=False
    )  # auto_remediation, suggestion, notification, escalation
    description = db.Column(db.Text, nullable=False)
    target = db.Column(db.String(200), nullable=True)  # What was acted upon
    result = db.Column(db.String(20), nullable=False)  # success, failure, pending
    details_json = db.Column(db.Text, nullable=True)  # JSON with action details
    created_at = db.Column(db.DateTime, nullable=False, default=get_current_time)

    # Relationships
    agent = db.relationship("AIAgent", back_populates="action_logs")

    def to_dict(self):
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "description": self.description,
            "target": self.target,
            "result": self.result,
            "details_json": self.details_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
