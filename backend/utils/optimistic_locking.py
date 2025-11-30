"""
Optimistic Locking Utilities for Concurrent Update Collision Handling

This module provides infrastructure for detecting and handling concurrent update
collisions using optimistic locking with version fields.

Design Goals:
- Prevent lost updates when multiple users edit the same resource simultaneously
- Provide clear feedback to users when conflicts occur
- Be extensible for future conflict resolution strategies
- Minimal impact on existing codebase

Usage:
    # In models.py - add VersionedMixin to models that need conflict detection
    class Chemical(VersionedMixin, db.Model):
        ...

    # In routes - use check_version before updates
    from utils.optimistic_locking import check_version, ConflictError

    @app.route("/api/chemicals/<int:id>", methods=["PUT"])
    def update_chemical(id):
        chemical = Chemical.query.get_or_404(id)
        data = request.get_json()

        # Check version before update
        check_version(chemical, data.get("version"))

        # Proceed with update...
        chemical.part_number = data["part_number"]
        db.session.commit()  # Version auto-increments
"""

import logging
from functools import wraps
from typing import Any, TypeVar

from flask import jsonify, request

logger = logging.getLogger(__name__)

# Type variable for generic model support
T = TypeVar("T")


class ConflictError(Exception):
    """
    Raised when an optimistic locking conflict is detected.

    This exception indicates that the resource has been modified by another
    user/process since it was last fetched, and the update cannot proceed
    without potentially losing changes.

    Attributes:
        message: Human-readable description of the conflict
        current_version: The current version of the resource in the database
        provided_version: The version provided in the update request
        resource_type: The type of resource (e.g., "Chemical", "Tool")
        resource_id: The ID of the conflicting resource
        current_data: Optional dict of current resource data for client refresh
    """

    def __init__(
        self,
        message: str,
        current_version: int | None = None,
        provided_version: int | None = None,
        resource_type: str | None = None,
        resource_id: int | None = None,
        current_data: dict | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.current_version = current_version
        self.provided_version = provided_version
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.current_data = current_data

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to a dictionary for JSON response."""
        result = {
            "error": self.message,
            "error_code": "version_conflict",
            "conflict_details": {
                "current_version": self.current_version,
                "provided_version": self.provided_version,
            },
        }

        if self.resource_type:
            result["conflict_details"]["resource_type"] = self.resource_type

        if self.resource_id:
            result["conflict_details"]["resource_id"] = self.resource_id

        if self.current_data:
            result["current_data"] = self.current_data

        result["hint"] = (
            "The resource was modified by another user. "
            "Please refresh and try again, or review the current data and resubmit."
        )

        return result


class VersionMismatchError(ConflictError):
    """
    Specific conflict error for version mismatches.

    This is a subclass of ConflictError specifically for cases where
    the client's version doesn't match the server's version.
    """

    pass


def check_version(
    model_instance: Any,
    provided_version: int | None,
    include_current_data: bool = True,
) -> None:
    """
    Check if the provided version matches the current version of the model.

    This function should be called before updating a versioned resource to
    ensure no concurrent modifications have occurred.

    Args:
        model_instance: The SQLAlchemy model instance to check
        provided_version: The version number provided by the client
        include_current_data: Whether to include current data in the error response

    Raises:
        ConflictError: If version is missing or doesn't match
        ValueError: If the model doesn't have a version field

    Example:
        chemical = Chemical.query.get_or_404(id)
        data = request.get_json()
        check_version(chemical, data.get("version"))
        # Safe to proceed with update
    """
    # Check if model has version field
    if not hasattr(model_instance, "version"):
        logger.warning(
            f"Model {type(model_instance).__name__} does not have version field. "
            "Skipping version check."
        )
        return

    current_version = model_instance.version
    resource_type = type(model_instance).__name__
    resource_id = getattr(model_instance, "id", None)

    # Version is required for updates to versioned resources
    if provided_version is None:
        logger.warning(
            f"Version not provided for {resource_type} {resource_id}. "
            "Client may be using outdated API."
        )
        # For backwards compatibility, we allow updates without version
        # but log a warning. This can be made strict later.
        return

    # Convert to int for comparison
    try:
        provided_version = int(provided_version)
    except (TypeError, ValueError):
        raise ConflictError(
            message="Invalid version format. Version must be an integer.",
            current_version=current_version,
            provided_version=None,
            resource_type=resource_type,
            resource_id=resource_id,
        )

    # Check version match
    if provided_version != current_version:
        logger.info(
            f"Version conflict detected for {resource_type} {resource_id}: "
            f"provided={provided_version}, current={current_version}"
        )

        current_data = None
        if include_current_data and hasattr(model_instance, "to_dict"):
            try:
                current_data = model_instance.to_dict()
            except Exception as e:
                logger.warning(f"Failed to serialize current data: {e}")

        raise ConflictError(
            message=(
                f"This {resource_type.lower()} has been modified by another user. "
                f"Your version ({provided_version}) is outdated. "
                f"Current version is {current_version}."
            ),
            current_version=current_version,
            provided_version=provided_version,
            resource_type=resource_type,
            resource_id=resource_id,
            current_data=current_data,
        )

    logger.debug(
        f"Version check passed for {resource_type} {resource_id}: version={current_version}"
    )


def create_conflict_response(error: ConflictError):
    """
    Create a Flask JSON response for a conflict error.

    Args:
        error: The ConflictError exception

    Returns:
        A tuple of (response, status_code) for Flask
    """
    return jsonify(error.to_dict()), 409


def with_optimistic_lock(get_model_func=None):
    """
    Decorator for route handlers that enforces optimistic locking.

    This decorator automatically checks the version field before allowing
    an update to proceed.

    Args:
        get_model_func: Optional function that extracts the model from request.
                       If not provided, the decorator expects the model to be
                       returned as the first element of a tuple from the handler.

    Example:
        @app.route("/api/chemicals/<int:id>", methods=["PUT"])
        @with_optimistic_lock
        def update_chemical(id):
            chemical = Chemical.query.get_or_404(id)
            # Decorator handles version check
            return chemical, request.get_json()

    Note: This decorator is provided for convenience but direct use of
    check_version() gives more control in complex scenarios.
    """

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Only apply to PUT/PATCH requests
            if request.method not in ("PUT", "PATCH"):
                return f(*args, **kwargs)

            # Get version from request
            data = request.get_json() or {}
            provided_version = data.get("version")

            # Store version in request context for handler to use
            request.provided_version = provided_version

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def get_versioned_update_data(
    model_instance: Any,
    data: dict,
    check: bool = True,
) -> dict:
    """
    Prepare data for a versioned update, optionally checking the version.

    This utility function handles version checking and removes the version
    field from the data dict (since it shouldn't be set directly).

    Args:
        model_instance: The model instance being updated
        data: The update data from the client
        check: Whether to perform version check (default True)

    Returns:
        The data dict with version field removed

    Raises:
        ConflictError: If version check fails

    Example:
        data = get_versioned_update_data(chemical, request.get_json())
        # data no longer contains 'version' key
        for key, value in data.items():
            setattr(chemical, key, value)
    """
    # Extract and remove version from data
    provided_version = data.pop("version", None)

    if check:
        check_version(model_instance, provided_version)

    return data


# Constants for conflict resolution strategies (for future expansion)
class ConflictStrategy:
    """
    Enumeration of conflict resolution strategies.

    These strategies can be used by clients to indicate how they want
    conflicts to be handled. Currently only FAIL is fully implemented.
    """

    # Fail the update and return conflict error (default)
    FAIL = "fail"

    # Force the update, overwriting any changes (requires special permission)
    FORCE = "force"

    # Merge changes automatically where possible (future feature)
    MERGE = "merge"

    # Return the diff between versions (future feature)
    DIFF = "diff"


def handle_conflict_strategy(
    model_instance: Any,
    data: dict,
    strategy: str = ConflictStrategy.FAIL,
) -> tuple[bool, dict | None]:
    """
    Handle update based on the specified conflict strategy.

    Args:
        model_instance: The model instance being updated
        data: The update data from the client
        strategy: The conflict resolution strategy to use

    Returns:
        Tuple of (should_proceed, modified_data)
        - should_proceed: True if the update should continue
        - modified_data: The data to use for the update (may be modified)

    Raises:
        ConflictError: If strategy is FAIL and there's a version mismatch
        ValueError: If an unknown strategy is specified

    Note: Currently only FAIL and FORCE strategies are implemented.
    MERGE and DIFF are placeholders for future development.
    """
    provided_version = data.get("version")

    if strategy == ConflictStrategy.FORCE:
        # Force update - skip version check but log it
        logger.warning(
            f"Force update requested for {type(model_instance).__name__} "
            f"{getattr(model_instance, 'id', 'unknown')}. "
            f"Skipping version check."
        )
        # Remove version from data
        update_data = {k: v for k, v in data.items() if k != "version"}
        return True, update_data

    if strategy == ConflictStrategy.FAIL:
        # Default behavior - check version and fail on mismatch
        check_version(model_instance, provided_version)
        update_data = {k: v for k, v in data.items() if k != "version"}
        return True, update_data

    if strategy == ConflictStrategy.MERGE:
        # Future feature: merge changes automatically
        raise NotImplementedError(
            "MERGE conflict strategy is not yet implemented. "
            "Use FAIL or FORCE strategy."
        )

    if strategy == ConflictStrategy.DIFF:
        # Future feature: return diff between versions
        raise NotImplementedError(
            "DIFF conflict strategy is not yet implemented. "
            "Use FAIL or FORCE strategy."
        )

    raise ValueError(f"Unknown conflict strategy: {strategy}")
