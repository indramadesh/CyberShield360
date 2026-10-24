from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class CommunityReport(UUIDMixin, TimestampMixin, Base):
    """A user-submitted suspicious indicator. Unverified reports NEVER publicly
    label a person as a criminal (spec §40). Moderated before any promotion."""

    __tablename__ = "community_reports"

    reporter_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    indicator_type: Mapped[str] = mapped_column(String(16), nullable=False)  # url|phone|email|upi|...
    value: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="PENDING")  # PENDING|REVIEWING|ACCEPTED|REJECTED
    dupe_group: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    confidence: Mapped[float] = mapped_column(default=0.3)

    __table_args__ = (Index("ix_report_type_value", "indicator_type", "value"),)
