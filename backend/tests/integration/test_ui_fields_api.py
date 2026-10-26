"""Fields added for the redesigned UI (reports list, result page, settings)."""


def _auth(client, email="ui-fields@example.com"):
    pw = "Str0ng!password"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": pw}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_history_target_strips_query_string(client):
    h = _auth(client)
    client.post("/api/v1/scans", headers=h, json={
        "type": "URL", "payload": "http://secure-login-verify.example/login?token=SECRET123&e=a@b.com",
    })
    rows = client.get("/api/v1/scans", headers=h).json()["data"]
    target = rows[0]["target"]
    assert target.startswith("http://secure-login-verify.example/login")
    assert "SECRET123" not in target and "?" not in target


def test_scan_detail_has_indicators_target_and_timestamp(client):
    created = client.post("/api/v1/scans", json={
        "type": "MESSAGE", "payload": "URGENT: verify your OTP now",
    }).json()["data"]
    d = client.get(f"/api/v1/scans/{created['scan_id']}").json()["data"]
    assert isinstance(d["indicators"], list) and d["indicators"]
    assert d["target"]
    assert d["created_at"]


def test_config_exposes_real_privacy_settings(client):
    p = client.get("/api/v1/config").json()["data"]["privacy"]
    assert isinstance(p["data_retention_days"], int)
    assert p["store_raw_uploads"] in (True, False)
    assert p["max_file_size_mb"] > 0
