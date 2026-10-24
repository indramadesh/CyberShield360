from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Date, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class NewsItem(UUIDMixin, TimestampMixin, Base):
    """Cybersecurity news. Summaries may be LLM-generated FROM source material;
    news is never invented (spec §35)."""

    __tablename__ = "news_items"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(120), default="")
    source_url: Mapped[str] = mapped_column(String(512), default="")
    published_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), index=True, nullable=True)
    category: Mapped[str] = mapped_column(String(48), default="general")
    region: Mapped[str] = mapped_column(String(32), default="global")
    severity: Mapped[str] = mapped_column(String(16), default="info")


class CyberLaw(UUIDMixin, TimestampMixin, Base):
    """Cyber-law / regulation tracker entry. Not legal advice (spec §36)."""

    __tablename__ = "cyber_laws"

    authority: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    publication_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    effective_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="in_force")
    official_source: Mapped[str] = mapped_column(String(512), default="")
    plain_summary: Mapped[str] = mapped_column(Text, default="")


class OfficialOrg(UUIDMixin, Base):
    """Known organizations and their official channels, for impersonation checks."""

    __tablename__ = "official_orgs"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    official_domains: Mapped[list] = mapped_column(JSON, default=list)
    official_apps: Mapped[list] = mapped_column(JSON, default=list)
    support_channels: Mapped[list] = mapped_column(JSON, default=list)
