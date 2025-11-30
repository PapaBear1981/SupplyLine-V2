"""
Migration script to add comprehensive permissions for all application features.
This adds permissions for kits, warehouses, orders, requests, messaging, and transfers.
"""
import os
import sqlite3
import sys


def run_migration():
    # Get the database path from DATABASE_URL environment variable or use default
    database_url = os.environ.get("DATABASE_URL", "sqlite:///database/tools.db")

    # Extract the path from the SQLite URL
    if database_url.startswith("sqlite:///"):
        db_path = database_url.replace("sqlite:///", "")
        if not os.path.isabs(db_path):
            repo_root = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            db_path = os.path.join(repo_root, db_path)
    else:
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "database",
            "tools.db",
        )

    print(f"Using database at: {db_path}")

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Define new permissions to add
        new_permissions = [
            # Kit Management
            ("kit.view", "View kit details and inventory", "Kit Management"),
            ("kit.create", "Create new kits", "Kit Management"),
            ("kit.edit", "Edit kit details and contents", "Kit Management"),
            ("kit.delete", "Delete kits", "Kit Management"),
            ("kit.issue", "Issue kits to users", "Kit Management"),
            ("kit.reorder", "Create and manage kit reorders", "Kit Management"),

            # Warehouse Management
            ("warehouse.view", "View warehouse details", "Warehouse Management"),
            ("warehouse.create", "Create new warehouses", "Warehouse Management"),
            ("warehouse.edit", "Edit warehouse details", "Warehouse Management"),
            ("warehouse.delete", "Delete warehouses", "Warehouse Management"),
            ("warehouse.transfer", "Transfer items between warehouses", "Warehouse Management"),
            ("warehouse.inventory", "Manage warehouse inventory", "Warehouse Management"),

            # Order Management
            ("order.view", "View orders", "Order Management"),
            ("order.create", "Create new orders", "Order Management"),
            ("order.edit", "Edit order details", "Order Management"),
            ("order.delete", "Delete orders", "Order Management"),
            ("order.approve", "Approve orders", "Order Management"),
            ("order.fulfill", "Fulfill orders", "Order Management"),
            ("order.cancel", "Cancel orders", "Order Management"),

            # Request Management
            ("request.view", "View requests", "Request Management"),
            ("request.create", "Create new requests", "Request Management"),
            ("request.edit", "Edit request details", "Request Management"),
            ("request.delete", "Delete requests", "Request Management"),
            ("request.approve", "Approve requests", "Request Management"),
            ("request.fulfill", "Fulfill requests", "Request Management"),
            ("request.reject", "Reject requests", "Request Management"),

            # Messaging & Channels
            ("channel.view", "View channels and messages", "Messaging"),
            ("channel.create", "Create new channels", "Messaging"),
            ("channel.edit", "Edit channel details", "Messaging"),
            ("channel.delete", "Delete channels", "Messaging"),
            ("channel.manage", "Manage channel members", "Messaging"),
            ("message.send", "Send messages", "Messaging"),
            ("message.delete", "Delete messages", "Messaging"),
            ("message.pin", "Pin messages", "Messaging"),

            # Transfer Management
            ("transfer.view", "View transfers", "Transfer Management"),
            ("transfer.create", "Create new transfers", "Transfer Management"),
            ("transfer.approve", "Approve transfers", "Transfer Management"),
            ("transfer.complete", "Complete transfers", "Transfer Management"),
            ("transfer.cancel", "Cancel transfers", "Transfer Management"),

            # Additional Page Access permissions
            ("page.settings", "Access Settings page", "Page Access"),
            ("page.messaging", "Access Messaging page", "Page Access"),
            ("page.transfers", "Access Transfers page", "Page Access"),
            ("page.users", "Access Users page", "Page Access"),
            ("page.departments", "Access Departments page", "Page Access"),

            # Announcement Management
            ("announcement.view", "View announcements", "Announcement Management"),
            ("announcement.create", "Create announcements", "Announcement Management"),
            ("announcement.edit", "Edit announcements", "Announcement Management"),
            ("announcement.delete", "Delete announcements", "Announcement Management"),

            # Audit & Security
            ("audit.view", "View audit logs", "Audit & Security"),
            ("audit.export", "Export audit logs", "Audit & Security"),
            ("security.settings", "Manage security settings", "Audit & Security"),
            ("security.sessions", "Manage user sessions", "Audit & Security"),

            # Aircraft Type Management
            ("aircraft.view", "View aircraft types", "Aircraft Management"),
            ("aircraft.create", "Create aircraft types", "Aircraft Management"),
            ("aircraft.edit", "Edit aircraft types", "Aircraft Management"),
            ("aircraft.delete", "Delete aircraft types", "Aircraft Management"),
        ]

        # Insert new permissions, skipping if they already exist
        permissions_added = 0
        permissions_skipped = 0

        for name, description, category in new_permissions:
            cursor.execute("SELECT id FROM permissions WHERE name = ?", (name,))
            if cursor.fetchone():
                permissions_skipped += 1
            else:
                cursor.execute(
                    "INSERT INTO permissions (name, description, category) VALUES (?, ?, ?)",
                    (name, description, category),
                )
                permissions_added += 1

        print(f"Added {permissions_added} new permissions, skipped {permissions_skipped} existing")

        # Grant all new permissions to Administrator role
        cursor.execute("SELECT id FROM roles WHERE name = 'Administrator'")
        admin_role = cursor.fetchone()
        if admin_role:
            admin_role_id = admin_role[0]
            # Get all permission IDs
            cursor.execute("SELECT id FROM permissions")
            all_permission_ids = [row[0] for row in cursor.fetchall()]

            # Add any missing permissions to admin role
            admin_perms_added = 0
            for perm_id in all_permission_ids:
                cursor.execute(
                    "SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?",
                    (admin_role_id, perm_id),
                )
                if not cursor.fetchone():
                    cursor.execute(
                        "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                        (admin_role_id, perm_id),
                    )
                    admin_perms_added += 1
            print(f"Added {admin_perms_added} permissions to Administrator role")

        # Grant relevant permissions to Materials Manager role
        cursor.execute("SELECT id FROM roles WHERE name = 'Materials Manager'")
        materials_role = cursor.fetchone()
        if materials_role:
            materials_role_id = materials_role[0]
            materials_perms = [
                # Kit permissions
                "kit.view", "kit.create", "kit.edit", "kit.delete", "kit.issue", "kit.reorder",
                # Warehouse permissions
                "warehouse.view", "warehouse.edit", "warehouse.inventory", "warehouse.transfer",
                # Order permissions
                "order.view", "order.create", "order.edit", "order.approve", "order.fulfill",
                # Request permissions
                "request.view", "request.approve", "request.fulfill",
                # Transfer permissions
                "transfer.view", "transfer.create", "transfer.approve", "transfer.complete",
                # Page access
                "page.transfers",
                # Messaging
                "channel.view", "channel.create", "message.send",
            ]

            materials_perms_added = 0
            for perm_name in materials_perms:
                cursor.execute("SELECT id FROM permissions WHERE name = ?", (perm_name,))
                perm_row = cursor.fetchone()
                if perm_row:
                    perm_id = perm_row[0]
                    cursor.execute(
                        "SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?",
                        (materials_role_id, perm_id),
                    )
                    if not cursor.fetchone():
                        cursor.execute(
                            "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                            (materials_role_id, perm_id),
                        )
                        materials_perms_added += 1
            print(f"Added {materials_perms_added} permissions to Materials Manager role")

        # Grant relevant permissions to Maintenance User role
        cursor.execute("SELECT id FROM roles WHERE name = 'Maintenance User'")
        maintenance_role = cursor.fetchone()
        if maintenance_role:
            maintenance_role_id = maintenance_role[0]
            maintenance_perms = [
                # Kit permissions (view only)
                "kit.view",
                # Warehouse permissions (view only)
                "warehouse.view",
                # Request permissions (create and view own)
                "request.view", "request.create",
                # Messaging
                "channel.view", "message.send",
                # Announcements
                "announcement.view",
            ]

            maintenance_perms_added = 0
            for perm_name in maintenance_perms:
                cursor.execute("SELECT id FROM permissions WHERE name = ?", (perm_name,))
                perm_row = cursor.fetchone()
                if perm_row:
                    perm_id = perm_row[0]
                    cursor.execute(
                        "SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?",
                        (maintenance_role_id, perm_id),
                    )
                    if not cursor.fetchone():
                        cursor.execute(
                            "INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
                            (maintenance_role_id, perm_id),
                        )
                        maintenance_perms_added += 1
            print(f"Added {maintenance_perms_added} permissions to Maintenance User role")

        conn.commit()
        print("Schema changes committed successfully")
        conn.close()
        print("Database update completed successfully")
        return True
    except Exception as e:
        print(f"Error during migration: {e!s}")
        return False


if __name__ == "__main__":
    success = run_migration()
    if not success:
        sys.exit(1)
