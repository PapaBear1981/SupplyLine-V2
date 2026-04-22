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


pytestmark = [pytest.mark.integration, pytest.mark.auth]


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


# ─── Transfer history endpoint ────────────────────────────────────────────────


class TestTransferHistory:
    """Tests for GET /api/transfers (transfer history).

    Verifies:
    - Paginated dict response shape
    - Non-admins see only transfers involving their active warehouse
    - Admins see all transfers across every warehouse
    - Permission gate (transfer.view required)
    - Empty response when non-admin has no active warehouse
    """

    def _grant_transfer_view(self, user, db_session):
        from models import Permission, UserPermission
        perm = Permission.query.filter_by(name="transfer.view").first()
        if perm is None:
            perm = Permission(name="transfer.view", description="View transfers")
            db_session.add(perm)
            db_session.flush()
        up = UserPermission.query.filter_by(
            user_id=user.id, permission_id=perm.id
        ).first()
        if up is None:
            db_session.add(
                UserPermission(
                    user_id=user.id,
                    permission_id=perm.id,
                    grant_type="grant",
                    granted_by=user.id,
                )
            )
        db_session.commit()

    def _initiate(self, client, headers, dst_wh_id, item_type, item_id):
        resp = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst_wh_id,
                "item_type": item_type,
                "item_id": item_id,
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.data
        return resp.json["transfer"]

    # -- non-admin warehouse scoping ------------------------------------------

    def test_non_admin_sees_only_own_warehouse_transfers(
        self, client, regular_user, admin_user, jwt_manager, db_session
    ):
        """Non-admin user sees only transfers involving their active warehouse."""
        self._grant_transfer_view(regular_user, db_session)

        wh_a = _warehouse(db_session, "HistA")
        wh_b = _warehouse(db_session, "HistB")
        wh_other = _warehouse(db_session, "HistOther")

        tool_a = _tool_in(db_session, wh_a)
        tool_other = _tool_in(db_session, wh_other)

        # Admin initiates a transfer from wh_a → wh_b (visible to wh_a user)
        admin_hdrs = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_a.id, db_session
        )
        self._initiate(client, admin_hdrs, wh_b.id, "tool", tool_a.id)

        # Admin also initiates a transfer from wh_other → wh_b (NOT visible to wh_a user)
        admin_hdrs_other = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_other.id, db_session
        )
        self._initiate(client, admin_hdrs_other, wh_b.id, "tool", tool_other.id)

        # Non-admin at wh_a queries history
        user_hdrs = _headers_with_warehouse(
            client, jwt_manager, regular_user, wh_a.id, db_session
        )
        resp = client.get("/api/transfers", headers=user_hdrs)
        assert resp.status_code == 200
        data = resp.json

        assert "transfers" in data
        assert "total" in data
        # Should see only the wh_a transfer, not the wh_other one
        assert all(wh_other.id not in (t.get("from_warehouse_id"), t.get("to_warehouse_id"))
                   for t in data["transfers"]), \
            "Non-admin should not see transfers from other warehouses"
        assert data["total"] >= 1

    def test_non_admin_at_destination_sees_inbound_history(
        self, client, regular_user, admin_user, jwt_manager, db_session
    ):
        """Non-admin at destination warehouse sees transfers destined for them."""
        self._grant_transfer_view(regular_user, db_session)

        wh_src = _warehouse(db_session, "HistSrc")
        wh_dst = _warehouse(db_session, "HistDst")
        tool = _tool_in(db_session, wh_src)

        # Admin initiates transfer from src → dst
        admin_hdrs = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_src.id, db_session
        )
        self._initiate(client, admin_hdrs, wh_dst.id, "tool", tool.id)

        # Non-admin at dst should see the inbound transfer in history
        user_hdrs = _headers_with_warehouse(
            client, jwt_manager, regular_user, wh_dst.id, db_session
        )
        resp = client.get("/api/transfers", headers=user_hdrs)
        assert resp.status_code == 200
        data = resp.json
        assert data["total"] >= 1
        dst_ids = {t.get("to_warehouse_id") for t in data["transfers"]}
        assert wh_dst.id in dst_ids

    # -- admin sees all -------------------------------------------------------

    def test_admin_sees_all_warehouses(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Admin user receives transfers from every warehouse."""
        wh_x = _warehouse(db_session, "HistX")
        wh_y = _warehouse(db_session, "HistY")
        wh_z = _warehouse(db_session, "HistZ")

        tool_x = _tool_in(db_session, wh_x)
        tool_z = _tool_in(db_session, wh_z)

        hdrs_x = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_x.id, db_session
        )
        self._initiate(client, hdrs_x, wh_y.id, "tool", tool_x.id)

        hdrs_z = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_z.id, db_session
        )
        self._initiate(client, hdrs_z, wh_y.id, "tool", tool_z.id)

        # Admin with any (or no) active warehouse sees everything
        resp = client.get("/api/transfers", headers=hdrs_z)
        assert resp.status_code == 200
        data = resp.json
        from_wh_ids = {t.get("from_warehouse_id") for t in data["transfers"]}
        assert wh_x.id in from_wh_ids
        assert wh_z.id in from_wh_ids

    # -- response shape -------------------------------------------------------

    def test_response_shape(self, client, admin_user, jwt_manager, db_session):
        """Response is a paginated dict with the expected keys."""
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.get("/api/transfers?page=1&per_page=5", headers=headers)
        assert resp.status_code == 200
        data = resp.json
        assert set(data.keys()) >= {"transfers", "total", "page", "per_page", "pages"}
        assert isinstance(data["transfers"], list)
        assert data["page"] == 1
        assert data["per_page"] == 5

    def test_status_filter(self, client, admin_user, jwt_manager, db_session):
        """status= query param restricts results to that status."""
        wh_s = _warehouse(db_session, "HistStat")
        wh_t = _warehouse(db_session, "HistStatT")
        tool = _tool_in(db_session, wh_s)

        hdrs = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_s.id, db_session
        )
        self._initiate(client, hdrs, wh_t.id, "tool", tool.id)

        resp = client.get(
            "/api/transfers?status=pending_receipt", headers=hdrs
        )
        assert resp.status_code == 200
        for t in resp.json["transfers"]:
            assert t["status"] == "pending_receipt"

    def test_received_transfer_appears_in_history(
        self, client, admin_user, jwt_manager, db_session
    ):
        """After receiving a transfer, it appears in history with status=received."""
        wh_src = _warehouse(db_session, "HistRcvSrc")
        wh_dst = _warehouse(db_session, "HistRcvDst")
        tool = _tool_in(db_session, wh_src)

        hdrs_src = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_src.id, db_session
        )
        transfer = self._initiate(client, hdrs_src, wh_dst.id, "tool", tool.id)

        hdrs_dst = _headers_with_warehouse(
            client, jwt_manager, admin_user, wh_dst.id, db_session
        )
        rcv = client.post(
            f"/api/transfers/{transfer['id']}/receive",
            json={"destination_location": "Rack B1"},
            headers=hdrs_dst,
        )
        assert rcv.status_code == 200

        resp = client.get(
            "/api/transfers?status=received", headers=hdrs_dst
        )
        assert resp.status_code == 200
        ids = [t["id"] for t in resp.json["transfers"]]
        assert transfer["id"] in ids

    # -- permission gate ------------------------------------------------------

    def test_requires_transfer_view_permission(
        self, client, regular_user, jwt_manager, db_session
    ):
        """User without transfer.view gets 403."""
        wh = _warehouse(db_session, "HistPerm")
        regular_user.active_warehouse_id = wh.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(regular_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.get("/api/transfers", headers=headers)
        assert resp.status_code == 403

    def test_unauthenticated_returns_401(self, client):
        """Unauthenticated request returns 401."""
        resp = client.get("/api/transfers")
        assert resp.status_code == 401

    # -- no active warehouse --------------------------------------------------

    def test_no_active_warehouse_returns_empty(
        self, client, db_session, jwt_manager
    ):
        """Non-admin with no active warehouse receives empty list, not an error."""
        import uuid
        from models import Permission, User, UserPermission

        user = User(
            name="Hist No WH User",
            employee_number=f"HNW{uuid.uuid4().hex[:6].upper()}",
            department="Test",
            is_admin=False,
            is_active=True,
        )
        user.set_password("pass123")
        db_session.add(user)
        db_session.flush()

        perm = Permission.query.filter_by(name="transfer.view").first()
        if perm is None:
            perm = Permission(name="transfer.view", description="View transfers")
            db_session.add(perm)
            db_session.flush()
        db_session.add(
            UserPermission(
                user_id=user.id,
                permission_id=perm.id,
                grant_type="grant",
                granted_by=user.id,
            )
        )
        db_session.commit()

        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.get("/api/transfers", headers=headers)
        assert resp.status_code == 200
        data = resp.json
        assert data["transfers"] == []
        assert data["total"] == 0
