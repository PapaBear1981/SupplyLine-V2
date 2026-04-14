"""Usage analytics routes.

Provides checkout / return / tool-usage statistics for the admin
dashboard and reporting views.
"""

import logging
from datetime import datetime, timedelta

from flask import jsonify, request
from sqlalchemy import func

from auth import department_required
from models import Checkout, Tool, User, db


logger = logging.getLogger(__name__)

tool_manager_required = department_required("Materials")


def _get_category_name(code):
    """Convert a tool-number prefix into a readable category name."""
    categories = {
        "DRL": "Power Tools",
        "SAW": "Power Tools",
        "WRN": "Hand Tools",
        "PLR": "Hand Tools",
        "HAM": "Hand Tools",
        "MSR": "Measurement",
        "SFT": "Safety Equipment",
        "ELC": "Electrical",
        "PLM": "Plumbing",
        "WLD": "Welding",
    }
    return categories.get(code, "Other")


def register_analytics_routes(app):
    @app.route("/api/analytics/usage", methods=["GET"])
    @tool_manager_required
    def get_usage_analytics():
        try:
            # Get timeframe parameter (default to 'week')
            timeframe = request.args.get("timeframe", "week")

            # Calculate date range based on timeframe
            now = datetime.now()
            if timeframe == "day":
                start_date = now - timedelta(days=1)
            elif timeframe == "week":
                start_date = now - timedelta(weeks=1)
            elif timeframe == "month":
                start_date = now - timedelta(days=30)
            elif timeframe == "quarter":
                start_date = now - timedelta(days=90)
            elif timeframe == "year":
                start_date = now - timedelta(days=365)
            else:
                start_date = now - timedelta(weeks=1)  # Default to week

            # Initialize response data structure
            response_data = {
                "timeframe": timeframe,
                "checkoutsByDepartment": [],
                "checkoutsByDay": [],
                "toolUsageByCategory": [],
                "mostFrequentlyCheckedOut": [],
                "overallStats": {}
            }

            # 1. Get checkouts by department
            try:
                dept_checkouts = db.session.query(
                    User.department.label("department"),
                    func.count(Checkout.id).label("count")
                ).join(
                    User, User.id == Checkout.user_id
                ).filter(
                    Checkout.checkout_date >= start_date
                ).group_by(
                    User.department
                ).all()

                # Format the results for the frontend
                dept_data = [{
                    "name": dept.department or "Unknown",
                    "value": dept.count
                } for dept in dept_checkouts]

                response_data["checkoutsByDepartment"] = dept_data
            except Exception:
                logger.exception("Error getting department data")
                # Continue with other queries even if this one fails

            # 2. Get daily checkout and return data
            try:
                # Get checkouts by day
                daily_checkouts = db.session.query(
                    func.date(Checkout.checkout_date).label("date"),
                    func.count().label("count")
                ).filter(
                    Checkout.checkout_date >= start_date
                ).group_by(
                    func.date(Checkout.checkout_date)
                ).all()

                # Get returns by day
                daily_returns = db.session.query(
                    func.date(Checkout.return_date).label("date"),
                    func.count().label("count")
                ).filter(
                    Checkout.return_date >= start_date
                ).group_by(
                    func.date(Checkout.return_date)
                ).all()

                # Create a dictionary to store daily data
                daily_data_dict = {}

                # Process checkout data
                for day in daily_checkouts:
                    date_str = str(day.date)
                    weekday = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")

                    if date_str not in daily_data_dict:
                        daily_data_dict[date_str] = {
                            "name": weekday,
                            "date": date_str,
                            "checkouts": 0,
                            "returns": 0
                        }

                    daily_data_dict[date_str]["checkouts"] = day.count

                # Process return data
                for day in daily_returns:
                    if day.date:  # Ensure date is not None
                        date_str = str(day.date)
                        weekday = datetime.strptime(date_str, "%Y-%m-%d").strftime("%a")

                        if date_str not in daily_data_dict:
                            daily_data_dict[date_str] = {
                                "name": weekday,
                                "date": date_str,
                                "checkouts": 0,
                                "returns": 0
                            }

                        daily_data_dict[date_str]["returns"] = day.count

                # Convert dictionary to sorted list
                daily_data = sorted(daily_data_dict.values(), key=lambda x: x["date"])

                response_data["checkoutsByDay"] = daily_data
            except Exception:
                logger.exception("Error getting daily checkout data")
                # Continue with other queries even if this one fails

            # 3. Get tool usage by category
            try:
                tool_usage = db.session.query(
                    Tool.id,
                    Tool.tool_number,
                    Tool.description,
                    func.count(Checkout.id).label("checkout_count")
                ).join(
                    Checkout, Tool.id == Checkout.tool_id
                ).filter(
                    Checkout.checkout_date >= start_date
                ).group_by(
                    Tool.id
                ).all()

                # Categorize tools based on their tool number or description
                category_counts = {}

                for tool in tool_usage:
                    # Determine category from tool number prefix or description
                    category = _get_category_name(tool.tool_number[:3] if tool.tool_number else "")

                    if category not in category_counts:
                        category_counts[category] = 0

                    category_counts[category] += tool.checkout_count

                # Convert to list format for the frontend
                category_data = [{"name": cat, "checkouts": count} for cat, count in category_counts.items()]

                # Sort by checkout count (descending)
                category_data.sort(key=lambda x: x["checkouts"], reverse=True)

                response_data["toolUsageByCategory"] = category_data
            except Exception:
                logger.exception("Error getting tool usage by category")
                # Continue with other queries even if this one fails

            # 4. Get most frequently checked out tools
            try:
                top_tools = db.session.query(
                    Tool.id,
                    Tool.tool_number,
                    Tool.description,
                    func.count(Checkout.id).label("checkout_count")
                ).join(
                    Checkout, Tool.id == Checkout.tool_id
                ).filter(
                    Checkout.checkout_date >= start_date
                ).group_by(
                    Tool.id
                ).order_by(
                    func.count(Checkout.id).desc()
                ).limit(5).all()

                top_tools_data = [{
                    "id": tool.id,
                    "tool_number": tool.tool_number,
                    "description": tool.description or "",
                    "checkouts": tool.checkout_count
                } for tool in top_tools]

                response_data["mostFrequentlyCheckedOut"] = top_tools_data
            except Exception:
                logger.exception("Error getting top tools data")
                # Continue with other queries even if this one fails

            # 5. Get overall statistics
            try:
                # Total checkouts in period
                total_checkouts = Checkout.query.filter(
                    Checkout.checkout_date >= start_date
                ).count()

                # Total returns in period
                total_returns = Checkout.query.filter(
                    Checkout.return_date >= start_date
                ).count()

                # Currently checked out
                currently_checked_out = Checkout.query.filter(
                    Checkout.return_date.is_(None)
                ).count()

                # Average checkout duration (for returned items)
                avg_duration_query = db.session.query(
                    func.avg(
                        func.julianday(Checkout.return_date) - func.julianday(Checkout.checkout_date)
                    ).label("avg_days")
                ).filter(
                    Checkout.checkout_date >= start_date,
                    Checkout.return_date.isnot(None)
                ).scalar()

                avg_duration = round(float(avg_duration_query or 0), 1)

                # Overdue checkouts
                overdue_count = Checkout.query.filter(
                    Checkout.return_date.is_(None),
                    Checkout.expected_return_date < now
                ).count()

                response_data["overallStats"] = {
                    "totalCheckouts": total_checkouts,
                    "totalReturns": total_returns,
                    "currentlyCheckedOut": currently_checked_out,
                    "averageDuration": avg_duration,
                    "overdueCount": overdue_count
                }
            except Exception:
                logger.exception("Error getting overall checkout stats")
                # Continue even if this query fails

            return jsonify(response_data), 200

        except Exception:
            logger.exception("Error in analytics endpoint")
            return jsonify({
                "error": "An error occurred while generating analytics data"
            }), 500
