"""Ingestion pipeline, source health, legal tracking and the scheduler — offline."""
from __future__ import annotations

import datetime as dt
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from app.content import ingest, legal, scheduler
from app.content.http import FetchError, FetchResult
from app.db.models.content import CyberLaw, NewsItem
from app.db.models.content_engine import ContentSource, JobLock, LegalChangeCandidate, LegalDocumentVersion

FX = Path(__file__).resolve().parents[1] / "fixtures" / "feeds"
NOW = dt.datetime(2026, 10, 26, 12, 0, tzinfo=dt.timezone.utc)


def _src(session, fmt="rss", category="news", jurisdiction="global", trust="official", **kw) -> ContentSource:
    key = f"test-{uuid.uuid4().hex[:8]}"
    s = ContentSource(key=key, name=f"Test {key}", fmt=fmt, category=category, jurisdiction=jurisdiction,
                      trust=trust, feed_url=kw.pop("feed_url", f"https://{key}.example.org/feed"),
                      base_url="https://example.org/", interval_minutes=60, max_items=40, enabled=True, **kw)
    session.add(s)
    session.commit()
    return s


def _fx(name: str, src: ContentSource) -> bytes:
    """Fixture body with hosts made unique per source, so tests don't dedupe
    against each other (cross-source canonical-URL dedupe is intended behaviour)."""
    body = (FX / name).read_bytes()
    for host in (b"feeds.example.org", b"atom.example.org"):
        body = body.replace(host, src.key.encode() + b"." + host)
    return body


def _fetcher(body: bytes | None = None, *, status=200, error: FetchError | None = None, etag=None, calls=None):
    def f(url, **kw):
        if calls is not None:
            calls.append(kw)
        if error:
            raise error
        return FetchResult(status, body or b"", final_url=url, content_type="text/xml", etag=etag, elapsed_ms=5)
    return f


def _items(session, src):
    return session.scalars(select(NewsItem).where(NewsItem.source_key == src.key)).all()


def test_ingest_stores_items_with_source_dates_and_provenance(session):
    src = _src(session)
    run = ingest.run_source(session, src, now=NOW, fetcher=_fetcher(_fx("rss.xml", src)))
    assert run.status == "ok"
    assert run.items_new == 3 and run.items_rejected == 1  # 'x' title too short; javascript: link never parsed
    items = {i.title: i for i in _items(session, src)}
    rce = items["Critical RCE vulnerability in ExampleCMS"]
    assert rce.published_at.replace(tzinfo=dt.timezone.utc) == dt.datetime(2026, 10, 26, 6, 30, tzinfo=dt.timezone.utc)
    assert rce.created_at is not None and rce.status == "published"
    assert rce.severity == "high" and rce.severity_origin == "source"  # from the source's own category
    assert rce.category == "vulnerability" and rce.category_origin == "system"
    assert rce.canonical_url == f"https://{src.key}.feeds.example.org/a/1"  # tracking params removed
    undated = items["Item without a date still has a title"]
    assert undated.published_at is None  # never replaced with the fetch time
    assert items["New phishing campaign impersonates banks"].severity_origin == "none"
    assert src.consecutive_failures == 0 and src.last_success_at is not None


def test_ingest_is_idempotent_and_detects_updates(session):
    src = _src(session)
    body = _fx("rss.xml", src)
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(body))
    again = ingest.run_source(session, src, now=NOW, fetcher=_fetcher(body))
    assert again.items_new == 0 and again.items_duplicate == 3
    assert len(_items(session, src)) == 3
    changed = body.replace(b"Fake KYC pages.", b"Fake KYC pages. Now also via WhatsApp.")
    third = ingest.run_source(session, src, now=NOW, fetcher=_fetcher(changed))
    assert third.items_updated == 1 and len(_items(session, src)) == 3


def test_conditional_request_and_not_modified(session):
    src = _src(session)
    calls = []
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(_fx("rss.xml", src), etag='"abc"', calls=calls))
    run = ingest.run_source(session, src, now=NOW, fetcher=_fetcher(status=304, calls=calls))
    assert calls[1]["etag"] == '"abc"'  # the stored validator is sent back
    assert run.status == "not_modified" and src.consecutive_failures == 0


def test_failure_backoff_retry_after_and_pause(session, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "content_pause_after_failures", 3)
    src = _src(session)
    err = FetchError("rate_limited", "HTTP 429", status=429, retry_after=7200)
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(error=err))
    assert src.consecutive_failures == 1 and src.last_error_type == "rate_limited"
    nxt = src.next_attempt_at.replace(tzinfo=dt.timezone.utc)
    assert nxt - NOW >= dt.timedelta(seconds=7200)  # Retry-After respected
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(error=FetchError("http", "HTTP 500", status=500)))
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(error=FetchError("http", "HTTP 500", status=500)))
    assert src.paused_reason and src.consecutive_failures == 3
    assert src not in ingest.due_sources(session, NOW + dt.timedelta(days=2))  # paused sources are skipped


def test_one_failing_source_does_not_stop_others(session, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "content_ingestion_enabled", True)
    for s in session.scalars(select(ContentSource)).all():  # only our two test sources are due
        s.next_attempt_at = NOW + dt.timedelta(days=30)
    bad, good = _src(session), _src(session)
    session.commit()
    body = _fx("atom.xml", good)

    def fetcher(url, **kw):
        if bad.key in url:
            raise FetchError("connect", "refused")
        return FetchResult(200, body, final_url=url, content_type="application/atom+xml")
    runs = ingest.run_due(session, now=NOW, fetcher=fetcher)
    statuses = {r.source_key: r.status for r in runs}
    assert statuses == {bad.key: "error", good.key: "ok"}
    assert len(_items(session, good)) == 2


