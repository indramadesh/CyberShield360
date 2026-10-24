"""Threat-intel provider backed by the local `threat_intel` table.

Always available (offline). Reads internal/demo indicators and cached external
hits. Needs a session, so it is constructed per-request by the service."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.providers.threatintel.base import IntelLookup, IntelMatch, ThreatIntelProvider
from app.repositories.threat_repository import ThreatRepository


class DatabaseThreatIntelProvider(ThreatIntelProvider):
    name = "database"

    def __init__(self, session: Session):
        self.repo = ThreatRepository(session)

    def lookup(self, indicator: str, indicator_type: str) -> IntelLookup:
        rows = self.repo.find(indicator, indicator_type)
        matches = [
            IntelMatch(
                provider=f"{self.name}:{r.provider}",
                indicator=r.indicator,
                indicator_type=r.indicator_type,
                threat_type=r.threat_type,
                confidence=r.confidence,
                source_url=r.source_url,
            )
            for r in rows
        ]
        return IntelLookup(matches=matches, provider=self.name, available=True)
