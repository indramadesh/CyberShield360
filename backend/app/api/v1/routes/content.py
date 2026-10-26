"""Content-intelligence API: updates, freshness, legal tracker, learning, quizzes.

Public reads return only published content. Answer keys are never included in
question payloads; grading happens server-side. Progress endpoints are per-user
(the user id always comes from the token, never from the request).
"""
from __future__ import annotations

import datetime as dt
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user, get_optional_user, require_feature
from app.content import freshness, learning, quiz
from app.content.classify import CATEGORY_LABELS
from app.content.legal import LEGAL_STATUSES
from app.core.errors import NotFoundError, ValidationAppError
from app.db.models.awareness import AwarenessContent
from app.db.models.content import CyberLaw, NewsItem
from app.db.models.content_engine import ContentSource, DailySelection, DailyTip, LegalDocumentVersion, QuizQuestion
from app.db.models.user import User
from app.schemas.common import ok

router = APIRouter(tags=["content"])
_news = Depends(require_feature("cyber_news"))
_learn = Depends(require_feature("awareness"))


def _rid(request: Request):
    return getattr(request.state, "request_id", None)


def _iso(d):
    if d is None:
        return None
    if isinstance(d, dt.datetime) and d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.isoformat()


# ---------------- Articles ----------------

def article_dict(n: NewsItem) -> dict:
    return {
        "id": n.id, "title": n.title, "summary": n.summary, "source": n.source, "source_key": n.source_key,
        "source_url": n.source_url, "category": n.category, "category_label": CATEGORY_LABELS.get(n.category, n.category),
        "category_origin": n.category_origin, "kind": n.kind or "news", "region": n.region,
        "severity": n.severity, "severity_origin": n.severity_origin or "none",
        # Source's own publication date (None = the source didn't give one). Never the fetch time.
        "published_at": _iso(n.published_at), "source_updated_at": _iso(n.source_updated_at),
        "ingested_at": _iso(n.created_at), "last_verified_at": _iso(n.last_seen_at), "tags": n.tags or [],
    }


def _published_articles():
    return select(NewsItem).where(NewsItem.status == "published")


@router.get("/updates", dependencies=[_news])
def list_updates(request: Request, session: Session = Depends(db_session),
                 kind: str | None = Query(None, pattern="^(news|advisory|vulnerability|alert)$"),
                 category: str | None = Query(None, max_length=32), region: str | None = Query(None, max_length=16),
                 source: str | None = Query(None, max_length=64), q: str | None = Query(None, max_length=100),
                 days: int | None = Query(None, ge=1, le=365), page: int = Query(1, ge=1, le=500),
                 page_size: int = Query(20, ge=1, le=50)):
    stmt = _published_articles()
    if kind:
        stmt = stmt.where(NewsItem.kind == kind)
    if category:
        stmt = stmt.where(NewsItem.category == category)
    if region:
        stmt = stmt.where(NewsItem.region == region)
    if source:
        stmt = stmt.where(NewsItem.source_key == source)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(NewsItem.title.ilike(like), NewsItem.summary.ilike(like)))
    if days:
        since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
        stmt = stmt.where(func.coalesce(NewsItem.published_at, NewsItem.created_at) >= since)
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    # Dated items first (newest by the SOURCE's date), then undated ones by ingestion time.
    rows = session.scalars(stmt.order_by(NewsItem.published_at.is_(None), NewsItem.published_at.desc(),
                                         NewsItem.created_at.desc())
                           .limit(page_size).offset((page - 1) * page_size)).all()
    return ok({"items": [article_dict(n) for n in rows], "total": total, "page": page, "page_size": page_size,
               "has_more": page * page_size < total, "freshness": freshness.section(session, "news")}, _rid(request))


