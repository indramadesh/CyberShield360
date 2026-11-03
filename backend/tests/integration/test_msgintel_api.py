"""Message-intelligence API: pairing, device ingestion, privacy gateway, alerts,
history, ownership, deletion and settings."""
import datetime as dt
import uuid

import pytest

from app.core.config import settings

PHISH = "URGENT: your account is suspended. Share the OTP sent to you to verify at http://bit.ly/verify-now"


def _auth(client):
    email = f"mi-{uuid.uuid4().hex[:8]}@example.com"
    pw = "Str0ng!password"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": pw}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def _pair(client, h, kind="android_notifications"):
    code = client.post("/api/v1/msgintel/pairing", json={"kind": kind, "consent": True}, headers=h).json()["data"]["code"]
    r = client.post("/api/v1/msgintel/devices/pair", json={"code": code, "device_name": "Pixel", "platform": "android"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    return {"X-Device-Token": d["device_token"]}, d["source"]["id"]


def _send(client, dev, text=PHISH, app="com.whatsapp", **extra):
    item = {"source_type": "notification", "app": app, "title": "Unknown", "text": text, **extra}
    return client.post("/api/v1/msgintel/device/events", json={"items": [item]}, headers=dev)


def test_capabilities_are_honest(client):
    d = client.get("/api/v1/msgintel/capabilities").json()["data"]
    assert d["connectors"]["gmail"]["available"] is False  # no OAuth app configured in tests
    assert d["connectors"]["ios"]["available"] is False
    assert any("WhatsApp" in x for x in d["not_possible"])


def test_pairing_requires_consent_and_code_is_single_use(client):
    h = _auth(client)
    assert client.post("/api/v1/msgintel/pairing", json={"kind": "android_notifications", "consent": False},
                       headers=h).status_code == 422
    code = client.post("/api/v1/msgintel/pairing", json={"kind": "android_notifications", "consent": True},
                       headers=h).json()["data"]["code"]
    assert client.post("/api/v1/msgintel/devices/pair", json={"code": code}).status_code == 200
    assert client.post("/api/v1/msgintel/devices/pair", json={"code": code}).status_code == 401
    assert client.post("/api/v1/msgintel/devices/pair", json={"code": "AAAA-BBBB"}).status_code == 401


def test_notifications_only_from_selected_apps(client):
    h = _auth(client)
    dev, sid = _pair(client, h)
    r = _send(client, dev).json()["data"]["results"][0]
    assert r == {"accepted": False, "reason": "app_not_selected", "message": r["message"]}  # default: no apps
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["com.whatsapp"]}, headers=h)
    ok = _send(client, dev).json()["data"]["results"][0]
    assert ok["accepted"] and ok["classification"] in {"PHISHING", "SCAM"} and ok["risk_level"] in {"HIGH", "CRITICAL"}
    assert ok["alert"] is True
    other = _send(client, dev, app="com.android.chrome").json()["data"]["results"][0]
    assert other["reason"] == "app_not_selected"


def test_duplicates_dont_create_second_event_or_alert(client):
    h = _auth(client)
    dev, sid = _pair(client, h)
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["com.whatsapp"]}, headers=h)
    a = _send(client, dev).json()["data"]["results"][0]
    b = _send(client, dev).json()["data"]["results"][0]
    assert b["duplicate"] and b["event_id"] == a["event_id"] and b["alert"] is False
    assert len(client.get("/api/v1/msgintel/alerts", headers=h).json()["data"]) == 1


def test_secrets_and_previews_are_not_stored(client, session):
    from app.db.models.messaging import MessageEvent

    h = _auth(client)
    dev, sid = _pair(client, h)
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["com.bank"]}, headers=h)
    rid = _send(client, dev, text="Your OTP is 937451 for login, password: hunter2", app="com.bank").json()["data"]["results"][0]["event_id"]
    e = session.get(MessageEvent, rid)
    assert e.preview == ""  # previews are off by default
    blob = repr(e.__dict__)
    assert "937451" not in blob and "hunter2" not in blob
    client.put("/api/v1/msgintel/settings", json={"store_previews": True}, headers=h)
    rid2 = _send(client, dev, text="Call 9876543210 about OTP is 112233", app="com.bank").json()["data"]["results"][0]["event_id"]
    session.expire_all()
    e2 = session.get(MessageEvent, rid2)
    assert "9876543210" not in e2.preview and "112233" not in e2.preview and "REDACTED" in e2.preview


