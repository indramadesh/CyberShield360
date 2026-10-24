"""Celery app factory. Used only when TASK_BACKEND=celery (Redis enabled).

In local/dev with TASK_BACKEND=eager, tasks run in-process and this module is not
required. The website-sandbox task (Phase 5) registers here.
"""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "cybershield",
    broker=settings.redis_url,
    backend=settings.redis_url,
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_time_limit=settings.max_scan_time_seconds + 10,
    task_eager_propagates=True,
    task_always_eager=(settings.task_backend == "eager"),
)
