"""
Tests for optimistic locking (concurrent update collision handling)

These tests verify that the version-based optimistic locking system correctly
detects and handles concurrent update conflicts.

Test scenarios:
1. Version is included in API responses
2. Updates with correct version succeed and increment version
3. Updates with stale version return 409 Conflict
4. Updates without version (backwards compatibility) succeed
5. Conflict response includes current data for client refresh
"""

import pytest
from flask import json


@pytest.mark.unit
class TestOptimisticLockingChemicals:
    """Test optimistic locking for Chemical updates"""

    def test_chemical_includes_version_in_response(self, client, admin_auth_header, test_chemical):
        """Test that chemical API response includes version field"""
        response = client.get(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "version" in data, "Response should include version field"
        assert isinstance(data["version"], int), "Version should be an integer"
        assert data["version"] >= 1, "Version should be at least 1"

    def test_chemical_update_with_correct_version_succeeds(
        self, client, admin_auth_header, test_chemical, db_session
    ):
        """Test that update with correct version succeeds and increments version"""
        # Get current version
        initial_version = test_chemical.version

        # Update with correct version
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Updated description",
                "version": initial_version,
            }
        )

        assert response.status_code == 200, f"Update should succeed: {response.data}"
        data = json.loads(response.data)

        # Verify version was incremented
        assert data["version"] == initial_version + 1, "Version should be incremented"
        assert data["description"] == "Updated description"

    def test_chemical_update_with_stale_version_returns_409(
        self, client, admin_auth_header, test_chemical, db_session
    ):
        """Test that update with stale version returns 409 Conflict"""
        # Simulate a stale version (current version is test_chemical.version)
        stale_version = test_chemical.version - 1

        # Attempt update with stale version
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "This update should fail",
                "version": stale_version,
            }
        )

        assert response.status_code == 409, "Should return 409 Conflict for stale version"
        data = json.loads(response.data)

        # Verify error response structure
        assert "error" in data
        assert data.get("error_code") == "version_conflict"
        assert "conflict_details" in data
        assert data["conflict_details"]["current_version"] == test_chemical.version
        assert data["conflict_details"]["provided_version"] == stale_version

    def test_chemical_update_without_version_succeeds(
        self, client, admin_auth_header, test_chemical
    ):
        """Test that update without version succeeds (backwards compatibility)"""
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Update without version",
                # No version provided
            }
        )

        assert response.status_code == 200, "Update without version should succeed for backwards compatibility"

    def test_conflict_response_includes_current_data(
        self, client, admin_auth_header, test_chemical, db_session
    ):
        """Test that conflict response includes current resource data"""
        # First, do a successful update to increment version
        client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "First update",
                "version": test_chemical.version,
            }
        )

        # Now try with old version
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Conflicting update",
                "version": test_chemical.version,  # Now stale
            }
        )

        assert response.status_code == 409
        data = json.loads(response.data)

        # Verify current_data is included for client refresh
        assert "current_data" in data, "Conflict response should include current_data"
        assert data["current_data"]["description"] == "First update"

    def test_invalid_version_format_returns_400(
        self, client, admin_auth_header, test_chemical
    ):
        """Test that invalid version format returns 400 Bad Request"""
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Update with bad version",
                "version": "not-a-number",
            }
        )

        assert response.status_code == 400, "Invalid version format should return 400"


@pytest.mark.unit
class TestOptimisticLockingTools:
    """Test optimistic locking for Tool updates"""

    def test_tool_includes_version_in_response(self, client, admin_auth_header, test_tool):
        """Test that tool API response includes version field"""
        response = client.get(
            f"/api/tools/{test_tool.id}",
            headers=admin_auth_header
        )
        # Note: The tool detail endpoint returns custom dict, check if version is added
        assert response.status_code == 200

    def test_tool_update_with_correct_version_succeeds(
        self, client, admin_auth_header, test_tool, db_session
    ):
        """Test that tool update with correct version succeeds"""
        initial_version = test_tool.version

        response = client.put(
            f"/api/tools/{test_tool.id}",
            headers=admin_auth_header,
            json={
                "description": "Updated tool description",
                "version": initial_version,
            }
        )

        assert response.status_code == 200

    def test_tool_update_with_stale_version_returns_409(
        self, client, admin_auth_header, test_tool
    ):
        """Test that tool update with stale version returns 409"""
        stale_version = test_tool.version - 1

        response = client.put(
            f"/api/tools/{test_tool.id}",
            headers=admin_auth_header,
            json={
                "description": "This should fail",
                "version": stale_version,
            }
        )

        assert response.status_code == 409


