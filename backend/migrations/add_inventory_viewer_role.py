"""
Migration: Add Inventory Viewer Role
Date: 2026-04-19
Purpose: Add a view-only role for tooling and chemicals so certain users can
         see inventory without being able to create, edit, or delete records.
"""

import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

os.environ.setdefault("FLASK_ENV", "testing")
if not os.environ.get("SECRET_KEY"):
    os.environ["SECRET_KEY"] = secrets.token_urlsafe(64)
if not os.environ.get("JWT_SECRET_KEY"):
    os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(64)

from app import create_app  # noqa: E402
from models import db, Permission, Role, RolePermission  # noqa: E402


# Permissions that the Inventory Viewer role receives
VIEWER_PERMISSIONS = [
    "tool.view",
    "chemical.view",
    "page.tools",
    "page.chemicals",
    "page.profile",
]

ROLE_NAME = "Inventory Viewer"
ROLE_DESCRIPTION = "Read-only access to tooling and chemicals inventory"


def run_migration():
    app = create_app()

    with app.app_context():
        print("Starting Inventory Viewer role migration...")

        # 1. Create the role if it doesn't already exist
        role = Role.query.filter_by(name=ROLE_NAME).first()
        if role:
            print(f"  Role '{ROLE_NAME}' already exists (id={role.id}), skipping creation.")
        else:
            role = Role(
                name=ROLE_NAME,
                description=ROLE_DESCRIPTION,
                is_system_role=True,
            )
            db.session.add(role)
            db.session.flush()  # get the id before commit
            print(f"  Created role '{ROLE_NAME}' (id={role.id})")

        # 2. Assign permissions
        print("\nAssigning permissions to Inventory Viewer role...")
        assigned = 0
        missing = []

        for perm_name in VIEWER_PERMISSIONS:
            permission = Permission.query.filter_by(name=perm_name).first()
            if not permission:
                missing.append(perm_name)
                print(f"  WARNING: Permission '{perm_name}' not found, skipping.")
                continue

            existing = RolePermission.query.filter_by(
                role_id=role.id,
                permission_id=permission.id,
            ).first()

            if existing:
                print(f"  Permission '{perm_name}' already assigned, skipping.")
            else:
                rp = RolePermission(role_id=role.id, permission_id=permission.id)
                db.session.add(rp)
                print(f"  Assigned: {perm_name}")
                assigned += 1

        db.session.commit()

        print(f"\nAssigned {assigned} permission(s) to '{ROLE_NAME}'.")
        if missing:
            print(f"WARNING: {len(missing)} permission(s) not found: {missing}")
            print("  Run the RBAC and page-access migrations first if needed.")

        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"Role:        {ROLE_NAME}")
        print(f"Description: {ROLE_DESCRIPTION}")
        print(f"Permissions: {', '.join(VIEWER_PERMISSIONS)}")
        print("\nUsers assigned this role can:")
        print("  - View the Tools page and all tool details")
        print("  - View the Chemicals page and all chemical details")
        print("  - NOT create, edit, or delete tools or chemicals")
        print("=" * 60)


if __name__ == "__main__":
    run_migration()
