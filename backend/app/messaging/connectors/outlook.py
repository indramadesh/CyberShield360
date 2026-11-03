"""Outlook / Microsoft 365 connector (delegated Mail.Read, read-only).

Incremental sync with Microsoft Graph delta on the Inbox: the first connection
starts a delta round limited to the last two days; the deltaLink it ends with is
stored and later syncs return only what changed since."""
from __future__ import annotations

import datetime as dt

import httpx
from sqlalchemy.orm import Session

from app.db.models.messaging import MonitoredSource
from app.messaging.connectors import mailparse
from app.messaging.connectors.oauth import ConnectorError
from app.messaging.schema import NormalizedMessage

GRAPH = "https://graph.microsoft.com/v1.0"
_MAX_PAGES = 5
_MAX_PER_SYNC = 50


def _get(client: httpx.Client, token: str, url: str, **params) -> httpx.Response:
    resp = client.get(url, params=params or None, headers={
        "Authorization": f"Bearer {token}", "Prefer": 'outlook.body-content-type="text", odata.maxpagesize=20'})
    if resp.status_code == 401:
        raise ConnectorError("revoked", "Outlook access was revoked or expired. Connect again.", reconnect=True)
    if resp.status_code == 403:
        raise ConnectorError("forbidden", "Outlook refused access to the mailbox.")
    if resp.status_code == 429 or resp.status_code >= 500:
        raise ConnectorError("provider_error", f"Outlook is unavailable (HTTP {resp.status_code}); will retry.")
    return resp


def initial_state(client: httpx.Client, token: str) -> tuple[str, str]:
    resp = _get(client, token, f"{GRAPH}/me", **{"$select": "mail,userPrincipalName"})
    if resp.status_code != 200:
        raise ConnectorError("provider_error", "Couldn't read the Microsoft account.")
    me = resp.json()
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    start = (f"{GRAPH}/me/mailFolders/inbox/messages/delta?changeType=created"
             f"&$select=id&$filter=receivedDateTime+ge+{since}")
    return (me.get("mail") or me.get("userPrincipalName") or "").lower(), start


def _new_message_ids(client: httpx.Client, token: str, cursor: str) -> tuple[list[str], str]:
    ids: list[str] = []
    url = cursor
    for _ in range(_MAX_PAGES):
        resp = _get(client, token, url)
        if resp.status_code in (400, 404, 410):  # sync state no longer valid: restart from now
            return [], initial_state(client, token)[1]
        if resp.status_code != 200:
            raise ConnectorError("provider_error", f"Outlook delta returned HTTP {resp.status_code}.")
        data = resp.json()
        for item in data.get("value", []):
            if "@removed" not in item and item.get("id") and item["id"] not in ids:
                ids.append(item["id"])
        if data.get("@odata.deltaLink"):
            return ids[:_MAX_PER_SYNC], data["@odata.deltaLink"]
        url = data.get("@odata.nextLink")
        if not url or len(ids) >= _MAX_PER_SYNC:
            break
    # Round not finished: continue from the next page on the following sync.
    return ids[:_MAX_PER_SYNC], url or cursor


def to_normalized(msg: dict, attachments: list[dict]) -> NormalizedMessage:
    headers = mailparse.headers_map([(h.get("name", ""), h.get("value", ""))
                                     for h in msg.get("internetMessageHeaders") or []])
    frm = (msg.get("from") or {}).get("emailAddress") or {}
    raw_from = f'"{frm.get("name", "")}" <{frm.get("address", "")}>' if frm else ""
    reply = ((msg.get("replyTo") or [{}])[0].get("emailAddress") or {}).get("address", "") if msg.get("replyTo") else ""
    body = (msg.get("body") or {}).get("content", "") or ""
    is_html = (msg.get("body") or {}).get("contentType") == "html"
    text = mailparse.html_to_text(body) if is_html else body
    received = None
    if msg.get("receivedDateTime"):
        received = dt.datetime.fromisoformat(msg["receivedDateTime"].replace("Z", "+00:00"))
    return NormalizedMessage(
        source_type="email", source_provider="outlook", source_application="outlook",
        external_id=str(msg.get("id", "")), received_at=received, sender=mailparse.sender_from(raw_from),
        subject=msg.get("subject") or "", text=text.strip(), headers=headers, reply_to=reply,
        urls=mailparse.links_from_html(body) if is_html else [],
        attachments=[{"filename": a.get("name"), "mime_type": a.get("contentType"), "size": a.get("size")}
                     for a in attachments],
        completeness="full" if text.strip() else "metadata", collection_method="oauth",
    )


def fetch_new(session: Session, source: MonitoredSource, client: httpx.Client, token: str) -> list[NormalizedMessage]:
    ids, cursor = _new_message_ids(client, token, source.sync_cursor or initial_state(client, token)[1])
    out: list[NormalizedMessage] = []
    select = "subject,from,replyTo,receivedDateTime,body,internetMessageHeaders,hasAttachments"
    for mid in ids:
        resp = _get(client, token, f"{GRAPH}/me/messages/{mid}", **{"$select": select})
        if resp.status_code != 200:
            continue
        msg = resp.json()
        atts: list[dict] = []
        if msg.get("hasAttachments"):
            a = _get(client, token, f"{GRAPH}/me/messages/{mid}/attachments", **{"$select": "name,contentType,size"})
            atts = a.json().get("value", []) if a.status_code == 200 else []
        out.append(to_normalized(msg, atts))
    source.sync_cursor = cursor
    return out
