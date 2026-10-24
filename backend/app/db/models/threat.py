from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ThreatCategory(Base):
    """Admin-configurable; seeded from DEFAULT_THREAT_CATEGORIES. Code is the PK
    so the frontend/API reference stable identifiers, not hard-coded lists."""

    __tablename__ = "threat_categories"

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
