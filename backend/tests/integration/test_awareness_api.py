def _auth(client, email="learner@example.com"):
    pw = "Str0ng!password"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": pw}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_list_and_get_lessons(client):
    lessons = client.get("/api/v1/awareness").json()["data"]
    assert any(l["slug"] == "phishing-basics" for l in lessons)
    one = client.get("/api/v1/awareness/upi-safety")
    assert one.status_code == 200
    assert one.json()["data"]["quiz"]  # has a quiz


def test_daily_challenge(client):
    r = client.get("/api/v1/challenges/daily")
    assert r.status_code == 200
    assert "options" in r.json()["data"]


def test_recommendations_use_scan_history(client):
    headers = _auth(client)
    # Create UPI-fraud-ish scans to bias recommendations toward 'upi'.
    for _ in range(2):
        client.post("/api/v1/scans",
                    json={"type": "QR", "payload": "upi://pay?pa=x@oksbi&pn=X&am=1"},
                    headers=headers)
    # A phishing URL to add that category too.
    client.post("/api/v1/scans",
                json={"type": "URL", "payload": "http://account-verify-login.example/login"},
                headers=headers)
    rec = client.get("/api/v1/awareness/recommendations", headers=headers).json()["data"]
    assert "reason" in rec
    assert isinstance(rec["lessons"], list)
