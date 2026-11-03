"""Message & email intelligence API (/msgintel).

Users authenticate with their normal session. Paired devices (Android app,
browser extension) authenticate with `X-Device-Token`, which can only submit
items and report status for its own source. The user is always derived on the
server; no endpoint accepts a user id from the client."""
from __future__ import annotations

import datetime as dt
from email import message_from_string
from typing import Literal

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user, require_feature
from app.core.config import settings
from app.core.errors import AppError, AuthError, NotFoundError, ValidationAppError
from app.db.base import utcnow
from app.db.models.messaging import (
    DeviceCredential, MessageEvent, MessageFeedback, MonitoredSource, PairingCode, ThreatAlert,
)
from app.db.models.user import User
from app.messaging import analysis, crypto, gateway
from app.messaging.connectors import mailparse, oauth
from app.messaging.schema import NormalizedMessage, Sender
from app.schemas.common import ok
from app.services import audit

router = APIRouter(prefix="/msgintel", tags=["message-intelligence"],
                   dependencies=[Depends(require_feature("message_protection"))])

PAIRABLE = ("android_notifications", "browser_extension")
_PAIR_TTL = dt.timedelta(minutes=10)
_ONLINE_WINDOW = {"android_notifications": dt.timedelta(hours=26), "browser_extension": dt.timedelta(days=8)}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _aware(d):
    return None if d is None else (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc))


def _iso(d):
    d = _aware(d)
    return d.isoformat() if d else None


class Conflict(AppError):
    status_code = 409
    code = "CONFLICT"


# ---------------------------------------------------------------- serialisers

def source_dict(s: MonitoredSource) -> dict:
    window = _ONLINE_WINDOW.get(s.kind)
    seen = _aware(s.last_seen_at or s.last_sync_at)
    state = s.status
    if state == "connected" and window and (seen is None or utcnow() - seen > window):
        state = "not_reporting" if seen else "never_reported"
    if state == "connected" and s.kind in ("gmail", "outlook") and s.last_sync_at is None:
        state = "never_synced"
    return {
        "id": s.id, "kind": s.kind, "label": s.label or s.account, "account": s.account,
        "status": s.status, "display_state": state, "permission_state": s.permission_state,
        "scope": s.scope_json or {}, "last_sync_at": _iso(s.last_sync_at), "last_seen_at": _iso(s.last_seen_at),
        "last_error": s.last_error, "events_analyzed": s.events_analyzed or 0, "connected_at": _iso(s.created_at),
    }


def event_dict(e: MessageEvent, *, full: bool = False) -> dict:
    out = {
        "id": e.id, "source_id": e.source_id, "source_type": e.source_type, "source_provider": e.source_provider,
        "source_application": e.source_application, "received_at": _iso(e.received_at),
        "analyzed_at": _iso(e.created_at), "sender": e.sender_display, "sender_domain": e.sender_domain,
        "subject": e.subject_preview, "preview": e.preview, "classification": e.classification,
        "categories": e.categories_json or [], "risk_level": e.risk_level, "risk_score": e.risk_score,
        "confidence": e.confidence, "threat_category": e.threat_category, "completeness": e.completeness,
    }
    if full:
        out.update({
            "evidence": e.evidence_json or [], "urls": e.urls_json or [], "attachments": e.attachments_json or [],
            "authentication": e.auth_json or {}, "limitations": e.limitations_json or [],
            "recommendations": e.recommendations_json or [], "engine_version": e.engine_version,
            "expires_at": _iso(e.expires_at),
        })
    return out


def alert_dict(a: ThreatAlert) -> dict:
    return {"id": a.id, "event_id": a.event_id, "level": a.level, "title": a.title, "status": a.status,
            "suppressed_reason": a.suppressed_reason, "created_at": _iso(a.created_at)}


def settings_dict(p) -> dict:
    return {k: getattr(p, k) for k in ("paused", "store_previews", "retention_days", "alert_critical",
                                       "alert_high", "alert_medium", "quiet_start", "quiet_end", "timezone",
                                       "max_alerts_per_hour")}


