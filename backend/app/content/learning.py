"""Daily lesson / tip / quiz / challenge and the weekly assessment.

Selections are deterministic (seeded by the date) and persisted in
`daily_selections`, so every user sees the same thing all day and a refresh
never changes it. "Today" is defined by settings.content_timezone.
No AI is involved anywhere; everything comes from the reviewed library.
"""
from __future__ import annotations

import datetime as dt
import hashlib
from collections import Counter
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.awareness import AwarenessContent
from app.db.models.content_engine import DailySelection, DailyTip, QuizQuestion

DAILY_QUIZ_SIZE = 5
WEEKLY_SIZE = 10
QUESTION_COOLDOWN_DAYS = 14
DIFFICULTIES = ("beginner", "intermediate", "advanced")


def tz() -> dt.tzinfo:
    try:
        return ZoneInfo(settings.content_timezone)
    except Exception:  # noqa: BLE001 — invalid name / missing tzdata
        return dt.timezone.utc


def today(now: dt.datetime | None = None) -> dt.date:
    now = now or dt.datetime.now(dt.timezone.utc)
    return now.astimezone(tz()).date()


def week_key(day: dt.date) -> str:
    y, w, _ = day.isocalendar()
    return f"{y}-W{w:02d}"


def _rank(seed: str, key: str) -> str:
    return hashlib.sha256(f"{seed}|{key}".encode()).hexdigest()


def _recent_refs(session: Session, kind: str, before: dt.date, days: int) -> list[list[str]]:
    """refs of the previous `days` daily selections of `kind`, newest first."""
    periods = [(before - dt.timedelta(days=i)).isoformat() for i in range(1, days + 1)]
    rows = session.scalars(select(DailySelection).where(
        DailySelection.kind == kind, DailySelection.period.in_(periods))).all()
    by_period = {r.period: r.refs for r in rows}
    return [by_period[p] for p in periods if p in by_period]


def _store(session: Session, kind: str, period: str, refs: list[str], meta: dict) -> DailySelection:
    sel = DailySelection(kind=kind, period=period, refs=refs, meta=meta)
    session.add(sel)
    try:
        session.commit()
        return sel
    except IntegrityError:  # another worker/request stored it first — use theirs
        session.rollback()
        return session.scalars(select(DailySelection).where(
            DailySelection.kind == kind, DailySelection.period == period)).one()


def _existing(session: Session, kind: str, period: str) -> DailySelection | None:
    return session.scalars(select(DailySelection).where(
        DailySelection.kind == kind, DailySelection.period == period)).first()


def _pick_rotating(items: list, *, day: dt.date, recent: list[list[str]], key, category) -> tuple[object | None, bool]:
    """Pick one item: not shown recently, different topic from yesterday,
    preferring today's difficulty in the rotation. Returns (item, is_revision)."""
    if not items:
        return None, False
    seed = day.isoformat()
    window = max(0, len(items) - 1)
    recent_keys = {k for refs in recent[:window] for k in refs}
    last_cat = None
    if recent and recent[0]:
        last = next((i for i in items if key(i) == recent[0][0]), None)
        last_cat = category(last) if last else None
    want_diff = DIFFICULTIES[day.toordinal() % 3]
    fresh = [i for i in items if key(i) not in recent_keys]
    revision = not fresh
    pool = fresh or items
    def score(i):
        return (category(i) == last_cat, (getattr(i, "difficulty", None) or "beginner") != want_diff, _rank(seed, key(i)))
    return sorted(pool, key=score)[0], revision


def daily_lesson(session: Session, day: dt.date | None = None) -> tuple[AwarenessContent | None, DailySelection | None]:
    day = day or today()
    period = day.isoformat()
    sel = _existing(session, "lesson", period)
    lessons = session.scalars(select(AwarenessContent).where(AwarenessContent.status == "published")).all()
    by_slug = {l.slug: l for l in lessons}
    if sel is None:
        pick, revision = _pick_rotating(lessons, day=day, recent=_recent_refs(session, "lesson", day, 60),
                                        key=lambda l: l.slug, category=lambda l: l.category)
        if pick is None:
            return None, None
        sel = _store(session, "lesson", period, [pick.slug], {"revision": revision})
    return by_slug.get(sel.refs[0]) if sel.refs else None, sel


