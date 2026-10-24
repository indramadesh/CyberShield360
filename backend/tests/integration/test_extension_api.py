def test_extension_health_is_public(client):
    r = client.get("/api/v1/extension/health")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "ok"
    assert data["engine_version"]
    assert "capabilities" in data


def test_extension_blocklist_returns_known_bad_domains(client):
    r = client.get("/api/v1/extension/blocklist")
    assert r.status_code == 200
    data = r.json()["data"]
    domains = {d["domain"] for d in data["domains"]}
    # Seeded synthetic high-confidence domain should be present.
    assert "account-verify-login.example" in domains
    assert data["count"] == len(data["domains"])
