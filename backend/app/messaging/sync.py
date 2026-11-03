"""Runs mail syncs for connected Gmail / Outlook sources (scheduler job + "sync now")."""
from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models.messaging import MonitoredSource
from app.messaging import gateway
from app.messaging.connectors import gmail, oauth, outlook

log = logging.getLogger("cybershield.msgintel")
_MODULES = {"gmail": gmail, "outlook": outlook}
_PAUSE_AFTER_FAILURES = 10


def sync_source(session: Session, source: MonitoredSource, *, client: httpx.Client | None = None) -> dict:
    if source.kind not in _MODULES or source.status != "connected":
        return {"source": source.id, "skipped": source.status}
    if gateway.settings_for(session, source.user_id).paused:
        return {"source": source.id, "skipped": "paused"}
    http = client or httpx.Client(timeout=20.0)
    try:
        token = oauth.access_token(session, source, client=http)
        messages = _MODULES[source.kind].fetch_new(session, source, http, token)
        analysed = dupes = 0
        for msg in messages:
            res = gateway.ingest(session, source, msg)
            dupes += res.duplicate
            analysed += not res.duplicate
        source.last_sync_at, source.last_error, source.consecutive_failures = utcnow(), None, 0
        session.commit()
        return {"source": source.id, "fetched": len(messages), "analysed": analysed, "duplicates": dupes}
    except oauth.ConnectorError as exc:
        session.rollback()
        source = session.get(MonitoredSource, source.id)
        source.last_error = exc.message[:500]
        source.consecutive_failures = (source.consecutive_failures or 0) + 1
        if exc.reconnect:
            source.status, source.permission_state = "permission_revoked", "revoked"
        elif source.consecutive_failures >= _PAUSE_AFTER_FAILURES:
            source.status = "error"
        session.commit()
        log.info("mail sync %s failed (%s): %s", source.kind, exc.code, exc.message)
        return {"source": source.id, "error": exc.code}
    except gateway.GatewayRejected as exc:
        session.rollback()
        return {"source": source.id, "skipped": exc.code}


def sync_all(session: Session) -> dict:
    """Scheduler entry point. Each source is isolated: one failing account never
    stops the others."""
    if not any(p.configured for p in oauth.providers().values()):
        return {"skipped": "no mail connectors configured"}
    rows = session.scalars(select(MonitoredSource).where(
        MonitoredSource.kind.in_(tuple(_MODULES)), MonitoredSource.status == "connected")).all()
    results = []
    with httpx.Client(timeout=20.0) as http:
        for src in rows:
            try:
                results.append(sync_source(session, src, client=http))
            except Exception:  # noqa: BLE001
                session.rollback()
                log.exception("mail sync crashed for source %s", src.id)
                results.append({"source": src.id, "error": "crashed"})
    return {"sources": len(rows), "results": results}


def prune(session: Session) -> dict:
    from datetime import timedelta

    from sqlalchemy import delete

    from app.db.models.messaging import OAuthState, PairingCode

    removed = gateway.prune_expired(session)
    session.execute(delete(OAuthState).where(OAuthState.expires_at < utcnow()))
    session.execute(delete(PairingCode).where(PairingCode.expires_at < utcnow() - timedelta(days=1)))
    session.commit()
    return {"events_removed": removed}