def test_pause_stops_automatic_but_not_manual_checks(client):
    h = _auth(client)
    dev, sid = _pair(client, h)
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["com.whatsapp"]}, headers=h)
    client.put("/api/v1/msgintel/settings", json={"paused": True}, headers=h)
    assert _send(client, dev).json()["data"]["results"][0]["reason"] == "paused"
    r = client.post("/api/v1/msgintel/analyze", json={"kind": "message", "content": PHISH}, headers=h)
    assert r.status_code == 200 and r.json()["data"]["classification"] in {"PHISHING", "SCAM"}
    client.put("/api/v1/msgintel/settings", json={"paused": False}, headers=h)
    # Pausing one source only stops that source.
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"status": "paused"}, headers=h)
    assert _send(client, dev).json()["data"]["results"][0]["reason"] == "source_inactive"


def test_permission_revoked_is_reported_and_blocks_ingest(client):
    h = _auth(client)
    dev, sid = _pair(client, h)
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["com.whatsapp"]}, headers=h)
    st = client.post("/api/v1/msgintel/device/status", json={"notification_access": False}, headers=dev).json()["data"]
    assert st["status"] == "permission_revoked" and st["permission_state"] == "revoked"
    assert _send(client, dev).json()["data"]["results"][0]["accepted"] is False
    client.post("/api/v1/msgintel/device/status", json={"notification_access": True}, headers=dev)
    assert _send(client, dev).json()["data"]["results"][0]["accepted"] is True


def test_disconnect_revokes_device_and_can_delete_history(client):
    h = _auth(client)
    dev, sid = _pair(client, h)
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["com.whatsapp"]}, headers=h)
    _send(client, dev)
    r = client.delete(f"/api/v1/msgintel/sources/{sid}?delete_history=true", headers=h).json()["data"]
    assert r["events_deleted"] == 1 and r["source"]["status"] == "disconnected"
    assert _send(client, dev).status_code == 401
    assert client.get("/api/v1/msgintel/events", headers=h).json()["data"]["total"] == 0


def test_users_cannot_see_each_others_items(client):
    a, b = _auth(client), _auth(client)
    item = client.post("/api/v1/msgintel/analyze", json={"kind": "message", "content": PHISH}, headers=a).json()["data"]
    assert client.get(f"/api/v1/msgintel/events/{item['id']}", headers=b).status_code == 404
    assert client.delete(f"/api/v1/msgintel/events/{item['id']}", headers=b).status_code == 404
    assert client.get("/api/v1/msgintel/events", headers=b).json()["data"]["total"] == 0
    assert client.get("/api/v1/msgintel/events").status_code == 401


def test_report_history_filters_feedback_and_delete(client):
    h = _auth(client)
    phish = client.post("/api/v1/msgintel/analyze", json={"kind": "message", "content": PHISH}, headers=h).json()["data"]
    client.post("/api/v1/msgintel/analyze", json={"kind": "message", "content": "See you at 6 tomorrow"}, headers=h)
    full = client.get(f"/api/v1/msgintel/events/{phish['id']}", headers=h).json()["data"]
    for key in ("evidence", "limitations", "recommendations", "engine_version", "confidence", "risk_score"):
        assert key in full
    unknown = client.get("/api/v1/msgintel/events?classification=UNKNOWN", headers=h).json()["data"]
    assert unknown["total"] == 1
    assert client.get("/api/v1/msgintel/events?classification=BOGUS", headers=h).status_code == 422
    fb = client.post(f"/api/v1/msgintel/events/{phish['id']}/feedback",
                     json={"verdict": "incorrect", "suggested_classification": "PROMOTIONAL"}, headers=h)
    assert fb.status_code == 200
    assert client.get(f"/api/v1/msgintel/events/{phish['id']}", headers=h).json()["data"]["feedback"]["verdict"] == "incorrect"
    assert client.delete("/api/v1/msgintel/events", headers=h).json()["data"]["deleted"] == 2


