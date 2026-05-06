"""
Server-side sorting for GET /api/tools.

Sorting on the inventory page must work across the entire dataset, not just
the visible page. These tests pin the contract: a `sort_by` + `order` pair
gives a deterministic ordering across pages, and unknown sort keys are
rejected outright.
"""

import uuid

import pytest


@pytest.fixture
def sortable_tools(db_session, test_warehouse):
    """Three tools whose fields disagree across columns so we can tell which
    column is actually driving the sort."""
    from models import Tool

    suffix = uuid.uuid4().hex[:6].upper()
    tools = [
        Tool(
            tool_number=f"B-{suffix}",
            serial_number=f"S3-{suffix}",
            description="Charlie",
            condition="good",
            location="Zone-3",
            category="General",
            status="available",
            warehouse_id=test_warehouse.id,
        ),
        Tool(
            tool_number=f"A-{suffix}",
            serial_number=f"S2-{suffix}",
            description="Alpha",
            condition="good",
            location="Zone-1",
            category="Precision",
            status="maintenance",
            warehouse_id=test_warehouse.id,
        ),
        Tool(
            tool_number=f"C-{suffix}",
            serial_number=f"S1-{suffix}",
            description="Bravo",
            condition="good",
            location="Zone-2",
            category="Power Tools",
            status="retired",
            warehouse_id=test_warehouse.id,
        ),
    ]
    for t in tools:
        db_session.add(t)
    db_session.commit()
    return tools


def _tool_numbers(payload, expected_prefix=None):
    """Pull tool_number values out of the response, optionally restricted to
    a prefix so we ignore any tools left over from other fixtures."""
    nums = [t["tool_number"] for t in payload["tools"]]
    if expected_prefix:
        nums = [n for n in nums if n.startswith(expected_prefix)]
    return nums


class TestToolsSorting:
    def test_sort_by_tool_number_asc(self, client, auth_headers, sortable_tools):
        prefix = sortable_tools[0].tool_number.split("-")[1]
        resp = client.get(
            f"/api/tools?sort_by=tool_number&order=asc&per_page=1000&q={prefix}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        nums = _tool_numbers(resp.get_json())
        assert nums == sorted(nums), f"Expected ascending by tool_number, got {nums}"

    def test_sort_by_tool_number_desc(self, client, auth_headers, sortable_tools):
        prefix = sortable_tools[0].tool_number.split("-")[1]
        resp = client.get(
            f"/api/tools?sort_by=tool_number&order=desc&per_page=1000&q={prefix}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        nums = _tool_numbers(resp.get_json())
        assert nums == sorted(nums, reverse=True), (
            f"Expected descending by tool_number, got {nums}"
        )

    def test_sort_by_serial_number(self, client, auth_headers, sortable_tools):
        prefix = sortable_tools[0].tool_number.split("-")[1]
        resp = client.get(
            f"/api/tools?sort_by=serial_number&order=asc&per_page=1000&q={prefix}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        serials = [t["serial_number"] for t in resp.get_json()["tools"]
                   if t["tool_number"].endswith(prefix)]
        assert serials == sorted(serials)

    def test_sort_by_location(self, client, auth_headers, sortable_tools):
        prefix = sortable_tools[0].tool_number.split("-")[1]
        resp = client.get(
            f"/api/tools?sort_by=location&order=asc&per_page=1000&q={prefix}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        locations = [t["location"] for t in resp.get_json()["tools"]
                     if t["tool_number"].endswith(prefix)]
        assert locations == sorted(locations)

    def test_sort_by_status_desc(self, client, auth_headers, sortable_tools):
        prefix = sortable_tools[0].tool_number.split("-")[1]
        resp = client.get(
            f"/api/tools?sort_by=status&order=desc&per_page=1000&q={prefix}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        statuses = [t["status"] for t in resp.get_json()["tools"]
                    if t["tool_number"].endswith(prefix)]
        assert statuses == sorted(statuses, reverse=True)

    def test_sort_persists_across_pages(self, client, auth_headers, sortable_tools):
        """The whole dataset is ordered before pagination, so sort_by ascending
        should give us ordered results when stitching two pages back together."""
        prefix = sortable_tools[0].tool_number.split("-")[1]
        page1 = client.get(
            f"/api/tools?sort_by=tool_number&order=asc&per_page=2&page=1&q={prefix}",
            headers=auth_headers,
        ).get_json()
        page2 = client.get(
            f"/api/tools?sort_by=tool_number&order=asc&per_page=2&page=2&q={prefix}",
            headers=auth_headers,
        ).get_json()

        combined = _tool_numbers(page1) + _tool_numbers(page2)
        # The three sortable_tools should all appear, in ascending order.
        ours = [n for n in combined if n.endswith(prefix)]
        assert len(ours) == 3
        assert ours == sorted(ours)

    def test_sort_by_warehouse_name(self, client, auth_headers, db_session, test_warehouse):
        """warehouse_name lives on a related table — make sure the join works
        and that tools without a warehouse don't get dropped."""
        from models import Tool, Warehouse

        suffix = uuid.uuid4().hex[:6].upper()
        wh_z = Warehouse(name=f"ZZZ-{suffix}", warehouse_type="satellite", is_active=True)
        wh_a = Warehouse(name=f"AAA-{suffix}", warehouse_type="satellite", is_active=True)
        db_session.add_all([wh_z, wh_a])
        db_session.commit()

        t1 = Tool(tool_number=f"WT1-{suffix}", serial_number=f"WS1-{suffix}",
                  description="x", condition="good", warehouse_id=wh_z.id, status="available")
        t2 = Tool(tool_number=f"WT2-{suffix}", serial_number=f"WS2-{suffix}",
                  description="y", condition="good", warehouse_id=wh_a.id, status="available")
        t3 = Tool(tool_number=f"WT3-{suffix}", serial_number=f"WS3-{suffix}",
                  description="z", condition="good", warehouse_id=None, status="available")
        db_session.add_all([t1, t2, t3])
        db_session.commit()

        resp = client.get(
            f"/api/tools?sort_by=warehouse_name&order=asc&per_page=1000&q={suffix}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        tools = resp.get_json()["tools"]
        ours = [t for t in tools if suffix in t["tool_number"]]
        assert len(ours) == 3, "tool with NULL warehouse must still be returned"
        # Compare warehouse_name in order, treating None as a stable bucket.
        names = [t["warehouse_name"] for t in ours]
        non_null = [n for n in names if n is not None]
        assert non_null == sorted(non_null)

    def test_invalid_sort_field_rejected(self, client, auth_headers):
        resp = client.get(
            "/api/tools?sort_by=password_hash",
            headers=auth_headers,
        )
        assert resp.status_code == 400
        assert "sort_by" in resp.get_json()["error"].lower()

    def test_invalid_order_rejected(self, client, auth_headers):
        resp = client.get(
            "/api/tools?sort_by=tool_number&order=sideways",
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_default_order_is_stable_without_sort_by(self, client, auth_headers, sortable_tools):
        """Without sort_by, results should still come back in a deterministic
        order (sorted by id). Calling twice should give the same sequence."""
        prefix = sortable_tools[0].tool_number.split("-")[1]
        resp1 = client.get(
            f"/api/tools?per_page=1000&q={prefix}", headers=auth_headers
        ).get_json()
        resp2 = client.get(
            f"/api/tools?per_page=1000&q={prefix}", headers=auth_headers
        ).get_json()
        assert _tool_numbers(resp1) == _tool_numbers(resp2)