def _own_source(session: Session, user: User, source_id: str) -> MonitoredSource:
    s = session.get(MonitoredSource, source_id)
    if s is None or s.user_id != user.id:
        raise NotFoundError("Source not found.")
    return s


def _own_event(session: Session, user: User, event_id: str) -> MessageEvent:
    e = session.get(MessageEvent, event_id)
    if e is None or e.user_id != user.id:
        raise NotFoundError("Item not found.")
    return e


# ---------------------------------------------------------------- capabilities + overview

@router.get("/capabilities")
def capabilities(request: Request):
    p = oauth.providers()
    return ok({
        "connectors": {
            "gmail": {"available": p["gmail"].configured, "read_only": True, "scopes": list(p["gmail"].scopes),
                      "note": None if p["gmail"].configured else "Gmail connection isn't set up on this server yet."},
            "outlook": {"available": p["outlook"].configured, "read_only": True, "scopes": list(p["outlook"].scopes),
                        "note": None if p["outlook"].configured else "Outlook connection isn't set up on this server yet."},
            "android_notifications": {"available": True, "pairing": True,
                                      "note": "Needs the CyberShield360 Android app and Notification access."},
            "browser_extension": {"available": True, "pairing": True,
                                  "note": "Checks text you select (right-click). It doesn't read your inbox."},
            "ios": {"available": False,
                    "note": "iOS share and SMS-filter extensions are written but not yet built or tested."},
        },
        "not_possible": [
            "Reading WhatsApp, Telegram or Signal conversations (no API; Android notifications only show what the notification contains).",
            "Reading SMS or iMessage on iPhone (only SMS from unknown senders, through Apple's message filter).",
            "Reading one-time codes on Android 15 and later (the system hides them from apps like ours).",
        ],
        "disclosure_version": gateway.DISCLOSURE_VERSION,
    }, _rid(request))


@router.get("/overview")
def overview(request: Request, user: User = Depends(get_current_user), session: Session = Depends(db_session)):
    sources = session.scalars(select(MonitoredSource).where(
        MonitoredSource.user_id == user.id, MonitoredSource.status != "disconnected")).all()
    base = select(func.count()).select_from(MessageEvent).where(MessageEvent.user_id == user.id)
    count = lambda *w: session.scalar(base.where(*w)) or 0  # noqa: E731
    alerts = session.scalars(select(ThreatAlert).where(ThreatAlert.user_id == user.id)
                             .order_by(ThreatAlert.created_at.desc()).limit(5)).all()
    last_sync = max((_aware(s.last_sync_at or s.last_seen_at) for s in sources
                     if s.last_sync_at or s.last_seen_at), default=None)
    prefs = gateway.settings_for(session, user.id)
    session.commit()
    return ok({
        "paused": prefs.paused,
        "sources": [source_dict(s) for s in sources],
        "counts": {
            "emails_analyzed": count(MessageEvent.source_type == "email"),
            "messages_analyzed": count(MessageEvent.source_type != "email"),
            "threats": count(MessageEvent.classification.in_(("SCAM", "PHISHING"))),
            "suspicious": count(MessageEvent.classification == "SUSPICIOUS"),
            "unread_alerts": session.scalar(select(func.count()).select_from(ThreatAlert).where(
                ThreatAlert.user_id == user.id, ThreatAlert.status == "new")) or 0,
        },
        "last_sync_at": _iso(last_sync),
        "recent_alerts": [alert_dict(a) for a in alerts],
    }, _rid(request))


# ---------------------------------------------------------------- sources

@router.get("/sources")
def list_sources(request: Request, user: User = Depends(get_current_user), session: Session = Depends(db_session)):
    rows = session.scalars(select(MonitoredSource).where(MonitoredSource.user_id == user.id)
                           .order_by(MonitoredSource.created_at)).all()
    return ok([source_dict(s) for s in rows], _rid(request))


class SourcePatch(BaseModel):
    status: Literal["connected", "paused"] | None = None
    apps: list[str] | None = Field(default=None, max_length=50)


