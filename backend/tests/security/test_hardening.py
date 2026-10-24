"""Phase 10 hardening: headers, rate limiting, body-size guard, audit logging."""
from app.core import ratelimit
from app.core.config import settings


def test_security_headers_present(client):
    r = client.get("/api/v1/config")
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'none'" in r.headers.get("Content-Security-Policy", "")


def test_request_id_header_present(client):
    r = client.get("/api/v1/config")
    assert r.headers.get("X-Request-ID", "").startswith("req_")


def test_rate_limit_trips_after_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(settings, "rate_limit_auth_per_min", 3)
    ratelimit.clear()
    codes = [
        client.post("/api/v1/auth/login",
                    json={"email": "nobody@example.com", "password": "whatever-wrong"}).status_code
        for _ in range(6)
    ]
    assert 429 in codes  # limiter engaged
    assert codes.count(429) >= 2


def test_body_size_guard(client, monkeypatch):
    monkeypatch.setattr(settings, "max_request_bytes", 10)
    r = client.post("/api/v1/scans", json={"type": "URL", "payload": "http://example.com/long"})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_audit_log_written_on_login(client, session):
    from app.db.models.audit import AuditLog

    client.post("/api/v1/auth/register", json={"email": "aud@example.com", "password": "Str0ng!password"})
    client.post("/api/v1/auth/login", json={"email": "aud@example.com", "password": "Str0ng!password"})
    actions = {a.action for a in session.query(AuditLog).all()}
    assert "login" in actions
