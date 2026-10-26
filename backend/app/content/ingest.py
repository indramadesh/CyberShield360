"""Ingestion pipeline: due sources → fetch → parse → normalise → dedupe →
classify → quality checks → store/publish → source health.

One source failing never affects another (each runs in its own try/commit).
Re-running is idempotent: items are matched on (source, external id), then the
canonical URL, then same-source title+date, so nothing is stored twice.
"""
from __future__ import annotations

import datetime as dt
import logging
import re

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.content import legal
from app.content.adapters import ADAPTERS, ParsedItem, ParseError
from app.content.classify import classify, source_severity
from app.content.http import FetchError, fetch
from app.content.normalize import canonical_url, sha256, title_norm
from app.core.config import settings
from app.db.base import utcnow
from app.db.models.content import NewsItem
from app.db.models.content_engine import ContentSource, SourceFetchRun

log = logging.getLogger("cybershield.content")

MAX_BACKOFF = dt.timedelta(hours=24)


def _aware(d: dt.datetime | None) -> dt.datetime | None:
    if d is None:
        return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


def due_sources(session: Session, now: dt.datetime | None = None) -> list[ContentSource]:
    now = now or utcnow()
    rows = session.scalars(select(ContentSource).where(
        ContentSource.enabled.is_(True), ContentSource.paused_reason.is_(None))).all()
    return [s for s in rows if s.next_attempt_at is None or _aware(s.next_attempt_at) <= now]


def _quality_ok(item: ParsedItem) -> tuple[bool, str]:
    if len(item.title) < 8:
        return False, "title too short"
    if not re.match(r"^https?://", item.url):
        return False, "invalid link"
    return True, ""


def upsert_item(session: Session, src: ContentSource, item: ParsedItem, now: dt.datetime) -> str:
    """Store one parsed item. Returns new|updated|duplicate|rejected."""
    ok, _why = _quality_ok(item)
    if not ok:
        return "rejected"
    canon = canonical_url(item.url)
    published = _aware(item.published)
    if published and published > now + dt.timedelta(days=1):
        published = None  # a date in the future isn't reliable
    tnorm = title_norm(item.title)
    chash = sha256(item.title, item.summary)

    existing = session.scalars(select(NewsItem).where(
        or_(NewsItem.canonical_url == canon,
            (NewsItem.source_key == src.key) & (NewsItem.external_id == item.external_id[:400])))).first()
    if existing is None and published is not None:
        # Same source re-publishing the same headline the same day (e.g. a moved URL).
        day = published.date()
        for cand in session.scalars(select(NewsItem).where(
                NewsItem.source_key == src.key, NewsItem.title_norm == tnorm)).all():
            if cand.published_at and _aware(cand.published_at).date() == day:
                existing = cand
                break
    if existing is not None:
        existing.last_seen_at = now
        if existing.content_hash != chash:
            existing.title, existing.summary, existing.title_norm = item.title, item.summary, tnorm
            existing.content_hash = chash
            existing.source_updated_at = _aware(item.updated) or now
            return "updated"
        return "duplicate"

    kind = item.kind or src.category
    if item.severity:
        severity, sev_origin = item.severity, "source"
    elif (stated := source_severity(item.categories)):
        severity, sev_origin = stated, "source"
    elif src.fmt == "cisa_kev":
        severity, sev_origin = "high", "system"  # KEV = known exploited in the wild
    else:
        severity, sev_origin = "info", "none"
    session.add(NewsItem(
        title=item.title, summary=item.summary, source=src.name, source_url=item.url,
        canonical_url=canon, published_at=published, source_updated_at=_aware(item.updated),
        category=classify(item.title, item.summary, item.categories, kind), category_origin="system",
        region=src.jurisdiction, severity=severity, severity_origin=sev_origin, kind=kind,
        source_key=src.key, external_id=item.external_id[:400], title_norm=tnorm, content_hash=chash,
        status="published", language=src.language, last_seen_at=now, tags=item.tags or None,
    ))
    if src.trust == "official":
        legal.maybe_candidate_from_item(session, src, item, published)
    return "new"


def _backoff(src: ContentSource, retry_after: int | None) -> dt.timedelta:
    base = dt.timedelta(minutes=max(5, src.interval_minutes))
    delay = min(MAX_BACKOFF, base * (2 ** min(src.consecutive_failures, 6)))
    if retry_after:
        delay = max(delay, dt.timedelta(seconds=retry_after))
    return delay


