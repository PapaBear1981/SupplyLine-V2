"""
WebSocket event handlers for AI agent real-time features.

Handles:
- AI alert subscriptions and broadcasts
- Real-time metric updates
- Agent status change notifications
- Chat message streaming (future)
"""

import logging

from flask_socketio import emit, join_room, leave_room

from socketio_config import socketio

logger = logging.getLogger(__name__)


def register_ai_socketio_events(app):
    """Register AI-related Socket.IO event handlers."""

    @socketio.on("subscribe_ai_alerts")
    def handle_subscribe_alerts(data=None):
        """Subscribe a client to AI alert notifications."""
        join_room("ai_alerts")
        emit("ai_subscribed", {"channel": "ai_alerts", "status": "subscribed"})
        logger.debug("Client subscribed to AI alerts")

    @socketio.on("unsubscribe_ai_alerts")
    def handle_unsubscribe_alerts(data=None):
        """Unsubscribe from AI alert notifications."""
        leave_room("ai_alerts")
        emit("ai_unsubscribed", {"channel": "ai_alerts", "status": "unsubscribed"})

    @socketio.on("subscribe_ai_metrics")
    def handle_subscribe_metrics(data=None):
        """Subscribe to real-time metric updates."""
        join_room("ai_metrics")
        emit("ai_subscribed", {"channel": "ai_metrics", "status": "subscribed"})

    @socketio.on("unsubscribe_ai_metrics")
    def handle_unsubscribe_metrics(data=None):
        """Unsubscribe from metric updates."""
        leave_room("ai_metrics")

    @socketio.on("subscribe_ai_status")
    def handle_subscribe_status(data=None):
        """Subscribe to agent status updates."""
        join_room("ai_status")
        emit("ai_subscribed", {"channel": "ai_status", "status": "subscribed"})

    @socketio.on("ai_chat_message")
    def handle_ai_chat(data):
        """Handle real-time AI chat messages via WebSocket."""
        if not data or not data.get("message"):
            emit("ai_chat_error", {"error": "Message required"})
            return

        agent_name = data.get("agent_name", "user_assistant")
        message = data.get("message", "")
        user_id = data.get("user_id")

        if not user_id:
            emit("ai_chat_error", {"error": "Authentication required"})
            return

        try:
            from ai_agents.agent_manager import AgentManager

            with app.app_context():
                manager = AgentManager.get_instance()
                result = manager.handle_user_message(agent_name, user_id, message)

                emit("ai_chat_response", {
                    "agent_name": agent_name,
                    "response": result.get("response", ""),
                    "message_type": result.get("message_type", "text"),
                })
        except Exception as e:
            logger.error("WebSocket AI chat error: %s", e)
            emit("ai_chat_error", {"error": str(e)})


def broadcast_ai_alert(alert_data: dict):
    """Broadcast an AI alert to all subscribed clients."""
    try:
        socketio.emit("ai_alert", alert_data, room="ai_alerts", namespace="/")
    except Exception as e:
        logger.debug("Failed to broadcast AI alert: %s", e)


def broadcast_ai_metric(metric_data: dict):
    """Broadcast a metric update to subscribed clients."""
    try:
        socketio.emit("ai_metric_update", metric_data, room="ai_metrics", namespace="/")
    except Exception as e:
        logger.debug("Failed to broadcast AI metric: %s", e)


def broadcast_agent_status(agent_name: str, status: str):
    """Broadcast an agent status change."""
    try:
        socketio.emit("ai_agent_status", {
            "agent_name": agent_name,
            "status": status,
        }, room="ai_status", namespace="/")
    except Exception as e:
        logger.debug("Failed to broadcast agent status: %s", e)
