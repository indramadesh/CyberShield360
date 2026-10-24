"""Liveness + readiness. Readiness reports subsystem status without failing hard."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.providers.registry import get_llm_provider, get_ocr_provider

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/ready")
def ready():
    checks: dict[str, str] = {}

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"

    checks["redis"] = "enabled" if settings.redis_enabled else "disabled"
    checks["task_backend"] = settings.task_backend
    checks["llm"] = get_llm_provider().name
    checks["ocr"] = get_ocr_provider().name

    ready = checks.get("database") == "ok"
    return {"ready": ready, "checks": checks}
