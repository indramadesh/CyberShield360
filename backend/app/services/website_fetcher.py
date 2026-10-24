"""SSRF-guarded website fetcher.

Follows redirects MANUALLY so the SSRF gate re-runs on every hop, and caps
redirects, response size, and time. This is the only code that performs outbound
fetches; it runs in the sandbox worker, never inline in an API handler. Tests
monkeypatch `fetch` so no real network calls occur offline."""
from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urljoin

from app.core.config import settings
from app.core.errors import AppError
from app.services.ssrf import assert_url_allowed

_MAX_REDIRECTS = 5
_MAX_BYTES = 2_000_000  # 2 MB cap


class FetchError(AppError):
    status_code = 502
    code = "FETCH_FAILED"


@dataclass
class FetchResult:
    final_url: str
    status: int
    html: str
    redirect_chain: list[str] = field(default_factory=list)
    truncated: bool = False


# A realistic browser-ish User-Agent + Accept headers: many sites reject an
# obvious bot UA with 403, which would otherwise look like a scanner failure.
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 CyberShield360-Sandbox",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch(url: str, *, max_redirects: int = _MAX_REDIRECTS,
          max_bytes: int = _MAX_BYTES) -> FetchResult:
    import httpx

    budget = min(settings.max_scan_time_seconds, 15)
    # Per-phase timeouts so a slow connect fails fast instead of hanging.
    timeout = httpx.Timeout(connect=6.0, read=budget, write=6.0, pool=6.0)
    current = assert_url_allowed(url)
    chain: list[str] = []

    with httpx.Client(follow_redirects=False, timeout=timeout) as client:
        for _ in range(max_redirects + 1):
            # Re-validate the (possibly redirected) URL before connecting.
            current = assert_url_allowed(current)
            try:
                with client.stream("GET", current, headers=_HEADERS) as resp:
                    if 300 <= resp.status_code < 400 and "location" in resp.headers:
                        chain.append(current)
                        current = urljoin(current, resp.headers["location"])
                        continue
                    buf = bytearray()
                    truncated = False
                    for chunk in resp.iter_bytes():
                        buf.extend(chunk)
                        if len(buf) > max_bytes:
                            truncated = True
                            break
                    html = bytes(buf[:max_bytes]).decode(
                        resp.encoding or "utf-8", errors="replace")
                    return FetchResult(final_url=current, status=resp.status_code,
                                       html=html, redirect_chain=chain, truncated=truncated)
            except httpx.ConnectTimeout as exc:
                raise FetchError("Could not connect to the website (connection timed out).") from exc
            except (httpx.ReadTimeout, httpx.PoolTimeout) as exc:
                raise FetchError("The website took too long to respond.") from exc
            except httpx.ConnectError as exc:
                raise FetchError("Could not connect to the website (it may be offline or unreachable).") from exc
            except httpx.HTTPError as exc:
                raise FetchError(f"The website could not be reached ({type(exc).__name__}).") from exc
    raise FetchError("The website performed too many redirects.")
