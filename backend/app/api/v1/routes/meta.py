"""Public config + threat categories. The frontend reads these to hide disabled
modules and to render categories without hard-coding them."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import db_session
from app.core import runtime_config
from app.core.config import settings
from app.core.features import current_flags
from app.db.models.threat import ThreatCategory
from app.schemas.common import ok

router = APIRouter(tags=["meta"])


@router.get("/config")
def public_config(request: Request, session: Session = Depends(db_session)):
    categories = [
        {"code": c.code, "label": c.label}
        for c in session.query(ThreatCategory).filter(ThreatCategory.enabled.is_(True)).all()
    ]
    return ok(
        {
            "app_name": settings.app_name,
            "env": settings.app_env,
            "demo_mode": settings.demo_mode,
            "features": current_flags(),
            "threat_categories": categories,
            "risk_thresholds": runtime_config.effective_thresholds(),
        },
        getattr(request.state, "request_id", None),
    )
