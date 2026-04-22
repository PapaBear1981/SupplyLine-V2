"""
Unit tests for Transfer API endpoints

Tests the following current endpoints:
- GET /api/transfers       — paginated history (TestGetTransfers)
- GET /api/transfers/<id>  — single transfer detail (TestGetTransferById)

Note: legacy kit-transfer POST/PUT endpoints (TestCreateTransfer,
TestCompleteTransfer, TestCancelTransfer) were removed because the
underlying routes no longer exist.  The two-step warehouse-to-warehouse
workflow is tested in test_multi_warehouse.py.
"""

import json

import pytest

from models import Tool, User, Warehouse
from models_kits import AircraftType, Kit, KitBox, KitExpendable, KitTransfer


@pytest.fixture
def aircraft_type(db_session):
    """Create a test aircraft type"""
    aircraft_type = AircraftType.query.filter_by(name="Q400").first()
    if not aircraft_type:
        aircraft_type = AircraftType(name="Q400", description="Test Aircraft", is_active=True)
        db_session.add(aircraft_type)
        db_session.commit()
    return aircraft_type


@pytest.fixture
def source_warehouse(db_session, admin_user):
    """Create a source warehouse for tool transfers"""
    import uuid

    warehouse = Warehouse(
        name=f"Source Warehouse {uuid.uuid4().hex[:8]}",
        warehouse_type="satellite",
        is_active=True,
        created_by_id=admin_user.id
    )
    db_session.add(warehouse)
    db_session.commit()
    return warehouse


@pytest.fixture
def dest_warehouse(db_session, admin_user):
    """Create a destination warehouse for tool transfers"""
    import uuid

    warehouse = Warehouse(
        name=f"Destination Warehouse {uuid.uuid4().hex[:8]}",
        warehouse_type="satellite",
        is_active=True,
        created_by_id=admin_user.id
    )
    db_session.add(warehouse)
    db_session.commit()
    return warehouse


@pytest.fixture
def warehouse_tool_serial(db_session, source_warehouse):
    """Create a serial-tracked tool in the source warehouse"""
    import uuid

    tool = Tool(
        tool_number=f"SER-{uuid.uuid4().hex[:8]}",
        serial_number=f"SN-{uuid.uuid4().hex[:8]}",
        lot_number=None,
        description="Serial tracked test tool",
        status="available",
        warehouse_id=source_warehouse.id
    )
    db_session.add(tool)
    db_session.commit()
    return tool


@pytest.fixture
def warehouse_tool_lot(db_session, source_warehouse):
    """Create a lot-tracked tool in the source warehouse"""
    import uuid

    tool = Tool(
        tool_number=f"LOT-{uuid.uuid4().hex[:8]}",
        serial_number="",
        lot_number=f"LOT-{uuid.uuid4().hex[:6]}",
        description="Lot tracked test tool",
        status="available",
        warehouse_id=source_warehouse.id
    )
    db_session.add(tool)
    db_session.commit()
    return tool


@pytest.fixture
def warehouse_chemical_lot(db_session, source_warehouse, admin_user):
    """Create a lot-tracked chemical in the source warehouse"""
    import uuid

    from models import Chemical

    chemical = Chemical(
        part_number=f"CHEM-{uuid.uuid4().hex[:8]}",
        lot_number=f"LOT-{uuid.uuid4().hex[:6]}",
        description="Lot tracked test chemical",
        manufacturer="Test Manufacturer",
        quantity=100,
        unit="ml",
        location="Warehouse Storage",
        category="Testing",
        status="available",
        warehouse_id=source_warehouse.id
    )
    db_session.add(chemical)
    db_session.commit()
    return chemical


@pytest.fixture
def source_kit(db_session, admin_user, aircraft_type):
    """Create a source kit for transfers"""
    import uuid
    kit_name = f"Source Kit {uuid.uuid4().hex[:8]}"
    kit = Kit(
        name=kit_name,
        aircraft_type_id=aircraft_type.id,
        description="Source kit for transfers",
        status="active",
        created_by=admin_user.id
    )
    db_session.add(kit)
    db_session.commit()
    return kit


