"""AI assistant routes — settings management and provider-agnostic chat proxy with tool use."""

import json
import logging
from datetime import date, timedelta

import requests
from flask import jsonify, request
from sqlalchemy import or_

from auth import jwt_required, permission_required
from models import (
    AuditLog,
    Chemical,
    Checkout,
    ProcurementOrder,
    RequestItem,
    Tool,
    User,
    UserRequest,
    db,
)
from models_kits import Kit, KitExpendable, KitItem, KitReorderRequest

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
]


# ─── Tool execution (DB queries) ──────────────────────────────────────────────

def _execute_tool(name: str, args: dict) -> dict:
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

def _run_claude_loop(api_key: str, model: str, system_prompt: str, messages: list) -> str:
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
            # Extract the final text response
            for block in data.get("content", []):
                if block.get("type") == "text":
                    return block["text"]
            return "(No text response)"

        if stop_reason == "tool_use":
            # Execute all requested tool calls
            tool_results = []
            for block in data.get("content", []):
                if block.get("type") == "tool_use":
                    tool_output = _execute_tool(block["name"], block.get("input", {}))
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": json.dumps(tool_output),
                    })

            # Append assistant turn + tool results as a user turn (Anthropic format)
            current_messages.append({"role": "assistant", "content": data["content"]})
            current_messages.append({"role": "user", "content": tool_results})
            continue

        # Unexpected stop reason — try to extract any text
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

        if finish_reason == "stop" or finish_reason == "length":
            return assistant_msg.get("content") or "(No response)"

        if finish_reason == "tool_calls":
            # Append the assistant message (contains tool_calls)
            current_messages.append(assistant_msg)

            # Execute each tool call and append results
            for tc in assistant_msg.get("tool_calls", []):
                fn = tc["function"]
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except json.JSONDecodeError:
                    args = {}
                tool_output = _execute_tool(fn["name"], args)
                current_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(tool_output),
                })
            continue

        # Fallback
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

## Your capabilities
You have access to live tools that query the database. When users ask about specific tools, chemicals, kits, checkouts, orders, or requests, ALWAYS call the appropriate tool to get accurate data — do not guess or make up records.

Available tools:
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

## Guidelines
- Always use tools for specific lookups — never invent serial numbers, names, or quantities.
- Be concise. Present tabular data as a short list, not a raw JSON dump.
- If a query returns no results, say so clearly and suggest a broader search.
- For navigation help, mention the relevant menu section (Tools, Chemicals, Kits, Orders, etc.).
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

        try:
            if provider == "claude":
                reply = _run_claude_loop(api_key, model, system_prompt, messages)
            elif provider in ("openai", "openrouter", "ollama"):
                reply = _run_openai_loop(api_key, model, base_url, system_prompt, messages)
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
