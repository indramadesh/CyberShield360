"""Message & email intelligence: connected sources, consent, device pairing,
encrypted OAuth tokens, analysed events, alerts, preferences and feedback.

Message bodies are never stored: an event keeps a short redacted preview (if the
user allows it), the extracted indicators and the analysis result."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class MonitoredSource(UUIDMixin, TimestampMixin, Base):
    """One connected source: an Android device, a Gmail/Outlook account, the extension…"""

    __tablename__ = "msg_sources"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # android_notifications|gmail|outlook|browser_extension|ios_share|manual
    label: Mapped[str] = mapped_column(String(120), default="")
    # The provider account (email) or device name, for display and uniqueness.
    account: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(24), default="connected")  # connected|paused|permission_revoked|error|disconnected
    permission_state: Mapped[str] = mapped_column(String(24), default="granted")  # granted|revoked|unknown
    # Source-specific scope, e.g. {"apps": ["com.whatsapp"]} or {"folders": ["INBOX"]}.
    scope_json: Mapped[dict] = mapped_column(JSON, default=dict)
    sync_cursor: Mapped[str | None] = mapped_column(Text, nullable=True)  # Gmail historyId / Graph deltaLink
    last_sync_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    events_analyzed: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (UniqueConstraint("user_id", "kind", "account", name="ux_msg_sources_user_kind_account"),)


class UserConsent(UUIDMixin, TimestampMixin, Base):
    """Explicit consent per source and purpose. Revoking consent stops ingestion."""

    __tablename__ = "msg_consents"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("msg_sources.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(40), default="threat_analysis")
    disclosure_version: Mapped[str] = mapped_column(String(16))
    granted_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PairingCode(UUIDMixin, TimestampMixin, Base):
    """Short-lived one-time code a signed-in user creates to pair a device."""

    __tablename__ = "msg_pairing_codes"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)
    kind: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class DeviceCredential(UUIDMixin, TimestampMixin, Base):
    """Revocable token held by a paired device. Only its SHA-256 is stored."""

    __tablename__ = "msg_device_credentials"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("msg_sources.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    platform: Mapped[str] = mapped_column(String(24))
    revoked_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OAuthToken(UUIDMixin, TimestampMixin, Base):
    """Provider tokens, encrypted at rest (Fernet). Never returned by any API."""

    __tablename__ = "msg_oauth_tokens"

    source_id: Mapped[str] = mapped_column(ForeignKey("msg_sources.id", ondelete="CASCADE"), unique=True)
    provider: Mapped[str] = mapped_column(String(16))
    refresh_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scopes: Mapped[str] = mapped_column(String(500), default="")


class OAuthState(UUIDMixin, TimestampMixin, Base):
    """CSRF state + PKCE verifier for an in-progress OAuth connection."""

    __tablename__ = "msg_oauth_states"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(16))
    state_hash: Mapped[str] = mapped_column(String(64), unique=True)
    verifier_enc: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))


class MessageEvent(UUIDMixin, TimestampMixin, Base):
    """One analysed message, email or notification."""

    __tablename__ = "msg_events"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str | None] = mapped_column(ForeignKey("msg_sources.id", ondelete="SET NULL"), nullable=True)
    source_type: Mapped[str] = mapped_column(String(16))  # email|notification|sms|shared_text
    source_provider: Mapped[str] = mapped_column(String(32), default="")  # gmail|outlook|android|extension|…
    source_application: Mapped[str] = mapped_column(String(120), default="")  # e.g. com.whatsapp
    dedupe_key: Mapped[str] = mapped_column(String(64))
    received_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sender_display: Mapped[str] = mapped_column(String(200), default="")
    sender_domain: Mapped[str] = mapped_column(String(255), default="")
    subject_preview: Mapped[str] = mapped_column(String(200), default="")
    preview: Mapped[str] = mapped_column(String(400), default="")  # redacted; empty if previews are off
    completeness: Mapped[str] = mapped_column(String(16))  # full|partial|preview|metadata
    classification: Mapped[str] = mapped_column(String(24), index=True)
    categories_json: Mapped[list] = mapped_column(JSON, default=list)
    risk_level: Mapped[str] = mapped_column(String(16), index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    threat_category: Mapped[str] = mapped_column(String(32), default="OTHER")
    evidence_json: Mapped[list] = mapped_column(JSON, default=list)
    urls_json: Mapped[list] = mapped_column(JSON, default=list)
    attachments_json: Mapped[list] = mapped_column(JSON, default=list)
    auth_json: Mapped[dict] = mapped_column(JSON, default=dict)
    limitations_json: Mapped[list] = mapped_column(JSON, default=list)
    recommendations_json: Mapped[list] = mapped_column(JSON, default=list)
    engine_version: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "dedupe_key", name="ux_msg_events_user_dedupe"),
        Index("ix_msg_events_user_created", "user_id", "created_at"),
    )


class ThreatAlert(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "msg_alerts"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("msg_events.id", ondelete="CASCADE"), unique=True)
    level: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(16), default="new")  # new|seen|dismissed
    # Set when the alert was held back (quiet hours / level preferences): shown in the
    # dashboard, but not pushed to devices.
    suppressed_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)


class MonitoringSettings(UUIDMixin, TimestampMixin, Base):
    """Per-user preferences. Defaults are the minimal-collection choice."""

    __tablename__ = "msg_settings"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    store_previews: Mapped[bool] = mapped_column(Boolean, default=False)
    retention_days: Mapped[int] = mapped_column(Integer, default=30)
    alert_critical: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_high: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_medium: Mapped[bool] = mapped_column(Boolean, default=False)
    quiet_start: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "22:00"
    quiet_end: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "07:00"
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    max_alerts_per_hour: Mapped[int] = mapped_column(Integer, default=10)


class MessageFeedback(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "msg_feedback"

    event_id: Mapped[str] = mapped_column(ForeignKey("msg_events.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    verdict: Mapped[str] = mapped_column(String(16))  # correct|incorrect
    suggested_classification: Mapped[str | None] = mapped_column(String(24), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (UniqueConstraint("event_id", "user_id", name="ux_msg_feedback_event_user"),)
