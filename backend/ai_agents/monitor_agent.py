"""
System Monitor Agent

Continuously monitors application health, system resources, and operational metrics.
Acts as a 24/7 system administrator for the SupplyLine application:
- Tracks CPU, memory, disk usage
- Monitors API response times and error rates
- Detects database connection issues
- Watches for application errors and crash patterns
- Sends real-time alerts when thresholds are exceeded
"""

import json
import logging
import time
from datetime import datetime, timedelta

import psutil

from ai_agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class SystemMonitorAgent(BaseAgent):
    """Monitors system health and application performance in real-time."""

    def __init__(self):
        super().__init__(
            name="system_monitor",
            agent_type="monitor",
            description="24/7 system monitoring agent that tracks application health, "
                        "performance metrics, and resource usage. Alerts on anomalies.",
            interval=30,  # Check every 30 seconds
        )
        self._error_counts = {}  # Track error frequency
        self._last_metrics = {}
        self._consecutive_high_cpu = 0
        self._consecutive_high_memory = 0
        self._thresholds = {
            "cpu_warning": 75,
            "cpu_critical": 90,
            "memory_warning": 80,
            "memory_critical": 95,
            "disk_warning": 85,
            "disk_critical": 95,
            "api_error_rate_warning": 5,  # errors per minute
            "api_error_rate_critical": 20,
            "response_time_warning": 2000,  # ms
            "response_time_critical": 5000,
            "db_connection_warning": 8,
            "db_connection_critical": 15,
        }

    def run_cycle(self):
        """Execute one monitoring cycle."""
        self._check_system_resources()
        self._check_application_health()
        self._check_database_health()
        self._check_error_rates()
        self._cleanup_old_metrics()

    def _check_system_resources(self):
        """Monitor CPU, memory, and disk usage."""
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        self.record_metric("cpu_usage", cpu_percent, unit="percent", category="system")

        if cpu_percent > self._thresholds["cpu_critical"]:
            self._consecutive_high_cpu += 1
            if self._consecutive_high_cpu >= 3:  # Sustained high CPU
                self.create_alert(
                    severity="critical",
                    category="performance",
                    title="Critical CPU Usage",
                    description=f"CPU usage has been above {self._thresholds['cpu_critical']}% "
                                f"for {self._consecutive_high_cpu} consecutive checks ({cpu_percent}% current).",
                    details={"cpu_percent": cpu_percent, "consecutive_checks": self._consecutive_high_cpu},
                )
        elif cpu_percent > self._thresholds["cpu_warning"]:
            self._consecutive_high_cpu += 1
            if self._consecutive_high_cpu >= 5:
                self.create_alert(
                    severity="warning",
                    category="performance",
                    title="Elevated CPU Usage",
                    description=f"CPU usage at {cpu_percent}% for {self._consecutive_high_cpu} checks.",
                    details={"cpu_percent": cpu_percent},
                )
        else:
            self._consecutive_high_cpu = 0

        # Memory
        memory = psutil.virtual_memory()
        self.record_metric("memory_usage", memory.percent, unit="percent", category="system")
        self.record_metric("memory_available_mb", round(memory.available / (1024 * 1024), 1),
                           unit="MB", category="system")

        if memory.percent > self._thresholds["memory_critical"]:
            self._consecutive_high_memory += 1
            if self._consecutive_high_memory >= 2:
                self.create_alert(
                    severity="critical",
                    category="performance",
                    title="Critical Memory Usage",
                    description=f"Memory usage at {memory.percent}%. "
                                f"Available: {round(memory.available / (1024 * 1024))}MB",
                    details={
                        "memory_percent": memory.percent,
                        "available_mb": round(memory.available / (1024 * 1024)),
                        "total_mb": round(memory.total / (1024 * 1024)),
                    },
                )
                self.log_action(
                    action_type="auto_remediation",
                    description="Triggering garbage collection due to high memory usage",
                    target="system_memory",
                    result="success",
                )
                import gc
                gc.collect()
        elif memory.percent > self._thresholds["memory_warning"]:
            self._consecutive_high_memory += 1
        else:
            self._consecutive_high_memory = 0

        # Disk
        try:
            import os
            disk_path = "/" if os.name != "nt" else os.path.splitdrive(os.getcwd())[0] + os.sep
            disk = psutil.disk_usage(disk_path)
            self.record_metric("disk_usage", disk.percent, unit="percent", category="system")

            if disk.percent > self._thresholds["disk_critical"]:
                self.create_alert(
                    severity="critical",
                    category="performance",
                    title="Critical Disk Space",
                    description=f"Disk usage at {disk.percent}%. "
                                f"Free: {round(disk.free / (1024 * 1024 * 1024), 1)}GB",
                    details={
                        "disk_percent": disk.percent,
                        "free_gb": round(disk.free / (1024 * 1024 * 1024), 1),
                    },
                )
            elif disk.percent > self._thresholds["disk_warning"]:
                self.create_alert(
                    severity="warning",
                    category="performance",
                    title="Low Disk Space",
                    description=f"Disk usage at {disk.percent}%.",
                    details={"disk_percent": disk.percent},
                )
        except Exception as e:
            logger.debug("Disk check failed: %s", e)

    def _check_application_health(self):
        """Check application-level health indicators."""
        try:
            process = psutil.Process()

            # Open files
            open_files = len(process.open_files())
            self.record_metric("open_files", open_files, unit="count", category="application")

            if open_files > 500:
                self.create_alert(
                    severity="warning",
                    category="performance",
                    title="High Open File Count",
                    description=f"Application has {open_files} open files. This may indicate a file handle leak.",
                    details={"open_files": open_files},
                )

            # Thread count
            thread_count = process.num_threads()
            self.record_metric("thread_count", thread_count, unit="count", category="application")

            if thread_count > 100:
                self.create_alert(
                    severity="warning",
                    category="performance",
                    title="High Thread Count",
                    description=f"Application has {thread_count} threads. Possible thread leak.",
                    details={"thread_count": thread_count},
                )

            # Process memory
            process_memory = process.memory_info()
            rss_mb = round(process_memory.rss / (1024 * 1024), 1)
            self.record_metric("process_rss_mb", rss_mb, unit="MB", category="application")

        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            logger.debug("Process check failed: %s", e)

    def _check_database_health(self):
        """Check database connection health."""
        try:
            from models import db

            start = time.time()
            db.session.execute(db.text("SELECT 1"))
            query_time_ms = round((time.time() - start) * 1000, 2)
            self.record_metric("db_query_time", query_time_ms, unit="ms", category="database")

            if query_time_ms > 1000:
                self.create_alert(
                    severity="warning",
                    category="performance",
                    title="Slow Database Response",
                    description=f"Database health check took {query_time_ms}ms.",
                    details={"query_time_ms": query_time_ms},
                )

        except Exception as e:
            self.create_alert(
                severity="critical",
                category="error",
                title="Database Connection Failure",
                description=f"Cannot connect to database: {e}",
                details={"error": str(e)},
            )
            self.log_action(
                action_type="notification",
                description="Database connection failure detected - alerting administrators",
                target="database",
                result="success",
            )

    def _check_error_rates(self):
        """Analyze recent error logs to detect error rate spikes."""
        try:
            from models import db
            from models_ai import AIMetric

            # Count recent errors from metrics
            now = datetime.now()
            five_min_ago = now - timedelta(minutes=5)

            # Check recent API error metrics if recorded
            recent_errors = (
                AIMetric.query.filter(
                    AIMetric.metric_name == "api_error",
                    AIMetric.recorded_at >= five_min_ago,
                )
                .count()
            )

            self.record_metric("error_rate_5min", recent_errors, unit="count", category="application")

            if recent_errors > self._thresholds["api_error_rate_critical"]:
                self.create_alert(
                    severity="critical",
                    category="error",
                    title="High Error Rate",
                    description=f"{recent_errors} errors in the last 5 minutes.",
                    details={"error_count": recent_errors, "window_minutes": 5},
                )
            elif recent_errors > self._thresholds["api_error_rate_warning"]:
                self.create_alert(
                    severity="warning",
                    category="error",
                    title="Elevated Error Rate",
                    description=f"{recent_errors} errors in the last 5 minutes.",
                    details={"error_count": recent_errors, "window_minutes": 5},
                )
        except Exception as e:
            logger.debug("Error rate check failed: %s", e)

    def _cleanup_old_metrics(self):
        """Remove metrics older than 7 days to prevent database bloat."""
        try:
            from models import db
            from models_ai import AIMetric

            cutoff = datetime.now() - timedelta(days=7)
            deleted = AIMetric.query.filter(AIMetric.recorded_at < cutoff).delete()
            if deleted > 0:
                db.session.commit()
                logger.info("Cleaned up %d old metrics", deleted)
        except Exception as e:
            logger.debug("Metric cleanup failed: %s", e)

    def handle_message(self, user_id: int, message: str, conversation_id: int | None = None) -> dict:
        """Respond to user queries about system health."""
        msg_lower = message.lower()

        if any(word in msg_lower for word in ["status", "health", "how is", "system"]):
            return self._get_health_summary()
        elif any(word in msg_lower for word in ["cpu", "processor"]):
            cpu = psutil.cpu_percent(interval=1)
            return {"response": f"Current CPU usage is {cpu}%.", "message_type": "text"}
        elif any(word in msg_lower for word in ["memory", "ram"]):
            mem = psutil.virtual_memory()
            return {
                "response": f"Memory usage: {mem.percent}% ({round(mem.used / (1024**3), 1)}GB / "
                            f"{round(mem.total / (1024**3), 1)}GB)",
                "message_type": "text",
            }
        elif any(word in msg_lower for word in ["disk", "storage", "space"]):
            try:
                import os
                disk = psutil.disk_usage("/" if os.name != "nt" else "C:\\")
                return {
                    "response": f"Disk usage: {disk.percent}% ({round(disk.free / (1024**3), 1)}GB free)",
                    "message_type": "text",
                }
            except Exception:
                return {"response": "Unable to check disk usage.", "message_type": "text"}
        elif any(word in msg_lower for word in ["alert", "issue", "problem"]):
            return self._get_recent_alerts()
        else:
            return self._get_health_summary()

    def _get_health_summary(self) -> dict:
        """Generate a comprehensive health summary."""
        try:
            cpu = psutil.cpu_percent(interval=1)
            mem = psutil.virtual_memory()
            process = psutil.Process()

            summary = (
                f"**System Health Summary**\n\n"
                f"- **CPU:** {cpu}%\n"
                f"- **Memory:** {mem.percent}% ({round(mem.available / (1024**2))}MB available)\n"
                f"- **Threads:** {process.num_threads()}\n"
                f"- **Open Files:** {len(process.open_files())}\n"
                f"- **Process RSS:** {round(process.memory_info().rss / (1024**2))}MB\n"
            )

            try:
                import os
                disk = psutil.disk_usage("/" if os.name != "nt" else "C:\\")
                summary += f"- **Disk:** {disk.percent}% used ({round(disk.free / (1024**3), 1)}GB free)\n"
            except Exception:
                pass

            # Check for active alerts
            from models_ai import AIAlert
            active_alerts = AIAlert.query.filter_by(status="active").count()
            summary += f"\n**Active Alerts:** {active_alerts}"

            status = "healthy" if cpu < 75 and mem.percent < 80 and active_alerts == 0 else "needs attention"
            summary += f"\n**Overall Status:** {status}"

            return {"response": summary, "message_type": "text"}
        except Exception as e:
            return {"response": f"Error getting health summary: {e}", "message_type": "text"}

    def _get_recent_alerts(self) -> dict:
        """Get recent alerts for user display."""
        try:
            from models_ai import AIAlert
            alerts = AIAlert.query.filter_by(status="active").order_by(AIAlert.created_at.desc()).limit(10).all()

            if not alerts:
                return {"response": "No active alerts. All systems operating normally.", "message_type": "text"}

            lines = ["**Active Alerts:**\n"]
            for a in alerts:
                icon = {"critical": "[CRITICAL]", "warning": "[WARNING]", "info": "[INFO]"}.get(a.severity, "[?]")
                lines.append(f"- {icon} **{a.title}** - {a.description}")

            return {"response": "\n".join(lines), "message_type": "text"}
        except Exception as e:
            return {"response": f"Error fetching alerts: {e}", "message_type": "text"}