@router.patch("/sources/{source_id}")
def patch_source(source_id: str, body: SourcePatch, request: Request, user: User = Depends(get_current_user),
                 session: Session = Depends(db_session)):
    s = _own_source(session, user, source_id)
    if s.status in ("disconnected",):
        raise Conflict("This source was disconnected. Connect it again instead.")
    if body.status:
        if body.status == "connected" and s.status == "permission_revoked":
            raise Conflict("Permission was revoked on the device or provider. Grant it there first.")
        s.status = body.status
    if body.apps is not None:
        s.scope_json = {**(s.scope_json or {}), "apps": sorted({a[:120] for a in body.apps})}
    session.commit()
    return ok(source_dict(s), _rid(request))


@router.delete("/sources/{source_id}")
def disconnect_source(source_id: str, request: Request, delete_history: bool = False,
                      user: User = Depends(get_current_user), session: Session = Depends(db_session)):
    s = _own_source(session, user, source_id)
    note = ""
    if s.kind in ("gmail", "outlook"):
        note = oauth.disconnect(session, s)
    else:
        gateway.revoke_consent(session, s)
        for cred in session.scalars(select(DeviceCredential).where(
                DeviceCredential.source_id == s.id, DeviceCredential.revoked_at.is_(None))):
            cred.revoked_at = utcnow()
        s.status = "disconnected"
        session.commit()
    removed = 0
    if delete_history:
        removed = gateway.delete_events(session, select(MessageEvent.id).where(
            MessageEvent.user_id == user.id, MessageEvent.source_id == s.id))
    audit.record(session, action="msgintel.source_disconnected", actor_id=user.id, target=s.id,
                 meta={"kind": s.kind, "history_deleted": removed}, request_id=_rid(request))
    return ok({"source": source_dict(s), "note": note, "events_deleted": removed}, _rid(request))


# ---------------------------------------------------------------- pairing (Android app, extension)

class PairingRequest(BaseModel):
    kind: Literal["android_notifications", "browser_extension"]
    consent: bool


@router.post("/pairing")
def create_pairing(body: PairingRequest, request: Request, user: User = Depends(get_current_user),
                   session: Session = Depends(db_session)):
    if not body.consent:
        raise ValidationAppError("Please confirm you've read what this source collects.")
    code = crypto.new_pairing_code()
    session.add(PairingCode(user_id=user.id, code_hash=crypto.token_hash(crypto.normalize_code(code)),
                            kind=body.kind, expires_at=utcnow() + _PAIR_TTL))
    session.commit()
    return ok({"code": code, "expires_in_seconds": int(_PAIR_TTL.total_seconds()), "kind": body.kind}, _rid(request))


class DevicePair(BaseModel):
    code: str = Field(min_length=8, max_length=12)
    device_name: str = Field(default="", max_length=80)
    platform: Literal["android", "chrome", "edge", "other"] = "other"


@router.post("/devices/pair")
def pair_device(body: DevicePair, request: Request, session: Session = Depends(db_session)):
    """Exchange a one-time code (shown in the signed-in web app) for a device token."""
    row = session.scalars(select(PairingCode).where(
        PairingCode.code_hash == crypto.token_hash(crypto.normalize_code(body.code)))).first()
    if row is None or row.used_at is not None or _aware(row.expires_at) < utcnow():
        raise AuthError("This code is invalid or has expired. Create a new one in the web app.")
    row.used_at = utcnow()
    name = (body.device_name or body.platform).strip()[:80]
    source = MonitoredSource(user_id=row.user_id, kind=row.kind, account=f"{name} · {crypto.new_pairing_code()}",
                             label=name, scope_json={"apps": []} if row.kind == "android_notifications" else {},
                             permission_state="unknown" if row.kind == "android_notifications" else "granted")
    session.add(source)
    session.flush()
    token = crypto.new_device_token()
    session.add(DeviceCredential(user_id=row.user_id, source_id=source.id, token_hash=crypto.token_hash(token),
                                 platform=body.platform))
    gateway.grant_consent(session, source)
    session.commit()
    audit.record(session, action="msgintel.device_paired", actor_id=row.user_id, target=source.id,
                 meta={"kind": row.kind, "platform": body.platform}, request_id=_rid(request))
    return ok({"device_token": token, "source": source_dict(source)}, _rid(request))


