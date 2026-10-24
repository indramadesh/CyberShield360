def test_reporting_info_is_public_and_static(client):
    r = client.get("/api/v1/incidents/reporting-info")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["country"] == "IN"
    assert any(c.get("phone") == "1930" for c in data["channels"])
    assert "never files a report" in data["note"].lower()


def test_incident_severity_and_guidance(client):
    r = client.post("/api/v1/incidents", json={
        "transferred_money": True, "shared_upi_pin": True, "clicked_link": True,
    })
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["severity"] == "CRITICAL"
    assert any("1930" in s for s in data["steps"])
    # Retrievable by id.
    got = client.get(f"/api/v1/incidents/{data['incident_id']}")
    assert got.status_code == 200


def test_incident_low_when_nothing_risky(client):
    r = client.post("/api/v1/incidents", json={})
    assert r.json()["data"]["severity"] == "LOW"
