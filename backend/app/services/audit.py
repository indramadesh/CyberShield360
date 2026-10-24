"""Audit logging for security-sensitive events (spec §44).

Never stores passwords/OTPs/API keys/raw content — only event metadata."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.db.models.audit import AuditLog

log = logging.getLogger("cybershield.audit")


def record(session: Session, *, action: str, actor_id: str | None = None,
           target: str | None = None, meta: dict | None = None,
           request_id: str | None = None) -> None:
    try:
        session.add(AuditLog(actor_id=actor_id, action=action, target=target,
                             meta_json=meta or {}, request_id=request_id))
        session.commit()
    except Exception:  # auditing must never break the request
        session.rollback()
        log.exception("Failed to write audit log for action=%s", action)
