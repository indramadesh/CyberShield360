from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import ScanStatus
from app.db.base import Base, TimestampMixin, UUIDMixin


class Scan(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "scans"

    # Nullable user_id => anonymous scan.
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    scan_type: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=ScanStatus.COMPLETE.value)

    risk_level: Mapped[str | None] = mapped_column(String(16), index=True, nullable=True)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Redacted representation of the input by default (raw only if opted in).
    input_ref: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Flexible, provider-specific detail — normalized fields stay columns above.
    evidence_json: Mapped[dict] = mapped_column(JSON, default=dict)
    provider_results_json: Mapped[dict] = mapped_column(JSON, default=dict)

    request_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Drives retention cleanup (DATA_RETENTION_DAYS).
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_scans_user_created", "user_id", "created_at"),)
