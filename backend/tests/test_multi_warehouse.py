"""
Tests for multi-warehouse scoping + two-step transfer workflow.

Covers:
- Setting / getting the user's active warehouse (token re-issued on change).
- Warehouse-scope enforcement on tool checkout + chemical issue.
- Transfer initiate → inbound appears → receive assigns warehouse + location.
- Tool must not be checked-out when initiating a transfer.
- Cancel by initiator vs non-initiator.
- Audit log + ToolHistory rows written for transfer events.
"""

import json
import uuid

import pytest


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _warehouse(db_session, name, warehouse_type="satellite"):
    from models import Warehouse
    wh = Warehouse(
        name=f"{name} {uuid.uuid4().hex[:6]}",
        warehouse_type=warehouse_type,
        is_active=True,
    )
    db_session.add(wh)
    db_session.commit()
    return wh


def _tool_in(db_session, warehouse):
    from models import Tool
    tool = Tool(
        tool_number=f"TN-{uuid.uuid4().hex[:6].upper()}",
        serial_number=f"SN-{uuid.uuid4().hex[:6].upper()}",
        description="Pytest tool",
        condition="good",
        category="General",
        status="available",
        location="Bin A1",
        warehouse_id=warehouse.id,
    )
    db_session.add(tool)
    db_session.commit()
    return tool


def _chemical_in(db_session, warehouse, quantity=100):
    from models import Chemical
    chem = Chemical(
        part_number=f"P-{uuid.uuid4().hex[:6].upper()}",
        lot_number=f"L-{uuid.uuid4().hex[:6].upper()}",
        description="Pytest chemical",
        quantity=quantity,
        unit="each",
        status="available",
        warehouse_id=warehouse.id,
        location="Shelf 1",
    )
    db_session.add(chem)
    db_session.commit()
    return chem


def _headers_with_warehouse(client, jwt_manager, user, warehouse_id, db_session):
    """Set the user's active_warehouse_id then return auth headers bearing a fresh JWT."""
    user.active_warehouse_id = warehouse_id
    db_session.commit()
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# ─── Active warehouse selection ───────────────────────────────────────────────


class TestActiveWarehouse:
    def test_set_and_get_active_warehouse(
        self, client, admin_user, jwt_manager, db_session
    ):
        wh = _warehouse(db_session, "Spokane")
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.post(
            "/api/me/active-warehouse",
            json={"warehouse_id": wh.id},
            headers=headers,
        )
        assert resp.status_code == 200, resp.data
        data = json.loads(resp.data)
        assert data["active_warehouse_id"] == wh.id
        assert data["active_warehouse"]["name"] == wh.name
        # New JWT issued so the client can use it immediately
        assert "access_token" in data["tokens"]

        get_resp = client.get("/api/me/active-warehouse", headers=headers)
        assert get_resp.status_code == 200
        assert json.loads(get_resp.data)["active_warehouse_id"] == wh.id

    def test_set_active_rejects_inactive_warehouse(
        self, client, admin_user, jwt_manager, db_session
    ):
        from models import Warehouse
        wh = _warehouse(db_session, "Closed")
        wh.is_active = False
        db_session.commit()

        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.post(
            "/api/me/active-warehouse",
            json={"warehouse_id": wh.id},
            headers=headers,
        )
        assert resp.status_code == 404

    def test_jwt_includes_active_warehouse(
        self, client, admin_user, jwt_manager, db_session
    ):
        """The access token must carry the active_warehouse_id claim."""
        wh = _warehouse(db_session, "Seattle")
        admin_user.active_warehouse_id = wh.id
        db_session.commit()

        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
            payload = jwt_manager.verify_token(tokens["access_token"])

        assert payload is not None
        assert payload.get("active_warehouse_id") == wh.id


# ─── Warehouse-scope enforcement on write operations ──────────────────────────


