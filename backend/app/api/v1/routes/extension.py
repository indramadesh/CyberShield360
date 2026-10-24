"""Endpoints used by the CyberShield 360 Browser Protection extension.

These REUSE the existing scan engine — URL analysis goes through the normal
`/scans` flow. Here we only add:
  - a lightweight health/capabilities probe, and
  - a known-bad domain blocklist for the extension's declarativeNetRequest rules.

No new risk logic is introduced (spec: do not duplicate the risk engine)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.core.config import settings
from app.core.features import current_flags
from app.db.models.threat_intel import ThreatIntel
from app.schemas.common import ok

router = APIRouter(prefix="/extension", tags=["extension"])

# Only the extension's engine version; the analysis itself is the platform's.
EXTENSION_ENGINE_VERSION = "1.0.0"


def _rid(request: Request):
    return getattr(request.state, "request_id", None)


@router.get("/health")
def health(request: Request):
    """Connectivity + capability probe for the extension (no auth)."""
    flags = current_flags()
    return ok(
        {
            "status": "ok",
            "engine_version": EXTENSION_ENGINE_VERSION,
            "app_name": settings.app_name,
            "capabilities": {
                "url": flags.get("url_scanner", False),
                "message": flags.get("message_scanner", False),
                "website": flags.get("website_scanner", False),
            },
        },
        _rid(request),
    )


@router.get("/blocklist")
def blocklist(request: Request, session: Session = Depends(db_session)):
    """High-confidence known-bad domains for client-side blocking rules.

    Returns only DOMAIN indicators at/above a confidence floor. This is a small,
    bounded list (demo/internal + accepted community reports), safe to expose."""
    rows = session.scalars(
        select(ThreatIntel).where(
            ThreatIntel.indicator_type == "domain",
            ThreatIntel.confidence >= 0.8,
        )
    ).all()
    seen: set[str] = set()
    domains = []
    for r in rows:
        d = (r.indicator or "").lower().strip()
        if d and d not in seen:
            seen.add(d)
            domains.append({"domain": d, "threat_type": r.threat_type,
                            "confidence": r.confidence})
    return ok({"domains": domains[:1000], "count": len(domains)}, _rid(request))
