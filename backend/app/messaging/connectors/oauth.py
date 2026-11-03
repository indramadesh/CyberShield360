"""Server-side OAuth 2.0 (authorization code + PKCE) for the read-only mail
connectors. Tokens are encrypted at rest and never sent to the browser."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import secrets
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.db.models.messaging import MonitoredSource, OAuthState, OAuthToken
from app.messaging import crypto, gateway

_STATE_TTL = dt.timedelta(minutes=10)
_TIMEOUT = 20.0


class ConnectorError(Exception):
    def __init__(self, code: str, message: str, *, reconnect: bool = False):
        super().__init__(message)
        self.code, self.message, self.reconnect = code, message, reconnect


@dataclass(frozen=True)
class Provider:
    name: str  # gmail|outlook
    kind: str  # MonitoredSource.kind
    authorize_url: str
    token_url: str
    scopes: tuple[str, ...]
    extra_auth_params: dict

    @property
    def client_id(self) -> str:
        return settings.google_client_id if self.name == "gmail" else settings.microsoft_client_id

    @property
    def client_secret(self) -> str:
        return settings.google_client_secret if self.name == "gmail" else settings.microsoft_client_secret

    @property
    def configured(self) -> bool:
        # In production a dedicated token key is required: the mail-sync worker may run
        # elsewhere (e.g. GitHub Actions) without SECRET_KEY, and must decrypt the same tokens.
        if settings.is_production and not settings.token_encryption_key:
            return False
        return bool(self.client_id and self.client_secret)

    @property
    def redirect_uri(self) -> str:
        return f"{settings.public_base_url.rstrip('/')}{settings.api_v1_prefix}/msgintel/oauth/{self.name}/callback"


def providers() -> dict[str, Provider]:
    tenant = settings.microsoft_tenant or "common"
    return {
        "gmail": Provider(
            "gmail", "gmail", "https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token",
            ("https://www.googleapis.com/auth/gmail.readonly",),
            # offline + consent => a refresh token; we never request send/modify scopes.
            {"access_type": "offline", "prompt": "consent", "include_granted_scopes": "false"}),
        "outlook": Provider(
            "outlook", "outlook", f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            ("offline_access", "User.Read", "Mail.Read"), {"response_mode": "query", "prompt": "select_account"}),
    }


def get_provider(name: str) -> Provider:
    p = providers().get(name)
    if p is None:
        raise ConnectorError("unknown_provider", "Unknown mail provider.")
    if not p.configured:
        raise ConnectorError("not_configured", f"{name.title()} connection isn't set up on this server yet.")
    return p


def start(session: Session, user_id: str, name: str) -> str:
    p = get_provider(name)
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    session.add(OAuthState(user_id=user_id, provider=name, state_hash=crypto.token_hash(state),
                           verifier_enc=crypto.encrypt(verifier), expires_at=utcnow() + _STATE_TTL))
    session.commit()
    params = {"client_id": p.client_id, "redirect_uri": p.redirect_uri, "response_type": "code",
              "scope": " ".join(p.scopes), "state": state, "code_challenge": challenge,
              "code_challenge_method": "S256", **p.extra_auth_params}
    return f"{p.authorize_url}?{urlencode(params)}"


def _aware(d: dt.datetime | None) -> dt.datetime | None:
    return None if d is None else (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc))


def _store_tokens(session: Session, source: MonitoredSource, p: Provider, data: dict) -> None:
    row = session.scalars(select(OAuthToken).where(OAuthToken.source_id == source.id)).first()
    if row is None:
        row = OAuthToken(source_id=source.id, provider=p.name)
        session.add(row)
    if data.get("refresh_token"):  # Google only returns it on first consent
        row.refresh_token_enc = crypto.encrypt(data["refresh_token"])
    row.access_token_enc = crypto.encrypt(data.get("access_token"))
    row.access_expires_at = utcnow() + dt.timedelta(seconds=int(data.get("expires_in", 3000)) - 60)
    row.scopes = str(data.get("scope", " ".join(p.scopes)))[:500]


def finish(session: Session, name: str, code: str, state: str, *, client: httpx.Client | None = None) -> MonitoredSource:
    from app.messaging.connectors import gmail, outlook

    p = get_provider(name)
    row = session.scalars(select(OAuthState).where(
        OAuthState.state_hash == crypto.token_hash(state or ""), OAuthState.provider == name)).first()
    if row is None or _aware(row.expires_at) < utcnow():
        raise ConnectorError("bad_state", "This connection link expired or was already used. Please try again.")
    verifier = crypto.decrypt(row.verifier_enc)
    user_id = row.user_id
    session.delete(row)  # single use
    session.commit()

    http = client or httpx.Client(timeout=_TIMEOUT)
    resp = http.post(p.token_url, data={
        "client_id": p.client_id, "client_secret": p.client_secret, "code": code, "code_verifier": verifier,
        "grant_type": "authorization_code", "redirect_uri": p.redirect_uri, "scope": " ".join(p.scopes)})
    if resp.status_code != 200:
        raise ConnectorError("token_exchange_failed", "The provider didn't accept the sign-in. Please try again.")
    data = resp.json()
    granted = set(str(data.get("scope", "")).split())
    # Microsoft reports scopes as full URIs (https://graph.microsoft.com/Mail.Read).
    needed = [s for s in p.scopes if s not in ("offline_access", "User.Read")]
    if granted and not all(any(g == s or g.endswith("/" + s) for g in granted) for s in needed):
        raise ConnectorError("scope_denied", "Read access to mail wasn't granted, so the account can't be checked.")

    module = gmail if name == "gmail" else outlook
    account, cursor = module.initial_state(http, data["access_token"])
    source = session.scalars(select(MonitoredSource).where(
        MonitoredSource.user_id == user_id, MonitoredSource.kind == p.kind, MonitoredSource.account == account)).first()
    if source is None:
        source = MonitoredSource(user_id=user_id, kind=p.kind, account=account, label=account)
        session.add(source)
    source.status, source.permission_state, source.last_error = "connected", "granted", None
    source.sync_cursor, source.consecutive_failures = cursor, 0
    source.scope_json = {"folders": ["INBOX"], "read_only": True}
    session.flush()
    _store_tokens(session, source, p, data)
    gateway.grant_consent(session, source)
    session.commit()
    return source


def access_token(session: Session, source: MonitoredSource, *, client: httpx.Client) -> str:
    p = get_provider(source.kind)
    row = session.scalars(select(OAuthToken).where(OAuthToken.source_id == source.id)).first()
    if row is None:
        raise ConnectorError("no_token", "This account needs to be connected again.", reconnect=True)
    token = crypto.decrypt(row.access_token_enc)
    if token and row.access_expires_at and _aware(row.access_expires_at) > utcnow():
        return token
    refresh = crypto.decrypt(row.refresh_token_enc)
    if not refresh:
        raise ConnectorError("no_refresh_token", "This account needs to be connected again.", reconnect=True)
    resp = client.post(p.token_url, data={
        "client_id": p.client_id, "client_secret": p.client_secret, "refresh_token": refresh,
        "grant_type": "refresh_token", "scope": " ".join(p.scopes)})
    if resp.status_code in (400, 401):
        # invalid_grant: the user revoked access or the token expired.
        raise ConnectorError("revoked", "Access was revoked or expired. Connect the account again.", reconnect=True)
    if resp.status_code != 200:
        raise ConnectorError("provider_error", f"The provider returned HTTP {resp.status_code}.")
    _store_tokens(session, source, p, resp.json())
    session.commit()
    return resp.json()["access_token"]


def disconnect(session: Session, source: MonitoredSource, *, client: httpx.Client | None = None) -> str:
    """Revoke where the provider allows it, delete our copy of the tokens, stop ingestion.
    Returns a note for the user about anything they must do themselves."""
    row = session.scalars(select(OAuthToken).where(OAuthToken.source_id == source.id)).first()
    note = ""
    if row is not None:
        if source.kind == "gmail":
            token = crypto.decrypt(row.refresh_token_enc) or crypto.decrypt(row.access_token_enc)
            if token:
                try:
                    (client or httpx.Client(timeout=_TIMEOUT)).post(
                        "https://oauth2.googleapis.com/revoke", data={"token": token})
                except httpx.HTTPError:
                    note = "Google couldn't be reached to revoke access; remove CyberShield360 at myaccount.google.com/permissions."
        else:
            note = ("Microsoft has no way for us to revoke access ourselves. We deleted our copy of the "
                    "tokens; to remove the permission too, visit account.live.com/consent/Manage "
                    "(personal) or myapps.microsoft.com (work or school).")
        session.delete(row)
    gateway.revoke_consent(session, source)
    source.status, source.sync_cursor = "disconnected", None
    session.commit()
    return note