@pytest.fixture
def dest_kit(db_session, admin_user, aircraft_type):
    """Create a destination kit for transfers"""
    import uuid
    kit_name = f"Dest Kit {uuid.uuid4().hex[:8]}"
    kit = Kit(
        name=kit_name,
        aircraft_type_id=aircraft_type.id,
        description="Destination kit for transfers",
        status="active",
        created_by=admin_user.id
    )
    db_session.add(kit)
    db_session.commit()
    return kit


@pytest.fixture
def source_kit_box(db_session, source_kit):
    """Create a box in the source kit"""
    box = KitBox(
        kit_id=source_kit.id,
        box_number="1",
        box_type="expendable",
        description="Expendable items box"
    )
    db_session.add(box)
    db_session.commit()
    return box


@pytest.fixture
def test_expendable(db_session, source_kit, source_kit_box):
    """Create a test expendable in the source kit"""
    import uuid

    expendable = KitExpendable(
        kit_id=source_kit.id,
        box_id=source_kit_box.id,
        part_number="EXP-001",
        lot_number=f"LOT-{uuid.uuid4().hex[:8]}",
        tracking_type="lot",
        description="Safety Wire",
        quantity=100.0,
        unit="ft",
        minimum_stock_level=10.0,
        status="available"
    )
    db_session.add(expendable)
    db_session.commit()
    return expendable


