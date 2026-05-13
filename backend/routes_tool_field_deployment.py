"""Tool-centric field-deployment routes.

These endpoints power the **Send to Field** / **Return from Field** actions
on the Tools page introduced when Kit Management was hidden from end users.
They are thin wrappers over the existing kit-tool-checkout service so the
underlying audit / history / availability rules stay unified with the
legacy kit-centric endpoints in ``routes_kit_tool_checkout.py``.
"""

from __future__ import annotations

import logging

from flask import jsonify, request

from auth.jwt_manager import department_required
from models import Tool, db
from models_kits import Kit, KitToolCheckout
from services.kit_tool_checkout_service import (
    return_kit_tool_checkout,
    send_tool_to_kit,
)


logger = logging.getLogger(__name__)


materials_required = department_required("Materials")


def register_tool_field_deployment_routes(app):
    """Register tool-centric send/return/history endpoints."""

    # ------------------------------------------------------------------ #
    # Send a specific tool to a (pre-registered) field location          #
    # ------------------------------------------------------------------ #
    @app.route("/api/tools/<int:tool_id>/send-to-field", methods=["POST"])
    @materials_required
    def send_tool_to_field(tool_id):
        """Send a tool to a registered field location (kit).

        Body:
          kit_id              (required) int — pick from the strict catalogue
          notes               (optional) str
          expected_return_date (optional) ISO date string
        """
        try:
            data = request.get_json() or {}
            kit_id = data.get("kit_id")
            if not kit_id:
                return jsonify({"error": "kit_id is required"}), 400

            payload, status = send_tool_to_kit(
                tool_id=tool_id,
                kit_id=kit_id,
                current_user_id=request.current_user.get("user_id"),
                notes=data.get("notes"),
                expected_return_date_raw=data.get("expected_return_date"),
            )
            return jsonify(payload), status
        except Exception:
            db.session.rollback()
            logger.exception("Error sending tool %s to field", tool_id)
            return jsonify({"error": "An unexpected error occurred"}), 500

    # ------------------------------------------------------------------ #
    # Return a tool from the field (finds the active checkout for tool)  #
    # ------------------------------------------------------------------ #
    @app.route("/api/tools/<int:tool_id>/return-from-field", methods=["POST"])
    @materials_required
    def return_tool_from_field(tool_id):
        """Close the active KitToolCheckout for a given tool.

        Body:
          return_notes  (optional) str
        """
        try:
            data = request.get_json() or {}

            tool = db.session.get(Tool, tool_id)
            if not tool:
                return jsonify({"error": f"Tool {tool_id} not found"}), 404

            ktc = KitToolCheckout.query.filter_by(
                tool_id=tool_id, status="active"
            ).first()
            if not ktc:
                return jsonify(
                    {"error": "Tool is not currently deployed to a field location"}
                ), 404

            payload, status = return_kit_tool_checkout(
                ktc=ktc,
                current_user_id=request.current_user.get("user_id"),
                return_notes=data.get("return_notes"),
            )
            return jsonify(payload), status
        except Exception:
            db.session.rollback()
            logger.exception("Error returning tool %s from field", tool_id)
            return jsonify({"error": "An unexpected error occurred"}), 500

    # ------------------------------------------------------------------ #
    # Field-deployment history for a tool                                 #
    # ------------------------------------------------------------------ #
    @app.route("/api/tools/<int:tool_id>/field-history", methods=["GET"])
    @materials_required
    def get_tool_field_history(tool_id):
        """Return every past + current KitToolCheckout for the tool, newest first."""
        tool = db.session.get(Tool, tool_id)
        if not tool:
            return jsonify({"error": f"Tool {tool_id} not found"}), 404

        rows = (
            KitToolCheckout.query.filter_by(tool_id=tool_id)
            .order_by(KitToolCheckout.checkout_date.desc())
            .all()
        )

        active = next((r for r in rows if r.status == "active"), None)
        active_kit = None
        if active is not None:
            kit = db.session.get(Kit, active.kit_id)
            if kit:
                active_kit = {
                    "kit_id": kit.id,
                    "kit_name": kit.name,
                    "aircraft_tail_number": kit.aircraft_tail_number,
                    "tanker_scooper_number": kit.tanker_scooper_number,
                    "trailer_number": kit.trailer_number,
                }

        return jsonify(
            {
                "tool_id": tool_id,
                "active_deployment": active.to_dict() if active else None,
                "active_kit": active_kit,
                "history": [r.to_dict() for r in rows],
                "total": len(rows),
            }
        ), 200
