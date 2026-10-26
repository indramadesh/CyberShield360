"""Ingestion HTTP client: conditional requests, errors, limits, redirects, SSRF."""
from __future__ import annotations

import httpx
import pytest

from app.content.http import FetchError, fetch, parse_retry_after
from app.services.ssrf import SSRFError

URL = "https://feeds.example.org/rss.xml"


def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)


def _allow(url):  # offline tests: skip DNS-based SSRF resolution
    return url


def test_ok_and_validators_returned():
    c = _client(lambda r: httpx.Response(200, content=b"<rss/>", headers={
        "content-type": "application/rss+xml", "etag": '"v1"', "last-modified": "Mon, 26 Oct 2026 06:00:00 GMT"}))
    res = fetch(URL, client=c, gate=_allow)
    assert res.status == 200 and res.body == b"<rss/>" and res.etag == '"v1"'


def test_conditional_request_headers_and_304():
    seen = {}

    def handler(r):
        seen.update(r.headers)
        return httpx.Response(304)
    res = fetch(URL, etag='"v1"', last_modified="Mon, 26 Oct 2026 06:00:00 GMT", client=_client(handler), gate=_allow)
    assert res.not_modified and res.body == b""
    assert seen["if-none-match"] == '"v1"' and "if-modified-since" in seen
    assert "CyberShield360-ContentBot" in seen["user-agent"]


@pytest.mark.parametrize("status,kind", [(500, "http"), (404, "http"), (403, "http"), (429, "rate_limited"), (503, "rate_limited")])
def test_http_errors_classified(status, kind):
    c = _client(lambda r: httpx.Response(status, headers={"retry-after": "120"}))
    with pytest.raises(FetchError) as e:
        fetch(URL, client=c, gate=_allow)
    assert e.value.kind == kind and e.value.status == status and e.value.retry_after == 120


def test_timeout_and_connect_errors():
    def timeout(r):
        raise httpx.ReadTimeout("slow", request=r)

    def refused(r):
        raise httpx.ConnectError("refused", request=r)
    with pytest.raises(FetchError) as e:
        fetch(URL, client=_client(timeout), gate=_allow)
    assert e.value.kind == "timeout"
    with pytest.raises(FetchError) as e:
        fetch(URL, client=_client(refused), gate=_allow)
    assert e.value.kind == "connect"


def test_size_limit_enforced():
    c = _client(lambda r: httpx.Response(200, content=b"x" * 5000, headers={"content-type": "text/xml"}))
    with pytest.raises(FetchError) as e:
        fetch(URL, max_bytes=1000, client=c, gate=_allow)
    assert e.value.kind == "too_large"


def test_unexpected_content_type_rejected():
    c = _client(lambda r: httpx.Response(200, content=b"\x00", headers={"content-type": "image/png"}))
    with pytest.raises(FetchError) as e:
        fetch(URL, client=c, gate=_allow)
    assert e.value.kind == "content_type"


def test_redirects_revalidated_and_kept_on_site():
    calls = []

    def gate(url):
        calls.append(url)
        return url

    def handler(r):
        if r.url.path == "/rss.xml":
            return httpx.Response(301, headers={"location": "https://www.example.org/new.xml"})
        return httpx.Response(200, content=b"<rss/>", headers={"content-type": "text/xml"})
    res = fetch(URL, client=_client(handler), gate=gate)
    assert res.final_url == "https://www.example.org/new.xml"
    assert calls == [URL, "https://www.example.org/new.xml"]  # SSRF gate ran on every hop

    off = _client(lambda r: httpx.Response(302, headers={"location": "https://evil.example.net/x"}))
    with pytest.raises(FetchError) as e:
        fetch(URL, client=off, gate=_allow)
    assert e.value.kind == "redirect"


def test_ssrf_gate_blocks_private_destinations():
    def gate(url):
        raise SSRFError("private address")
    with pytest.raises(FetchError) as e:
        fetch("https://feeds.example.org/x", client=_client(lambda r: httpx.Response(200)), gate=gate)
    assert e.value.kind == "ssrf"
    # The real gate rejects loopback / metadata IPs without any network call.
    with pytest.raises(FetchError):
        fetch("http://127.0.0.1/feed", client=_client(lambda r: httpx.Response(200)))
    with pytest.raises(FetchError):
        fetch("http://169.254.169.254/latest/meta-data", client=_client(lambda r: httpx.Response(200)))


def test_retry_after_parsing():
    assert parse_retry_after("30") == 30
    assert parse_retry_after(None) is None
    assert parse_retry_after("garbage") is None
    assert parse_retry_after("999999") == 86_400  # capped
