"""URL scanner: offline syntax/domain heuristics → signals (no network here).

Reputation/threat-intel is added by the orchestrator via the provider layer.
Registrable-domain extraction is a simple last-two-labels heuristic (documented
as imperfect for multi-part TLDs like co.uk)."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from app.core.enums import ScanType
from app.services.detectors.base import Detector
from app.services.engine.signals import DetectionResult, DetectionSignal, SignalSource

_IP_HOST = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_SUSPICIOUS_TOKENS = (
    "login", "verify", "secure", "account", "update", "kyc", "otp", "bank",
    "wallet", "gift", "bonus", "free", "prize", "signin", "confirm", "password",
)
_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy"}
_REDIRECT_PARAMS = ("url", "redirect", "next", "r", "u", "goto", "return")

# Small configurable brand map (moves to the official_orgs table later).
_BRANDS: dict[str, str] = {
    "paypal": "paypal.com",
    "google": "google.com",
    "microsoft": "microsoft.com",
    "apple": "apple.com",
    "amazon": "amazon.com",
    "netflix": "netflix.com",
    "sbi": "onlinesbi.sbi",
    "hdfc": "hdfcbank.com",
    "icici": "icicibank.com",
}


def _registrable(host: str) -> str:
    labels = host.split(".")
    return ".".join(labels[-2:]) if len(labels) >= 2 else host


class UrlDetector(Detector):
    scan_type = ScanType.URL.value

    def analyze(self, payload: str) -> DetectionResult:
        raw = payload.strip()
        # Normalize: add scheme if missing so urlparse finds the host.
        parse_target = raw if "://" in raw else f"http://{raw}"
        parsed = urlparse(parse_target)
        host = (parsed.hostname or "").lower()
        path_q = f"{parsed.path}?{parsed.query}".lower()

        signals: list[DetectionSignal] = []

        def sig(source, indicator, weight, summary, *, conf=0.6, cat=None, **detail):
            signals.append(DetectionSignal(
                source=source, indicator=indicator, weight=weight, summary=summary,
                confidence=conf, category_hint=cat, detail=detail or {},
            ))

        if not host:
            sig(SignalSource.RULE, "unparseable_url", 10, "The URL could not be parsed.")
            return DetectionResult(signals=signals, indicators=[], normalized_input=raw)

        if parsed.scheme == "http":
            sig(SignalSource.DOMAIN, "no_https", 8, "The link does not use HTTPS.", conf=0.5)

        if parsed.username or "@" in (parsed.netloc or ""):
            sig(SignalSource.DOMAIN, "userinfo_in_url", 20,
                "The URL embeds credentials before the host (a common phishing trick).",
                conf=0.8, cat="PHISHING")

        if _IP_HOST.match(host):
            sig(SignalSource.DOMAIN, "ip_based_url", 18,
                "The link points to a raw IP address instead of a domain name.",
                conf=0.7, cat="PHISHING")

        if "xn--" in host:
            sig(SignalSource.DOMAIN, "punycode_host", 18,
                "The domain uses punycode, which can disguise look-alike characters.",
                conf=0.75, cat="IMPERSONATION")

        sub_count = max(0, len(host.split(".")) - 2)
        if sub_count >= 3:
            sig(SignalSource.DOMAIN, "excessive_subdomains", 12,
                f"The host has an unusual number of subdomains ({sub_count}).", conf=0.6)

        reg = _registrable(host)
        if reg in _SHORTENERS:
            sig(SignalSource.DOMAIN, "url_shortener", 12,
                "The link uses a URL shortener, which hides the true destination.",
                conf=0.5)

        token_hits = sorted({t for t in _SUSPICIOUS_TOKENS if t in host or t in path_q})
        if token_hits:
            sig(SignalSource.CONTENT, "suspicious_tokens",
                min(18, 6 + 3 * len(token_hits)),
                f"The URL contains sensitive-action keywords: {', '.join(token_hits)}.",
                conf=0.5, cat="PHISHING", tokens=token_hits)

        # Redirect parameters carrying another URL.
        q = parse_qs(parsed.query)
        for p in _REDIRECT_PARAMS:
            vals = q.get(p, [])
            if any("http" in v.lower() or "//" in v for v in vals):
                sig(SignalSource.CONTENT, "suspicious_redirect", 15,
                    f"A '{p}' parameter contains a redirect to another address.",
                    conf=0.6, cat="PHISHING")
                break

        # Brand impersonation: brand name appears but the registrable domain is
        # not the brand's official domain.
        hay = f"{host}{path_q}"
        for brand, official in _BRANDS.items():
            if brand in hay and reg != official and not host.endswith(official):
                sig(SignalSource.DOMAIN, "brand_impersonation", 20,
                    f"The link references '{brand}' but is not on its official "
                    f"domain ({official}).", conf=0.7, cat="IMPERSONATION", brand=brand)
                break

        # Indicators for threat-intel lookup: the full URL and the host/domain.
        indicators: list[tuple[str, str]] = [(raw, "url"), (host, "domain")]
        return DetectionResult(signals=signals, indicators=indicators, normalized_input=raw)
