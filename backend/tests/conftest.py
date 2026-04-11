"""
Test configuration and fixtures for SupplyLine MRO Suite tests
"""

import os
import sys
import uuid

# FIRST: Fix path - import app.py before app/ package
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Use importlib to load app.py as a module (not the app/ package)
import importlib.util
app_module_path = os.path.join(BACKEND_DIR, 'app.py')
app_spec = importlib.util.spec_from_file_location("app", app_module_path)
app_test_module = importlib.util.module_from_spec(app_spec)

# Register it in sys.modules BEFORE executing - this makes it available for "from app import"
sys.modules['app'] = app_test_module

# NOW execute it to populate the module
app_spec.loader.exec_module(app_test_module)

# Now normal imports should work
from app import create_app, db
from config import Config

import pytest
from sqlalchemy import text


@pytest.fixture(scope='session')
def app():
    application = create_app()
    application.config['TESTING'] = True
    # Ensure cryptographic keys are set in testing mode.
    # Config.validate_production_config() returns early for FLASK_ENV=testing,
    # leaving SECRET_KEY and JWT_SECRET_KEY as None (from os.environ.get).
    # jwt.encode() raises "Expected a string value" when the key is None.
    if not application.config.get('SECRET_KEY'):
        application.config['SECRET_KEY'] = 'test-secret-key-do-not-use-in-production'
    if not application.config.get('JWT_SECRET_KEY'):
        application.config['JWT_SECRET_KEY'] = 'test-jwt-secret-key-do-not-use-in-production'
    # Disable secure cookies so the test client (HTTP, not HTTPS) can send them back.
    application.config['SESSION_COOKIE_SECURE'] = False

    with application.app_context():
        db.create_all()
        # Seed ADMIN001 for authentication tests that use hardcoded credentials.
        # The admin user is not auto-created in testing mode (create_app skips it),
        # so we seed it here to satisfy tests that call /api/auth/login directly.
        from models import User
        if not User.query.filter_by(employee_number='ADMIN001').first():
            seed_admin = User(
                name='Administrator',
                employee_number='ADMIN001',
                department='Administration',
                is_admin=True,
                is_active=True,
            )
            seed_admin.set_password('admin123')
            db.session.add(seed_admin)
            db.session.commit()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    # werkzeug 3.x requires the test client used as a context manager
    # for cookies to be preserved between requests within a single test.
    # We manually call __enter__/__exit__ so we can suppress the ContextVar
    # ValueError that occurs in teardown when concurrent tests (spawning
    # threads that each push a Flask request context) share the same client.
    c = app.test_client()
    c.__enter__()
    try:
        yield c
    finally:
        try:
            c.__exit__(None, None, None)
        except ValueError:
            # Suppress "ContextVar token was created in a different Context"
            # which happens when multi-threaded tests share the test client.
            pass


@pytest.fixture
def db_session(app):
    with app.app_context():
        yield db.session


# ─── Shared test fixtures ────────────────────────────────────────────────────


@pytest.fixture
def jwt_manager():
    """Return the JWTManager class for token generation."""
    from auth.jwt_manager import JWTManager
    return JWTManager