def device_source(x_device_token: str | None = Header(default=None),
                  session: Session = Depends(db_session)) -> MonitoredSource:
    if not x_device_token:
        raise AuthError("Device token required.")
    cred = session.scalars(select(DeviceCredential).where(
        DeviceCredential.token_hash == crypto.token_hash(x_device_token))).first()
    if cred is None or cred.revoked_at is not None:
        raise AuthError("This device was disconnected. Pair it again from the web app.")
    source = session.get(MonitoredSource, cred.source_id)
    if source is None or source.status == "disconnected":
        raise AuthError("This device was disconnected. Pair it again from the web app.")
    return source


@router.get("/device/config")
def device_config(request: Request, source: MonitoredSource = Depends(device_source),
                  session: Session = Depends(db_session)):
    prefs = gateway.settings_for(session, source.user_id)
    session.commit()
    return ok({"source_id": source.id, "status": source.status, "paused": prefs.paused,
               "apps": (source.scope_json or {}).get("apps", [])}, _rid(request))


class DeviceStatus(BaseModel):
    notification_access: bool | None = None
    # Apps the user picked on the phone. The phone never reports its full app list.
    selected_apps: list[str] | None = Field(default=None, max_length=50)
    paused: bool | None = None
    app_version: str = Field(default="", max_length=32)


@router.post("/device/status")
def device_status(body: DeviceStatus, request: Request, source: MonitoredSource = Depends(device_source),
                  session: Session = Depends(db_session)):
    source.last_seen_at = utcnow()
    if body.notification_access is not None:
        source.permission_state = "granted" if body.notification_access else "revoked"
        if not body.notification_access and source.status == "connected":
            source.status = "permission_revoked"
        elif body.notification_access and source.status == "permission_revoked":
            source.status = "connected"
    if body.selected_apps is not None:
        source.scope_json = {**(source.scope_json or {}), "apps": sorted({a[:120] for a in body.selected_apps})}
    if body.paused is not None and source.status in ("connected", "paused"):
        source.status = "paused" if body.paused else "connected"
    session.commit()
    return ok(source_dict(source), _rid(request))


class DeviceItem(BaseModel):
    source_type: Literal["notification", "shared_text"]
    app: str = Field(default="", max_length=120)
    title: str = Field(default="", max_length=500)
    text: str = Field(default="", max_length=8000)
    posted_at: dt.datetime | None = None
    external_id: str = Field(default="", max_length=200)
    complete: bool = False


class DeviceBatch(BaseModel):
    items: list[DeviceItem] = Field(min_length=1, max_length=25)


@router.post("/device/events")
def device_events(body: DeviceBatch, request: Request, source: MonitoredSource = Depends(device_source),
                  session: Session = Depends(db_session)):
    provider = "android" if source.kind == "android_notifications" else "extension"
    results = []
    for item in body.items:
        msg = NormalizedMessage(
            source_type=item.source_type, source_provider=provider, source_application=item.app,
            external_id=item.external_id, received_at=item.posted_at, subject=item.title, text=item.text,
            sender=Sender(display_name=item.title[:120] if item.source_type == "notification" else ""),
            completeness="full" if item.complete else ("partial" if item.text else "metadata"),
            collection_method="notification_listener" if item.source_type == "notification" else "context_menu",
        )
        try:
            res = gateway.ingest(session, source, msg)
        except gateway.GatewayRejected as exc:
            session.rollback()
            results.append({"accepted": False, "reason": exc.code, "message": exc.message})
            continue
        e = res.event
        results.append({"accepted": True, "duplicate": res.duplicate, "event_id": e.id,
                        "classification": e.classification, "risk_level": e.risk_level,
                        "risk_score": e.risk_score, "confidence": e.confidence,
                        "alert": bool(res.alert and not res.alert.suppressed_reason),
                        "headline": (e.evidence_json or [{}])[0].get("summary") if e.evidence_json else None,
                        "report_path": f"/app/protection/items/{e.id}"})
    return ok({"results": results}, _rid(request))


