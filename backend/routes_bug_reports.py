"""Bug report routes — submit, list, update, and delete bug reports."""

import logging

from flask import jsonify, request

from auth import jwt_required, permission_required
from models import BugReport, SystemSetting, db, get_current_time


logger = logging.getLogger(__name__)


def _try_create_github_issue(report: BugReport) -> None:
    """Best-effort GitHub issue creation — never raises, never blocks the response."""
    try:
        enabled_row = SystemSetting.query.filter_by(key="github.enabled").first()
        if not enabled_row or enabled_row.value != "true":
            return

        token_row = SystemSetting.query.filter_by(key="github.token").first()
        owner_row = SystemSetting.query.filter_by(key="github.owner").first()
        repo_row  = SystemSetting.query.filter_by(key="github.repo").first()

        token = token_row.value if token_row else ""
        owner = owner_row.value if owner_row else ""
        repo  = repo_row.value if repo_row else ""

        if not (token and owner and repo):
            logger.warning("GitHub integration enabled but token/owner/repo not fully configured")
            return

        from utils.github_service import create_github_issue
        result = create_github_issue(report.to_dict(), token=token, owner=owner, repo=repo)

        if result:
            report.github_issue_number = result["number"]
            report.github_issue_url    = result["html_url"]
            db.session.commit()
            logger.info("Created GitHub issue #%s for bug report %s", result["number"], report.id)
    except Exception:
        logger.warning("Unexpected error during GitHub issue creation", exc_info=True)


def register_bug_report_routes(app):

    @app.route("/api/bug-reports", methods=["GET"])
    @jwt_required
    @permission_required("admin")
    def list_bug_reports():
        status_filter = request.args.get("status", "")
        severity_filter = request.args.get("severity", "")

        q = BugReport.query
        if status_filter:
            q = q.filter(BugReport.status == status_filter)
        if severity_filter:
            q = q.filter(BugReport.severity == severity_filter)

        reports = q.order_by(BugReport.created_at.desc()).all()
        return jsonify([r.to_dict() for r in reports])

    @app.route("/api/bug-reports", methods=["POST"])
    @jwt_required
    def create_bug_report():
        user_id = request.current_user.id
        data = request.get_json() or {}

        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()
        if not title or not description:
            return jsonify({"error": "title and description are required"}), 400

        severity = data.get("severity", "medium")
        if severity not in ("low", "medium", "high", "critical"):
            severity = "medium"

        report = BugReport(
            title=title,
            description=description,
            severity=severity,
            status="open",
            page_context=data.get("page_context", "").strip() or None,
            steps_to_reproduce=(data.get("steps_to_reproduce") or "").strip() or None,
            reported_by_id=user_id,
        )
        db.session.add(report)
        db.session.commit()

        _try_create_github_issue(report)

        return jsonify(report.to_dict()), 201

    @app.route("/api/bug-reports/<int:report_id>", methods=["PUT"])
    @jwt_required
    @permission_required("admin")
    def update_bug_report(report_id):
        report = BugReport.query.get_or_404(report_id)
        data = request.get_json() or {}

        if "status" in data:
            new_status = data["status"]
            if new_status not in ("open", "in_progress", "resolved", "closed"):
                return jsonify({"error": "Invalid status"}), 400
            report.status = new_status
            if new_status in ("resolved", "closed") and not report.resolved_at:
                report.resolved_at = get_current_time()
            elif new_status in ("open", "in_progress"):
                report.resolved_at = None

        if "severity" in data:
            if data["severity"] not in ("low", "medium", "high", "critical"):
                return jsonify({"error": "Invalid severity"}), 400
            report.severity = data["severity"]

        if "resolution_notes" in data:
            report.resolution_notes = (data["resolution_notes"] or "").strip() or None

        if "title" in data:
            report.title = data["title"].strip()

        report.updated_at = get_current_time()
        db.session.commit()
        return jsonify(report.to_dict())

    @app.route("/api/bug-reports/<int:report_id>", methods=["DELETE"])
    @jwt_required
    @permission_required("admin")
    def delete_bug_report(report_id):
        report = BugReport.query.get_or_404(report_id)
        db.session.delete(report)
        db.session.commit()
        return jsonify({"message": "Bug report deleted"})
