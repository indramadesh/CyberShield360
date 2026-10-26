from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user, get_optional_user, require_feature
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
    from app.api.v1.routes.content import lesson_dict

    return lesson_dict(c)


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
    from app.api.v1.routes.content import lesson_dict
    from app.content import quiz as quizsvc
    from app.db.models.content_engine import QuizQuestion

    lesson = AwarenessRepository(session).get_by_slug(slug)
    if not lesson or lesson.status != "published":
        raise NotFoundError("Lesson not found.")
    questions = session.scalars(select(QuizQuestion).where(
        QuizQuestion.lesson_slug == slug, QuizQuestion.status == "published")
        .order_by(QuizQuestion.slug)).all()
    # Quiz questions are sent WITHOUT answers; grade via POST /awareness/{slug}/quiz.
    return ok({**lesson_dict(lesson, full=True),
               "quiz": [quizsvc.public_question(q) for q in questions]}, _rid(request))


class _Answers(BaseModel):
    answers: dict[str, int] = Field(default_factory=dict, max_length=50)


@router.post("/{slug}/quiz", dependencies=[Depends(require_feature("awareness"))])
def grade_lesson_quiz(slug: str, body: _Answers, request: Request, session: Session = Depends(db_session),
                      user: User | None = Depends(get_optional_user)):
    from app.content import quiz as quizsvc
    from app.db.models.content_engine import QuizQuestion

    slugs = list(session.scalars(select(QuizQuestion.slug).where(
        QuizQuestion.lesson_slug == slug, QuizQuestion.status == "published")).all())
    if not slugs:
        raise NotFoundError("This lesson has no quiz.")
    result = quizsvc.grade(session, slugs=slugs, answers=body.answers, user_id=user.id if user else None,
                           kind="lesson", period=None)
    if user and result["total"] and all(r["choice"] is not None for r in result["results"]):
        quizsvc.mark_lesson(session, user.id, slug, completed=True)
    return ok(result, _rid(request))


# Mounted separately so it is not shadowed by /awareness/{slug}.
challenges_router = APIRouter(prefix="/challenges", tags=["awareness"])


def _challenge_question(session: Session):
    from app.content import learning, quiz as quizsvc

    sel = learning.daily_challenge(session)
    qs = quizsvc.load_questions(session, sel.refs) if sel else []
    return sel, (qs[0] if qs else None)


@challenges_router.get("/daily", dependencies=[Depends(require_feature("awareness"))])
def daily_challenge(request: Request, session: Session = Depends(db_session),
                    user: User | None = Depends(get_optional_user)):
    """Today's challenge, from the reviewed question bank. No answer in the payload."""
    from app.content import quiz as quizsvc

    sel, q = _challenge_question(session)
    if q is None:
        raise NotFoundError("No challenge available.")
    prior = quizsvc.existing_attempt(session, user.id, "challenge", sel.period) if user else None
    return ok({"slug": q.slug, "id": q.slug, "kind": q.qtype, "question": q.prompt, "options": q.options,
               "category": q.category, "date": sel.period,
               "attempt": quizsvc.attempt_results(session, prior) if prior else None}, _rid(request))


class _Choice(BaseModel):
    choice: int = Field(ge=0, le=10)


@challenges_router.post("/daily", dependencies=[Depends(require_feature("awareness"))])
def answer_challenge(body: _Choice, request: Request, session: Session = Depends(db_session),
                     user: User | None = Depends(get_optional_user)):
    from app.content import quiz as quizsvc

    sel, q = _challenge_question(session)
    if q is None:
        raise NotFoundError("No challenge available.")
    return ok(quizsvc.grade(session, slugs=[q.slug], answers={q.slug: body.choice},
                            user_id=user.id if user else None, kind="challenge", period=sel.period), _rid(request))
