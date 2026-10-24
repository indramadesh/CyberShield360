from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user
from app.db.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserOut,
)
from app.schemas.common import ok
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(body: RegisterRequest, request: Request, session: Session = Depends(db_session)):
    svc = AuthService(session)
    user = svc.register(email=body.email, password=body.password)
    return ok(UserOut(id=user.id, email=user.email, role=user.role,
                      is_verified=user.is_verified).model_dump(),
              getattr(request.state, "request_id", None))


@router.post("/login")
def login(body: LoginRequest, request: Request, session: Session = Depends(db_session)):
    from app.core.errors import AuthError
    from app.services import audit

    rid = getattr(request.state, "request_id", None)
    svc = AuthService(session)
    try:
        user = svc.authenticate(email=body.email, password=body.password)
    except AuthError:
        # Log the failed attempt (email only — never the password).
        audit.record(session, action="login_failed", target=body.email, request_id=rid)
        raise
    tokens = svc.issue_tokens(user)
    audit.record(session, action="login", actor_id=user.id, request_id=rid)
    return ok(tokens, rid)


@router.post("/refresh")
def refresh(body: RefreshRequest, request: Request, session: Session = Depends(db_session)):
    svc = AuthService(session)
    return ok(svc.refresh(body.refresh_token), getattr(request.state, "request_id", None))


@router.post("/logout")
def logout(body: RefreshRequest, request: Request, session: Session = Depends(db_session)):
    AuthService(session).logout(body.refresh_token)
    return ok({"logged_out": True}, getattr(request.state, "request_id", None))


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user)):
    return ok(UserOut(id=user.id, email=user.email, role=user.role,
                      is_verified=user.is_verified).model_dump(),
              getattr(request.state, "request_id", None))
