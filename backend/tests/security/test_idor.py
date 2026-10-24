"""User B must not be able to read or delete User A's scan (IDOR)."""


def _auth(client, email):
    pw = "Str0ng!password"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": pw}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_other_user_cannot_read_or_delete_scan(client):
    a = _auth(client, "alice@example.com")
    b = _auth(client, "bob@example.com")

    created = client.post(
        "/api/v1/scans",
        json={"type": "MESSAGE", "payload": "Please verify your OTP now."},
        headers=a,
    ).json()["data"]
    sid = created["scan_id"]

    # Owner can read.
    assert client.get(f"/api/v1/scans/{sid}", headers=a).status_code == 200
    # Another user gets 404 (existence not leaked).
    assert client.get(f"/api/v1/scans/{sid}", headers=b).status_code == 404
    # Another user cannot delete it.
    assert client.delete(f"/api/v1/scans/{sid}", headers=b).status_code in {403, 404}
    # Owner can delete it.
    assert client.delete(f"/api/v1/scans/{sid}", headers=a).status_code == 200
