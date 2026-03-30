"""
Encryption utilities for sensitive data.

This module provides Fernet symmetric encryption for sensitive fields like TOTP secrets.
The encryption key is derived from the Flask SECRET_KEY to ensure consistency across restarts.
"""

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken


logger = logging.getLogger(__name__)


class EncryptionManager:
    """Manages encryption/decryption of sensitive data using Fernet."""

    _fernet = None

    @classmethod
    def _get_fernet(cls) -> Fernet:
        """Get or create the Fernet instance using the application's SECRET_KEY."""
        if cls._fernet is None:
            # Get the secret key from environment or Flask config
            # In production, this should be set via environment variable
            secret_key = os.environ.get("SECRET_KEY")

            if not secret_key:
                # In production, refuse to start with no key
                flask_env = os.environ.get("FLASK_ENV", "")
                if flask_env == "production":
                    raise RuntimeError(
                        "SECRET_KEY must be set in production environment. "
                        "Set SECRET_KEY environment variable."
                    )
                # Fallback for development/testing only
                logger.warning(
                    "SECRET_KEY not set in environment. Using insecure fallback. "
                    "Set SECRET_KEY environment variable for production!"
                )
                secret_key = "dev-secret-key-CHANGE-IN-PRODUCTION"

            # Derive a 32-byte Fernet key from the secret key using SHA-256
            # Fernet requires a URL-safe base64-encoded 32-byte key
            key_bytes = hashlib.sha256(secret_key.encode()).digest()
            fernet_key = base64.urlsafe_b64encode(key_bytes)

            cls._fernet = Fernet(fernet_key)

        return cls._fernet

    @classmethod
    def encrypt(cls, plaintext: str) -> str:
        """
        Encrypt a plaintext string.

        Args:
            plaintext: The string to encrypt

        Returns:
            Base64-encoded encrypted string

        Raises:
            ValueError: If plaintext is None or empty
        """
        if not plaintext:
            msg = "Cannot encrypt None or empty string"
            raise ValueError(msg)

        try:
            fernet = cls._get_fernet()
            encrypted_bytes = fernet.encrypt(plaintext.encode())
            return encrypted_bytes.decode()
        except Exception:
            logger.exception("Failed to encrypt data")
            raise

    @classmethod
    def decrypt(cls, ciphertext: str) -> str:
        """
        Decrypt an encrypted string.

        Args:
            ciphertext: The base64-encoded encrypted string

        Returns:
            Decrypted plaintext string

        Raises:
            ValueError: If ciphertext is None or empty
            InvalidToken: If decryption fails (wrong key or corrupted data)
        """
        if not ciphertext:
            msg = "Cannot decrypt None or empty string"
            raise ValueError(msg)

        try:
            fernet = cls._get_fernet()
            decrypted_bytes = fernet.decrypt(ciphertext.encode())
            return decrypted_bytes.decode()
        except InvalidToken:
            logger.exception("Failed to decrypt data - invalid token or wrong encryption key")
            raise
        except Exception:
            logger.exception("Failed to decrypt data")
            raise


# Convenience functions for direct use
def encrypt_totp_secret(secret: str) -> str:
    """
    Encrypt a TOTP secret for secure storage.

    Args:
        secret: The Base32-encoded TOTP secret

    Returns:
        Encrypted secret as base64 string
    """
    return EncryptionManager.encrypt(secret)


def decrypt_totp_secret(encrypted_secret: str) -> str:
    """
    Decrypt a TOTP secret.

    Args:
        encrypted_secret: The encrypted secret from database

    Returns:
        Decrypted Base32-encoded TOTP secret
    """
    return EncryptionManager.decrypt(encrypted_secret)