@pytest.fixture
def materials_user(db_session):
    """Create a Materials department user"""
    import uuid
    emp_number = f"MAT{uuid.uuid4().hex[:6]}"

    user = User(
        name="Materials User",
        employee_number=emp_number,
        department="Materials",
        is_admin=False,
        is_active=True
    )
    user.set_password("materials123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers_materials(client, materials_user, jwt_manager):
    """Get auth headers for Materials user"""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(materials_user)
    access_token = tokens["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


class TestGetTransfers:
    """Test listing transfer history (GET /api/transfers).

    The endpoint now returns a paginated dict:
        {"transfers": [...], "total": N, "page": N, "per_page": N, "pages": N}

    It requires transfer.view permission and scopes results to the user's
    active warehouse for non-admins.  Admins see all warehouses.
    """

    # ── helpers ─────────────────────────────────────────────────────────────

    def _initiate_transfer(self, client, headers, src_wh, dst_wh, tool):
        """Helper: initiate a warehouse-to-warehouse transfer via the API."""
        resp = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst_wh.id,
                "item_type": "tool",
                "item_id": tool.id,
                "notes": "test history",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.data
        return json.loads(resp.data)["transfer"]

    # ── tests ────────────────────────────────────────────────────────────────

    def test_history_returns_paginated_dict(
        self, client, admin_user, jwt_manager, db_session
    ):
        """GET /api/transfers returns a paginated dict, not a plain list."""
        import uuid
        from models import Tool, Warehouse

        src = Warehouse(
            name=f"Src {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        dst = Warehouse(
            name=f"Dst {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        db_session.add_all([src, dst])
        db_session.commit()

        tool = Tool(
            tool_number=f"TN-{uuid.uuid4().hex[:6].upper()}",
            serial_number=f"SN-{uuid.uuid4().hex[:6].upper()}",
            description="Paginated dict test tool",
            status="available",
            warehouse_id=src.id,
        )
        db_session.add(tool)
        db_session.commit()

        admin_user.active_warehouse_id = src.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        self._initiate_transfer(client, headers, src, dst, tool)

        resp = client.get("/api/transfers", headers=headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)

        assert isinstance(data, dict)
        assert "transfers" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "pages" in data
        assert isinstance(data["transfers"], list)
        assert data["total"] >= 1

    def test_history_status_filter(
        self, client, admin_user, jwt_manager, db_session
    ):
        """Status query param filters results to the given status value."""
        import uuid
        from models import Tool, Warehouse

        src = Warehouse(
            name=f"Src {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        dst = Warehouse(
            name=f"Dst {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        db_session.add_all([src, dst])
        db_session.commit()

        tool = Tool(
            tool_number=f"TN-{uuid.uuid4().hex[:6].upper()}",
            serial_number=f"SN-{uuid.uuid4().hex[:6].upper()}",
            description="Status filter test tool",
            status="available",
            warehouse_id=src.id,
        )
        db_session.add(tool)
        db_session.commit()

        admin_user.active_warehouse_id = src.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        self._initiate_transfer(client, headers, src, dst, tool)

        resp = client.get(
            "/api/transfers?status=pending_receipt", headers=headers
        )
        assert resp.status_code == 200
        data = json.loads(resp.data)
        for t in data["transfers"]:
            assert t["status"] == "pending_receipt"

    def test_history_unauthenticated(self, client):
        """Unauthenticated requests are rejected with 401."""
        response = client.get("/api/transfers")
        assert response.status_code == 401

    def test_history_requires_transfer_view_permission(
        self, client, regular_user, jwt_manager, db_session
    ):
        """Regular user without transfer.view permission receives 403."""
        import uuid
        from models import Warehouse

        wh = Warehouse(
            name=f"Perm test WH {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        db_session.add(wh)
        db_session.commit()

        regular_user.active_warehouse_id = wh.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(regular_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.get("/api/transfers", headers=headers)
        assert resp.status_code == 403

    def test_history_empty_when_no_active_warehouse(
        self, client, db_session, jwt_manager
    ):
        """Non-admin with no active warehouse receives an empty list, not an error."""
        import uuid
        from models import Permission, User, UserPermission

        user = User(
            name="History No WH",
            employee_number=f"HNW{uuid.uuid4().hex[:6].upper()}",
            department="Test",
            is_admin=False,
            is_active=True,
        )
        user.set_password("pass")
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

        # No active_warehouse_id set
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.get("/api/transfers", headers=headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["transfers"] == []
        assert data["total"] == 0


class TestGetTransferById:
    """Test GET /api/transfers/<id> (single transfer detail).

    The endpoint requires transfer.view permission and returns
    {"transfer": {...}} for valid IDs.  Non-admins are scoped to
    transfers that involve their active warehouse.
    """

    def _create_transfer(self, client, headers, src_wh, dst_wh, tool):
        resp = client.post(
            "/api/transfers/initiate",
            json={
                "to_warehouse_id": dst_wh.id,
                "item_type": "tool",
                "item_id": tool.id,
                "notes": "detail test",
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.data
        return json.loads(resp.data)["transfer"]

    def test_get_transfer_by_id(self, client, admin_user, jwt_manager, db_session):
        """Admin can fetch a specific transfer by its ID."""
        import uuid
        from models import Tool, Warehouse

        src = Warehouse(
            name=f"Src {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        dst = Warehouse(
            name=f"Dst {uuid.uuid4().hex[:6]}",
            warehouse_type="satellite",
            is_active=True,
        )
        db_session.add_all([src, dst])
        db_session.commit()

        tool = Tool(
            tool_number=f"TN-{uuid.uuid4().hex[:6].upper()}",
            serial_number=f"SN-{uuid.uuid4().hex[:6].upper()}",
            description="Detail test tool",
            status="available",
            warehouse_id=src.id,
        )
        db_session.add(tool)
        db_session.commit()

        admin_user.active_warehouse_id = src.id
        db_session.commit()
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        transfer_data = self._create_transfer(client, headers, src, dst, tool)
        transfer_id = transfer_data["id"]

        resp = client.get(f"/api/transfers/{transfer_id}", headers=headers)
        assert resp.status_code == 200
        data = json.loads(resp.data)

        assert "transfer" in data
        assert data["transfer"]["id"] == transfer_id
        assert "status" in data["transfer"]
        assert "item_type" in data["transfer"]

    def test_get_transfer_not_found(self, client, admin_user, jwt_manager):
        """Returns 404 for a non-existent transfer ID."""
        with client.application.app_context():
            tokens = jwt_manager.generate_tokens(admin_user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = client.get("/api/transfers/99999", headers=headers)
        assert resp.status_code == 404

    def test_get_transfer_unauthenticated(self, client):
        """Unauthenticated requests are rejected with 401."""
        resp = client.get("/api/transfers/1")
        assert resp.status_code == 401
