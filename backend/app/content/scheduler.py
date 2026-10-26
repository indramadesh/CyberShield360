"""Scheduled jobs with database leases.

Each job has an interval. A job runs only if (a) it is due — measured from its
last *finish*, stored in `job_locks`, so the schedule survives restarts — and
(b) this process wins the lease. The lease is a single conditional UPDATE, so
two workers (or a worker plus an embedded scheduler) never run the same job at
once; a crashed holder's lease simply expires and is reclaimed.
Every job is idempotent.
"""
from __future__ import annotations

import datetime as dt
import logging
import os
import socket
import threading
import time
from dataclasses import dataclass
from typing import Callable

from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.db.models.content_engine import JobLock

log = logging.getLogger("cybershield.scheduler")
OWNER = f"{socket.gethostname()}:{os.getpid()}"


def _aware(d: dt.datetime | None) -> dt.datetime | None:
    return None if d is None else (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc))


@dataclass
class Job:
    name: str
    every: dt.timedelta
    run: Callable[[Session], object]
    lease: dt.timedelta = dt.timedelta(minutes=30)


def _jobs() -> list[Job]:
    from app.content import ingest, learning, registry

    return [
        Job("sync_sources", dt.timedelta(hours=6), registry.sync_sources),
        Job("daily_selection", dt.timedelta(minutes=15), learning.ensure_today, dt.timedelta(minutes=5)),
        Job("ingest_feeds", dt.timedelta(minutes=10), ingest.run_due),
        Job("prune_old_articles", dt.timedelta(hours=24), ingest.prune),
    ]


def acquire(session: Session, name: str, lease: dt.timedelta, owner: str = OWNER, now: dt.datetime | None = None) -> bool:
    now = now or utcnow()
    if session.get(JobLock, name) is None:
        session.add(JobLock(name=name))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
    res = session.execute(
        update(JobLock)
        .where(JobLock.name == name, or_(JobLock.locked_until.is_(None), JobLock.locked_until < now))
        .values(owner=owner, locked_until=now + lease, last_started_at=now)
    )
    session.commit()
    return res.rowcount == 1


def release(session: Session, name: str, *, status: str, error: str | None = None, owner: str = OWNER) -> None:
    lock = session.get(JobLock, name)
    if lock is None or lock.owner != owner:
        return
    lock.locked_until = None
    lock.last_finished_at = utcnow()
    lock.last_status = status
    lock.last_error = error
    lock.run_count = (lock.run_count or 0) + 1
    session.commit()


def is_due(session: Session, job: Job, now: dt.datetime) -> bool:
    lock = session.get(JobLock, job.name)
    last = _aware(lock.last_finished_at) if lock else None
    return last is None or last + job.every <= now


def run_pending(session_factory, *, force: set[str] | None = None, only: set[str] | None = None,
                owner: str = OWNER) -> list[dict]:
    """Run every due job once (or just `only`). Returns a summary per job attempted."""
    out = []
    for job in _jobs():
        if only and job.name not in only:
            continue
        with session_factory() as session:
            now = utcnow()
            if not (force and job.name in force) and not is_due(session, job, now):
                continue
            if not acquire(session, job.name, job.lease, owner, now):
                out.append({"job": job.name, "status": "locked"})
                continue
            try:
                result = job.run(session)
                release(session, job.name, status="ok", owner=owner)
                out.append({"job": job.name, "status": "ok", "result": _summarise(result)})
            except Exception as exc:  # noqa: BLE001 — record and continue with other jobs
                session.rollback()
                log.exception("job %s failed", job.name)
                release(session, job.name, status="error", error=str(exc)[:1000], owner=owner)
                out.append({"job": job.name, "status": "error", "error": str(exc)[:200]})
    return out


def _summarise(result):
    if isinstance(result, list):
        return {"runs": len(result), "ok": sum(1 for r in result if getattr(r, "status", "") in ("ok", "not_modified"))}
    return result


def run_forever(session_factory, *, tick_seconds: int = 60, stop: threading.Event | None = None) -> None:
    stop = stop or threading.Event()
    log.info("content scheduler started (owner=%s, tick=%ss)", OWNER, tick_seconds)
    while not stop.is_set():
        try:
            run_pending(session_factory)
        except Exception:  # noqa: BLE001
            log.exception("scheduler tick failed")
        stop.wait(tick_seconds)


def start_embedded(session_factory) -> threading.Event:
    """Dev convenience: run the scheduler in a daemon thread of the API process."""
    stop = threading.Event()
    threading.Thread(target=run_forever, args=(session_factory,), kwargs={"stop": stop},
                     name="content-scheduler", daemon=True).start()
    return stop


def status(session: Session) -> list[dict]:
    rows = {r.name: r for r in session.query(JobLock).all()}
    now = utcnow()
    out = []
    for job in _jobs():
        r = rows.get(job.name)
        last = _aware(r.last_finished_at) if r else None
        out.append({
            "job": job.name, "every_minutes": int(job.every.total_seconds() // 60),
            "last_started_at": _aware(r.last_started_at).isoformat() if r and r.last_started_at else None,
            "last_finished_at": last.isoformat() if last else None,
            "last_status": r.last_status if r else None, "last_error": r.last_error if r else None,
            "running": bool(r and r.locked_until and _aware(r.locked_until) > now),
            "next_due_at": (last + job.every).isoformat() if last else "now",
            "run_count": r.run_count if r else 0,
        })
    return out