@pytest.fixture
def admin_user(db_session):
    """Create an admin user with a unique employee number."""
    from models import User
    emp_num = f"ADM{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Admin User",
        employee_number=emp_num,
        department="Administration",
        is_admin=True,
        is_active=True,
    )
    user.set_password("admin123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def regular_user(db_session):
    """Create a regular (non-admin) user with a unique employee number."""
    from models import User
    emp_num = f"USR{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Regular User",
        employee_number=emp_num,
        department="Engineering",
        is_admin=False,
        is_active=True,
    )
    user.set_password("user123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def materials_user(db_session):
    """Create a Materials department user with a unique employee number."""
    from models import User
    emp_num = f"MAT{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Materials User",
        employee_number=emp_num,
        department="Materials",
        is_admin=False,
        is_active=True,
    )
    user.set_password("materials123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers_user(client, regular_user, jwt_manager):
    """JWT auth headers for a regular user."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(regular_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def auth_headers_admin(client, admin_user, jwt_manager):
    """JWT auth headers for an admin user."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(admin_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def auth_headers_materials(client, materials_user, jwt_manager):
    """JWT auth headers for a materials manager user."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(materials_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def auth_headers(client, admin_user, jwt_manager):
    """JWT auth headers (admin) — used by tests that need elevated access."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(admin_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def auth_headers_return_manager(client, admin_user, jwt_manager):
    """JWT auth headers for a user with tool.return permission (admin satisfies this)."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(admin_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def user_auth_headers(client, regular_user, jwt_manager):
    """JWT auth headers for regular_user — alias used by order/security workflow tests."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(regular_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def requests_user(db_session, admin_user):
    """Non-admin user with page.requests permission only (not page.orders)."""
    from models import Permission, User, UserPermission
    emp_num = f"REQ{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Requests User",
        employee_number=emp_num,
        department="Engineering",
        is_admin=False,
        is_active=True,
    )
    user.set_password("requests123")
    db_session.add(user)
    db_session.flush()

    # Get or create the page.requests permission
    perm = Permission.query.filter_by(name="page.requests").first()
    if not perm:
        perm = Permission(name="page.requests", description="Can submit procurement requests")
        db_session.add(perm)
        db_session.flush()

    user_perm = UserPermission(
        user_id=user.id,
        permission_id=perm.id,
        grant_type="grant",
        granted_by=admin_user.id,
    )
    db_session.add(user_perm)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers_requests_user(client, requests_user, jwt_manager):
    """JWT auth headers for a user with page.requests permission only."""
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(requests_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def test_warehouse(db_session):
    """Create a test warehouse with a unique name."""
    from models import Warehouse
    name = f"Test Warehouse {uuid.uuid4().hex[:8]}"
    warehouse = Warehouse(
        name=name,
        warehouse_type="satellite",
        is_active=True,
    )
    db_session.add(warehouse)
    db_session.commit()
    return warehouse


@pytest.fixture
def test_tool(db_session, test_warehouse):
    """Create a test tool in the test warehouse."""
    from models import Tool
    tool = Tool(
        tool_number="T001",
        serial_number=f"S{uuid.uuid4().hex[:8].upper()}",
        description="Test Tool",
        condition="good",
        category="General",
        status="available",
        warehouse_id=test_warehouse.id,
    )
    db_session.add(tool)
    db_session.commit()
    return tool


@pytest.fixture
def test_chemical(db_session, test_warehouse):
    """Create a test chemical in the test warehouse."""
    from models import Chemical
    chemical = Chemical(
        part_number=f"CHEM{uuid.uuid4().hex[:6].upper()}",
        lot_number=f"LOT{uuid.uuid4().hex[:6].upper()}",
        description="Test Chemical",
        quantity=100,
        unit="each",
        status="available",
        warehouse_id=test_warehouse.id,
    )
    db_session.add(chemical)
    db_session.commit()
    return chemical


@pytest.fixture
def sample_chemical(db_session, test_warehouse):
    """Create a chemical with ample stock for issuance/return workflow tests."""
    from models import Chemical
    chemical = Chemical(
        part_number=f"SAMP{uuid.uuid4().hex[:6].upper()}",
        lot_number=f"SL{uuid.uuid4().hex[:6].upper()}",
        description="Sample Chemical for testing",
        quantity=100,
        unit="oz",
        status="available",
        warehouse_id=test_warehouse.id,
    )
    db_session.add(chemical)
    db_session.commit()
    return chemical


@pytest.fixture
def test_user(db_session):
    """Alias for regular_user — used by tests that reference the fixture as 'test_user'."""
    from models import User
    emp_num = f"TST{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Test User",
        employee_number=emp_num,
        department="Engineering",
        is_admin=False,
        is_active=True,
    )
    user.set_password("user123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_user_2(db_session):
    """A second regular user for tests that need two distinct non-admin accounts."""
    from models import User
    emp_num = f"TS2{uuid.uuid4().hex[:6].upper()}"
    user = User(
        name="Test User 2",
        employee_number=emp_num,
        department="Engineering",
        is_admin=False,
        is_active=True,
    )
    user.set_password("user123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def test_channel(db_session, admin_user):
    """Create a test messaging channel owned by admin_user."""
    from models_messaging import Channel
    name = f"Test Channel {uuid.uuid4().hex[:8]}"
    channel = Channel(
        name=name,
        description="A test channel",
        channel_type="department",
        department="Engineering",
        is_active=True,
        created_by=admin_user.id,
    )
    db_session.add(channel)
    db_session.commit()
    return channel


@pytest.fixture
def sample_tool(db_session, test_warehouse):
    """Alias for test_tool — used by calibration workflow tests."""
    from models import Tool
    tool = Tool(
        tool_number=f"CAL{uuid.uuid4().hex[:6].upper()}",
        serial_number=f"S{uuid.uuid4().hex[:8].upper()}",
        description="Sample Tool for Calibration",
        condition="good",
        category="Calibration",
        status="available",
        warehouse_id=test_warehouse.id,
    )
    db_session.add(tool)
    db_session.commit()
    return tool


# ─── Helpers ─────────────────────────────────────────────────────────────────


@pytest.fixture
def aircraft_type(db_session):
    """Create a test aircraft type (get-or-create Q400)."""
    from models_kits import AircraftType
    aircraft_type = AircraftType.query.filter_by(name="Q400").first()
    if not aircraft_type:
        aircraft_type = AircraftType(name="Q400", description="Test Aircraft", is_active=True)
        db_session.add(aircraft_type)
        db_session.commit()
    return aircraft_type


@pytest.fixture
def test_kit(db_session, admin_user, aircraft_type):
    """Create a test kit with a unique name."""
    from models_kits import Kit
    kit_name = f"TEST-KIT-{uuid.uuid4().hex[:8].upper()}"
    kit = Kit(
        name=kit_name,
        aircraft_type_id=aircraft_type.id,
        description="Test kit",
        status="active",
        created_by=admin_user.id,
    )
    db_session.add(kit)
    db_session.commit()
    return kit


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the in-memory rate limiter before every test.

    This prevents rate-limit counts from leaking between tests while still
    allowing individual tests to exercise rate-limiting behaviour within their
    own execution (e.g. making N requests within one test and expecting a 429
    on the Nth request).
    """
    from utils.rate_limiter import get_rate_limiter
    get_rate_limiter().reset_all()


def assert_status(response, expected_status, message=''):
    assert response.status_code == expected_status, f'{message}'


def assert_json(response, key, expected_value, message=''):
    json_data = response.get_json()
    actual_value = json_data.get(key) if json_data else None
    assert actual_value == expected_value, f'{message}'