@router.get("/updates/today", dependencies=[_news])
def today_updates(request: Request, session: Session = Depends(db_session)):
    """Items the SOURCES dated today (configured timezone). If there are none,
    the most recent items are returned with `fallback=true` and their real dates."""
    day = learning.today()
    tz = learning.tz()
    start = dt.datetime.combine(day, dt.time.min, tzinfo=tz).astimezone(dt.timezone.utc)
    rows = session.scalars(_published_articles().where(NewsItem.published_at >= start)
                           .order_by(NewsItem.published_at.desc()).limit(40)).all()
    fallback = not rows
    if fallback:
        rows = session.scalars(_published_articles().where(NewsItem.published_at.is_not(None))
                               .order_by(NewsItem.published_at.desc()).limit(12)).all()
    critical = session.scalars(_published_articles().where(
        NewsItem.severity.in_(("critical", "high")), NewsItem.published_at.is_not(None))
        .order_by(NewsItem.published_at.desc()).limit(6)).all()
    return ok({"date": day.isoformat(), "timezone": learning.settings.content_timezone, "fallback": fallback,
               "items": [article_dict(n) for n in rows], "critical": [article_dict(n) for n in critical],
               "freshness": freshness.section(session, "news")}, _rid(request))


@router.get("/updates/sources", dependencies=[_news])
def public_sources(request: Request, session: Session = Depends(db_session)):
    """Public source list with health state (no internal error details)."""
    rows = session.scalars(select(ContentSource).order_by(ContentSource.category, ContentSource.name)).all()
    out = []
    for s in rows:
        state = "disabled" if not s.enabled else "paused" if s.paused_reason else \
            "failing" if (s.consecutive_failures or 0) > 0 else "ok" if s.last_success_at else "pending"
        out.append({"key": s.key, "name": s.name, "category": s.category, "jurisdiction": s.jurisdiction,
                    "trust": s.trust, "url": s.base_url, "attribution": s.attribution, "state": state,
                    "last_success_at": _iso(s.last_success_at), "items": s.total_items or 0})
    return ok(out, _rid(request))


@router.get("/content/status")
def content_status(request: Request, session: Session = Depends(db_session)):
    return ok(freshness.overview(session), _rid(request))


# ---------------- Legal tracker ----------------

def law_dict(l: CyberLaw, versions: list[LegalDocumentVersion] | None = None) -> dict:
    out = {
        "id": l.id, "slug": l.slug, "title": l.title, "authority": l.authority, "jurisdiction": l.jurisdiction,
        "document_type": l.document_type, "legal_status": l.legal_status,
        "legal_status_label": LEGAL_STATUSES.get(l.legal_status or "", "Status not established"),
        "commencement_status": l.commencement_status, "document_ref": l.document_ref, "amends": l.amends,
        "related_legislation": l.related_legislation or [],
        "publication_date": l.publication_date.isoformat() if l.publication_date else None,
        "effective_date": l.effective_date.isoformat() if l.effective_date else None,
        "official_source": l.official_source, "plain_summary": l.plain_summary,
        "summary_provenance": l.summary_provenance, "verification_status": l.verification_status,
        "last_checked_at": _iso(l.last_checked_at),
        # Back-compat with the original /laws shape:
        "status": l.legal_status or l.status,
    }
    if versions is not None:
        out["versions"] = [{"version": v.version_no, "captured_at": _iso(v.captured_at), "legal_status": v.legal_status,
                            "etag": v.etag, "last_modified": v.last_modified,
                            "size_bytes": (v.snapshot or {}).get("size_bytes")} for v in versions]
    return out


def _published_laws(session: Session):
    return session.scalars(select(CyberLaw).where(CyberLaw.is_published.is_(True))
                           .order_by(CyberLaw.publication_date.desc())).all()


@router.get("/legal", dependencies=[Depends(require_feature("cyber_law"))])
def list_legal(request: Request, session: Session = Depends(db_session)):
    laws = _published_laws(session)
    return ok({"items": [law_dict(l) for l in laws], "statuses": LEGAL_STATUSES,
               "freshness": freshness.section(session, "legal"),
               "notice": "Summaries are informational and are not legal advice. Always rely on the official text."},
              _rid(request))


@router.get("/legal/{slug}", dependencies=[Depends(require_feature("cyber_law"))])
def legal_detail(slug: str, request: Request, session: Session = Depends(db_session)):
    law = session.scalars(select(CyberLaw).where(CyberLaw.slug == slug, CyberLaw.is_published.is_(True))).first()
    if not law:
        raise NotFoundError("Legal record not found.")
    versions = session.scalars(select(LegalDocumentVersion).where(LegalDocumentVersion.law_id == law.id)
                               .order_by(LegalDocumentVersion.version_no.desc())).all()
    return ok(law_dict(law, versions), _rid(request))


