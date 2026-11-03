"""Gmail connector (read-only, scope gmail.readonly).

Incremental sync with the History API: the first connection records the mailbox's
current historyId and looks at a handful of recent inbox messages; every later sync
asks only for messages added since that historyId."""
from __future__ import annotations

import base64
import datetime as dt

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.messaging import MonitoredSource
from app.messaging.connectors import mailparse
from app.messaging.connectors.oauth import ConnectorError
from app.messaging.schema import NormalizedMessage

API = "https://gmail.googleapis.com/gmail/v1/users/me"
_MAX_PER_SYNC = 50


def _get(client: httpx.Client, token: str, path: str, **params) -> httpx.Response:
    resp = client.get(f"{API}{path}", params=params, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code == 401:
        raise ConnectorError("revoked", "Gmail access was revoked or expired. Connect again.", reconnect=True)
    if resp.status_code == 403:
        raise ConnectorError("forbidden", "Gmail refused access (permission or quota).")
    if resp.status_code == 429 or resp.status_code >= 500:
        raise ConnectorError("provider_error", f"Gmail is unavailable (HTTP {resp.status_code}); will retry.")
    return resp


def initial_state(client: httpx.Client, token: str) -> tuple[str, str]:
    resp = _get(client, token, "/profile")
    if resp.status_code != 200:
        raise ConnectorError("provider_error", "Couldn't read the Gmail profile.")
    prof = resp.json()
    # "seed:" = first sync still to do; it looks at a few recent messages, then switches to history.
    return prof["emailAddress"].lower(), f"seed:{prof['historyId']}"


def _new_message_ids(client: httpx.Client, token: str, cursor: str) -> tuple[list[str], str]:
    if cursor.startswith("seed:"):
        history_id = cursor[5:]
        resp = _get(client, token, "/messages", q="in:inbox newer_than:2d",
                    maxResults=settings.mail_initial_sync_messages)
        ids = [m["id"] for m in resp.json().get("messages", [])] if resp.status_code == 200 else []
        return ids, history_id
    ids: list[str] = []
    page, latest = None, cursor
    while len(ids) < _MAX_PER_SYNC:
        params = {"startHistoryId": cursor, "historyTypes": "messageAdded", "labelId": "INBOX"}
        if page:
            params["pageToken"] = page
        resp = _get(client, token, "/history", **params)
        if resp.status_code == 404:  # historyId too old: start over from now
            prof = _get(client, token, "/profile").json()
            return [], str(prof["historyId"])
        if resp.status_code != 200:
            raise ConnectorError("provider_error", f"Gmail history returned HTTP {resp.status_code}.")
        data = resp.json()
        latest = str(data.get("historyId", latest))
        for h in data.get("history", []):
            for added in h.get("messagesAdded", []):
                mid = added.get("message", {}).get("id")
                if mid and mid not in ids:
                    ids.append(mid)
        page = data.get("nextPageToken")
        if not page:
            break
    return ids[:_MAX_PER_SYNC], latest


def _b64(data: str | None) -> str:
    if not data:
        return ""
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", "replace")


def _walk(part: dict, plain: list[str], html: list[str], attachments: list[dict]) -> None:
    mime = part.get("mimeType", "")
    body = part.get("body", {}) or {}
    if part.get("filename"):
        attachments.append({"filename": part["filename"], "mime_type": mime, "size": body.get("size")})
    elif mime == "text/plain":
        plain.append(_b64(body.get("data")))
    elif mime == "text/html":
        html.append(_b64(body.get("data")))
    for child in part.get("parts", []) or []:
        _walk(child, plain, html, attachments)


def to_normalized(msg: dict) -> NormalizedMessage:
    payload = msg.get("payload", {}) or {}
    headers = mailparse.headers_map([(h.get("name", ""), h.get("value", "")) for h in payload.get("headers", [])])
    plain: list[str] = []
    html: list[str] = []
    attachments: list[dict] = []
    _walk(payload, plain, html, attachments)
    html_all = "\n".join(html)
    text = "\n".join(plain).strip() or mailparse.html_to_text(html_all)
    received = None
    if msg.get("internalDate"):
        received = dt.datetime.fromtimestamp(int(msg["internalDate"]) / 1000, tz=dt.timezone.utc)
    return NormalizedMessage(
        source_type="email", source_provider="gmail", source_application="gmail",
        external_id=str(msg.get("id", "")), received_at=received,
        sender=mailparse.sender_from((headers.get("from") or [""])[0]),
        subject=(headers.get("subject") or [""])[0], text=text, headers=headers,
        reply_to=(headers.get("reply-to") or [""])[0], urls=mailparse.links_from_html(html_all),
        attachments=attachments, completeness="full" if text else "metadata", collection_method="oauth",
    )


def fetch_new(session: Session, source: MonitoredSource, client: httpx.Client, token: str) -> list[NormalizedMessage]:
    ids, cursor = _new_message_ids(client, token, source.sync_cursor or "")
    out: list[NormalizedMessage] = []
    for mid in ids:
        resp = _get(client, token, f"/messages/{mid}", format="full")
        if resp.status_code == 200:
            out.append(to_normalized(resp.json()))
    source.sync_cursor = cursor
    return out
