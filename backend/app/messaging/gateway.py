"""Privacy gateway: the only way content reaches the analysis engine.

For every item it checks the source belongs to the user, is connected, has active
consent and isn't paused; strips OTP / password / card values; deduplicates;
analyses; stores only what the dashboard needs; and raises an alert if warranted."""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models.messaging import MessageEvent, MonitoredSource, MonitoringSettings, ThreatAlert, UserConsent
from app.messaging import analysis
from app.messaging.schema import NormalizedMessage
from app.services import pii

DISCLOSURE_VERSION = "2026-11-03"
_MAX_TEXT = 20_000

# Secret values never leave the gateway: the words stay (they're evidence), the values go.
_OTP_VALUE = re.compile(r"(?i)\b(otp|one[- ]time (?:password|code)|verification code|security code|code|pin)"
                        r"(\s*(?:is|:|-|=)?\s*)(\d[\d\s-]{2,9}\d)\b")
_BARE_OTP = re.compile(r"(?i)\b(\d{4,8})\b(?=[^.\n]{0,40}\b(otp|one[- ]time|verification code|do not share)\b)")
_PASSWORD_VALUE = re.compile(r"(?i)\b(password|passcode|pwd)(\s*(?:is|:|=)\s*)(\S+)")


class GatewayRejected(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def strip_secrets(text: str) -> str:
    text = _OTP_VALUE.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED_OTP]", text)
    text = _BARE_OTP.sub("[REDACTED_OTP]", text)
    text = _PASSWORD_VALUE.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED_PASSWORD]", text)
    return text


def settings_for(session: Session, user_id: str) -> MonitoringSettings:
    row = session.scalars(select(MonitoringSettings).where(MonitoringSettings.user_id == user_id)).first()
    if row is None:
        row = MonitoringSettings(user_id=user_id)
        session.add(row)
        session.flush()
    return row


def has_consent(session: Session, source: MonitoredSource) -> bool:
    return session.scalars(select(UserConsent).where(
        UserConsent.source_id == source.id, UserConsent.revoked_at.is_(None))).first() is not None


def grant_consent(session: Session, source: MonitoredSource) -> None:
    if not has_consent(session, source):
        session.add(UserConsent(user_id=source.user_id, source_id=source.id,
                                disclosure_version=DISCLOSURE_VERSION, granted_at=utcnow()))
        session.flush()


def revoke_consent(session: Session, source: MonitoredSource) -> None:
    for c in session.scalars(select(UserConsent).where(
            UserConsent.source_id == source.id, UserConsent.revoked_at.is_(None))):
        c.revoked_at = utcnow()


def dedupe_key(source: MonitoredSource, msg: NormalizedMessage) -> str:
    if msg.external_id:
        basis = f"{source.id}|id|{msg.external_id}"
    else:
        # Notifications have no stable id: the same text from the same app within the
        # same 10 minutes is the same event (re-posts, group summaries, restarts).
        bucket = int((msg.received_at or utcnow()).timestamp() // 600)
        basis = f"{source.id}|{msg.source_application}|{bucket}|{msg.subject}|{msg.text}"
    return hashlib.sha256(basis.encode("utf-8", "ignore")).hexdigest()


@dataclass
class IngestResult:
    event: MessageEvent
    duplicate: bool
    alert: ThreatAlert | None


def ingest(session: Session, source: MonitoredSource, msg: NormalizedMessage, *,
           user_initiated: bool = False) -> IngestResult:
    """`user_initiated`: the user submitted this item themselves, so it is analysed
    even while automatic monitoring is paused."""
    if source.status != "connected":
        raise GatewayRejected("source_inactive", f"This source is {source.status.replace('_', ' ')}.")
    if not has_consent(session, source):
        raise GatewayRejected("no_consent", "Consent for this source hasn't been given.")
    prefs = settings_for(session, source.user_id)
    if prefs.paused and not user_initiated:
        raise GatewayRejected("paused", "Monitoring is paused.")
    allowed_apps = (source.scope_json or {}).get("apps")
    if msg.source_type == "notification" and allowed_apps is not None and msg.source_application not in allowed_apps:
        raise GatewayRejected("app_not_selected", "This app isn't selected for monitoring.")

    msg.text = strip_secrets(msg.text[:_MAX_TEXT])
    msg.subject = strip_secrets(msg.subject[:500])
    key = dedupe_key(source, msg)
    existing = session.scalars(select(MessageEvent).where(
        MessageEvent.user_id == source.user_id, MessageEvent.dedupe_key == key)).first()
    if existing is not None:
        return IngestResult(existing, True, None)

    result = analysis.analyze(session, msg)
    now = utcnow()
    preview = pii.redact(" ".join(msg.text.split()))[:300] if prefs.store_previews else ""
    event = MessageEvent(
        user_id=source.user_id, source_id=source.id, source_type=msg.source_type,
        source_provider=msg.source_provider, source_application=msg.source_application[:120],
        dedupe_key=key, received_at=msg.received_at,
        sender_display=pii.redact(msg.sender.display_name or msg.sender.email)[:200],
        sender_domain=msg.sender.domain[:255], subject_preview=pii.redact(msg.subject)[:200],
        preview=preview, completeness=msg.completeness, classification=result.classification,
        categories_json=result.categories, risk_level=result.risk_level, risk_score=result.risk_score,
        confidence=result.confidence, threat_category=result.threat_category,
        evidence_json=result.evidence, urls_json=result.urls, attachments_json=result.attachments,
        auth_json=result.auth, limitations_json=result.limitations,
        recommendations_json=result.recommendations, engine_version=result.engine_version,
        expires_at=now + dt.timedelta(days=max(1, prefs.retention_days)),
    )
    session.add(event)
    try:
        session.flush()
    except IntegrityError:  # the same item arrived twice at once
        session.rollback()
        existing = session.scalars(select(MessageEvent).where(
            MessageEvent.user_id == source.user_id, MessageEvent.dedupe_key == key)).first()
        return IngestResult(existing, True, None)
    source.events_analyzed = (source.events_analyzed or 0) + 1
    source.last_seen_at = now
    alert = maybe_alert(session, event, prefs, now)
    session.commit()
    return IngestResult(event, False, alert)


_LEVEL_ORDER = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1}


