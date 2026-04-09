"""AI assistant routes — settings management and provider-agnostic chat proxy with tool use."""

import json
import logging
from datetime import date, datetime, timedelta

import requests
from flask import jsonify, request
from sqlalchemy import or_

from auth import jwt_required, permission_required
from models import (
    AuditLog,
    Chemical,
    ChemicalIssuance,
    Checkout,
    ProcurementOrder,
    RequestItem,
    Tool,
    ToolHistory,
    User,
    UserActivity,
    UserRequest,
    db,
)
from models_kits import Kit, KitExpendable, KitItem, KitReorderRequest
from utils.transaction_helper import (
    record_chemical_issuance,
    record_tool_checkout,
    record_tool_return,
)

logger = logging.getLogger(__name__)

# ─── Setting keys ─────────────────────────────────────────────────────────────
AI_ENABLED_KEY  = "ai.enabled"
AI_PROVIDER_KEY = "ai.provider"
AI_API_KEY_KEY  = "ai.api_key"
AI_MODEL_KEY    = "ai.model"
AI_BASE_URL_KEY = "ai.base_url"

VALID_PROVIDERS = {"claude", "openai", "openrouter", "ollama"}

DEFAULT_MODELS = {
    "claude":     "claude-sonnet-4-6",
    "openai":     "gpt-4o",
    "openrouter": "openai/gpt-4o",
    "ollama":     "gemma3:4b",
}

DEFAULT_BASE_URLS = {
    "openrouter": "https://openrouter.ai",
    "ollama":     "http://localhost:11434",
}

MAX_TOOL_ITERATIONS = 5   # hard cap on agentic loop depth
MAX_RESULTS = 20          # cap all DB queries to keep responses concise


# ─── Tool definitions ─────────────────────────────────────────────────────────
# Kept intentionally flat and concise for compatibility with small local models
# (Gemma 4B, Phi-4, Mistral 7B, etc.).  No nested objects in parameter schemas.
# All parameters are optional — models that omit them get broad results.

