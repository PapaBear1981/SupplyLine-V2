"""
Test configuration and fixtures for SupplyLine MRO Suite tests
"""

import os
import sys

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

    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db_session(app):
    with app.app_context():
        yield db.session


def assert_status(response, expected_status, message=''):
    assert response.status_code == expected_status, f'{message}'


def assert_json(response, key, expected_value, message=''):
    json_data = response.get_json()
    actual_value = json_data.get(key) if json_data else None
    assert actual_value == expected_value, f'{message}'
