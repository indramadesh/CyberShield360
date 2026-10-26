"""Content-intelligence engine: source registry, fetch runs, legal versioning,
question bank, tips, daily selections, attempts, learning progress and job locks.

Existing content tables (news_items, cyber_laws, awareness_content) are extended
in place (see content.py / awareness.py) rather than duplicated.
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin, utcnow


class ContentSource(UUIDMixin, TimestampMixin, Base):
    """One public source the ingestion engine reads. Seeded from
    app/content/registry.py (single definition); runtime health lives here."""

    __tablename__ = "content_sources"

    key: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="news")  # news|advisory|vulnerability|alert|legal
    base_url: Mapped[str] = mapped_column(String(512), default="")
    feed_url: Mapped[str] = mapped_column(String(1024), default="")
    fmt: Mapped[str] = mapped_column(String(32), nullable=False)  # rss|atom|cisa_kev|certin_home|csk_alerts|doc_watch
    jurisdiction: Mapped[str] = mapped_column(String(32), default="global")
    language: Mapped[str] = mapped_column(String(8), default="en")
    trust: Mapped[str] = mapped_column(String(16), default="official")  # official|research|media
    interval_minutes: Mapped[int] = mapped_column(Integer, default=60)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=20)
    max_bytes: Mapped[int] = mapped_column(Integer, default=3_000_000)
    max_items: Mapped[int] = mapped_column(Integer, default=40)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    paused_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    license_notes: Mapped[str] = mapped_column(Text, default="")
    attribution: Mapped[str] = mapped_column(String(300), default="")

    last_attempt_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_item_published_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_attempt_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error_type: Mapped[str | None] = mapped_column(String(48), nullable=True)
    last_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    etag: Mapped[str | None] = mapped_column(String(300), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(100), nullable=True)
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    total_duplicates: Mapped[int] = mapped_column(Integer, default=0)


class SourceFetchRun(UUIDMixin, Base):
    """One ingestion attempt against one source (operational log)."""

    __tablename__ = "source_fetch_runs"

    source_key: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    started_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="running")  # ok|not_modified|error|running
    trigger: Mapped[str] = mapped_column(String(16), default="schedule")  # schedule|manual|test
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items_seen: Mapped[int] = mapped_column(Integer, default=0)
    items_new: Mapped[int] = mapped_column(Integer, default=0)
    items_updated: Mapped[int] = mapped_column(Integer, default=0)
    items_duplicate: Mapped[int] = mapped_column(Integer, default=0)
    items_rejected: Mapped[int] = mapped_column(Integer, default=0)
    error_type: Mapped[str | None] = mapped_column(String(48), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class LegalDocumentVersion(UUIDMixin, Base):
    """Snapshot of a legal record's metadata each time a change is detected."""

    __tablename__ = "legal_document_versions"

    law_id: Mapped[str] = mapped_column(ForeignKey("cyber_laws.id", ondelete="CASCADE"), index=True)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    captured_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    title: Mapped[str] = mapped_column(String(300), default="")
    legal_status: Mapped[str] = mapped_column(String(32), default="status_not_established")
    publication_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    effective_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    etag: Mapped[str | None] = mapped_column(String(300), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(100), nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (UniqueConstraint("law_id", "version_no", name="uq_legal_version"),)


class LegalChangeCandidate(UUIDMixin, Base):
    """A possible legal change found automatically. Never shown as a confirmed
    legal update unless the publishing policy accepts it."""

    __tablename__ = "legal_change_candidates"

    source_key: Mapped[str] = mapped_column(String(64), index=True)
    url: Mapped[str] = mapped_column(String(1024), default="")
    title: Mapped[str] = mapped_column(String(400), default="")
    change_type: Mapped[str] = mapped_column(String(24))  # new|updated|removed|keyword_match
    detected_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(24), default="open")  # open|auto_published|dismissed
    reason: Mapped[str] = mapped_column(Text, default="")
    law_id: Mapped[str | None] = mapped_column(ForeignKey("cyber_laws.id", ondelete="SET NULL"), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(64), unique=True)


class QuizQuestion(UUIDMixin, TimestampMixin, Base):
    """Verified question bank. Answer keys never leave the server before submission."""

    __tablename__ = "quiz_questions"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    qtype: Mapped[str] = mapped_column(String(24), default="single")  # single|true_false|scenario|indicator|next_action
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, default=list)
    answer_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[str] = mapped_column(String(16), default="beginner")  # beginner|intermediate|advanced
    category: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    lesson_slug: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    source_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    review_status: Mapped[str] = mapped_column(String(16), default="reviewed")  # draft|reviewed
    status: Mapped[str] = mapped_column(String(16), default="published")  # draft|published|archived
    updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class DailyTip(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "daily_tips"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(48), default="general")
    related_lesson: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="published")
    last_displayed_on: Mapped[dt.date | None] = mapped_column(Date, nullable=True)


class DailySelection(UUIDMixin, TimestampMixin, Base):
    """What everyone gets for a given day/week (lesson, quiz, tip, challenge, weekly).
    Persisted so a refresh never yields a different selection."""

    __tablename__ = "daily_selections"

    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # lesson|quiz|tip|challenge|weekly
    period: Mapped[str] = mapped_column(String(16), nullable=False)  # 2026-10-26 or 2026-W43
    refs: Mapped[list] = mapped_column(JSON, default=list)  # slugs
    meta: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (UniqueConstraint("kind", "period", name="uq_daily_selection"),)


class QuizAttempt(UUIDMixin, Base):
    __tablename__ = "quiz_attempts"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # daily|weekly|practice|lesson|challenge
    period: Mapped[str] = mapped_column(String(40), nullable=False)  # day/week, or a unique id for practice
    score: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    submitted_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    __table_args__ = (UniqueConstraint("user_id", "kind", "period", name="uq_quiz_attempt_period"),)


class QuizAnswer(UUIDMixin, Base):
    __tablename__ = "quiz_answers"

    attempt_id: Mapped[str] = mapped_column(ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True)
    question_slug: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(48), default="")
    choice: Mapped[int] = mapped_column(Integer)
    correct: Mapped[bool] = mapped_column(Boolean, default=False)


class LessonProgress(UUIDMixin, Base):
    __tablename__ = "lesson_progress"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    lesson_slug: Mapped[str] = mapped_column(String(80), nullable=False)
    viewed_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "lesson_slug", name="uq_lesson_progress"),)


class JobLock(Base):
    """Lease-based lock + status per scheduled job. Prevents duplicate execution
    across processes/instances; survives restarts (expired leases are reclaimed)."""

    __tablename__ = "job_locks"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner: Mapped[str | None] = mapped_column(String(120), nullable=True)
    locked_until: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_finished_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    run_count: Mapped[int] = mapped_column(Integer, default=0)


Index("ix_quiz_questions_cat_diff", QuizQuestion.category, QuizQuestion.difficulty)
