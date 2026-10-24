from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user, require_feature
from app.core.errors import NotFoundError
from app.db.models.user import User
from app.repositories.content_repository import AwarenessRepository, ChallengeRepository
from app.repositories.scan_repository import ScanRepository
from app.schemas.common import ok

router = APIRouter(prefix="/awareness", tags=["awareness"])

# Threat category -> Learn category, so weaknesses map to lessons (spec §39).
_CATEGORY_TO_LESSON = {
    "PHISHING": "phishing", "SMISHING": "phishing", "CREDENTIAL_THEFT": "passwords",
    "FAKE_KYC": "phishing", "UPI_FRAUD": "upi", "QR_FRAUD": "qr",
    "JOB_SCAM": "jobs", "INVESTMENT_SCAM": "investment",
    "TECH_SUPPORT_SCAM": "social_engineering", "IMPERSONATION": "social_engineering",
}


def _rid(request):
    return getattr(request.state, "request_id", None)


def _summary(c):
    return {"slug": c.slug, "category": c.category, "title": c.title, "summary": c.summary}


@router.get("", dependencies=[Depends(require_feature("awareness"))])
def list_lessons(request: Request, category: str | None = None,
                 session: Session = Depends(db_session)):
    lessons = AwarenessRepository(session).list_published(category)
    return ok([_summary(c) for c in lessons], _rid(request))


@router.get("/recommendations", dependencies=[Depends(require_feature("awareness"))])
def recommendations(request: Request, session: Session = Depends(db_session),
                    user: User = Depends(get_current_user)):
    """Recommend lessons based on the categories in the user's recent scans."""
    scans = ScanRepository(session).list_for_user(user.id, limit=50)
    counts: dict[str, int] = {}
    for s in scans:
        lesson_cat = _CATEGORY_TO_LESSON.get(s.category or "")
        if lesson_cat:
            counts[lesson_cat] = counts.get(lesson_cat, 0) + 1
    ranked = sorted(counts, key=counts.get, reverse=True)
    lessons = AwarenessRepository(session).by_categories(ranked[:3])
    # Keep the recommendation explainable.
    reason = (f"Based on {len(scans)} recent scans, your most frequent risk areas were: "
              f"{', '.join(ranked[:3])}." if ranked else
              "No scan history yet — here are some good starting lessons.")
    if not lessons:
        lessons = AwarenessRepository(session).list_published()[:3]
    return ok({"reason": reason, "lessons": [_summary(c) for c in lessons]}, _rid(request))


@router.get("/{slug}", dependencies=[Depends(require_feature("awareness"))])
def get_lesson(slug: str, request: Request, session: Session = Depends(db_session)):
    lesson = AwarenessRepository(session).get_by_slug(slug)
    if not lesson or lesson.status != "published":
        raise NotFoundError("Lesson not found.")
    return ok({
        "slug": lesson.slug, "category": lesson.category, "title": lesson.title,
        "summary": lesson.summary, "body_md": lesson.body_md, "quiz": lesson.quiz_json,
    }, _rid(request))


# Mounted separately so it is not shadowed by /awareness/{slug}.
challenges_router = APIRouter(prefix="/challenges", tags=["awareness"])


@challenges_router.get("/daily", dependencies=[Depends(require_feature("awareness"))])
def daily_challenge(request: Request, session: Session = Depends(db_session)):
    active = ChallengeRepository(session).active()
    if not active:
        raise NotFoundError("No challenge available.")
    # Deterministic daily pick (rotates by day-of-year).
    idx = dt.date.today().toordinal() % len(active)
    c = active[idx]
    return ok({
        "slug": c.slug, "kind": c.kind, "question": c.question,
        "options": c.options_json, "answer_index": c.answer_index,
        "explanation": c.explanation,
    }, _rid(request))