def test_parse_error_is_recorded_not_raised(session):
    src = _src(session)
    run = ingest.run_source(session, src, now=NOW, fetcher=_fetcher(b"<rss><channel><item>"))
    assert run.status == "error" and run.error_type == "parse"


def test_kev_severity_is_a_documented_system_rule(session):
    src = _src(session, fmt="cisa_kev", category="vulnerability")
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher((FX / "kev.json").read_bytes()))
    items = _items(session, src)
    assert {i.severity for i in items} == {"high"} and {i.severity_origin for i in items} == {"system"}


def test_retention_prunes_only_ingested_old_items(session):
    src = _src(session)
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(_fx("rss.xml", src)))
    removed = ingest.prune(session, now=NOW + dt.timedelta(days=4000))
    assert removed >= 3 and not _items(session, src)


# ---------------- Legal ----------------

def test_curated_legal_records_are_conservative(session):
    laws = {l.slug: l for l in session.scalars(select(CyberLaw).where(CyberLaw.verification_status == "verified")).all()}
    assert laws["it-act-2000"].effective_date == dt.date(2000, 10, 17)
    dpdp = laws["dpdp-act-2023"]
    assert dpdp.legal_status == "enacted" and dpdp.effective_date is None  # commencement not asserted
    assert laws["certin-directions-faq-2022"].legal_status == "guidance"


def test_document_watch_baseline_then_change_creates_version_and_candidate(session, monkeypatch):
    law = CyberLaw(slug=f"watch-{uuid.uuid4().hex[:6]}", title="Test Rules", authority="Test", is_published=True,
                   legal_status="published_notification", verification_status="verified")
    session.add(law)
    session.commit()
    src = _src(session, fmt="doc_watch", category="legal", jurisdiction="IN")
    monkeypatch.setattr("app.content.registry.spec_for", lambda key: {"legal_slug": law.slug})

    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(b"%PDF-1 original"))
    versions = session.scalars(select(LegalDocumentVersion).where(LegalDocumentVersion.law_id == law.id)).all()
    assert len(versions) == 1  # baseline
    assert not session.scalars(select(LegalChangeCandidate).where(LegalChangeCandidate.law_id == law.id)).all()

    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(b"%PDF-1 original"))  # unchanged
    assert len(session.scalars(select(LegalDocumentVersion).where(LegalDocumentVersion.law_id == law.id)).all()) == 1

    run = ingest.run_source(session, src, now=NOW, fetcher=_fetcher(b"%PDF-1 amended text"))
    assert run.items_updated == 1
    cands = session.scalars(select(LegalChangeCandidate).where(LegalChangeCandidate.law_id == law.id)).all()
    assert len(cands) == 1 and cands[0].change_type == "updated" and cands[0].status == "open"
    assert "not been assessed" in cands[0].reason
    # The record's legal status is untouched by a file change.
    session.refresh(law)
    assert law.legal_status == "published_notification"


def test_keyword_candidate_policy(session):
    src = _src(session, jurisdiction="IN")
    feed = b"""<rss><channel>
<item><title>Draft amendment to the Information Technology Rules released for consultation</title>
<link>https://gov.example.in/n/1</link><pubDate>Mon, 26 Oct 2026 06:30:00 GMT</pubDate></item>
<item><title>Notification under the Data Protection Act published</title><link>https://gov.example.in/n/2</link></item>
</channel></rss>"""
    ingest.run_source(session, src, now=NOW, fetcher=_fetcher(feed))
    cands = {c.url: c for c in session.scalars(select(LegalChangeCandidate).where(LegalChangeCandidate.source_key == src.key)).all()}
    published = cands["https://gov.example.in/n/1"]
    assert published.status == "auto_published"
    law = session.get(CyberLaw, published.law_id)
    assert law.legal_status == "draft" and law.verification_status == "unverified" and law.effective_date is None
    held = cands["https://gov.example.in/n/2"]
    assert held.status == "open" and held.law_id is None  # no reliable date → not published


# ---------------- Scheduler ----------------

def test_lease_prevents_duplicate_execution_and_expires(session):
    name = f"job-{uuid.uuid4().hex[:6]}"
    lease = dt.timedelta(minutes=5)
    assert scheduler.acquire(session, name, lease, owner="a", now=NOW)
    assert not scheduler.acquire(session, name, lease, owner="b", now=NOW + dt.timedelta(minutes=1))
    # A crashed holder's lease expires and can be reclaimed (restart recovery).
    assert scheduler.acquire(session, name, lease, owner="b", now=NOW + dt.timedelta(minutes=6))
    assert session.get(JobLock, name).owner == "b"


def test_run_pending_isolates_failures_and_records_status(session, monkeypatch):
    from app.db.session import SessionLocal

    ran = []

    def boom(s):
        raise RuntimeError("boom")
    jobs = [scheduler.Job(f"fail-{uuid.uuid4().hex[:4]}", dt.timedelta(hours=1), boom),
            scheduler.Job(f"ok-{uuid.uuid4().hex[:4]}", dt.timedelta(hours=1), lambda s: ran.append(1) or "done")]
    monkeypatch.setattr(scheduler, "_jobs", lambda: jobs)
    out = scheduler.run_pending(SessionLocal)
    assert [o["status"] for o in out] == ["error", "ok"] and ran == [1]
    assert session.get(JobLock, jobs[0].name).last_status == "error"
    # Not due again until the interval has passed — the schedule survives restarts via the DB.
    assert scheduler.run_pending(SessionLocal) == []
