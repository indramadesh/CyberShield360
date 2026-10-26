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
        severity=body.severity, published_at=dt.datetime.now(dt.timezone.utc),
        status="published", source_key="admin", kind="news", severity_origin="source",
        category_origin="source"))
    repo.commit()
    return ok({"id": item.id}, _rid(request))


# ---------------- Content engine operations ----------------

def _source_admin_dict(s) -> dict:
    iso = lambda d: d.isoformat() if d else None  # noqa: E731
    return {
        "key": s.key, "name": s.name, "category": s.category, "fmt": s.fmt, "feed_url": s.feed_url,
        "jurisdiction": s.jurisdiction, "trust": s.trust, "enabled": s.enabled, "paused_reason": s.paused_reason,
        "interval_minutes": s.interval_minutes, "last_attempt_at": iso(s.last_attempt_at),
        "last_success_at": iso(s.last_success_at), "next_attempt_at": iso(s.next_attempt_at),
        "last_item_published_at": iso(s.last_item_published_at), "consecutive_failures": s.consecutive_failures,
        "last_error": s.last_error, "last_error_type": s.last_error_type, "last_status_code": s.last_status_code,
        "last_response_ms": s.last_response_ms, "total_items": s.total_items, "total_duplicates": s.total_duplicates,
        "license_notes": s.license_notes,
    }


@router.get("/content/sources")
def content_sources(request: Request, session: Session = Depends(db_session), _: User = _admin):
    from app.content.registry import NOT_ENABLED
    from app.db.models.content_engine import ContentSource

    rows = session.scalars(select(ContentSource).order_by(ContentSource.category, ContentSource.key)).all()
    return ok({"sources": [_source_admin_dict(s) for s in rows], "not_enabled": NOT_ENABLED}, _rid(request))


class SourcePatch(BaseModel):
    enabled: bool | None = None
    resume: bool = False


@router.patch("/content/sources/{key}")
def patch_source(key: str, body: SourcePatch, request: Request,
                 session: Session = Depends(db_session), user: User = _admin):
    from app.core.errors import NotFoundError
    from app.db.models.content_engine import ContentSource
    from app.services.audit import record

    src = session.scalars(select(ContentSource).where(ContentSource.key == key)).first()
    if not src:
        raise NotFoundError("Source not found.")
    if body.enabled is not None:
        src.enabled = body.enabled
    if body.resume:
        src.paused_reason, src.consecutive_failures, src.next_attempt_at = None, 0, None
    session.commit()
    record(session, actor_id=user.id, action="content_source_update", target=key,
           meta={"enabled": src.enabled, "resumed": body.resume})
    return ok(_source_admin_dict(src), _rid(request))


@router.post("/content/sources/{key}/run")
def run_source_now(key: str, request: Request, session: Session = Depends(db_session), _: User = _admin):
    from app.content.ingest import run_source
    from app.core.errors import NotFoundError
    from app.db.models.content_engine import ContentSource

    src = session.scalars(select(ContentSource).where(ContentSource.key == key)).first()
    if not src:
        raise NotFoundError("Source not found.")
    run = run_source(session, src, trigger="manual")
    return ok({"status": run.status, "items_new": run.items_new, "items_updated": run.items_updated,
               "items_duplicate": run.items_duplicate, "items_rejected": run.items_rejected,
               "error": run.error, "source": _source_admin_dict(src)}, _rid(request))


@router.get("/content/runs")
def content_runs(request: Request, session: Session = Depends(db_session), _: User = _admin,
                 source: str | None = None, limit: int = 50):
    from app.db.models.content_engine import SourceFetchRun

    stmt = select(SourceFetchRun).order_by(SourceFetchRun.started_at.desc()).limit(min(limit, 200))
    if source:
        stmt = stmt.where(SourceFetchRun.source_key == source)
    return ok([{"source": r.source_key, "started_at": r.started_at.isoformat(), "status": r.status,
                "trigger": r.trigger, "http_status": r.http_status, "response_ms": r.response_ms,
                "seen": r.items_seen, "new": r.items_new, "updated": r.items_updated,
                "duplicate": r.items_duplicate, "rejected": r.items_rejected,
                "error_type": r.error_type, "error": r.error} for r in session.scalars(stmt).all()], _rid(request))


@router.get("/content/legal-candidates")
def legal_candidates(request: Request, session: Session = Depends(db_session), _: User = _admin):
    from app.db.models.content_engine import LegalChangeCandidate

    rows = session.scalars(select(LegalChangeCandidate).order_by(LegalChangeCandidate.detected_at.desc()).limit(100)).all()
    return ok([{"id": c.id, "source": c.source_key, "title": c.title, "url": c.url, "change_type": c.change_type,
                "status": c.status, "reason": c.reason, "details": c.details,
                "detected_at": c.detected_at.isoformat()} for c in rows], _rid(request))


class CandidatePatch(BaseModel):
    status: str = Field(pattern="^(open|dismissed|reviewed)$")


@router.patch("/content/legal-candidates/{cid}")
def patch_candidate(cid: str, body: CandidatePatch, request: Request,
                    session: Session = Depends(db_session), _: User = _admin):
    from app.core.errors import NotFoundError
    from app.db.models.content_engine import LegalChangeCandidate

    c = session.get(LegalChangeCandidate, cid)
    if not c:
        raise NotFoundError("Candidate not found.")
    c.status = body.status
    session.commit()
    return ok({"id": c.id, "status": c.status}, _rid(request))


@router.get("/content/scheduler")
def scheduler_status(request: Request, session: Session = Depends(db_session), _: User = _admin):
    from app.content import freshness, scheduler

    return ok({"jobs": scheduler.status(session), "freshness": freshness.overview(session),
               "embedded": settings.content_scheduler_embedded,
               "ingestion_enabled": settings.content_ingestion_enabled}, _rid(request))


class JobRun(BaseModel):
    job: str = Field(pattern="^(sync_sources|daily_selection|ingest_feeds|prune_old_articles)$")


@router.post("/content/scheduler/run")
def scheduler_run(body: JobRun, request: Request, _: User = _admin):
    from app.content import scheduler
    from app.db.session import SessionLocal

    return ok(scheduler.run_pending(SessionLocal, force={body.job}, only={body.job}), _rid(request))


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
