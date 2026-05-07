#!/usr/bin/env python3
"""
Script to set admin password to a specific value.

Usage:
    python set_admin_password.py <new_password>
    ADMIN_PASSWORD=<new_password> python set_admin_password.py
"""
import os
import sys


# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User


def set_admin_password(new_password):
    """Set admin password to a specific value"""
    with app.app_context():
        admin = User.query.filter_by(employee_number="ADMIN001").first()

        if not admin:
            print("❌ Admin user ADMIN001 not found!")
            return False

        # Set the new password
        admin.set_password(new_password)
        db.session.commit()

        print("✅ Admin password updated successfully!")
        print("   Employee Number: ADMIN001")

        # Verify it works
        if admin.check_password(new_password):
            print("\n✅ Password verified - login should work now!")
            return True
        print("\n❌ Password verification failed!")
        return False

if __name__ == "__main__":
    # Accept password from CLI arg or environment variable
    if len(sys.argv) > 1:
        new_password = sys.argv[1]
    elif os.environ.get("ADMIN_PASSWORD"):
        new_password = os.environ["ADMIN_PASSWORD"]
    else:
        print("Usage: python set_admin_password.py <new_password>")
        print("       ADMIN_PASSWORD=<new_password> python set_admin_password.py")
        sys.exit(1)

    print("=" * 60)
    print("Setting Admin Password")
    print("=" * 60)

    success = set_admin_password(new_password)
    sys.exit(0 if success else 1)
