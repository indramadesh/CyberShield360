from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, Float, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class ThreatIntel(UUIDMixin, TimestampMixin, Base):
    """Local threat-intelligence store. Holds internal/demo indicators and cached
    hits promoted from external providers or community reports. Always available
    offline, so it is never a single point of failure (spec §27/§69)."""

    __tablename__ = "threat_intel"

    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    indicator: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    indicator_type: Mapped[str] = mapped_column(String(16), nullable=False)  # url|domain|ip|...
    threat_type: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    first_seen: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("provider", "indicator", name="uq_intel_provider_indicator"),
        Index("ix_intel_indicator_type", "indicator", "indicator_type"),
    )
