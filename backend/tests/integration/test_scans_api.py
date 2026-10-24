def test_url_scan_with_intel_match_is_elevated(client):
    r = client.post("/api/v1/scans", json={
        "type": "URL",
        "payload": "http://secure-login-verify.example/login",
    })
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["risk_level"] in {"HIGH", "CRITICAL"}
    assert "intel_match" in data["indicators"]
    assert data["evidence"]  # non-empty, strongest-first
    assert data["recommendations"]
    assert 0.0 < data["confidence"] < 1.0  # risk != certainty


def test_benign_message_scan_is_low(client):
    r = client.post("/api/v1/scans", json={
        "type": "MESSAGE",
        "payload": "Lunch at 1pm works for me, see you then.",
    })
    data = r.json()["data"]
    assert data["risk_level"] == "LOW"
    assert any("does not guarantee" in n for n in data["notes"])


def test_get_anonymous_scan_by_id(client):
    created = client.post("/api/v1/scans", json={
        "type": "MESSAGE", "payload": "You won a prize! Share your UPI PIN to claim.",
    }).json()["data"]
    got = client.get(f"/api/v1/scans/{created['scan_id']}")
    assert got.status_code == 200
    assert got.json()["data"]["scan_id"] == created["scan_id"]


def test_list_requires_auth(client):
    assert client.get("/api/v1/scans").status_code == 401
