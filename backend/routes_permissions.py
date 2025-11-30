"""
Permission Management Routes for SupplyLine MRO Suite

This module provides API endpoints for managing permissions, including:
- Listing all permissions (grouped by category)
- Managing user-specific permission grants/denies
- Getting effective permissions for users
"""

from flask import jsonify, request

from auth import admin_required, jwt_required, permission_required
from models import AuditLog, Permission, User, UserPermission, db


def register_permission_routes(app):
    """Register all permission-related routes with the Flask app"""

    # ==================== Permission Listing ====================

    @app.route("/api/permissions", methods=["GET"])
    @permission_required("role.manage")
    def get_all_permissions():
        """Get all permissions, optionally grouped by category"""
        group_by_category = request.args.get("grouped", "false").lower() == "true"

        permissions = Permission.query.order_by(Permission.category, Permission.name).all()

        if group_by_category:
            categories = {}
            for permission in permissions:
                category = permission.category or "Uncategorized"
                if category not in categories:
                    categories[category] = []
                categories[category].append(permission.to_dict())
            return jsonify(categories)

        return jsonify([p.to_dict() for p in permissions])

    @app.route("/api/permissions/categories", methods=["GET"])
    @permission_required("role.manage")
    def get_permission_categories():
        """Get all permission categories with their permissions"""
        permissions = Permission.query.order_by(Permission.category, Permission.name).all()

        categories = {}
        for permission in permissions:
            category = permission.category or "Uncategorized"
            if category not in categories:
                categories[category] = {
                    "name": category,
                    "permissions": [],
                    "count": 0
                }
            categories[category]["permissions"].append(permission.to_dict())
            categories[category]["count"] += 1

        return jsonify(list(categories.values()))

    # ==================== User Permission Management ====================

    @app.route("/api/users/<int:user_id>/permissions", methods=["GET"])
    @permission_required("user.view")
    def get_user_permissions(user_id):
        """
        Get a user's permissions including:
        - Effective permissions (combined role + user-specific)
        - Role-based permissions
        - User-specific grants/denies
        """
        user = User.query.get_or_404(user_id)

        return jsonify({
            "user_id": user.id,
            "user_name": user.name,
            "is_admin": user.is_admin,
            "effective_permissions": user.get_effective_permissions(),
            "role_permissions": user.get_permissions(),
            "user_specific_permissions": user.get_user_specific_permissions(),
            "roles": [role.to_dict() for role in user.roles]
        })

    @app.route("/api/users/<int:user_id>/permissions", methods=["POST"])
    @permission_required("user.manage")
    def add_user_permission(user_id):
        """
        Grant or deny a specific permission to a user.

        Request body:
        {
            "permission_id": 1,          // Required: ID of the permission
            "grant_type": "grant",       // Required: 'grant' or 'deny'
            "reason": "Special access",  // Optional: Reason for the grant/deny
            "expires_at": "2024-12-31"   // Optional: Expiration date (ISO format)
        }
        """
        user = User.query.get_or_404(user_id)
        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")

        # Validate required fields
        if not data.get("permission_id"):
            return jsonify({"error": "permission_id is required"}), 400

        if not data.get("grant_type") or data["grant_type"] not in ["grant", "deny"]:
            return jsonify({"error": "grant_type must be 'grant' or 'deny'"}), 400

        # Check if permission exists
        permission = db.session.get(Permission, data["permission_id"])
        if not permission:
            return jsonify({"error": "Permission not found"}), 404

        # Cannot modify admin's permissions (they have all permissions by default)
        if user.is_admin:
            return jsonify({"error": "Cannot modify permissions for admin users"}), 400

        # Parse expiration date if provided
        expires_at = None
        if data.get("expires_at"):
            from datetime import datetime
            try:
                expires_at = datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
            except ValueError:
                return jsonify({"error": "Invalid expires_at format. Use ISO format."}), 400

        # Check if user already has this specific permission override
        existing = UserPermission.query.filter_by(
            user_id=user.id,
            permission_id=permission.id
        ).first()

        if existing:
            # Update existing permission
            existing.grant_type = data["grant_type"]
            existing.reason = data.get("reason")
            existing.expires_at = expires_at
            existing.granted_by = current_user_id
            action = "update_user_permission"
        else:
            # Create new permission
            user_permission = UserPermission(
                user_id=user.id,
                permission_id=permission.id,
                grant_type=data["grant_type"],
                granted_by=current_user_id,
                reason=data.get("reason"),
                expires_at=expires_at
            )
            db.session.add(user_permission)
            action = "add_user_permission"

        # Log the action
        AuditLog.log(
            user_id=current_user_id,
            action=action,
            resource_type="user_permission",
            resource_id=user.id,
            details={
                "target_user_id": user.id,
                "target_user_name": user.name,
                "permission_id": permission.id,
                "permission_name": permission.name,
                "grant_type": data["grant_type"],
                "reason": data.get("reason"),
                "expires_at": data.get("expires_at")
            },
            ip_address=request.remote_addr
        )

        db.session.commit()

        return jsonify({
            "message": f"Permission {data['grant_type']}ed successfully",
            "effective_permissions": user.get_effective_permissions()
        }), 201

    @app.route("/api/users/<int:user_id>/permissions/<int:permission_id>", methods=["DELETE"])
    @permission_required("user.manage")
    def remove_user_permission(user_id, permission_id):
        """Remove a user-specific permission grant/deny"""
        user = User.query.get_or_404(user_id)
        current_user_id = request.current_user.get("user_id")

        # Find the user permission
        user_permission = UserPermission.query.filter_by(
            user_id=user.id,
            permission_id=permission_id
        ).first()

        if not user_permission:
            return jsonify({"error": "User permission not found"}), 404

        # Get permission name for logging
        permission = db.session.get(Permission, permission_id)
        permission_name = permission.name if permission else "Unknown"

        # Log the action
        AuditLog.log(
            user_id=current_user_id,
            action="remove_user_permission",
            resource_type="user_permission",
            resource_id=user.id,
            details={
                "target_user_id": user.id,
                "target_user_name": user.name,
                "permission_id": permission_id,
                "permission_name": permission_name,
                "previous_grant_type": user_permission.grant_type
            },
            ip_address=request.remote_addr
        )

        db.session.delete(user_permission)
        db.session.commit()

        return jsonify({
            "message": "User permission removed successfully",
            "effective_permissions": user.get_effective_permissions()
        })

    @app.route("/api/users/<int:user_id>/permissions/bulk", methods=["POST"])
    @permission_required("user.manage")
    def bulk_update_user_permissions(user_id):
        """
        Bulk update user-specific permissions.

        Request body:
        {
            "permissions": [
                {"permission_id": 1, "grant_type": "grant", "reason": "..."},
                {"permission_id": 2, "grant_type": "deny", "reason": "..."},
            ],
            "replace": false  // If true, removes all existing user permissions first
        }
        """
        user = User.query.get_or_404(user_id)
        data = request.get_json() or {}
        current_user_id = request.current_user.get("user_id")

        if not data.get("permissions") or not isinstance(data["permissions"], list):
            return jsonify({"error": "permissions array is required"}), 400

        # Cannot modify admin's permissions
        if user.is_admin:
            return jsonify({"error": "Cannot modify permissions for admin users"}), 400

        # If replace mode, remove all existing user permissions
        if data.get("replace", False):
            UserPermission.query.filter_by(user_id=user.id).delete()

        added = 0
        updated = 0
        errors = []

        for perm_data in data["permissions"]:
            permission_id = perm_data.get("permission_id")
            grant_type = perm_data.get("grant_type")

            if not permission_id or grant_type not in ["grant", "deny"]:
                errors.append(f"Invalid permission entry: {perm_data}")
                continue

            permission = db.session.get(Permission, permission_id)
            if not permission:
                errors.append(f"Permission {permission_id} not found")
                continue

            # Parse expiration date if provided
            expires_at = None
            if perm_data.get("expires_at"):
                from datetime import datetime
                try:
                    expires_at = datetime.fromisoformat(perm_data["expires_at"].replace("Z", "+00:00"))
                except ValueError:
                    errors.append(f"Invalid expires_at for permission {permission_id}")
                    continue

            existing = UserPermission.query.filter_by(
                user_id=user.id,
                permission_id=permission.id
            ).first()

            if existing:
                existing.grant_type = grant_type
                existing.reason = perm_data.get("reason")
                existing.expires_at = expires_at
                existing.granted_by = current_user_id
                updated += 1
            else:
                user_permission = UserPermission(
                    user_id=user.id,
                    permission_id=permission.id,
                    grant_type=grant_type,
                    granted_by=current_user_id,
                    reason=perm_data.get("reason"),
                    expires_at=expires_at
                )
                db.session.add(user_permission)
                added += 1

        # Log the action
        AuditLog.log(
            user_id=current_user_id,
            action="bulk_update_user_permissions",
            resource_type="user_permission",
            resource_id=user.id,
            details={
                "target_user_id": user.id,
                "target_user_name": user.name,
                "added": added,
                "updated": updated,
                "replace_mode": data.get("replace", False),
                "errors": errors if errors else None
            },
            ip_address=request.remote_addr
        )

        db.session.commit()

        return jsonify({
            "message": "Permissions updated successfully",
            "added": added,
            "updated": updated,
            "errors": errors if errors else None,
            "effective_permissions": user.get_effective_permissions()
        })

    # ==================== Current User Permissions ====================

    @app.route("/api/auth/my-permissions", methods=["GET"])
    @jwt_required
    def get_my_permissions():
        """Get current user's effective permissions"""
        user = db.session.get(User, request.current_user["user_id"])
        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "user_id": user.id,
            "is_admin": user.is_admin,
            "permissions": user.get_effective_permissions(),
            "roles": [role.to_dict() for role in user.roles]
        })

    # ==================== Permission Search ====================

    @app.route("/api/permissions/search", methods=["GET"])
    @permission_required("role.manage")
    def search_permissions():
        """Search permissions by name, description, or category"""
        query = request.args.get("q", "").strip()
        category = request.args.get("category", "").strip()

        permissions_query = Permission.query

        if query:
            search_term = f"%{query}%"
            permissions_query = permissions_query.filter(
                db.or_(
                    Permission.name.ilike(search_term),
                    Permission.description.ilike(search_term)
                )
            )

        if category:
            permissions_query = permissions_query.filter(Permission.category == category)

        permissions = permissions_query.order_by(Permission.category, Permission.name).all()

        return jsonify([p.to_dict() for p in permissions])

    # ==================== Permission Matrix ====================

    @app.route("/api/permissions/matrix", methods=["GET"])
    @admin_required
    def get_permission_matrix():
        """
        Get a matrix of all roles and their permissions.
        Useful for the permission overview dashboard.
        """
        from models import Role, RolePermission

        roles = Role.query.order_by(Role.name).all()
        permissions = Permission.query.order_by(Permission.category, Permission.name).all()

        # Build the matrix
        matrix = {
            "roles": [role.to_dict() for role in roles],
            "permissions": [p.to_dict() for p in permissions],
            "assignments": {}
        }

        # Get all role-permission assignments
        for role in roles:
            role_perm_ids = [rp.permission_id for rp in role.role_permissions]
            matrix["assignments"][role.id] = role_perm_ids

        return jsonify(matrix)

    return app
