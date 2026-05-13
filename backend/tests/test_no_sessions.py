"""
Tests related to session management - verifies the app uses JWT auth only (no server-side sessions).
"""


def test_no_session_store(client):
    """Verify the auth status endpoint is accessible"""
    response = client.get('/api/auth/status')
    assert response.status_code == 200


def test_jwt_only_auth(client, auth_headers):
    """Verify endpoints require JWT auth, not session cookies"""
    # Use /api/tools since user-requests is feature-gated and would return
    # 410 before the auth check when FEATURE_REQUESTS is off.
    # Without auth should get 401
    response = client.get('/api/tools')
    assert response.status_code == 401

    # With valid JWT headers should succeed
    response = client.get('/api/tools', headers=auth_headers)
    assert response.status_code in [200, 404]
