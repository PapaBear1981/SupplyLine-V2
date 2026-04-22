"""
Tool history endpoint tests for SupplyLine MRO Suite

Tests history/timeline visibility:
- Per-tool timeline endpoint
- Per-tool checkout history endpoint
- Cross-tool audit history endpoint (GET /api/tool-history)
- History events automatically created on checkout and check-in
"""

from datetime import datetime, timedelta

import pytest

from models import Checkout, Tool, ToolHistory


@pytest.mark.integration
@pytest.mark.api
class TestToolTimeline:
    """Tests for GET /api/tools/<id>/timeline"""

    def test_timeline_returns_200_for_valid_tool(self, client, auth_headers, test_tool, db_session):
        """Timeline endpoint returns 200 for an existing tool."""
        response = client.get(
            f"/api/tools/{test_tool.id}/timeline",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "timeline" in data
        assert "stats" in data

    def test_timeline_requires_auth(self, client, test_tool):
        """Timeline endpoint returns 401 without a JWT token."""
        response = client.get(f"/api/tools/{test_tool.id}/timeline")
        assert response.status_code == 401

    def test_timeline_returns_404_for_missing_tool(self, client, auth_headers):
        """Timeline endpoint returns 404 when tool does not exist."""
        response = client.get("/api/tools/999999/timeline", headers=auth_headers)
        assert response.status_code == 404

    def test_timeline_events_after_checkout(
        self, client, auth_headers, auth_headers_user, regular_user, test_tool, db_session
    ):
        """A checkout operation creates a ToolHistory event visible in the timeline."""
        checkout_data = {
            "tool_id": test_tool.id,
            "user_id": regular_user.id,
            "notes": "Test checkout for timeline",
        }
        checkout_resp = client.post(
            "/api/tool-checkout",
            json=checkout_data,
            headers=auth_headers,
        )
        # Accept either success or a 409 if already checked out from a previous test run
        assert checkout_resp.status_code in (201, 409)
        if checkout_resp.status_code != 201:
            return  # Skip the rest if the tool was already checked out

        timeline_resp = client.get(
            f"/api/tools/{test_tool.id}/timeline",
            headers=auth_headers,
        )
        assert timeline_resp.status_code == 200
        data = timeline_resp.get_json()
        event_types = [e["event_type"] for e in data["timeline"]]
        assert "checkout" in event_types

    def test_timeline_filter_by_event_type(self, client, auth_headers, test_tool, db_session, admin_user):
        """event_type query param filters timeline results."""
        history_entry = ToolHistory.create_event(
            tool_id=test_tool.id,
            event_type="status_change",
            user_id=admin_user.id,
            description="Test status change",
        )
        db_session.add(history_entry)
        db_session.commit()

        response = client.get(
            f"/api/tools/{test_tool.id}/timeline?event_type=status_change",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        for event in data["timeline"]:
            assert event["event_type"] == "status_change"

    def test_timeline_stats_include_counts(self, client, auth_headers, test_tool, db_session, admin_user):
        """Timeline stats section includes numeric count fields."""
        response = client.get(
            f"/api/tools/{test_tool.id}/timeline",
            headers=auth_headers,
        )
        assert response.status_code == 200
        stats = response.get_json()["stats"]
        assert "total_checkouts" in stats
        assert "damage_reports" in stats
        assert "calibrations" in stats
        assert "service_records" in stats


@pytest.mark.integration
@pytest.mark.api
class TestToolCheckoutHistory:
    """Tests for GET /api/tools/<id>/checkout-history"""

    def test_checkout_history_returns_200(self, client, auth_headers, test_tool):
        """Checkout history endpoint returns 200."""
        response = client.get(
            f"/api/tools/{test_tool.id}/checkout-history",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "checkouts" in data
        assert isinstance(data["checkouts"], list)

    def test_checkout_history_requires_auth(self, client, test_tool):
        """Checkout history endpoint returns 401 without token."""
        response = client.get(f"/api/tools/{test_tool.id}/checkout-history")
        assert response.status_code == 401

    def test_checkout_history_includes_created_checkout(
        self, client, auth_headers, test_tool, regular_user, db_session
    ):
        """A checkout appears in the tool's checkout history."""
        # Create checkout directly in DB to avoid dependency on checkout endpoint state
        checkout = Checkout(
            tool_id=test_tool.id,
            user_id=regular_user.id,
            checkout_notes="History test",
        )
        db_session.add(checkout)
        test_tool.status = "checked_out"
        db_session.commit()

        response = client.get(
            f"/api/tools/{test_tool.id}/checkout-history",
            headers=auth_headers,
        )
        assert response.status_code == 200
        checkouts = response.get_json()["checkouts"]
        assert len(checkouts) >= 1
        assert any(c["id"] == checkout.id for c in checkouts)

        # Cleanup
        db_session.delete(checkout)
        test_tool.status = "available"
        db_session.commit()

    def test_checkout_history_records_include_user_info(
        self, client, auth_headers, test_tool, regular_user, db_session
    ):
        """Checkout history records include user name information."""
        checkout = Checkout(
            tool_id=test_tool.id,
            user_id=regular_user.id,
        )
        db_session.add(checkout)
        test_tool.status = "checked_out"
        db_session.commit()

        response = client.get(
            f"/api/tools/{test_tool.id}/checkout-history",
            headers=auth_headers,
        )
        assert response.status_code == 200
        checkouts = response.get_json()["checkouts"]
        matching = [c for c in checkouts if c["id"] == checkout.id]
        assert matching, "Created checkout not found in history"
        record = matching[0]
        assert "user_name" in record or "user_id" in record

        # Cleanup
        db_session.delete(checkout)
        test_tool.status = "available"
        db_session.commit()


@pytest.mark.integration
@pytest.mark.api
class TestToolAuditHistory:
    """Tests for GET /api/tool-history (cross-tool audit endpoint)"""

    def test_audit_history_returns_200(self, client, auth_headers):
        """Audit history endpoint returns 200 for authenticated users."""
        response = client.get("/api/tool-history", headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert "history" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "pages" in data

    def test_audit_history_requires_auth(self, client):
        """Audit history endpoint returns 401 without token."""
        response = client.get("/api/tool-history")
        assert response.status_code == 401

    def test_audit_history_contains_tool_info(
        self, client, auth_headers, test_tool, admin_user, db_session
    ):
        """Audit history records include tool_number and tool_description."""
        history_entry = ToolHistory.create_event(
            tool_id=test_tool.id,
            event_type="status_change",
            user_id=admin_user.id,
            description="Audit test event",
        )
        db_session.add(history_entry)
        db_session.commit()

        response = client.get(
            f"/api/tool-history?tool_id={test_tool.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        history = response.get_json()["history"]
        assert len(history) >= 1
        record = history[0]
        assert record["tool_number"] == test_tool.tool_number
        assert record["tool_description"] == test_tool.description

    def test_audit_history_filter_by_event_type(
        self, client, auth_headers, test_tool, admin_user, db_session
    ):
        """event_type filter returns only matching events."""
        history_entry = ToolHistory.create_event(
            tool_id=test_tool.id,
            event_type="repair",
            user_id=admin_user.id,
            description="Repair event for filter test",
        )
        db_session.add(history_entry)
        db_session.commit()

        response = client.get(
            "/api/tool-history?event_type=repair",
            headers=auth_headers,
        )
        assert response.status_code == 200
        for record in response.get_json()["history"]:
            assert record["event_type"] == "repair"

    def test_audit_history_filter_by_tool_id(
        self, client, auth_headers, test_tool, test_warehouse, admin_user, db_session
    ):
        """tool_id filter returns only events for the specified tool."""
        other_tool = Tool(
            tool_number="OTHER001",
            serial_number="OTHER-SN",
            description="Other tool",
            condition="good",
            category="General",
            status="available",
            warehouse_id=test_warehouse.id,
        )
        db_session.add(other_tool)
        db_session.flush()

        for t_id in (test_tool.id, other_tool.id):
            db_session.add(
                ToolHistory.create_event(
                    tool_id=t_id,
                    event_type="status_change",
                    user_id=admin_user.id,
                    description="Filter test",
                )
            )
        db_session.commit()

        response = client.get(
            f"/api/tool-history?tool_id={test_tool.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        for record in response.get_json()["history"]:
            assert record["tool_id"] == test_tool.id

    def test_audit_history_filter_by_date_range(
        self, client, auth_headers, test_tool, admin_user, db_session
    ):
        """start_date and end_date filters restrict returned events."""
        past_event = ToolHistory(
            tool_id=test_tool.id,
            event_type="status_change",
            user_id=admin_user.id,
            description="Old event",
            event_date=datetime.utcnow() - timedelta(days=30),
        )
        recent_event = ToolHistory(
            tool_id=test_tool.id,
            event_type="status_change",
            user_id=admin_user.id,
            description="Recent event",
            event_date=datetime.utcnow() - timedelta(hours=1),
        )
        db_session.add_all([past_event, recent_event])
        db_session.commit()

        start = (datetime.utcnow() - timedelta(days=7)).date().isoformat()
        response = client.get(
            f"/api/tool-history?start_date={start}&tool_id={test_tool.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        ids = {r["id"] for r in response.get_json()["history"]}
        assert recent_event.id in ids
        assert past_event.id not in ids

    def test_audit_history_pagination(
        self, client, auth_headers, test_tool, admin_user, db_session
    ):
        """Pagination params are respected and reflected in the response."""
        for i in range(5):
            db_session.add(
                ToolHistory.create_event(
                    tool_id=test_tool.id,
                    event_type="status_change",
                    user_id=admin_user.id,
                    description=f"Pagination test event {i}",
                )
            )
        db_session.commit()

        response = client.get(
            f"/api/tool-history?tool_id={test_tool.id}&per_page=2&page=1",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["history"]) <= 2
        assert data["per_page"] == 2
        assert data["page"] == 1

    def test_audit_history_invalid_date_returns_400(self, client, auth_headers):
        """Invalid date format returns 400 with an error message."""
        response = client.get(
            "/api/tool-history?start_date=not-a-date",
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "error" in response.get_json()

    def test_history_event_created_on_checkout(
        self, client, auth_headers, test_tool, regular_user, db_session
    ):
        """Performing a checkout creates a ToolHistory event of type 'checkout'."""
        before_count = ToolHistory.query.filter_by(
            tool_id=test_tool.id, event_type="checkout"
        ).count()

        checkout_data = {
            "tool_id": test_tool.id,
            "user_id": regular_user.id,
        }
        response = client.post(
            "/api/tool-checkout",
            json=checkout_data,
            headers=auth_headers,
        )
        if response.status_code != 201:
            return  # Tool might already be checked out

        after_count = ToolHistory.query.filter_by(
            tool_id=test_tool.id, event_type="checkout"
        ).count()
        assert after_count == before_count + 1

    def test_history_event_created_on_checkin(
        self, client, auth_headers, test_tool, regular_user, db_session
    ):
        """Checking in a tool creates a ToolHistory event of type 'return'."""
        # Create a checkout directly
        checkout = Checkout(
            tool_id=test_tool.id,
            user_id=regular_user.id,
        )
        db_session.add(checkout)
        test_tool.status = "checked_out"
        db_session.commit()

        before_count = ToolHistory.query.filter_by(
            tool_id=test_tool.id, event_type="return"
        ).count()

        checkin_data = {
            "location": "Main Shelf",
            "condition_at_return": "good",
        }
        response = client.post(
            f"/api/tool-checkout/{checkout.id}/checkin",
            json=checkin_data,
            headers=auth_headers,
        )
        assert response.status_code == 200

        after_count = ToolHistory.query.filter_by(
            tool_id=test_tool.id, event_type="return"
        ).count()
        assert after_count == before_count + 1
