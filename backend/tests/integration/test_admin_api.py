def _admin(client):
    tok = client.post("/api/v1/auth/login", json={
        "email": "admin@cybershield.dev", "password": "ChangeMe!Dev12345"}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_analytics_requires_admin(client):
    assert client.get("/api/v1/admin/analytics").status_code == 401


def test_analytics_returns_aggregates(client):
    client.post("/api/v1/scans", json={"type": "URL", "payload": "http://account-verify-login.example/"})
    data = client.get("/api/v1/admin/analytics", headers=_admin(client)).json()["data"]
    assert data["total_scans"] >= 1
    assert "by_risk_level" in data and "by_category" in data


def test_feature_flag_override_disables_scanner(client):
    admin = _admin(client)
    # Disable the URL scanner at runtime (no redeploy).
    client.put("/api/v1/admin/config", json={"features": {"url_scanner": False}}, headers=admin)
    try:
        cfg = client.get("/api/v1/config").json()["data"]
        assert cfg["features"]["url_scanner"] is False
        blocked = client.post("/api/v1/scans", json={"type": "URL", "payload": "http://x.example/"})
        assert blocked.status_code == 404  # feature off
    finally:
        client.put("/api/v1/admin/config", json={"features": {"url_scanner": True}}, headers=admin)


def test_threshold_override_changes_bands(client):
    admin = _admin(client)
    # Make CRITICAL require only 1 point — a tiny signal should now be CRITICAL.
    client.put("/api/v1/admin/config",
               json={"thresholds": {"suspicious": 1, "high": 1, "critical": 1}}, headers=admin)
    try:
        data = client.post("/api/v1/scans",
                           json={"type": "URL", "payload": "http://foo.example/login"}).json()["data"]
        assert data["risk_level"] == "CRITICAL"
    finally:
        client.put("/api/v1/admin/config",
                   json={"thresholds": {"suspicious": 25, "high": 50, "critical": 75}}, headers=admin)


def test_cms_upsert_lesson(client):
    admin = _admin(client)
    r = client.post("/api/v1/admin/content/awareness", json={
        "slug": "new-lesson", "category": "privacy", "title": "New Lesson",
        "summary": "s", "body_md": "body", "quiz": [], "status": "published",
    }, headers=admin)
    assert r.status_code == 200
    assert client.get("/api/v1/awareness/new-lesson").status_code == 200
