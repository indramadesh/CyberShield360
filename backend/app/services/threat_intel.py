"""Threat-intelligence aggregation service.

Combines the internal demo provider, the local DB store, and any configured
external adapters. Adds a TTL cache (keyed by normalized-indicator hash), persists
external hits into the local store for future offline use, de-duplicates matches,
and reports degraded coverage when a provider is unavailable (spec §27/§69/§74).
"""
from __future__ import annotations

import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.providers.registry import (
    get_external_threat_intel_providers,
    get_internal_threat_intel_provider,
)
from app.providers.threatintel.base import IntelMatch
from app.providers.threatintel.database import DatabaseThreatIntelProvider
from app.repositories.threat_repository import ThreatRepository
from app.services.url_normalize import indicator_key

# Module-level cache: key -> (expiry_epoch, matches, degraded)
_cache: dict[str, tuple[float, list[IntelMatch], bool]] = {}


def clear_cache() -> None:
    _cache.clear()


class ThreatIntelService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ThreatRepository(session)
        self._internal = get_internal_threat_intel_provider()
        self._database = DatabaseThreatIntelProvider(session)
        self._external = get_external_threat_intel_providers()

    @property
    def provider_names(self) -> list[str]:
        return [self._internal.name, self._database.name] + [p.name for p in self._external]

    def lookup(self, indicator: str, indicator_type: str) -> tuple[list[IntelMatch], bool]:
        key = indicator_key(indicator, indicator_type)
        now = time.time()
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1], cached[2]

        matches: list[IntelMatch] = []
        degraded = False
        for provider in [self._internal, self._database, *self._external]:
            try:
                res = provider.lookup(indicator, indicator_type)
            except Exception:
                degraded = True
                continue
            if not res.available:
                degraded = True
            matches.extend(res.matches)
            # Persist external hits locally for future offline coverage.
            if provider in self._external:
                for m in res.matches:
                    self.repo.upsert(
                        provider=m.provider, indicator=m.indicator,
                        indicator_type=m.indicator_type, threat_type=m.threat_type,
                        confidence=m.confidence, source_url=m.source_url,
                        ttl_days=settings.intel_persist_ttl_days,
                    )

        deduped = _dedupe(matches)
        _cache[key] = (now + settings.intel_cache_ttl_seconds, deduped, degraded)
        return deduped, degraded

    def collect(self, indicators: list[tuple[str, str]]) -> tuple[list[IntelMatch], bool]:
        all_matches: list[IntelMatch] = []
        degraded = False
        for value, itype in indicators:
            if itype not in ("url", "domain"):
                continue
            matches, deg = self.lookup(value, itype)
            all_matches.extend(matches)
            degraded = degraded or deg
        return _dedupe(all_matches), degraded


def _dedupe(matches: list[IntelMatch]) -> list[IntelMatch]:
    seen: set[tuple[str, str, str]] = set()
    out: list[IntelMatch] = []
    for m in matches:
        k = (m.provider, m.indicator.lower(), m.threat_type)
        if k not in seen:
            seen.add(k)
            out.append(m)
    return out
