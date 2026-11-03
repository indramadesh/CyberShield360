"""Encryption at rest for OAuth tokens and PKCE verifiers, and hashing for
one-time codes and device tokens."""
from __future__ import annotations

import base64
import hashlib
import secrets

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    key = settings.token_encryption_key
    if not key:
        # Development fallback: a key derived from SECRET_KEY (domain-separated).
        digest = hashlib.sha256(b"cybershield-token-encryption:" + settings.secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(value: str | None) -> str | None:
    return None if value is None else _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return None  # key changed: treat as missing so the user reconnects


def token_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_device_token() -> str:
    return "csd_" + secrets.token_urlsafe(32)


def new_pairing_code() -> str:
    # 8 characters from an unambiguous alphabet, shown as XXXX-XXXX.
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    raw = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def normalize_code(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch.isalnum())