def daily_tip(session: Session, day: dt.date | None = None) -> tuple[DailyTip | None, DailySelection | None]:
    day = day or today()
    period = day.isoformat()
    sel = _existing(session, "tip", period)
    tips = session.scalars(select(DailyTip).where(DailyTip.status == "published")).all()
    by_slug = {t.slug: t for t in tips}
    if sel is None:
        pick, revision = _pick_rotating(tips, day=day, recent=_recent_refs(session, "tip", day, 90),
                                        key=lambda t: t.slug, category=lambda t: t.category)
        if pick is None:
            return None, None
        pick.last_displayed_on = day
        sel = _store(session, "tip", period, [pick.slug], {"revision": revision})
    return by_slug.get(sel.refs[0]) if sel.refs else None, sel


def _pick_questions(questions: list[QuizQuestion], *, seed: str, n: int, avoid: set[str],
                    prefer_types: tuple[str, ...] = ()) -> list[QuizQuestion]:
    """n questions spread across categories and difficulties; recently used ones
    only when nothing else is available."""
    fresh = [q for q in questions if q.slug not in avoid]
    pool = fresh if len(fresh) >= n else questions
    ordered = sorted(pool, key=lambda q: (q.qtype not in prefer_types if prefer_types else False, _rank(seed, q.slug)))
    picked: list[QuizQuestion] = []
    cats: Counter = Counter()
    diffs: Counter = Counter()
    # Round 1: one per category, rotating difficulty; Round 2: fill.
    for q in ordered:
        if len(picked) >= n:
            break
        if cats[q.category] == 0 and diffs[q.difficulty] <= len(picked) // len(DIFFICULTIES):
            picked.append(q); cats[q.category] += 1; diffs[q.difficulty] += 1
    for q in ordered:
        if len(picked) >= n:
            break
        if q not in picked:
            picked.append(q)
    return picked


def _published_questions(session: Session) -> list[QuizQuestion]:
    return list(session.scalars(select(QuizQuestion).where(
        QuizQuestion.status == "published", QuizQuestion.review_status == "reviewed")).all())


def daily_quiz(session: Session, day: dt.date | None = None) -> DailySelection | None:
    day = day or today()
    period = day.isoformat()
    sel = _existing(session, "quiz", period)
    if sel:
        return sel
    questions = _published_questions(session)
    if not questions:
        return None
    avoid = {s for refs in _recent_refs(session, "quiz", day, QUESTION_COOLDOWN_DAYS) for s in refs}
    picked = _pick_questions(questions, seed=f"quiz|{period}", n=min(DAILY_QUIZ_SIZE, len(questions)), avoid=avoid)
    return _store(session, "quiz", period, [q.slug for q in picked], {"size": len(picked)})


def daily_challenge(session: Session, day: dt.date | None = None) -> DailySelection | None:
    day = day or today()
    period = day.isoformat()
    sel = _existing(session, "challenge", period)
    if sel:
        return sel
    questions = _published_questions(session)
    if not questions:
        return None
    quiz = daily_quiz(session, day)
    avoid = set(quiz.refs if quiz else []) | {s for refs in _recent_refs(session, "challenge", day, 30) for s in refs}
    picked = _pick_questions(questions, seed=f"challenge|{period}", n=1, avoid=avoid,
                             prefer_types=("scenario", "indicator", "next_action"))
    return _store(session, "challenge", period, [q.slug for q in picked], {})


def weekly_assessment(session: Session, day: dt.date | None = None) -> DailySelection | None:
    day = day or today()
    period = week_key(day)
    sel = _existing(session, "weekly", period)
    if sel:
        return sel
    questions = _published_questions(session)
    if not questions:
        return None
    picked = _pick_questions(questions, seed=f"weekly|{period}", n=min(WEEKLY_SIZE, len(questions)), avoid=set())
    return _store(session, "weekly", period, [q.slug for q in picked], {"size": len(picked)})


def ensure_today(session: Session, now: dt.datetime | None = None) -> dict:
    """Scheduler job: make sure today's selections exist (idempotent)."""
    day = today(now)
    lesson, _ = daily_lesson(session, day)
    tip, _ = daily_tip(session, day)
    quiz = daily_quiz(session, day)
    challenge = daily_challenge(session, day)
    weekly = weekly_assessment(session, day)
    return {"day": day.isoformat(), "lesson": lesson.slug if lesson else None, "tip": tip.slug if tip else None,
            "quiz": quiz.refs if quiz else [], "challenge": challenge.refs if challenge else [],
            "weekly": weekly.period if weekly else None}