# ---------------- Learning ----------------

def lesson_dict(l: AwarenessContent, *, full: bool = False) -> dict:
    words = len((l.body_md or "").split()) + len((l.example or "").split())
    out = {"slug": l.slug, "category": l.category, "title": l.title, "summary": l.summary,
           "difficulty": l.difficulty or "beginner", "read_minutes": max(1, round(words / 200))}
    if full:
        out.update({"objective": l.objective, "body_md": l.body_md, "example": l.example,
                    "warning_signs": l.warning_signs or [], "prevention": l.prevention or [],
                    "related": l.related_slugs or [], "sources": l.source_refs or [],
                    "review_status": l.review_status, "updated_at": _iso(l.updated_at)})
    return out


def tip_dict(t: DailyTip) -> dict:
    return {"slug": t.slug, "title": t.title, "description": t.description, "recommendation": t.recommendation,
            "category": t.category, "related_lesson": t.related_lesson, "source_ref": t.source_ref}


@router.get("/learn/daily", dependencies=[_learn])
def learn_daily(request: Request, session: Session = Depends(db_session)):
    lesson, lsel = learning.daily_lesson(session)
    tip, _ = learning.daily_tip(session)
    return ok({"date": learning.today().isoformat(), "timezone": learning.settings.content_timezone,
               "lesson": lesson_dict(lesson, full=True) if lesson else None,
               "revision": bool(lsel and (lsel.meta or {}).get("revision")),
               "tip": tip_dict(tip) if tip else None}, _rid(request))


@router.get("/learn/tips", dependencies=[_learn])
def previous_tips(request: Request, session: Session = Depends(db_session), limit: int = Query(14, ge=1, le=60)):
    sels = session.scalars(select(DailySelection).where(DailySelection.kind == "tip")
                           .order_by(DailySelection.period.desc()).limit(limit)).all()
    tips = {t.slug: t for t in session.scalars(select(DailyTip)).all()}
    return ok([{"date": s.period, **tip_dict(tips[s.refs[0]])} for s in sels if s.refs and s.refs[0] in tips],
              _rid(request))


@router.get("/learn/categories", dependencies=[_learn])
def learn_categories(request: Request, session: Session = Depends(db_session)):
    lessons = session.scalars(select(AwarenessContent).where(AwarenessContent.status == "published")).all()
    qcount = dict(session.execute(select(QuizQuestion.category, func.count()).where(
        QuizQuestion.status == "published").group_by(QuizQuestion.category)).all())
    cats: dict[str, dict] = {}
    for l in lessons:
        c = cats.setdefault(l.category, {"category": l.category, "lessons": 0, "questions": qcount.get(l.category, 0)})
        c["lessons"] += 1
    return ok(sorted(cats.values(), key=lambda c: c["category"]), _rid(request))


class ProgressUpdate(BaseModel):
    completed: bool = False


@router.post("/learn/progress/{slug}", dependencies=[_learn])
def update_progress(slug: str, body: ProgressUpdate, request: Request, session: Session = Depends(db_session),
                    user: User = Depends(get_current_user)):
    if not session.scalars(select(AwarenessContent.slug).where(AwarenessContent.slug == slug)).first():
        raise NotFoundError("Lesson not found.")
    row = quiz.mark_lesson(session, user.id, slug, completed=body.completed)
    return ok({"slug": slug, "viewed_at": _iso(row.viewed_at), "completed_at": _iso(row.completed_at)}, _rid(request))


@router.get("/learn/progress", dependencies=[_learn])
def get_progress(request: Request, session: Session = Depends(db_session), user: User = Depends(get_current_user)):
    return ok(quiz.progress(session, user.id), _rid(request))


# ---------------- Quizzes ----------------

class Submission(BaseModel):
    answers: dict[str, int] = Field(default_factory=dict, max_length=50)


class PracticeSubmission(Submission):
    ids: list[str] = Field(min_length=1, max_length=20)


