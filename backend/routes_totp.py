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

from auth import (
    JWTManager,
    issue_trusted_device,
    jwt_required,
    revoke_all_for_user,
    set_trusted_device_cookie,
)
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
    is_valid = totp.verify(code, valid_window=1)

    # Debug logging to diagnose Authy code issues
    if not is_valid:
        current_code = totp.now()
        logger.warning(f"TOTP verification failed - Expected: {current_code}, Received: {code}, Secret: {secret[:8]}...")

    return is_valid


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

            # Store the secret encrypted (not yet active)
            user.set_totp_secret_encrypted(secret)
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

            # Verify the code (decrypt secret for verification)
            if not verify_totp_code(user.get_totp_secret_decrypted(), code):
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

            # Generate full JWT tokens now that 2FA is enabled
            tokens = JWTManager.generate_tokens(user)

            # Return tokens so user is fully authenticated after setup
            return jsonify({
                "message": "Two-factor authentication has been enabled successfully.",
                "is_totp_enabled": True,
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "user": user.to_dict(include_roles=True, include_permissions=True),
                "expires_in": 900  # 15 minutes
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
            trust_device = bool(data.get("trust_device", False))

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

            # Verify the code (decrypt secret for verification)
            if not verify_totp_code(user.get_totp_secret_decrypted(), code):
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

            trusted_device_issued = False
            if trust_device:
                token, device = issue_trusted_device(
                    user,
                    request.headers.get("User-Agent"),
                    request.remote_addr,
                )
                db.session.add(UserActivity(
                    user_id=user.id,
                    activity_type="trusted_device_created",
                    description=f"Trusted device issued (id={device.id}, label={device.device_label})",
                    ip_address=request.remote_addr,
                ))
                AuditLog.log(
                    user_id=user.id,
                    action="trusted_device_created",
                    resource_type="trusted_device",
                    resource_id=device.id,
                    details={
                        "label": device.device_label,
                        "ttl_days": current_app.config.get("TRUSTED_DEVICE_TTL_DAYS", 30),
                    },
                    ip_address=request.remote_addr,
                )
                db.session.commit()
                trusted_device_issued = True

            # Set tokens in HttpOnly cookies
            response = jsonify({
                "message": "Login successful",
                "user": user.to_dict(include_roles=True, include_permissions=True),
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "trusted_device_issued": trusted_device_issued,
            })

            # Set access token cookie
            response.set_cookie(
                "access_token",
                value=tokens["access_token"],
                max_age=900,  # 15 minutes
                httponly=True,
                secure=current_app.config.get("SESSION_COOKIE_SECURE", True),
                samesite=current_app.config.get("COOKIE_SAMESITE", "Lax"),
                path="/"
            )

            # Set refresh token cookie
            response.set_cookie(
                "refresh_token",
                value=tokens["refresh_token"],
                max_age=604800,  # 7 days
                httponly=True,
                secure=current_app.config.get("SESSION_COOKIE_SECURE", True),
                samesite=current_app.config.get("COOKIE_SAMESITE", "Lax"),
                path="/"
            )

            if trusted_device_issued:
                set_trusted_device_cookie(response, token)

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

            # Revoke any trusted devices — they implicitly rely on 2FA
            revoked_devices = revoke_all_for_user(user.id, "totp_disabled")
            if revoked_devices:
                db.session.add(UserActivity(
                    user_id=user.id,
                    activity_type="trusted_devices_wiped",
                    description=f"Revoked {revoked_devices} trusted devices due to TOTP disable",
                    ip_address=request.remote_addr,
                ))

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
                details={"name": user.name, "revoked_trusted_devices": revoked_devices},
                ip_address=request.remote_addr
            )
            db.session.commit()

            logger.info(f"TOTP disabled for user {user_id}")

            return jsonify({
                "message": "Two-factor authentication has been disabled.",
                "is_totp_enabled": False,
                "revoked_trusted_devices": revoked_devices,
            }), 200

        except Exception as e:
            logger.error(f"TOTP disable error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500

    @app.route("/api/auth/totp/backup-codes/generate", methods=["POST"])
    @jwt_required
    def totp_generate_backup_codes():
        """Generate 10 single-use backup codes for account recovery.

        Returns plain-text codes that are hashed and stored in the database.
        These codes should be saved securely by the user.
        """
        import json
        import secrets
        from datetime import datetime

        from werkzeug.security import generate_password_hash

        try:
            user_payload = request.current_user
            user_id = user_payload["user_id"]

            user = db.session.get(User, user_id)
            if not user:
                return jsonify({
                    "error": "User not found",
                    "code": "USER_NOT_FOUND"
                }), 404

            # Check if TOTP is enabled
            if not user.is_totp_enabled:
                return jsonify({
                    "error": "Two-factor authentication must be enabled first",
                    "code": "TOTP_NOT_ENABLED"
                }), 400

            # Generate 10 random 8-character backup codes
            backup_codes_plain = []
            backup_codes_hashed = []

            for _ in range(10):
                # Generate alphanumeric code (uppercase for readability)
                code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
                backup_codes_plain.append(code)
                backup_codes_hashed.append(generate_password_hash(code))

            # Store hashed codes as JSON array
            user.backup_codes = json.dumps(backup_codes_hashed)
            user.backup_codes_generated_at = datetime.utcnow()
            db.session.commit()

            # Log the generation
            activity = UserActivity(
                user_id=user.id,
                activity_type="backup_codes_generated",
                description="User generated backup codes",
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            AuditLog.log(
                user_id=user.id,
                action="backup_codes_generated",
                resource_type="user",
                resource_id=user.id,
                details={"count": 10},
                ip_address=request.remote_addr
            )
            db.session.commit()

            logger.info(f"Backup codes generated for user {user_id}")

            # Return plain-text codes (only shown once!)
            return jsonify({
                "message": "Backup codes generated successfully",
                "backup_codes": backup_codes_plain,
                "generated_at": user.backup_codes_generated_at.isoformat()
            }), 200

        except Exception as e:
            logger.error(f"Backup codes generation error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500

    @app.route("/api/auth/totp/verify-backup-code", methods=["POST"])
    def totp_verify_backup_code():
        """Verify and consume a backup code for login.

        This endpoint allows login using a backup code when the authenticator
        app is unavailable. The code is consumed (removed) upon successful use.
        """
        import json

        from werkzeug.security import check_password_hash

        try:
            data = request.get_json()
            employee_number = data.get("employee_number")
            backup_code = data.get("code")
            trust_device = bool(data.get("trust_device", False))

            if not employee_number or not backup_code:
                return jsonify({
                    "error": "Employee number and backup code are required",
                    "code": "MISSING_FIELDS"
                }), 400

            # Find user by employee number
            user = User.query.filter_by(employee_number=employee_number).first()
            if not user:
                logger.warning(f"Backup code attempt for non-existent user: {employee_number}")
                return jsonify({
                    "error": "Invalid employee number or backup code",
                    "code": "INVALID_CREDENTIALS"
                }), 401

            # Check if TOTP is enabled
            if not user.is_totp_enabled:
                return jsonify({
                    "error": "Two-factor authentication is not enabled",
                    "code": "TOTP_NOT_ENABLED"
                }), 400

            # Check if backup codes exist
            if not user.backup_codes:
                return jsonify({
                    "error": "No backup codes available",
                    "code": "NO_BACKUP_CODES"
                }), 400

            # Parse stored backup codes
            try:
                backup_codes_hashed = json.loads(user.backup_codes)
            except json.JSONDecodeError:
                logger.error(f"Invalid backup codes JSON for user {user.id}")
                return jsonify({
                    "error": "Backup codes data corrupted",
                    "code": "DATA_ERROR"
                }), 500

            # Verify the code matches one of the hashed codes
            matching_code_index = None
            for idx, hashed_code in enumerate(backup_codes_hashed):
                if check_password_hash(hashed_code, backup_code.upper()):
                    matching_code_index = idx
                    break

            if matching_code_index is None:
                logger.warning(f"Invalid backup code attempt for user {user.id}")
                return jsonify({
                    "error": "Invalid backup code",
                    "code": "INVALID_CODE"
                }), 401

            # Remove the used backup code
            backup_codes_hashed.pop(matching_code_index)
            user.backup_codes = json.dumps(backup_codes_hashed) if backup_codes_hashed else None
            db.session.commit()

            # Generate JWT tokens
            tokens = JWTManager.generate_tokens(user)
            access_token = tokens["access_token"]
            refresh_token = tokens["refresh_token"]
            expires_in = tokens["expires_in"]

            # Log the login
            activity = UserActivity(
                user_id=user.id,
                activity_type="backup_code_login",
                description="User logged in using backup code",
                ip_address=request.remote_addr
            )
            db.session.add(activity)

            AuditLog.log(
                user_id=user.id,
                action="backup_code_login",
                resource_type="user",
                resource_id=user.id,
                details={"codes_remaining": len(backup_codes_hashed)},
                ip_address=request.remote_addr
            )
            db.session.commit()

            logger.info(f"Backup code login successful for user {user.id} ({len(backup_codes_hashed)} codes remaining)")

            trusted_device_issued = False
            if trust_device:
                token, device = issue_trusted_device(
                    user,
                    request.headers.get("User-Agent"),
                    request.remote_addr,
                )
                db.session.add(UserActivity(
                    user_id=user.id,
                    activity_type="trusted_device_created",
                    description=f"Trusted device issued via backup code (id={device.id}, label={device.device_label})",
                    ip_address=request.remote_addr,
                ))
                AuditLog.log(
                    user_id=user.id,
                    action="trusted_device_created",
                    resource_type="trusted_device",
                    resource_id=device.id,
                    details={
                        "label": device.device_label,
                        "via": "backup_code",
                        "ttl_days": current_app.config.get("TRUSTED_DEVICE_TTL_DAYS", 30),
                    },
                    ip_address=request.remote_addr,
                )
                db.session.commit()
                trusted_device_issued = True

            response = jsonify({
                "message": "Login successful",
                "user": user.to_dict(),
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_in": expires_in,
                "codes_remaining": len(backup_codes_hashed),
                "trusted_device_issued": trusted_device_issued,
            })

            if trusted_device_issued:
                set_trusted_device_cookie(response, token)

            return response, 200

        except Exception as e:
            logger.error(f"Backup code verification error: {e!s}")
            return jsonify({
                "error": "Internal server error",
                "code": "SERVER_ERROR"
            }), 500
