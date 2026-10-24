"""External threat-intel adapters (Web Risk / PhishTank / OpenPhish / urlscan).

All share one HTTP-based pattern: short timeout, fail *soft* (return
available=False on any error so the scan degrades gracefully rather than failing),
and never raise. They are only registered when not in mock mode and the required
credential/flag is configured (see registry). Respect each provider's terms and
quotas; keys stay server-side.

Network calls are intentionally guarded and are NOT exercised by the offline test
suite (mock mode disables registration)."""
from __future__ import annotations

import logging

from app.core.config import settings
from app.providers.threatintel.base import IntelLookup, IntelMatch, ThreatIntelProvider

log = logging.getLogger("cybershield.intel")
_TIMEOUT = 5.0


def _empty(name: str, available: bool) -> IntelLookup:
    return IntelLookup(matches=[], provider=name, available=available)


class _HttpIntelProvider(ThreatIntelProvider):
    """Base with a guarded httpx client. Subclasses implement `_query`."""

    def lookup(self, indicator: str, indicator_type: str) -> IntelLookup:
        if indicator_type not in ("url", "domain"):
            return _empty(self.name, True)
        try:
            import httpx

            with httpx.Client(timeout=_TIMEOUT) as client:
                return self._query(client, indicator, indicator_type)
        except Exception as exc:  # fail soft -> degraded coverage, never crash
            log.warning("%s lookup failed: %s", self.name, exc)
            return _empty(self.name, False)

    def _query(self, client, indicator: str, indicator_type: str) -> IntelLookup:
        raise NotImplementedError


class WebRiskProvider(_HttpIntelProvider):
    name = "webrisk"

    def _query(self, client, indicator, indicator_type):
        resp = client.get(
            "https://webrisk.googleapis.com/v1/uris:search",
            params={
                "key": settings.google_webrisk_api_key,
                "uri": indicator,
                "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            },
        )
        resp.raise_for_status()
        threat = resp.json().get("threat")
        if not threat:
            return _empty(self.name, True)
        return IntelLookup(
            matches=[IntelMatch(self.name, indicator, indicator_type, "PHISHING", 0.9,
                                "https://cloud.google.com/web-risk")],
            provider=self.name, available=True,
        )


class PhishTankProvider(_HttpIntelProvider):
    name = "phishtank"

    def _query(self, client, indicator, indicator_type):
        resp = client.post(
            "https://checkurl.phishtank.com/checkurl/",
            data={"url": indicator, "format": "json"},
            headers={"User-Agent": "cybershield360"},
        )
        resp.raise_for_status()
        results = resp.json().get("results", {})
        if results.get("in_database") and results.get("valid"):
            return IntelLookup(
                matches=[IntelMatch(self.name, indicator, indicator_type, "PHISHING",
                                    0.85, results.get("phish_detail_page"))],
                provider=self.name, available=True,
            )
        return _empty(self.name, True)


class OpenPhishProvider(_HttpIntelProvider):
    name = "openphish"

    def _query(self, client, indicator, indicator_type):
        # OpenPhish community feed is a newline list; a production deploy caches it.
        resp = client.get("https://openphish.com/feed.txt")
        resp.raise_for_status()
        feed = resp.text.splitlines()
        if indicator in feed:
            return IntelLookup(
                matches=[IntelMatch(self.name, indicator, indicator_type, "PHISHING",
                                    0.8, "https://openphish.com")],
                provider=self.name, available=True,
            )
        return _empty(self.name, True)


class UrlscanProvider(_HttpIntelProvider):
    name = "urlscan"

    def _query(self, client, indicator, indicator_type):
        resp = client.get(
            "https://urlscan.io/api/v1/search/",
            params={"q": f"page.url:\"{indicator}\""},
            headers={"API-Key": settings.urlscan_api_key},
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])
        malicious = [r for r in results if r.get("verdicts", {}).get("overall", {}).get("malicious")]
        if malicious:
            return IntelLookup(
                matches=[IntelMatch(self.name, indicator, indicator_type, "MALWARE",
                                    0.7, "https://urlscan.io")],
                provider=self.name, available=True,
            )
        return _empty(self.name, True)
