"""Tool inventory routes.

CRUD, search, retirement, service-out / service-return, and tool-level
checkout history for the Tool model. Extracted from routes.py to keep
that file focused on a smaller set of concerns.
"""

import logging
from datetime import datetime, timedelta

from flask import jsonify, request

from auth import admin_required, department_required, jwt_required
from models import (
    AuditLog,
    Checkout,
    Tool,
    ToolCalibration,
    ToolCalibrationStandard,
    ToolServiceRecord,
    UserActivity,
    db,
)
from utils.error_handler import ValidationError
from utils.validation import validate_serial_number_format, validate_warehouse_id


logger = logging.getLogger(__name__)

# Decorator aliases matching other route modules
login_required = jwt_required
tool_manager_required = department_required("Materials")
materials_manager_required = department_required("Materials")


def register_tool_routes(app):
    @app.route("/api/tools", methods=["GET", "POST"])
    @login_required
    def tools_route():
        current_user_id = request.current_user.get("user_id")
        # GET - List all tools with pagination
        if request.method == "GET":
            # PERFORMANCE: Add pagination to prevent unbounded dataset returns
            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 50, type=int)
            search_query = request.args.get("q")

            # Validate pagination parameters
            if page < 1:
                return jsonify({"error": "Page must be >= 1"}), 400
            if per_page < 1 or per_page > 1000:
                return jsonify({"error": "Per page must be between 1 and 1000"}), 400

            logger.debug("Tools list requested", extra={
                "has_search_query": bool(search_query),
                "page": page,
                "per_page": per_page
            })

            # Build query
            query = Tool.query

            if search_query:
                search_term = f"%{search_query.lower()}%"
                try:
                    query = query.filter(
                        db.or_(
                            db.func.lower(Tool.tool_number).like(search_term),
                            db.func.lower(Tool.serial_number).like(search_term),
                            db.func.lower(Tool.description).like(search_term),
                            db.func.lower(Tool.location).like(search_term)
                        )
                    )
                    logger.debug("Tools search filter applied")
                except Exception:
                    logger.exception("Error during tools search filter")

            # Apply pagination
            try:
                pagination = query.paginate(page=page, per_page=per_page, error_out=False)
                tools = pagination.items
                total_count = pagination.total
                logger.debug("Tools retrieved with pagination", extra={
                    "result_count": len(tools),
                    "total_count": total_count,
                    "page": page,
                    "pages": pagination.pages
                })
            except Exception:
                logger.exception("Error during pagination")
                return jsonify({"error": "Failed to retrieve tools"}), 500

            # Get checkout status for each tool
            tool_status = {}
            active_checkouts = Checkout.query.filter(Checkout.return_date.is_(None)).all()
            logger.debug("Active checkouts fetched", extra={"active_checkout_count": len(active_checkouts)})

            for checkout in active_checkouts:
                tool_status[checkout.tool_id] = "checked_out"

            # Get kit and box information for tools
            from models_kits import KitItem
            tool_kit_info = {}
            kit_items = KitItem.query.filter(
                KitItem.item_type == "tool",
                KitItem.item_id.in_([t.id for t in tools])
            ).all()

            for kit_item in kit_items:
                tool_kit_info[kit_item.item_id] = {
                    "kit_id": kit_item.kit_id,
                    "kit_name": kit_item.kit.name if kit_item.kit else None,
                    "box_id": kit_item.box_id,
                    "box_number": kit_item.box.box_number if kit_item.box else None
                }

            tools_data = [{
                "id": t.id,
                "tool_number": t.tool_number,
                "serial_number": t.serial_number,
                "description": t.description,
                "condition": t.condition,
                "location": t.location,
                "category": getattr(t, "category", "General"),  # Use 'General' if category attribute doesn't exist
                "status": tool_status.get(t.id, getattr(t, "status", "available")),  # Use 'available' if status attribute doesn't exist
                "status_reason": getattr(t, "status_reason", None) if getattr(t, "status", "available") in ["maintenance", "retired"] else None,
                "warehouse_id": t.warehouse_id,
                "kit_id": tool_kit_info.get(t.id, {}).get("kit_id"),
                "kit_name": tool_kit_info.get(t.id, {}).get("kit_name"),
                "box_id": tool_kit_info.get(t.id, {}).get("box_id"),
                "box_number": tool_kit_info.get(t.id, {}).get("box_number"),
                "created_at": t.created_at.isoformat(),
                "requires_calibration": getattr(t, "requires_calibration", False),
                "calibration_frequency_days": getattr(t, "calibration_frequency_days", None),
                "last_calibration_date": t.last_calibration_date.isoformat() if hasattr(t, "last_calibration_date") and t.last_calibration_date else None,
                "next_calibration_date": t.next_calibration_date.isoformat() if hasattr(t, "next_calibration_date") and t.next_calibration_date else None,
                "calibration_status": getattr(t, "calibration_status", "not_applicable")
            } for t in tools]

            # Return paginated response
            response = {
                "tools": tools_data,
                "total": total_count,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev
            }

            logger.debug("Tools response ready", extra={"result_count": len(tools_data)})
            return jsonify(response)

        # POST - Create new tool (requires tool manager privileges)
        from auth.jwt_manager import JWTManager
        user_payload = JWTManager.get_current_user()
        if not user_payload:
            return jsonify({"error": "Authentication required"}), 401
        if not (user_payload.get("is_admin", False) or user_payload.get("department") == "Materials"):
            return jsonify({"error": "Tool management privileges required"}), 403

        data = request.get_json() or {}

        # Validate required fields - warehouse_id is now required for all tools
        required_fields = ["tool_number", "serial_number", "warehouse_id"]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        # Validate serial number format
        try:
            validate_serial_number_format(data["serial_number"])
        except ValidationError as e:
            return jsonify({"error": str(e)}), 400

        # Validate warehouse exists and is active
        try:
            warehouse = validate_warehouse_id(data["warehouse_id"])
        except ValidationError as e:
            return jsonify({"error": str(e)}), 400

        # Check if tool with same tool number AND serial number already exists
        if Tool.query.filter_by(tool_number=data["tool_number"], serial_number=data["serial_number"]).first():
            return jsonify({"error": "A tool with this tool number and serial number combination already exists"}), 400

        # Create new tool - warehouse_id is required
        t = Tool(
            tool_number=data.get("tool_number"),
            serial_number=data.get("serial_number"),
            lot_number=data.get("lot_number"),  # Support for consumable tools
            description=data.get("description"),
            condition=data.get("condition"),
            location=data.get("location"),
            category=data.get("category", "General"),
            warehouse_id=data["warehouse_id"],  # Required field
            requires_calibration=data.get("requires_calibration", False),
            calibration_frequency_days=data.get("calibration_frequency_days")
        )

        # Set calibration status based on requires_calibration
        if t.requires_calibration:
            t.calibration_status = "due_soon"  # Default to due_soon until first calibration
        else:
            t.calibration_status = "not_applicable"
        db.session.add(t)
        db.session.commit()

        # Record transaction
        from utils.transaction_helper import record_item_receipt
        try:
            record_item_receipt(
                item_type="tool",
                item_id=t.id,
                user_id=user_payload["user_id"],
                quantity=1.0,
                location=t.location or "Unknown",
                notes="Initial tool creation"
            )
            db.session.commit()
        except Exception as e:
            logger.error(f"Error recording tool creation transaction: {e!s}")
            # Don't fail the tool creation if transaction recording fails

        # Log the action
        AuditLog.log(
            user_id=current_user_id,
            action="create_tool",
            resource_type="tool",
            resource_id=t.id,
            details={
                "tool_number": t.tool_number,
                "serial_number": t.serial_number,
                "description": t.description
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        # Return the complete tool object for the frontend
        return jsonify({
            "id": t.id,
            "tool_number": t.tool_number,
            "serial_number": t.serial_number,
            "lot_number": t.lot_number,
            "description": t.description,
            "condition": t.condition,
            "location": t.location,
            "category": t.category,
            "status": getattr(t, "status", "available"),
            "status_reason": getattr(t, "status_reason", None),
            "warehouse_id": t.warehouse_id,
            "warehouse_name": warehouse.name,
            "created_at": t.created_at.isoformat(),
            "requires_calibration": getattr(t, "requires_calibration", False),
            "calibration_frequency_days": getattr(t, "calibration_frequency_days", None),
            "last_calibration_date": t.last_calibration_date.isoformat() if hasattr(t, "last_calibration_date") and t.last_calibration_date else None,
            "next_calibration_date": t.next_calibration_date.isoformat() if hasattr(t, "next_calibration_date") and t.next_calibration_date else None,
            "calibration_status": getattr(t, "calibration_status", "not_applicable"),
            "message": "Tool created successfully in warehouse"
        }), 201

    @app.route("/api/tools/<int:id>", methods=["GET", "PUT", "DELETE"])
    @jwt_required
    def get_tool(id):
        current_user_id = request.current_user.get("user_id") if hasattr(request, "current_user") else None
        tool = Tool.query.get_or_404(id)

        # GET - Get tool details
        if request.method == "GET":
            # Check if tool is currently checked out
            active_checkout = Checkout.query.filter_by(tool_id=id, return_date=None).first()

            # Determine status - checkout status takes precedence over tool status
            status = "checked_out" if active_checkout else getattr(tool, "status", "available")
            has_category = hasattr(tool, "category")
            category_value = tool.category if has_category else "General"
            logger.debug("Tool detail requested", extra={"tool_id": id, "status": status})

            return jsonify({
                "id": tool.id,
                "tool_number": tool.tool_number,
                "serial_number": tool.serial_number,
                "description": tool.description,
                "condition": tool.condition,
                "location": tool.location,
                "category": category_value,  # Use actual category value
                "status": status,
                "status_reason": getattr(tool, "status_reason", None) if status in ["maintenance", "retired"] else None,
                "created_at": tool.created_at.isoformat(),
                "requires_calibration": getattr(tool, "requires_calibration", False),
                "calibration_frequency_days": getattr(tool, "calibration_frequency_days", None),
                "last_calibration_date": tool.last_calibration_date.isoformat() if hasattr(tool, "last_calibration_date") and tool.last_calibration_date else None,
                "next_calibration_date": tool.next_calibration_date.isoformat() if hasattr(tool, "next_calibration_date") and tool.next_calibration_date else None,
                "calibration_status": getattr(tool, "calibration_status", "not_applicable")
            })

        if request.method == "DELETE":
            # DELETE - Delete tool (requires admin privileges)
            from auth.jwt_manager import JWTManager
            user_payload = JWTManager.get_current_user()
            if not user_payload:
                return jsonify({"error": "Authentication required"}), 401
            if not user_payload.get("is_admin", False):
                return jsonify({"error": "Admin privileges required to delete tools"}), 403

            # Accept force_delete from query parameters or JSON body
            force_delete = (
                request.args.get("force_delete", "").lower() in ("1", "true")
                or (request.get_json(silent=True) or {}).get("force_delete", False)
            )

            # Check if tool has history (checkouts, calibrations, service records)
            has_checkouts = Checkout.query.filter_by(tool_id=id).count() > 0
            has_calibrations = ToolCalibration.query.filter_by(tool_id=id).count() > 0
            has_service_records = ToolServiceRecord.query.filter_by(tool_id=id).count() > 0

            if (has_checkouts or has_calibrations or has_service_records) and not force_delete:
                return jsonify({
                    "error": "Tool has history and cannot be deleted",
                    "has_history": True,
                    "has_checkouts": has_checkouts,
                    "has_calibrations": has_calibrations,
                    "has_service_records": has_service_records,
                    "suggestion": "Consider retiring the tool instead to preserve history"
                }), 400

            # Store tool details for audit log before deletion
            tool_number = tool.tool_number
            tool_description = tool.description

            try:
                # Delete related records if force_delete is True
                if force_delete:
                    # Delete calibration standards associations first
                    ToolCalibrationStandard.query.filter(
                        ToolCalibrationStandard.calibration_id.in_(
                            db.session.query(ToolCalibration.id).filter_by(tool_id=id)
                        )
                    ).delete(synchronize_session=False)

                    # Delete calibrations
                    ToolCalibration.query.filter_by(tool_id=id).delete()

                    # Delete checkouts
                    Checkout.query.filter_by(tool_id=id).delete()

                    # Delete service records
                    ToolServiceRecord.query.filter_by(tool_id=id).delete()

                # Delete the tool
                db.session.delete(tool)
                db.session.commit()

                # Log the action
                AuditLog.log(
                    user_id=current_user_id,
                    action="delete_tool",
                    resource_type="tool",
                    resource_id=id,
                    details={
                        "tool_number": tool_number,
                        "description": tool_description,
                        "force_delete": force_delete
                    },
                    ip_address=request.remote_addr
                )
                db.session.commit()

                return jsonify({"message": "Tool deleted successfully"}), 200

            except Exception:
                db.session.rollback()
                logger.exception("Failed to delete tool", extra={"tool_id": id})
                return jsonify({"error": "Failed to delete tool"}), 500

        # PUT - Update tool (requires tool manager privileges)

        data = request.get_json() or {}
        logger.debug("Received tool update request", extra={
            "tool_id": id,
            "request_content_type": request.content_type
        })

        # Update fields
        if "tool_number" in data or "serial_number" in data:
            # If either tool_number or serial_number is being updated, we need to check for duplicates
            new_tool_number = data.get("tool_number", tool.tool_number)
            new_serial_number = data.get("serial_number", tool.serial_number)

            # Check if the combination of tool_number and serial_number already exists for another tool
            existing_tool = Tool.query.filter_by(tool_number=new_tool_number, serial_number=new_serial_number).first()
            if existing_tool and existing_tool.id != id:
                return jsonify({"error": "A tool with this tool number and serial number combination already exists"}), 400

            # Update the fields if they were provided
            if "tool_number" in data:
                tool.tool_number = data["tool_number"]
            if "serial_number" in data:
                tool.serial_number = data["serial_number"]

        if "description" in data:
            tool.description = data["description"]

        if "condition" in data:
            tool.condition = data["condition"]

        if "location" in data:
            tool.location = data["location"]

        if "category" in data:
            old_category = tool.category
            tool.category = data["category"]
            logger.debug("Updated tool category", extra={"tool_id": id, "old_category": old_category, "new_category": tool.category})

        # Update calibration fields
        if "requires_calibration" in data:
            tool.requires_calibration = data["requires_calibration"]

            # If requires_calibration is being turned off, reset calibration status
            if not tool.requires_calibration:
                tool.calibration_status = "not_applicable"
            # If requires_calibration is being turned on, set initial calibration status
            elif tool.requires_calibration and not tool.calibration_status:
                tool.calibration_status = "due_soon"

        if "calibration_frequency_days" in data:
            tool.calibration_frequency_days = data["calibration_frequency_days"]

            # If we have a last calibration date and frequency, update the next calibration date
            if tool.last_calibration_date and tool.calibration_frequency_days:
                tool.next_calibration_date = tool.last_calibration_date + timedelta(days=tool.calibration_frequency_days)

                # Update calibration status based on new next_calibration_date
                if hasattr(tool, "update_calibration_status"):
                    tool.update_calibration_status()

        db.session.commit()

        # Verify the update in the database
        updated_tool = db.session.get(Tool, id)
        logger.debug("Tool updated successfully", extra={"tool_id": id})

        # Log the action
        AuditLog.log(
            user_id=current_user_id,
            action="update_tool",
            resource_type="tool",
            resource_id=tool.id,
            details={
                "tool_number": tool.tool_number,
                "serial_number": tool.serial_number
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        # Get the updated tool from the database
        updated_tool = db.session.get(Tool, id)

        response_data = {
            "id": updated_tool.id,
            "tool_number": updated_tool.tool_number,
            "serial_number": updated_tool.serial_number,
            "description": updated_tool.description,
            "condition": updated_tool.condition,
            "location": updated_tool.location,
            "category": updated_tool.category,  # Use the actual category value
            "requires_calibration": getattr(updated_tool, "requires_calibration", False),
            "calibration_frequency_days": getattr(updated_tool, "calibration_frequency_days", None),
            "last_calibration_date": updated_tool.last_calibration_date.isoformat() if hasattr(updated_tool, "last_calibration_date") and updated_tool.last_calibration_date else None,
            "next_calibration_date": updated_tool.next_calibration_date.isoformat() if hasattr(updated_tool, "next_calibration_date") and updated_tool.next_calibration_date else None,
            "calibration_status": getattr(updated_tool, "calibration_status", "not_applicable"),
            "message": "Tool updated successfully"
        }

        return jsonify(response_data)

    @app.route("/api/tools/<int:id>/retire", methods=["POST"])
    @admin_required
    def retire_tool(id):
        """Retire a tool instead of deleting it to preserve history."""
        tool = Tool.query.get_or_404(id)

        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")
        reason = data.get("reason", "Tool retired by admin")

        # Update tool status to retired
        tool.status = "retired"
        tool.status_reason = reason

        # Create service record for retirement (use user_id from JWT token)
        service_record = ToolServiceRecord(
            tool_id=id,
            action_type="remove_permanent",
            user_id=request.current_user["user_id"],
            reason=reason,
            comments=data.get("comments", "")
        )

        db.session.add(service_record)
        db.session.commit()

        # Log the action
        AuditLog.log(
            user_id=current_user_id,
            action="retire_tool",
            resource_type="tool",
            resource_id=id,
            details={
                "tool_number": tool.tool_number,
                "reason": reason
            },
            ip_address=request.remote_addr
        )
        db.session.commit()

        return jsonify({
            "message": "Tool retired successfully",
            "tool": tool.to_dict()
        }), 200

    @app.route("/api/tools/search", methods=["GET"])
    def search_tools():
        # Get search query from request parameters
        query = request.args.get("q", "")
        logger.debug("Tools search endpoint called", extra={"has_query": bool(query)})

        if not query:
            return jsonify({"error": "Search query is required"}), 400

        # Convert query to lowercase for case-insensitive search
        search_term = f"%{query.lower()}%"

        # Search in tool_number, serial_number, description, and location
        try:
            tools = Tool.query.filter(
                db.or_(
                    db.func.lower(Tool.tool_number).like(search_term),
                    db.func.lower(Tool.serial_number).like(search_term),
                    db.func.lower(Tool.description).like(search_term),
                    db.func.lower(Tool.location).like(search_term)
                )
            ).all()
            logger.debug("Tools search results", extra={"result_count": len(tools)})
        except Exception:
            logger.exception("Error during tools search endpoint")
            return jsonify({"error": "Search error"}), 500

        # Get checkout status for each tool
        tool_status = {}
        active_checkouts = Checkout.query.filter(Checkout.return_date.is_(None)).all()

        for checkout in active_checkouts:
            tool_status[checkout.tool_id] = "checked_out"

        # Format the results
        result = [{
            "id": t.id,
            "tool_number": t.tool_number,
            "serial_number": t.serial_number,
            "description": t.description,
            "condition": t.condition,
            "location": t.location,
            "category": getattr(t, "category", "General"),  # Use 'General' if category attribute doesn't exist
            "status": tool_status.get(t.id, getattr(t, "status", "available")),  # Use 'available' if status attribute doesn't exist
            "status_reason": getattr(t, "status_reason", None) if getattr(t, "status", "available") in ["maintenance", "retired"] else None,
            "created_at": t.created_at.isoformat()
        } for t in tools]

        return jsonify(result)

    @app.route("/api/tools/new", methods=["GET"])
    @tool_manager_required
    def get_new_tool_form():
        # This endpoint returns the form data needed to create a new tool
        # It can include any default values or validation rules
        return jsonify({
            "form_fields": [
                {"name": "tool_number", "type": "text", "required": True, "label": "Tool Number"},
                {"name": "serial_number", "type": "text", "required": True, "label": "Serial Number"},
                {"name": "description", "type": "text", "required": False, "label": "Description"},
                {"name": "condition", "type": "select", "required": False, "label": "Condition",
                 "options": ["New", "Good", "Fair", "Poor"]},
                {"name": "location", "type": "text", "required": False, "label": "Location"}
            ]
        }), 200

    @app.route("/api/tools/new/checkouts", methods=["GET"])
    @login_required
    def get_new_tool_checkouts():
        # This endpoint returns checkout history for a new tool (which should be empty)
        return jsonify([]), 200

    @app.route("/api/tools/<int:id>/checkouts", methods=["GET"])
    def get_tool_checkouts(id):
        # Get checkout history for a specific tool
        Tool.query.get_or_404(id)
        checkouts = Checkout.query.filter_by(tool_id=id).order_by(Checkout.checkout_date.desc()).all()

        return jsonify([{
            "id": c.id,
            "user_id": c.user_id,
            "user_name": c.user.name if c.user else "Unknown",
            "user_department": c.user.department if c.user else "Unknown",
            "checkout_date": c.checkout_date.isoformat(),
            "return_date": c.return_date.isoformat() if c.return_date else None,
            "expected_return_date": c.expected_return_date.isoformat() if c.expected_return_date else None,
            "condition_at_return": getattr(c, "return_condition", None),
            "returned_by": getattr(c, "returned_by", None),
            "found": getattr(c, "found", None),
            "return_notes": getattr(c, "return_notes", None),
            "is_overdue": c.return_date is None and c.expected_return_date and c.expected_return_date < datetime.now(),
            "duration_days": (c.return_date - c.checkout_date).days if c.return_date else None,
            "status": "Returned" if c.return_date else ("Overdue" if c.expected_return_date and c.expected_return_date < datetime.now() else "Checked Out")
        } for c in checkouts]), 200

    @app.route("/api/tools/<int:id>/service/remove", methods=["POST"])
    @tool_manager_required
    def remove_tool_from_service(id):
        try:
            current_user_id = request.current_user.get("user_id")
            # Get the tool
            tool = Tool.query.get_or_404(id)

            # Check if tool is already out of service
            if tool.status in ["maintenance", "retired"]:
                return jsonify({"error": f"Tool is already out of service with status: {tool.status}"}), 400

            # Check if tool is currently checked out
            active_checkout = Checkout.query.filter_by(tool_id=id, return_date=None).first()
            if active_checkout:
                return jsonify({"error": "Cannot remove a tool that is currently checked out"}), 400

            # Get data from request
            data = request.get_json() or {}

            # Validate required fields
            required_fields = ["action_type", "reason"]
            for field in required_fields:
                if not data.get(field):
                    return jsonify({"error": f"Missing required field: {field}"}), 400

            # Validate action type
            action_type = data.get("action_type")
            if action_type not in ["remove_maintenance", "remove_permanent"]:
                return jsonify({"error": 'Invalid action type. Must be "remove_maintenance" or "remove_permanent"'}), 400

            # Update tool status
            if action_type == "remove_maintenance":
                tool.status = "maintenance"
            else:  # remove_permanent
                tool.status = "retired"

            tool.status_reason = data.get("reason")

            # Create service record (use user_id from JWT token)
            service_record = ToolServiceRecord(
                tool_id=id,
                user_id=request.current_user["user_id"],
                action_type=action_type,
                reason=data.get("reason"),
                comments=data.get("comments", "")
            )

            # Create audit log (use user info from JWT token)
            user_payload = request.current_user
            AuditLog.log(
                user_id=current_user_id,
                action=action_type,
                resource_type="tool",
                resource_id=id,
                details={
                    "tool_number": tool.tool_number,
                    "reason": data.get("reason"),
                    "user_name": user_payload.get("user_name", "Unknown")
                },
                ip_address=request.remote_addr
            )

            # Create user activity
            activity = UserActivity(
                user_id=user_payload["user_id"],
                activity_type=action_type,
                description=f"Removed tool {tool.tool_number} from service",
                ip_address=request.remote_addr
            )

            # Save changes
            db.session.add(service_record)
            db.session.add(activity)
            db.session.commit()

            return jsonify({
                "id": tool.id,
                "tool_number": tool.tool_number,
                "serial_number": tool.serial_number,
                "status": tool.status,
                "status_reason": tool.status_reason,
                "message": f"Tool successfully removed from service with status: {tool.status}"
            }), 200

        except Exception:
            db.session.rollback()
            logger.exception("Error removing tool from service", extra={"tool_id": id})
            return jsonify({"error": "An error occurred while updating tool service status"}), 500

    @app.route("/api/tools/<int:id>/service/return", methods=["POST"])
    @tool_manager_required
    def return_tool_to_service(id):
        try:
            # Get the tool
            tool = Tool.query.get_or_404(id)

            # Check if tool is out of service
            if tool.status not in ["maintenance", "retired"]:
                return jsonify({"error": f"Tool is not out of service. Current status: {tool.status}"}), 400

            # Get data from request
            data = request.get_json() or {}
            current_user_id = request.current_user.get("user_id")

            # Validate required fields
            if not data.get("reason"):
                return jsonify({"error": "Missing required field: reason"}), 400

            # Update tool status
            tool.status = "available"
            tool.status_reason = None

            # Create service record (use user_id from JWT token)
            user_payload = request.current_user
            service_record = ToolServiceRecord(
                tool_id=id,
                user_id=user_payload["user_id"],
                action_type="return_service",
                reason=data.get("reason"),
                comments=data.get("comments", "")
            )

            # Create audit log
            AuditLog.log(
                user_id=current_user_id,
                action="return_service",
                resource_type="tool",
                resource_id=id,
                details={
                    "tool_number": tool.tool_number,
                    "reason": data.get("reason"),
                    "user_name": user_payload.get("user_name", "Unknown")
                },
                ip_address=request.remote_addr
            )

            # Create user activity
            activity = UserActivity(
                user_id=user_payload["user_id"],
                activity_type="return_service",
                description=f"Returned tool {tool.tool_number} to service",
                ip_address=request.remote_addr
            )

            # Save changes
            db.session.add(service_record)
            db.session.add(activity)
            db.session.commit()

            return jsonify({
                "id": tool.id,
                "tool_number": tool.tool_number,
                "serial_number": tool.serial_number,
                "status": tool.status,
                "message": "Tool successfully returned to service"
            }), 200

        except Exception:
            db.session.rollback()
            logger.exception("Error returning tool to service", extra={"tool_id": id})
            return jsonify({"error": "An error occurred while returning the tool to service"}), 500

    @app.route("/api/tools/<int:id>/service/history", methods=["GET"])
    def get_tool_service_history(id):
        try:
            # Get pagination parameters
            page = request.args.get("page", 1, type=int)
            limit = request.args.get("limit", 20, type=int)

            # Calculate offset
            offset = (page - 1) * limit

            # Get the tool
            Tool.query.get_or_404(id)

            # Get service history
            service_records = ToolServiceRecord.query.filter_by(tool_id=id).order_by(
                ToolServiceRecord.timestamp.desc()
            ).offset(offset).limit(limit).all()

            return jsonify([record.to_dict() for record in service_records]), 200

        except Exception:
            logger.exception("Error getting tool service history", extra={"tool_id": id})
            return jsonify({"error": "An error occurred while retrieving tool service history"}), 500
