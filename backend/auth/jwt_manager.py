"""
JWT Authentication Manager for SupplyLine MRO Suite

This module provides JWT-based authentication functionality including:
- Access and refresh token generation
- Token validation and verification
- Secure token management
- User authentication decorators
"""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Any

import jwt
from flask import current_app, jsonify, request

from models import User, db


logger = logging.getLogger(__name__)


class JWTManager:
    """JWT Authentication Manager"""

    @staticmethod
    def generate_tokens(user) -> dict[str, str | int]:
        """
        Generate access and refresh tokens for user

        Args:
            user: User object to generate tokens for

        Returns:
            Dict containing access_token and refresh_token
        """
        now = datetime.now(UTC)

        # Get access token expiration from session timeout configuration
        # This ensures JWT tokens expire at the same time as the session inactivity timeout
        access_token_minutes = current_app.config.get("SESSION_INACTIVITY_TIMEOUT_MINUTES", 30)

        # Access token payload (configurable lifetime matching session timeout)
        access_payload = {
            "user_id": user.id,
            "user_name": user.name,
            "employee_number": user.employee_number,
            "is_admin": user.is_admin,
            "department": user.department,
            "permissions": user.get_effective_permissions(),  # Use effective permissions (role + user-specific)
            "iat": now,
            "exp": now + timedelta(minutes=access_token_minutes),
            "jti": secrets.token_hex(16),  # JWT ID for CSRF validation
            "type": "access"
        }

        # Refresh token payload (long-lived: 7 days)
        refresh_payload = {
            "user_id": user.id,
            "iat": now,
            "exp": now + timedelta(days=7),
            "type": "refresh",
            "jti": secrets.token_hex(16)  # JWT ID for token revocation
        }

        secret_key = current_app.config["JWT_SECRET_KEY"]

        access_token = jwt.encode(access_payload, secret_key, algorithm="HS256")
        refresh_token = jwt.encode(refresh_payload, secret_key, algorithm="HS256")

        logger.info(f"JWT tokens generated for user {user.id} ({user.name}) with {access_token_minutes} minute expiration")

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": access_token_minutes * 60,  # Convert minutes to seconds
            "token_type": "Bearer"
        }

    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> dict[str, Any] | None:
        """
        Verify and decode JWT token

        Args:
            token: JWT token string
            token_type: Expected token type ('access' or 'refresh')

        Returns:
            Decoded token payload or None if invalid
        """
        try:
            secret_key = current_app.config["JWT_SECRET_KEY"]
            # Add 10 second leeway for clock skew between containers/systems
            payload = jwt.decode(token, secret_key, algorithms=["HS256"], leeway=timedelta(seconds=10))

            # Verify token type
            if payload.get("type") != token_type:
                logger.warning(f"Token type mismatch. Expected: {token_type}, Got: {payload.get('type')}")
                return None

            return payload

        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e!s}")
            return None
        except Exception as e:
            logger.error(f"Token verification error: {e!s}")
            return None

    @staticmethod
    def refresh_access_token(refresh_token: str) -> dict[str, str | int] | None:
        """
        Generate new access token using refresh token

        Args:
            refresh_token: Valid refresh token

        Returns:
            New token pair or None if refresh token is invalid
        """
        try:
            payload = JWTManager.verify_token(refresh_token, "refresh")
            if not payload:
                return None

            # Get user from database
            user = db.session.get(User, payload["user_id"])
            if not user or not user.is_active:
                logger.warning(f"User {payload['user_id']} not found or inactive")
                return None

            # Generate new tokens
            return JWTManager.generate_tokens(user)
        except Exception as e:
            logger.error(f"Error refreshing access token: {e!s}")
            return None

    @staticmethod
    def extract_token_from_header() -> str | None:
        """
        Extract JWT token from Authorization header (legacy support)

        Returns:
            Token string or None if not found
        """
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            logger.debug("Authorization header missing")
            return None

        try:
            scheme, token = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                logger.debug("Invalid authorization scheme", extra={"scheme": scheme})
                return None
            return token
        except ValueError:
            logger.debug("Authorization header format invalid")
            return None

    @staticmethod
    def extract_token(token_type: str = "access") -> str | None:
        """
        Extract JWT token from HttpOnly cookie or Authorization header

        SECURITY: Prioritizes HttpOnly cookies over Authorization header
        Cookies provide XSS protection while headers are kept for backward compatibility

        Args:
            token_type: Type of token to extract ('access' or 'refresh')

        Returns:
            Token string or None if not found
        """
        # SECURITY: Check HttpOnly cookie first (preferred method)
        cookie_name = f"{token_type}_token"
        token = request.cookies.get(cookie_name)
        if token:
            logger.debug(f"Token extracted from HttpOnly cookie: {cookie_name}")
            return token

        # Fallback to Authorization header for backward compatibility
        if token_type == "access":
            token = JWTManager.extract_token_from_header()
            if token:
                logger.debug("Token extracted from Authorization header (legacy)")
                return token

        logger.debug(f"No {token_type} token found in cookies or headers")
        return None

    @staticmethod
    def get_current_user() -> dict[str, Any] | None:
        """
        Get current user from JWT token (from HttpOnly cookie or Authorization header)

        Returns:
            User payload from token or None if not authenticated
        """
        token = JWTManager.extract_token(token_type="access")
        if not token:
            return None

        return JWTManager.verify_token(token, "access")

    @staticmethod
    def generate_csrf_token(user_id: int, token_secret: str) -> str:
        """
        Generate CSRF token for JWT-based authentication

        Args:
            user_id: User ID
            token_secret: Secret from JWT token

        Returns:
            CSRF token string
        """
        # Create a unique token based on user ID, current time, and token secret
        timestamp = str(int(datetime.now(UTC).timestamp()))
        data = f"{user_id}:{timestamp}:{token_secret}"
        csrf_token = hashlib.sha256(data.encode()).hexdigest()[:32]
        return f"{timestamp}:{csrf_token}"

    @staticmethod
    def validate_csrf_token(csrf_token: str, user_id: int, token_secret: str, max_age: int = 3600) -> bool:
        """
        Validate CSRF token for JWT-based authentication

        Args:
            csrf_token: CSRF token to validate
            user_id: User ID from JWT
            token_secret: Secret from JWT token
            max_age: Maximum age of token in seconds (default: 1 hour)

        Returns:
            True if token is valid, False otherwise
        """
        try:
            if ":" not in csrf_token:
                return False

            timestamp_str, token_hash = csrf_token.split(":", 1)
            timestamp = int(timestamp_str)

            # Check if token is not too old
            current_time = int(datetime.now(UTC).timestamp())
            if current_time - timestamp > max_age:
                logger.warning(f"CSRF token expired for user {user_id}")
                return False

            # Regenerate expected token
            data = f"{user_id}:{timestamp_str}:{token_secret}"
            expected_hash = hashlib.sha256(data.encode()).hexdigest()[:32]

            # Compare tokens securely
            return secrets.compare_digest(token_hash, expected_hash)

        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid CSRF token format for user {user_id}: {e}")
            return False