TOOL_DEFINITIONS = [
    {
        "name": "search_tools",
        "description": (
            "Search the tool inventory by name, type, or serial/tool number. "
            "Use for questions like 'where are the torque wrenches' or 'is S/N 1234 available'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Tool name, type, or partial description. E.g. 'torque wrench' or '3/8 drive'.",
                },
                "serial_number": {
                    "type": "string",
                    "description": "Exact or partial serial number to look up.",
                },
                "tool_number": {
                    "type": "string",
                    "description": "Internal tool number to look up.",
                },
                "status": {
                    "type": "string",
                    "enum": ["available", "checked_out", "maintenance", "retired"],
                    "description": "Filter by tool status.",
                },
                "category": {
                    "type": "string",
                    "description": "Tool category to filter by.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_active_checkouts",
        "description": (
            "Return tools currently checked out (not yet returned). "
            "Use to answer 'who has X' or 'what does person Y have checked out'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "user_name": {
                    "type": "string",
                    "description": "Filter by user name (partial match).",
                },
                "tool_query": {
                    "type": "string",
                    "description": "Filter by tool name or description.",
                },
                "overdue_only": {
                    "type": "boolean",
                    "description": "If true, only return checkouts past their expected return date.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_calibration_status",
        "description": (
            "Return tools with calibration issues. "
            "Use for questions about overdue calibration or tools due for calibration soon."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "filter": {
                    "type": "string",
                    "enum": ["overdue", "due_soon", "all"],
                    "description": "Which tools to return: overdue, due within 30 days, or all requiring calibration.",
                },
                "days_ahead": {
                    "type": "integer",
                    "description": "For due_soon: days to look ahead (default 30).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "search_chemicals",
        "description": (
            "Search the chemical inventory by name, part number, or lot number. "
            "Can also find chemicals that are expiring soon or low on stock."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Chemical name, part number, or description.",
                },
                "status": {
                    "type": "string",
                    "enum": ["available", "low_stock", "out_of_stock", "expired"],
                    "description": "Filter by chemical status.",
                },
                "expiring_within_days": {
                    "type": "integer",
                    "description": "Return chemicals expiring within this many days.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_kits",
        "description": (
            "List mobile warehouse kits and their current locations. "
            "Use for questions about where kits are deployed or which kits exist."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Kit name or aircraft type to search for.",
                },
                "status": {
                    "type": "string",
                    "enum": ["active", "inactive", "maintenance"],
                    "description": "Filter by kit status.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_kit_contents",
        "description": (
            "Get the tools, chemicals, and expendables inside a specific kit. "
            "Use when the user asks what is in a particular kit."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kit_id": {
                    "type": "integer",
                    "description": "Kit ID (use get_kits first to find the ID if unknown).",
                },
                "kit_name": {
                    "type": "string",
                    "description": "Kit name to search by if ID is not known.",
                },
                "item_type": {
                    "type": "string",
                    "enum": ["tool", "chemical", "expendable", "all"],
                    "description": "Which type of items to return (default all).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_kit_reorders",
        "description": (
            "Get pending reorder requests for kit items. "
            "Use for questions about what parts or supplies need to be replenished in kits."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "kit_name": {
                    "type": "string",
                    "description": "Filter by kit name (partial match).",
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "approved", "ordered", "fulfilled", "cancelled"],
                    "description": "Filter by reorder status.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
                    "description": "Filter by priority level.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_fulfillment_requests",
        "description": (
            "Get user fulfillment requests (RFQs). "
            "Use for questions about open requests, what someone has requested, or request status."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": [
                        "new", "under_review", "pending_fulfillment", "in_transfer",
                        "awaiting_external_procurement", "partially_fulfilled",
                        "fulfilled", "needs_info", "cancelled",
                    ],
                    "description": "Filter by request status.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["routine", "urgent", "aog"],
                    "description": "Filter by priority.",
                },
                "user_name": {
                    "type": "string",
                    "description": "Filter by requester name (partial match).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_procurement_orders",
        "description": (
            "Get procurement / purchase orders. "
            "Use for questions about orders placed, vendor status, or tracking numbers."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["new", "awaiting_info", "ordered", "shipped", "in_progress", "received", "cancelled"],
                    "description": "Filter by order status.",
                },
                "vendor": {
                    "type": "string",
                    "description": "Filter by vendor name (partial match).",
                },
                "open_only": {
                    "type": "boolean",
                    "description": "If true, only return open/in-progress orders.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_inventory_summary",
        "description": (
            "Return a fresh snapshot of key inventory counts: tools, checkouts, calibration, chemicals. "
            "Use when the user asks for a general overview or current status."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    # ── Write / action tools ────────────────────────────────────────────────────
    # IMPORTANT: Always call with confirmed=false first to show a preview.
    # Only call with confirmed=true after the user explicitly agrees.
    {
        "name": "checkout_tool",
        "description": (
            "Check out a tool to the current user. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "serial_number": {
                    "type": "string",
                    "description": "Serial number of the tool to check out.",
                },
                "tool_query": {
                    "type": "string",
                    "description": "Tool name or description to search by if serial number is unknown.",
                },
                "work_order": {
                    "type": "string",
                    "description": "Work order number to associate with this checkout (optional).",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional checkout notes.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute the checkout.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "return_tool",
        "description": (
            "Return (check in) a tool that is currently checked out to the current user. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "serial_number": {
                    "type": "string",
                    "description": "Serial number of the tool to return.",
                },
                "tool_query": {
                    "type": "string",
                    "description": "Tool name or description to search by if serial number is unknown.",
                },
                "condition": {
                    "type": "string",
                    "enum": ["New", "Good", "Fair", "Poor", "Damaged"],
                    "description": "Tool condition on return (optional).",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional return notes.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute the return.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "issue_chemical",
        "description": (
            "Issue a quantity of a chemical to the current user. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "part_number": {
                    "type": "string",
                    "description": "Part number of the chemical to issue.",
                },
                "chemical_query": {
                    "type": "string",
                    "description": "Chemical name or description if part number is unknown.",
                },
                "quantity": {
                    "type": "integer",
                    "description": "Quantity to issue.",
                },
                "location": {
                    "type": "string",
                    "description": "Hangar or work location where the chemical will be used.",
                },
                "purpose": {
                    "type": "string",
                    "description": "What the chemical will be used for (optional).",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute the issuance.",
                },
            },
            "required": [],
        },
    },
]


# ─── Tool execution (DB queries) ──────────────────────────────────────────────

def _execute_tool(name: str, args: dict, user_id: int | None = None, is_admin: bool = False) -> dict:
    """Dispatch a tool call to the appropriate DB query and return a JSON-serialisable dict."""
    try:
        if name == "search_tools":
            return _tool_search_tools(**args)
        if name == "get_active_checkouts":
            return _tool_get_active_checkouts(**args)
        if name == "get_calibration_status":
            return _tool_get_calibration_status(**args)
        if name == "search_chemicals":
            return _tool_search_chemicals(**args)
        if name == "get_kits":
            return _tool_get_kits(**args)
        if name == "get_kit_contents":
            return _tool_get_kit_contents(**args)
        if name == "get_kit_reorders":
            return _tool_get_kit_reorders(**args)
        if name == "get_fulfillment_requests":
            return _tool_get_fulfillment_requests(**args)
        if name == "get_procurement_orders":
            return _tool_get_procurement_orders(**args)
        if name == "get_inventory_summary":
            return _tool_get_inventory_summary()
        # Write tools — require authenticated user context
        if name == "checkout_tool":
            return _tool_checkout_tool(**args, _user_id=user_id)
        if name == "return_tool":
            return _tool_return_tool(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "issue_chemical":
            return _tool_issue_chemical(**args, _user_id=user_id)
        return {"error": f"Unknown tool: {name}"}
    except Exception as exc:
        logger.exception("Tool %s failed", name)
        return {"error": str(exc)}


def _tool_search_tools(
    query: str = "",
    serial_number: str = "",
    tool_number: str = "",
    status: str = "",
    category: str = "",
) -> dict:
    q = Tool.query
    filters = []
    if query:
        filters.append(Tool.description.ilike(f"%{query}%"))
    if serial_number:
        filters.append(Tool.serial_number.ilike(f"%{serial_number}%"))
    if tool_number:
        filters.append(Tool.tool_number.ilike(f"%{tool_number}%"))
    if filters:
        q = q.filter(or_(*filters))
    if status:
        q = q.filter(Tool.status == status)
    if category:
        q = q.filter(Tool.category.ilike(f"%{category}%"))

    tools = q.limit(MAX_RESULTS).all()
    if not tools:
        return {"result": "No tools found matching those criteria."}

    rows = []
    for t in tools:
        # Find current checkout for checked-out tools
        current_checkout = None
        if t.status == "checked_out":
            co = (
                Checkout.query
                .filter_by(tool_id=t.id)
                .filter(Checkout.return_date.is_(None))
                .first()
            )
            if co and co.user:
                current_checkout = {
                    "user": co.user.name,
                    "checkout_date": co.checkout_date.strftime("%Y-%m-%d"),
                    "expected_return": co.expected_return_date.strftime("%Y-%m-%d") if co.expected_return_date else None,
                }

        rows.append({
            "tool_number": t.tool_number,
            "serial_number": t.serial_number,
            "description": t.description,
            "status": t.status,
            "category": t.category,
            "location": t.location,
            "warehouse": t.warehouse.name if t.warehouse else None,
            "calibration_status": t.calibration_status,
            "next_calibration_date": t.next_calibration_date.strftime("%Y-%m-%d") if t.next_calibration_date else None,
            "current_checkout": current_checkout,
        })
    return {"count": len(rows), "tools": rows}


def _tool_get_active_checkouts(
    user_name: str = "",
    tool_query: str = "",
    overdue_only: bool = False,
) -> dict:
    q = Checkout.query.filter(Checkout.return_date.is_(None))

    if overdue_only:
        q = q.filter(Checkout.expected_return_date < date.today())

    checkouts = q.all()

    rows = []
    for co in checkouts:
        user = co.user
        tool = co.tool
        if user_name and user and user_name.lower() not in user.name.lower():
            continue
        if tool_query and tool and tool_query.lower() not in (tool.description or "").lower():
            continue

        is_overdue = (
            co.expected_return_date is not None
            and co.expected_return_date.date() < date.today()
        )
        rows.append({
            "tool_number": tool.tool_number if tool else "Unknown",
            "serial_number": tool.serial_number if tool else "Unknown",
            "description": tool.description if tool else "Unknown",
            "checked_out_to": user.name if user else "Unknown",
            "department": user.department if user else None,
            "checkout_date": co.checkout_date.strftime("%Y-%m-%d") if co.checkout_date else None,
            "expected_return": co.expected_return_date.strftime("%Y-%m-%d") if co.expected_return_date else None,
            "overdue": is_overdue,
            "work_order": co.work_order,
        })
        if len(rows) >= MAX_RESULTS:
            break

    if not rows:
        return {"result": "No active checkouts found matching those criteria."}
    return {"count": len(rows), "checkouts": rows}


def _tool_get_calibration_status(
    filter: str = "all",
    days_ahead: int = 30,
) -> dict:
    today = date.today()
    q = Tool.query.filter(Tool.requires_calibration.is_(True))

    if filter == "overdue":
        q = q.filter(Tool.next_calibration_date < today)
    elif filter == "due_soon":
        cutoff = today + timedelta(days=days_ahead)
        q = q.filter(
            Tool.next_calibration_date >= today,
            Tool.next_calibration_date <= cutoff,
        )
    # "all" returns everything that requires calibration

    tools = q.order_by(Tool.next_calibration_date.asc()).limit(MAX_RESULTS).all()
    if not tools:
        return {"result": f"No tools found with calibration filter '{filter}'."}

    rows = []
    for t in tools:
        rows.append({
            "tool_number": t.tool_number,
            "serial_number": t.serial_number,
            "description": t.description,
            "calibration_status": t.calibration_status,
            "last_calibration": t.last_calibration_date.strftime("%Y-%m-%d") if t.last_calibration_date else None,
            "next_calibration": t.next_calibration_date.strftime("%Y-%m-%d") if t.next_calibration_date else None,
            "location": t.location,
            "warehouse": t.warehouse.name if t.warehouse else None,
        })
    return {"count": len(rows), "tools": rows}


def _tool_search_chemicals(
    query: str = "",
    status: str = "",
    expiring_within_days: int = 0,
) -> dict:
    q = Chemical.query
    if query:
        q = q.filter(
            or_(
                Chemical.description.ilike(f"%{query}%"),
                Chemical.part_number.ilike(f"%{query}%"),
                Chemical.lot_number.ilike(f"%{query}%"),
            )
        )
    if status:
        q = q.filter(Chemical.status == status)
    if expiring_within_days:
        cutoff = date.today() + timedelta(days=expiring_within_days)
        q = q.filter(
            Chemical.expiration_date.isnot(None),
            Chemical.expiration_date <= cutoff,
        )

    chemicals = q.limit(MAX_RESULTS).all()
    if not chemicals:
        return {"result": "No chemicals found matching those criteria."}

    rows = []
    for c in chemicals:
        rows.append({
            "part_number": c.part_number,
            "lot_number": c.lot_number,
            "description": c.description,
            "manufacturer": c.manufacturer,
            "quantity": c.quantity,
            "unit": c.unit,
            "status": c.status,
            "location": c.location,
            "warehouse": c.warehouse.name if c.warehouse else None,
            "expiration_date": c.expiration_date.strftime("%Y-%m-%d") if c.expiration_date else None,
            "minimum_stock_level": c.minimum_stock_level,
        })
    return {"count": len(rows), "chemicals": rows}


def _tool_get_kits(query: str = "", status: str = "") -> dict:
    q = Kit.query
    if query:
        q = q.filter(Kit.name.ilike(f"%{query}%"))
    if status:
        q = q.filter(Kit.status == status)

    kits = q.limit(MAX_RESULTS).all()
    if not kits:
        return {"result": "No kits found matching those criteria."}

    rows = []
    for k in kits:
        parts = filter(None, [
            k.location_address,
            k.location_city,
            k.location_state,
        ])
        location_str = ", ".join(parts) or k.location_notes or "No location set"
        rows.append({
            "id": k.id,
            "name": k.name,
            "status": k.status,
            "aircraft_type": k.aircraft_type.name if k.aircraft_type else None,
            "trailer_number": k.trailer_number,
            "location": location_str,
            "location_notes": k.location_notes,
            "item_count": k.items.count() + k.expendables.count(),
            "pending_reorders": k.reorder_requests.filter_by(status="pending").count(),
        })
    return {"count": len(rows), "kits": rows}


def _tool_get_kit_contents(
    kit_id: int = 0,
    kit_name: str = "",
    item_type: str = "all",
) -> dict:
    kit = None
    if kit_id:
        kit = db.session.get(Kit, kit_id)
    elif kit_name:
        kit = Kit.query.filter(Kit.name.ilike(f"%{kit_name}%")).first()

    if not kit:
        return {"error": "Kit not found. Use get_kits to find the correct kit ID or name."}

    result: dict = {"kit": kit.name, "location": kit.location_notes or "Unknown"}

    if item_type in ("tool", "chemical", "all"):
        items = kit.items.limit(MAX_RESULTS).all()
        result["items"] = [i.to_dict() for i in items]

    if item_type in ("expendable", "all"):
        expendables = kit.expendables.limit(MAX_RESULTS).all()
        result["expendables"] = [e.to_dict() for e in expendables]

    return result


def _tool_get_kit_reorders(
    kit_name: str = "",
    status: str = "",
    priority: str = "",
) -> dict:
    q = KitReorderRequest.query
    if kit_name:
        q = q.join(Kit).filter(Kit.name.ilike(f"%{kit_name}%"))
    if status:
        q = q.filter(KitReorderRequest.status == status)
    if priority:
        q = q.filter(KitReorderRequest.priority == priority)

    reorders = q.order_by(KitReorderRequest.requested_date.desc()).limit(MAX_RESULTS).all()
    if not reorders:
        return {"result": "No kit reorder requests found matching those criteria."}

    rows = []
    for r in reorders:
        rows.append({
            "id": r.id,
            "kit": r.kit.name if r.kit else "Unknown",
            "part_number": r.part_number,
            "description": r.description,
            "item_type": r.item_type,
            "quantity_requested": r.quantity_requested,
            "priority": r.priority,
            "status": r.status,
            "requested_by": r.requester.name if r.requester else "Unknown",
            "requested_date": r.requested_date.strftime("%Y-%m-%d") if r.requested_date else None,
        })
    return {"count": len(rows), "reorders": rows}


def _tool_get_fulfillment_requests(
    status: str = "",
    priority: str = "",
    user_name: str = "",
) -> dict:
    q = UserRequest.query
    if status:
        q = q.filter(UserRequest.status == status)
    if priority:
        q = q.filter(UserRequest.priority == priority)
    if user_name:
        q = q.join(User, UserRequest.requester_id == User.id).filter(
            User.name.ilike(f"%{user_name}%")
        )

    requests_list = q.order_by(UserRequest.created_at.desc()).limit(MAX_RESULTS).all()
    if not requests_list:
        return {"result": "No fulfillment requests found matching those criteria."}

    rows = []
    for r in requests_list:
        items = r.items.all()
        rows.append({
            "request_number": r.request_number,
            "title": r.title,
            "status": r.status,
            "priority": r.priority,
            "requester": r.requester.name if r.requester else "Unknown",
            "destination": r.destination_location,
            "created_at": r.created_at.strftime("%Y-%m-%d") if r.created_at else None,
            "item_count": len(items),
            "items": [
                {
                    "description": i.description,
                    "part_number": i.part_number,
                    "quantity": i.quantity,
                    "unit": i.unit,
                    "status": i.status,
                }
                for i in items[:5]  # first 5 items only to keep concise
            ],
        })
    return {"count": len(rows), "requests": rows}


def _tool_get_procurement_orders(
    status: str = "",
    vendor: str = "",
    open_only: bool = False,
) -> dict:
    q = ProcurementOrder.query
    if status:
        q = q.filter(ProcurementOrder.status == status)
    if vendor:
        q = q.filter(ProcurementOrder.vendor.ilike(f"%{vendor}%"))
    if open_only:
        q = q.filter(ProcurementOrder.status.in_(ProcurementOrder.OPEN_STATUSES))

    orders = q.order_by(ProcurementOrder.created_at.desc()).limit(MAX_RESULTS).all()
    if not orders:
        return {"result": "No procurement orders found matching those criteria."}

    rows = []
    for o in orders:
        rows.append({
            "order_number": o.order_number,
            "title": o.title,
            "order_type": o.order_type,
            "part_number": o.part_number,
            "status": o.status,
            "priority": o.priority,
            "vendor": o.vendor,
            "tracking_number": o.tracking_number,
            "requester": o.requester.name if o.requester else "Unknown",
            "buyer": o.buyer.name if o.buyer else None,
            "quantity": o.quantity,
            "unit": o.unit,
            "ordered_date": o.ordered_date.strftime("%Y-%m-%d") if o.ordered_date else None,
            "expected_due": o.expected_due_date.strftime("%Y-%m-%d") if o.expected_due_date else None,
            "created_at": o.created_at.strftime("%Y-%m-%d") if o.created_at else None,
        })
    return {"count": len(rows), "orders": rows}


def _tool_get_inventory_summary() -> dict:
    today = date.today()
    return {
        "tools": {
            "total": Tool.query.count(),
            "available": Tool.query.filter_by(status="available").count(),
            "checked_out": Tool.query.filter_by(status="checked_out").count(),
            "maintenance": Tool.query.filter_by(status="maintenance").count(),
            "retired": Tool.query.filter_by(status="retired").count(),
        },
        "calibration": {
            "overdue": Tool.query.filter(
                Tool.requires_calibration.is_(True),
                Tool.next_calibration_date < today,
            ).count(),
            "due_within_30_days": Tool.query.filter(
                Tool.requires_calibration.is_(True),
                Tool.next_calibration_date >= today,
                Tool.next_calibration_date <= today + timedelta(days=30),
            ).count(),
        },
        "chemicals": {
            "total": Chemical.query.count(),
            "available": Chemical.query.filter_by(status="available").count(),
            "low_stock": Chemical.query.filter_by(status="low_stock").count(),
            "out_of_stock": Chemical.query.filter_by(status="out_of_stock").count(),
            "expiring_within_30_days": Chemical.query.filter(
                Chemical.expiration_date.isnot(None),
                Chemical.expiration_date <= today + timedelta(days=30),
            ).count(),
        },
        "active_checkouts": Checkout.query.filter(Checkout.return_date.is_(None)).count(),
        "kits": {
            "total": Kit.query.count(),
            "active": Kit.query.filter_by(status="active").count(),
            "pending_reorders": KitReorderRequest.query.filter_by(status="pending").count(),
        },
        "fulfillment": {
            "open_requests": UserRequest.query.filter(
                UserRequest.status.notin_(["fulfilled", "cancelled"])
            ).count(),
            "open_orders": ProcurementOrder.query.filter(
                ProcurementOrder.status.in_(ProcurementOrder.OPEN_STATUSES)
            ).count(),
        },
    }


# ─── Write tool execution ─────────────────────────────────────────────────────

def _tool_checkout_tool(
    serial_number: str = "",
    tool_query: str = "",
    work_order: str = "",
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
) -> dict:
    if not _user_id:
        return {"error": "Cannot determine current user. Please log in again."}

    # Locate the tool
    tool = None
    if serial_number:
        tool = Tool.query.filter(Tool.serial_number.ilike(f"%{serial_number}%")).first()
    if not tool and tool_query:
        tool = Tool.query.filter(Tool.description.ilike(f"%{tool_query}%")).first()
    if not tool:
        return {"error": "Tool not found. Use search_tools to find the correct tool first."}

    # Evaluate blocking conditions (same rules as the checkout route)
    blocking = []
    active_co = Checkout.query.filter_by(tool_id=tool.id, return_date=None).first()
    if active_co:
        who = active_co.user.name if active_co.user else "someone"
        blocking.append(f"Already checked out to {who} since {active_co.checkout_date.strftime('%Y-%m-%d') if active_co.checkout_date else 'unknown date'}.")
    if tool.requires_calibration and tool.calibration_status == "overdue":
        blocking.append("Calibration is overdue — tool cannot be issued until recalibrated.")
    if tool.status == "maintenance":
        blocking.append(f"Tool is in maintenance: {tool.status_reason or 'no reason recorded'}.")
    if tool.status == "retired":
        blocking.append("Tool has been retired from service.")
    if tool.condition and tool.condition.lower() in ("damaged", "unusable", "broken"):
        blocking.append(f"Tool condition is '{tool.condition}'.")

    preview = {
        "action": "checkout_tool",
        "tool_number": tool.tool_number,
        "serial_number": tool.serial_number,
        "description": tool.description,
        "current_status": tool.status,
        "location": tool.location,
        "work_order": work_order or None,
        "notes": notes or None,
        "blocking_reasons": blocking,
        "can_proceed": len(blocking) == 0,
    }

    if not confirmed:
        preview["status"] = "preview"
        if preview["can_proceed"]:
            preview["message"] = "Ready to check out. Reply 'confirm' to proceed."
        else:
            preview["message"] = "Cannot check out this tool — see blocking_reasons above."
        return preview

    # Execute
    if blocking:
        return {"error": "Cannot check out this tool.", "blocking_reasons": blocking}

    expected_return = datetime.now() + timedelta(days=7)
    user = db.session.get(User, _user_id)

    checkout = Checkout(
        tool_id=tool.id,
        user_id=_user_id,
        expected_return_date=expected_return,
        checkout_notes=notes or None,
        condition_at_checkout=tool.condition,
        work_order=work_order or None,
    )
    db.session.add(checkout)
    old_status = tool.status
    tool.status = "checked_out"
    db.session.flush()  # get checkout.id

    history = ToolHistory.create_event(
        tool_id=tool.id,
        event_type="checkout",
        user_id=_user_id,
        description=f"Checked out to {user.name if user else 'Unknown'} via AI assistant",
        details={"work_order": work_order, "notes": notes, "source": "ai_assistant"},
        related_checkout_id=checkout.id,
        old_status=old_status,
        new_status="checked_out",
    )
    db.session.add(history)

    try:
        record_tool_checkout(tool_id=tool.id, user_id=_user_id,
                             expected_return_date=expected_return, notes=notes)
    except Exception:
        logger.warning("record_tool_checkout failed for tool %s", tool.id)

    db.session.add(AuditLog(
        action_type="tool_checkout",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} checked out "
            f"{tool.tool_number} S/N {tool.serial_number}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Tool {tool.tool_number} (S/N {tool.serial_number}) checked out to "
            f"{user.name if user else 'you'} successfully."
        ),
        "checkout_id": checkout.id,
        "expected_return_date": expected_return.strftime("%Y-%m-%d"),
    }


def _tool_return_tool(
    serial_number: str = "",
    tool_query: str = "",
    condition: str = "",
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not _user_id:
        return {"error": "Cannot determine current user. Please log in again."}

    # Find the active checkout
    checkout = None
    tool = None

    if serial_number:
        tool = Tool.query.filter(Tool.serial_number.ilike(f"%{serial_number}%")).first()
    if not tool and tool_query:
        tool = Tool.query.filter(Tool.description.ilike(f"%{tool_query}%")).first()

    if tool:
        checkout = Checkout.query.filter_by(tool_id=tool.id, return_date=None).first()
    else:
        # Fall back: find any active checkout for this user matching the query
        checkout = (
            Checkout.query
            .filter_by(user_id=_user_id, return_date=None)
            .first()
        )
        if checkout:
            tool = checkout.tool

    if not checkout or not tool:
        return {"error": "No active checkout found for that tool. Use get_active_checkouts to check what you have checked out."}

    # Authorization: only the owner or an admin may return
    if checkout.user_id != _user_id and not _is_admin:
        owner = checkout.user.name if checkout.user else "another user"
        return {"error": f"That tool is checked out to {owner}. You can only return tools checked out to yourself."}

    preview = {
        "action": "return_tool",
        "tool_number": tool.tool_number,
        "serial_number": tool.serial_number,
        "description": tool.description,
        "checked_out_to": checkout.user.name if checkout.user else "Unknown",
        "checkout_date": checkout.checkout_date.strftime("%Y-%m-%d") if checkout.checkout_date else None,
        "condition_on_return": condition or tool.condition or "Not specified",
        "notes": notes or None,
        "can_proceed": True,
    }

    if not confirmed:
        preview["status"] = "preview"
        preview["message"] = "Ready to return this tool. Reply 'confirm' to proceed."
        return preview

    # Execute return
    old_status = tool.status
    checkout.return_date = datetime.now()
    checkout.condition_at_return = condition or None
    checkout.return_notes = notes or None
    checkout.checked_in_by_id = _user_id

    tool.status = "available"
    if condition:
        tool.condition = condition

    user = db.session.get(User, _user_id)
    history = ToolHistory.create_event(
        tool_id=tool.id,
        event_type="return",
        user_id=_user_id,
        description=f"Returned by {user.name if user else 'Unknown'} via AI assistant",
        details={
            "checkout_id": checkout.id,
            "original_user_id": checkout.user_id,
            "original_user_name": checkout.user.name if checkout.user else "Unknown",
            "condition_at_return": condition,
            "notes": notes,
            "source": "ai_assistant",
        },
        related_checkout_id=checkout.id,
        old_status=old_status,
        new_status="available",
    )
    db.session.add(history)

    try:
        record_tool_return(tool_id=tool.id, user_id=_user_id, condition=condition, notes=notes)
    except Exception:
        logger.warning("record_tool_return failed for tool %s", tool.id)

    db.session.add(AuditLog(
        action_type="tool_return",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} returned "
            f"{tool.tool_number} S/N {tool.serial_number}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": f"Tool {tool.tool_number} (S/N {tool.serial_number}) returned successfully. Status is now 'available'.",
    }


def _tool_issue_chemical(
    part_number: str = "",
    chemical_query: str = "",
    quantity: int = 0,
    location: str = "",
    purpose: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
) -> dict:
    if not _user_id:
        return {"error": "Cannot determine current user. Please log in again."}

    # Locate the chemical
    chem = None
    if part_number:
        chem = Chemical.query.filter(
            Chemical.part_number.ilike(f"%{part_number}%"),
            Chemical.quantity > 0,
        ).first()
    if not chem and chemical_query:
        chem = Chemical.query.filter(
            Chemical.description.ilike(f"%{chemical_query}%"),
            Chemical.quantity > 0,
        ).first()
    if not chem:
        return {"error": "Chemical not found or out of stock. Use search_chemicals to locate it first."}

    if not quantity or quantity <= 0:
        return {"error": "Please specify a quantity greater than 0 to issue."}
    if not location:
        return {"error": "Please specify the hangar or work location where the chemical will be used."}

    # Validate issuance
    blocking = []
    if chem.status == "expired":
        blocking.append("Chemical lot has expired and cannot be issued.")
    if chem.quantity <= 0:
        blocking.append("Chemical is out of stock.")
    if quantity > chem.quantity:
        blocking.append(f"Requested quantity ({quantity}) exceeds available stock ({chem.quantity} {chem.unit}).")

    preview = {
        "action": "issue_chemical",
        "part_number": chem.part_number,
        "lot_number": chem.lot_number,
        "description": chem.description,
        "available_quantity": chem.quantity,
        "unit": chem.unit,
        "quantity_to_issue": quantity,
        "remaining_after": chem.quantity - quantity if not blocking else "N/A",
        "location": location,
        "purpose": purpose or None,
        "expiration_date": chem.expiration_date.strftime("%Y-%m-%d") if chem.expiration_date else None,
        "blocking_reasons": blocking,
        "can_proceed": len(blocking) == 0,
    }

    if not confirmed:
        preview["status"] = "preview"
        if preview["can_proceed"]:
            preview["message"] = "Ready to issue. Reply 'confirm' to proceed."
        else:
            preview["message"] = "Cannot issue this chemical — see blocking_reasons above."
        return preview

    if blocking:
        return {"error": "Cannot issue this chemical.", "blocking_reasons": blocking}

    user = db.session.get(User, _user_id)
    is_partial = quantity < chem.quantity

    if is_partial:
        from utils.lot_utils import create_child_chemical
        child = create_child_chemical(
            parent_chemical=chem,
            quantity=quantity,
            destination_warehouse_id=chem.warehouse_id,
        )
        db.session.add(child)
        db.session.flush()
        issuance = ChemicalIssuance(
            chemical_id=child.id,
            user_id=_user_id,
            quantity=quantity,
            hangar=location,
            purpose=purpose or "",
        )
        child.quantity = 0
        child.status = "issued"
    else:
        issuance = ChemicalIssuance(
            chemical_id=chem.id,
            user_id=_user_id,
            quantity=quantity,
            hangar=location,
            purpose=purpose or "",
        )
        chem.quantity -= quantity
        if chem.quantity <= 0:
            chem.status = "out_of_stock"
        elif hasattr(chem, "is_low_stock") and chem.is_low_stock():
            chem.status = "low_stock"

    db.session.add(issuance)

    try:
        record_chemical_issuance(
            chemical_id=chem.id,
            user_id=_user_id,
            quantity=quantity,
            hangar=location,
            purpose=purpose,
        )
    except Exception:
        logger.warning("record_chemical_issuance failed for chemical %s", chem.id)

    db.session.add(AuditLog(
        action_type="chemical_issuance",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} issued {quantity} {chem.unit} "
            f"of {chem.part_number} lot {chem.lot_number} to {location}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Issued {quantity} {chem.unit} of {chem.description} "
            f"(P/N {chem.part_number}, lot {chem.lot_number}) to {location}."
        ),
        "remaining_stock": chem.quantity,
    }


# ─── Schema converters ────────────────────────────────────────────────────────

def _claude_tools() -> list:
    """Convert our canonical definitions to Anthropic's tool schema format."""
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        }
        for t in TOOL_DEFINITIONS
    ]


def _openai_tools() -> list:
    """Convert our canonical definitions to OpenAI's tool schema format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        }
        for t in TOOL_DEFINITIONS
    ]


# ─── Provider agentic loops ───────────────────────────────────────────────────

def _run_claude_loop(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list,
    user_id: int | None = None,
    is_admin: bool = False,
) -> str:
    current_messages = [m.copy() for m in messages]
    tools = _claude_tools()
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    for iteration in range(MAX_TOOL_ITERATIONS):
        payload = {
            "model": model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": current_messages,
            "tools": tools,
        }
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        stop_reason = data.get("stop_reason")

        if stop_reason == "end_turn":
            for block in data.get("content", []):
                if block.get("type") == "text":
                    return block["text"]
            return "(No text response)"

        if stop_reason == "tool_use":
            tool_results = []
            for block in data.get("content", []):
                if block.get("type") == "tool_use":
                    tool_output = _execute_tool(
                        block["name"], block.get("input", {}),
                        user_id=user_id, is_admin=is_admin,
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": json.dumps(tool_output),
                    })

            current_messages.append({"role": "assistant", "content": data["content"]})
            current_messages.append({"role": "user", "content": tool_results})
            continue

        for block in data.get("content", []):
            if block.get("type") == "text":
                return block["text"]
        return "(Unexpected stop reason: {})".format(stop_reason)

    return "I reached the maximum number of tool calls without completing the query. Please try a more specific question."


def _run_openai_loop(
    api_key: str,
    model: str,
    base_url: str,
    system_prompt: str,
    messages: list,
    user_id: int | None = None,
    is_admin: bool = False,
) -> str:
    current_messages = [{"role": "system", "content": system_prompt}] + [m.copy() for m in messages]
    tools = _openai_tools()
    headers = {"content-type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    for iteration in range(MAX_TOOL_ITERATIONS):
        payload = {
            "model": model,
            "messages": current_messages,
            "tools": tools,
            "tool_choice": "auto",
            "max_tokens": 1024,
        }
        resp = requests.post(
            f"{base_url.rstrip('/')}/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        choice = data["choices"][0]
        finish_reason = choice.get("finish_reason")
        assistant_msg = choice["message"]

        if finish_reason in ("stop", "length"):
            return assistant_msg.get("content") or "(No response)"

        if finish_reason == "tool_calls":
            current_messages.append(assistant_msg)
            for tc in assistant_msg.get("tool_calls", []):
                fn = tc["function"]
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except json.JSONDecodeError:
                    args = {}
                tool_output = _execute_tool(
                    fn["name"], args,
                    user_id=user_id, is_admin=is_admin,
                )
                current_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(tool_output),
                })
            continue

        return assistant_msg.get("content") or "(No response)"

    return "I reached the maximum number of tool calls without completing the query. Please try a more specific question."


# ─── System prompt ────────────────────────────────────────────────────────────

def _build_system_prompt(current_user: dict) -> str:
    try:
        user_obj = db.session.get(User, current_user.get("user_id"))
        user_name = user_obj.name if user_obj else "Unknown"
        user_role = "Administrator" if (user_obj and user_obj.is_admin) else "Standard User"
    except Exception:
        user_name = current_user.get("name", "Unknown")
        user_role = "Unknown"

    return f"""You are the SupplyLine AI Assistant embedded in the SupplyLine MRO Suite — an inventory management system for aviation/aerospace Maintenance, Repair, and Operations organizations.

## Current User
- Name: {user_name}
- Role: {user_role}

## Query tools (read-only)
Call these freely whenever you need live data:
- search_tools — find tools by name, serial number, status, or category
- get_active_checkouts — see who has tools checked out right now
- get_calibration_status — find overdue or upcoming calibrations
- search_chemicals — find chemicals by name, part number, or expiration
- get_kits — list mobile warehouse kits and their locations
- get_kit_contents — see what is inside a specific kit
- get_kit_reorders — pending restock requests for kits
- get_fulfillment_requests — user RFQs and their status
- get_procurement_orders — purchase orders with vendor and tracking info
- get_inventory_summary — fresh snapshot of all key counts

## Action tools (write operations — TWO-STEP REQUIRED)
These tools make real changes to the database. You MUST follow this two-step process:

STEP 1 — Always call with confirmed=false first.
  The tool returns a preview showing exactly what will happen.
  Present the preview clearly to the user.

STEP 2 — Only call with confirmed=true after the user explicitly says
  "yes", "confirm", "go ahead", "do it", or similar.
  Never execute with confirmed=true unless the user gave clear approval.

Action tools:
- checkout_tool — check out a tool to the current user
- return_tool — return (check in) a tool the current user has checked out
- issue_chemical — issue a quantity of a chemical to the current user

## Guidelines
- Always use query tools for lookups — never invent serial numbers, names, or quantities.
- Be concise. Present data as a short readable list, not raw JSON.
- If a query returns no results, say so and suggest a broader search.
- For navigation help, name the relevant menu section (Tools, Chemicals, Kits, Orders, etc.).
- Do not speculate about data not returned by a tool."""


# ─── Settings helpers ─────────────────────────────────────────────────────────

def _get_setting(key: str):
    from models import SystemSetting
    return SystemSetting.query.filter_by(key=key).first()


def _set_setting(key: str, value: str, *, sensitive: bool = False, user_id=None):
    from models import SystemSetting
    setting = SystemSetting.query.filter_by(key=key).first()
    if setting is None:
        setting = SystemSetting(key=key, category="ai", is_sensitive=sensitive)
        db.session.add(setting)
    setting.value = value
    setting.updated_by_id = user_id
    return setting


def _load_ai_config() -> dict:
    from models import SystemSetting
    rows = SystemSetting.query.filter_by(category="ai").all()
    data = {r.key: r.value for r in rows}
    return {
        "enabled":            data.get(AI_ENABLED_KEY, "false") == "true",
        "provider":           data.get(AI_PROVIDER_KEY, "claude"),
        "model":              data.get(AI_MODEL_KEY, ""),
        "base_url":           data.get(AI_BASE_URL_KEY, ""),
        "api_key_configured": bool(data.get(AI_API_KEY_KEY, "").strip()),
    }


# ─── Route registration ───────────────────────────────────────────────────────

def register_ai_routes(app):

    @app.route("/api/ai/settings", methods=["GET"])
    @jwt_required
    def get_ai_settings():
        return jsonify(_load_ai_config())

    @app.route("/api/ai/settings", methods=["PUT"])
    @permission_required("system.settings")
    def update_ai_settings():
        payload = request.get_json() or {}
        user_id = request.current_user.get("user_id")

        provider = payload.get("provider", "").strip()
        if provider and provider not in VALID_PROVIDERS:
            return jsonify({"error": f"Invalid provider. Must be one of: {', '.join(VALID_PROVIDERS)}"}), 400

        if "enabled" in payload:
            _set_setting(AI_ENABLED_KEY, "true" if payload["enabled"] else "false", user_id=user_id)
        if provider:
            _set_setting(AI_PROVIDER_KEY, provider, user_id=user_id)
        if "api_key" in payload:
            _set_setting(AI_API_KEY_KEY, payload["api_key"], sensitive=True, user_id=user_id)
        if "model" in payload:
            _set_setting(AI_MODEL_KEY, payload["model"], user_id=user_id)
        if "base_url" in payload:
            _set_setting(AI_BASE_URL_KEY, payload["base_url"], user_id=user_id)

        db.session.add(AuditLog(
            action_type="update_ai_settings",
            action_details=f"User {user_id} updated AI assistant settings (provider={provider or 'unchanged'})",
        ))
        db.session.commit()
        return jsonify(_load_ai_config())

    @app.route("/api/ai/chat", methods=["POST"])
    @jwt_required
    def ai_chat():
        config = _load_ai_config()

        if not config["enabled"]:
            return jsonify({"error": "AI assistant is not enabled. Ask an administrator to enable it."}), 503

        if not config["api_key_configured"] and config["provider"] != "ollama":
            return jsonify({"error": "AI assistant is not configured. Ask an administrator to set an API key."}), 503

        payload = request.get_json() or {}
        messages = payload.get("messages", [])
        if not messages:
            return jsonify({"error": "messages array is required"}), 400

        for msg in messages:
            if msg.get("role") not in ("user", "assistant"):
                return jsonify({"error": "Each message must have role 'user' or 'assistant'"}), 400
            if not isinstance(msg.get("content"), str):
                return jsonify({"error": "Each message content must be a string"}), 400

        provider     = config["provider"]
        api_key_row  = _get_setting(AI_API_KEY_KEY)
        api_key      = api_key_row.value if api_key_row else ""
        model_row    = _get_setting(AI_MODEL_KEY)
        model        = (model_row.value if model_row and model_row.value else None) or DEFAULT_MODELS.get(provider, "")
        base_url_row = _get_setting(AI_BASE_URL_KEY)
        base_url     = (base_url_row.value if base_url_row and base_url_row.value else None) or DEFAULT_BASE_URLS.get(provider, "")

        system_prompt = _build_system_prompt(request.current_user)

        user_id  = request.current_user.get("user_id")
        is_admin = request.current_user.get("is_admin", False)

        try:
            if provider == "claude":
                reply = _run_claude_loop(api_key, model, system_prompt, messages,
                                         user_id=user_id, is_admin=is_admin)
            elif provider in ("openai", "openrouter", "ollama"):
                reply = _run_openai_loop(api_key, model, base_url, system_prompt, messages,
                                         user_id=user_id, is_admin=is_admin)
            else:
                return jsonify({"error": f"Unsupported provider: {provider}"}), 400

        except requests.exceptions.ConnectionError:
            logger.exception("AI provider connection error")
            return jsonify({"error": "Could not connect to the AI provider. Check the base URL and network connectivity."}), 502
        except requests.exceptions.Timeout:
            return jsonify({"error": "AI provider request timed out. Try again."}), 504
        except requests.exceptions.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 500
            try:
                detail = exc.response.json()
            except Exception:
                detail = exc.response.text if exc.response is not None else str(exc)
            logger.error("AI provider HTTP error %s: %s", status_code, detail)
            if status_code == 401:
                return jsonify({"error": "Invalid API key. Check the AI settings."}), 502
            if status_code == 429:
                return jsonify({"error": "AI provider rate limit reached. Try again in a moment."}), 502
            return jsonify({"error": f"AI provider returned an error ({status_code}). Check settings and try again."}), 502
        except Exception:
            logger.exception("Unexpected AI chat error")
            return jsonify({"error": "An unexpected error occurred. Please try again."}), 500

        return jsonify({"reply": reply, "provider": provider, "model": model})
