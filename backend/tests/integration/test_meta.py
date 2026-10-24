def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_ready(client):
    r = client.get("/ready")
    assert r.status_code == 200
    body = r.json()
    assert body["ready"] is True
    assert body["checks"]["database"] == "ok"


def test_public_config_exposes_features_and_categories(client):
    r = client.get("/api/v1/config")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["features"]["url_scanner"] is True
    # Seeded threat categories present, not hard-coded in the frontend.
    codes = {c["code"] for c in data["threat_categories"]}
    assert "PHISHING" in codes
    assert data["risk_thresholds"]["high"] == 50
