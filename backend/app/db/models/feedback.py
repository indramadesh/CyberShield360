from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ScanFeedback(UUIDMixin, TimestampMixin, Base):
    """User feedback on an assessment. Stored separately from ground-truth labels;
    feedback is NOT treated as automatically correct (spec §88)."""

    __tablename__ = "scan_feedback"

    scan_id: Mapped[str] = mapped_column(
        ForeignKey("scans.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    useful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    marked_wrong: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
