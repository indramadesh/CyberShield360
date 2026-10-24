"""Internal threat-intel: a small, clearly-labeled SYNTHETIC demo blocklist.

Always available (works offline). Real external adapters (Web Risk, PhishTank,
OpenPhish, urlscan) implement the same interface and are added in Phase 4.
"""
from __future__ import annotations

from app.providers.threatintel.base import IntelLookup, IntelMatch, ThreatIntelProvider

# SYNTHETIC / DEMO ONLY — not real threat data.
_DEMO_BLOCKLIST: dict[str, tuple[str, float]] = {
    "secure-login-verify.example": ("PHISHING", 0.9),
    "kyc-update-now.example": ("FAKE_KYC", 0.85),
    "free-gift-claim.example": ("ADVANCE_FEE_SCAM", 0.8),
    "bit.ly/verify-upi-demo": ("UPI_FRAUD", 0.8),
}


class InternalThreatIntelProvider(ThreatIntelProvider):
    name = "internal"

    def lookup(self, indicator: str, indicator_type: str) -> IntelLookup:
        key = indicator.lower().strip()
        hit = _DEMO_BLOCKLIST.get(key)
        matches: list[IntelMatch] = []
        if hit:
            threat_type, conf = hit
            matches.append(
                IntelMatch(
                    provider=self.name,
                    indicator=indicator,
                    indicator_type=indicator_type,
                    threat_type=threat_type,
                    confidence=conf,
                    source_url=None,
                )
            )
        return IntelLookup(matches=matches, provider=self.name, available=True)
