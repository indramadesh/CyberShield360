"""Password hashing and JWT issuance/verification."""
from __future__ import annotations

import datetime as dt
import hashlib
import uuid

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Argon2 preferred; bcrypt kept for verifying legacy hashes if ever needed.
_pwd = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _pwd.verify(password, password_hash)
    except Exception:
        return False


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def create_access_token(*, subject: str, role: str) -> str:
    now = _now()
    payload = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(minutes=settings.access_token_ttl_minutes)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(*, subject: str) -> tuple[str, str, dt.datetime]:
    """Return (raw_token, token_hash, expires_at). Only the hash is stored."""
    now = _now()
    expires = now + dt.timedelta(days=settings.refresh_token_ttl_days)
    payload = {
        "sub": subject,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "jti": uuid.uuid4().hex,
    }
    raw = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return raw, hash_token(raw), expires


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def decode_token(token: str) -> dict:
    """Decode & verify a JWT. Raises jwt.PyJWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
