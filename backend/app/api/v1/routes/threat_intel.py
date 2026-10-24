"""Admin view of threat-intelligence provider status (spec §27/§43)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import db_session, require_role
from app.core.config import settings
from app.core.enums import Role
from app.db.models.user import User
from app.schemas.common import ok
from app.services import threat_intel

router = APIRouter(prefix="/threat-intel", tags=["threat-intel"])


@router.get("/status")
def status(
    request: Request,
    session: Session = Depends(db_session),
    _: User = Depends(require_role(Role.ADMIN)),
):
    svc = threat_intel.ThreatIntelService(session)
    providers = [
        {"name": "internal", "type": "builtin", "enabled": True, "available": True},
        {"name": "database", "type": "local", "enabled": True, "available": True},
    ]
    externals = {
        "webrisk": bool(settings.google_webrisk_api_key),
        "phishtank": settings.phishtank_enabled,
        "openphish": settings.openphish_enabled,
        "urlscan": bool(settings.urlscan_api_key),
    }
    active = {p.name for p in svc._external}  # noqa: SLF001 (internal introspection)
    for name, configured in externals.items():
        providers.append({
            "name": name, "type": "external", "enabled": configured,
            "available": name in active,
        })
    return ok(
        {
            "mock_mode": settings.mock_threat_intelligence,
            "cache_entries": len(threat_intel._cache),  # noqa: SLF001
            "providers": providers,
        },
        getattr(request.state, "request_id", None),
    )
