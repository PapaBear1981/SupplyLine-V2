"""Shared business logic for sending tools to / returning tools from kits.

Used by both:

- ``routes_kit_tool_checkout.py`` — kit-centric endpoints
  (``POST /api/kits/<kit_id>/tool-checkouts``, etc.) that pre-date the
  field-deployment refactor.
- ``routes_tool_field_deployment.py`` — tool-centric endpoints
  (``POST /api/tools/<tool_id>/send-to-field``, etc.) introduced when Kit
  Management was hidden from end users.

Returning a ``(payload, status)`` tuple keeps the callers thin and lets us
share validation/audit/history side-effects without duplicating them.
"""

from __future__ import annotations

import logging
from datetime import datetime

from flask import request
from sqlalchemy.exc import IntegrityError

from models import AuditLog, Checkout, Tool, ToolHistory, UserActivity, db
from models_kits import Kit, KitToolCheckout


logger = logging.getLogger(__name__)


def is_tool_available(tool: Tool) -> tuple[bool, list[str]]:
    """Return (available, [blocking_reason_strings])."""
    reasons: list[str] = []

    active_user_checkout = Checkout.query.filter_by(
        tool_id=tool.id, return_date=None
    ).first()
    if active_user_checkout:
        user_name = (
            active_user_checkout.user.name if active_user_checkout.user else "Unknown"
        )
        reasons.append(f"Tool is already checked out to {user_name}")

    active_kit_checkout = KitToolCheckout.query.filter_by(
        tool_id=tool.id, status="active"
    ).first()
    if active_kit_checkout:
        kit_name = (
            active_kit_checkout.kit.name if active_kit_checkout.kit else "Unknown"
        )
        reasons.append(f"Tool is already deployed to kit {kit_name}")

    if tool.status == "maintenance":
        reasons.append(
            f"Tool is in maintenance: {tool.status_reason or 'No reason provided'}"
        )
    if tool.status == "retired":
        reasons.append(
            f"Tool has been retired: {tool.status_reason or 'No reason provided'}"
        )
    if tool.condition and tool.condition.lower() in ("damaged", "unusable", "broken"):
        reasons.append(f"Tool is marked as {tool.condition}")
    if tool.requires_calibration and tool.calibration_status == "overdue":
        reasons.append("Tool calibration is overdue")

    return len(reasons) == 0, reasons


def _parse_expected_return_date(raw):
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "").replace("+00:00", ""))
    except (ValueError, TypeError, AttributeError):
        return None


