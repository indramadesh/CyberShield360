from __future__ import annotations

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AppConfig(TimestampMixin, Base):
    """Admin-editable runtime overrides (feature flags, thresholds, retention,
    rate limits) applied on top of env settings without a redeploy (spec §84)."""

    __tablename__ = "app_config"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value_json: Mapped[dict] = mapped_column(JSON, default=dict)
