"""Quiz grading, attempts and learning progress — all server-side.

Questions go to the client WITHOUT answer keys. Answers are graded here; the
client's own idea of the score is never trusted. A signed-in user gets one
attempt per daily quiz / weekly assessment (re-submitting returns the stored
result); practice attempts are unlimited. Guests are graded but not recorded.
"""
from __future__ import annotations

import datetime as dt
import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content.learning import today, tz
from app.db.base import utcnow
from app.db.models.awareness import AwarenessContent
from app.db.models.content_engine import LessonProgress, QuizAnswer, QuizAttempt, QuizQuestion

ONE_ATTEMPT_KINDS = {"daily", "weekly", "challenge"}


def public_question(q: QuizQuestion) -> dict:
    return {"id": q.slug, "type": q.qtype, "prompt": q.prompt, "options": q.options,
            "difficulty": q.difficulty, "category": q.category, "lesson": q.lesson_slug}


def load_questions(session: Session, slugs: list[str]) -> list[QuizQuestion]:
    rows = {q.slug: q for q in session.scalars(select(QuizQuestion).where(QuizQuestion.slug.in_(slugs))).all()}
    return [rows[s] for s in slugs if s in rows]


def _result(q: QuizQuestion, choice: int | None) -> dict:
    return {"id": q.slug, "choice": choice, "correct": choice == q.answer_index,
            "answer_index": q.answer_index, "explanation": q.explanation, "lesson": q.lesson_slug}


def existing_attempt(session: Session, user_id: str, kind: str, period: str) -> QuizAttempt | None:
    return session.scalars(select(QuizAttempt).where(
        QuizAttempt.user_id == user_id, QuizAttempt.kind == kind, QuizAttempt.period == period)).first()


def attempt_results(session: Session, attempt: QuizAttempt) -> dict:
    answers = session.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id)).all()
    qs = {q.slug: q for q in load_questions(session, [a.question_slug for a in answers])}
    return {"score": attempt.score, "total": attempt.total, "submitted_at": attempt.submitted_at.isoformat(),
            "already_submitted": True,
            "results": [_result(qs[a.question_slug], a.choice) for a in answers if a.question_slug in qs]}


def grade(session: Session, *, slugs: list[str], answers: dict[str, int], user_id: str | None,
          kind: str, period: str | None) -> dict:
    """Grade `answers` against the selection `slugs` (only those count)."""
    questions = load_questions(session, slugs)
    if user_id and kind in ONE_ATTEMPT_KINDS and period:
        prior = existing_attempt(session, user_id, kind, period)
        if prior:
            return attempt_results(session, prior)
    results = []
    for q in questions:
        raw = answers.get(q.slug)
        choice = raw if isinstance(raw, int) and 0 <= raw < len(q.options) else None
        results.append(_result(q, choice))
    score = sum(1 for r in results if r["correct"])
    out = {"score": score, "total": len(results), "already_submitted": False, "results": results,
           "submitted_at": utcnow().isoformat(), "recorded": False}
    if user_id:
        attempt = QuizAttempt(user_id=user_id, kind=kind, period=period or uuid.uuid4().hex,
                              score=score, total=len(results))
        session.add(attempt)
        session.flush()
        by_slug = {q.slug: q for q in questions}
        for r in results:
            if r["choice"] is not None:
                session.add(QuizAnswer(attempt_id=attempt.id, question_slug=r["id"],
                                       category=by_slug[r["id"]].category, choice=r["choice"], correct=r["correct"]))
        session.commit()
        out["recorded"] = True
    return out


# ---------------- Progress ----------------

def mark_lesson(session: Session, user_id: str, slug: str, *, completed: bool) -> LessonProgress:
    row = session.scalars(select(LessonProgress).where(
        LessonProgress.user_id == user_id, LessonProgress.lesson_slug == slug)).first()
    now = utcnow()
    if row is None:
        row = LessonProgress(user_id=user_id, lesson_slug=slug, viewed_at=now)
        session.add(row)
    if completed and row.completed_at is None:
        row.completed_at = now
    session.commit()
    return row


def _local_day(d: dt.datetime) -> dt.date:
    return (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).astimezone(tz()).date()


def progress(session: Session, user_id: str) -> dict:
    lessons = session.scalars(select(AwarenessContent).where(AwarenessContent.status == "published")).all()
    rows = session.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id)).all()
    attempts = session.scalars(select(QuizAttempt).where(QuizAttempt.user_id == user_id)
                               .order_by(QuizAttempt.submitted_at.desc())).all()
    attempt_ids = [a.id for a in attempts]
    answers = session.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id.in_(attempt_ids))).all() if attempt_ids else []

    by_cat: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for a in answers:
        by_cat[a.category][1] += 1
        by_cat[a.category][0] += 1 if a.correct else 0
    proficiency = [{"category": c, "correct": ok, "answered": n, "accuracy": round(ok / n * 100) if n else 0}
                   for c, (ok, n) in sorted(by_cat.items())]

    activity_days = {_local_day(r.completed_at) for r in rows if r.completed_at} | {_local_day(a.submitted_at) for a in attempts}
    streak, d = 0, today()
    if d not in activity_days:
        d -= dt.timedelta(days=1)  # today's not done yet: the streak still counts up to yesterday
    while d in activity_days:
        streak += 1
        d -= dt.timedelta(days=1)

    last = max([r.viewed_at for r in rows] + [a.submitted_at for a in attempts], default=None)
    completed = {r.lesson_slug for r in rows if r.completed_at}
    weak = [p["category"] for p in proficiency if p["answered"] >= 2 and p["accuracy"] < 60]
    recommended = [l.slug for l in lessons if l.category in weak and l.slug not in completed][:3]
    return {
        "lessons_total": len(lessons),
        "lessons_viewed": len(rows),
        "lessons_completed": len(completed),
        "completed_slugs": sorted(completed),
        "quiz_attempts": len(attempts),
        "questions_answered": len(answers),
        "correct_answers": sum(1 for a in answers if a.correct),
        "proficiency": proficiency,
        "streak_days": streak,
        "last_activity": last.isoformat() if last else None,
        "recommendations": {"weak_categories": weak, "lessons": recommended,
                            "reason": ("Based on categories where fewer than 60% of your answers were correct."
                                       if weak else "No weak areas yet — keep practising.")},
        "recent_attempts": [{"kind": a.kind, "period": a.period, "score": a.score, "total": a.total,
                             "submitted_at": a.submitted_at.isoformat()} for a in attempts[:10]],
    }


def incorrect_for_review(session: Session, user_id: str, limit: int = 20) -> list[dict]:
    """Questions the user got wrong most recently (with explanations — already answered)."""
    attempts = session.scalars(select(QuizAttempt.id).where(QuizAttempt.user_id == user_id)).all()
    if not attempts:
        return []
    wrong = session.scalars(select(QuizAnswer).where(QuizAnswer.attempt_id.in_(attempts), QuizAnswer.correct.is_(False))).all()
    seen, slugs = set(), []
    for a in reversed(wrong):
        if a.question_slug not in seen:
            seen.add(a.question_slug)
            slugs.append(a.question_slug)
    return [dict(public_question(q), answer_index=q.answer_index, explanation=q.explanation)
            for q in load_questions(session, slugs[:limit])]
