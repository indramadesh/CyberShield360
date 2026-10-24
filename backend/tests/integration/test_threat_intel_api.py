def _admin_headers(client):
    tok = client.post("/api/v1/auth/login", json={
        "email": "admin@cybershield.dev", "password": "ChangeMe!Dev12345",
    }).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_scan_matches_seeded_db_intel(client):
    # 'account-verify-login.example' is a seeded (synthetic) DB indicator.
    r = client.post("/api/v1/scans", json={
        "type": "URL", "payload": "http://account-verify-login.example/login",
    })
    data = r.json()["data"]
    assert "intel_match" in data["indicators"]
    assert data["risk_level"] in {"HIGH", "CRITICAL"}


def test_status_requires_admin(client):
    assert client.get("/api/v1/threat-intel/status").status_code == 401

    # A normal user is forbidden.
    client.post("/api/v1/auth/register", json={"email": "plain@example.com", "password": "Str0ng!password"})
    tok = client.post("/api/v1/auth/login", json={"email": "plain@example.com", "password": "Str0ng!password"}).json()["data"]
    r = client.get("/api/v1/threat-intel/status",
                   headers={"Authorization": f"Bearer {tok['access_token']}"})
    assert r.status_code == 403


def test_status_lists_providers_for_admin(client):
    r = client.get("/api/v1/threat-intel/status", headers=_admin_headers(client))
    assert r.status_code == 200
    data = r.json()["data"]
    names = {p["name"] for p in data["providers"]}
    assert {"internal", "database", "webrisk", "phishtank", "openphish", "urlscan"} <= names
    assert data["mock_mode"] is True  # externals disabled in tests