# ---------------------------------------------------------------- iOS message filter (network deferral)

class _IosMessage(BaseModel):
    text: str = Field(default="", max_length=8000)


class _IosQuery(BaseModel):
    sender: str = Field(default="", max_length=64)
    message: _IosMessage = _IosMessage()


class IosFilterRequest(BaseModel):
    """The body Apple's servers POST for an ILMessageFilterExtension that defers to the
    network: {"_version": 1, "query": {"sender": …, "message": {"text": …}}, "app": {…}}."""
    query: _IosQuery


@router.post("/ios/message-filter")
def ios_message_filter(body: IosFilterRequest, request: Request, session: Session = Depends(db_session)):
    """Classify one SMS from an unknown sender for the iOS Message Filter extension.

    Apple sends no user identity, so nothing is stored: the message is analysed in
    memory and only the verdict is returned. The response format is ours (the
    extension parses it); `action` maps to ILMessageFilterAction."""
    text = gateway.strip_secrets(body.query.message.text)
    result = analysis.analyze(session, NormalizedMessage(
        source_type="sms", source_provider="ios", text=text, completeness="full", collection_method="ios_filter"))
    session.rollback()  # nothing to keep
    action = {"SCAM": "junk", "PHISHING": "junk", "SPAM": "junk", "PROMOTIONAL": "promotion"}.get(result.classification)
    if action is None and result.classification == "SUSPICIOUS" and result.risk_level == "HIGH":
        action = "junk"
    return {"action": action or "none", "classification": result.classification,
            "risk_level": result.risk_level, "engine_version": result.engine_version}


# ---------------------------------------------------------------- manual analysis (web app)

class ManualAnalyze(BaseModel):
    kind: Literal["message", "email"]
    content: str = Field(min_length=1, max_length=20_000)


def _manual_source(session: Session, user: User) -> MonitoredSource:
    s = session.scalars(select(MonitoredSource).where(
        MonitoredSource.user_id == user.id, MonitoredSource.kind == "manual")).first()
    if s is None:
        s = MonitoredSource(user_id=user.id, kind="manual", account="manual", label="Checked by you")
        session.add(s)
        session.flush()
    if s.status != "connected":
        s.status = "connected"
    gateway.grant_consent(session, s)  # the user submitted it themselves
    return s


@router.post("/analyze")
def analyze_manual(body: ManualAnalyze, request: Request, user: User = Depends(get_current_user),
                   session: Session = Depends(db_session)):
    source = _manual_source(session, user)
    if body.kind == "email":
        m = message_from_string(body.content)
        text = ""
        if m.is_multipart():
            for part in m.walk():
                if part.get_content_type() == "text/plain":
                    text += str(part.get_payload(decode=False) or "")
        else:
            text = str(m.get_payload(decode=False) or "")
        if not text.strip() and not m.get("From"):
            text = body.content
        # Pasted headers can be forged, so they are never trusted for SPF/DKIM/DMARC
        # (provider "manual" has no trusted authentication source).
        msg = NormalizedMessage(
            source_type="email", source_provider="manual", source_application="pasted email",
            sender=mailparse.sender_from(m.get("From", "")), subject=m.get("Subject", "") or "",
            text=text, reply_to=m.get("Reply-To", "") or "", headers=mailparse.headers_map(list(m.items())),
            completeness="full", collection_method="manual")
    else:
        msg = NormalizedMessage(source_type="shared_text", source_provider="manual", text=body.content,
                                completeness="full", collection_method="manual")
    res = gateway.ingest(session, source, msg, user_initiated=True)
    return ok(event_dict(res.event, full=True), _rid(request))


# ---------------------------------------------------------------- history + reports

