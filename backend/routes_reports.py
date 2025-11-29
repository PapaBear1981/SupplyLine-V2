"""
Comprehensive Reports API Routes

This module provides all reporting endpoints for:
- Tool reports (inventory, checkouts, calibration, department usage)
- Chemical reports (inventory, expiration, usage, waste)
- Kit reports (inventory, issuances, transfers, reorders)
- Order reports (procurement orders, user requests)
- Admin reports (user activity, system stats, audit logs)
- Export functionality (PDF and Excel)
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta

from flask import jsonify, make_response, request
from sqlalchemy import func, and_, or_

from auth import department_required, jwt_required, admin_required
from models import (
    Chemical, ChemicalIssuance, Checkout, ProcurementOrder,
    Tool, User, UserActivity, UserRequest, RequestItem, db
)
from models_kits import (
    AircraftType, Kit, KitBox, KitExpendable, KitIssuance,
    KitItem, KitReorderRequest, KitTransfer
)
from utils.export_utils import generate_excel_report, generate_pdf_report


logger = logging.getLogger(__name__)

tool_manager_required = department_required("Materials")


def calculate_date_range(timeframe):
    """Calculate start date based on timeframe parameter."""
    now = datetime.now()
    if timeframe == "day":
        return now - timedelta(days=1)
    if timeframe == "week":
        return now - timedelta(weeks=1)
    if timeframe == "month":
        return now - timedelta(days=30)
    if timeframe == "quarter":
        return now - timedelta(days=90)
    if timeframe == "year":
        return now - timedelta(days=365)
    if timeframe == "all":
        return datetime(1970, 1, 1)
    return now - timedelta(days=30)  # Default to month


def register_report_routes(app):
    """Register all report routes with the Flask app."""

    # ========================================================================
    # EXPORT ENDPOINTS
    # ========================================================================

    @app.route("/api/reports/export/pdf", methods=["POST"])
    @jwt_required
    def export_report_pdf():
        """Export report as PDF."""
        try:
            data = request.get_json()
            report_type = data.get("report_type")
            report_data = data.get("report_data")
            timeframe = data.get("timeframe", "month")

            if not report_type or not report_data:
                return jsonify({"error": "Missing report_type or report_data"}), 400

            pdf_buffer = generate_pdf_report(report_data, report_type, timeframe)

            response = make_response(pdf_buffer.getvalue())
            response.headers["Content-Type"] = "application/pdf"
            response.headers["Content-Disposition"] = f'attachment; filename="{report_type}-report.pdf"'

            return response

        except Exception:
            logger.exception("Failed to generate PDF report")
            return jsonify({"error": "Failed to generate PDF"}), 500

    @app.route("/api/reports/export/excel", methods=["POST"])
    @jwt_required
    def export_report_excel():
        """Export report as Excel."""
        try:
            data = request.get_json()
            report_type = data.get("report_type")
            report_data = data.get("report_data")
            timeframe = data.get("timeframe", "month")

            if not report_type or not report_data:
                return jsonify({"error": "Missing report_type or report_data"}), 400

            excel_buffer = generate_excel_report(report_data, report_type, timeframe)

            response = make_response(excel_buffer.getvalue())
            response.headers["Content-Type"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            response.headers["Content-Disposition"] = f'attachment; filename="{report_type}-report.xlsx"'

            return response

        except Exception:
            logger.exception("Failed to generate Excel report")
            return jsonify({"error": "Failed to generate Excel"}), 500

    # ========================================================================
    # TOOL REPORTS
    # ========================================================================

    @app.route("/api/reports/tools/inventory", methods=["GET"])
    @jwt_required
    def tool_inventory_report():
        """Generate comprehensive tool inventory report with statistics."""
        try:
            category = request.args.get("category")
            status = request.args.get("status")
            location = request.args.get("location")

            query = Tool.query

            if category:
                query = query.filter(Tool.category == category)
            if location:
                query = query.filter(Tool.location.ilike(f"%{location}%"))

            # Get checkout status
            checked_out_tool_ids = set(
                c.tool_id for c in Checkout.query.filter(Checkout.return_date.is_(None)).all()
            )

            if status:
                if status == "available":
                    query = query.filter(~Tool.id.in_(checked_out_tool_ids))
                    query = query.filter(Tool.status.in_(["available", None]))
                elif status == "checked_out":
                    query = query.filter(Tool.id.in_(checked_out_tool_ids))
                else:
                    query = query.filter(Tool.status == status)

            tools = query.all()

            # Build tool data
            tools_data = []
            for t in tools:
                tool_status = "checked_out" if t.id in checked_out_tool_ids else (t.status or "available")
                tools_data.append({
                    "id": t.id,
                    "tool_number": t.tool_number,
                    "serial_number": t.serial_number,
                    "description": t.description,
                    "category": t.category or "General",
                    "location": t.location,
                    "status": tool_status,
                    "condition": t.condition,
                    "status_reason": t.status_reason if tool_status in ["maintenance", "retired"] else None,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                })

            # Calculate summary
            all_tools = Tool.query.all()
            summary = {
                "total": len(all_tools),
                "available": sum(1 for t in all_tools if t.id not in checked_out_tool_ids and t.status in ["available", None]),
                "checked_out": len(checked_out_tool_ids),
                "maintenance": sum(1 for t in all_tools if t.status == "maintenance"),
                "retired": sum(1 for t in all_tools if t.status == "retired")
            }

            # By category
            category_counts = defaultdict(int)
            for t in all_tools:
                category_counts[t.category or "General"] += 1
            by_category = [{"name": k, "value": v} for k, v in category_counts.items()]

            # By location
            location_counts = defaultdict(int)
            for t in all_tools:
                location_counts[t.location or "Unassigned"] += 1
            by_location = [{"name": k, "value": v} for k, v in location_counts.items()]

            return jsonify({
                "tools": tools_data,
                "summary": summary,
                "byCategory": by_category,
                "byLocation": by_location
            }), 200

        except Exception:
            logger.exception("Error in tool inventory report")
            return jsonify({"error": "Failed to generate tool inventory report"}), 500

    @app.route("/api/reports/tools/checkouts", methods=["GET"])
    @jwt_required
    def checkout_history_report():
        """Generate checkout history report with trends."""
        try:
            timeframe = request.args.get("timeframe", "month")
            department = request.args.get("department")
            checkout_status = request.args.get("status")

            start_date = calculate_date_range(timeframe)
            now = datetime.now()

            query = Checkout.query.filter(Checkout.checkout_date >= start_date)

            if department:
                query = query.join(User).filter(User.department == department)

            if checkout_status:
                if checkout_status == "active":
                    query = query.filter(Checkout.return_date.is_(None))
                elif checkout_status == "returned":
                    query = query.filter(Checkout.return_date.isnot(None))

            checkouts = query.order_by(Checkout.checkout_date.desc()).all()

            # Build checkout data
            checkout_data = []
            for c in checkouts:
                if c.return_date:
                    duration = max((c.return_date - c.checkout_date).days, 0)
                else:
                    duration = (now - c.checkout_date).days

                checkout_data.append({
                    "id": c.id,
                    "tool_id": c.tool_id,
                    "tool_number": c.tool.tool_number if c.tool else "Unknown",
                    "serial_number": c.tool.serial_number if c.tool else "Unknown",
                    "description": c.tool.description if c.tool else "",
                    "category": c.tool.category if c.tool else "General",
                    "user_id": c.user_id,
                    "user_name": c.user.name if c.user else "Unknown",
                    "department": c.user.department if c.user else "Unknown",
                    "checkout_date": c.checkout_date.isoformat(),
                    "return_date": c.return_date.isoformat() if c.return_date else None,
                    "expected_return_date": c.expected_return_date.isoformat() if c.expected_return_date else None,
                    "duration": duration
                })

            # Checkout trends by day
            checkout_trends = db.session.query(
                func.date(Checkout.checkout_date).label("date"),
                func.count().label("checkouts")
            ).filter(Checkout.checkout_date >= start_date).group_by(
                func.date(Checkout.checkout_date)
            ).all()

            return_trends = db.session.query(
                func.date(Checkout.return_date).label("date"),
                func.count().label("returns")
            ).filter(
                Checkout.return_date >= start_date,
                Checkout.return_date.isnot(None)
            ).group_by(func.date(Checkout.return_date)).all()

            date_data = {}
            for date, count in checkout_trends:
                date_str = date if isinstance(date, str) else date.strftime("%Y-%m-%d")
                if date_str not in date_data:
                    date_data[date_str] = {"date": date_str, "checkouts": 0, "returns": 0}
                date_data[date_str]["checkouts"] = count

            for date, count in return_trends:
                date_str = date if isinstance(date, str) else date.strftime("%Y-%m-%d")
                if date_str not in date_data:
                    date_data[date_str] = {"date": date_str, "checkouts": 0, "returns": 0}
                date_data[date_str]["returns"] = count

            checkouts_by_day = sorted(date_data.values(), key=lambda x: x["date"])

            # Statistics
            total_checkouts = len(checkouts)
            returned_checkouts = sum(1 for c in checkouts if c.return_date)
            currently_checked_out = total_checkouts - returned_checkouts
            durations = [c["duration"] for c in checkout_data if c["return_date"]]
            average_duration = sum(durations) / len(durations) if durations else 0

            return jsonify({
                "checkouts": checkout_data,
                "checkoutsByDay": checkouts_by_day,
                "stats": {
                    "totalCheckouts": total_checkouts,
                    "returnedCheckouts": returned_checkouts,
                    "currentlyCheckedOut": currently_checked_out,
                    "averageDuration": round(average_duration, 1)
                }
            }), 200

        except Exception:
            logger.exception("Error in checkout history report")
            return jsonify({"error": "Failed to generate checkout history report"}), 500

    @app.route("/api/reports/tools/calibration", methods=["GET"])
    @jwt_required
    def calibration_report():
        """Generate calibration status report."""
        try:
            status = request.args.get("status")
            category = request.args.get("category")

            query = Tool.query.filter(Tool.requires_calibration == True)  # noqa: E712

            if status:
                query = query.filter(Tool.calibration_status == status)
            if category:
                query = query.filter(Tool.category == category)

            tools = query.all()
            now = datetime.now()

            # Build tool data
            tools_data = []
            for t in tools:
                days_until_due = None
                if t.next_calibration_date:
                    days_until_due = (t.next_calibration_date - now).days

                tools_data.append({
                    "id": t.id,
                    "tool_id": t.id,
                    "tool_number": t.tool_number,
                    "serial_number": t.serial_number,
                    "description": t.description,
                    "category": t.category or "General",
                    "calibration_date": t.last_calibration_date.isoformat() if t.last_calibration_date else None,
                    "calibration_due_date": t.next_calibration_date.isoformat() if t.next_calibration_date else None,
                    "calibration_status": t.calibration_status or "not_required",
                    "calibration_interval_days": t.calibration_frequency_days,
                    "last_calibrated_by": None,
                    "days_until_due": days_until_due
                })

            # Summary
            all_calibration_tools = Tool.query.filter(Tool.requires_calibration == True).all()  # noqa: E712
            summary = {
                "total": len(all_calibration_tools),
                "current": sum(1 for t in all_calibration_tools if t.calibration_status == "current"),
                "dueSoon": sum(1 for t in all_calibration_tools if t.calibration_status == "due_soon"),
                "overdue": sum(1 for t in all_calibration_tools if t.calibration_status == "overdue"),
                "notRequired": Tool.query.filter(or_(Tool.requires_calibration == False, Tool.requires_calibration.is_(None))).count()  # noqa: E712
            }

            # Upcoming calibrations (next 30 days)
            upcoming = [t for t in tools_data if t["days_until_due"] is not None and 0 <= t["days_until_due"] <= 30]
            upcoming.sort(key=lambda x: x["days_until_due"])

            # Overdue calibrations
            overdue = [t for t in tools_data if t["calibration_status"] == "overdue"]

            return jsonify({
                "tools": tools_data,
                "summary": summary,
                "upcomingCalibrations": upcoming[:20],
                "overdueCalibrations": overdue
            }), 200

        except Exception:
            logger.exception("Error in calibration report")
            return jsonify({"error": "Failed to generate calibration report"}), 500

    @app.route("/api/reports/tools/department-usage", methods=["GET"])
    @jwt_required
    def department_usage_report():
        """Generate department usage report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            start_date = calculate_date_range(timeframe)

            departments = db.session.query(User.department).distinct().all()
            department_names = [d[0] for d in departments if d[0]]

            department_data = []
            for dept in department_names:
                dept_checkouts = Checkout.query.join(User, Checkout.user_id == User.id).filter(
                    User.department == dept,
                    Checkout.checkout_date >= start_date
                ).all()

                total_checkouts = len(dept_checkouts)
                if total_checkouts == 0:
                    continue

                currently_checked_out = sum(1 for c in dept_checkouts if not c.return_date)

                durations = []
                for c in dept_checkouts:
                    if c.return_date:
                        duration = max((c.return_date - c.checkout_date).days, 0)
                        durations.append(duration)

                average_duration = sum(durations) / len(durations) if durations else 0

                tool_categories = {}
                for c in dept_checkouts:
                    cat = c.tool.category if c.tool else "General"
                    tool_categories[cat] = tool_categories.get(cat, 0) + 1

                most_used_category = max(tool_categories.items(), key=lambda x: x[1])[0] if tool_categories else None

                department_data.append({
                    "name": dept,
                    "totalCheckouts": total_checkouts,
                    "currentlyCheckedOut": currently_checked_out,
                    "averageDuration": round(average_duration, 1),
                    "mostUsedCategory": most_used_category
                })

            department_data.sort(key=lambda x: x["totalCheckouts"], reverse=True)

            checkouts_by_dept = [{"name": d["name"], "value": d["totalCheckouts"]} for d in department_data]

            tool_usage = db.session.query(
                Tool.category,
                func.count().label("checkouts")
            ).join(Checkout).filter(
                Checkout.checkout_date >= start_date
            ).group_by(Tool.category).all()

            tool_usage_data = [{"name": t[0] or "General", "checkouts": t[1]} for t in tool_usage]

            return jsonify({
                "departments": department_data,
                "checkoutsByDepartment": checkouts_by_dept,
                "toolUsageByCategory": tool_usage_data
            }), 200

        except Exception:
            logger.exception("Error in department usage report")
            return jsonify({"error": "Failed to generate department usage report"}), 500

    # ========================================================================
    # CHEMICAL REPORTS
    # ========================================================================

    @app.route("/api/reports/chemicals/inventory", methods=["GET"])
    @jwt_required
    def chemical_inventory_report():
        """Generate chemical inventory report with statistics."""
        try:
            status = request.args.get("status")
            category = request.args.get("category")
            manufacturer = request.args.get("manufacturer")

            query = Chemical.query

            if status:
                query = query.filter(Chemical.status == status)
            if category:
                query = query.filter(Chemical.category == category)
            if manufacturer:
                query = query.filter(Chemical.manufacturer.ilike(f"%{manufacturer}%"))

            chemicals = query.all()

            chemicals_data = []
            for c in chemicals:
                chemicals_data.append({
                    "id": c.id,
                    "name": c.description,
                    "part_number": c.part_number,
                    "lot_number": c.lot_number,
                    "manufacturer": c.manufacturer,
                    "quantity": c.quantity,
                    "unit": c.unit,
                    "location": c.location,
                    "status": c.status,
                    "expiration_date": c.expiration_date.isoformat() if c.expiration_date else None,
                    "minimum_stock_level": c.minimum_stock_level,
                    "created_at": c.date_added.isoformat() if c.date_added else None
                })

            # Summary
            all_chemicals = Chemical.query.all()
            summary = {
                "total": len(all_chemicals),
                "totalQuantity": sum(c.quantity for c in all_chemicals),
                "available": sum(1 for c in all_chemicals if c.status == "available"),
                "lowStock": sum(1 for c in all_chemicals if c.status == "low_stock"),
                "outOfStock": sum(1 for c in all_chemicals if c.status == "out_of_stock"),
                "expired": sum(1 for c in all_chemicals if c.status == "expired" or c.is_expired())
            }

            # By manufacturer
            mfr_counts = defaultdict(int)
            for c in all_chemicals:
                mfr_counts[c.manufacturer or "Unknown"] += 1
            by_manufacturer = [{"name": k, "value": v} for k, v in mfr_counts.items()]

            # By status
            status_colors = {
                "available": "#52c41a",
                "low_stock": "#faad14",
                "out_of_stock": "#ff4d4f",
                "expired": "#8c8c8c"
            }
            by_status = [
                {"name": "Available", "value": summary["available"], "color": status_colors["available"]},
                {"name": "Low Stock", "value": summary["lowStock"], "color": status_colors["low_stock"]},
                {"name": "Out of Stock", "value": summary["outOfStock"], "color": status_colors["out_of_stock"]},
                {"name": "Expired", "value": summary["expired"], "color": status_colors["expired"]}
            ]

            return jsonify({
                "chemicals": chemicals_data,
                "summary": summary,
                "byManufacturer": by_manufacturer,
                "byStatus": [s for s in by_status if s["value"] > 0]
            }), 200

        except Exception:
            logger.exception("Error in chemical inventory report")
            return jsonify({"error": "Failed to generate chemical inventory report"}), 500

    @app.route("/api/reports/chemicals/expiration", methods=["GET"])
    @jwt_required
    def chemical_expiration_report():
        """Generate chemical expiration report."""
        try:
            now = datetime.now()
            chemicals = Chemical.query.filter(Chemical.expiration_date.isnot(None)).all()

            chemicals_data = []
            for c in chemicals:
                days_until = (c.expiration_date - now).days if c.expiration_date else None

                if days_until is None:
                    status = "ok"
                elif days_until < 0:
                    status = "expired"
                elif days_until <= 30:
                    status = "expiring_soon"
                else:
                    status = "ok"

                chemicals_data.append({
                    "id": c.id,
                    "name": c.description,
                    "part_number": c.part_number,
                    "lot_number": c.lot_number,
                    "manufacturer": c.manufacturer,
                    "quantity": c.quantity,
                    "unit": c.unit,
                    "location": c.location,
                    "expiration_date": c.expiration_date.isoformat() if c.expiration_date else None,
                    "days_until_expiration": days_until,
                    "status": status
                })

            # Sort by expiration date
            chemicals_data.sort(key=lambda x: x["days_until_expiration"] if x["days_until_expiration"] is not None else 9999)

            # Summary
            summary = {
                "expired": sum(1 for c in chemicals_data if c["status"] == "expired"),
                "expiringSoon": sum(1 for c in chemicals_data if c["status"] == "expiring_soon"),
                "expiring30Days": sum(1 for c in chemicals_data if c["days_until_expiration"] is not None and 0 <= c["days_until_expiration"] <= 30),
                "expiring60Days": sum(1 for c in chemicals_data if c["days_until_expiration"] is not None and 0 <= c["days_until_expiration"] <= 60),
                "expiring90Days": sum(1 for c in chemicals_data if c["days_until_expiration"] is not None and 0 <= c["days_until_expiration"] <= 90)
            }

            # Expiration timeline (by month for next 6 months)
            timeline = []
            for i in range(6):
                month_start = now + timedelta(days=30 * i)
                month_end = now + timedelta(days=30 * (i + 1))
                count = sum(1 for c in chemicals if c.expiration_date and month_start <= c.expiration_date < month_end)
                timeline.append({
                    "month": month_start.strftime("%b %Y"),
                    "count": count
                })

            return jsonify({
                "chemicals": chemicals_data,
                "summary": summary,
                "expirationTimeline": timeline
            }), 200

        except Exception:
            logger.exception("Error in chemical expiration report")
            return jsonify({"error": "Failed to generate chemical expiration report"}), 500

    @app.route("/api/reports/chemicals/usage", methods=["GET"])
    @jwt_required
    def chemical_usage_report():
        """Generate chemical usage report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            start_date = calculate_date_range(timeframe)

            issuances = ChemicalIssuance.query.filter(
                ChemicalIssuance.issue_date >= start_date
            ).order_by(ChemicalIssuance.issue_date.desc()).all()

            usage_data = []
            for i in issuances:
                usage_data.append({
                    "id": i.id,
                    "chemical_id": i.chemical_id,
                    "name": i.chemical.description if i.chemical else "Unknown",
                    "part_number": i.chemical.part_number if i.chemical else "Unknown",
                    "quantity_used": i.quantity,
                    "unit": i.chemical.unit if i.chemical else "each",
                    "used_by": i.user.name if i.user else "Unknown",
                    "department": i.user.department if i.user else "Unknown",
                    "used_date": i.issue_date.isoformat() if i.issue_date else None,
                    "purpose": i.purpose or ""
                })

            # Summary
            total_used = sum(i.quantity for i in issuances)
            unique_chemicals = len(set(i.chemical_id for i in issuances))

            # Top users
            user_usage = defaultdict(int)
            for i in issuances:
                user_name = i.user.name if i.user else "Unknown"
                user_usage[user_name] += i.quantity
            top_users = sorted([{"name": k, "value": v} for k, v in user_usage.items()], key=lambda x: x["value"], reverse=True)[:10]

            # Usage by day
            day_usage = defaultdict(int)
            for i in issuances:
                if i.issue_date:
                    day = i.issue_date.strftime("%Y-%m-%d")
                    day_usage[day] += i.quantity
            usage_by_day = sorted([{"date": k, "quantity": v} for k, v in day_usage.items()], key=lambda x: x["date"])

            # Usage by chemical
            chem_usage = defaultdict(int)
            for i in issuances:
                name = i.chemical.description if i.chemical else "Unknown"
                chem_usage[name] += i.quantity
            usage_by_chemical = sorted([{"name": k, "value": v} for k, v in chem_usage.items()], key=lambda x: x["value"], reverse=True)[:20]

            return jsonify({
                "usage": usage_data,
                "summary": {
                    "totalUsed": total_used,
                    "uniqueChemicals": unique_chemicals,
                    "topUsers": top_users
                },
                "usageByDay": usage_by_day,
                "usageByChemical": usage_by_chemical
            }), 200

        except Exception:
            logger.exception("Error in chemical usage report")
            return jsonify({"error": "Failed to generate chemical usage report"}), 500

    @app.route("/api/reports/chemicals/waste", methods=["GET"])
    @jwt_required
    def chemical_waste_report():
        """Generate chemical waste report (expired/disposed chemicals)."""
        try:
            timeframe = request.args.get("timeframe", "month")
            start_date = calculate_date_range(timeframe)

            # Find expired chemicals
            expired_chemicals = Chemical.query.filter(
                and_(
                    Chemical.expiration_date.isnot(None),
                    Chemical.expiration_date < datetime.now()
                )
            ).all()

            waste_data = []
            for c in expired_chemicals:
                waste_data.append({
                    "id": c.id,
                    "chemical_id": c.id,
                    "name": c.description,
                    "part_number": c.part_number,
                    "lot_number": c.lot_number,
                    "quantity": c.quantity,
                    "unit": c.unit,
                    "waste_reason": "expired",
                    "waste_date": c.expiration_date.isoformat() if c.expiration_date else None,
                    "disposed_by": "",
                    "notes": ""
                })

            # Summary
            total_waste = sum(c.quantity for c in expired_chemicals)

            waste_by_reason = [
                {"name": "Expired", "value": len(expired_chemicals)},
                {"name": "Contaminated", "value": 0},
                {"name": "Damaged", "value": 0},
                {"name": "Other", "value": 0}
            ]

            # Waste by month
            month_waste = defaultdict(int)
            for c in expired_chemicals:
                if c.expiration_date:
                    month = c.expiration_date.strftime("%b %Y")
                    month_waste[month] += c.quantity
            waste_by_month = [{"month": k, "quantity": v} for k, v in month_waste.items()]

            return jsonify({
                "waste": waste_data,
                "summary": {
                    "totalWaste": total_waste,
                    "wasteByReason": waste_by_reason,
                    "estimatedCost": 0
                },
                "wasteByMonth": waste_by_month
            }), 200

        except Exception:
            logger.exception("Error in chemical waste report")
            return jsonify({"error": "Failed to generate chemical waste report"}), 500

    # ========================================================================
    # KIT REPORTS
    # ========================================================================

    @app.route("/api/reports/kits/inventory", methods=["GET"])
    @jwt_required
    def kit_inventory_report():
        """Generate kit inventory report."""
        try:
            aircraft_type_id = request.args.get("aircraft_type_id", type=int)
            status = request.args.get("status")

            query = Kit.query

            if aircraft_type_id:
                query = query.filter(Kit.aircraft_type_id == aircraft_type_id)
            if status:
                query = query.filter(Kit.status == status)

            kits = query.all()

            kits_data = []
            total_items = 0
            total_expendables = 0
            low_stock_alerts = 0

            for k in kits:
                item_count = k.items.count() if k.items else 0
                expendable_count = k.expendables.count() if k.expendables else 0
                box_count = k.boxes.count() if k.boxes else 0

                # Count low stock
                low_stock = 0
                for e in k.expendables.all() if k.expendables else []:
                    if e.is_low_stock():
                        low_stock += 1

                total_items += item_count
                total_expendables += expendable_count
                low_stock_alerts += low_stock

                # Get last activity
                last_issuance = k.issuances.order_by(KitIssuance.issued_date.desc()).first() if k.issuances else None

                kits_data.append({
                    "kit_id": k.id,
                    "kit_name": k.name,
                    "aircraft_type": k.aircraft_type.name if k.aircraft_type else "Unknown",
                    "status": k.status,
                    "total_items": item_count,
                    "total_expendables": expendable_count,
                    "low_stock_items": low_stock,
                    "boxes": box_count,
                    "last_activity": last_issuance.issued_date.isoformat() if last_issuance else None
                })

            # Summary
            summary = {
                "totalKits": len(kits),
                "activeKits": sum(1 for k in kits if k.status == "active"),
                "totalItems": total_items,
                "totalExpendables": total_expendables,
                "lowStockAlerts": low_stock_alerts
            }

            # By aircraft type
            type_counts = defaultdict(int)
            for k in kits:
                type_name = k.aircraft_type.name if k.aircraft_type else "Unknown"
                type_counts[type_name] += 1
            by_aircraft_type = [{"name": k, "value": v} for k, v in type_counts.items()]

            return jsonify({
                "kits": kits_data,
                "summary": summary,
                "byAircraftType": by_aircraft_type
            }), 200

        except Exception:
            logger.exception("Error in kit inventory report")
            return jsonify({"error": "Failed to generate kit inventory report"}), 500

    @app.route("/api/reports/kits/issuances", methods=["GET"])
    @jwt_required
    def kit_issuance_report():
        """Generate kit issuance report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            kit_id = request.args.get("kit_id", type=int)
            aircraft_type_id = request.args.get("aircraft_type_id", type=int)

            start_date = calculate_date_range(timeframe)

            query = KitIssuance.query.filter(KitIssuance.issued_date >= start_date)

            if kit_id:
                query = query.filter(KitIssuance.kit_id == kit_id)
            if aircraft_type_id:
                query = query.join(Kit).filter(Kit.aircraft_type_id == aircraft_type_id)

            issuances = query.order_by(KitIssuance.issued_date.desc()).all()

            issuances_data = []
            for i in issuances:
                issuances_data.append({
                    "id": i.id,
                    "kit_id": i.kit_id,
                    "kit_name": i.kit.name if i.kit else "Unknown",
                    "aircraft_type": i.kit.aircraft_type.name if i.kit and i.kit.aircraft_type else "Unknown",
                    "item_type": i.item_type,
                    "item_name": i.description or "",
                    "part_number": i.part_number or "",
                    "quantity": i.quantity,
                    "issued_to": i.recipient.name if i.recipient else "Unknown",
                    "issued_by": i.issuer.name if i.issuer else "Unknown",
                    "issued_date": i.issued_date.isoformat() if i.issued_date else None,
                    "work_order": i.work_order or "",
                    "aircraft_tail": "",
                    "notes": i.notes or ""
                })

            # Summary
            summary = {
                "totalIssuances": len(issuances),
                "uniqueKits": len(set(i.kit_id for i in issuances)),
                "uniqueItems": len(set(i.item_id for i in issuances)),
                "totalQuantity": sum(i.quantity for i in issuances)
            }

            # By day
            day_counts = defaultdict(int)
            for i in issuances:
                day = i.issued_date.strftime("%Y-%m-%d")
                day_counts[day] += 1
            issuances_by_day = sorted([{"date": k, "count": v} for k, v in day_counts.items()], key=lambda x: x["date"])

            # By kit
            kit_counts = defaultdict(int)
            for i in issuances:
                name = i.kit.name if i.kit else "Unknown"
                kit_counts[name] += 1
            issuances_by_kit = sorted([{"name": k, "value": v} for k, v in kit_counts.items()], key=lambda x: x["value"], reverse=True)[:10]

            # Top items
            item_counts = defaultdict(int)
            for i in issuances:
                name = i.description or i.part_number or "Unknown"
                item_counts[name] += i.quantity
            top_items = sorted([{"name": k, "value": v} for k, v in item_counts.items()], key=lambda x: x["value"], reverse=True)[:10]

            return jsonify({
                "issuances": issuances_data,
                "summary": summary,
                "issuancesByDay": issuances_by_day,
                "issuancesByKit": issuances_by_kit,
                "topItems": top_items
            }), 200

        except Exception:
            logger.exception("Error in kit issuance report")
            return jsonify({"error": "Failed to generate kit issuance report"}), 500

    @app.route("/api/reports/kits/transfers", methods=["GET"])
    @jwt_required
    def kit_transfer_report():
        """Generate kit transfer report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            start_date = calculate_date_range(timeframe)

            transfers = KitTransfer.query.filter(
                KitTransfer.transfer_date >= start_date
            ).order_by(KitTransfer.transfer_date.desc()).all()

            transfers_data = []
            for t in transfers:
                transfers_data.append(t.to_dict())

            # Summary
            to_kits = sum(1 for t in transfers if t.to_location_type == "kit")
            to_warehouse = sum(1 for t in transfers if t.to_location_type == "warehouse")

            summary = {
                "totalTransfers": len(transfers),
                "toKits": to_kits,
                "toWarehouse": to_warehouse,
                "uniqueItems": len(set(t.item_id for t in transfers))
            }

            # By day
            day_counts = defaultdict(int)
            for t in transfers:
                day = t.transfer_date.strftime("%Y-%m-%d")
                day_counts[day] += 1
            transfers_by_day = sorted([{"date": k, "count": v} for k, v in day_counts.items()], key=lambda x: x["date"])

            # By kit (outgoing/incoming)
            kit_transfers = defaultdict(lambda: {"outgoing": 0, "incoming": 0})
            for t in transfers:
                if t.from_location_type == "kit":
                    kit = db.session.get(Kit, t.from_location_id)
                    if kit:
                        kit_transfers[kit.name]["outgoing"] += 1
                if t.to_location_type == "kit":
                    kit = db.session.get(Kit, t.to_location_id)
                    if kit:
                        kit_transfers[kit.name]["incoming"] += 1
            transfers_by_kit = [{"name": k, **v} for k, v in kit_transfers.items()]

            return jsonify({
                "transfers": transfers_data,
                "summary": summary,
                "transfersByDay": transfers_by_day,
                "transfersByKit": transfers_by_kit
            }), 200

        except Exception:
            logger.exception("Error in kit transfer report")
            return jsonify({"error": "Failed to generate kit transfer report"}), 500

    @app.route("/api/reports/kits/reorders", methods=["GET"])
    @jwt_required
    def kit_reorder_report():
        """Generate kit reorder request report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            status = request.args.get("status")
            priority = request.args.get("priority")

            start_date = calculate_date_range(timeframe)

            query = KitReorderRequest.query.filter(KitReorderRequest.requested_date >= start_date)

            if status:
                query = query.filter(KitReorderRequest.status == status)
            if priority:
                query = query.filter(KitReorderRequest.priority == priority)

            reorders = query.order_by(KitReorderRequest.requested_date.desc()).all()

            reorders_data = []
            for r in reorders:
                reorders_data.append({
                    "id": r.id,
                    "kit_id": r.kit_id,
                    "kit_name": r.kit.name if r.kit else "Unknown",
                    "aircraft_type": r.kit.aircraft_type.name if r.kit and r.kit.aircraft_type else "Unknown",
                    "item_type": r.item_type,
                    "item_name": r.description,
                    "part_number": r.part_number,
                    "quantity_requested": r.quantity_requested,
                    "priority": r.priority,
                    "status": r.status,
                    "requested_by": r.requester.name if r.requester else "Unknown",
                    "requested_date": r.requested_date.isoformat() if r.requested_date else None,
                    "approved_by": r.approver.name if r.approver else None,
                    "approved_date": r.approved_date.isoformat() if r.approved_date else None,
                    "notes": r.notes or ""
                })

            # Summary
            summary = {
                "totalReorders": len(reorders),
                "pending": sum(1 for r in reorders if r.status == "pending"),
                "approved": sum(1 for r in reorders if r.status == "approved"),
                "ordered": sum(1 for r in reorders if r.status == "ordered"),
                "received": sum(1 for r in reorders if r.status == "fulfilled"),
                "cancelled": sum(1 for r in reorders if r.status == "cancelled")
            }

            # By priority
            priority_colors = {
                "low": "#52c41a",
                "medium": "#1890ff",
                "high": "#faad14",
                "urgent": "#ff4d4f"
            }
            priority_counts = defaultdict(int)
            for r in reorders:
                priority_counts[r.priority] += 1
            by_priority = [{"name": k.title(), "value": v, "color": priority_colors.get(k, "#8c8c8c")} for k, v in priority_counts.items()]

            # By status
            status_counts = defaultdict(int)
            for r in reorders:
                status_counts[r.status] += 1
            by_status = [{"name": k.replace("_", " ").title(), "value": v} for k, v in status_counts.items()]

            # By month
            month_counts = defaultdict(int)
            for r in reorders:
                if r.requested_date:
                    month = r.requested_date.strftime("%b %Y")
                    month_counts[month] += 1
            reorders_by_month = [{"month": k, "count": v} for k, v in month_counts.items()]

            return jsonify({
                "reorders": reorders_data,
                "summary": summary,
                "byPriority": by_priority,
                "byStatus": by_status,
                "reordersByMonth": reorders_by_month
            }), 200

        except Exception:
            logger.exception("Error in kit reorder report")
            return jsonify({"error": "Failed to generate kit reorder report"}), 500

    # ========================================================================
    # ORDER REPORTS
    # ========================================================================

    @app.route("/api/reports/orders/procurement", methods=["GET"])
    @jwt_required
    def procurement_order_report():
        """Generate procurement order report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            status = request.args.get("status")
            priority = request.args.get("priority")

            start_date = calculate_date_range(timeframe)

            query = ProcurementOrder.query.filter(ProcurementOrder.created_at >= start_date)

            if status:
                query = query.filter(ProcurementOrder.status == status)
            if priority:
                query = query.filter(ProcurementOrder.priority == priority)

            orders = query.order_by(ProcurementOrder.created_at.desc()).all()

            orders_data = []
            for o in orders:
                orders_data.append({
                    "id": o.id,
                    "order_number": o.order_number,
                    "title": o.title,
                    "description": o.description,
                    "requester_name": o.requester.name if o.requester else "Unknown",
                    "department": o.requester.department if o.requester else "Unknown",
                    "priority": o.priority,
                    "status": o.status,
                    "vendor": o.vendor,
                    "estimated_cost": None,
                    "actual_cost": None,
                    "due_date": o.expected_due_date.isoformat() if o.expected_due_date else None,
                    "order_date": o.ordered_date.isoformat() if o.ordered_date else None,
                    "delivery_date": o.completed_date.isoformat() if o.completed_date else None,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "updated_at": o.updated_at.isoformat() if o.updated_at else None
                })

            # Summary
            summary = {
                "total": len(orders),
                "new": sum(1 for o in orders if o.status == "new"),
                "inProgress": sum(1 for o in orders if o.status == "in_progress"),
                "ordered": sum(1 for o in orders if o.status == "ordered"),
                "shipped": sum(1 for o in orders if o.status == "shipped"),
                "received": sum(1 for o in orders if o.status == "received"),
                "totalEstimatedCost": 0,
                "totalActualCost": 0,
                "averageProcessingTime": 0
            }

            # Calculate average processing time
            completed_orders = [o for o in orders if o.completed_date and o.created_at]
            if completed_orders:
                total_days = sum((o.completed_date - o.created_at).days for o in completed_orders)
                summary["averageProcessingTime"] = round(total_days / len(completed_orders), 1)

            # By status
            status_colors = {
                "new": "#1890ff",
                "awaiting_info": "#faad14",
                "in_progress": "#722ed1",
                "ordered": "#13c2c2",
                "shipped": "#52c41a",
                "received": "#237804",
                "cancelled": "#8c8c8c"
            }
            status_counts = defaultdict(int)
            for o in orders:
                status_counts[o.status] += 1
            by_status = [{"name": k.replace("_", " ").title(), "value": v, "color": status_colors.get(k, "#8c8c8c")} for k, v in status_counts.items()]

            # By priority
            priority_counts = defaultdict(int)
            for o in orders:
                priority_counts[o.priority] += 1
            by_priority = [{"name": k.title(), "value": v} for k, v in priority_counts.items()]

            # By month
            month_counts = defaultdict(lambda: {"count": 0, "cost": 0})
            for o in orders:
                if o.created_at:
                    month = o.created_at.strftime("%b %Y")
                    month_counts[month]["count"] += 1
            orders_by_month = [{"month": k, "count": v["count"], "cost": v["cost"]} for k, v in month_counts.items()]

            # Top vendors
            vendor_counts = defaultdict(lambda: {"orders": 0, "totalCost": 0})
            for o in orders:
                if o.vendor:
                    vendor_counts[o.vendor]["orders"] += 1
            top_vendors = sorted([{"name": k, **v} for k, v in vendor_counts.items()], key=lambda x: x["orders"], reverse=True)[:10]

            return jsonify({
                "orders": orders_data,
                "summary": summary,
                "byStatus": by_status,
                "byPriority": by_priority,
                "ordersByMonth": orders_by_month,
                "topVendors": top_vendors
            }), 200

        except Exception:
            logger.exception("Error in procurement order report")
            return jsonify({"error": "Failed to generate procurement order report"}), 500

    @app.route("/api/reports/orders/requests", methods=["GET"])
    @jwt_required
    def user_request_report():
        """Generate user request report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            status = request.args.get("status")

            start_date = calculate_date_range(timeframe)

            query = UserRequest.query.filter(UserRequest.created_at >= start_date)

            if status:
                query = query.filter(UserRequest.status == status)

            requests = query.order_by(UserRequest.created_at.desc()).all()

            requests_data = []
            for r in requests:
                item_count = r.items.count() if r.items else 0
                items_pending = r.items.filter(RequestItem.status == "pending").count() if r.items else 0
                items_received = r.items.filter(RequestItem.status == "received").count() if r.items else 0

                requests_data.append({
                    "id": r.id,
                    "request_number": r.request_number,
                    "requester_name": r.requester.name if r.requester else "Unknown",
                    "department": r.requester.department if r.requester else "Unknown",
                    "status": r.status,
                    "total_items": item_count,
                    "items_pending": items_pending,
                    "items_received": items_received,
                    "priority": r.priority,
                    "buyer_name": r.buyer.name if r.buyer else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None
                })

            # Summary
            open_statuses = {"new", "awaiting_info", "in_progress", "partially_ordered", "ordered", "partially_received"}
            summary = {
                "total": len(requests),
                "open": sum(1 for r in requests if r.status in open_statuses),
                "inProgress": sum(1 for r in requests if r.status == "in_progress"),
                "completed": sum(1 for r in requests if r.status == "received"),
                "averageCompletionTime": 0
            }

            # Calculate average completion time
            completed = [r for r in requests if r.status == "received" and r.updated_at and r.created_at]
            if completed:
                total_days = sum((r.updated_at - r.created_at).days for r in completed)
                summary["averageCompletionTime"] = round(total_days / len(completed), 1)

            # By status
            status_counts = defaultdict(int)
            for r in requests:
                status_counts[r.status] += 1
            by_status = [{"name": k.replace("_", " ").title(), "value": v} for k, v in status_counts.items()]

            # By department
            dept_counts = defaultdict(int)
            for r in requests:
                dept = r.requester.department if r.requester else "Unknown"
                dept_counts[dept] += 1
            by_department = [{"name": k, "value": v} for k, v in dept_counts.items()]

            # By month
            month_counts = defaultdict(int)
            for r in requests:
                if r.created_at:
                    month = r.created_at.strftime("%b %Y")
                    month_counts[month] += 1
            requests_by_month = [{"month": k, "count": v} for k, v in month_counts.items()]

            # Top requesters
            requester_counts = defaultdict(int)
            for r in requests:
                name = r.requester.name if r.requester else "Unknown"
                requester_counts[name] += 1
            top_requesters = sorted([{"name": k, "requests": v} for k, v in requester_counts.items()], key=lambda x: x["requests"], reverse=True)[:10]

            return jsonify({
                "requests": requests_data,
                "summary": summary,
                "byStatus": by_status,
                "byDepartment": by_department,
                "requestsByMonth": requests_by_month,
                "topRequesters": top_requesters
            }), 200

        except Exception:
            logger.exception("Error in user request report")
            return jsonify({"error": "Failed to generate user request report"}), 500

    # ========================================================================
    # ADMIN REPORTS
    # ========================================================================

    @app.route("/api/reports/admin/user-activity", methods=["GET"])
    @jwt_required
    def user_activity_report():
        """Generate user activity report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            user_id = request.args.get("user_id", type=int)

            start_date = calculate_date_range(timeframe)

            query = UserActivity.query.filter(UserActivity.timestamp >= start_date)

            if user_id:
                query = query.filter(UserActivity.user_id == user_id)

            activities = query.order_by(UserActivity.timestamp.desc()).limit(1000).all()

            activities_data = []
            for a in activities:
                activities_data.append({
                    "id": a.id,
                    "user_id": a.user_id,
                    "user_name": a.user.name if a.user else "Unknown",
                    "employee_number": a.user.employee_number if a.user else "Unknown",
                    "department": a.user.department if a.user else "Unknown",
                    "action": a.activity_type,
                    "resource_type": "",
                    "resource_id": None,
                    "details": a.description or "",
                    "ip_address": a.ip_address or "",
                    "timestamp": a.timestamp.isoformat() if a.timestamp else None
                })

            # Summary
            unique_users = len(set(a.user_id for a in activities))

            action_counts = defaultdict(int)
            for a in activities:
                action_counts[a.activity_type] += 1
            top_actions = sorted([{"name": k, "value": v} for k, v in action_counts.items()], key=lambda x: x["value"], reverse=True)[:10]

            # By day
            day_counts = defaultdict(int)
            for a in activities:
                day = a.timestamp.strftime("%Y-%m-%d")
                day_counts[day] += 1
            activity_by_day = sorted([{"date": k, "count": v} for k, v in day_counts.items()], key=lambda x: x["date"])

            # By user
            user_counts = defaultdict(int)
            for a in activities:
                name = a.user.name if a.user else "Unknown"
                user_counts[name] += 1
            activity_by_user = sorted([{"name": k, "value": v} for k, v in user_counts.items()], key=lambda x: x["value"], reverse=True)[:10]

            # By type
            type_counts = defaultdict(int)
            for a in activities:
                type_counts[a.activity_type] += 1
            activity_by_type = [{"name": k, "value": v} for k, v in type_counts.items()]

            return jsonify({
                "activities": activities_data[:500],  # Limit response size
                "summary": {
                    "totalActivities": len(activities),
                    "uniqueUsers": unique_users,
                    "topActions": top_actions
                },
                "activityByDay": activity_by_day,
                "activityByUser": activity_by_user,
                "activityByType": activity_by_type
            }), 200

        except Exception:
            logger.exception("Error in user activity report")
            return jsonify({"error": "Failed to generate user activity report"}), 500

    @app.route("/api/reports/admin/system-stats", methods=["GET"])
    @jwt_required
    def system_stats_report():
        """Generate comprehensive system statistics report."""
        try:
            now = datetime.now()
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            week_start = now - timedelta(days=now.weekday())
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

            # User stats
            all_users = User.query.all()
            users_stats = {
                "total": len(all_users),
                "active": sum(1 for u in all_users if u.is_active),
                "locked": sum(1 for u in all_users if u.is_locked()),
                "newThisMonth": User.query.filter(User.created_at >= month_start).count(),
                "byDepartment": []
            }

            dept_counts = defaultdict(int)
            for u in all_users:
                dept_counts[u.department or "Unassigned"] += 1
            users_stats["byDepartment"] = [{"name": k, "value": v} for k, v in dept_counts.items()]

            # Inventory stats
            tools = Tool.query.all()
            chemicals = Chemical.query.all()
            kits = Kit.query.all()

            checked_out_ids = set(c.tool_id for c in Checkout.query.filter(Checkout.return_date.is_(None)).all())

            inventory_stats = {
                "totalTools": len(tools),
                "totalChemicals": len(chemicals),
                "totalKits": len(kits),
                "totalWarehouses": 0,  # Add if Warehouse model is available
                "lowStockAlerts": sum(1 for c in chemicals if c.status == "low_stock"),
                "expirationAlerts": sum(1 for c in chemicals if c.is_expired() or c.is_expiring_soon()),
                "calibrationAlerts": sum(1 for t in tools if t.calibration_status in ["due_soon", "overdue"])
            }

            # Order stats
            orders_stats = {
                "totalOrders": ProcurementOrder.query.count(),
                "pendingOrders": ProcurementOrder.query.filter(ProcurementOrder.status.in_(["new", "awaiting_info", "in_progress"])).count(),
                "lateOrders": ProcurementOrder.query.filter(
                    and_(
                        ProcurementOrder.expected_due_date < now,
                        ProcurementOrder.status.notin_(["received", "cancelled"])
                    )
                ).count(),
                "totalRequests": UserRequest.query.count(),
                "pendingRequests": UserRequest.query.filter(UserRequest.status.in_(["new", "awaiting_info", "in_progress"])).count()
            }

            # Activity stats
            activity_stats = {
                "checkoutsToday": Checkout.query.filter(Checkout.checkout_date >= today_start).count(),
                "checkoutsThisWeek": Checkout.query.filter(Checkout.checkout_date >= week_start).count(),
                "checkoutsThisMonth": Checkout.query.filter(Checkout.checkout_date >= month_start).count(),
                "issuancesToday": KitIssuance.query.filter(KitIssuance.issued_date >= today_start).count(),
                "issuancesThisWeek": KitIssuance.query.filter(KitIssuance.issued_date >= week_start).count(),
                "issuancesThisMonth": KitIssuance.query.filter(KitIssuance.issued_date >= month_start).count()
            }

            return jsonify({
                "users": users_stats,
                "inventory": inventory_stats,
                "orders": orders_stats,
                "activity": activity_stats
            }), 200

        except Exception:
            logger.exception("Error in system stats report")
            return jsonify({"error": "Failed to generate system stats report"}), 500

    @app.route("/api/reports/admin/audit-log", methods=["GET"])
    @jwt_required
    def audit_log_report():
        """Generate audit log report."""
        try:
            timeframe = request.args.get("timeframe", "month")
            user_id = request.args.get("user_id", type=int)
            action = request.args.get("action")

            start_date = calculate_date_range(timeframe)

            query = UserActivity.query.filter(UserActivity.timestamp >= start_date)

            if user_id:
                query = query.filter(UserActivity.user_id == user_id)
            if action:
                query = query.filter(UserActivity.activity_type.ilike(f"%{action}%"))

            logs = query.order_by(UserActivity.timestamp.desc()).limit(1000).all()

            logs_data = []
            for log in logs:
                logs_data.append({
                    "id": log.id,
                    "user_id": log.user_id,
                    "user_name": log.user.name if log.user else "Unknown",
                    "action": log.activity_type,
                    "resource_type": "",
                    "resource_id": None,
                    "old_value": None,
                    "new_value": None,
                    "ip_address": log.ip_address or "",
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None
                })

            # Summary
            action_counts = defaultdict(int)
            for log in logs:
                if "create" in log.activity_type.lower():
                    action_counts["creates"] += 1
                elif "update" in log.activity_type.lower() or "edit" in log.activity_type.lower():
                    action_counts["updates"] += 1
                elif "delete" in log.activity_type.lower():
                    action_counts["deletes"] += 1

            summary = {
                "total": len(logs),
                "creates": action_counts.get("creates", 0),
                "updates": action_counts.get("updates", 0),
                "deletes": action_counts.get("deletes", 0)
            }

            # By day
            day_counts = defaultdict(int)
            for log in logs:
                day = log.timestamp.strftime("%Y-%m-%d")
                day_counts[day] += 1
            logs_by_day = sorted([{"date": k, "count": v} for k, v in day_counts.items()], key=lambda x: x["date"])

            # By action
            action_type_counts = defaultdict(int)
            for log in logs:
                action_type_counts[log.activity_type] += 1
            logs_by_action = [{"name": k, "value": v} for k, v in action_type_counts.items()]

            return jsonify({
                "logs": logs_data[:500],
                "summary": summary,
                "logsByDay": logs_by_day,
                "logsByAction": logs_by_action
            }), 200

        except Exception:
            logger.exception("Error in audit log report")
            return jsonify({"error": "Failed to generate audit log report"}), 500

    # ========================================================================
    # LEGACY ROUTES (for backward compatibility)
    # ========================================================================

    @app.route("/api/reports/tools", methods=["GET"])
    @jwt_required
    def legacy_tool_inventory_report():
        """Legacy tool inventory report endpoint."""
        return tool_inventory_report()

    @app.route("/api/reports/checkouts", methods=["GET"])
    @jwt_required
    def legacy_checkout_history_report():
        """Legacy checkout history report endpoint."""
        return checkout_history_report()

    @app.route("/api/reports/departments", methods=["GET"])
    @jwt_required
    def legacy_department_usage_report():
        """Legacy department usage report endpoint."""
        return department_usage_report()
