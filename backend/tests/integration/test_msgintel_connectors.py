"""Gmail / Outlook connectors against fake provider servers (httpx.MockTransport).
No real Google or Microsoft account is involved."""
import base64
import json
import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.core.config import settings
from app.db.models.messaging import MessageEvent, MonitoredSource, OAuthToken
from app.messaging import crypto, sync
from app.messaging.connectors import oauth


def _b64(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def _user(session):
    from app.db.models.user import User

    u = User(email=f"c-{uuid.uuid4().hex[:8]}@example.com", password_hash="x")
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def configured(monkeypatch):
    for k, v in {"google_client_id": "gid", "google_client_secret": "gsecret",
                 "microsoft_client_id": "mid", "microsoft_client_secret": "msecret"}.items():
        monkeypatch.setattr(settings, k, v)


class FakeGmail:
    def __init__(self):
        self.history_id = 100
        self.messages = {"m1": self._msg("m1", "Lunch", "See you at noon", "ravi@company.com")}
        self.added_after: list[str] = []
        self.token_requests: list[dict] = []
        self.revoked: list[str] = []
        self.refresh_ok = True
        self.history_gone = False

    @staticmethod
    def _msg(mid, subject, body, sender, attachment=None):
        parts = [{"mimeType": "text/plain", "body": {"data": _b64(body)}}]
        if attachment:
            parts.append({"mimeType": "application/octet-stream", "filename": attachment, "body": {"size": 1000}})
        return {"id": mid, "internalDate": "1767225600000", "payload": {
            "mimeType": "multipart/mixed", "parts": parts,
            "headers": [{"name": "Authentication-Results", "value": "mx.google.com; spf=fail; dkim=none; dmarc=fail"},
                        {"name": "From", "value": f"Someone <{sender}>"}, {"name": "Subject", "value": subject}]}}

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.startswith("https://oauth2.googleapis.com/token"):
            form = parse_qs(request.content.decode())
            self.token_requests.append(form)
            if form["grant_type"] == ["refresh_token"] and not self.refresh_ok:
                return httpx.Response(400, json={"error": "invalid_grant"})
            return httpx.Response(200, json={"access_token": "at-" + uuid.uuid4().hex[:6], "expires_in": 3600,
                                             "refresh_token": "rt-1", "scope": "https://www.googleapis.com/auth/gmail.readonly"})
        if url.startswith("https://oauth2.googleapis.com/revoke"):
            self.revoked.append(parse_qs(request.content.decode())["token"][0])
            return httpx.Response(200)
        assert request.headers["authorization"].startswith("Bearer at-")
        path = request.url.path
        if path.endswith("/profile"):
            return httpx.Response(200, json={"emailAddress": "Me@Gmail.com", "historyId": str(self.history_id)})
        if path.endswith("/messages"):
            return httpx.Response(200, json={"messages": [{"id": "m1"}]})
        if path.endswith("/history"):
            if self.history_gone:
                return httpx.Response(404)
            hist = [{"messagesAdded": [{"message": {"id": m}}]} for m in self.added_after]
            return httpx.Response(200, json={"history": hist, "historyId": str(self.history_id + 5)})
        mid = path.rsplit("/", 1)[-1]
        return httpx.Response(200, json=self.messages[mid])


def _connect(session, user, fake, provider="gmail"):
    url = oauth.start(session, user.id, provider)
    q = parse_qs(urlparse(url).query)
    assert q["code_challenge_method"] == ["S256"] and q["state"][0]
    client = httpx.Client(transport=httpx.MockTransport(fake.handler))
    return oauth.finish(session, provider, "auth-code", q["state"][0], client=client), client, q


def test_gmail_connect_requests_read_only_scope_and_stores_encrypted_tokens(session, configured):
    fake, user = FakeGmail(), _user(session)
    source, client, q = _connect(session, user, fake)
    assert q["scope"] == ["https://www.googleapis.com/auth/gmail.readonly"]
    assert source.account == "me@gmail.com" and source.status == "connected"
    tok = session.query(OAuthToken).filter_by(source_id=source.id).one()
    assert "rt-1" not in (tok.refresh_token_enc or "") and crypto.decrypt(tok.refresh_token_enc) == "rt-1"
    assert fake.token_requests[0]["code_verifier"]  # PKCE verifier sent


def test_oauth_state_is_single_use(session, configured):
    fake, user = FakeGmail(), _user(session)
    url = oauth.start(session, user.id, "gmail")
    state = parse_qs(urlparse(url).query)["state"][0]
    client = httpx.Client(transport=httpx.MockTransport(fake.handler))
    oauth.finish(session, "gmail", "c", state, client=client)
    with pytest.raises(oauth.ConnectorError) as e:
        oauth.finish(session, "gmail", "c", state, client=client)
    assert e.value.code == "bad_state"


def test_gmail_sync_is_incremental_and_deduplicated(session, configured):
    fake, user = FakeGmail(), _user(session)
    source, client, _ = _connect(session, user, fake)
    r1 = sync.sync_source(session, source, client=client)
    assert r1["analysed"] == 1 and source.sync_cursor == "100"
    fake.messages["m2"] = fake._msg("m2", "Your statement", "Please find attached.", "alerts@hdfcbank.com",
                                    attachment="Statement.pdf.exe")
    fake.added_after = ["m2", "m1"]  # m1 already analysed
    r2 = sync.sync_source(session, source, client=client)
    assert r2["analysed"] == 1 and r2["duplicates"] == 1 and source.sync_cursor == "105"
    e = session.query(MessageEvent).filter_by(source_id=source.id).order_by(MessageEvent.created_at.desc()).first()
    assert e.classification in {"PHISHING", "SUSPICIOUS"} and e.auth_json["dmarc"] == "fail"
    assert any(x["indicator"] == "attachment_double_extension" for x in e.evidence_json)


def test_gmail_expired_history_restarts_cleanly(session, configured):
    fake, user = FakeGmail(), _user(session)
    source, client, _ = _connect(session, user, fake)
    sync.sync_source(session, source, client=client)
    fake.history_gone, fake.history_id = True, 900
    r = sync.sync_source(session, source, client=client)
    assert r["fetched"] == 0 and source.sync_cursor == "900"


def test_revoked_refresh_token_marks_source_and_stops(session, configured):
    fake, user = FakeGmail(), _user(session)
    source, client, _ = _connect(session, user, fake)
    tok = session.query(OAuthToken).filter_by(source_id=source.id).one()
    tok.access_expires_at = None  # force a refresh
    session.commit()
    fake.refresh_ok = False
    r = sync.sync_source(session, source, client=client)
    assert r["error"] == "revoked"
    session.refresh(source)
    assert source.status == "permission_revoked" and "Connect" in source.last_error


def test_gmail_disconnect_revokes_and_deletes_tokens(session, configured):
    fake, user = FakeGmail(), _user(session)
    source, client, _ = _connect(session, user, fake)
    note = oauth.disconnect(session, source, client=client)
    assert note == "" and fake.revoked == ["rt-1"]
    assert session.query(OAuthToken).filter_by(source_id=source.id).count() == 0
    assert source.status == "disconnected"


def test_scope_denied_is_refused(session, configured):
    fake, user = FakeGmail(), _user(session)
    orig = fake.handler

    def narrow(request):
        resp = orig(request)
        if str(request.url).startswith("https://oauth2.googleapis.com/token"):
            data = json.loads(resp.content)
            data["scope"] = "openid"
            return httpx.Response(200, json=data)
        return resp

    fake.handler = narrow
    with pytest.raises(oauth.ConnectorError) as e:
        _connect(session, user, fake)
    assert e.value.code == "scope_denied"


class FakeGraph:
    def __init__(self):
        self.round = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "login.microsoftonline.com" in url:
            return httpx.Response(200, json={"access_token": "at-ms", "refresh_token": "rt-ms", "expires_in": 3600,
                                             "scope": "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read"})
        path = request.url.path
        if path == "/v1.0/me":
            return httpx.Response(200, json={"mail": "Me@Contoso.com"})
        if path.endswith("/messages/delta"):
            if "deltatoken" in url:
                return httpx.Response(200, json={"value": [{"id": "o2"}, {"id": "gone", "@removed": {}}],
                                                 "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?deltatoken=2"})
            if "skiptoken" in url:
                return httpx.Response(200, json={"value": [], "@odata.deltaLink":
                                                 "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?deltatoken=1"})
            return httpx.Response(200, json={"value": [{"id": "o1"}], "@odata.nextLink":
                                             "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?skiptoken=a"})
        if path.endswith("/attachments"):
            return httpx.Response(200, json={"value": [{"name": "invoice.xlsm", "contentType": "x", "size": 10}]})
        mid = path.rsplit("/", 1)[-1]
        return httpx.Response(200, json={
            "id": mid, "subject": "Account notice", "receivedDateTime": "2026-11-01T10:00:00Z",
            "from": {"emailAddress": {"name": "Microsoft Support", "address": "support@micros0ft-help.example"}},
            "body": {"contentType": "html", "content": "<p>Verify your account <a href='http://micros0ft-help.example/login'>here</a></p>"},
            "internetMessageHeaders": [{"name": "Authentication-Results", "value": "spf=fail; dkim=none; dmarc=fail action=quarantine"}],
            "hasAttachments": mid == "o2"})


def test_outlook_connect_and_delta_sync(session, configured):
    fake, user = FakeGraph(), _user(session)
    source, client, q = _connect(session, user, fake, provider="outlook")
    assert set(q["scope"][0].split()) == {"offline_access", "User.Read", "Mail.Read"}
    assert source.account == "me@contoso.com"
    r1 = sync.sync_source(session, source, client=client)
    assert r1["analysed"] == 1 and "deltatoken=1" in source.sync_cursor
    r2 = sync.sync_source(session, source, client=client)
    assert r2["analysed"] == 1 and "deltatoken=2" in source.sync_cursor  # @removed item ignored
    events = session.query(MessageEvent).filter_by(source_id=source.id).all()
    assert all(e.auth_json.get("dmarc") == "fail" for e in events)
    o2 = next(e for e in events if e.attachments_json)
    assert any(x["indicator"] == "attachment_macro" for x in o2.evidence_json)
    assert any(u["url"].startswith("http://micros0ft-help.example") for u in o2.urls_json)
    note = oauth.disconnect(session, source, client=client)
    assert "account.live.com" in note  # Graph can't revoke for us; we say so


def test_production_requires_dedicated_token_key(monkeypatch, configured):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "token_encryption_key", "")
    assert not oauth.providers()["gmail"].configured
    from cryptography.fernet import Fernet

    monkeypatch.setattr(settings, "token_encryption_key", Fernet.generate_key().decode())
    assert oauth.providers()["gmail"].configured


def test_unconfigured_scheduler_job_is_a_noop(session):
    assert sync.sync_all(session) == {"skipped": "no mail connectors configured"}


def test_paused_user_is_not_synced(session, configured):
    from app.messaging import gateway

    fake, user = FakeGmail(), _user(session)
    source, client, _ = _connect(session, user, fake)
    gateway.settings_for(session, user.id).paused = True
    session.commit()
    assert sync.sync_source(session, source, client=client)["skipped"] == "paused"
    assert session.query(MonitoredSource).get(source.id).last_sync_at is None
