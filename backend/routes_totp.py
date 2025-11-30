"""
TOTP Two-Factor Authentication Routes for SupplyLine MRO Suite

This module provides TOTP-based 2FA endpoints including:
- Setup: Generate secret and QR code for authenticator app
- Verify setup: Confirm TOTP code before enabling
- Verify: Validate TOTP code during login
- Disable: Turn off 2FA with password confirmation
- Status: Check if 2FA is enabled for a user
"""

import base64
import logging
from io import BytesIO

import pyotp
import qrcode
from flask import current_app, jsonify, request

from auth import JWTManager, jwt_required
from models import AuditLog, User, UserActivity, db


logger = logging.getLogger(__name__)

# Application name shown in authenticator apps
TOTP_ISSUER_NAME = "SupplyLine MRO"


def generate_qr_data_uri(uri: str) -> str:
    """Generate a data URI containing the QR code image for the provisioning URI."""
    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def verify_totp_code(secret: str, code: str) -> bool:
    """Verify a TOTP code against the secret.

    Args:
        secret: The Base32 encoded secret
        code: The 6-digit TOTP code from the user

    Returns:
        True if the code is valid, False otherwise
    """
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows for slight clock drift (30 seconds before/after)
    return totp.verify(code, valid_window=1)


def register_totp_routes(app):
    """Register TOTP authentication routes"""

    @app.route("/api/auth/totp/status", methods=["GET"])
    @jwt_required
    def totp_status():
        """Check if TOTP is enabled for the current user"""
        try:
            user_payload = request.current_user
            user_id = user_payload["user_id"]

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({
                    "error": "User not found",
                    "code": "USER_NOT_FOUND"
                }), 404

            return jsonify({
                "is_totp_enabled": user.is_totp_enabled
            }), 200

        except Exception as e:
            logger.error(f"TOTP status check error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500

    @app.route("/api/auth/totp/setup", methods=["POST"])
    @jwt_required
    def totp_setup():
        """Generate a new TOTP secret and QR code for setup.

        This endpoint generates a new secret but does NOT enable TOTP yet.
        The user must verify the code first using /api/auth/totp/verify-setup.
        """
        try:
            user_payload = request.current_user
            user_id = user_payload["user_id"]

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({
                    "error": "User not found",
                    "code": "USER_NOT_FOUND"
                }), 404

            # Check if TOTP is already enabled
            if user.is_totp_enabled:
                return jsonify({
                    "error": "Two-factor authentication is already enabled",
                    "code": "TOTP_ALREADY_ENABLED"
                }), 400

            # Generate a new secret
            secret = pyotp.random_base32()

            # Store the secret (not yet active)
            user.totp_secret = secret
            db.session.commit()

            # Generate the provisioning URI
            # Use email if available, otherwise use employee_number
            user_identifier = user.email or user.employee_number
            totp = pyotp.TOTP(secret)
            provisioning_uri = totp.provisioning_uri(
                name=user_identifier,
                issuer_name=TOTP_ISSUER_NAME
            )

            # Generate QR code as data URI
            qr_code_data_uri = generate_qr_data_uri(provisioning_uri)

            # Log the setup attempt
            activity = UserActivity(
                user_id=user.id,
                activity_type="totp_setup_started",
                description="User initiated TOTP 2FA setup",
                ip_address=request.remote_addr
            )
            db.session.add(activity)
            db.session.commit()

            logger.info(f"TOTP setup initiated for user {user_id}")

            return jsonify({
                "message": "TOTP setup initiated. Scan the QR code and verify with a code.",
                "qr_code": qr_code_data_uri,
                # Do NOT send the secret to the client - only the QR code
            }), 200

        except Exception as e:
            logger.error(f"TOTP setup error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500

    @app.route("/api/auth/totp/verify-setup", methods=["POST"])
    @jwt_required
    def totp_verify_setup():
        """Verify a TOTP code during setup and enable 2FA if valid.

        This endpoint validates the code from the user's authenticator app
        and enables TOTP if the code is correct.
        """
        try:
            user_payload = request.current_user
            user_id = user_payload["user_id"]

            data = request.get_json() or {}
            code = data.get("code", "").strip()

            if not code:
                return jsonify({
                    "error": "TOTP code is required",
                    "code": "MISSING_CODE"
                }), 400

            # Validate code format (6 digits)
            if not code.isdigit() or len(code) != 6:
                return jsonify({
                    "error": "Invalid code format. Please enter a 6-digit code.",
                    "code": "INVALID_CODE_FORMAT"
                }), 400

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({
                    "error": "User not found",
                    "code": "USER_NOT_FOUND"
                }), 404

            # Check if TOTP is already enabled
            if user.is_totp_enabled:
                return jsonify({
                    "error": "Two-factor authentication is already enabled",
                    "code": "TOTP_ALREADY_ENABLED"
                }), 400

            # Check if secret exists (setup was started)
            if not user.totp_secret:
                return jsonify({
                    "error": "TOTP setup not started. Please start setup first.",
                    "code": "SETUP_NOT_STARTED"
                }), 400

            # Verify the code
            if not verify_totp_code(user.totp_secret, code):
                logger.warning(f"Invalid TOTP code during setup for user {user_id}")
                return jsonify({
                    "error": "Invalid code. Please try again.",
                    "code": "INVALID_CODE"
                }), 400

            # Enable TOTP
            user.is_totp_enabled = True
            db.session.commit()

            # Log the successful setup
            activity = UserActivity(
                user_id=user.id,
                activity_type="totp_enabled",
                description="User enabled TOTP 2FA",
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            AuditLog.log(
                user_id=user.id,
                action="totp_enabled",
                resource_type="user",
                resource_id=user.id,
                details={"name": user.name},
                ip_address=request.remote_addr
            )
            db.session.commit()

            logger.info(f"TOTP enabled for user {user_id}")

            return jsonify({
                "message": "Two-factor authentication has been enabled successfully.",
                "is_totp_enabled": True
            }), 200

        except Exception as e:
            logger.error(f"TOTP verify setup error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500

    @app.route("/api/auth/totp/verify", methods=["POST"])
    def totp_verify():
        """Verify a TOTP code during login.

        This endpoint is called after password authentication when TOTP is enabled.
        It requires employee_number and the TOTP code.
        Returns JWT tokens if verification is successful.
        """
        try:
            data = request.get_json() or {}
            employee_number = data.get("employee_number")
            code = data.get("code", "").strip()

            if not employee_number or not code:
                return jsonify({
                    "error": "Employee number and TOTP code are required",
                    "code": "MISSING_FIELDS"
                }), 400

            # Validate code format (6 digits)
            if not code.isdigit() or len(code) != 6:
                return jsonify({
                    "error": "Invalid code format. Please enter a 6-digit code.",
                    "code": "INVALID_CODE_FORMAT"
                }), 400

            # Find user
            user = User.query.filter_by(employee_number=employee_number).first()
            if not user:
                logger.warning(f"TOTP verify attempt for non-existent user from IP: {request.remote_addr}")
                return jsonify({
                    "error": "Invalid credentials",
                    "code": "INVALID_CREDENTIALS"
                }), 401

            # Check if user is active
            if not user.is_active:
                return jsonify({
                    "error": "Invalid credentials",
                    "code": "INVALID_CREDENTIALS"
                }), 401

            # Check if TOTP is enabled
            if not user.is_totp_enabled or not user.totp_secret:
                return jsonify({
                    "error": "Two-factor authentication is not enabled for this account",
                    "code": "TOTP_NOT_ENABLED"
                }), 400

            # Verify the code
            if not verify_totp_code(user.totp_secret, code):
                # Increment failed login attempts
                user.increment_failed_login()
                db.session.commit()

                logger.warning(f"Invalid TOTP code for user {user.id}: {user.failed_login_attempts} attempts")

                # Log failed attempt
                activity = UserActivity(
                    user_id=user.id,
                    activity_type="totp_verify_failed",
                    description=f"Failed TOTP verification ({user.failed_login_attempts})",
                    ip_address=request.remote_addr
                )
                db.session.add(activity)
                db.session.commit()

                return jsonify({
                    "error": "Invalid code. Please try again.",
                    "code": "INVALID_CODE"
                }), 401

            # Successful verification - reset failed attempts
            user.reset_failed_login_attempts()

            # Generate JWT tokens
            tokens = JWTManager.generate_tokens(user)

            # Log successful login
            activity = UserActivity(
                user_id=user.id,
                activity_type="login",
                description="User logged in with TOTP 2FA",
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            AuditLog.log(
                user_id=user.id,
                action="user_login_totp",
                resource_type="auth",
                details={"name": user.name, "employee_number": user.employee_number},
                ip_address=request.remote_addr
            )
            db.session.commit()

            logger.info(f"Successful TOTP login for user {user.id} ({user.name})")

            # Set tokens in HttpOnly cookies
            response = jsonify({
                "message": "Login successful",
                "user": user.to_dict(include_roles=True, include_permissions=True),
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"]
            })

            # Set access token cookie
            response.set_cookie(
                "access_token",
                value=tokens["access_token"],
                max_age=900,  # 15 minutes
                httponly=True,
                secure=current_app.config.get("SESSION_COOKIE_SECURE", True),
                samesite="Lax",
                path="/"
            )

            # Set refresh token cookie
            response.set_cookie(
                "refresh_token",
                value=tokens["refresh_token"],
                max_age=604800,  # 7 days
                httponly=True,
                secure=current_app.config.get("SESSION_COOKIE_SECURE", True),
                samesite="Lax",
                path="/"
            )

            return response, 200

        except Exception as e:
            logger.error(f"TOTP verify error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500

    @app.route("/api/auth/totp/disable", methods=["POST"])
    @jwt_required
    def totp_disable():
        """Disable TOTP 2FA for the current user.

        Requires password re-authentication for security.
        """
        try:
            user_payload = request.current_user
            user_id = user_payload["user_id"]

            data = request.get_json() or {}
            password = data.get("password")

            if not password:
                return jsonify({
                    "error": "Password is required to disable two-factor authentication",
                    "code": "MISSING_PASSWORD"
                }), 400

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({
                    "error": "User not found",
                    "code": "USER_NOT_FOUND"
                }), 404

            # Verify password
            if not user.check_password(password):
                logger.warning(f"Invalid password during TOTP disable for user {user_id}")
                return jsonify({
                    "error": "Invalid password",
                    "code": "INVALID_PASSWORD"
                }), 401

            # Check if TOTP is enabled
            if not user.is_totp_enabled:
                return jsonify({
                    "error": "Two-factor authentication is not enabled",
                    "code": "TOTP_NOT_ENABLED"
                }), 400

            # Disable TOTP and clear the secret
            user.is_totp_enabled = False
            user.totp_secret = None
            db.session.commit()

            # Log the disable action
            activity = UserActivity(
                user_id=user.id,
                activity_type="totp_disabled",
                description="User disabled TOTP 2FA",
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            AuditLog.log(
                user_id=user.id,
                action="totp_disabled",
                resource_type="user",
                resource_id=user.id,
                details={"name": user.name},
                ip_address=request.remote_addr
            )
            db.session.commit()

            logger.info(f"TOTP disabled for user {user_id}")

            return jsonify({
                "message": "Two-factor authentication has been disabled.",
                "is_totp_enabled": False
            }), 200

        except Exception as e:
            logger.error(f"TOTP disable error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500
