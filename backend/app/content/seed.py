"""Idempotent seeding for the content engine: source registry, curated legal
records and the learning library (lessons, question bank, tips).

Library rows are upserted by slug and only rewritten when LIBRARY_VERSION
increases, so admin edits made through the CMS aren't clobbered on every start.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content import legal, registry
from app.content.library.lessons import LESSONS, LIBRARY_VERSION
from app.content.library.questions import QUESTIONS
from app.content.library.tips import TIPS
from app.db.base import utcnow
from app.db.models.awareness import AwarenessContent
from app.db.models.content_engine import DailyTip, QuizQuestion


def _lesson_fields(l: dict) -> dict:
    return {
        "category": l["category"], "title": l["title"], "summary": l["summary"], "body_md": l["body"],
        "difficulty": l["difficulty"], "objective": l["objective"], "example": l["example"],
        "warning_signs": l["warning_signs"], "prevention": l["prevention"], "related_slugs": l["related"],
        "source_refs": l["sources"], "review_status": "reviewed", "status": "published",
        "library_version": LIBRARY_VERSION, "updated_at": utcnow(),
    }


def seed_library(session: Session) -> None:
    for l in LESSONS:
        row = session.scalars(select(AwarenessContent).where(AwarenessContent.slug == l["slug"])).first()
        if row is None:
            session.add(AwarenessContent(slug=l["slug"], quiz_json=[], **_lesson_fields(l)))
        elif (row.library_version or 0) < LIBRARY_VERSION:
            for k, v in _lesson_fields(l).items():
                setattr(row, k, v)
    existing_q = {q.slug: q for q in session.scalars(select(QuizQuestion)).all()}
    for q in QUESTIONS:
        row = existing_q.get(q["slug"])
        if row is None:
            session.add(QuizQuestion(review_status="reviewed", status="published", **q))
        else:
            for k, v in q.items():
                setattr(row, k, v)
    existing_t = set(session.scalars(select(DailyTip.slug)).all())
    for t in TIPS:
        if t["slug"] not in existing_t:
            session.add(DailyTip(status="published", **t))
    session.commit()


def seed_content_engine(session: Session) -> None:
    registry.sync_sources(session)
    legal.seed_curated(session)
    seed_library(session)