def run_source(session: Session, src: ContentSource, *, now: dt.datetime | None = None,
               trigger: str = "schedule", fetcher=None) -> SourceFetchRun:
    now = now or utcnow()
    fetcher = fetcher or fetch  # resolved at call time (patchable)
    run = SourceFetchRun(source_key=src.key, started_at=now, trigger=trigger)
    session.add(run)
    src.last_attempt_at = now
    session.commit()
    try:
        if src.fmt == "doc_watch":
            outcome = legal.watch_document(session, src, now=now, fetcher=fetcher)
            run.http_status, run.response_ms = outcome.status, outcome.elapsed_ms
            run.status = "not_modified" if outcome.not_modified else "ok"
            run.items_seen = 1
            run.items_updated = 1 if outcome.changed else 0
        else:
            res = fetcher(src.feed_url, etag=src.etag, last_modified=src.last_modified,
                          timeout=src.timeout_seconds, max_bytes=src.max_bytes)
            run.http_status, run.response_ms = res.status, res.elapsed_ms
            src.last_status_code, src.last_response_ms = res.status, res.elapsed_ms
            if res.not_modified:
                run.status = "not_modified"
            else:
                adapter = ADAPTERS.get(src.fmt)
                if adapter is None:
                    raise ParseError(f"No adapter for format '{src.fmt}'.")
                items = adapter(res.body, src.base_url, src.max_items) if src.fmt == "cisa_kev" else adapter(res.body, src.base_url)
                items = items[: src.max_items]
                run.items_seen = len(items)
                for item in items:
                    try:
                        result = upsert_item(session, src, item, now)
                        session.commit()
                    except IntegrityError:  # raced with another writer: already stored
                        session.rollback()
                        result = "duplicate"
                    setattr(run, f"items_{result}", getattr(run, f"items_{result}") + 1)
                src.etag, src.last_modified = res.etag, res.last_modified
                run.status = "ok"
        newest = session.scalar(select(func.max(NewsItem.published_at)).where(NewsItem.source_key == src.key))
        src.last_item_published_at = newest
        src.last_success_at = now
        src.consecutive_failures = 0
        src.last_error = src.last_error_type = None
        src.next_attempt_at = now + dt.timedelta(minutes=src.interval_minutes)
        src.total_items = session.scalar(select(func.count()).select_from(NewsItem).where(NewsItem.source_key == src.key)) or 0
        src.total_duplicates = (src.total_duplicates or 0) + run.items_duplicate
    except (FetchError, ParseError) as exc:
        kind = exc.kind if isinstance(exc, FetchError) else "parse"
        status = exc.status if isinstance(exc, FetchError) else None
        retry_after = exc.retry_after if isinstance(exc, FetchError) else None
        run.status, run.error_type, run.error, run.http_status = "error", kind, str(exc)[:1000], status
        src.consecutive_failures = (src.consecutive_failures or 0) + 1
        src.last_error, src.last_error_type, src.last_status_code = str(exc)[:1000], kind, status
        src.next_attempt_at = now + _backoff(src, retry_after)
        if src.consecutive_failures >= settings.content_pause_after_failures:
            src.paused_reason = f"Paused after {src.consecutive_failures} consecutive failures ({kind}). Resume in Admin."
            log.warning("content source %s paused: %s", src.key, exc)
        else:
            log.info("content source %s failed (%s): %s", src.key, kind, exc)
    run.finished_at = utcnow()
    session.commit()
    return run


def run_due(session: Session, *, now: dt.datetime | None = None, fetcher=None) -> list[SourceFetchRun]:
    """Run every due source, one at a time (bounded concurrency = 1 per worker)."""
    if not settings.content_ingestion_enabled:
        return []
    runs = []
    for src in due_sources(session, now):
        try:
            runs.append(run_source(session, src, now=now, fetcher=fetcher))
        except Exception:  # noqa: BLE001 — never let one source stop the others
            session.rollback()
            log.exception("unexpected error ingesting %s", src.key)
    return runs


def prune(session: Session, *, now: dt.datetime | None = None) -> int:
    """Delete ingested articles past the retention window."""
    now = now or utcnow()
    cutoff = now - dt.timedelta(days=settings.content_retention_days)
    old = session.scalars(select(NewsItem).where(
        NewsItem.source_key.is_not(None),
        func.coalesce(NewsItem.published_at, NewsItem.created_at) < cutoff)).all()
    for row in old:
        session.delete(row)
    session.commit()
    return len(old)