@pytest.mark.unit
class TestOptimisticLockingKits:
    """Test optimistic locking for Kit updates"""

    def test_kit_includes_version_in_response(self, client, admin_auth_header, test_kit):
        """Test that kit API response includes version field"""
        response = client.get(
            f"/api/kits/{test_kit.id}",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "version" in data

    def test_kit_update_with_correct_version_succeeds(
        self, client, admin_auth_header, test_kit, db_session
    ):
        """Test that kit update with correct version succeeds"""
        initial_version = test_kit.version

        response = client.put(
            f"/api/kits/{test_kit.id}",
            headers=admin_auth_header,
            json={
                "description": "Updated kit description",
                "version": initial_version,
            }
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["version"] == initial_version + 1

    def test_kit_update_with_stale_version_returns_409(
        self, client, admin_auth_header, test_kit
    ):
        """Test that kit update with stale version returns 409"""
        stale_version = test_kit.version - 1

        response = client.put(
            f"/api/kits/{test_kit.id}",
            headers=admin_auth_header,
            json={
                "description": "This should fail",
                "version": stale_version,
            }
        )

        assert response.status_code == 409


@pytest.mark.unit
class TestConflictErrorResponse:
    """Test the structure and content of conflict error responses"""

    def test_conflict_error_has_required_fields(
        self, client, admin_auth_header, test_chemical
    ):
        """Test that conflict error response has all required fields"""
        # Force a conflict
        stale_version = test_chemical.version - 1

        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Conflict test",
                "version": stale_version,
            }
        )

        assert response.status_code == 409
        data = json.loads(response.data)

        # Required fields
        assert "error" in data
        assert "error_code" in data
        assert data["error_code"] == "version_conflict"
        assert "conflict_details" in data

        # Conflict details
        conflict_details = data["conflict_details"]
        assert "current_version" in conflict_details
        assert "provided_version" in conflict_details

    def test_conflict_error_includes_hint(
        self, client, admin_auth_header, test_chemical
    ):
        """Test that conflict error includes a hint for resolution"""
        stale_version = test_chemical.version - 1

        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Conflict test",
                "version": stale_version,
            }
        )

        assert response.status_code == 409
        data = json.loads(response.data)
        assert "hint" in data, "Conflict response should include hint for resolution"


@pytest.mark.integration
class TestConcurrentUpdateScenario:
    """Integration tests simulating real concurrent update scenarios"""

    def test_concurrent_update_simulation(
        self, client, admin_auth_header, test_chemical, db_session
    ):
        """
        Simulate the scenario where two users load the same resource,
        then both try to update it.

        User A loads chemical (version 1)
        User B loads chemical (version 1)
        User A updates chemical -> succeeds (version becomes 2)
        User B updates chemical -> fails with 409 (has stale version 1)
        """
        # Initial state
        initial_version = test_chemical.version

        # User A fetches chemical (version 1)
        user_a_version = initial_version

        # User B fetches chemical (version 1)
        user_b_version = initial_version

        # User A updates chemical successfully
        response_a = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "User A update",
                "version": user_a_version,
            }
        )
        assert response_a.status_code == 200, "User A update should succeed"

        # User B tries to update with stale version
        response_b = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "User B update",
                "version": user_b_version,  # Stale!
            }
        )
        assert response_b.status_code == 409, "User B update should fail with conflict"

        # User B can refresh and see current data
        conflict_data = json.loads(response_b.data)
        assert conflict_data["conflict_details"]["current_version"] == initial_version + 1
        assert conflict_data["current_data"]["description"] == "User A update"

    def test_sequential_updates_work_correctly(
        self, client, admin_auth_header, test_chemical, db_session
    ):
        """
        Test that sequential updates work when each update uses the correct version.
        """
        # Get initial version
        response = client.get(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header
        )
        data = json.loads(response.data)
        current_version = data["version"]

        # First update
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "First update",
                "version": current_version,
            }
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        current_version = data["version"]

        # Second update
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Second update",
                "version": current_version,
            }
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        current_version = data["version"]

        # Third update
        response = client.put(
            f"/api/chemicals/{test_chemical.id}",
            headers=admin_auth_header,
            json={
                "description": "Third update",
                "version": current_version,
            }
        )
        assert response.status_code == 200
        data = json.loads(response.data)

        # Version should have incremented 3 times
        assert data["description"] == "Third update"
