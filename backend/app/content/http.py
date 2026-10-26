"""Polite, SSRF-safe HTTP for scheduled ingestion.

- Only http(s); the SSRF gate (DNS-resolving, private/loopback/metadata blocked)
  runs on the first URL and on EVERY redirect hop.
- Redirects are followed manually (max 5) and must stay on the source's own site.
- Conditional requests (If-None-Match / If-Modified-Since) avoid re-downloading.
- Hard caps: timeout, response size, content type. Retry-After is surfaced.
Only URLs from the source registry are fetched — never user-supplied ones.
"""
from __future__ import annotations

import email.utils
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx

from app.core.config import settings
from app.services.ssrf import SSRFError, assert_url_allowed

MAX_REDIRECTS = 5
_ALLOWED_TYPES = ("xml", "rss", "atom", "json", "html", "text/plain", "pdf", "octet-stream")


class FetchError(Exception):
    """A classified fetch failure. `kind` drives backoff and the health page."""

    def __init__(self, kind: str, message: str, *, status: int | None = None, retry_after: int | None = None):
        super().__init__(message)
        self.kind = kind  # timeout|connect|http|too_large|content_type|redirect|ssrf|rate_limited
        self.status = status
        self.retry_after = retry_after


@dataclass
class FetchResult:
    status: int  # 200 or 304
    body: bytes = b""
    final_url: str = ""
    content_type: str = ""
    etag: str | None = None
    last_modified: str | None = None
    elapsed_ms: int = 0
    redirects: list[str] = field(default_factory=list)

    @property
    def not_modified(self) -> bool:
        return self.status == 304


def _site(host: str) -> str:
    """Rough registrable domain (last two labels; three for e.g. gov.uk / org.in)."""
    parts = host.lower().strip(".").split(".")
    if len(parts) >= 3 and parts[-2] in {"gov", "org", "co", "ac", "nic", "net"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def parse_retry_after(value: str | None) -> int | None:
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return min(int(value), 86_400)
    try:
        when = email.utils.parsedate_to_datetime(value)
        return max(0, min(int(when.timestamp() - time.time()), 86_400))
    except (TypeError, ValueError):
        return None


def fetch(url: str, *, etag: str | None = None, last_modified: str | None = None,
          timeout: float = 20, max_bytes: int = 3_000_000, method: str = "GET",
          client: httpx.Client | None = None, gate=assert_url_allowed) -> FetchResult:
    """Fetch a registry URL. `client`/`gate` are injectable for offline tests."""
    headers = {"User-Agent": settings.content_user_agent, "Accept": "application/rss+xml, application/atom+xml, "
               "application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5"}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    origin_site = _site(urlparse(url).hostname or "")
    own = client is None
    client = client or httpx.Client(follow_redirects=False, timeout=httpx.Timeout(timeout, connect=min(10, timeout)))
    started = time.monotonic()
    current = url
    chain: list[str] = []
    try:
        for _ in range(MAX_REDIRECTS + 1):
            try:
                gate(current)
            except SSRFError as exc:
                raise FetchError("ssrf", f"Blocked destination: {exc}") from exc
            host = urlparse(current).hostname or ""
            if _site(host) != origin_site:
                raise FetchError("redirect", f"Redirected off the source's site to {host}.")
            try:
                with client.stream(method, current, headers=headers) as resp:
                    if 300 <= resp.status_code < 400 and resp.status_code != 304 and "location" in resp.headers:
                        chain.append(current)
                        current = urljoin(current, resp.headers["location"])
                        continue
                    elapsed = int((time.monotonic() - started) * 1000)
                    if resp.status_code == 304:
                        return FetchResult(304, final_url=current, etag=etag, last_modified=last_modified,
                                           elapsed_ms=elapsed, redirects=chain)
                    if resp.status_code == 429 or resp.status_code == 503:
                        raise FetchError("rate_limited", f"HTTP {resp.status_code}", status=resp.status_code,
                                         retry_after=parse_retry_after(resp.headers.get("retry-after")))
                    if resp.status_code >= 400:
                        raise FetchError("http", f"HTTP {resp.status_code}", status=resp.status_code,
                                         retry_after=parse_retry_after(resp.headers.get("retry-after")))
                    ctype = resp.headers.get("content-type", "").lower()
                    if ctype and not any(t in ctype for t in _ALLOWED_TYPES):
                        raise FetchError("content_type", f"Unexpected content type: {ctype}", status=resp.status_code)
                    declared = resp.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise FetchError("too_large", f"Response is {declared} bytes (limit {max_bytes}).")
                    buf = bytearray()
                    if method != "HEAD":
                        for chunk in resp.iter_bytes():
                            buf.extend(chunk)
                            if len(buf) > max_bytes:
                                raise FetchError("too_large", f"Response exceeded {max_bytes} bytes.")
                    return FetchResult(
                        resp.status_code, bytes(buf), final_url=current, content_type=ctype,
                        etag=resp.headers.get("etag"), last_modified=resp.headers.get("last-modified"),
                        elapsed_ms=int((time.monotonic() - started) * 1000), redirects=chain,
                    )
            except httpx.TimeoutException as exc:
                raise FetchError("timeout", "The source did not respond in time.") from exc
            except httpx.TransportError as exc:
                raise FetchError("connect", f"Could not connect ({type(exc).__name__}).") from exc
        raise FetchError("redirect", "Too many redirects.")
    finally:
        if own:
            client.close()
