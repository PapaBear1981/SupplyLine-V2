"""
Seed the Permission table with the full standard permission catalogue.

Uses SQLAlchemy so it works against any SQLAlchemy-supported database
(SQLite, PostgreSQL, etc.) — unlike the SQLite-specific scripts under
backend/migrations/.

Run from the Render Shell:
    cd /app && python seed_permissions.py

Idempotent: existing permissions with the same name are skipped.
"""
import os
import sys


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from models import Permission, db


PERMISSIONS: list[tuple[str, str, str]] = [
    # --- Kit Management ---
    ("kit.view", "View kit details and inventory", "Kit Management"),
    ("kit.create", "Create new kits", "Kit Management"),
    ("kit.edit", "Edit kit details and contents", "Kit Management"),
    ("kit.delete", "Delete kits", "Kit Management"),
    ("kit.issue", "Issue kits to users", "Kit Management"),
    ("kit.reorder", "Create and manage kit reorders", "Kit Management"),

    # --- Warehouse Management ---
    ("warehouse.view", "View warehouse details", "Warehouse Management"),
    ("warehouse.create", "Create new warehouses", "Warehouse Management"),
    ("warehouse.edit", "Edit warehouse details", "Warehouse Management"),
    ("warehouse.delete", "Delete warehouses", "Warehouse Management"),
    ("warehouse.transfer", "Transfer items between warehouses", "Warehouse Management"),
    ("warehouse.inventory", "Manage warehouse inventory", "Warehouse Management"),
    ("warehouse.switch_active", "Change the user's active warehouse", "Warehouse Management"),

    # --- Tool / Checkout ---
    ("checkout.view", "View tool checkouts", "Checkouts"),
    ("checkout.create", "Check tools out to users", "Checkouts"),
    ("checkout.return", "Return checked-out tools", "Checkouts"),

    # --- Order Management ---
    ("order.view", "View orders", "Order Management"),
    ("order.create", "Create new orders", "Order Management"),
    ("order.edit", "Edit order details", "Order Management"),
    ("order.delete", "Delete orders", "Order Management"),
    ("order.approve", "Approve orders", "Order Management"),
    ("order.fulfill", "Fulfill orders", "Order Management"),
    ("order.cancel", "Cancel orders", "Order Management"),

    # --- Request Management ---
    ("request.view", "View requests", "Request Management"),
    ("request.create", "Create new requests", "Request Management"),
    ("request.edit", "Edit request details", "Request Management"),
    ("request.delete", "Delete requests", "Request Management"),
    ("request.approve", "Approve requests", "Request Management"),
    ("request.fulfill", "Fulfill requests", "Request Management"),
    ("request.reject", "Reject requests", "Request Management"),

    # --- Messaging ---
    ("channel.view", "View channels and messages", "Messaging"),
    ("channel.create", "Create new channels", "Messaging"),
    ("channel.edit", "Edit channel details", "Messaging"),
    ("channel.delete", "Delete channels", "Messaging"),
    ("channel.manage", "Manage channel members", "Messaging"),
    ("message.send", "Send messages", "Messaging"),
    ("message.delete", "Delete messages", "Messaging"),
    ("message.pin", "Pin messages", "Messaging"),

    # --- Transfer Management ---
    ("transfer.view", "View transfers", "Transfer Management"),
    ("transfer.create", "Create new transfers", "Transfer Management"),
    ("transfer.approve", "Approve transfers", "Transfer Management"),
    ("transfer.complete", "Complete transfers", "Transfer Management"),
    ("transfer.cancel", "Cancel transfers (admin)", "Transfer Management"),
    ("transfer.initiate", "Initiate warehouse-to-warehouse transfers", "Transfer Management"),
    ("transfer.receive", "Receive transfers and assign destination location", "Transfer Management"),
    ("transfer.cancel_own", "Cancel transfers the user initiated", "Transfer Management"),

    # --- Announcements ---
    ("announcement.view", "View announcements", "Announcement Management"),
    ("announcement.create", "Create announcements", "Announcement Management"),
    ("announcement.edit", "Edit announcements", "Announcement Management"),
    ("announcement.delete", "Delete announcements", "Announcement Management"),

    # --- Audit & Security ---
    ("audit.view", "View audit logs", "Audit & Security"),
    ("audit.export", "Export audit logs", "Audit & Security"),
    ("security.settings", "Manage security settings", "Audit & Security"),
    ("security.sessions", "Manage user sessions", "Audit & Security"),

    # --- Aircraft Types ---
    ("aircraft.view", "View aircraft types", "Aircraft Management"),
    ("aircraft.create", "Create aircraft types", "Aircraft Management"),
    ("aircraft.edit", "Edit aircraft types", "Aircraft Management"),
    ("aircraft.delete", "Delete aircraft types", "Aircraft Management"),

    # --- User / Department / Role management ---
    ("user.view", "View users", "User Management"),
    ("user.edit", "Edit users", "User Management"),
    ("user.manage", "Create and delete users", "User Management"),
    ("role.manage", "Create, edit, and assign roles", "User Management"),
    ("department.create", "Create departments", "User Management"),
    ("department.update", "Edit departments", "User Management"),
    ("department.delete", "Delete departments", "User Management"),
    ("department.hard_delete", "Permanently delete departments", "User Management"),
    ("system.settings", "Manage system settings", "User Management"),

    # --- Reports ---
    ("report.tools", "View tool reports", "Reports"),
    ("report.export", "Export reports", "Reports"),

    # --- Page Access (controls sidebar / route visibility) ---
    ("page.tools", "Access Tools page", "Page Access"),
    ("page.checkouts", "Access Checkouts page", "Page Access"),
    ("page.my_checkouts", "Access My Checkouts page", "Page Access"),
    ("page.kits", "Access Kits page", "Page Access"),
    ("page.chemicals", "Access Chemicals page", "Page Access"),
    ("page.calibrations", "Access Calibrations page", "Page Access"),
    ("page.reports", "Access Reports page", "Page Access"),
    ("page.scanner", "Access Scanner page", "Page Access"),
    ("page.warehouses", "Access Warehouses page", "Page Access"),
    ("page.admin_dashboard", "Access Admin Dashboard", "Page Access"),
    ("page.aircraft_types", "Access Aircraft Types Management", "Page Access"),
    ("page.profile", "Access Profile page", "Page Access"),
    ("page.settings", "Access Settings page", "Page Access"),
    ("page.messaging", "Access Messaging page", "Page Access"),
    ("page.transfers", "Access Transfers page", "Page Access"),
    ("page.users", "Access Users page", "Page Access"),
    ("page.departments", "Access Departments page", "Page Access"),
    ("page.orders", "Access Orders page", "Page Access"),
    ("page.requests", "Access Requests page", "Page Access"),
]


def run():
    app = create_app()
    with app.app_context():
        existing = {p.name: p for p in Permission.query.all()}
        created = 0
        updated = 0
        for name, description, category in PERMISSIONS:
            if name in existing:
                perm = existing[name]
                if perm.description != description or perm.category != category:
                    perm.description = description
                    perm.category = category
                    updated += 1
                continue
            db.session.add(Permission(name=name, description=description, category=category))
            created += 1
        db.session.commit()
        print(f"Seed complete: {created} created, {updated} updated, {len(existing) - updated} unchanged.")


if __name__ == "__main__":
    run()
