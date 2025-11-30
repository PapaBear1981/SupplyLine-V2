"""
SQLAlchemy Model Mixins for SupplyLine MRO Suite

This module provides reusable mixins for SQLAlchemy models to add
common functionality like optimistic locking, timestamps, etc.

Usage:
    from models_mixins import VersionedMixin

    class Chemical(VersionedMixin, db.Model):
        __tablename__ = "chemicals"
        id = db.Column(db.Integer, primary_key=True)
        # ... other fields
"""

from sqlalchemy import Column, Integer, event
from sqlalchemy.orm import declared_attr


class VersionedMixin:
    """
    Mixin that adds optimistic locking support via a version field.

    This mixin adds a `version` field to the model that auto-increments
    on every update. This allows detection of concurrent modifications
    when multiple users attempt to update the same record.

    The version field:
    - Starts at 1 for new records
    - Auto-increments on each commit/update
    - Is included in to_dict() output
    - Should be sent back by clients on updates for conflict detection

    Example usage:
        class Chemical(VersionedMixin, db.Model):
            __tablename__ = "chemicals"
            id = db.Column(db.Integer, primary_key=True)
            name = db.Column(db.String)

        # Creating a new record
        chemical = Chemical(name="Test")
        db.session.add(chemical)
        db.session.commit()
        print(chemical.version)  # 1

        # Updating a record
        chemical.name = "Updated"
        db.session.commit()
        print(chemical.version)  # 2

        # Conflict detection in route handler
        data = request.get_json()
        check_version(chemical, data.get("version"))
    """

    @declared_attr
    def version(cls):
        """
        Version column for optimistic locking.

        Uses declared_attr to ensure proper column inheritance in subclasses.
        """
        return Column(
            Integer,
            nullable=False,
            default=1,
            server_default="1",
            doc="Version number for optimistic locking. Auto-increments on update.",
        )

    def increment_version(self):
        """
        Manually increment the version number.

        This is called automatically before flush via SQLAlchemy events,
        but can be called manually if needed.
        """
        if self.version is None:
            self.version = 1
        else:
            self.version += 1

    def get_version(self) -> int:
        """Get the current version number."""
        return self.version or 1


def setup_versioned_mixin_events(db):
    """
    Set up SQLAlchemy events for automatic version incrementing.

    This function should be called after db is initialized to set up
    the automatic version increment behavior.

    Args:
        db: The SQLAlchemy database instance

    Example:
        from models_mixins import setup_versioned_mixin_events
        from models import db

        # In app initialization
        setup_versioned_mixin_events(db)
    """

    @event.listens_for(db.session, "before_flush")
    def increment_versions_before_flush(session, flush_context, instances):
        """
        Auto-increment version for all dirty VersionedMixin instances.

        This event fires before each flush, checking for modified objects
        that inherit from VersionedMixin and incrementing their version.
        """
        for obj in session.dirty:
            if isinstance(obj, VersionedMixin) and session.is_modified(obj, include_collections=False):
                # Only increment if actual attribute changes (not just relationship changes)
                obj.increment_version()


def add_version_to_dict(to_dict_func):
    """
    Decorator to add version field to a model's to_dict method.

    This decorator wraps an existing to_dict method to automatically
    include the version field if the model has one.

    Example:
        class Chemical(VersionedMixin, db.Model):
            @add_version_to_dict
            def to_dict(self):
                return {
                    "id": self.id,
                    "name": self.name,
                }
                # version will be added automatically
    """

    def wrapper(self):
        result = to_dict_func(self)
        if hasattr(self, "version"):
            result["version"] = self.version
        return result

    return wrapper
