"""URL normalization + cache-key hashing for threat-intel lookups (spec §74)."""
from __future__ import annotations

import hashlib
from urllib.parse import urlparse, urlunparse


def normalize_url(url: str) -> str:
    raw = url.strip()
    target = raw if "://" in raw else f"http://{raw}"
    p = urlparse(target)
    scheme = (p.scheme or "http").lower()
    host = (p.hostname or "").lower()
    if p.port and not ((scheme == "http" and p.port == 80) or (scheme == "https" and p.port == 443)):
        host = f"{host}:{p.port}"
    path = p.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    # Drop fragment; keep query (it can carry phishing redirects).
    return urlunparse((scheme, host, path, "", p.query, ""))


def indicator_key(indicator: str, indicator_type: str) -> str:
    value = normalize_url(indicator) if indicator_type == "url" else indicator.lower().strip()
    return hashlib.sha256(f"{indicator_type}:{value}".encode()).hexdigest()