def _in_quiet_hours(prefs: MonitoringSettings, now: dt.datetime) -> bool:
    if not prefs.quiet_start or not prefs.quiet_end:
        return False
    try:
        local = now.astimezone(ZoneInfo(prefs.timezone)).strftime("%H:%M")
    except Exception:
        return False
    start, end = prefs.quiet_start, prefs.quiet_end
    return (start <= local < end) if start < end else (local >= start or local < end)


def maybe_alert(session: Session, event: MessageEvent, prefs: MonitoringSettings,
                now: dt.datetime) -> ThreatAlert | None:
    """One alert per event, at most. Below the user's chosen levels there's no alert;
    during quiet hours or past the hourly cap it's recorded but not pushed."""
    level = event.risk_level
    wanted = {"CRITICAL": prefs.alert_critical, "HIGH": prefs.alert_high, "MEDIUM": prefs.alert_medium}
    if level not in _LEVEL_ORDER or not wanted.get(level):
        return None
    suppressed = None
    if level != "CRITICAL" and _in_quiet_hours(prefs, now):
        suppressed = "quiet_hours"
    else:
        recent = session.scalar(select(func.count()).select_from(ThreatAlert).where(
            ThreatAlert.user_id == event.user_id, ThreatAlert.suppressed_reason.is_(None),
            ThreatAlert.created_at >= now - dt.timedelta(hours=1))) or 0
        if recent >= prefs.max_alerts_per_hour:
            suppressed = "rate_limited"
    label = {"SCAM": "Possible scam", "PHISHING": "Possible phishing", "SUSPICIOUS": "Suspicious message"}.get(
        event.classification, "Risky message")
    where = event.sender_display or event.source_application or event.source_provider
    alert = ThreatAlert(user_id=event.user_id, event_id=event.id, level=level,
                        title=f"{label}{f' from {where}' if where else ''}"[:200], suppressed_reason=suppressed)
    session.add(alert)
    return alert


def prune_expired(session: Session) -> int:
    """Retention: delete events past their expiry (alerts and feedback cascade)."""
    return delete_events(session, select(MessageEvent.id).where(MessageEvent.expires_at < utcnow()))


def delete_events(session: Session, id_query) -> int:
    """Delete events and everything derived from them. Explicit, so it doesn't depend
    on the database enforcing ON DELETE CASCADE (SQLite doesn't by default)."""
    from sqlalchemy import delete

    from app.db.models.messaging import MessageFeedback

    ids = list(session.scalars(id_query).all())
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        session.execute(delete(ThreatAlert).where(ThreatAlert.event_id.in_(chunk)))
        session.execute(delete(MessageFeedback).where(MessageFeedback.event_id.in_(chunk)))
        session.execute(delete(MessageEvent).where(MessageEvent.id.in_(chunk)))
    session.commit()
    return len(ids)
