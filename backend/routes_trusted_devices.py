"""Trusted device management routes.

- GET    /api/auth/trusted-devices           list current user's active devices
- DELETE /api/auth/trusted-devices/<int:id>  revoke one device
- DELETE /api/auth/trusted-devices           revoke all devices for the current user
"""

import logging

from flask import jsonify, request

from auth import (
    clear_trusted_device_cookie,
    get_current_prefix_from_request,
    jwt_required,
    revoke_all_for_user,
    revoke_device,
)
from models import AuditLog, TrustedDevice, UserActivity, db, get_current_time


logger = logging.getLogger(__name__)


def register_trusted_devices_routes(app):
    """Register trusted-device management routes."""

    @app.route("/api/auth/trusted-devices", methods=["GET"])
    @jwt_required
    def list_trusted_devices():
        user_id = request.current_user["user_id"]
        current_prefix = get_current_prefix_from_request()
        now = get_current_time()
        devices = (
            TrustedDevice.query
            .filter_by(user_id=user_id, revoked_at=None)
            .filter(TrustedDevice.expires_at > now)
            .order_by(
                TrustedDevice.last_used_at.desc().nullslast(),
                TrustedDevice.created_at.desc(),
            )
            .all()
        )
        return jsonify({
            "devices": [d.to_dict(current_prefix) for d in devices]
        }), 200

    @app.route("/api/auth/trusted-devices/<int:device_id>", methods=["DELETE"])
    @jwt_required
    def revoke_one_trusted_device(device_id):
        user_id = request.current_user["user_id"]
        device = TrustedDevice.query.filter_by(id=device_id, user_id=user_id).first()
        if not device:
            return jsonify({"error": "Device not found", "code": "NOT_FOUND"}), 404

        was_current = (
            get_current_prefix_from_request() == device.token_prefix
        )
        device_label = device.device_label
        revoke_device(device)

        db.session.add(UserActivity(
            user_id=user_id,
            activity_type="trusted_device_revoked",
            description=f"User revoked trusted device {device.id}",
            ip_address=request.remote_addr,
        ))
        AuditLog.log(
            user_id=user_id,
            action="trusted_device_revoked",
            resource_type="trusted_device",
            resource_id=device.id,
            details={"label": device_label},
            ip_address=request.remote_addr,
        )
        db.session.commit()

        response = jsonify({"message": "Device revoked"})
        if was_current:
            clear_trusted_device_cookie(response)
        return response, 200

    @app.route("/api/auth/trusted-devices", methods=["DELETE"])
    @jwt_required
    def revoke_all_trusted_devices():
        user_id = request.current_user["user_id"]
        count = revoke_all_for_user(user_id, "user_requested_all")

        db.session.add(UserActivity(
            user_id=user_id,
            activity_type="trusted_devices_wiped_self",
            description=f"User revoked all trusted devices ({count})",
            ip_address=request.remote_addr,
        ))
        AuditLog.log(
            user_id=user_id,
            action="trusted_devices_wiped_self",
            resource_type="trusted_device",
            details={"count": count},
            ip_address=request.remote_addr,
        )
        db.session.commit()

        response = jsonify({"message": "All devices revoked", "count": count})
        clear_trusted_device_cookie(response)
        return response, 200