def jwt_required(f):
    """Decorator for JWT authentication requirement"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_payload = JWTManager.get_current_user()
        if not user_payload:
            return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

        # Add user info to request context
        request.current_user = user_payload
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator for admin privilege requirement"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_payload = JWTManager.get_current_user()
        if not user_payload:
            return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

        if not user_payload.get("is_admin", False):
            return jsonify({"error": "Admin privileges required", "code": "ADMIN_REQUIRED"}), 403

        # Add user info to request context
        request.current_user = user_payload
        return f(*args, **kwargs)
    return decorated_function


def permission_required(permission_name: str, enforce_for_admin: bool = False):
    """Decorator for specific permission requirement.

    By default, admins (is_admin: true) automatically have ALL permissions and bypass
    this check for backward compatibility. However, for sensitive operations where
    explicit permission verification is required even for admins, set enforce_for_admin=True.

    Args:
        permission_name: The permission string required to access the endpoint.
        enforce_for_admin: If True, admins must also have the explicit permission.
                          If False (default), admins bypass the permission check.

    Example:
        @permission_required("user.delete")  # Admins bypass this check
        def delete_user(): ...

        @permission_required("audit.view", enforce_for_admin=True)  # Even admins need this permission
        def view_audit_logs(): ...
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_payload = JWTManager.get_current_user()
            if not user_payload:
                return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

            # Check if admin can bypass permission check
            if not enforce_for_admin and user_payload.get("is_admin", False):
                request.current_user = user_payload
                return f(*args, **kwargs)

            # Check specific permission (applies to non-admins, or admins when enforce_for_admin=True)
            permissions = user_payload.get("permissions", [])
            if permission_name not in permissions:
                return jsonify({
                    "error": f"Permission {permission_name} required",
                    "code": "PERMISSION_REQUIRED"
                }), 403

            # Add user info to request context
            request.current_user = user_payload
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def permission_required_any(*permission_names: str, enforce_for_admin: bool = False):
    """Decorator that authorizes users with any of the provided permissions.

    By default, admins (is_admin: true) automatically satisfy all permission checks
    for backward compatibility. However, for sensitive operations where explicit
    permission verification is required even for admins, set enforce_for_admin=True.

    Args:
        *permission_names: Variable number of permission strings. User needs at least one.
        enforce_for_admin: If True, admins must also have at least one of the explicit permissions.
                          If False (default), admins bypass the permission check.

    Example:
        @permission_required_any("report.view", "report.export")  # Admins bypass this check
        def get_report(): ...

        @permission_required_any("audit.view", "audit.export", enforce_for_admin=True)  # Even admins need one of these
        def get_audit_report(): ...
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_payload = JWTManager.get_current_user()
            if not user_payload:
                return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

            # Check if admin can bypass permission check
            if not enforce_for_admin and user_payload.get("is_admin", False):
                request.current_user = user_payload
                return f(*args, **kwargs)

            # Check for any matching permission (applies to non-admins, or admins when enforce_for_admin=True)
            permissions = set(user_payload.get("permissions", []))
            if not any(name in permissions for name in permission_names):
                joined = ", ".join(permission_names)
                return jsonify({
                    "error": f"One of the following permissions is required: {joined}",
                    "code": "PERMISSION_REQUIRED",
                }), 403

            request.current_user = user_payload
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def department_required(department_name: str):
    """Decorator for department-specific access"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_payload = JWTManager.get_current_user()
            if not user_payload:
                return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

            # Allow admin access to all departments
            if user_payload.get("is_admin", False):
                request.current_user = user_payload
                return f(*args, **kwargs)

            user_department = user_payload.get("department")
            if user_department != department_name:
                return jsonify({
                    "error": f"Access restricted to {department_name} department",
                    "code": "DEPARTMENT_REQUIRED"
                }), 403

            # Add user info to request context
            request.current_user = user_payload
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def csrf_required(f):
    """Decorator for JWT-compatible CSRF protection"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip CSRF validation in testing mode
        if current_app.config.get("TESTING", False):
            return f(*args, **kwargs)

        # Only check CSRF for state-changing methods
        if request.method not in ["POST", "PUT", "DELETE", "PATCH"]:
            return f(*args, **kwargs)

        # Get current user from JWT
        user_payload = JWTManager.get_current_user()
        if not user_payload:
            return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

        # Get CSRF token from header
        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            logger.warning(f"Missing CSRF token for user {user_payload['user_id']}")
            return jsonify({
                "error": "CSRF token required",
                "code": "CSRF_TOKEN_REQUIRED"
            }), 403

        # Validate CSRF token using JWT secret
        token_secret = user_payload.get("jti", f"{user_payload['user_id']}:{user_payload.get('iat', '')}")  # JWT ID as secret, fallback to user_id:iat
        if not JWTManager.validate_csrf_token(csrf_token, user_payload["user_id"], token_secret):
            logger.warning(f"Invalid CSRF token for user {user_payload['user_id']}")
            return jsonify({
                "error": "Invalid CSRF token",
                "code": "CSRF_TOKEN_INVALID"
            }), 403

        # Add user info to request context
        request.current_user = user_payload
        return f(*args, **kwargs)
    return decorated_function
