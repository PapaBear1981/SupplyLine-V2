"""Audit log routes.

Provides read-only endpoints over AuditLog and UserActivity records used
by the admin dashboard and per-resource audit views. All endpoints are
admin-only: audit logs contain sensitive operational data (user activity,
resource access patterns, action timestamps) and should not leak to
regular users, let alone unauthenticated callers.
"""

import logging
from datetime import datetime, timedelta

from flask import jsonify, request
from sqlalchemy import func, or_

from auth import admin_required
from models import AuditLog, UserActivity, db


logger = logging.getLogger(__name__)


def register_audit_routes(app):
    @app.route("/api/audit", methods=["GET"])
    @admin_required
    def audit_route():
        logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).all()
        return jsonify([{
            "id": a.id,
            "action_type": a.action_type,
            "action_details": a.action_details,
            "timestamp": a.timestamp.isoformat()
        } for a in logs])

    @app.route("/api/audit/logs", methods=["GET"])
    @admin_required
    def audit_logs_route():
        # Get pagination parameters
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 20, type=int)

        # Calculate offset
        offset = (page - 1) * limit

        # Get logs with pagination
        logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

        return jsonify([{
            "id": a.id,
            "action_type": a.action_type,
            "action_details": a.action_details,
            "timestamp": a.timestamp.isoformat()
        } for a in logs])

    @app.route("/api/audit/metrics", methods=["GET"])
    @admin_required
    def audit_metrics_route():
        # Get timeframe parameter (default to 'week')
        timeframe = request.args.get("timeframe", "week")

        # Calculate date range based on timeframe
        now = datetime.now()
        if timeframe == "day":
            start_date = now - timedelta(days=1)
        elif timeframe == "week":
            start_date = now - timedelta(weeks=1)
        elif timeframe == "month":
            start_date = now - timedelta(days=30)
        else:
            start_date = now - timedelta(weeks=1)  # Default to week

        # Get counts for different action types
        checkout_count = AuditLog.query.filter(
            AuditLog.action_type == "checkout_tool",
            AuditLog.timestamp >= start_date
        ).count()

        return_count = AuditLog.query.filter(
            AuditLog.action_type == "return_tool",
            AuditLog.timestamp >= start_date
        ).count()

        login_count = AuditLog.query.filter(
            AuditLog.action_type == "user_login",
            AuditLog.timestamp >= start_date
        ).count()

        # Get total activity count
        total_activity = AuditLog.query.filter(
            AuditLog.timestamp >= start_date
        ).count()

        # This query gets counts by day
        daily_activity = db.session.query(
            func.date(AuditLog.timestamp).label("date"),
            func.count().label("count")
        ).filter(
            AuditLog.timestamp >= start_date
        ).group_by(
            func.date(AuditLog.timestamp)
        ).all()

        # Format the results
        daily_data = [{
            "date": str(day.date),
            "count": day.count
        } for day in daily_activity]

        return jsonify({
            "timeframe": timeframe,
            "total_activity": total_activity,
            "checkouts": checkout_count,
            "returns": return_count,
            "logins": login_count,
            "daily_activity": daily_data
        })

    @app.route("/api/audit/users/<int:user_id>", methods=["GET"])
    @admin_required
    def user_audit_logs_route(user_id):
        # Get pagination parameters
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 20, type=int)

        # Calculate offset
        offset = (page - 1) * limit

        # Get user activities with pagination
        activities = UserActivity.query.filter_by(user_id=user_id).order_by(
            UserActivity.timestamp.desc()
        ).offset(offset).limit(limit).all()

        return jsonify([activity.to_dict() for activity in activities])

    @app.route("/api/audit/tools/<int:tool_id>", methods=["GET"])
    @admin_required
    def tool_audit_logs_route(tool_id):
        # Get pagination parameters
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 20, type=int)

        # Calculate offset
        offset = (page - 1) * limit

        # Prefer the structured (resource_type, resource_id) columns that
        # AuditLog.log() populates for new entries. Fall back to a LIKE
        # match on action_details for legacy rows that predate the
        # structured columns, using the exact id (e.g. "tool 12")
        # followed by a non-digit so the filter for tool_id=1 does not
        # accidentally match "tool 10", "tool 100", etc.
        logs = AuditLog.query.filter(
            or_(
                db.and_(
                    AuditLog.resource_type == "tool",
                    AuditLog.resource_id == tool_id,
                ),
                AuditLog.action_details.like(f"%tool {tool_id} %"),
                AuditLog.action_details.like(f"%tool {tool_id})%"),
                AuditLog.action_details.like(f"%tool {tool_id}:%"),
            )
        ).order_by(
            AuditLog.timestamp.desc()
        ).offset(offset).limit(limit).all()

        return jsonify([{
            "id": a.id,
            "action_type": a.action_type,
            "action_details": a.action_details,
            "timestamp": a.timestamp.isoformat()
        } for a in logs])
