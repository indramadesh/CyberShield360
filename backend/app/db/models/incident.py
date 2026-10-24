from __future__ import annotations

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Incident(UUIDMixin, TimestampMixin, Base):
    """An 'I think I was scammed' session: the user's answers + tailored guidance.
    We never auto-file an official report (spec §33)."""

    __tablename__ = "incidents"

    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    answers_json: Mapped[dict] = mapped_column(JSON, default=dict)
    guidance_json: Mapped[dict] = mapped_column(JSON, default=dict)
    severity: Mapped[str] = mapped_column(String(16), default="LOW")
