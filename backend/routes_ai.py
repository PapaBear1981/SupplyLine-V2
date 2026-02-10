"""
AI Agent API Routes for SupplyLine MRO Suite

Provides endpoints for:
- Agent status and management
- Chat conversations with AI agents
- Alert management (view, acknowledge, resolve)
- Metrics and analytics data
- AI dashboard data
"""

import json
import logging
from datetime import datetime, timedelta

from flask import jsonify, request

from auth.jwt_manager import jwt_required
from models import db
from models_ai import AIActionLog, AIAgent, AIAlert, AIConversation, AIMessage, AIMetric

logger = logging.getLogger(__name__)


def register_ai_routes(app):
    """Register all AI-related API routes."""

    # ─── Agent Management ───────────────────────────────────────────

    @app.route("/api/ai/agents", methods=["GET"])
    @jwt_required
    def get_ai_agents(current_user):
        """Get all registered AI agents and their status."""
        try:
            from ai_agents.agent_manager import AgentManager
            manager = AgentManager.get_instance()
            status = manager.get_status()

            # Enrich with DB data
            agents = AIAgent.query.all()
            agent_map = {a.name: a.to_dict() for a in agents}

            for agent_info in status["agents"]:
                db_data = agent_map.get(agent_info["name"], {})
                agent_info["db_id"] = db_data.get("id")
                agent_info["last_heartbeat"] = db_data.get("last_heartbeat")
                agent_info["created_at"] = db_data.get("created_at")

            return jsonify(status), 200
        except Exception as e:
            logger.error("Error fetching AI agents: %s", e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/agents/<string:agent_name>/toggle", methods=["POST"])
    @jwt_required
    def toggle_ai_agent(current_user, agent_name):
        """Start or stop an AI agent (admin only)."""
        if not current_user.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403

        try:
            from ai_agents.agent_manager import AgentManager
            manager = AgentManager.get_instance()
            agent = manager.get_agent(agent_name)

            if not agent:
                return jsonify({"error": f"Agent '{agent_name}' not found"}), 404

            data = request.get_json() or {}
            action = data.get("action", "toggle")

            if action == "start" or (action == "toggle" and agent.status != "active"):
                agent.start()
                return jsonify({"message": f"Agent '{agent_name}' started", "status": "active"}), 200
            else:
                agent.stop()
                return jsonify({"message": f"Agent '{agent_name}' stopped", "status": "stopped"}), 200
        except Exception as e:
            logger.error("Error toggling agent '%s': %s", agent_name, e)
            return jsonify({"error": str(e)}), 500

    # ─── Chat / Conversations ──────────────────────────────────────

    @app.route("/api/ai/chat", methods=["POST"])
    @jwt_required
    def ai_chat(current_user):
        """Send a message to an AI agent and get a response."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body required"}), 400

            message = data.get("message", "").strip()
            agent_name = data.get("agent_name", "user_assistant")
            conversation_id = data.get("conversation_id")

            if not message:
                return jsonify({"error": "Message is required"}), 400

            user_id = current_user.get("user_id")

            from ai_agents.agent_manager import AgentManager
            manager = AgentManager.get_instance()

            # Get or create conversation
            conversation = None
            if conversation_id:
                conversation = AIConversation.query.get(conversation_id)
                if conversation and conversation.user_id != user_id:
                    return jsonify({"error": "Conversation not found"}), 404

            if not conversation:
                # Get agent DB id
                db_agent = AIAgent.query.filter_by(name=agent_name).first()
                if not db_agent:
                    return jsonify({"error": f"Agent '{agent_name}' not found"}), 404

                conversation = AIConversation(
                    agent_id=db_agent.id,
                    user_id=user_id,
                    title=message[:100],
                )
                db.session.add(conversation)
                db.session.flush()

            # Save user message
            user_msg = AIMessage(
                conversation_id=conversation.id,
                role="user",
                content=message,
                message_type="text",
            )
            db.session.add(user_msg)
            db.session.commit()

            # Get agent response
            result = manager.handle_user_message(agent_name, user_id, message, conversation.id)

            if "error" in result:
                return jsonify(result), 400

            # Save assistant message
            assistant_msg = AIMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=result.get("response", ""),
                message_type=result.get("message_type", "text"),
                metadata_json=json.dumps(result.get("metadata")) if result.get("metadata") else None,
            )
            db.session.add(assistant_msg)
            db.session.commit()

            return jsonify({
                "conversation_id": conversation.id,
                "message": assistant_msg.to_dict(),
                "agent_name": agent_name,
            }), 200
        except Exception as e:
            logger.error("AI chat error: %s", e, exc_info=True)
            db.session.rollback()
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/conversations", methods=["GET"])
    @jwt_required
    def get_ai_conversations(current_user):
        """Get user's AI conversations."""
        try:
            user_id = current_user.get("user_id")
            conversations = AIConversation.query.filter_by(
                user_id=user_id
            ).order_by(AIConversation.updated_at.desc()).limit(50).all()

            return jsonify({
                "conversations": [c.to_dict() for c in conversations]
            }), 200
        except Exception as e:
            logger.error("Error fetching conversations: %s", e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/conversations/<int:conversation_id>/messages", methods=["GET"])
    @jwt_required
    def get_conversation_messages(current_user, conversation_id):
        """Get messages for a specific conversation."""
        try:
            user_id = current_user.get("user_id")
            conversation = AIConversation.query.get(conversation_id)

            if not conversation or conversation.user_id != user_id:
                return jsonify({"error": "Conversation not found"}), 404

            messages = AIMessage.query.filter_by(
                conversation_id=conversation_id
            ).order_by(AIMessage.created_at.asc()).all()

            return jsonify({
                "conversation": conversation.to_dict(),
                "messages": [m.to_dict() for m in messages],
            }), 200
        except Exception as e:
            logger.error("Error fetching messages: %s", e)
            return jsonify({"error": str(e)}), 500

    # ─── Alerts ────────────────────────────────────────────────────

    @app.route("/api/ai/alerts", methods=["GET"])
    @jwt_required
    def get_ai_alerts(current_user):
        """Get AI alerts with optional filtering."""
        try:
            status_filter = request.args.get("status", "active")
            severity = request.args.get("severity")
            category = request.args.get("category")
            limit = min(int(request.args.get("limit", 50)), 200)

            query = AIAlert.query

            if status_filter and status_filter != "all":
                query = query.filter_by(status=status_filter)
            if severity:
                query = query.filter_by(severity=severity)
            if category:
                query = query.filter_by(category=category)

            alerts = query.order_by(AIAlert.created_at.desc()).limit(limit).all()

            # Get counts by severity
            active_counts = {
                "critical": AIAlert.query.filter_by(status="active", severity="critical").count(),
                "warning": AIAlert.query.filter_by(status="active", severity="warning").count(),
                "info": AIAlert.query.filter_by(status="active", severity="info").count(),
            }

            return jsonify({
                "alerts": [a.to_dict() for a in alerts],
                "active_counts": active_counts,
                "total": len(alerts),
            }), 200
        except Exception as e:
            logger.error("Error fetching alerts: %s", e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/alerts/<int:alert_id>/acknowledge", methods=["POST"])
    @jwt_required
    def acknowledge_alert(current_user, alert_id):
        """Acknowledge an AI alert."""
        try:
            alert = AIAlert.query.get(alert_id)
            if not alert:
                return jsonify({"error": "Alert not found"}), 404

            alert.status = "acknowledged"
            alert.acknowledged_by = current_user.get("user_id")
            db.session.commit()

            return jsonify({"message": "Alert acknowledged", "alert": alert.to_dict()}), 200
        except Exception as e:
            logger.error("Error acknowledging alert: %s", e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/alerts/<int:alert_id>/resolve", methods=["POST"])
    @jwt_required
    def resolve_alert(current_user, alert_id):
        """Resolve an AI alert."""
        try:
            alert = AIAlert.query.get(alert_id)
            if not alert:
                return jsonify({"error": "Alert not found"}), 404

            alert.status = "resolved"
            alert.resolved_by = current_user.get("user_id")
            alert.resolved_at = datetime.now()
            db.session.commit()

            return jsonify({"message": "Alert resolved", "alert": alert.to_dict()}), 200
        except Exception as e:
            logger.error("Error resolving alert: %s", e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/alerts/<int:alert_id>/dismiss", methods=["POST"])
    @jwt_required
    def dismiss_alert(current_user, alert_id):
        """Dismiss an AI alert."""
        try:
            alert = AIAlert.query.get(alert_id)
            if not alert:
                return jsonify({"error": "Alert not found"}), 404

            alert.status = "dismissed"
            db.session.commit()

            return jsonify({"message": "Alert dismissed"}), 200
        except Exception as e:
            logger.error("Error dismissing alert: %s", e)
            return jsonify({"error": str(e)}), 500

    # ─── Metrics ───────────────────────────────────────────────────

    @app.route("/api/ai/metrics", methods=["GET"])
    @jwt_required
    def get_ai_metrics(current_user):
        """Get AI metrics with optional filtering."""
        try:
            category = request.args.get("category")
            metric_name = request.args.get("metric_name")
            hours = int(request.args.get("hours", 24))
            limit = min(int(request.args.get("limit", 500)), 2000)

            since = datetime.now() - timedelta(hours=hours)
            query = AIMetric.query.filter(AIMetric.recorded_at >= since)

            if category:
                query = query.filter_by(category=category)
            if metric_name:
                query = query.filter_by(metric_name=metric_name)

            metrics = query.order_by(AIMetric.recorded_at.desc()).limit(limit).all()

            return jsonify({
                "metrics": [m.to_dict() for m in metrics],
                "total": len(metrics),
                "period_hours": hours,
            }), 200
        except Exception as e:
            logger.error("Error fetching metrics: %s", e)
            return jsonify({"error": str(e)}), 500

    @app.route("/api/ai/metrics/summary", methods=["GET"])
    @jwt_required
    def get_ai_metrics_summary(current_user):
        """Get a summary of current metrics (latest values per metric name)."""
        try:
            from sqlalchemy import func

            # Get the latest value for each metric name
            subquery = (
                db.session.query(
                    AIMetric.metric_name,
                    func.max(AIMetric.recorded_at).label("latest"),
                )
                .group_by(AIMetric.metric_name)
                .subquery()
            )

            latest_metrics = (
                db.session.query(AIMetric)
                .join(
                    subquery,
                    (AIMetric.metric_name == subquery.c.metric_name)
                    & (AIMetric.recorded_at == subquery.c.latest),
                )
                .all()
            )

            summary = {}
            for m in latest_metrics:
                summary[m.metric_name] = {
                    "value": m.metric_value,
                    "unit": m.metric_unit,
                    "category": m.category,
                    "recorded_at": m.recorded_at.isoformat() if m.recorded_at else None,
                }

            return jsonify({"summary": summary}), 200
        except Exception as e:
            logger.error("Error fetching metrics summary: %s", e)
            return jsonify({"error": str(e)}), 500

    # ─── Action Logs ───────────────────────────────────────────────

    @app.route("/api/ai/actions", methods=["GET"])
    @jwt_required
    def get_ai_actions(current_user):
        """Get AI action logs."""
        try:
            action_type = request.args.get("action_type")
            limit = min(int(request.args.get("limit", 50)), 200)

            query = AIActionLog.query
            if action_type:
                query = query.filter_by(action_type=action_type)

            actions = query.order_by(AIActionLog.created_at.desc()).limit(limit).all()

            return jsonify({
                "actions": [a.to_dict() for a in actions],
                "total": len(actions),
            }), 200
        except Exception as e:
            logger.error("Error fetching action logs: %s", e)
            return jsonify({"error": str(e)}), 500

    # ─── Dashboard ─────────────────────────────────────────────────

    @app.route("/api/ai/dashboard", methods=["GET"])
    @jwt_required
    def get_ai_dashboard(current_user):
        """Get comprehensive AI dashboard data."""
        try:
            from ai_agents.agent_manager import AgentManager
            import psutil

            manager = AgentManager.get_instance()

            # Agent status
            agent_status = manager.get_status()

            # Alert counts
            alert_counts = {
                "active_critical": AIAlert.query.filter_by(status="active", severity="critical").count(),
                "active_warning": AIAlert.query.filter_by(status="active", severity="warning").count(),
                "active_info": AIAlert.query.filter_by(status="active", severity="info").count(),
                "resolved_today": AIAlert.query.filter(
                    AIAlert.resolved_at >= datetime.now().replace(hour=0, minute=0, second=0),
                ).count(),
            }

            # Recent alerts
            recent_alerts = AIAlert.query.filter_by(
                status="active"
            ).order_by(AIAlert.created_at.desc()).limit(5).all()

            # Recent actions
            recent_actions = AIActionLog.query.order_by(
                AIActionLog.created_at.desc()
            ).limit(5).all()

            # System metrics snapshot
            cpu_percent = psutil.cpu_percent(interval=0.5)
            memory = psutil.virtual_memory()
            try:
                import os
                disk = psutil.disk_usage("/" if os.name != "nt" else "C:\\")
                disk_percent = disk.percent
            except Exception:
                disk_percent = 0

            system_metrics = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available_mb": round(memory.available / (1024 * 1024)),
                "disk_percent": disk_percent,
            }

            # Conversation count
            user_id = current_user.get("user_id")
            conversation_count = AIConversation.query.filter_by(user_id=user_id).count()

            return jsonify({
                "agents": agent_status,
                "alert_counts": alert_counts,
                "recent_alerts": [a.to_dict() for a in recent_alerts],
                "recent_actions": [a.to_dict() for a in recent_actions],
                "system_metrics": system_metrics,
                "conversation_count": conversation_count,
            }), 200
        except Exception as e:
            logger.error("Error fetching AI dashboard: %s", e)
            return jsonify({"error": str(e)}), 500