@router.get("/events")
def list_events(request: Request, classification: str | None = None, source_id: str | None = None,
                source_type: str | None = None, since: dt.date | None = None, until: dt.date | None = None,
                page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                user: User = Depends(get_current_user), session: Session = Depends(db_session)):
    q = select(MessageEvent).where(MessageEvent.user_id == user.id)
    if classification:
        if classification not in analysis.CLASSIFICATIONS:
            raise ValidationAppError("Unknown classification.")
        q = q.where(MessageEvent.classification == classification)
    if source_id:
        q = q.where(MessageEvent.source_id == source_id)
    if source_type:
        q = q.where(MessageEvent.source_type == source_type)
    if since:
        q = q.where(MessageEvent.created_at >= dt.datetime.combine(since, dt.time.min, dt.timezone.utc))
    if until:
        q = q.where(MessageEvent.created_at < dt.datetime.combine(until + dt.timedelta(days=1), dt.time.min, dt.timezone.utc))
    total = session.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = session.scalars(q.order_by(MessageEvent.created_at.desc())
                           .offset((page - 1) * page_size).limit(page_size)).all()
    return ok({"items": [event_dict(e) for e in rows], "total": total, "page": page, "page_size": page_size,
               "has_more": page * page_size < total}, _rid(request))


@router.get("/events/{event_id}")
def get_event(event_id: str, request: Request, user: User = Depends(get_current_user),
              session: Session = Depends(db_session)):
    e = _own_event(session, user, event_id)
    data = event_dict(e, full=True)
    src = session.get(MonitoredSource, e.source_id) if e.source_id else None
    data["source"] = source_dict(src) if src else None
    fb = session.scalars(select(MessageFeedback).where(
        MessageFeedback.event_id == e.id, MessageFeedback.user_id == user.id)).first()
    data["feedback"] = {"verdict": fb.verdict, "suggested_classification": fb.suggested_classification} if fb else None
    alert = session.scalars(select(ThreatAlert).where(ThreatAlert.event_id == e.id)).first()
    if alert and alert.status == "new":
        alert.status = "seen"
        session.commit()
    return ok(data, _rid(request))


class Feedback(BaseModel):
    verdict: Literal["correct", "incorrect"]
    suggested_classification: str | None = None
    note: str | None = Field(default=None, max_length=500)


@router.post("/events/{event_id}/feedback")
def event_feedback(event_id: str, body: Feedback, request: Request, user: User = Depends(get_current_user),
                   session: Session = Depends(db_session)):
    e = _own_event(session, user, event_id)
    if body.suggested_classification and body.suggested_classification not in analysis.CLASSIFICATIONS:
        raise ValidationAppError("Unknown classification.")
    fb = session.scalars(select(MessageFeedback).where(
        MessageFeedback.event_id == e.id, MessageFeedback.user_id == user.id)).first()
    if fb is None:
        fb = MessageFeedback(event_id=e.id, user_id=user.id, verdict=body.verdict)
        session.add(fb)
    fb.verdict, fb.suggested_classification, fb.note = body.verdict, body.suggested_classification, body.note
    session.commit()
    return ok({"saved": True}, _rid(request))


@router.delete("/events/{event_id}")
def delete_event(event_id: str, request: Request, user: User = Depends(get_current_user),
                 session: Session = Depends(db_session)):
    e = _own_event(session, user, event_id)
    gateway.delete_events(session, select(MessageEvent.id).where(MessageEvent.id == e.id))
    return ok({"deleted": 1}, _rid(request))


@router.delete("/events")
def delete_history(request: Request, source_id: str | None = None, user: User = Depends(get_current_user),
                   session: Session = Depends(db_session)):
    q = select(MessageEvent.id).where(MessageEvent.user_id == user.id)
    if source_id:
        _own_source(session, user, source_id)
        q = q.where(MessageEvent.source_id == source_id)
    n = gateway.delete_events(session, q)
    audit.record(session, action="msgintel.history_deleted", actor_id=user.id, target=source_id,
                 meta={"events": n}, request_id=_rid(request))
    return ok({"deleted": n}, _rid(request))


# ---------------------------------------------------------------- alerts + settings

