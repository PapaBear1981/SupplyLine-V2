"""
Tests related to session management and cleanup
"""

import os
import sys
import importlib.util

# Same path fix as conftest
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(TESTS_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Use importlib to load app.py as a module instead of app/ package
app_module_path = os.path.join(BACKEND_DIR, 'app.py')
app_spec = importlib.util.spec_from_file_location("app_module", app_module_path)
app_module = importlib.util.module_from_spec(app_spec)
app_spec.loader.exec_module(app_module)
create_app = app_module.create_app
db = app_module.db

from config import Config

# Disable migrations for testing
import migrate_database_constraints
import migrate_performance_indexes
import migrate_reorder_fields
import migrate_tool_calibration

migrate_reorder_fields.migrate_database = lambda: None
migrate_database_constraints.migrate_database = lambda: None
migrate_performance_indexes.migrate_database = lambda: None
migrate_tool_calibration.migrate_database = lambda: None


import pytest


@pytest.fixture
def app():
    application = create_app(Config, test=True)
    with application.app_context():
        db.create_all()
        yield application
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    response = client.post('/api/auth/login', json={
        'employee_number': 'ADMIN001',
        'password': 'admin123'
    })
    token = response.get_json().get('access_token')
    return {'Authorization': f'Bearer {token}'}


def test_no_session_store(client):
    response = client.get('/api/auth/status')
    assert response.status_code == 200


def test_jwt_only_auth(client, auth_headers):
    response = client.get('/api/user-requests')
    assert response.status_code == 401

    response = client.get('/api/user-requests', headers=auth_headers)
    assert response.status_code in [200, 404]
