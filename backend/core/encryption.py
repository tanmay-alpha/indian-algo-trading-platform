"""Encryption helpers for secrets at rest.

Uses Fernet (AES-128-CBC + HMAC-SHA256) with a key derived from
JWT_SECRET_KEY via HKDF-SHA256. The same JWT secret is used because
operators already need to set it; this avoids requiring a second
secret while still giving the TOTP secret a domain-separated key.
"""
import base64
import hashlib
import hmac
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_FERNET_KEY: Optional[bytes] = None
_FERNET_INSTANCE = None


def _derive_fernet_key(jwt_secret: str) -> bytes:
    """Derive a 32-byte Fernet-compatible key from the JWT secret using HKDF."""
    # 32 bytes of zero salt (the JWT secret is the high-entropy input).
    # HKDF-Expand produces 32 bytes (Fernet needs exactly 32-byte url-safe-b64).
    derived = hkdf_sha256(
        ikm=jwt_secret.encode("utf-8"),
        salt=b"\x00" * 32,
        info=b"maet-totp-secret-encryption-v1",
        length=32,
    )
    return base64.urlsafe_b64encode(derived)


def hkdf_sha256(ikm: bytes, salt: bytes, info: bytes, length: int) -> bytes:
    """Minimal HKDF-SHA256 implementation (RFC 5869)."""
    # Extract
    if len(salt) == 0:
        salt = b"\x00" * 32
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    # Expand
    okm = b""
    t = b""
    counter = 0
    while len(okm) < length:
        counter += 1
        t = hmac.new(prk, t + info + bytes([counter]), hashlib.sha256).digest()
        okm += t
    return okm[:length]


def _get_fernet():
    """Lazily construct a Fernet instance from the configured JWT secret.
    Returns None if the JWT secret is not configured.
    """
    global _FERNET_KEY, _FERNET_INSTANCE
    if _FERNET_INSTANCE is not None:
        return _FERNET_INSTANCE

    from backend.core.config import settings

    if not settings.jwt_secret_key:
        # No key material available — return None. The caller must handle
        # this case (e.g., skip encryption and log a warning).
        return None

    try:
        from cryptography.fernet import Fernet
    except ImportError:
        logger.warning(
            "cryptography not installed — TOTP secret encryption disabled. "
            "Install `cryptography` to enable at-rest encryption."
        )
        return None

    _FERNET_KEY = _derive_fernet_key(settings.jwt_secret_key)
    _FERNET_INSTANCE = Fernet(_FERNET_KEY)
    return _FERNET_INSTANCE


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a secret string for storage. Returns a Fernet token (str).
    Falls back to returning the plaintext with a "plain:" prefix if encryption
    is unavailable — the caller should check for this prefix and warn.
    """
    if plaintext is None:
        return None
    f = _get_fernet()
    if f is None:
        return f"plain:{plaintext}"
    return f.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    """Decrypt a secret string. If stored with the "plain:" prefix (legacy),
    strip the prefix and return the raw value.
    """
    if token is None or token == "":
        return token
    if token.startswith("plain:"):
        return token[len("plain:"):]
    f = _get_fernet()
    if f is None:
        # No key available — return the raw bytes. TOTP will still work
        # because pyotp only needs a base32 string.
        return token.encode("ascii") if isinstance(token, str) else token
    try:
        return f.decrypt(token.encode("ascii")).decode("utf-8")
    except Exception:
        # If decryption fails (e.g., key rotated), return raw value.
        # The TOTP verify path will fail gracefully.
        return token