@router.get("/alerts")
def list_alerts(request: Request, status: str | None = None, user: User = Depends(get_current_user),
                session: Session = Depends(db_session)):
    q = select(ThreatAlert).where(ThreatAlert.user_id == user.id)
    if status:
        q = q.where(ThreatAlert.status == status)
    rows = session.scalars(q.order_by(ThreatAlert.created_at.desc()).limit(100)).all()
    return ok([alert_dict(a) for a in rows], _rid(request))


class AlertPatch(BaseModel):
    status: Literal["seen", "dismissed"]


@router.patch("/alerts/{alert_id}")
def patch_alert(alert_id: str, body: AlertPatch, request: Request, user: User = Depends(get_current_user),
                session: Session = Depends(db_session)):
    a = session.get(ThreatAlert, alert_id)
    if a is None or a.user_id != user.id:
        raise NotFoundError("Alert not found.")
    a.status = body.status
    session.commit()
    return ok(alert_dict(a), _rid(request))


_HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


class SettingsPatch(BaseModel):
    paused: bool | None = None
    store_previews: bool | None = None
    retention_days: int | None = Field(default=None, ge=1, le=365)
    alert_critical: bool | None = None
    alert_high: bool | None = None
    alert_medium: bool | None = None
    quiet_start: str | None = Field(default=None, pattern=_HHMM)
    quiet_end: str | None = Field(default=None, pattern=_HHMM)
    clear_quiet_hours: bool = False
    timezone: str | None = Field(default=None, max_length=64)
    max_alerts_per_hour: int | None = Field(default=None, ge=1, le=60)


@router.get("/settings")
def get_settings(request: Request, user: User = Depends(get_current_user), session: Session = Depends(db_session)):
    p = gateway.settings_for(session, user.id)
    session.commit()
    return ok(settings_dict(p), _rid(request))


@router.put("/settings")
def put_settings(body: SettingsPatch, request: Request, user: User = Depends(get_current_user),
                 session: Session = Depends(db_session)):
    p = gateway.settings_for(session, user.id)
    if body.timezone:
        from zoneinfo import ZoneInfo

        try:
            ZoneInfo(body.timezone)
        except Exception:
            raise ValidationAppError("Unknown timezone.")
    for k, v in body.model_dump(exclude_none=True, exclude={"clear_quiet_hours"}).items():
        setattr(p, k, v)
    if body.clear_quiet_hours:
        p.quiet_start = p.quiet_end = None
    session.commit()
    return ok(settings_dict(p), _rid(request))


# ---------------------------------------------------------------- mail connectors (OAuth)

@router.post("/connect/{provider}")
def connect(provider: Literal["gmail", "outlook"], request: Request, user: User = Depends(get_current_user),
            session: Session = Depends(db_session)):
    try:
        url = oauth.start(session, user.id, provider)
    except oauth.ConnectorError as exc:
        raise Conflict(exc.message, code=exc.code.upper())
    return ok({"authorize_url": url}, _rid(request))


@router.get("/oauth/{provider}/callback", include_in_schema=False)
def oauth_callback(provider: Literal["gmail", "outlook"], code: str = "", state: str = "", error: str = "",
                   session: Session = Depends(db_session)):
    base = f"{settings.public_base_url.rstrip('/')}/app/protection"
    if error or not code:
        return RedirectResponse(f"{base}?connect_error=denied", status_code=303)
    try:
        source = oauth.finish(session, provider, code, state)
    except oauth.ConnectorError as exc:
        return RedirectResponse(f"{base}?connect_error={exc.code}", status_code=303)
    audit.record(session, action="msgintel.mail_connected", actor_id=source.user_id, target=source.id,
                 meta={"provider": provider})
    return RedirectResponse(f"{base}?connected={provider}", status_code=303)


@router.post("/sources/{source_id}/sync")
def sync_now(source_id: str, request: Request, user: User = Depends(get_current_user),
             session: Session = Depends(db_session)):
    from app.messaging import sync

    s = _own_source(session, user, source_id)
    if s.kind not in ("gmail", "outlook"):
        raise ValidationAppError("Only mail accounts can be synced from here.")
    result = sync.sync_source(session, s)
    session.refresh(s)
    return ok({"result": result, "source": source_dict(s)}, _rid(request))
