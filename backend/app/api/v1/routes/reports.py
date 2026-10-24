"""Community reporting (spec §40). Safety rules:
- rate-limited + duplicate-detected,
- moderated before any promotion to the local intel store,
- unverified reports NEVER publicly label a person as a criminal.
"""
from __future__ import annotations

import datetime as dt
import hashlib

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user, require_feature, require_role
from app.core.enums import Role
from app.core.errors import NotFoundError, RateLimitError, ValidationAppError
from app.db.models.user import User
from app.repositories.content_repository import ReportRepository
from app.repositories.threat_repository import ThreatRepository
from app.schemas.common import ok

router = APIRouter(prefix="/reports", tags=["community"])

_ALLOWED_TYPES = {"url", "domain", "phone", "email", "upi", "message", "social"}
_DAILY_LIMIT = 20


class ReportRequest(BaseModel):
    indicator_type: str
    value: str = Field(min_length=2, max_length=512)
    note: str | None = Field(default=None, max_length=1000)


class ModerateRequest(BaseModel):
    status: str  # ACCEPTED | REJECTED | REVIEWING


def _rid(request):
    return getattr(request.state, "request_id", None)


def _dupe_group(indicator_type: str, value: str) -> str:
    return hashlib.sha256(f"{indicator_type}:{value.lower()}".encode()).hexdigest()[:16]


@router.post("", dependencies=[Depends(require_feature("community_reports"))])
def submit_report(body: ReportRequest, request: Request,
                  session: Session = Depends(db_session),
                  user: User = Depends(get_current_user)):
    if body.indicator_type not in _ALLOWED_TYPES:
        raise ValidationAppError(f"Unsupported indicator type: {body.indicator_type}")

    repo = ReportRepository(session)
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)
    if repo.recent_by_reporter(user.id, since) >= _DAILY_LIMIT:
        raise RateLimitError("Daily report limit reached. Please try again tomorrow.")

    group = _dupe_group(body.indicator_type, body.value)
    existing = repo.find_same(body.indicator_type, body.value.lower())
    report = repo.add(repo.model(
        reporter_id=user.id, indicator_type=body.indicator_type,
        value=body.value.lower(), note=body.note, status="PENDING",
        dupe_group=group,
        # More independent reports => slightly higher (still low) confidence.
        confidence=min(0.6, 0.3 + 0.05 * len(existing)),
    ))
    repo.commit()
    return ok({"report_id": report.id, "status": report.status,
               "duplicate_of_group": group if existing else None}, _rid(request))


@router.get("", dependencies=[Depends(require_feature("community_reports"))])
def moderation_queue(request: Request, status: str | None = None, limit: int = 50,
                     offset: int = 0, session: Session = Depends(db_session),
                     _: User = Depends(require_role(Role.ANALYST, Role.ADMIN))):
    rows = ReportRepository(session).queue(status, limit=min(limit, 100), offset=offset)
    return ok([
        {"id": r.id, "indicator_type": r.indicator_type, "value": r.value,
         "status": r.status, "confidence": r.confidence, "note": r.note,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ], _rid(request))


@router.patch("/{report_id}", dependencies=[Depends(require_feature("community_reports"))])
def moderate(report_id: str, body: ModerateRequest, request: Request,
             session: Session = Depends(db_session),
             moderator: User = Depends(require_role(Role.ANALYST, Role.ADMIN))):
    if body.status not in {"ACCEPTED", "REJECTED", "REVIEWING"}:
        raise ValidationAppError("Invalid status.")
    repo = ReportRepository(session)
    report = repo.get(report_id)
    if not report:
        raise NotFoundError("Report not found.")
    report.status = body.status
    # On acceptance, promote URL/domain indicators to the local store at LOW
    # confidence — a moderated signal, never a public accusation of a person.
    if body.status == "ACCEPTED" and report.indicator_type in ("url", "domain"):
        ThreatRepository(session).upsert(
            provider="community", indicator=report.value,
            indicator_type=report.indicator_type, threat_type="COMMUNITY_REPORTED",
            confidence=report.confidence, ttl_days=30,
        )
    repo.commit()
    from app.services import audit

    audit.record(session, action="report_moderated", actor_id=moderator.id,
                 target=report.id, meta={"status": report.status}, request_id=_rid(request))
    return ok({"report_id": report.id, "status": report.status}, _rid(request))
