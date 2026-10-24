from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.deps import db_session, require_role
from app.core import runtime_config
from app.core.config import settings
from app.core.enums import Role
from app.core.features import current_flags
from app.db.models.feedback import ScanFeedback
from app.db.models.scan import Scan
from app.db.models.user import User
from app.db.session import engine
from app.providers.registry import get_llm_provider, get_ocr_provider
from app.schemas.common import ok

router = APIRouter(prefix="/admin", tags=["admin"])
_admin = Depends(require_role(Role.ADMIN))


def _rid(request):
    return getattr(request.state, "request_id", None)


def _counts(session: Session, column) -> dict:
    rows = session.execute(select(column, func.count()).group_by(column)).all()
    return {str(k): v for k, v in rows if k is not None}


@router.get("/analytics")
def analytics(request: Request, session: Session = Depends(db_session), _: User = _admin):
    total = session.scalar(select(func.count()).select_from(Scan)) or 0
    return ok({
        "total_scans": total,
        "by_risk_level": _counts(session, Scan.risk_level),
        "by_category": _counts(session, Scan.category),
        "by_type": _counts(session, Scan.scan_type),
    }, _rid(request))


@router.get("/system")
def system(request: Request, session: Session = Depends(db_session), _: User = _admin):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return ok({
        "database": "ok" if db_ok else "unavailable",
        "redis": "enabled" if settings.redis_enabled else "disabled",
        "task_backend": settings.task_backend,
        "llm": get_llm_provider().name,
        "ocr": get_ocr_provider().name,
        "env": settings.app_env,
        "demo_mode": settings.demo_mode,
    }, _rid(request))


class ConfigUpdate(BaseModel):
    features: dict[str, bool] | None = None
    thresholds: dict[str, int] | None = None


@router.get("/config")
def get_config(request: Request, _: User = _admin):
    return ok({
        "features": current_flags(),
        "thresholds": runtime_config.effective_thresholds(),
        "overrides": runtime_config.snapshot(),
    }, _rid(request))


@router.put("/config")
def put_config(body: ConfigUpdate, request: Request,
               session: Session = Depends(db_session), user: User = _admin):
    from app.services import audit

    if body.features is not None:
        runtime_config.set_override(session, "features", body.features)
    if body.thresholds is not None:
        runtime_config.set_override(session, "thresholds", body.thresholds)
    audit.record(session, action="config_change", actor_id=user.id,
                 meta={"features": body.features, "thresholds": body.thresholds},
                 request_id=_rid(request))
    return ok({"features": current_flags(),
               "thresholds": runtime_config.effective_thresholds()}, _rid(request))


# ---- CMS (content management) ----
class LessonUpsert(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    category: str
    title: str
    summary: str = ""
    body_md: str = ""
    quiz: list = []
    status: str = "published"


@router.post("/content/awareness")
def upsert_lesson(body: LessonUpsert, request: Request,
                  session: Session = Depends(db_session), _: User = _admin):
    from app.repositories.content_repository import AwarenessRepository

    repo = AwarenessRepository(session)
    lesson = repo.get_by_slug(body.slug)
    if lesson:
        lesson.category, lesson.title, lesson.summary = body.category, body.title, body.summary
        lesson.body_md, lesson.quiz_json, lesson.status = body.body_md, body.quiz, body.status
    else:
        lesson = repo.add(repo.model(
            slug=body.slug, category=body.category, title=body.title,
            summary=body.summary, body_md=body.body_md, quiz_json=body.quiz,
            status=body.status))
    repo.commit()
    return ok({"slug": lesson.slug, "status": lesson.status}, _rid(request))


class NewsCreate(BaseModel):
    title: str
    summary: str = ""
    source: str = ""
    source_url: str = ""
    category: str = "general"
    region: str = "global"
    severity: str = "info"


@router.post("/content/news")
def create_news(body: NewsCreate, request: Request,
                session: Session = Depends(db_session), _: User = _admin):
    from app.repositories.content_repository import NewsRepository

    repo = NewsRepository(session)
    item = repo.add(repo.model(
        title=body.title, summary=body.summary, source=body.source,
        source_url=body.source_url, category=body.category, region=body.region,
        severity=body.severity, published_at=dt.datetime.now(dt.timezone.utc)))
    repo.commit()
    return ok({"id": item.id}, _rid(request))


@router.get("/evaluation")
def evaluation(request: Request, session: Session = Depends(db_session), _: User = _admin):
    """User-feedback statistics — explicitly NOT ground-truth ML metrics (spec §88)."""
    total = session.scalar(select(func.count()).select_from(ScanFeedback)) or 0
    useful = session.scalar(select(func.count()).select_from(ScanFeedback).where(
        ScanFeedback.useful.is_(True))) or 0
    wrong = session.scalar(select(func.count()).select_from(ScanFeedback).where(
        ScanFeedback.marked_wrong.is_(True))) or 0
    return ok({
        "feedback_total": total,
        "useful": useful,
        "marked_wrong": wrong,
        "note": "These are user-feedback counts, not labeled precision/recall. "
                "Feedback is not treated as ground truth.",
    }, _rid(request))
