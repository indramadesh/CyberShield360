"""Shared FastAPI dependencies: DB session, current user, RBAC, feature gates."""
from __future__ import annotations

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.enums import Role
from app.core.errors import AuthError, FeatureDisabledError, ForbiddenError
from app.core.features import is_enabled
from app.core.security import decode_token
from app.db.models.user import User
from app.db.session import get_session
from app.repositories.user_repository import UserRepository


def db_session() -> Session:  # thin alias for clarity in signatures
    yield from get_session()


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(db_session),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("Authentication required.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise AuthError("Invalid or expired token.")
    if payload.get("type") != "access":
        raise AuthError("Invalid token type.")
    user = UserRepository(session).get(payload.get("sub", ""))
    if not user or not user.is_active:
        raise AuthError("Account not found or inactive.")
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(db_session),
) -> User | None:
    if not authorization:
        return None
    try:
        return get_current_user(authorization=authorization, session=session)
    except AuthError:
        return None


def require_role(*roles: Role):
    allowed = {r.value for r in roles}

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise ForbiddenError("You do not have access to this resource.")
        return user

    return _dep


def require_feature(feature: str):
    def _dep() -> None:
        if not is_enabled(feature):
            raise FeatureDisabledError("This feature is currently unavailable.")

    return _dep
