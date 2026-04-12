"""AI assistant routes — settings management and provider-agnostic chat proxy with tool use."""

import json
import logging
import socket
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from urllib.parse import urlparse

import requests
from flask import jsonify, request
from sqlalchemy import or_

from auth import jwt_required, permission_required
from models import (
    AuditLog,
    Checkout,
    Chemical,
    ChemicalIssuance,
    ChemicalReturn,
    ProcurementOrder,
    RequestItem,
    Tool,
    ToolCalibration,
    ToolHistory,
    ToolServiceRecord,
    User,
    UserActivity,
    UserRequest,
    Warehouse,
    db,
)
from models_kits import Kit, KitBox, KitItem, KitReorderRequest, KitTransfer
from utils.transaction_helper import (
    record_chemical_issuance,
    record_chemical_return,
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
    "openai":     "https://api.openai.com",
    "openrouter": "https://openrouter.ai/api",
    "ollama":     "http://localhost:11434",
}

MAX_TOOL_ITERATIONS = 5   # hard cap on agentic loop depth
MAX_RESULTS = 20          # cap all DB queries to keep responses concise
AI_CHAT_WINDOW_SECONDS = 60
AI_CHAT_MAX_REQUESTS_PER_WINDOW = 20

_ai_chat_rate_limit_lock = threading.Lock()
_ai_chat_request_times: dict[int, deque[float]] = defaultdict(deque)