def test_pasted_email_headers_are_not_trusted(client):
    h = _auth(client)
    raw = ("From: Ravi <ravi@company.com>\nAuthentication-Results: mx.google.com; spf=pass; dkim=pass; dmarc=pass\n"
           "Subject: Notes\n\nHi, attaching notes from the meeting.")
    d = client.post("/api/v1/msgintel/analyze", json={"kind": "email", "content": raw}, headers=h).json()["data"]
    assert d["classification"] == "UNKNOWN" and d["authentication"] == {}


def test_alert_levels_quiet_hours_and_cap(client, session):
    from app.db.models.messaging import MonitoringSettings
    from app.messaging import gateway

    h = _auth(client)
    dev, sid = _pair(client, h)
    client.patch(f"/api/v1/msgintel/sources/{sid}", json={"apps": ["a"]}, headers=h)
    prefs = MonitoringSettings(alert_critical=True, alert_high=True, alert_medium=False, quiet_start="22:00",
                               quiet_end="07:00", timezone="UTC", max_alerts_per_hour=10)
    night = dt.datetime(2026, 1, 1, 23, 30, tzinfo=dt.timezone.utc)
    day = dt.datetime(2026, 1, 1, 12, 0, tzinfo=dt.timezone.utc)
    assert gateway._in_quiet_hours(prefs, night) and not gateway._in_quiet_hours(prefs, day)
    r = client.put("/api/v1/msgintel/settings", json={"quiet_start": "25:00"}, headers=h)
    assert r.status_code == 422
    assert client.put("/api/v1/msgintel/settings", json={"timezone": "Mars/Base"}, headers=h).status_code == 422


def test_phone_reports_selected_apps_and_pause(client):
    h = _auth(client)
    dev, sid = _pair(client, h)
    st = client.post("/api/v1/msgintel/device/status", json={"selected_apps": ["com.whatsapp"], "notification_access": True},
                     headers=dev).json()["data"]
    assert st["scope"]["apps"] == ["com.whatsapp"] and "available_apps" not in st["scope"]
    assert _send(client, dev).json()["data"]["results"][0]["accepted"] is True
    assert client.post("/api/v1/msgintel/device/status", json={"paused": True}, headers=dev).json()["data"]["status"] == "paused"
    assert client.get("/api/v1/msgintel/device/config", headers=dev).json()["data"]["apps"] == ["com.whatsapp"]


def test_device_token_cannot_use_user_endpoints(client):
    h = _auth(client)
    dev, _ = _pair(client, h)
    assert client.get("/api/v1/msgintel/events", headers=dev).status_code == 401
    assert client.post("/api/v1/msgintel/device/events", json={"items": [{"source_type": "notification"}]},
                       headers={"X-Device-Token": "csd_forged"}).status_code == 401


def test_overview_counts_real_data(client):
    h = _auth(client)
    client.post("/api/v1/msgintel/analyze", json={"kind": "message", "content": PHISH}, headers=h)
    d = client.get("/api/v1/msgintel/overview", headers=h).json()["data"]
    assert d["counts"]["messages_analyzed"] == 1 and d["counts"]["threats"] == 1
    assert d["paused"] is False


def test_feature_flag_hides_module(client):
    from app.core import runtime_config

    runtime_config._OVERRIDES["features"] = {"message_protection": False}  # noqa: SLF001
    try:
        assert client.get("/api/v1/msgintel/capabilities").status_code == 404
    finally:
        runtime_config._OVERRIDES.clear()  # noqa: SLF001


@pytest.mark.parametrize("provider", ["gmail", "outlook"])
def test_connect_unconfigured_provider_is_refused(client, provider):
    h = _auth(client)
    r = client.post(f"/api/v1/msgintel/connect/{provider}", headers=h)
    assert r.status_code == 409 and settings.google_client_id == ""


def test_ios_message_filter_is_stateless(client, session):
    from app.db.models.messaging import MessageEvent

    before = session.query(MessageEvent).count()
    body = {"_version": 1, "query": {"sender": "14085550001", "message": {"text": PHISH}}, "app": {"version": "1.0"}}
    r = client.post("/api/v1/msgintel/ios/message-filter", json=body).json()
    assert r["action"] == "junk" and r["classification"] in {"PHISHING", "SCAM"}
    calm = {"query": {"sender": "x", "message": {"text": "Your table is ready at 7pm"}}}
    assert client.post("/api/v1/msgintel/ios/message-filter", json=calm).json()["action"] == "none"
    session.expire_all()
    assert session.query(MessageEvent).count() == before  # nothing stored
