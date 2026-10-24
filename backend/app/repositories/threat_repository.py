from __future__ import annotations

import datetime as dt

from sqlalchemy import or_, select

from app.db.base import utcnow
from app.db.models.threat_intel import ThreatIntel
from app.repositories.base import SQLAlchemyRepository


class ThreatRepository(SQLAlchemyRepository[ThreatIntel]):
    model = ThreatIntel

    def find(self, indicator: str, indicator_type: str) -> list[ThreatIntel]:
        now = utcnow()
        stmt = select(ThreatIntel).where(
            ThreatIntel.indicator == indicator.lower(),
            ThreatIntel.indicator_type == indicator_type,
            or_(ThreatIntel.expires_at.is_(None), ThreatIntel.expires_at > now),
        )
        return list(self.session.scalars(stmt).all())

    def upsert(self, *, provider: str, indicator: str, indicator_type: str,
               threat_type: str, confidence: float, source_url: str | None = None,
               ttl_days: int | None = None) -> ThreatIntel:
        now = utcnow()
        existing = self.session.scalars(
            select(ThreatIntel).where(
                ThreatIntel.provider == provider,
                ThreatIntel.indicator == indicator.lower(),
            )
        ).first()
        expires = now + dt.timedelta(days=ttl_days) if ttl_days else None
        if existing:
            existing.threat_type = threat_type
            existing.confidence = confidence
            existing.last_seen = now
            existing.source_url = source_url
            existing.expires_at = expires
            self.session.flush()
            return existing
        row = ThreatIntel(
            provider=provider, indicator=indicator.lower(), indicator_type=indicator_type,
            threat_type=threat_type, confidence=confidence, source_url=source_url,
            first_seen=now, last_seen=now, expires_at=expires,
        )
        return self.add(row)