# Tools available when Ollama (local small model) is the provider.
# Kept to ~15 essential operations so models like Gemma 4B don't get confused.
# Claude / OpenAI / OpenRouter always receive the full tool list.
OLLAMA_TOOL_NAMES = {
    "search_tools",
    "get_active_checkouts",
    "get_calibration_status",
    "search_chemicals",
    "get_inventory_summary",
    "get_kits",
    "get_kit_contents",
    "get_warehouses",
    "get_fulfillment_requests",
    "checkout_tool",
    "return_tool",
    "issue_chemical",
    "return_chemical",
    "create_request",
    "transfer_item",
    "forecast_chemicals",
}


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
    # ── Location lookup tools ────────────────────────────────────────────────────
    {
        "name": "get_warehouses",
        "description": (
            "List all warehouses and their current tool and chemical counts. "
            "Use this to find warehouse names and IDs before initiating a transfer."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Optional warehouse name to search for.",
                },
            },
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
    {
        "name": "transfer_item",
        "description": (
            "Transfer a tool or chemical between any two locations: "
            "warehouse-to-warehouse, warehouse-to-kit, kit-to-warehouse, or kit-to-kit. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "item_query": {
                    "type": "string",
                    "description": "Tool description, serial number, or chemical part number / description to find.",
                },
                "from_type": {
                    "type": "string",
                    "enum": ["warehouse", "kit"],
                    "description": "Source location type.",
                },
                "from_name": {
                    "type": "string",
                    "description": "Name of the source warehouse or kit.",
                },
                "to_type": {
                    "type": "string",
                    "enum": ["warehouse", "kit"],
                    "description": "Destination location type.",
                },
                "to_name": {
                    "type": "string",
                    "description": "Name of the destination warehouse or kit.",
                },
                "quantity": {
                    "type": "integer",
                    "description": "Quantity to transfer. For tools this is always 1.",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes for the transfer record.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute the transfer.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_chemical_issuances",
        "description": (
            "List active (unreturned or partially returned) issuances for a chemical. "
            "Use this to find the issuance_id needed before calling return_chemical."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chemical_id": {
                    "type": "integer",
                    "description": "ID of the chemical. Use search_chemicals first to find it.",
                },
                "part_number": {
                    "type": "string",
                    "description": "Filter by part number (partial match).",
                },
                "show_all": {
                    "type": "boolean",
                    "description": "true = include fully returned issuances. Default false = active only.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "return_chemical",
        "description": (
            "Return a quantity of an issued chemical back to stock. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm. "
            "Use get_chemical_issuances to find the issuance_id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chemical_id": {
                    "type": "integer",
                    "description": "ID of the chemical to return.",
                },
                "issuance_id": {
                    "type": "integer",
                    "description": "ID of the issuance record being returned against.",
                },
                "quantity": {
                    "type": "integer",
                    "description": "Quantity to return. Must not exceed the outstanding issued amount.",
                },
                "warehouse_id": {
                    "type": "integer",
                    "description": "Warehouse to return the chemical to. Defaults to original warehouse.",
                },
                "location": {
                    "type": "string",
                    "description": "Shelf or bin location within the warehouse.",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes for the return record.",
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
        "name": "request_chemical_reorder",
        "description": (
            "Flag a chemical as needing reorder and create a procurement request. "
            "Requires materials manager role or admin. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chemical_id": {
                    "type": "integer",
                    "description": "ID of the chemical to reorder.",
                },
                "requested_quantity": {
                    "type": "integer",
                    "description": "Quantity to request in the reorder.",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes or justification for the reorder.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = submit the reorder request.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "archive_chemical",
        "description": (
            "Archive a depleted or expired chemical so it no longer appears in active inventory. "
            "Requires materials manager role or admin. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "chemical_id": {
                    "type": "integer",
                    "description": "ID of the chemical to archive.",
                },
                "reason": {
                    "type": "string",
                    "description": "Required reason for archiving (e.g. expired, depleted, contaminated).",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute the archive.",
                },
            },
            "required": [],
        },
    },
    # ── Request & fulfillment workflow tools ──────────────────────────────────
    {
        "name": "create_request",
        "description": (
            "Create a new procurement/fulfillment request for a single item. "
            "Use add_request_item to add more items afterward. "
            "Call with confirmed=false first to preview. "
            "Only call with confirmed=true after the user explicitly says yes or confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short title for the request (e.g. 'Torque wrench P/N 12345').",
                },
                "item_description": {
                    "type": "string",
                    "description": "What is being requested.",
                },
                "item_part_number": {
                    "type": "string",
                    "description": "Part number of the item (if known).",
                },
                "item_quantity": {
                    "type": "integer",
                    "description": "Quantity needed. Defaults to 1.",
                },
                "item_type": {
                    "type": "string",
                    "enum": ["tool", "chemical", "expendable", "repairable", "other"],
                    "description": "Category of the item.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["routine", "urgent", "aog"],
                    "description": "Request priority. routine = normal, urgent = needed soon, aog = aircraft on ground.",
                },
                "notes": {
                    "type": "string",
                    "description": "Additional context or justification for the request.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = submit the request.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "add_request_item",
        "description": (
            "Add one item to an existing open request. "
            "Use get_fulfillment_requests to find the request_number first. "
            "Call with confirmed=false to preview, confirmed=true to add."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "request_number": {
                    "type": "string",
                    "description": "Request number (e.g. REQ-00042).",
                },
                "item_description": {
                    "type": "string",
                    "description": "Description of the item to add.",
                },
                "item_part_number": {
                    "type": "string",
                    "description": "Part number (if known).",
                },
                "item_quantity": {
                    "type": "integer",
                    "description": "Quantity needed. Defaults to 1.",
                },
                "item_type": {
                    "type": "string",
                    "enum": ["tool", "chemical", "expendable", "repairable", "other"],
                    "description": "Category of the item.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = add the item.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "update_request_status",
        "description": (
            "Update the status or priority of a request. "
            "Requires orders permission or admin. "
            "Call with confirmed=false to preview, confirmed=true to apply. "
            "Valid statuses: new, under_review, pending_fulfillment, in_transfer, "
            "awaiting_external_procurement, partially_fulfilled, fulfilled, needs_info, cancelled."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "request_number": {
                    "type": "string",
                    "description": "Request number (e.g. REQ-00042).",
                },
                "status": {
                    "type": "string",
                    "enum": [
                        "new", "under_review", "pending_fulfillment", "in_transfer",
                        "awaiting_external_procurement", "partially_fulfilled",
                        "fulfilled", "needs_info", "cancelled",
                    ],
                    "description": "New status for the request.",
                },
                "priority": {
                    "type": "string",
                    "enum": ["routine", "urgent", "aog"],
                    "description": "New priority (optional — omit to leave unchanged).",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional notes to append to the request.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = apply the update.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "mark_items_received",
        "description": (
            "Mark all pending or ordered items in a request as received. "
            "Used when physical goods arrive and need to be acknowledged. "
            "Call with confirmed=false to preview, confirmed=true to mark received."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "request_number": {
                    "type": "string",
                    "description": "Request number (e.g. REQ-00042).",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = mark items received.",
                },
            },
            "required": [],
        },
    },
    # ── Tool service & calibration tools ─────────────────────────────────────
    {
        "name": "flag_tool_for_service",
        "description": (
            "Remove a tool from active service for maintenance or permanent retirement. "
            "Requires tool manager role or admin. "
            "Call with confirmed=false to preview, confirmed=true to execute. "
            "Use search_tools first to find the tool_id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tool_id": {
                    "type": "integer",
                    "description": "ID of the tool to flag.",
                },
                "action": {
                    "type": "string",
                    "enum": ["maintenance", "retire"],
                    "description": "maintenance = temporary removal; retire = permanent decommission.",
                },
                "reason": {
                    "type": "string",
                    "description": "Required reason for removing the tool from service.",
                },
                "comments": {
                    "type": "string",
                    "description": "Optional additional comments.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "return_tool_to_service",
        "description": (
            "Return a tool from maintenance back to available status. "
            "Requires tool manager role or admin. "
            "Call with confirmed=false to preview, confirmed=true to execute."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tool_id": {
                    "type": "integer",
                    "description": "ID of the tool to return to service.",
                },
                "reason": {
                    "type": "string",
                    "description": "Required reason / notes for returning tool to service.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = execute.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "record_calibration",
        "description": (
            "Record a completed calibration for a tool. Updates calibration date and status. "
            "Requires tool manager role or admin. "
            "Call with confirmed=false to preview, confirmed=true to record. "
            "Use search_tools first to find the tool_id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tool_id": {
                    "type": "integer",
                    "description": "ID of the tool that was calibrated.",
                },
                "calibration_status": {
                    "type": "string",
                    "enum": ["pass", "fail", "limited"],
                    "description": "Result of the calibration.",
                },
                "calibration_date": {
                    "type": "string",
                    "description": "Date calibration was performed (YYYY-MM-DD). Defaults to today.",
                },
                "next_calibration_date": {
                    "type": "string",
                    "description": "Next due date (YYYY-MM-DD). Calculated from tool interval if omitted.",
                },
                "notes": {
                    "type": "string",
                    "description": "Optional calibration notes.",
                },
                "confirmed": {
                    "type": "boolean",
                    "description": "false = preview only (default). true = record the calibration.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_request_detail",
        "description": (
            "Get full details of a single fulfillment request including all items, "
            "individual item statuses, vendor, tracking numbers, and costs. "
            "Use get_fulfillment_requests to find the request_number first."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "request_number": {
                    "type": "string",
                    "description": "Request number (e.g. REQ-00042).",
                },
            },
            "required": [],
        },
    },
    # ── Forecasting tools ─────────────────────────────────────────────────────
    {
        "name": "forecast_chemicals",
        "description": (
            "Consumption-based reorder and expiry forecast for all chemicals. "
            "Returns urgency-sorted list: critical (reorder now), soon (reorder within safety window), "
            "expiry_risk (will expire before consumed), ok, no_data (no usage history). "
            "Use for questions like 'what chemicals need reordering?' or 'what's at risk of expiring?'"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "analysis_days": {
                    "type": "integer",
                    "description": "Days of issuance history to use for consumption rate. Default 90.",
                },
                "lead_time_days": {
                    "type": "integer",
                    "description": "Typical days from order to receipt. Default 14.",
                },
                "safety_stock_days": {
                    "type": "integer",
                    "description": "Extra buffer days beyond lead time. Default 14.",
                },
                "filter": {
                    "type": "string",
                    "enum": ["all", "needs_attention", "expiry_risk"],
                    "description": "all = everything; needs_attention = critical + soon; expiry_risk = waste risk only.",
                },
            },
            "required": [],
        },
    },
    # ── Reporting tools ───────────────────────────────────────────────────────
    {
        "name": "report_tool_activity",
        "description": (
            "Summarize tool checkout activity over a timeframe. "
            "Returns total checkouts, top users, most-checked-out tools, "
            "average duration, and a breakdown by department."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "timeframe": {
                    "type": "string",
                    "enum": ["day", "week", "month", "quarter", "year"],
                    "description": "Period to cover. Defaults to month.",
                },
                "department": {
                    "type": "string",
                    "description": "Filter to a specific department (optional).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "report_chemical_health",
        "description": (
            "Snapshot of chemical stock health: expired, expiring-soon, "
            "low-stock, and out-of-stock counts. "
            "Set show_items=true to list the specific chemicals at risk."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "show_items": {
                    "type": "boolean",
                    "description": "true = list individual problem chemicals. Default false = counts only.",
                },
                "expiry_days": {
                    "type": "integer",
                    "description": "Days ahead to flag as expiring soon. Default 30.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "report_calibration_summary",
        "description": (
            "Calibration compliance report: overdue count, due-soon count, "
            "and lists of specific tools needing attention. "
            "Use days_ahead to control how far ahead to look for upcoming calibrations."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Days ahead to include in 'due soon' list. Default 30.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "report_procurement_summary",
        "description": (
            "Procurement pipeline snapshot: request and PO counts by status, "
            "AOG/urgent request count, late orders, and top vendors. "
            "Use timeframe to scope the period."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "timeframe": {
                    "type": "string",
                    "enum": ["week", "month", "quarter", "year", "all"],
                    "description": "Period to cover. Defaults to month.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "report_department_usage",
        "description": (
            "Tool usage breakdown by department: checkouts per department, "
            "average checkout duration, and most-used tool category. "
            "Use timeframe to scope the period."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "timeframe": {
                    "type": "string",
                    "enum": ["week", "month", "quarter", "year"],
                    "description": "Period to cover. Defaults to month.",
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
            return _tool_get_fulfillment_requests(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "get_procurement_orders":
            return _tool_get_procurement_orders(**args)
        if name == "get_inventory_summary":
            return _tool_get_inventory_summary()
        if name == "get_warehouses":
            return _tool_get_warehouses(**args)
        # Write tools — require authenticated user context
        if name == "checkout_tool":
            return _tool_checkout_tool(**args, _user_id=user_id)
        if name == "return_tool":
            return _tool_return_tool(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "issue_chemical":
            return _tool_issue_chemical(**args, _user_id=user_id)
        if name == "transfer_item":
            return _tool_transfer_item(**args, _user_id=user_id)
        if name == "get_chemical_issuances":
            return _tool_get_chemical_issuances(**args)
        if name == "return_chemical":
            return _tool_return_chemical(**args, _user_id=user_id)
        if name == "request_chemical_reorder":
            return _tool_request_chemical_reorder(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "archive_chemical":
            return _tool_archive_chemical(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "create_request":
            return _tool_create_request(**args, _user_id=user_id)
        if name == "add_request_item":
            return _tool_add_request_item(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "update_request_status":
            return _tool_update_request_status(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "mark_items_received":
            return _tool_mark_items_received(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "flag_tool_for_service":
            return _tool_flag_tool_for_service(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "return_tool_to_service":
            return _tool_return_tool_to_service(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "record_calibration":
            return _tool_record_calibration(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "get_request_detail":
            return _tool_get_request_detail(**args, _user_id=user_id, _is_admin=is_admin)
        if name == "forecast_chemicals":
            return _tool_forecast_chemicals(**args)
        if name == "report_tool_activity":
            return _report_tool_activity(**args)
        if name == "report_chemical_health":
            return _report_chemical_health(**args)
        if name == "report_calibration_summary":
            return _report_calibration_summary(**args)
        if name == "report_procurement_summary":
            return _report_procurement_summary(**args)
        if name == "report_department_usage":
            return _report_department_usage(**args)
        return {"error": f"Unknown tool: {name}"}
    except Exception:
        logger.exception("Tool %s failed", name)
        return {"error": "Tool execution failed due to an internal error."}


def _is_ai_chat_rate_limited(user_id: int | None) -> bool:
    """Return True if the user exceeded AI chat request rate limits."""
    if not user_id:
        return True

    now = time.time()
    cutoff = now - AI_CHAT_WINDOW_SECONDS

    with _ai_chat_rate_limit_lock:
        bucket = _ai_chat_request_times[user_id]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= AI_CHAT_MAX_REQUESTS_PER_WINDOW:
            return True
        bucket.append(now)
    return False


def _hostname_resolves_to_private_network(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False

    for info in infos:
        ip_str = info[4][0]
        try:
            addr = ip_address(ip_str)
        except ValueError:
            continue
        if (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
        ):
            return True
    return False


def _validate_provider_base_url(provider: str, base_url: str) -> tuple[bool, str | None]:
    """Validate provider base URL and block local/private targets for hosted providers."""
    if not base_url:
        return False, "Base URL is required for this provider."

    parsed = urlparse(base_url)
    if parsed.scheme not in ("http", "https"):
        return False, "Base URL must start with http:// or https://."
    if not parsed.netloc:
        return False, "Base URL is missing a hostname."

    host = (parsed.hostname or "").strip().lower()
    if not host:
        return False, "Base URL hostname is invalid."

    if provider in ("openai", "openrouter"):
        if host in {"localhost"} or host.endswith(".local"):
            return False, "Localhost/.local base URLs are not allowed for hosted providers."
        if _hostname_resolves_to_private_network(host):
            return False, "Private or loopback network base URLs are not allowed for hosted providers."

    return True, None


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
    today = datetime.now(timezone.utc).date()

    if overdue_only:
        q = q.filter(Checkout.expected_return_date < today)

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
            and co.expected_return_date.date() < today
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
    today = datetime.now(timezone.utc).date()
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
        cutoff = datetime.now(timezone.utc).date() + timedelta(days=expiring_within_days)
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
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not _user_id:
        return {"error": "Cannot determine current user."}

    q = UserRequest.query
    if not _has_orders_permission(_user_id, _is_admin):
        q = q.filter(UserRequest.requester_id == _user_id)
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
    today = datetime.now(timezone.utc).date()
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


def _tool_get_warehouses(query: str = "") -> dict:
    q = Warehouse.query.filter_by(is_active=True)
    if query:
        q = q.filter(Warehouse.name.ilike(f"%{query}%"))
    warehouses = q.order_by(Warehouse.name).all()
    if not warehouses:
        return {"result": "No warehouses found."}
    rows = []
    for w in warehouses:
        rows.append({
            "id": w.id,
            "name": w.name,
            "type": w.warehouse_type,
            "city": w.city,
            "state": w.state,
            "tool_count": w.tools.filter_by(status="available").count(),
            "chemical_count": w.chemicals.filter(Chemical.quantity > 0).count(),
        })
    return {"count": len(rows), "warehouses": rows}


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


def _tool_transfer_item(
    item_query: str = "",
    from_type: str = "",
    from_name: str = "",
    to_type: str = "",
    to_name: str = "",
    quantity: int = 1,
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
) -> dict:
    if not _user_id:
        return {"error": "Cannot determine current user. Please log in again."}
    if not item_query:
        return {"error": "Please specify what item to transfer (name, serial number, or part number)."}
    if from_type not in ("warehouse", "kit"):
        return {"error": "from_type must be 'warehouse' or 'kit'. Use get_warehouses or get_kits to find location names."}
    if to_type not in ("warehouse", "kit"):
        return {"error": "to_type must be 'warehouse' or 'kit'."}
    if not from_name:
        return {"error": "Please specify the source warehouse or kit name."}
    if not to_name:
        return {"error": "Please specify the destination warehouse or kit name."}

    # ── Resolve source location ───────────────────────────────────────────────
    src_warehouse = src_kit = None
    if from_type == "warehouse":
        src_warehouse = Warehouse.query.filter(Warehouse.name.ilike(f"%{from_name}%")).first()
        if not src_warehouse:
            return {"error": f"Source warehouse '{from_name}' not found. Use get_warehouses to list available warehouses."}
    else:
        src_kit = Kit.query.filter(Kit.name.ilike(f"%{from_name}%")).first()
        if not src_kit:
            return {"error": f"Source kit '{from_name}' not found. Use get_kits to list available kits."}

    # ── Resolve destination location ──────────────────────────────────────────
    dst_warehouse = dst_kit = dst_box = None
    if to_type == "warehouse":
        dst_warehouse = Warehouse.query.filter(Warehouse.name.ilike(f"%{to_name}%")).first()
        if not dst_warehouse:
            return {"error": f"Destination warehouse '{to_name}' not found. Use get_warehouses to list available warehouses."}
        if dst_warehouse.id == (src_warehouse.id if src_warehouse else None):
            return {"error": "Source and destination warehouses must be different."}
    else:
        dst_kit = Kit.query.filter(Kit.name.ilike(f"%{to_name}%")).first()
        if not dst_kit:
            return {"error": f"Destination kit '{to_name}' not found. Use get_kits to list available kits."}
        if dst_kit.id == (src_kit.id if src_kit else None):
            return {"error": "Source and destination kits must be different."}
        # Pick the first available box in the destination kit
        dst_box = KitBox.query.filter_by(kit_id=dst_kit.id).first()
        if not dst_box:
            return {"error": f"Kit '{dst_kit.name}' has no boxes. Cannot transfer items into it."}

    # ── Find the item in the source location ──────────────────────────────────
    found_item = None   # Tool or Chemical
    found_kit_item = None  # KitItem (when source is a kit)
    item_type = None

    if from_type == "warehouse":
        # Search tools first, then chemicals
        tool = Tool.query.filter(
            Tool.warehouse_id == src_warehouse.id,
            or_(
                Tool.description.ilike(f"%{item_query}%"),
                Tool.serial_number.ilike(f"%{item_query}%"),
                Tool.tool_number.ilike(f"%{item_query}%"),
            ),
        ).first()
        if tool:
            found_item = tool
            item_type = "tool"
            quantity = 1  # tools always transfer as 1
        else:
            chem = Chemical.query.filter(
                Chemical.warehouse_id == src_warehouse.id,
                or_(
                    Chemical.description.ilike(f"%{item_query}%"),
                    Chemical.part_number.ilike(f"%{item_query}%"),
                ),
            ).first()
            if chem:
                found_item = chem
                item_type = "chemical"
    else:
        # Search kit items
        kit_item = KitItem.query.filter(
            KitItem.kit_id == src_kit.id,
            or_(
                KitItem.description.ilike(f"%{item_query}%"),
                KitItem.serial_number.ilike(f"%{item_query}%"),
                KitItem.part_number.ilike(f"%{item_query}%"),
            ),
        ).first()
        if kit_item:
            found_kit_item = kit_item
            item_type = kit_item.item_type
            if item_type == "tool":
                quantity = 1
            found_item = (
                db.session.get(Tool, kit_item.item_id)
                if item_type == "tool"
                else db.session.get(Chemical, kit_item.item_id)
            )

    if not found_item:
        src_label = src_warehouse.name if src_warehouse else src_kit.name
        return {
            "error": (
                f"'{item_query}' not found in {src_label}. "
                f"Use search_tools / search_chemicals / get_kit_contents to locate the item first."
            )
        }

    # ── Validate quantity ─────────────────────────────────────────────────────
    blocking = []
    if item_type == "chemical":
        avail = found_item.quantity if from_type == "warehouse" else (found_kit_item.quantity if found_kit_item else 0)
        if quantity <= 0:
            blocking.append("Quantity must be greater than 0.")
        elif quantity > avail:
            blocking.append(f"Requested quantity ({quantity}) exceeds available stock ({avail} {found_item.unit}).")
    if item_type == "tool" and from_type == "warehouse":
        if found_item.status != "available":
            blocking.append(f"Tool status is '{found_item.status}' — only available tools can be transferred.")

    # ── Build preview ─────────────────────────────────────────────────────────
    from_label = src_warehouse.name if src_warehouse else src_kit.name
    to_label = (
        dst_warehouse.name if dst_warehouse
        else f"{dst_kit.name} › {dst_box.box_number}"
    )

    if item_type == "tool":
        item_label = f"{found_item.description} (S/N {found_item.serial_number})"
    else:
        item_label = f"{found_item.description} — P/N {found_item.part_number}, Lot {found_item.lot_number}"

    preview = {
        "action": "transfer_item",
        "item": item_label,
        "item_type": item_type,
        "quantity": quantity,
        "unit": getattr(found_item, "unit", "each"),
        "from": f"{from_type.capitalize()}: {from_label}",
        "to": f"{to_type.capitalize()}: {to_label}",
        "notes": notes or None,
        "blocking_reasons": blocking,
        "can_proceed": len(blocking) == 0,
    }

    if not confirmed:
        preview["status"] = "preview"
        preview["message"] = (
            "Ready to transfer. Reply 'confirm' to proceed."
            if preview["can_proceed"]
            else "Cannot transfer — see blocking_reasons above."
        )
        return preview

    if blocking:
        return {"error": "Cannot complete this transfer.", "blocking_reasons": blocking}

    # ── Execute transfer ──────────────────────────────────────────────────────
    user = db.session.get(User, _user_id)

    if from_type == "warehouse" and to_type == "warehouse":
        # Warehouse → Warehouse: reassign warehouse_id
        found_item.warehouse_id = dst_warehouse.id
        transfer = KitTransfer(
            item_type=item_type,
            item_id=found_item.id,
            from_location_type="warehouse",
            from_location_id=src_warehouse.id,
            to_location_type="warehouse",
            to_location_id=dst_warehouse.id,
            quantity=quantity,
            transferred_by=_user_id,
            status="completed",
            completed_date=datetime.now(),
            notes=notes or f"AI transfer: {from_label} → {to_label}",
        )

    elif from_type == "warehouse" and to_type == "kit":
        # Warehouse → Kit: create KitItem, clear warehouse_id
        if item_type == "chemical" and quantity < found_item.quantity:
            from utils.lot_utils import create_child_chemical
            child = create_child_chemical(
                parent_chemical=found_item,
                quantity=quantity,
                destination_warehouse_id=None,
            )
            db.session.add(child)
            db.session.flush()
            kit_entry = KitItem(
                kit_id=dst_kit.id,
                box_id=dst_box.id,
                item_type="chemical",
                item_id=child.id,
                part_number=child.part_number,
                lot_number=child.lot_number,
                description=child.description,
                quantity=quantity,
                status="available",
            )
            transfer_item_id = child.id
        else:
            found_item.warehouse_id = None
            kit_entry = KitItem(
                kit_id=dst_kit.id,
                box_id=dst_box.id,
                item_type=item_type,
                item_id=found_item.id,
                part_number=getattr(found_item, "tool_number", None) or getattr(found_item, "part_number", None),
                serial_number=getattr(found_item, "serial_number", None),
                lot_number=getattr(found_item, "lot_number", None),
                description=found_item.description,
                quantity=quantity,
                status="available",
            )
            transfer_item_id = found_item.id
        db.session.add(kit_entry)
        transfer = KitTransfer(
            item_type=item_type,
            item_id=transfer_item_id,
            from_location_type="warehouse",
            from_location_id=src_warehouse.id,
            to_location_type="kit",
            to_location_id=dst_kit.id,
            quantity=quantity,
            transferred_by=_user_id,
            status="completed",
            completed_date=datetime.now(),
            notes=notes or f"AI transfer: {from_label} → {to_label}",
        )

    elif from_type == "kit" and to_type == "warehouse":
        # Kit → Warehouse: restore warehouse_id, remove or reduce KitItem
        if item_type == "tool":
            found_item.warehouse_id = dst_warehouse.id
            db.session.delete(found_kit_item)
            transfer_item_id = found_item.id
        elif item_type == "chemical":
            if found_kit_item.quantity <= quantity:
                # Full return: move the existing Chemical row back to the warehouse.
                found_item.warehouse_id = dst_warehouse.id
                db.session.delete(found_kit_item)
                transfer_item_id = found_item.id
            else:
                # Partial return: the kit still holds the remaining stock.
                # Create a new Chemical row for the returned quantity so that
                # found_item (still referenced by the KitItem) stays in the kit.
                from utils.lot_utils import create_child_chemical
                child = create_child_chemical(
                    parent_chemical=found_item,
                    quantity=quantity,
                    destination_warehouse_id=dst_warehouse.id,
                )
                db.session.add(child)
                db.session.flush()
                found_kit_item.quantity -= quantity
                transfer_item_id = child.id
        else:
            transfer_item_id = found_item.id if found_item else found_kit_item.item_id
        transfer = KitTransfer(
            item_type=item_type,
            item_id=transfer_item_id,
            from_location_type="kit",
            from_location_id=src_kit.id,
            to_location_type="warehouse",
            to_location_id=dst_warehouse.id,
            quantity=quantity,
            transferred_by=_user_id,
            status="completed",
            completed_date=datetime.now(),
            notes=notes or f"AI transfer: {from_label} → {to_label}",
        )

    else:
        # Kit → Kit: move KitItem (or partial) to new kit/box
        if item_type == "chemical" and found_kit_item and quantity < found_kit_item.quantity:
            # Partial transfer: reduce source KitItem and create a new one at destination
            found_kit_item.quantity -= quantity
            new_kit_item = KitItem(
                kit_id=dst_kit.id,
                box_id=dst_box.id,
                item_type="chemical",
                item_id=found_kit_item.item_id,
                part_number=found_kit_item.part_number,
                lot_number=found_kit_item.lot_number,
                description=found_kit_item.description,
                quantity=quantity,
                status="available",
            )
            db.session.add(new_kit_item)
        else:
            # Full transfer: move the KitItem wholesale
            found_kit_item.kit_id = dst_kit.id
            found_kit_item.box_id = dst_box.id
        transfer = KitTransfer(
            item_type=item_type,
            item_id=found_item.id if found_item else found_kit_item.item_id,
            from_location_type="kit",
            from_location_id=src_kit.id,
            to_location_type="kit",
            to_location_id=dst_kit.id,
            quantity=quantity,
            transferred_by=_user_id,
            status="completed",
            completed_date=datetime.now(),
            notes=notes or f"AI transfer: {from_label} → {to_label}",
        )

    db.session.add(transfer)
    db.session.add(AuditLog(
        action_type="item_transfer",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} transferred "
            f"{quantity}x {item_label} from {from_label} to {to_label}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": f"Transferred {quantity}x {item_label} from {from_label} to {to_label} successfully.",
        "transfer_id": transfer.id,
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


# ─── Request & fulfillment workflow tools ────────────────────────────────────

def _lookup_request(request_number: str):
    """Return a UserRequest by request_number, or None."""
    return UserRequest.query.filter_by(request_number=request_number).first()


def _has_orders_permission(user_id, is_admin: bool) -> bool:
    if is_admin:
        return True
    user = db.session.get(User, user_id) if user_id else None
    if not user:
        return False
    perms = [p.name for p in getattr(user, "permissions", [])]
    return "page.orders" in perms


def _tool_create_request(
    title: str = "",
    item_description: str = "",
    item_part_number: str = "",
    item_quantity: int = 1,
    item_type: str = "tool",
    priority: str = "routine",
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
) -> dict:
    if not title or not item_description:
        return {"error": "title and item_description are required."}
    if item_type not in ("tool", "chemical", "expendable", "repairable", "other"):
        item_type = "tool"
    if priority not in ("routine", "urgent", "aog"):
        priority = "routine"
    qty = max(1, int(item_quantity) if item_quantity else 1)

    preview = {
        "action": "create_request",
        "title": title,
        "priority": priority,
        "item_description": item_description,
        "item_part_number": item_part_number or "(none)",
        "item_quantity": qty,
        "item_type": item_type,
        "notes": notes or "(none)",
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the request details above and confirm to submit."}

    if not _user_id:
        return {"error": "Cannot create request: user identity not available."}

    # Generate request number
    last = UserRequest.query.order_by(UserRequest.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    request_number = f"REQ-{next_num:05d}"

    user_req = UserRequest(
        request_number=request_number,
        title=title,
        priority=priority,
        notes=notes or None,
        requester_id=_user_id,
        request_type="manual",
        source_trigger="manual",
    )
    db.session.add(user_req)
    db.session.flush()

    # Re-derive number from actual ID after flush
    user_req.request_number = f"REQ-{user_req.id:05d}"

    item = RequestItem(
        request_id=user_req.id,
        item_type=item_type,
        part_number=item_part_number.strip() or None,
        description=item_description,
        quantity=qty,
        unit="each",
    )
    db.session.add(item)

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type="USER_REQUEST_CREATED",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} created request "
            f"'{title}' ({priority})"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type="user_request_created",
        description=f"Created request '{title}' with 1 item via AI assistant",
    ))
    db.session.commit()

    return {
        "status": "success",
        "request_number": user_req.request_number,
        "message": (
            f"Request {user_req.request_number} created: '{title}' ({priority}). "
            f"Item: {item_description} × {qty}. "
            "Use add_request_item to add more items."
        ),
    }


def _tool_add_request_item(
    request_number: str = "",
    item_description: str = "",
    item_part_number: str = "",
    item_quantity: int = 1,
    item_type: str = "tool",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not request_number or not item_description:
        return {"error": "request_number and item_description are required."}

    user_req = _lookup_request(request_number)
    if not user_req:
        return {"error": f"Request {request_number} not found."}
    if user_req.is_closed():
        return {"error": f"Request {request_number} is closed ({user_req.status}) and cannot be modified."}
    if not _user_id:
        return {"error": "Cannot add item: user identity not available."}
    if user_req.requester_id != _user_id and not _has_orders_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions. You may only modify your own requests."}

    if item_type not in ("tool", "chemical", "expendable", "repairable", "other"):
        item_type = "tool"
    qty = max(1, int(item_quantity) if item_quantity else 1)

    preview = {
        "action": "add_request_item",
        "request_number": request_number,
        "request_title": user_req.title,
        "item_description": item_description,
        "item_part_number": item_part_number or "(none)",
        "item_quantity": qty,
        "item_type": item_type,
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the item details above and confirm to add."}

    item = RequestItem(
        request_id=user_req.id,
        item_type=item_type,
        part_number=item_part_number.strip() or None,
        description=item_description,
        quantity=qty,
        unit="each",
    )
    db.session.add(item)
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Added '{item_description}' × {qty} to request {request_number}."
        ),
    }


def _tool_update_request_status(
    request_number: str = "",
    status: str = "",
    priority: str = "",
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not request_number:
        return {"error": "request_number is required."}
    if not status and not priority and not notes:
        return {"error": "At least one of status, priority, or notes must be provided."}

    valid_statuses = {
        "new", "under_review", "pending_fulfillment", "in_transfer",
        "awaiting_external_procurement", "partially_fulfilled",
        "fulfilled", "needs_info", "cancelled",
    }
    if status and status not in valid_statuses:
        return {"error": f"Invalid status '{status}'. Valid values: {', '.join(sorted(valid_statuses))}."}
    if priority and priority not in ("routine", "urgent", "aog"):
        return {"error": "Invalid priority. Must be routine, urgent, or aog."}

    user_req = _lookup_request(request_number)
    if not user_req:
        return {"error": f"Request {request_number} not found."}

    if not _has_orders_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions. Orders permission or admin required to update request status."}

    preview = {
        "action": "update_request_status",
        "request_number": request_number,
        "request_title": user_req.title,
        "current_status": user_req.status,
        "new_status": status or "(unchanged)",
        "current_priority": user_req.priority,
        "new_priority": priority or "(unchanged)",
        "notes": notes or "(none)",
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the update above and confirm to apply."}

    if not _user_id:
        return {"error": "Cannot update request: user identity not available."}

    if status:
        user_req.status = status
    if priority:
        user_req.priority = priority
    if notes:
        user_req.notes = ((user_req.notes + "\n") if user_req.notes else "") + notes

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type="USER_REQUEST_UPDATED",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} updated request "
            f"{request_number}"
            + (f" status → {status}" if status else "")
            + (f" priority → {priority}" if priority else "")
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Request {request_number} updated."
            + (f" Status: {status}." if status else "")
            + (f" Priority: {priority}." if priority else "")
        ),
    }


def _tool_mark_items_received(
    request_number: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not request_number:
        return {"error": "request_number is required."}

    user_req = _lookup_request(request_number)
    if not user_req:
        return {"error": f"Request {request_number} not found."}

    if not _has_orders_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions. Orders permission or admin required to mark items received."}

    # Find all pending/ordered/in_transit items
    receivable_statuses = {"pending", "ordered", "shipped", "in_transfer"}
    items_to_receive = [
        i for i in user_req.items.all() if i.status in receivable_statuses
    ]

    if not items_to_receive:
        return {"error": f"No pending or ordered items found in request {request_number} to mark as received."}

    preview = {
        "action": "mark_items_received",
        "request_number": request_number,
        "request_title": user_req.title,
        "items_to_mark_received": [
            {"description": i.description, "quantity": i.quantity, "status": i.status}
            for i in items_to_receive
        ],
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the items above and confirm to mark them received."}

    if not _user_id:
        return {"error": "Cannot mark items received: user identity not available."}

    for item in items_to_receive:
        item.status = "received"
        item.received_date = datetime.utcnow()
        if not item.received_quantity:
            item.received_quantity = item.quantity

    user_req.update_status_from_items()

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type="REQUEST_ITEMS_RECEIVED",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} marked {len(items_to_receive)} "
            f"item(s) received in request {request_number}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Marked {len(items_to_receive)} item(s) as received in request {request_number}. "
            f"Request status: {user_req.status}."
        ),
    }


# ─── Chemical management tools ───────────────────────────────────────────────

def _tool_get_chemical_issuances(
    chemical_id: int = 0,
    part_number: str = "",
    show_all: bool = False,
) -> dict:
    q = ChemicalIssuance.query
    if chemical_id:
        q = q.filter_by(chemical_id=chemical_id)
    elif part_number:
        matching_ids = [
            c.id for c in Chemical.query.filter(
                Chemical.part_number.ilike(f"%{part_number}%")
            ).all()
        ]
        if not matching_ids:
            return {"issuances": [], "count": 0}
        q = q.filter(ChemicalIssuance.chemical_id.in_(matching_ids))

    issuances = q.order_by(ChemicalIssuance.issue_date.desc()).limit(50).all()

    results = []
    for iss in issuances:
        total_returned = sum(r.quantity for r in iss.returns)
        remaining = iss.quantity - total_returned
        if not show_all and remaining <= 0:
            continue
        chem = db.session.get(Chemical, iss.chemical_id)
        issued_to = db.session.get(User, iss.user_id)
        results.append({
            "issuance_id": iss.id,
            "chemical_id": iss.chemical_id,
            "part_number": chem.part_number if chem else None,
            "lot_number": chem.lot_number if chem else None,
            "description": chem.description if chem else None,
            "unit": chem.unit if chem else None,
            "issued_to": issued_to.name if issued_to else iss.user_id,
            "issued_quantity": iss.quantity,
            "returned_quantity": total_returned,
            "outstanding_quantity": remaining,
            "location": iss.hangar,
            "purpose": iss.purpose,
            "issue_date": iss.issue_date.isoformat() if iss.issue_date else None,
        })
        if len(results) >= MAX_RESULTS:
            break

    return {"issuances": results, "count": len(results)}


def _tool_return_chemical(
    chemical_id: int = 0,
    issuance_id: int = 0,
    quantity: int = 0,
    warehouse_id: int = 0,
    location: str = "",
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
) -> dict:
    if not chemical_id or not issuance_id or not quantity:
        return {"error": "chemical_id, issuance_id, and quantity are all required."}
    if quantity <= 0:
        return {"error": "quantity must be greater than zero."}

    chem = db.session.get(Chemical, chemical_id)
    if not chem:
        return {"error": f"No chemical found with id {chemical_id}."}

    issuance = db.session.get(ChemicalIssuance, issuance_id)
    if not issuance or issuance.chemical_id != chemical_id:
        return {"error": "Issuance does not match the selected chemical."}

    total_returned = sum(r.quantity for r in issuance.returns)
    outstanding = issuance.quantity - total_returned
    if quantity > outstanding:
        return {"error": f"Cannot return more than the outstanding quantity ({outstanding} {chem.unit})."}

    dest_warehouse = None
    if warehouse_id:
        dest_warehouse = db.session.get(Warehouse, warehouse_id)
        if not dest_warehouse:
            return {"error": f"No warehouse found with id {warehouse_id}."}
        if not dest_warehouse.is_active:
            return {"error": f"Warehouse '{dest_warehouse.name}' is inactive."}

    issued_to = db.session.get(User, issuance.user_id)
    return_location = location or chem.location or ""
    return_warehouse_name = (dest_warehouse.name if dest_warehouse
                             else (chem.warehouse.name if chem.warehouse else "original warehouse"))

    preview = {
        "action": "return_chemical",
        "chemical": f"{chem.description} (P/N {chem.part_number}, lot {chem.lot_number})",
        "issuance_id": issuance_id,
        "originally_issued_to": issued_to.name if issued_to else issuance.user_id,
        "originally_issued_location": issuance.hangar,
        "quantity_to_return": quantity,
        "unit": chem.unit,
        "return_to_warehouse": return_warehouse_name,
        "return_location": return_location or "(unchanged)",
        "new_stock_after_return": (chem.quantity or 0) + quantity,
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the return details above and confirm to proceed."}

    if not _user_id:
        return {"error": "Cannot execute return: user identity not available."}

    effective_wh_id = warehouse_id or chem.warehouse_id
    effective_loc = location or chem.location

    chem.quantity = (chem.quantity or 0) + quantity
    chem.location = effective_loc
    chem.warehouse_id = effective_wh_id

    if chem.quantity > 0:
        chem.status = "available"
    if chem.minimum_stock_level and chem.quantity <= chem.minimum_stock_level:
        chem.status = "low_stock"

    try:
        chem.update_reorder_status()
    except Exception:
        pass

    chemical_return = ChemicalReturn(
        chemical_id=chem.id,
        issuance_id=issuance_id,
        returned_by_id=_user_id,
        quantity=quantity,
        warehouse_id=effective_wh_id,
        location=effective_loc,
        notes=notes or None,
    )
    db.session.add(chemical_return)

    try:
        record_chemical_return(
            chemical_id=chem.id,
            user_id=_user_id,
            quantity=quantity,
            location_from=issuance.hangar,
            location_to=effective_loc or return_warehouse_name,
            notes=notes or None,
        )
    except Exception:
        logger.warning("record_chemical_return failed for chemical %s", chem.id)

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type="chemical_return",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} returned {quantity} {chem.unit} "
            f"of {chem.part_number} lot {chem.lot_number} from {issuance.hangar}"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type="chemical_returned",
        description=(
            f"Returned {quantity} {chem.unit} of chemical {chem.part_number} - {chem.lot_number}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Returned {quantity} {chem.unit} of {chem.description} "
            f"(P/N {chem.part_number}, lot {chem.lot_number}). "
            f"New stock level: {chem.quantity} {chem.unit}."
        ),
        "new_stock": chem.quantity,
    }


def _tool_request_chemical_reorder(
    chemical_id: int = 0,
    requested_quantity: int = 0,
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not chemical_id or not requested_quantity:
        return {"error": "chemical_id and requested_quantity are required."}
    if requested_quantity <= 0:
        return {"error": "requested_quantity must be greater than zero."}

    chem = db.session.get(Chemical, chemical_id)
    if not chem:
        return {"error": f"No chemical found with id {chemical_id}."}

    # Check permissions — materials_manager or admin
    user = db.session.get(User, _user_id) if _user_id else None
    if not _is_admin:
        has_perm = False
        if user and user.roles:
            for role in user.roles:
                if getattr(role, "name", "").lower() in ("materials_manager", "materials manager", "admin"):
                    has_perm = True
                    break
        if not has_perm and user:
            # Check permissions list
            perms = [p.name for p in getattr(user, "permissions", [])]
            if "materials.manage" in perms:
                has_perm = True
        if not has_perm:
            return {"error": "Insufficient permissions. Materials manager role or admin required to request reorders."}

    preview = {
        "action": "request_chemical_reorder",
        "chemical": f"{chem.description} (P/N {chem.part_number}, lot {chem.lot_number})",
        "current_stock": chem.quantity,
        "unit": chem.unit,
        "requested_quantity": requested_quantity,
        "current_reorder_status": getattr(chem, "reorder_status", "unknown"),
        "notes": notes or "(none)",
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the reorder request above and confirm to submit."}

    if not _user_id:
        return {"error": "Cannot execute reorder request: user identity not available."}

    chem.needs_reorder = True
    chem.reorder_status = "needed"
    chem.reorder_date = datetime.utcnow()
    chem.requested_quantity = requested_quantity

    if notes:
        reorder_note = (
            f"\n[Reorder Request {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} "
            f"- Qty: {requested_quantity}]: {notes}"
        )
        chem.notes = (chem.notes or "") + reorder_note

    try:
        from utils.unified_requests import create_chemical_reorder_request
        user_request = create_chemical_reorder_request(
            chemical=chem,
            requested_quantity=requested_quantity,
            requester_id=_user_id,
            notes=notes,
        )
        request_number = user_request.request_number
    except Exception:
        logger.exception("Failed to create unified reorder request for chemical %s", chemical_id)
        request_number = None

    db.session.add(AuditLog(
        action_type="chemical_reorder_requested",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} requested reorder of "
            f"{chem.part_number} lot {chem.lot_number} (qty {requested_quantity})"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type="chemical_reorder_requested",
        description=(
            f"Requested reorder for chemical {chem.part_number} - {chem.lot_number} "
            f"(Qty: {requested_quantity})"
            + (f". Request #{request_number}" if request_number else "")
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Reorder request submitted for {chem.description} "
            f"(P/N {chem.part_number}, qty {requested_quantity} {chem.unit})."
            + (f" Request #{request_number} created." if request_number else "")
        ),
        "request_number": request_number,
    }


def _tool_archive_chemical(
    chemical_id: int = 0,
    reason: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not chemical_id:
        return {"error": "chemical_id is required."}
    if not reason:
        return {"error": "reason is required to archive a chemical."}

    chem = db.session.get(Chemical, chemical_id)
    if not chem:
        return {"error": f"No chemical found with id {chemical_id}."}

    if getattr(chem, "is_archived", False):
        return {"error": f"Chemical {chem.part_number} lot {chem.lot_number} is already archived."}

    # Check permissions — materials_manager or admin
    user = db.session.get(User, _user_id) if _user_id else None
    if not _is_admin:
        has_perm = False
        if user and user.roles:
            for role in user.roles:
                if getattr(role, "name", "").lower() in ("materials_manager", "materials manager", "admin"):
                    has_perm = True
                    break
        if not has_perm and user:
            perms = [p.name for p in getattr(user, "permissions", [])]
            if "materials.manage" in perms:
                has_perm = True
        if not has_perm:
            return {"error": "Insufficient permissions. Materials manager role or admin required to archive chemicals."}

    preview = {
        "action": "archive_chemical",
        "chemical": f"{chem.description} (P/N {chem.part_number}, lot {chem.lot_number})",
        "current_stock": chem.quantity,
        "unit": chem.unit,
        "expiry_date": chem.expiry_date.isoformat() if getattr(chem, "expiry_date", None) else None,
        "reason": reason,
        "warning": "This will remove the chemical from active inventory. It can be unarchived by an admin.",
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the archive details above and confirm to proceed."}

    if not _user_id:
        return {"error": "Cannot execute archive: user identity not available."}

    chem.is_archived = True
    chem.archived_reason = reason
    chem.archived_date = datetime.utcnow()

    db.session.add(AuditLog(
        action_type="chemical_archived",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} archived chemical "
            f"{chem.part_number} lot {chem.lot_number} — reason: {reason}"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type="chemical_archived",
        description=(
            f"Archived chemical {chem.part_number} - {chem.lot_number}: {reason}"
        ),
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Chemical {chem.description} (P/N {chem.part_number}, lot {chem.lot_number}) "
            f"has been archived. Reason: {reason}."
        ),
    }


# ─── Tool service & calibration tools ────────────────────────────────────────

def _has_tool_manager_permission(user_id, is_admin: bool) -> bool:
    if is_admin:
        return True
    user = db.session.get(User, user_id) if user_id else None
    if not user:
        return False
    # Check role names
    for role in getattr(user, "roles", []):
        if getattr(role, "name", "").lower() in ("materials", "tool_manager", "tool manager", "admin"):
            return True
    # Check explicit permissions
    perms = [p.name for p in getattr(user, "permissions", [])]
    return "page.tools" in perms or "tools.manage" in perms


def _tool_flag_tool_for_service(
    tool_id: int = 0,
    action: str = "maintenance",
    reason: str = "",
    comments: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not tool_id or not reason:
        return {"error": "tool_id and reason are required."}
    if action not in ("maintenance", "retire"):
        return {"error": "action must be 'maintenance' or 'retire'."}

    tool = db.session.get(Tool, tool_id)
    if not tool:
        return {"error": f"No tool found with id {tool_id}."}
    if tool.status in ("maintenance", "retired"):
        return {"error": f"Tool is already out of service (status: {tool.status})."}

    # Check for active checkout
    active = Checkout.query.filter_by(tool_id=tool_id, return_date=None).first()
    if active:
        return {"error": "Cannot flag a tool that is currently checked out. It must be returned first."}

    if not _has_tool_manager_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions. Tool manager role or admin required."}

    new_status = "maintenance" if action == "maintenance" else "retired"
    preview = {
        "action": "flag_tool_for_service",
        "tool": f"{tool.description} (S/N {tool.serial_number or tool.tool_number})",
        "current_status": tool.status,
        "new_status": new_status,
        "reason": reason,
        "comments": comments or "(none)",
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the details above and confirm to proceed."}

    if not _user_id:
        return {"error": "Cannot flag tool: user identity not available."}

    action_type = "remove_maintenance" if action == "maintenance" else "remove_permanent"
    tool.status = new_status
    tool.status_reason = reason

    db.session.add(ToolServiceRecord(
        tool_id=tool_id,
        user_id=_user_id,
        action_type=action_type,
        reason=reason,
        comments=comments or "",
    ))

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type=action_type,
        action_details=(
            f"AI assistant: {user.name if user else _user_id} flagged tool "
            f"{tool.tool_number} as {new_status} — {reason}"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type=action_type,
        description=f"Flagged tool {tool.tool_number} as {new_status}: {reason}",
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Tool {tool.description} (S/N {tool.serial_number or tool.tool_number}) "
            f"has been set to '{new_status}'. Reason: {reason}."
        ),
    }


def _tool_return_tool_to_service(
    tool_id: int = 0,
    reason: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not tool_id or not reason:
        return {"error": "tool_id and reason are required."}

    tool = db.session.get(Tool, tool_id)
    if not tool:
        return {"error": f"No tool found with id {tool_id}."}
    if tool.status not in ("maintenance", "retired"):
        return {"error": f"Tool is not out of service (current status: {tool.status})."}

    if not _has_tool_manager_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions. Tool manager role or admin required."}

    preview = {
        "action": "return_tool_to_service",
        "tool": f"{tool.description} (S/N {tool.serial_number or tool.tool_number})",
        "current_status": tool.status,
        "new_status": "available",
        "reason": reason,
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the details above and confirm to return this tool to service."}

    if not _user_id:
        return {"error": "Cannot return tool to service: user identity not available."}

    tool.status = "available"
    tool.status_reason = None

    db.session.add(ToolServiceRecord(
        tool_id=tool_id,
        user_id=_user_id,
        action_type="return_service",
        reason=reason,
        comments="",
    ))

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type="return_service",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} returned tool "
            f"{tool.tool_number} to service — {reason}"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type="return_service",
        description=f"Returned tool {tool.tool_number} to service: {reason}",
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Tool {tool.description} (S/N {tool.serial_number or tool.tool_number}) "
            f"is now available. Reason: {reason}."
        ),
    }


def _tool_record_calibration(
    tool_id: int = 0,
    calibration_status: str = "pass",
    calibration_date: str = "",
    next_calibration_date: str = "",
    notes: str = "",
    confirmed: bool = False,
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not tool_id:
        return {"error": "tool_id is required."}
    if calibration_status not in ("pass", "fail", "limited"):
        return {"error": "calibration_status must be pass, fail, or limited."}

    tool = db.session.get(Tool, tool_id)
    if not tool:
        return {"error": f"No tool found with id {tool_id}."}
    if not getattr(tool, "requires_calibration", False):
        return {"error": f"Tool {tool.tool_number} is not flagged as requiring calibration."}

    if not _has_tool_manager_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions. Tool manager role or admin required."}

    # Parse dates
    try:
        cal_date = datetime.strptime(calibration_date, "%Y-%m-%d") if calibration_date else datetime.utcnow()
    except ValueError:
        return {"error": "Invalid calibration_date format. Use YYYY-MM-DD."}

    next_date = None
    if next_calibration_date:
        try:
            next_date = datetime.strptime(next_calibration_date, "%Y-%m-%d")
        except ValueError:
            return {"error": "Invalid next_calibration_date format. Use YYYY-MM-DD."}
    elif tool.calibration_frequency_days:
        next_date = cal_date + timedelta(days=tool.calibration_frequency_days)

    preview = {
        "action": "record_calibration",
        "tool": f"{tool.description} (S/N {tool.serial_number or tool.tool_number})",
        "calibration_date": cal_date.strftime("%Y-%m-%d"),
        "calibration_status": calibration_status,
        "next_calibration_date": next_date.strftime("%Y-%m-%d") if next_date else "(not scheduled)",
        "notes": notes or "(none)",
    }

    if not confirmed:
        return {"preview": preview, "confirmed": False,
                "message": "Review the calibration details above and confirm to record."}

    if not _user_id:
        return {"error": "Cannot record calibration: user identity not available."}

    cal_record = ToolCalibration(
        tool_id=tool_id,
        calibration_date=cal_date,
        next_calibration_date=next_date,
        performed_by_user_id=_user_id,
        calibration_notes=notes or "",
        calibration_status=calibration_status,
    )
    db.session.add(cal_record)

    tool.last_calibration_date = cal_date
    tool.next_calibration_date = next_date
    try:
        tool.update_calibration_status()
    except Exception:
        pass

    user = db.session.get(User, _user_id)
    db.session.add(AuditLog(
        action_type="tool_calibration",
        action_details=(
            f"AI assistant: {user.name if user else _user_id} recorded calibration "
            f"for {tool.tool_number} — result: {calibration_status}"
        ),
    ))
    db.session.add(UserActivity(
        user_id=_user_id,
        activity_type="tool_calibration",
        description=f"Calibrated tool {tool.tool_number}: {calibration_status}",
    ))
    db.session.commit()

    return {
        "status": "success",
        "message": (
            f"Calibration recorded for {tool.description} ({tool.tool_number}): "
            f"{calibration_status}. "
            + (f"Next due: {next_date.strftime('%Y-%m-%d')}." if next_date else "No next date scheduled.")
        ),
    }


def _tool_get_request_detail(
    request_number: str = "",
    _user_id: int | None = None,
    _is_admin: bool = False,
) -> dict:
    if not request_number:
        return {"error": "request_number is required."}

    req = _lookup_request(request_number)
    if not req:
        return {"error": f"Request {request_number} not found."}
    if not _user_id:
        return {"error": "Cannot determine current user."}
    if req.requester_id != _user_id and not _has_orders_permission(_user_id, _is_admin):
        return {"error": "Insufficient permissions to view this request."}

    items = req.items.all()
    return {
        "request_number": req.request_number,
        "title": req.title,
        "status": req.status,
        "priority": req.priority,
        "requester": req.requester.name if req.requester else "Unknown",
        "buyer": req.buyer.name if req.buyer else None,
        "created_at": req.created_at.strftime("%Y-%m-%d") if req.created_at else None,
        "due_date": req.expected_due_date.strftime("%Y-%m-%d") if req.expected_due_date else None,
        "notes": req.notes,
        "destination": req.destination_location,
        "item_count": len(items),
        "items": [
            {
                "id": i.id,
                "description": i.description,
                "part_number": i.part_number,
                "quantity": i.quantity,
                "unit": i.unit,
                "type": i.item_type,
                "status": i.status,
                "vendor": i.vendor,
                "tracking_number": i.tracking_number,
                "ordered_date": i.ordered_date.strftime("%Y-%m-%d") if i.ordered_date else None,
                "expected_delivery": i.expected_delivery_date.strftime("%Y-%m-%d") if i.expected_delivery_date else None,
                "received_date": i.received_date.strftime("%Y-%m-%d") if i.received_date else None,
                "unit_cost": i.unit_cost,
                "total_cost": i.total_cost,
                "notes": i.order_notes,
            }
            for i in items
        ],
    }


# ─── Forecasting tools ────────────────────────────────────────────────────────

def _tool_forecast_chemicals(
    analysis_days: int = 90,
    lead_time_days: int = 14,
    safety_stock_days: int = 14,
    filter: str = "all",
) -> dict:
    analysis_days     = max(7,  min(int(analysis_days),     365))
    lead_time_days    = max(1,  min(int(lead_time_days),     90))
    safety_stock_days = max(0,  min(int(safety_stock_days),  90))

    now            = datetime.utcnow()
    analysis_start = now - timedelta(days=analysis_days)

    try:
        active_chems = Chemical.query.filter(
            Chemical.is_archived == False,  # noqa: E712
            Chemical.warehouse_id.isnot(None),
        ).all()
    except Exception:
        active_chems = Chemical.query.filter_by(is_archived=False).all()

    if not active_chems:
        return {"result": "No active chemicals found in inventory."}

    chem_ids = {c.id for c in active_chems}
    pn_map   = {c.id: c.part_number for c in active_chems}

    issuances = ChemicalIssuance.query.filter(
        ChemicalIssuance.issue_date >= analysis_start,
    ).all()
    returns = ChemicalReturn.query.filter(
        ChemicalReturn.return_date >= analysis_start,
    ).all()

    # Resolve part_number for child-lot chemicals
    extra_ids = {i.chemical_id for i in issuances} - chem_ids
    extra_pns = {}
    if extra_ids:
        for c in Chemical.query.filter(Chemical.id.in_(extra_ids)).all():
            extra_pns[c.id] = c.part_number

    def pn(cid):
        return pn_map.get(cid) or extra_pns.get(cid)

    issued_by_pn: dict = {}
    for i in issuances:
        p = pn(i.chemical_id)
        if p:
            issued_by_pn[p] = issued_by_pn.get(p, 0) + i.quantity

    returned_by_pn: dict = {}
    for r in returns:
        p = pn(r.chemical_id)
        if p:
            returned_by_pn[p] = returned_by_pn.get(p, 0) + r.quantity

    by_pn: dict = {}
    for c in active_chems:
        by_pn.setdefault(c.part_number, []).append(c)

    urgency_order = {"critical": 0, "soon": 1, "expiry_risk": 2, "no_data": 3, "ok": 4}
    rows = []

    for part_number, chems in by_pn.items():
        total_qty = sum(c.quantity or 0 for c in chems)
        unit      = chems[0].unit or "each"
        desc      = chems[0].description or part_number

        expiry_dates    = [c.expiration_date for c in chems if c.expiration_date]
        earliest_expiry = min(expiry_dates) if expiry_dates else None

        net_issued = max(0, issued_by_pn.get(part_number, 0) - returned_by_pn.get(part_number, 0))
        daily_rate = net_issued / analysis_days if net_issued > 0 else 0

        days_remaining = (total_qty / daily_rate) if daily_rate > 0 else None
        depletion_date = (now + timedelta(days=days_remaining)).date() if days_remaining is not None else None

        waste_qty = 0.0
        if earliest_expiry and daily_rate > 0:
            dtu = (earliest_expiry.date() - now.date()).days
            if dtu > 0:
                expiring_qty = sum(
                    c.quantity or 0 for c in chems
                    if c.expiration_date and c.expiration_date <= earliest_expiry + timedelta(days=7)
                )
                waste_qty = max(0.0, expiring_qty - daily_rate * dtu)

        if days_remaining is not None:
            if days_remaining <= lead_time_days:
                urgency = "critical"
            elif days_remaining <= lead_time_days + safety_stock_days:
                urgency = "soon"
            else:
                urgency = "ok"
        else:
            urgency = "expiry_risk" if (earliest_expiry and (earliest_expiry.date() - now.date()).days <= 30) else "no_data"

        if waste_qty > 0 and urgency == "ok":
            urgency = "expiry_risk"

        rec_qty = round((lead_time_days + safety_stock_days) * daily_rate) if daily_rate > 0 else None

        rows.append({
            "part_number":      part_number,
            "description":      desc,
            "current_qty":      total_qty,
            "unit":             unit,
            "daily_rate":       round(daily_rate, 3),
            "days_remaining":   round(days_remaining, 1) if days_remaining is not None else None,
            "depletion_date":   depletion_date.isoformat() if depletion_date else None,
            "expiry_date":      earliest_expiry.date().isoformat() if earliest_expiry else None,
            "waste_risk_qty":   round(waste_qty, 1),
            "urgency":          urgency,
            "recommended_qty":  rec_qty,
        })

    rows.sort(key=lambda x: urgency_order.get(x["urgency"], 99))

    if filter == "needs_attention":
        rows = [r for r in rows if r["urgency"] in ("critical", "soon")]
    elif filter == "expiry_risk":
        rows = [r for r in rows if r["urgency"] == "expiry_risk" or r["waste_risk_qty"] > 0]

    summary = {
        "total":        len(by_pn),
        "critical":     sum(1 for r in rows if r["urgency"] == "critical"),
        "soon":         sum(1 for r in rows if r["urgency"] == "soon"),
        "expiry_risk":  sum(1 for r in rows if r["urgency"] == "expiry_risk"),
        "ok":           sum(1 for r in rows if r["urgency"] == "ok"),
        "no_data":      sum(1 for r in rows if r["urgency"] == "no_data"),
    }

    return {
        "summary":          summary,
        "analysis_days":    analysis_days,
        "lead_time_days":   lead_time_days,
        "forecasts":        rows[:MAX_RESULTS],
    }


# ─── Reporting tools ──────────────────────────────────────────────────────────

def _timeframe_start(timeframe: str) -> datetime:
    now = datetime.utcnow()
    mapping = {
        "day":     timedelta(days=1),
        "week":    timedelta(weeks=1),
        "month":   timedelta(days=30),
        "quarter": timedelta(days=90),
        "year":    timedelta(days=365),
        "all":     timedelta(days=36500),
    }
    return now - mapping.get(timeframe, timedelta(days=30))


def _report_tool_activity(
    timeframe: str = "month",
    department: str = "",
) -> dict:
    start = _timeframe_start(timeframe)

    q = Checkout.query.filter(Checkout.checkout_date >= start)
    if department:
        q = q.join(User, Checkout.user_id == User.id).filter(
            User.department.ilike(f"%{department}%")
        )
    checkouts = q.all()

    if not checkouts:
        return {"result": f"No checkout activity found in the last {timeframe}."}

    total = len(checkouts)
    active = sum(1 for c in checkouts if c.return_date is None)
    durations = [
        max((c.return_date - c.checkout_date).days, 0)
        for c in checkouts if c.return_date
    ]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None

    # Top 5 users
    user_counts: dict = {}
    for c in checkouts:
        name = c.user.name if c.user else "Unknown"
        user_counts[name] = user_counts.get(name, 0) + 1
    top_users = sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    # Top 5 tools
    tool_counts: dict = {}
    for c in checkouts:
        label = (c.tool.description or c.tool.tool_number) if c.tool else "Unknown"
        tool_counts[label] = tool_counts.get(label, 0) + 1
    top_tools = sorted(tool_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    # By department
    dept_counts: dict = {}
    for c in checkouts:
        dept = (c.user.department or "Unassigned") if c.user else "Unknown"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
    by_dept = sorted(dept_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        "timeframe": timeframe,
        "total_checkouts": total,
        "currently_active": active,
        "avg_duration_days": avg_duration,
        "top_users": [{"name": n, "checkouts": v} for n, v in top_users],
        "top_tools": [{"tool": t, "checkouts": v} for t, v in top_tools],
        "by_department": [{"department": d, "checkouts": v} for d, v in by_dept],
    }


def _report_chemical_health(
    show_items: bool = False,
    expiry_days: int = 30,
) -> dict:
    now = datetime.utcnow()
    expiry_threshold = now + timedelta(days=max(1, expiry_days))

    all_chem = Chemical.query.filter_by(is_archived=False).all() if hasattr(Chemical, "is_archived") else Chemical.query.all()

    expired, expiring, low, out = [], [], [], []
    for c in all_chem:
        label = f"{c.description} (P/N {c.part_number}, lot {c.lot_number})"
        if c.expiration_date and c.expiration_date < now:
            expired.append({"chemical": label, "expired": c.expiration_date.strftime("%Y-%m-%d"), "qty": c.quantity, "unit": c.unit})
        elif c.expiration_date and c.expiration_date <= expiry_threshold:
            days_left = (c.expiration_date - now).days
            expiring.append({"chemical": label, "expires": c.expiration_date.strftime("%Y-%m-%d"), "days_left": days_left, "qty": c.quantity, "unit": c.unit})
        if c.status == "low_stock":
            low.append({"chemical": label, "qty": c.quantity, "min": c.minimum_stock_level, "unit": c.unit})
        elif c.status == "out_of_stock":
            out.append({"chemical": label, "unit": c.unit})

    result: dict = {
        "total_chemicals": len(all_chem),
        "expired_count": len(expired),
        "expiring_soon_count": len(expiring),
        "expiry_window_days": expiry_days,
        "low_stock_count": len(low),
        "out_of_stock_count": len(out),
    }
    if show_items:
        result["expired"] = expired[:15]
        result["expiring_soon"] = sorted(expiring, key=lambda x: x["days_left"])[:15]
        result["low_stock"] = low[:15]
        result["out_of_stock"] = out[:15]

    return result


def _report_calibration_summary(days_ahead: int = 30) -> dict:
    now = datetime.utcnow()
    threshold = now + timedelta(days=max(1, days_ahead))

    calibration_tools = Tool.query.filter(Tool.requires_calibration.is_(True)).all()

    overdue, due_soon, current = [], [], []
    for t in calibration_tools:
        label = f"{t.description} (S/N {t.serial_number or t.tool_number})"
        if t.calibration_status == "overdue":
            days_past = (
                -int((t.next_calibration_date - now).days)
                if t.next_calibration_date else None
            )
            overdue.append({"tool": label, "days_overdue": days_past})
        elif t.calibration_status == "due_soon" or (
            t.next_calibration_date and now <= t.next_calibration_date <= threshold
        ):
            days_left = int((t.next_calibration_date - now).days) if t.next_calibration_date else None
            due_soon.append({"tool": label, "days_until_due": days_left, "due_date": t.next_calibration_date.strftime("%Y-%m-%d") if t.next_calibration_date else None})
        else:
            current.append(t)

    due_soon.sort(key=lambda x: (x["days_until_due"] is None, x["days_until_due"] or 0))
    overdue.sort(key=lambda x: (x["days_overdue"] is None, -(x["days_overdue"] or 0)))

    return {
        "total_requiring_calibration": len(calibration_tools),
        "current": len(current),
        "due_soon_count": len(due_soon),
        "overdue_count": len(overdue),
        "due_within_days": days_ahead,
        "overdue_tools": overdue[:20],
        "due_soon_tools": due_soon[:20],
    }


def _report_procurement_summary(timeframe: str = "month") -> dict:
    start = _timeframe_start(timeframe)
    now = datetime.utcnow()

    requests = UserRequest.query.filter(UserRequest.created_at >= start).all()
    orders = ProcurementOrder.query.filter(ProcurementOrder.created_at >= start).all()

    # Request breakdown
    req_by_status: dict = {}
    for r in requests:
        req_by_status[r.status] = req_by_status.get(r.status, 0) + 1

    aog_count = sum(1 for r in requests if r.priority == "aog")
    urgent_count = sum(1 for r in requests if r.priority == "urgent")
    open_requests = sum(1 for r in requests if not r.is_closed())

    # PO breakdown
    po_by_status: dict = {}
    for o in orders:
        po_by_status[o.status] = po_by_status.get(o.status, 0) + 1

    late_orders = sum(
        1 for o in orders
        if o.expected_due_date and o.expected_due_date < now
        and o.status not in ("received", "cancelled")
    )

    # Avg processing time (completed orders)
    completed = [o for o in orders if o.completed_date and o.created_at]
    avg_days = None
    if completed:
        avg_days = round(sum((o.completed_date - o.created_at).days for o in completed) / len(completed), 1)

    # Top vendors
    vendor_counts: dict = {}
    for o in orders:
        if o.vendor:
            vendor_counts[o.vendor] = vendor_counts.get(o.vendor, 0) + 1
    top_vendors = sorted(vendor_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "timeframe": timeframe,
        "requests": {
            "total": len(requests),
            "open": open_requests,
            "aog": aog_count,
            "urgent": urgent_count,
            "by_status": req_by_status,
        },
        "procurement_orders": {
            "total": len(orders),
            "late": late_orders,
            "avg_processing_days": avg_days,
            "by_status": po_by_status,
        },
        "top_vendors": [{"vendor": v, "orders": c} for v, c in top_vendors],
    }


def _report_department_usage(timeframe: str = "month") -> dict:
    start = _timeframe_start(timeframe)

    checkouts = (
        Checkout.query
        .filter(Checkout.checkout_date >= start)
        .join(User, Checkout.user_id == User.id)
        .all()
    )

    if not checkouts:
        return {"result": f"No checkout activity found for the last {timeframe}."}

    # Aggregate per department
    dept_data: dict = {}
    for c in checkouts:
        dept = (c.user.department or "Unassigned") if c.user else "Unknown"
        if dept not in dept_data:
            dept_data[dept] = {"checkouts": 0, "durations": [], "categories": {}}
        dept_data[dept]["checkouts"] += 1
        if c.return_date:
            dept_data[dept]["durations"].append(max((c.return_date - c.checkout_date).days, 0))
        cat = (c.tool.category or "General") if c.tool else "Unknown"
        cats = dept_data[dept]["categories"]
        cats[cat] = cats.get(cat, 0) + 1

    rows = []
    for dept, data in sorted(dept_data.items(), key=lambda x: x[1]["checkouts"], reverse=True):
        avg_dur = round(sum(data["durations"]) / len(data["durations"]), 1) if data["durations"] else None
        top_cat = max(data["categories"].items(), key=lambda x: x[1])[0] if data["categories"] else None
        rows.append({
            "department": dept,
            "checkouts": data["checkouts"],
            "avg_duration_days": avg_dur,
            "top_category": top_cat,
        })

    return {
        "timeframe": timeframe,
        "total_checkouts": len(checkouts),
        "departments": rows,
    }


# ─── Schema converters ────────────────────────────────────────────────────────

def _select_tool_definitions(provider: str) -> list:
    """Return the appropriate tool definitions list for the given provider.

    Ollama (local small models) gets a curated short list so models like
    Gemma 4B don't get confused by too many choices.
    All other providers (Claude, OpenAI, OpenRouter) get the full list.
    """
    if provider == "ollama":
        return [t for t in TOOL_DEFINITIONS if t["name"] in OLLAMA_TOOL_NAMES]
    return TOOL_DEFINITIONS


def _claude_tools(definitions: list | None = None) -> list:
    """Convert tool definitions to Anthropic's tool schema format."""
    source = definitions if definitions is not None else TOOL_DEFINITIONS
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["parameters"],
        }
        for t in source
    ]


def _openai_tools(definitions: list | None = None) -> list:
    """Convert tool definitions to OpenAI's tool schema format."""
    source = definitions if definitions is not None else TOOL_DEFINITIONS
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        }
        for t in source
    ]


# ─── Provider agentic loops ───────────────────────────────────────────────────

def _run_claude_loop(
    api_key: str,
    model: str,
    system_prompt: str,
    messages: list,
    user_id: int | None = None,
    is_admin: bool = False,
    tool_definitions: list | None = None,
) -> str:
    current_messages = [m.copy() for m in messages]
    tools = _claude_tools(tool_definitions)
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    for _iteration in range(MAX_TOOL_ITERATIONS):
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
        return f"(Unexpected stop reason: {stop_reason})"

    return "I reached the maximum number of tool calls without completing the query. Please try a more specific question."


def _run_openai_loop(
    api_key: str,
    model: str,
    base_url: str,
    system_prompt: str,
    messages: list,
    user_id: int | None = None,
    is_admin: bool = False,
    tool_definitions: list | None = None,
) -> str:
    current_messages = [{"role": "system", "content": system_prompt}] + [m.copy() for m in messages]
    tools = _openai_tools(tool_definitions)
    headers = {"content-type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    for _iteration in range(MAX_TOOL_ITERATIONS):
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
        if not resp.ok:
            logger.error("OpenAI-compat API error %s: %s", resp.status_code, resp.text[:500])
            resp.raise_for_status()
        if not resp.text.strip():
            logger.error("OpenAI-compat API returned empty body (status %s)", resp.status_code)
            return "The AI provider returned an empty response. The model may not be available or may not support tool use."
        try:
            data = resp.json()
        except Exception:
            logger.error("OpenAI-compat API returned non-JSON (status %s): %s", resp.status_code, resp.text[:500])
            return f"The AI provider returned an unexpected response: {resp.text[:200]}"

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
                    logger.warning("Failed to parse tool arguments for %s: %r", fn.get("name"), fn.get("arguments"))
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
        user_role = "Administrator" if (user_obj and user_obj.is_admin) else "Standard User"
    except Exception:
        user_role = "Standard User"

    return f"""You are the SupplyLine AI Assistant embedded in the SupplyLine MRO Suite — an inventory management system for aviation/aerospace Maintenance, Repair, and Operations organizations.

## Current User
- Role: {user_role}

## Query tools (read-only)
Call these freely whenever you need live data:
- search_tools — find tools by name, serial number, status, or category
- get_active_checkouts — see who has tools checked out right now
- get_calibration_status — find overdue or upcoming calibrations
- search_chemicals — find chemicals by name, part number, or expiration
- get_chemical_issuances — list active/outstanding chemical issuance records
- get_warehouses — list warehouses with tool and chemical counts
- get_kits — list mobile warehouse kits and their locations
- get_kit_contents — see what is inside a specific kit
- get_kit_reorders — pending restock requests for kits
- get_fulfillment_requests — user RFQs and their status
- get_procurement_orders — purchase orders with vendor and tracking info
- get_inventory_summary — fresh snapshot of all key counts

## Reporting tools (aggregated summaries — read-only)
Use these for trend questions, compliance questions, and management summaries:
- report_tool_activity — checkout totals, top users, top tools, by-department breakdown for a timeframe
- report_chemical_health — expired / expiring-soon / low-stock / out-of-stock counts; set show_items=true for the specific chemicals
- report_calibration_summary — overdue and due-soon counts with lists of specific tools needing attention
- report_procurement_summary — request and PO counts by status, late orders, avg processing time, top vendors
- report_department_usage — checkouts per department, avg duration, most-used tool category

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
- return_chemical — return issued chemical quantity back to stock
    Tip: use get_chemical_issuances first to find the issuance_id.
- request_chemical_reorder — flag a chemical for reorder and create a procurement request
    (requires materials manager role or admin)
- archive_chemical — archive a depleted or expired chemical from active inventory
    (requires materials manager role or admin)
- transfer_item — move a tool or chemical between any two locations
    (warehouse→warehouse, warehouse→kit, kit→warehouse, kit→kit)
    Tip: use get_warehouses and get_kits first to confirm names, then
    use search_tools / get_kit_contents to confirm the item exists at the source.
- flag_tool_for_service — remove a tool from service for maintenance or permanent retirement
    (requires tool manager role or admin)
- return_tool_to_service — bring a tool back from maintenance to available
    (requires tool manager role or admin)
- record_calibration — record a completed calibration (pass/fail/limited) for a tool
    (requires tool manager role or admin)
- create_request — submit a new procurement/fulfillment request for one item
- add_request_item — add another item to an existing open request
- get_request_detail — get full item-level detail on a single request by number
- update_request_status — change status or priority of a request
    (requires orders permission or admin)
- mark_items_received — acknowledge receipt of all pending/ordered items in a request
    (requires orders permission or admin)

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
        effective_provider = provider or _load_ai_config().get("provider", "claude")

        if "enabled" in payload:
            _set_setting(AI_ENABLED_KEY, "true" if payload["enabled"] else "false", user_id=user_id)
        if provider:
            _set_setting(AI_PROVIDER_KEY, provider, user_id=user_id)
        if "api_key" in payload:
            _set_setting(AI_API_KEY_KEY, payload["api_key"], sensitive=True, user_id=user_id)
        if "model" in payload:
            _set_setting(AI_MODEL_KEY, payload["model"], user_id=user_id)
        if "base_url" in payload:
            ok, error = _validate_provider_base_url(effective_provider, payload["base_url"])
            if not ok:
                return jsonify({"error": error}), 400
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
        # Normalize OpenRouter base URL — the UI may save the root domain; the API lives under /api
        if provider == "openrouter" and base_url.rstrip("/") == "https://openrouter.ai":
            base_url = "https://openrouter.ai/api"

        system_prompt = _build_system_prompt(request.current_user)

        user_id  = request.current_user.get("user_id")
        is_admin = request.current_user.get("is_admin", False)
        if _is_ai_chat_rate_limited(user_id):
            return jsonify({"error": "AI chat rate limit exceeded. Please wait a minute and try again."}), 429

        if provider in ("openai", "openrouter", "ollama"):
            ok, error = _validate_provider_base_url(provider, base_url)
            if not ok:
                return jsonify({"error": error}), 400

        # Select tool set based on provider: Ollama gets a short list for
        # small-model compatibility; all other providers get the full set.
        tool_defs = _select_tool_definitions(provider)

        try:
            if provider == "claude":
                reply = _run_claude_loop(api_key, model, system_prompt, messages,
                                         user_id=user_id, is_admin=is_admin,
                                         tool_definitions=tool_defs)
            elif provider in ("openai", "openrouter", "ollama"):
                reply = _run_openai_loop(api_key, model, base_url, system_prompt, messages,
                                         user_id=user_id, is_admin=is_admin,
                                         tool_definitions=tool_defs)
            else:
                return jsonify({"error": f"Unsupported provider: {provider}"}), 400

        except requests.exceptions.ConnectionError:
            logger.exception("AI provider connection error")
            return jsonify({"error": "Could not connect to the AI provider. Check the base URL and network connectivity."}), 502
        except requests.exceptions.Timeout:
            return jsonify({"error": "AI provider request timed out. Try again."}), 504
        except requests.exceptions.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 500
            logger.error("AI provider HTTP error %s (request-id: %s)", status_code,
                         exc.response.headers.get("x-request-id", "n/a") if exc.response is not None else "n/a")
            if status_code == 401:
                return jsonify({"error": "Invalid API key. Check the AI settings."}), 502
            if status_code == 429:
                return jsonify({"error": "AI provider rate limit reached. Try again in a moment."}), 502
            return jsonify({"error": f"AI provider returned an error ({status_code}). Check settings and try again."}), 502
        except Exception:
            logger.exception("Unexpected AI chat error")
            return jsonify({"error": "An unexpected error occurred. Please try again."}), 500

        return jsonify({"reply": reply, "provider": provider, "model": model})