def send_tool_to_kit(
    *,
    tool_id: int,
    kit_id: int,
    current_user_id: int,
    notes: str | None = None,
    expected_return_date_raw: str | None = None,
) -> tuple[dict, int]:
    """Deploy a tool to a kit. Returns (response_body, http_status)."""
    kit = db.session.get(Kit, kit_id)
    if not kit:
        return {"error": "Kit not found"}, 404
    if kit.status not in ("active", "deployed"):
        return {"error": f"Kit is not active (status: {kit.status})"}, 409

    tool = db.session.get(Tool, tool_id)
    if not tool:
        return {"error": f"Tool {tool_id} not found"}, 404

    available, blocking_reasons = is_tool_available(tool)
    if not available:
        return {
            "error": "Tool cannot be sent to kit",
            "blocking_reasons": blocking_reasons,
        }, 409

    expected_return_date = _parse_expected_return_date(expected_return_date_raw)

    previous_location = tool.location
    previous_warehouse_id = tool.warehouse_id

    try:
        ktc = KitToolCheckout(
            tool_id=tool_id,
            kit_id=kit_id,
            checked_out_by_id=current_user_id,
            expected_return_date=expected_return_date,
            previous_location=previous_location,
            previous_warehouse_id=previous_warehouse_id,
            notes=notes,
            status="active",
        )
        db.session.add(ktc)

        old_status = tool.status
        tool.status = "checked_out"
        tool.location = f"Kit: {kit.name}"

        db.session.flush()

        history = ToolHistory.create_event(
            tool_id=tool_id,
            event_type="kit_deployment",
            user_id=current_user_id,
            description=f"Deployed to kit {kit.name}",
            details={
                "kit_id": kit_id,
                "kit_name": kit.name,
                "notes": notes,
                "expected_return_date": (
                    expected_return_date.isoformat() if expected_return_date else None
                ),
            },
            old_status=old_status,
            new_status="checked_out",
        )
        db.session.add(history)

        AuditLog.log(
            user_id=current_user_id,
            action="kit_tool_checkout",
            resource_type="tool",
            resource_id=tool_id,
            details={
                "tool_number": tool.tool_number,
                "kit_id": kit_id,
                "kit_name": kit.name,
                "kit_tool_checkout_id": ktc.id,
            },
            ip_address=request.remote_addr if request else None,
        )

        activity = UserActivity(
            user_id=current_user_id,
            activity_type="kit_tool_checkout",
            description=f"Sent tool {tool.tool_number} to kit {kit.name}",
            ip_address=request.remote_addr if request else None,
        )
        db.session.add(activity)

        db.session.commit()

        logger.info(
            "Tool %s sent to kit %s by user %s",
            tool.tool_number,
            kit.name,
            current_user_id,
        )

        return {
            "message": f"Tool {tool.tool_number} sent to kit {kit.name}",
            "kit_tool_checkout": ktc.to_dict(),
        }, 201

    except IntegrityError:
        db.session.rollback()
        logger.warning("Concurrent checkout attempt for tool_id=%s", tool_id)
        return {
            "error": "Tool is already deployed to a kit (concurrent request)"
        }, 409


def return_kit_tool_checkout(
    *,
    ktc: KitToolCheckout,
    current_user_id: int,
    return_notes: str | None = None,
) -> tuple[dict, int]:
    """Close an active KitToolCheckout. Returns (response_body, http_status)."""
    if ktc.status != "active":
        return {"error": "This tool has already been returned"}, 409

    tool = db.session.get(Tool, ktc.tool_id)
    if not tool:
        return {"error": "Tool not found"}, 404

    ktc.return_date = datetime.now()
    ktc.returned_by_id = current_user_id
    ktc.return_notes = return_notes
    ktc.status = "returned"

    tool.status = "available"
    tool.location = ktc.previous_location or tool.location
    if ktc.previous_warehouse_id:
        tool.warehouse_id = ktc.previous_warehouse_id

    kit_name = ktc.kit.name if ktc.kit else f"Kit {ktc.kit_id}"

    history = ToolHistory.create_event(
        tool_id=tool.id,
        event_type="kit_return",
        user_id=current_user_id,
        description=f"Returned from kit {kit_name}",
        details={
            "kit_id": ktc.kit_id,
            "kit_name": kit_name,
            "return_notes": return_notes,
            "kit_tool_checkout_id": ktc.id,
        },
        old_status="checked_out",
        new_status="available",
    )
    db.session.add(history)

    AuditLog.log(
        user_id=current_user_id,
        action="kit_tool_return",
        resource_type="tool",
        resource_id=tool.id,
        details={
            "tool_number": tool.tool_number,
            "kit_id": ktc.kit_id,
            "kit_name": kit_name,
            "kit_tool_checkout_id": ktc.id,
        },
        ip_address=request.remote_addr if request else None,
    )

    activity = UserActivity(
        user_id=current_user_id,
        activity_type="kit_tool_return",
        description=f"Returned tool {tool.tool_number} from kit {kit_name}",
        ip_address=request.remote_addr if request else None,
    )
    db.session.add(activity)

    db.session.commit()

    return {
        "message": f"Tool {tool.tool_number} returned from {kit_name}",
        "kit_tool_checkout": ktc.to_dict(),
    }, 200
