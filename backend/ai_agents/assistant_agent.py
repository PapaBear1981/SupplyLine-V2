"""
User Assistant Agent

Helps users with daily tasks through natural language interaction:
- Inventory queries (tools, chemicals, kits)
- Order and request status lookups
- Checkout history and suggestions
- Workflow guidance and task recommendations
- Quick data lookups and summaries
"""

import json
import logging
from datetime import datetime, timedelta

from ai_agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class UserAssistantAgent(BaseAgent):
    """AI assistant that helps users with daily MRO tasks."""

    def __init__(self):
        super().__init__(
            name="user_assistant",
            agent_type="assistant",
            description="Helps users with inventory queries, order lookups, task guidance, "
                        "and daily workflow assistance through natural language.",
            interval=300,  # Background cycle every 5 minutes (mostly chat-driven)
        )
        self._command_handlers = {
            "tool": self._handle_tool_query,
            "chemical": self._handle_chemical_query,
            "kit": self._handle_kit_query,
            "order": self._handle_order_query,
            "request": self._handle_request_query,
            "checkout": self._handle_checkout_query,
            "help": self._handle_help,
            "summary": self._handle_summary,
            "search": self._handle_search,
        }

    def run_cycle(self):
        """Background cycle - generate proactive insights."""
        self._check_pending_calibrations()
        self._check_low_stock_chemicals()

    def handle_message(self, user_id: int, message: str, conversation_id: int | None = None) -> dict:
        """Process a user message and return a helpful response."""
        msg_lower = message.lower().strip()

        # Route to specific handler based on keywords
        for keyword, handler in self._command_handlers.items():
            if keyword in msg_lower:
                try:
                    return handler(user_id, msg_lower)
                except Exception as e:
                    logger.error("Handler error for '%s': %s", keyword, e)
                    return {"response": f"Sorry, I encountered an error processing your request: {e}",
                            "message_type": "text"}

        # Default: provide general help
        return self._handle_general(user_id, msg_lower)

    def _handle_tool_query(self, user_id: int, message: str) -> dict:
        """Handle tool-related queries."""
        from models import Tool, Checkout

        if any(w in message for w in ["available", "free", "not checked out"]):
            tools = Tool.query.filter_by(status="available").limit(20).all()
            if not tools:
                return {"response": "No tools are currently available.", "message_type": "text"}
            lines = ["**Available Tools:**\n"]
            for t in tools[:15]:
                lines.append(f"- **{t.tool_number}** - {t.description or 'No description'} ({t.location or 'Unknown'})")
            if len(tools) > 15:
                lines.append(f"\n...and {len(tools) - 15} more.")
            return {"response": "\n".join(lines), "message_type": "text"}

        elif any(w in message for w in ["overdue", "calibration", "due"]):
            tools = Tool.query.filter(
                Tool.requires_calibration.is_(True),
                Tool.calibration_status.in_(["overdue", "due_soon"]),
            ).all()
            if not tools:
                return {"response": "No tools with overdue or upcoming calibrations.", "message_type": "text"}
            lines = ["**Tools Needing Calibration:**\n"]
            for t in tools[:15]:
                lines.append(f"- **{t.tool_number}** - Status: {t.calibration_status} "
                             f"(Next due: {t.next_calibration_date.strftime('%Y-%m-%d') if t.next_calibration_date else 'N/A'})")
            return {"response": "\n".join(lines), "message_type": "text"}

        elif any(w in message for w in ["count", "total", "how many"]):
            total = Tool.query.count()
            available = Tool.query.filter_by(status="available").count()
            checked_out = Tool.query.filter_by(status="checked_out").count()
            maintenance = Tool.query.filter_by(status="maintenance").count()
            return {
                "response": f"**Tool Inventory Summary:**\n"
                            f"- Total: {total}\n- Available: {available}\n"
                            f"- Checked Out: {checked_out}\n- In Maintenance: {maintenance}",
                "message_type": "text",
            }

        else:
            # General tool search
            total = Tool.query.count()
            available = Tool.query.filter_by(status="available").count()
            return {
                "response": f"I can help with tool queries. We have {total} tools total ({available} available).\n\n"
                            "Try asking:\n"
                            "- 'Show available tools'\n"
                            "- 'Tools needing calibration'\n"
                            "- 'How many tools are checked out?'",
                "message_type": "suggestion",
            }

    def _handle_chemical_query(self, user_id: int, message: str) -> dict:
        """Handle chemical inventory queries."""
        from models import Chemical

        if any(w in message for w in ["low", "stock", "reorder", "running out"]):
            chemicals = Chemical.query.filter(
                Chemical.quantity <= Chemical.minimum_quantity
            ).all()
            if not chemicals:
                return {"response": "All chemicals are above minimum stock levels.", "message_type": "text"}
            lines = ["**Low Stock Chemicals:**\n"]
            for c in chemicals[:15]:
                lines.append(f"- **{c.name}** - Qty: {c.quantity} (Min: {c.minimum_quantity})")
            return {"response": "\n".join(lines), "message_type": "text"}

        elif any(w in message for w in ["expired", "expiring", "expiration"]):
            now = datetime.now()
            soon = now + timedelta(days=30)
            chemicals = Chemical.query.filter(
                Chemical.expiration_date.isnot(None),
                Chemical.expiration_date <= soon,
            ).all()
            if not chemicals:
                return {"response": "No chemicals expiring within 30 days.", "message_type": "text"}
            lines = ["**Chemicals Expiring Soon:**\n"]
            for c in chemicals[:15]:
                exp = c.expiration_date.strftime("%Y-%m-%d") if c.expiration_date else "N/A"
                status = "EXPIRED" if c.expiration_date and c.expiration_date < now else "expiring soon"
                lines.append(f"- **{c.name}** ({c.part_number or 'N/A'}) - Expires: {exp} [{status}]")
            return {"response": "\n".join(lines), "message_type": "text"}

        else:
            total = Chemical.query.count()
            return {
                "response": f"Chemical inventory has {total} items.\n\n"
                            "Try asking:\n"
                            "- 'Low stock chemicals'\n"
                            "- 'Expiring chemicals'\n"
                            "- 'Chemical count'",
                "message_type": "suggestion",
            }

    def _handle_kit_query(self, user_id: int, message: str) -> dict:
        """Handle kit-related queries."""
        from models_kits import Kit

        kits = Kit.query.all()
        if not kits:
            return {"response": "No kits found in the system.", "message_type": "text"}

        if any(w in message for w in ["all", "list", "show"]):
            lines = ["**Mobile Warehouse Kits:**\n"]
            for k in kits[:20]:
                lines.append(f"- **{k.kit_number}** - {k.description or 'No description'} (Status: {k.status})")
            return {"response": "\n".join(lines), "message_type": "text"}

        return {
            "response": f"There are {len(kits)} kits in the system.\n\n"
                        "Try asking:\n- 'List all kits'\n- 'Kit status'",
            "message_type": "suggestion",
        }

    def _handle_order_query(self, user_id: int, message: str) -> dict:
        """Handle procurement order queries."""
        from models import ProcurementOrder

        if any(w in message for w in ["pending", "waiting", "open"]):
            orders = ProcurementOrder.query.filter(
                ProcurementOrder.status.in_(["pending", "submitted", "in_review"])
            ).all()
            if not orders:
                return {"response": "No pending orders.", "message_type": "text"}
            lines = ["**Pending Orders:**\n"]
            for o in orders[:15]:
                lines.append(f"- Order #{o.id} - Status: {o.status} (Created: "
                             f"{o.created_at.strftime('%Y-%m-%d') if o.created_at else 'N/A'})")
            return {"response": "\n".join(lines), "message_type": "text"}

        total = ProcurementOrder.query.count()
        return {
            "response": f"There are {total} procurement orders.\n\nTry: 'Show pending orders'",
            "message_type": "suggestion",
        }

    def _handle_request_query(self, user_id: int, message: str) -> dict:
        """Handle user request queries."""
        from models import UserRequest

        if any(w in message for w in ["my", "mine"]):
            requests = UserRequest.query.filter_by(user_id=user_id).order_by(
                UserRequest.created_at.desc()
            ).limit(10).all()
            if not requests:
                return {"response": "You have no requests.", "message_type": "text"}
            lines = ["**Your Recent Requests:**\n"]
            for r in requests:
                lines.append(f"- Request #{r.id} - {r.request_type}: {r.status}")
            return {"response": "\n".join(lines), "message_type": "text"}

        total = UserRequest.query.count()
        return {"response": f"There are {total} total requests. Try 'Show my requests'.", "message_type": "suggestion"}

    def _handle_checkout_query(self, user_id: int, message: str) -> dict:
        """Handle checkout-related queries."""
        from models import Checkout

        if any(w in message for w in ["my", "mine", "i have"]):
            checkouts = Checkout.query.filter_by(
                user_id=user_id, checked_in_at=None
            ).all()
            if not checkouts:
                return {"response": "You have no active checkouts.", "message_type": "text"}
            lines = ["**Your Active Checkouts:**\n"]
            for c in checkouts:
                tool_num = c.tool.tool_number if c.tool else "Unknown"
                lines.append(f"- **{tool_num}** - Checked out: "
                             f"{c.checked_out_at.strftime('%Y-%m-%d %H:%M') if c.checked_out_at else 'N/A'}")
            return {"response": "\n".join(lines), "message_type": "text"}

        active = Checkout.query.filter_by(checked_in_at=None).count()
        return {
            "response": f"There are {active} active checkouts system-wide.\n\nTry: 'Show my checkouts'",
            "message_type": "suggestion",
        }

    def _handle_help(self, user_id: int, message: str) -> dict:
        """Provide help information."""
        return {
            "response": (
                "**SupplyLine AI Assistant**\n\n"
                "I can help you with:\n\n"
                "**Inventory:**\n"
                "- 'Show available tools'\n"
                "- 'Low stock chemicals'\n"
                "- 'Expiring chemicals'\n"
                "- 'List kits'\n\n"
                "**Orders & Requests:**\n"
                "- 'Pending orders'\n"
                "- 'My requests'\n\n"
                "**Checkouts:**\n"
                "- 'My checkouts'\n\n"
                "**System:**\n"
                "- 'System summary'\n"
                "- 'Search [term]'\n\n"
                "Just type your question and I'll do my best to help!"
            ),
            "message_type": "text",
        }

    def _handle_summary(self, user_id: int, message: str) -> dict:
        """Provide a system-wide summary."""
        from models import Tool, Chemical, Checkout, ProcurementOrder, User

        tools = Tool.query.count()
        available_tools = Tool.query.filter_by(status="available").count()
        chemicals = Chemical.query.count()
        active_checkouts = Checkout.query.filter_by(checked_in_at=None).count()
        pending_orders = ProcurementOrder.query.filter(
            ProcurementOrder.status.in_(["pending", "submitted"])
        ).count()
        users = User.query.filter_by(is_active=True).count()

        return {
            "response": (
                "**SupplyLine System Summary**\n\n"
                f"- **Tools:** {tools} total ({available_tools} available)\n"
                f"- **Chemicals:** {chemicals} items\n"
                f"- **Active Checkouts:** {active_checkouts}\n"
                f"- **Pending Orders:** {pending_orders}\n"
                f"- **Active Users:** {users}\n"
            ),
            "message_type": "text",
        }

    def _handle_search(self, user_id: int, message: str) -> dict:
        """Handle general search queries."""
        from models import Tool, Chemical

        # Extract search term
        search_term = message.replace("search", "").strip()
        if len(search_term) < 2:
            return {"response": "Please provide a search term (at least 2 characters).", "message_type": "text"}

        results = []
        pattern = f"%{search_term}%"

        # Search tools
        tools = Tool.query.filter(
            (Tool.tool_number.ilike(pattern))
            | (Tool.description.ilike(pattern))
            | (Tool.serial_number.ilike(pattern))
        ).limit(5).all()
        for t in tools:
            results.append(f"- **Tool** {t.tool_number}: {t.description or 'N/A'} [{t.status}]")

        # Search chemicals
        chemicals = Chemical.query.filter(
            (Chemical.name.ilike(pattern))
            | (Chemical.part_number.ilike(pattern))
        ).limit(5).all()
        for c in chemicals:
            results.append(f"- **Chemical** {c.name}: Qty {c.quantity}")

        if not results:
            return {"response": f"No results found for '{search_term}'.", "message_type": "text"}

        header = f"**Search Results for '{search_term}':**\n\n"
        return {"response": header + "\n".join(results), "message_type": "text"}

    def _handle_general(self, user_id: int, message: str) -> dict:
        """Handle messages that don't match specific patterns."""
        # Check for greetings
        if any(w in message for w in ["hello", "hi", "hey", "good morning", "good afternoon"]):
            from models import User
            user = User.query.get(user_id)
            name = user.name if user else "there"
            return {
                "response": f"Hello, {name}! I'm your SupplyLine AI assistant. "
                            "How can I help you today? Type 'help' to see what I can do.",
                "message_type": "text",
            }

        # Check for thanks
        if any(w in message for w in ["thank", "thanks", "thx"]):
            return {"response": "You're welcome! Let me know if you need anything else.", "message_type": "text"}

        # Default
        return {
            "response": "I'm not sure I understand. Try asking about tools, chemicals, orders, "
                        "or type 'help' to see all available commands.",
            "message_type": "suggestion",
        }

    def _check_pending_calibrations(self):
        """Proactively check for tools needing calibration."""
        try:
            from models import Tool

            overdue = Tool.query.filter(
                Tool.requires_calibration.is_(True),
                Tool.calibration_status == "overdue",
            ).count()

            if overdue > 0:
                self.create_alert(
                    severity="warning",
                    category="maintenance",
                    title=f"{overdue} Tools Overdue for Calibration",
                    description=f"There are {overdue} tools that are overdue for calibration. "
                                "These should be addressed to maintain compliance.",
                    details={"overdue_count": overdue},
                )
        except Exception as e:
            logger.debug("Calibration check error: %s", e)

    def _check_low_stock_chemicals(self):
        """Proactively check for low stock chemicals."""
        try:
            from models import Chemical

            low_stock = Chemical.query.filter(
                Chemical.quantity <= Chemical.minimum_quantity
            ).count()

            if low_stock > 0:
                self.create_alert(
                    severity="info",
                    category="inventory",
                    title=f"{low_stock} Chemicals Below Minimum Stock",
                    description=f"{low_stock} chemicals are at or below minimum stock levels. "
                                "Consider placing reorder requests.",
                    details={"low_stock_count": low_stock},
                )
        except Exception as e:
            logger.debug("Low stock check error: %s", e)
