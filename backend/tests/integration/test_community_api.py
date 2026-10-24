def _auth(client, email):
    pw = "Str0ng!password"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": pw}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def _admin(client):
    tok = client.post("/api/v1/auth/login", json={
        "email": "admin@cybershield.dev", "password": "ChangeMe!Dev12345"}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_submit_requires_auth(client):
    r = client.post("/api/v1/reports", json={"indicator_type": "domain", "value": "x.example"})
    assert r.status_code == 401


def test_submit_and_moderate_promotes_to_intel(client):
    reporter = _auth(client, "reporter@example.com")
    r = client.post("/api/v1/reports",
                    json={"indicator_type": "domain", "value": "community-bad.example",
                          "note": "looks like phishing"}, headers=reporter)
    assert r.status_code == 200
    report_id = r.json()["data"]["report_id"]

    # Normal user cannot see the moderation queue.
    assert client.get("/api/v1/reports", headers=reporter).status_code == 403

    admin = _admin(client)
    queue = client.get("/api/v1/reports", headers=admin)
    assert queue.status_code == 200

    # Accept -> promoted to local intel at low confidence.
    client.patch(f"/api/v1/reports/{report_id}", json={"status": "ACCEPTED"}, headers=admin)
    scan = client.post("/api/v1/scans",
                       json={"type": "URL", "payload": "http://community-bad.example/"}).json()["data"]
    assert "intel_match" in scan["indicators"]


def test_duplicate_detection(client):
    h = _auth(client, "dupe@example.com")
    client.post("/api/v1/reports", json={"indicator_type": "upi", "value": "fraud@oksbi"}, headers=h)
    second = client.post("/api/v1/reports",
                         json={"indicator_type": "upi", "value": "fraud@oksbi"}, headers=h)
    assert second.json()["data"]["duplicate_of_group"] is not None
