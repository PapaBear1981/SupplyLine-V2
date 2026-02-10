"""
Analytics Agent

Provides intelligent analytics and anomaly detection:
- Usage pattern analysis for tools and chemicals
- Predictive insights (reorder timing, demand forecasting)
- Anomaly detection for unusual activity
- Performance trend analysis
- Automated report generation
"""

import json
import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from ai_agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    """Provides intelligent analytics, trend detection, and anomaly alerting."""

    def __init__(self):
        super().__init__(
            name="analytics",
            agent_type="analytics",
            description="Intelligent analytics agent that detects usage patterns, anomalies, "
                        "and provides predictive insights for inventory and operations.",
            interval=300,  # Run every 5 minutes
        )
        self._baseline_metrics = {}
        self._anomaly_threshold = 2.0  # Standard deviations for anomaly

    def run_cycle(self):
        """Run analytics cycle."""
        self._analyze_checkout_patterns()
        self._analyze_chemical_usage()
        self._detect_usage_anomalies()
        self._record_operational_metrics()

    def _analyze_checkout_patterns(self):
        """Analyze tool checkout patterns for insights."""
        try:
            from models import Checkout, Tool, db
            from sqlalchemy import func

            now = datetime.now()
            week_ago = now - timedelta(days=7)

            # Get checkout counts by tool for the past week
            weekly_checkouts = (
                db.session.query(
                    Checkout.tool_id,
                    func.count(Checkout.id).label("count"),
                )
                .filter(Checkout.checked_out_at >= week_ago)
                .group_by(Checkout.tool_id)
                .all()
            )

            total_checkouts = sum(c.count for c in weekly_checkouts)
            self.record_metric("weekly_checkouts", total_checkouts, unit="count", category="analytics")

            # Find most used tools
            if weekly_checkouts:
                top_tools = sorted(weekly_checkouts, key=lambda x: x.count, reverse=True)[:5]
                for rank, item in enumerate(top_tools, 1):
                    tool = Tool.query.get(item.tool_id)
                    if tool:
                        self.record_metric(
                            f"top_tool_{rank}_checkouts",
                            item.count,
                            unit="count",
                            category="analytics",
                            tags={"tool_number": tool.tool_number, "tool_id": tool.id},
                        )

            # Detect tools with unusually high checkout rates
            if len(weekly_checkouts) > 5:
                counts = [c.count for c in weekly_checkouts]
                avg = sum(counts) / len(counts)
                for item in weekly_checkouts:
                    if item.count > avg * 3 and item.count > 10:  # 3x average and at least 10
                        tool = Tool.query.get(item.tool_id)
                        if tool:
                            self.create_alert(
                                severity="info",
                                category="inventory",
                                title=f"High Demand Tool: {tool.tool_number}",
                                description=f"Tool {tool.tool_number} has been checked out "
                                            f"{item.count} times this week (avg: {round(avg, 1)}). "
                                            f"Consider procuring additional units.",
                                details={"tool_id": tool.id, "checkout_count": item.count, "average": round(avg, 1)},
                            )

        except Exception as e:
            logger.debug("Checkout pattern analysis failed: %s", e)

    def _analyze_chemical_usage(self):
        """Analyze chemical consumption patterns."""
        try:
            from models import Chemical, ChemicalIssuance, db
            from sqlalchemy import func

            now = datetime.now()
            month_ago = now - timedelta(days=30)

            # Get chemical issuance rates
            monthly_usage = (
                db.session.query(
                    ChemicalIssuance.chemical_id,
                    func.count(ChemicalIssuance.id).label("issuance_count"),
                    func.sum(ChemicalIssuance.quantity_issued).label("total_issued"),
                )
                .filter(ChemicalIssuance.issued_at >= month_ago)
                .group_by(ChemicalIssuance.chemical_id)
                .all()
            )

            for usage in monthly_usage:
                chemical = Chemical.query.get(usage.chemical_id)
                if not chemical:
                    continue

                total_issued = usage.total_issued or 0

                # Check if current stock will run out based on usage rate
                if total_issued > 0 and chemical.quantity > 0:
                    daily_rate = total_issued / 30
                    days_remaining = chemical.quantity / daily_rate if daily_rate > 0 else float("inf")

                    self.record_metric(
                        "chemical_days_remaining",
                        round(days_remaining, 1),
                        unit="days",
                        category="analytics",
                        tags={"chemical_id": chemical.id, "chemical_name": chemical.name},
                    )

                    if days_remaining < 14:
                        self.create_alert(
                            severity="warning",
                            category="inventory",
                            title=f"Chemical Running Low: {chemical.name}",
                            description=f"At current usage rate ({round(daily_rate, 1)}/day), "
                                        f"{chemical.name} will be depleted in ~{round(days_remaining)} days. "
                                        f"Current stock: {chemical.quantity}.",
                            details={
                                "chemical_id": chemical.id,
                                "daily_rate": round(daily_rate, 2),
                                "days_remaining": round(days_remaining, 1),
                                "current_quantity": chemical.quantity,
                            },
                        )

        except Exception as e:
            logger.debug("Chemical usage analysis failed: %s", e)

    def _detect_usage_anomalies(self):
        """Detect unusual patterns that may indicate issues."""
        try:
            from models import Checkout, AuditLog, db
            from sqlalchemy import func

            now = datetime.now()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            # Check for unusually high checkout volume today
            today_checkouts = Checkout.query.filter(
                Checkout.checked_out_at >= today_start
            ).count()

            # Get average daily checkouts from last 30 days
            month_ago = now - timedelta(days=30)
            total_month = Checkout.query.filter(
                Checkout.checked_out_at >= month_ago,
                Checkout.checked_out_at < today_start,
            ).count()
            avg_daily = total_month / 30 if total_month > 0 else 0

            self.record_metric("daily_checkouts", today_checkouts, unit="count", category="analytics")
            self.record_metric("avg_daily_checkouts", round(avg_daily, 1), unit="count", category="analytics")

            if avg_daily > 0 and today_checkouts > avg_daily * self._anomaly_threshold and today_checkouts > 10:
                self.create_alert(
                    severity="info",
                    category="inventory",
                    title="Unusual Checkout Volume",
                    description=f"Today's checkout count ({today_checkouts}) is significantly "
                                f"above the 30-day average ({round(avg_daily, 1)}).",
                    details={
                        "today_count": today_checkouts,
                        "avg_daily": round(avg_daily, 1),
                        "ratio": round(today_checkouts / avg_daily, 1) if avg_daily > 0 else 0,
                    },
                )

            # Check for after-hours activity
            if now.hour < 6 or now.hour > 22:
                recent_activity = AuditLog.query.filter(
                    AuditLog.timestamp >= now - timedelta(minutes=30)
                ).count()

                if recent_activity > 5:
                    self.create_alert(
                        severity="warning",
                        category="security",
                        title="After-Hours Activity Detected",
                        description=f"{recent_activity} actions detected in the last 30 minutes "
                                    f"during off-hours ({now.strftime('%H:%M')}).",
                        details={"activity_count": recent_activity, "time": now.isoformat()},
                    )

        except Exception as e:
            logger.debug("Anomaly detection failed: %s", e)

    def _record_operational_metrics(self):
        """Record high-level operational metrics."""
        try:
            from models import Tool, Chemical, Checkout, User, ProcurementOrder, db

            self.record_metric("total_tools", Tool.query.count(), unit="count", category="analytics")
            self.record_metric(
                "available_tools", Tool.query.filter_by(status="available").count(),
                unit="count", category="analytics"
            )
            self.record_metric("total_chemicals", Chemical.query.count(), unit="count", category="analytics")
            self.record_metric(
                "active_checkouts", Checkout.query.filter_by(checked_in_at=None).count(),
                unit="count", category="analytics"
            )
            self.record_metric(
                "active_users", User.query.filter_by(is_active=True).count(),
                unit="count", category="analytics"
            )

        except Exception as e:
            logger.debug("Operational metrics recording failed: %s", e)

    def handle_message(self, user_id: int, message: str, conversation_id: int | None = None) -> dict:
        """Respond to analytics queries."""
        msg_lower = message.lower()

        if any(w in msg_lower for w in ["trend", "pattern", "usage"]):
            return self._get_usage_trends()
        elif any(w in msg_lower for w in ["anomal", "unusual", "strange", "odd"]):
            return self._get_anomaly_report()
        elif any(w in msg_lower for w in ["predict", "forecast", "when will"]):
            return self._get_predictions()
        elif any(w in msg_lower for w in ["top", "most used", "popular", "busiest"]):
            return self._get_top_items()
        elif any(w in msg_lower for w in ["report", "summary", "overview"]):
            return self._get_analytics_report()
        else:
            return {
                "response": (
                    "**Analytics Agent**\n\n"
                    "I provide data-driven insights. Try:\n"
                    "- 'Show usage trends'\n"
                    "- 'Any anomalies detected?'\n"
                    "- 'Top used tools'\n"
                    "- 'Analytics report'\n"
                    "- 'Inventory predictions'"
                ),
                "message_type": "text",
            }

    def _get_usage_trends(self) -> dict:
        """Return usage trend analysis."""
        try:
            from models import Checkout, ChemicalIssuance, db
            from sqlalchemy import func

            now = datetime.now()
            periods = [
                ("Today", now.replace(hour=0, minute=0, second=0, microsecond=0)),
                ("This Week", now - timedelta(days=7)),
                ("This Month", now - timedelta(days=30)),
            ]

            lines = ["**Usage Trends:**\n"]
            for label, start in periods:
                checkouts = Checkout.query.filter(Checkout.checked_out_at >= start).count()
                issuances = ChemicalIssuance.query.filter(ChemicalIssuance.issued_at >= start).count()
                lines.append(f"**{label}:**")
                lines.append(f"  - Tool Checkouts: {checkouts}")
                lines.append(f"  - Chemical Issuances: {issuances}")

            return {"response": "\n".join(lines), "message_type": "text"}
        except Exception as e:
            return {"response": f"Error generating trends: {e}", "message_type": "text"}

    def _get_anomaly_report(self) -> dict:
        """Report detected anomalies."""
        try:
            from models_ai import AIAlert

            anomalies = AIAlert.query.filter(
                AIAlert.category.in_(["security", "inventory"]),
                AIAlert.status == "active",
            ).order_by(AIAlert.created_at.desc()).limit(10).all()

            if not anomalies:
                return {"response": "No anomalies detected. Operations are within normal parameters.",
                        "message_type": "text"}

            lines = ["**Detected Anomalies:**\n"]
            for a in anomalies:
                lines.append(f"- [{a.severity.upper()}] {a.title}")
                lines.append(f"  {a.description[:150]}")

            return {"response": "\n".join(lines), "message_type": "text"}
        except Exception as e:
            return {"response": f"Error fetching anomalies: {e}", "message_type": "text"}

    def _get_predictions(self) -> dict:
        """Generate predictive insights."""
        try:
            from models import Chemical
            from models_ai import AIMetric

            lines = ["**Inventory Predictions:**\n"]

            # Find chemicals with days_remaining metrics
            metrics = AIMetric.query.filter(
                AIMetric.metric_name == "chemical_days_remaining"
            ).order_by(AIMetric.recorded_at.desc()).limit(20).all()

            seen_chemicals = set()
            for m in metrics:
                if m.tags_json:
                    tags = json.loads(m.tags_json)
                    chem_name = tags.get("chemical_name", "Unknown")
                    if chem_name not in seen_chemicals:
                        seen_chemicals.add(chem_name)
                        days = round(m.metric_value, 1)
                        urgency = "URGENT" if days < 7 else "Soon" if days < 14 else "OK"
                        lines.append(f"- **{chem_name}**: ~{days} days remaining [{urgency}]")

            if len(lines) == 1:
                lines.append("No prediction data available yet. Analytics need more data to generate forecasts.")

            return {"response": "\n".join(lines), "message_type": "text"}
        except Exception as e:
            return {"response": f"Error generating predictions: {e}", "message_type": "text"}

    def _get_top_items(self) -> dict:
        """Get most frequently used tools and chemicals."""
        try:
            from models import Checkout, ChemicalIssuance, Tool, Chemical, db
            from sqlalchemy import func

            month_ago = datetime.now() - timedelta(days=30)

            # Top tools
            top_tools = (
                db.session.query(
                    Checkout.tool_id,
                    func.count(Checkout.id).label("count"),
                )
                .filter(Checkout.checked_out_at >= month_ago)
                .group_by(Checkout.tool_id)
                .order_by(func.count(Checkout.id).desc())
                .limit(5)
                .all()
            )

            lines = ["**Most Used (Last 30 Days):**\n", "**Tools:**"]
            for item in top_tools:
                tool = Tool.query.get(item.tool_id)
                if tool:
                    lines.append(f"  {item.count}x - {tool.tool_number} ({tool.description or 'N/A'})")

            # Top chemicals
            top_chems = (
                db.session.query(
                    ChemicalIssuance.chemical_id,
                    func.count(ChemicalIssuance.id).label("count"),
                )
                .filter(ChemicalIssuance.issued_at >= month_ago)
                .group_by(ChemicalIssuance.chemical_id)
                .order_by(func.count(ChemicalIssuance.id).desc())
                .limit(5)
                .all()
            )

            lines.append("\n**Chemicals:**")
            for item in top_chems:
                chem = Chemical.query.get(item.chemical_id)
                if chem:
                    lines.append(f"  {item.count}x - {chem.name}")

            if len(top_tools) == 0 and len(top_chems) == 0:
                return {"response": "Not enough usage data for the last 30 days.", "message_type": "text"}

            return {"response": "\n".join(lines), "message_type": "text"}
        except Exception as e:
            return {"response": f"Error fetching top items: {e}", "message_type": "text"}

    def _get_analytics_report(self) -> dict:
        """Generate a comprehensive analytics report."""
        try:
            from models import Tool, Chemical, Checkout, ProcurementOrder, User
            from models_ai import AIAlert, AIMetric

            now = datetime.now()
            week_ago = now - timedelta(days=7)

            total_tools = Tool.query.count()
            available_tools = Tool.query.filter_by(status="available").count()
            total_chemicals = Chemical.query.count()
            active_checkouts = Checkout.query.filter_by(checked_in_at=None).count()
            weekly_checkouts = Checkout.query.filter(Checkout.checked_out_at >= week_ago).count()
            pending_orders = ProcurementOrder.query.filter(
                ProcurementOrder.status.in_(["pending", "submitted"])
            ).count()
            active_alerts = AIAlert.query.filter_by(status="active").count()
            active_users = User.query.filter_by(is_active=True).count()

            report = (
                "**SupplyLine Analytics Report**\n"
                f"*Generated: {now.strftime('%Y-%m-%d %H:%M')}*\n\n"
                "**Inventory:**\n"
                f"- Tools: {total_tools} total, {available_tools} available\n"
                f"- Chemicals: {total_chemicals} items\n"
                f"- Active Checkouts: {active_checkouts}\n\n"
                "**Activity (Last 7 Days):**\n"
                f"- Checkouts: {weekly_checkouts}\n\n"
                "**Operations:**\n"
                f"- Pending Orders: {pending_orders}\n"
                f"- Active Users: {active_users}\n"
                f"- Active Alerts: {active_alerts}\n"
            )

            # Overall health
            health = "Good" if active_alerts == 0 else "Needs Attention" if active_alerts < 5 else "Critical"
            report += f"\n**Overall Health: {health}**"

            return {"response": report, "message_type": "text"}
        except Exception as e:
            return {"response": f"Error generating report: {e}", "message_type": "text"}
