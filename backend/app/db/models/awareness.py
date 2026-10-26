from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class AwarenessContent(UUIDMixin, TimestampMixin, Base):
    """A lesson in the Learn module. CMS-editable (admin). quiz_json holds a list
    of {question, options[], answer_index, explanation}."""

    __tablename__ = "awareness_content"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(48), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    body_md: Mapped[str] = mapped_column(Text, default="")
    quiz_json: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="published")  # draft|published|archived

    # ---- Structured lesson fields (nullable: added to an existing table) ----
    difficulty: Mapped[str | None] = mapped_column(String(16), nullable=True)  # beginner|intermediate|advanced
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    example: Mapped[str | None] = mapped_column(Text, nullable=True)
    warning_signs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    prevention: Mapped[list | None] = mapped_column(JSON, nullable=True)
    related_slugs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    source_refs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    review_status: Mapped[str | None] = mapped_column(String(16), nullable=True)  # draft|reviewed
    library_version: Mapped[int | None] = mapped_column(nullable=True)
    updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Challenge(UUIDMixin, TimestampMixin, Base):
    """A gamified daily challenge (Scam-or-Safe / Spot-the-Phish / etc.)."""

    __tablename__ = "challenges"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="scam_or_safe")
    question: Mapped[str] = mapped_column(Text, nullable=False)
    options_json: Mapped[list] = mapped_column(JSON, default=list)
    answer_index: Mapped[int] = mapped_column(default=0)
    explanation: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
