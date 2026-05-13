"""
Tests for the user-request messaging API endpoints.

Covers the GET/POST `/api/user-requests/<id>/messages` and PUT
`/api/user-requests/messages/<id>/read` routes that the request detail
modal relies on so a requester can read and respond to buyer messages.
"""

import json
import uuid

import pytest

from models import User, UserRequest, UserRequestMessage, db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def buyer_user(db_session):
    """A second non-admin user that will play the buyer role."""
    user = User(
        name="Buyer User",
        employee_number=f"BUY{uuid.uuid4().hex[:12].upper()}",
        department="Materials",
        is_admin=False,
        is_active=True,
    )
    user.set_password("buyer123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers_buyer(client, buyer_user, jwt_manager):
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(buyer_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def outsider_user(db_session):
    """A user with no relationship to the request — used to test access control."""
    user = User(
        name="Outsider User",
        employee_number=f"OUT{uuid.uuid4().hex[:12].upper()}",
        department="Engineering",
        is_admin=False,
        is_active=True,
    )
    user.set_password("outsider123")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def auth_headers_outsider(client, outsider_user, jwt_manager):
    with client.application.app_context():
        tokens = jwt_manager.generate_tokens(outsider_user)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def user_request(db_session, regular_user, buyer_user):
    """Create a user request with `regular_user` as requester and `buyer_user` as buyer."""
    req = UserRequest(
        request_number=f"REQ-{uuid.uuid4().hex[:5].upper()}",
        title="Need replacement bolts",
        description="Running low on AN3 bolts",
        priority="routine",
        status="pending_fulfillment",
        requester_id=regular_user.id,
        buyer_id=buyer_user.id,
    )
    db_session.add(req)
    db_session.commit()
    return req


@pytest.fixture
def buyer_message(db_session, user_request, buyer_user, regular_user):
    """A message sent by the buyer to the requester (the scenario the modal must surface)."""
    msg = UserRequestMessage(
        request_id=user_request.id,
        sender_id=buyer_user.id,
        recipient_id=regular_user.id,
        subject="Sourcing update",
        message="Vendor confirmed shipment for next week.",
        is_read=False,
    )
    db_session.add(msg)
    db_session.commit()
    return msg


# ---------------------------------------------------------------------------
# GET /api/user-requests/<id>/messages
# ---------------------------------------------------------------------------


class TestGetRequestMessages:
    def test_requester_can_read_buyer_message(self, client, auth_headers_user, user_request, buyer_message):
        response = client.get(
            f"/api/user-requests/{user_request.id}/messages",
            headers=auth_headers_user,
        )

        assert response.status_code == 200
        body = json.loads(response.data)
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["id"] == buyer_message.id
        assert body[0]["subject"] == "Sourcing update"
        assert body[0]["sender_id"] == buyer_message.sender_id
        assert body[0]["recipient_id"] == buyer_message.recipient_id
        assert body[0]["is_read"] is False

    def test_buyer_can_read_messages(self, client, auth_headers_buyer, user_request, buyer_message):
        response = client.get(
            f"/api/user-requests/{user_request.id}/messages",
            headers=auth_headers_buyer,
        )
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 1

    def test_outsider_cannot_read_messages(
        self, client, auth_headers_outsider, user_request, buyer_message
    ):
        response = client.get(
            f"/api/user-requests/{user_request.id}/messages",
            headers=auth_headers_outsider,
        )
        assert response.status_code == 403

    def test_requires_authentication(self, client, user_request):
        response = client.get(f"/api/user-requests/{user_request.id}/messages")
        assert response.status_code == 401

    def test_unknown_request_returns_404(self, client, auth_headers_user):
        response = client.get(
            "/api/user-requests/999999/messages",
            headers=auth_headers_user,
        )
        assert response.status_code == 404

    def test_messages_ordered_newest_first(
        self, client, auth_headers_user, db_session, user_request, regular_user, buyer_user
    ):
        from datetime import datetime, timedelta

        older = UserRequestMessage(
            request_id=user_request.id,
            sender_id=buyer_user.id,
            recipient_id=regular_user.id,
            subject="First",
            message="Older",
            sent_date=datetime.utcnow() - timedelta(hours=2),
        )
        newer = UserRequestMessage(
            request_id=user_request.id,
            sender_id=buyer_user.id,
            recipient_id=regular_user.id,
            subject="Second",
            message="Newer",
            sent_date=datetime.utcnow(),
        )
        db_session.add_all([older, newer])
        db_session.commit()

        response = client.get(
            f"/api/user-requests/{user_request.id}/messages",
            headers=auth_headers_user,
        )
        assert response.status_code == 200
        body = json.loads(response.data)
        assert [m["subject"] for m in body[:2]] == ["Second", "First"]


# ---------------------------------------------------------------------------
# POST /api/user-requests/<id>/messages
# ---------------------------------------------------------------------------


class TestSendRequestMessage:
    def test_requester_reply_routes_to_buyer(
        self, client, auth_headers_user, user_request, buyer_user, regular_user
    ):
        """A requester sending a message on a request with an assigned buyer should target the buyer."""
        payload = {"subject": "Re: Sourcing update", "message": "Thanks, please confirm tracking."}

        response = client.post(
            f"/api/user-requests/{user_request.id}/messages",
            json=payload,
            headers=auth_headers_user,
        )

        assert response.status_code == 201
        body = json.loads(response.data)
        assert body["subject"] == "Re: Sourcing update"
        assert body["message"] == "Thanks, please confirm tracking."
        assert body["sender_id"] == regular_user.id
        assert body["recipient_id"] == buyer_user.id
        assert body["is_read"] is False

    def test_buyer_reply_routes_to_requester(
        self, client, auth_headers_buyer, user_request, buyer_user, regular_user
    ):
        payload = {"subject": "Update", "message": "Shipment delayed by 1 day."}
        response = client.post(
            f"/api/user-requests/{user_request.id}/messages",
            json=payload,
            headers=auth_headers_buyer,
        )
        assert response.status_code == 201
        body = json.loads(response.data)
        assert body["sender_id"] == buyer_user.id
        assert body["recipient_id"] == regular_user.id

    def test_missing_subject_rejected(self, client, auth_headers_user, user_request):
        response = client.post(
            f"/api/user-requests/{user_request.id}/messages",
            json={"message": "Body without subject"},
            headers=auth_headers_user,
        )
        assert response.status_code == 400

    def test_missing_body_rejected(self, client, auth_headers_user, user_request):
        response = client.post(
            f"/api/user-requests/{user_request.id}/messages",
            json={"subject": "Subject only"},
            headers=auth_headers_user,
        )
        assert response.status_code == 400

    def test_outsider_cannot_send(self, client, auth_headers_outsider, user_request):
        response = client.post(
            f"/api/user-requests/{user_request.id}/messages",
            json={"subject": "Hi", "message": "Hi"},
            headers=auth_headers_outsider,
        )
        assert response.status_code == 403

    def test_unknown_request_returns_404(self, client, auth_headers_user):
        response = client.post(
            "/api/user-requests/999999/messages",
            json={"subject": "Hi", "message": "Hi"},
            headers=auth_headers_user,
        )
        assert response.status_code == 404

    def test_requires_authentication(self, client, user_request):
        response = client.post(
            f"/api/user-requests/{user_request.id}/messages",
            json={"subject": "Hi", "message": "Hi"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# PUT /api/user-requests/messages/<id>/read
# ---------------------------------------------------------------------------


class TestMarkRequestMessageRead:
    def test_recipient_marks_message_read(
        self, client, auth_headers_user, buyer_message
    ):
        """The requester (recipient of the buyer's message) can mark it as read."""
        response = client.put(
            f"/api/user-requests/messages/{buyer_message.id}/read",
            headers=auth_headers_user,
        )

        assert response.status_code == 200
        body = json.loads(response.data)
        assert body["is_read"] is True
        assert body["read_date"] is not None

        # Persisted
        refreshed = db.session.get(UserRequestMessage, buyer_message.id)
        assert refreshed.is_read is True
        assert refreshed.read_date is not None

    def test_non_recipient_cannot_mark_read(
        self, client, auth_headers_buyer, buyer_message
    ):
        """The buyer (sender) cannot mark their own outgoing message read for the requester."""
        response = client.put(
            f"/api/user-requests/messages/{buyer_message.id}/read",
            headers=auth_headers_buyer,
        )
        assert response.status_code == 403

        refreshed = db.session.get(UserRequestMessage, buyer_message.id)
        assert refreshed.is_read is False

    def test_outsider_cannot_mark_read(
        self, client, auth_headers_outsider, buyer_message
    ):
        response = client.put(
            f"/api/user-requests/messages/{buyer_message.id}/read",
            headers=auth_headers_outsider,
        )
        assert response.status_code == 403

    def test_unknown_message_returns_404(self, client, auth_headers_user):
        response = client.put(
            "/api/user-requests/messages/999999/read",
            headers=auth_headers_user,
        )
        assert response.status_code == 404

    def test_requires_authentication(self, client, buyer_message):
        response = client.put(f"/api/user-requests/messages/{buyer_message.id}/read")
        assert response.status_code == 401