def _selection_payload(session: Session, sel: DailySelection | None, kind: str, user: User | None) -> dict:
    if sel is None:
        return {"available": False, "questions": []}
    qs = quiz.load_questions(session, sel.refs)
    out = {"available": bool(qs), "period": sel.period, "questions": [quiz.public_question(q) for q in qs]}
    if user:
        prior = quiz.existing_attempt(session, user.id, kind, sel.period)
        out["attempt"] = quiz.attempt_results(session, prior) if prior else None
    return out


@router.get("/quiz/daily", dependencies=[_learn])
def daily_quiz(request: Request, session: Session = Depends(db_session), user: User | None = Depends(get_optional_user)):
    return ok(_selection_payload(session, learning.daily_quiz(session), "daily", user), _rid(request))


@router.post("/quiz/daily", dependencies=[_learn])
def submit_daily(body: Submission, request: Request, session: Session = Depends(db_session),
                 user: User | None = Depends(get_optional_user)):
    sel = learning.daily_quiz(session)
    if not sel:
        raise ValidationAppError("No quiz is available today.")
    return ok(quiz.grade(session, slugs=sel.refs, answers=body.answers, user_id=user.id if user else None,
                         kind="daily", period=sel.period), _rid(request))


@router.get("/quiz/weekly", dependencies=[_learn])
def weekly(request: Request, session: Session = Depends(db_session), user: User | None = Depends(get_optional_user)):
    return ok(_selection_payload(session, learning.weekly_assessment(session), "weekly", user), _rid(request))


@router.post("/quiz/weekly", dependencies=[_learn])
def submit_weekly(body: Submission, request: Request, session: Session = Depends(db_session),
                  user: User | None = Depends(get_optional_user)):
    sel = learning.weekly_assessment(session)
    if not sel:
        raise ValidationAppError("No assessment is available this week.")
    return ok(quiz.grade(session, slugs=sel.refs, answers=body.answers, user_id=user.id if user else None,
                         kind="weekly", period=sel.period), _rid(request))


@router.get("/quiz/practice", dependencies=[_learn])
def practice(request: Request, session: Session = Depends(db_session),
             category: str | None = Query(None, max_length=48),
             difficulty: str | None = Query(None, pattern="^(beginner|intermediate|advanced)$"),
             limit: int = Query(5, ge=1, le=20)):
    stmt = select(QuizQuestion).where(QuizQuestion.status == "published", QuizQuestion.review_status == "reviewed")
    if category:
        stmt = stmt.where(QuizQuestion.category == category)
    if difficulty:
        stmt = stmt.where(QuizQuestion.difficulty == difficulty)
    pool = session.scalars(stmt).all()
    picked = learning._pick_questions(pool, seed=uuid.uuid4().hex, n=min(limit, len(pool)), avoid=set())  # noqa: SLF001
    return ok({"questions": [quiz.public_question(q) for q in picked], "available": len(pool),
               "note": None if len(pool) >= limit else f"Only {len(pool)} reviewed question(s) match these filters."},
              _rid(request))


@router.post("/quiz/practice", dependencies=[_learn])
def submit_practice(body: PracticeSubmission, request: Request, session: Session = Depends(db_session),
                    user: User | None = Depends(get_optional_user)):
    return ok(quiz.grade(session, slugs=body.ids, answers=body.answers, user_id=user.id if user else None,
                         kind="practice", period=None), _rid(request))


@router.get("/quiz/review", dependencies=[_learn])
def review(request: Request, session: Session = Depends(db_session), user: User = Depends(get_current_user)):
    return ok(quiz.incorrect_for_review(session, user.id), _rid(request))


@router.get("/quiz/categories", dependencies=[_learn])
def quiz_categories(request: Request, session: Session = Depends(db_session)):
    rows = session.execute(select(QuizQuestion.category, QuizQuestion.difficulty, func.count()).where(
        QuizQuestion.status == "published").group_by(QuizQuestion.category, QuizQuestion.difficulty)).all()
    out: dict[str, dict] = {}
    for cat, diff, n in rows:
        out.setdefault(cat, {"category": cat, "total": 0, "by_difficulty": {}})
        out[cat]["by_difficulty"][diff] = n
        out[cat]["total"] += n
    return ok(sorted(out.values(), key=lambda c: c["category"]), _rid(request))
