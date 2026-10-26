"""Aggregates all v1 routers."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.routes import (
    admin,
    auth,
    awareness,
    content,
    extension,
    incidents,
    meta,
    news,
    reports,
    scans,
    threat_intel,
)

api_router = APIRouter()
api_router.include_router(meta.router)
api_router.include_router(auth.router)
api_router.include_router(scans.router)
api_router.include_router(threat_intel.router)
api_router.include_router(awareness.router)
api_router.include_router(awareness.challenges_router)
api_router.include_router(incidents.router)
api_router.include_router(news.router)
api_router.include_router(content.router)
api_router.include_router(reports.router)
api_router.include_router(admin.router)
api_router.include_router(extension.router)