class TestWarehouseScopeEnforcement:
    def test_admin_bypasses_warehouse_scope(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Admins should be able to check tools out across warehouses."""
        wh_a = _warehouse(db_session, "A")
        wh_b = _warehouse(db_session, "B")
        tool = _tool_in(db_session, wh_b)

        headers = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_a.id, db_session
        )
        resp = client.post(
            "/api/tool-checkout",
            json={"tool_id": tool.id, "user_id": admin_user.id},
            headers=headers,
        )
        assert resp.status_code == 201, resp.data

    def test_non_admin_blocked_on_foreign_warehouse(
        self, client, regular_user, jwt_manager, db_session
    ):
        from models import Permission, UserPermission
        wh_a = _warehouse(db_session, "A")
        wh_b = _warehouse(db_session, "B")
        tool = _tool_in(db_session, wh_b)

        # Grant the non-admin the checkout permission so we isolate the scope block
        perm = Permission.query.filter_by(name="checkout.create").first() or Permission(
            name="checkout.create", description="Create checkouts"
        )
        db_session.add(perm)
        db_session.flush()
        db_session.add(
            UserPermission(
                user_id=regular_user.id,
                permission_id=perm.id,
                grant_type="grant",
                granted_by=regular_user.id,
            )
        )
        db_session.commit()

        headers = _headers_with_warehouse(
            client, jwt_manager, regular_user, wh_a.id, db_session
        )
        resp = client.post(
            "/api/tool-checkout",
            json={"tool_id": tool.id, "user_id": regular_user.id},
            headers=headers,
        )
        assert resp.status_code == 409
        body = json.loads(resp.data)
        assert body["code"] == "WAREHOUSE_SCOPE"


# ─── Two-step transfer workflow ───────────────────────────────────────────────


class TestTransferWorkflow:
    def test_initiate_then_receive_transfers_tool(
        self, client, admin_user, jwt_manager, db_session
    ):
        from models import AuditLog, ToolHistory, Tool
        src = _warehouse(db_session, "Src")
        dst = _warehouse(db_session, "Dst")
        tool = _tool_in(db_session, src)

        initiator = _headers_with_warehouse(
            client, jwt_manager, admin_user, src.id, db_session
        )
        init_resp = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst.id,
                "item_type": "tool",
                "item_id": tool.id,
                "notes": "Truck run Tuesday",
            },
            headers=initiator,
        )
        assert init_resp.status_code == 201, init_resp.data
        transfer = json.loads(init_resp.data)["transfer"]
        assert transfer["status"] == "pending_receipt"
        assert transfer["source_location"] == "Bin A1"

        # Item stays in source warehouse until received
        db_session.expire_all()
        assert db_session.get(Tool, tool.id).warehouse_id == src.id

        # Inbound list (at destination)
        receiver = _headers_with_warehouse(
            client, jwt_manager, admin_user, dst.id, db_session
        )
        inbound = client.get("/api/transfers/inbound", headers=receiver)
        assert inbound.status_code == 200
        assert inbound.json["total"] == 1

        # Receive with location
        rcv = client.post(
            f"/api/transfers/{transfer['id']}/receive",
            json={"destination_location": "Shelf 2A"},
            headers=receiver,
        )
        assert rcv.status_code == 200, rcv.data
        received = rcv.json["transfer"]
        assert received["status"] == "received"
        assert received["destination_location"] == "Shelf 2A"

        db_session.expire_all()
        tool_row = db_session.get(Tool, tool.id)
        assert tool_row.warehouse_id == dst.id
        assert tool_row.location == "Shelf 2A"

        # Audit + ToolHistory entries
        audits = AuditLog.query.filter(
            AuditLog.action.in_(["transfer_initiated", "transfer_received"])
        ).all()
        assert {a.action for a in audits} >= {"transfer_initiated", "transfer_received"}

        history = ToolHistory.query.filter(
            ToolHistory.tool_id == tool.id,
            ToolHistory.event_type.in_(["transferred_out", "transferred_in"]),
        ).all()
        assert {h.event_type for h in history} == {"transferred_out", "transferred_in"}

    def test_initiate_blocked_on_checked_out_tool(
        self, client, admin_user, jwt_manager, db_session
    ):
        src = _warehouse(db_session, "Src")
        dst = _warehouse(db_session, "Dst")
        tool = _tool_in(db_session, src)
        tool.status = "checked_out"
        db_session.commit()

        headers = _headers_with_warehouse(
            client, jwt_manager, admin_user, src.id, db_session
        )
        resp = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst.id,
                "item_type": "tool",
                "item_id": tool.id,
            },
            headers=headers,
        )
        assert resp.status_code == 409

    def test_receive_requires_destination_location(
        self, client, admin_user, jwt_manager, db_session
    ):
        src = _warehouse(db_session, "Src")
        dst = _warehouse(db_session, "Dst")
        tool = _tool_in(db_session, src)

        initiator = _headers_with_warehouse(
            client, jwt_manager, admin_user, src.id, db_session
        )
        init = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst.id,
                "item_type": "tool",
                "item_id": tool.id,
            },
            headers=initiator,
        )
        transfer_id = init.json["transfer"]["id"]

        receiver = _headers_with_warehouse(
            client, jwt_manager, admin_user, dst.id, db_session
        )
        resp = client.post(
            f"/api/transfers/{transfer_id}/receive",
            json={},
            headers=receiver,
        )
        assert resp.status_code == 422

    def test_cancel_by_initiator_then_items_unchanged(
        self, client, admin_user, jwt_manager, db_session
    ):
        from models import Tool
        src = _warehouse(db_session, "Src")
        dst = _warehouse(db_session, "Dst")
        tool = _tool_in(db_session, src)

        headers = _headers_with_warehouse(
            client, jwt_manager, admin_user, src.id, db_session
        )
        init = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst.id,
                "item_type": "tool",
                "item_id": tool.id,
            },
            headers=headers,
        )
        tid = init.json["transfer"]["id"]

        cancel = client.post(
            f"/api/transfers/{tid}/cancel",
            json={"cancel_reason": "Wrong destination"},
            headers=headers,
        )
        assert cancel.status_code == 200, cancel.data
        assert cancel.json["transfer"]["status"] == "cancelled"
        db_session.expire_all()
        assert db_session.get(Tool, tool.id).warehouse_id == src.id

    def test_partial_chemical_transfer_splits_lot_on_receive(
        self, client, admin_user, jwt_manager, db_session
    ):
        from models import Chemical
        src = _warehouse(db_session, "Src")
        dst = _warehouse(db_session, "Dst")
        chem = _chemical_in(db_session, src, quantity=50)

        initiator = _headers_with_warehouse(
            client, jwt_manager, admin_user, src.id, db_session
        )
        init = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst.id,
                "item_type": "chemical",
                "item_id": chem.id,
                "quantity": 10,
            },
            headers=initiator,
        )
        tid = init.json["transfer"]["id"]

        receiver = _headers_with_warehouse(
            client, jwt_manager, admin_user, dst.id, db_session
        )
        resp = client.post(
            f"/api/transfers/{tid}/receive",
            json={"destination_location": "Cabinet 3"},
            headers=receiver,
        )
        assert resp.status_code == 200, resp.data

        db_session.expire_all()
        parent = db_session.get(Chemical, chem.id)
        children = Chemical.query.filter_by(parent_lot_number=parent.lot_number).all()
        # Parent stayed, remaining stock decreased, a child lot was created
        # at the destination warehouse.
        assert parent.quantity == 40
        assert parent.warehouse_id == src.id
        assert len(children) == 1
        child = children[0]
        assert child.warehouse_id == dst.id
        assert child.quantity == 10
        assert child.location == "Cabinet 3"
