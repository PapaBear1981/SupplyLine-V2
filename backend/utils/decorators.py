"""
Reusable decorators for route protection and authorization.

This module provides:
- login_required: Alias for jwt_required, ensures user is authenticated
- ownership_required: Decorator to verify resource ownership
- owner_or_admin_required: Decorator that allows owners or admins to access
"""

import logging
from functools import wraps

from flask import jsonify, request

from auth import jwt_required
from models import db


logger = logging.getLogger(__name__)


def login_required(f):
    """
    Decorator to ensure user is authenticated.

    This is an alias for jwt_required that provides a more semantic name
    for routes that require login. It ensures:
    - A valid JWT token is present
    - The user is active

    Usage:
        @app.route("/api/protected")
        @login_required
        def protected_route():
            return {"message": "Hello, authenticated user!"}
    """
    return jwt_required(f)


def ownership_required(model_class, owner_field="user_id", get_resource_id=None):
    """
    Decorator to verify that the current user owns the resource.

    Args:
        model_class: SQLAlchemy model class (e.g., UserRequest, ProcurementOrder)
        owner_field: Name of the field that contains the owner's user_id
        get_resource_id: Optional function to extract resource ID from request args/kwargs.
                        If not provided, looks for '<model>_id' in route args.

    Usage:
        @ownership_required(UserRequest, owner_field='requester_id')
        def delete_request(request_id):
            # Only the requester can delete their own request
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user from JWT
            user_payload = getattr(request, "current_user", None)
            if not user_payload:
                return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

            user_id = user_payload.get("user_id")
            is_admin = user_payload.get("is_admin", False)

            # Admins bypass ownership check
            if is_admin:
                return f(*args, **kwargs)

            # Get resource ID
            if get_resource_id:
                resource_id = get_resource_id(*args, **kwargs)
            else:
                # Try to find the resource ID in route kwargs
                model_name = model_class.__name__.lower()
                resource_id = kwargs.get(f"{model_name}_id") or kwargs.get("id")

            if not resource_id:
                return jsonify({"error": "Resource ID not found", "code": "INVALID_REQUEST"}), 400

            # Fetch resource
            resource = db.session.get(model_class, resource_id)
            if not resource:
                return jsonify({"error": "Resource not found", "code": "NOT_FOUND"}), 404

            # Check ownership
            owner_id = getattr(resource, owner_field, None)
            if owner_id != user_id:
                logger.warning(f"Ownership check failed: user {user_id} tried to access resource {resource_id} owned by {owner_id}")
                return jsonify({"error": "Access denied. You do not own this resource.", "code": "FORBIDDEN"}), 403

            return f(*args, **kwargs)

        return decorated_function
    return decorator


def owner_or_admin_required(model_class, owner_field="user_id"):
    """
    Decorator that allows access to the resource owner or admins.

    This is similar to ownership_required but also grants access to admins.

    Args:
        model_class: SQLAlchemy model class
        owner_field: Name of the field containing the owner's user_id

    Usage:
        @owner_or_admin_required(ProcurementOrder, owner_field='requester_id')
        def update_order(order_id):
            # Owner or admin can update
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user from JWT (must be applied after @login_required or @jwt_required)
            user_payload = getattr(request, "current_user", None)
            if not user_payload:
                return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401

            user_id = user_payload.get("user_id")
            is_admin = user_payload.get("is_admin", False)

            # Get resource ID from route kwargs
            model_name = model_class.__name__.lower()
            resource_id = kwargs.get(f"{model_name}_id") or kwargs.get("id")

            if not resource_id:
                return jsonify({"error": "Resource ID not found", "code": "INVALID_REQUEST"}), 400

            # Fetch resource
            resource = db.session.get(model_class, resource_id)
            if not resource:
                return jsonify({"error": "Resource not found", "code": "NOT_FOUND"}), 404

            # Check if user is admin or owner
            owner_id = getattr(resource, owner_field, None)
            if not is_admin and owner_id != user_id:
                logger.warning(f"Access denied: user {user_id} tried to access resource {resource_id} owned by {owner_id}")
                return jsonify({"error": "Access denied. You do not have permission to access this resource.", "code": "FORBIDDEN"}), 403

            return f(*args, **kwargs)

        return decorated_function
    return decorator
