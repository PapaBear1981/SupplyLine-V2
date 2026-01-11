"""Migration script to encrypt existing plaintext TOTP secrets."""

import logging
import sys

from cryptography.fernet import InvalidToken
from sqlalchemy.exc import SQLAlchemyError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def encrypt_existing_secrets():
    """Encrypt all existing plaintext TOTP secrets in the database."""
    from models import User, db
    from utils.encryption import encrypt_totp_secret, decrypt_totp_secret

    # Get all users with TOTP secrets
    users_with_totp = User.query.filter(User.totp_secret.isnot(None)).all()

    if not users_with_totp:
        logger.info("No users with TOTP secrets found")
        return 0

    encrypted_count = 0
    already_encrypted_count = 0
    error_count = 0

    for user in users_with_totp:
        try:
            # Try to decrypt - if it works, it's already encrypted
            try:
                decrypt_totp_secret(user.totp_secret)
                logger.info(f"User {user.id} ({user.employee_number}) - TOTP secret already encrypted")
                already_encrypted_count += 1
                continue
            except (InvalidToken, Exception):
                # Not encrypted or corrupted - treat as plaintext and encrypt
                pass

            # At this point, we assume it's plaintext
            plaintext_secret = user.totp_secret
            logger.info(f"Encrypting TOTP secret for user {user.id} ({user.employee_number})")

            # Encrypt the plaintext secret
            encrypted_secret = encrypt_totp_secret(plaintext_secret)

            # Update the database directly (bypass the model method to avoid issues)
            user.totp_secret = encrypted_secret
            encrypted_count += 1

        except Exception as exc:
            logger.error(f"Error encrypting TOTP secret for user {user.id}: {exc}")
            error_count += 1
            continue

    # Commit all changes at once
    if encrypted_count > 0:
        try:
            db.session.commit()
            logger.info(f"Successfully encrypted {encrypted_count} TOTP secrets")
        except SQLAlchemyError as exc:
            logger.error(f"Failed to commit encrypted secrets: {exc}")
            db.session.rollback()
            return 0

    logger.info(f"Migration summary:")
    logger.info(f"  - Encrypted: {encrypted_count}")
    logger.info(f"  - Already encrypted: {already_encrypted_count}")
    logger.info(f"  - Errors: {error_count}")

    return encrypted_count


def run_migration():
    """Run the TOTP secret encryption migration."""
    return encrypt_existing_secrets()


def main():
    try:
        # Import here to avoid circular dependencies
        from app import create_app

        app = create_app()

        with app.app_context():
            logger.info("Running TOTP secret encryption migration")
            encrypted_count = run_migration()

            if encrypted_count > 0:
                logger.info(f"TOTP secret encryption migration completed: {encrypted_count} secrets encrypted")
            else:
                logger.info("TOTP secret encryption migration completed: no secrets needed encryption")

            return True

    except SQLAlchemyError as exc:
        logger.error("Database error during migration: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.error("Unexpected error during migration: %s", exc)

    return False


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
