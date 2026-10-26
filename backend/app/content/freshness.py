"""Data freshness per section, so the UI never presents old data as new."""
from __future__ import annotations

import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.content.learning import today
from app.core.config import settings
from app.db.base import utcnow
from app.db.models.content import NewsItem
from app.db.models.content_engine import ContentSource, DailySelection, JobLock

SECTIONS = {
    "news": ("news", "advisory", "vulnerability", "alert"),
    "advisories": ("advisory", "vulnerability", "alert"),
    "legal": ("legal",),
}


def _aware(d):
    return None if d is None else (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc))


def _iso(d):
    d = _aware(d)
    return d.isoformat() if d else None


def section(session: Session, name: str) -> dict:
    cats = SECTIONS[name]
    sources = session.scalars(select(ContentSource).where(ContentSource.category.in_(cats))).all()
    enabled = [s for s in sources if s.enabled]
    last_success = max((_aware(s.last_success_at) for s in enabled if s.last_success_at), default=None)
    failing = [s for s in enabled if (s.consecutive_failures or 0) > 0]
    paused = [s for s in enabled if s.paused_reason]
    now = utcnow()
    stale = last_success is None or now - last_success > dt.timedelta(hours=settings.content_stale_hours)
    if not enabled:
        state = "no_sources"
    elif last_success is None:
        state = "never_refreshed"
    elif stale:
        state = "stale"
    elif failing:
        state = "partial"
    else:
        state = "fresh"
    newest = None
    if name != "legal":
        newest = session.scalar(select(func.max(NewsItem.published_at)).where(
            NewsItem.status == "published", NewsItem.kind.in_(cats)))
    return {
        "section": name, "state": state, "stale": stale, "last_refresh_at": _iso(last_success),
        "newest_item_published_at": _iso(newest), "sources_enabled": len(enabled),
        "sources_failing": len(failing), "sources_paused": len(paused),
        "unavailable_sources": [s.name for s in failing],
        "stale_after_hours": settings.content_stale_hours,
    }


def overview(session: Session) -> dict:
    sel = session.scalars(select(DailySelection).where(DailySelection.period == today().isoformat())).all()
    worker = session.get(JobLock, "ingest_feeds")
    return {
        "sections": [section(session, n) for n in SECTIONS],
        "learning": {"today": today().isoformat(), "timezone": settings.content_timezone,
                     "selected": sorted({s.kind for s in sel})},
        "scheduler": {"last_ingest_finished_at": _iso(worker.last_finished_at) if worker else None,
                      "last_ingest_status": worker.last_status if worker else None,
                      "ingestion_enabled": settings.content_ingestion_enabled},
    }
