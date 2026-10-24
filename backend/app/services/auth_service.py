"""Authentication business logic — depends only on repositories + core.security."""
from __future__ import annotations

import datetime as dt

import jwt
from sqlalchemy.orm import Session

from app.core.enums import Role
from app.core.errors import AuthError, ValidationAppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.repositories.user_repository import RefreshTokenRepository, UserRepository


class AuthService:
    def __init__(self, session: Session):
        self.session = session
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)

    def register(self, *, email: str, password: str):
        if self.users.get_by_email(email):
            raise ValidationAppError("An account with this email already exists.")
        user = self.users.create(
            email=email, password_hash=hash_password(password), role=Role.USER.value
        )
        self.session.commit()
        return user

    def authenticate(self, *, email: str, password: str):
        user = self.users.get_by_email(email)
        # Constant-ish response: verify even on missing user to reduce enumeration.
        if not user or not verify_password(password, user.password_hash):
            raise AuthError("Invalid email or password.")
        if not user.is_active:
            raise AuthError("This account is inactive.")
        return user

    def issue_tokens(self, user) -> dict:
        access = create_access_token(subject=user.id, role=user.role)
        raw_refresh, token_hash, expires = create_refresh_token(subject=user.id)
        self.tokens.create(user_id=user.id, token_hash=token_hash, expires_at=expires)
        self.session.commit()
        return {"access_token": access, "refresh_token": raw_refresh}

    def refresh(self, raw_refresh: str) -> dict:
        try:
            payload = decode_token(raw_refresh)
        except jwt.PyJWTError:
            raise AuthError("Invalid or expired refresh token.")
        if payload.get("type") != "refresh":
            raise AuthError("Invalid token type.")
        stored = self.tokens.get_by_hash(hash_token(raw_refresh))
        if not stored or stored.revoked:
            raise AuthError("Refresh token is no longer valid.")
        # Some backends (e.g. SQLite) return naive datetimes; treat them as UTC.
        expires = stored.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=dt.timezone.utc)
        if expires < dt.datetime.now(dt.timezone.utc):
            raise AuthError("Refresh token has expired.")
        # Rotate: revoke the used token, issue a fresh pair.
        self.tokens.revoke(stored)
        user = self.users.get(payload["sub"])
        if not user:
            raise AuthError("Account not found.")
        return self.issue_tokens(user)

    def logout(self, raw_refresh: str) -> None:
        stored = self.tokens.get_by_hash(hash_token(raw_refresh))
        if stored and not stored.revoked:
            self.tokens.revoke(stored)
            self.session.commit()
