#!/usr/bin/env python3
"""
Script to set admin password securely.

Password can be provided via:
1. Command line argument: python set_admin_password.py <password>
2. Environment variable: ADMIN_PASSWORD
3. If neither is provided, a secure random password is generated
"""
import os
import secrets
import string
import sys


# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User


def generate_secure_password(length: int = 16) -> str:
    """
    Generate a cryptographically secure random password.

    Args:
        length: Password length (default 16 characters)

    Returns:
        A secure random password containing uppercase, lowercase, digits, and special chars
    """
    # Define character sets
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()_+-="

    # Ensure at least one character from each required set
    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]

    # Fill the rest with random characters from all sets
    all_chars = uppercase + lowercase + digits + special
    password.extend(secrets.choice(all_chars) for _ in range(length - 4))

    # Shuffle the password to avoid predictable positions
    password_list = list(password)
    secrets.SystemRandom().shuffle(password_list)

    return "".join(password_list)


def get_password_from_args_or_env() -> tuple[str, bool]:
    """
    Get password from command line argument or environment variable.

    Returns:
        Tuple of (password, was_generated) where was_generated indicates
        if the password was auto-generated
    """
    # Check command line arguments first
    if len(sys.argv) > 1:
        return sys.argv[1], False

    # Check environment variable
    env_password = os.environ.get("ADMIN_PASSWORD")
    if env_password:
        return env_password, False

    # Generate a secure random password
    generated = generate_secure_password()
    return generated, True


def set_admin_password(new_password: str) -> bool:
    """Set admin password to the specified value."""
    with app.app_context():
        admin = User.query.filter_by(employee_number="ADMIN001").first()

        if not admin:
            print("ERROR: Admin user ADMIN001 not found!")
            return False

        # Set the new password
        admin.set_password(new_password)
        db.session.commit()

        print("Admin password updated successfully!")
        print("   Employee Number: ADMIN001")

        # Verify it works
        if admin.check_password(new_password):
            print("Password verified - login should work now!")
            return True
        print("ERROR: Password verification failed!")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Setting Admin Password")
    print("=" * 60)

    password, was_generated = get_password_from_args_or_env()

    if was_generated:
        print("\nNo password provided via argument or ADMIN_PASSWORD env var.")
        print("Generated a secure random password.\n")

    success = set_admin_password(password)

    if success:
        print("\n" + "=" * 60)
        print("You can now login with:")
        print("  Employee Number: ADMIN001")
        if was_generated:
            print(f"  Password: {password}")
            print("\nIMPORTANT: Save this password securely - it will not be shown again!")
        else:
            print("  Password: <the password you provided>")
        print("=" * 60)

    sys.exit(0 if success else 1)
