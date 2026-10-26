from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Boolean, Date, DateTime, Index, String, Text
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

    # ---- Content engine (all nullable: added to an existing table) ----
    # Ingestion date is `created_at`; `published_at` is ALWAYS the source's own date
    # (NULL when the source gives none — never the fetch time).
    source_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    external_id: Mapped[str | None] = mapped_column(String(400), nullable=True)
    canonical_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    title_norm: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    kind: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)  # news|advisory|vulnerability|alert
    source_updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    severity_origin: Mapped[str | None] = mapped_column(String(16), nullable=True)  # source|system|none
    category_origin: Mapped[str | None] = mapped_column(String(16), nullable=True)  # source|system
    status: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)  # published|withheld
    language: Mapped[str | None] = mapped_column(String(8), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)


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

    # ---- Content engine (nullable: added to an existing table) ----
    jurisdiction: Mapped[str | None] = mapped_column(String(32), nullable=True)
    document_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # act|rules|directions|notification|press_release|policy
    # draft|consultation|published_notification|enacted|commencement_notification|
    # effective|amendment|repealed|superseded|status_not_established
    legal_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    commencement_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    related_legislation: Mapped[list | None] = mapped_column(JSON, nullable=True)
    amends: Mapped[str | None] = mapped_column(String(300), nullable=True)
    document_ref: Mapped[str | None] = mapped_column(String(200), nullable=True)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_provenance: Mapped[str | None] = mapped_column(String(16), nullable=True)  # curated|source|system
    verification_status: Mapped[str | None] = mapped_column(String(24), nullable=True)  # verified|unverified
    last_checked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    etag: Mapped[str | None] = mapped_column(String(300), nullable=True)
    last_modified: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_published: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class OfficialOrg(UUIDMixin, Base):
    """Known organizations and their official channels, for impersonation checks."""

    __tablename__ = "official_orgs"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    official_domains: Mapped[list] = mapped_column(JSON, default=list)
    official_apps: Mapped[list] = mapped_column(JSON, default=list)
    support_channels: Mapped[list] = mapped_column(JSON, default=list)


Index("ux_news_items_canonical_url", NewsItem.canonical_url, unique=True)
Index("ix_news_items_source_ext", NewsItem.source_key, NewsItem.external_id)
Index("ux_cyber_laws_slug", CyberLaw.slug, unique=True)
