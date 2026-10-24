"""Celery task for sandboxed website analysis (used when TASK_BACKEND=celery).

Runs in the worker — isolate this worker's network egress in production for SSRF
safety. In dev (eager), the orchestrator calls `_process_website` directly instead."""
from __future__ import annotations

from app.worker import celery_app


@celery_app.task(name="website.process")
def process_website_scan(scan_id: str, url: str) -> str:
    from app.db.session import SessionLocal
    from app.services.scan_orchestrator import ScanOrchestrator

    with SessionLocal() as session:
        ScanOrchestrator(session)._process_website(scan_id, url)  # noqa: SLF001
    return scan_id
