"""Normalisation helpers. External content is untrusted text: HTML is stripped to
plain text (never stored or rendered as HTML), URLs are validated and
canonicalised, and dates are parsed strictly — an unparseable date is None,
never "now"."""
from __future__ import annotations

import datetime as dt
import email.utils
import hashlib
import html
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_TAG = re.compile(r"<[^>]+>")
_SCRIPT = re.compile(r"<(script|style)\b[^>]*>.*?</\1\s*>", re.I | re.S)
_WS = re.compile(r"\s+")
_TRACKING = re.compile(r"^(utm_|fbclid$|gclid$|mc_|_hs|ref$|cmpid$)", re.I)


def clean_text(value: str | None, limit: int = 600) -> str:
    """HTML → plain text: drop scripts/styles and tags, decode entities, collapse
    whitespace, cut at a word boundary."""
    if not value:
        return ""
    text = _SCRIPT.sub(" ", value)
    text = _TAG.sub(" ", text)
    for _ in range(4):  # some feeds encode entities several times (&amp;#x26;#39;)
        decoded = html.unescape(text)
        if decoded == text:
            break
        text = decoded
    text = _TAG.sub(" ", text)  # entity-encoded markup becomes tags after unescaping
    text = "".join(ch for ch in text if ch == "\n" or ch >= " ")
    text = _WS.sub(" ", text).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0].rstrip(",;:.") + "…"
    return text


def safe_url(value: str | None, base: str | None = None) -> str | None:
    """Return an absolute http(s) URL or None (rejects javascript:, data:, etc.)."""
    if not value:
        return None
    value = value.strip()
    if base and not re.match(r"^[a-z][a-z0-9+.-]*:", value, re.I):
        from urllib.parse import urljoin
        value = urljoin(base, value)
    p = urlparse(value)
    if p.scheme not in ("http", "https") or not p.hostname:
        return None
    return value


def canonical_url(url: str) -> str:
    """Stable identity for a link: lowercase scheme/host, no fragment, no tracking
    parameters, sorted query, no trailing slash on the path."""
    p = urlparse(url.strip())
    query = urlencode(sorted((k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if not _TRACKING.match(k)))
    path = p.path.rstrip("/") or "/"
    netloc = (p.hostname or "").lower() + (f":{p.port}" if p.port and p.port not in (80, 443) else "")
    return urlunparse((p.scheme.lower(), netloc, path, "", query, ""))


def title_norm(title: str) -> str:
    t = re.sub(r"[^a-z0-9 ]+", " ", title.lower())
    return _WS.sub(" ", t).strip()[:300]


def sha256(*parts: str) -> str:
    h = hashlib.sha256()
    for part in parts:
        h.update((part or "").encode("utf-8", "replace"))
        h.update(b"\x00")
    return h.hexdigest()


def parse_date(value: str | None) -> dt.datetime | None:
    """RFC 822 (RSS), ISO 8601 (Atom/JSON) or plain dates → aware UTC datetime.
    Returns None if the value can't be parsed reliably."""
    if not value:
        return None
    value = value.strip()
    try:
        d = email.utils.parsedate_to_datetime(value)
        if d is not None:
            return (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).astimezone(dt.timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass
    iso = value.replace("Z", "+00:00")
    for candidate in (iso, iso[:10]):
        try:
            d = dt.datetime.fromisoformat(candidate)
            return (d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)).astimezone(dt.timezone.utc)
        except ValueError:
            continue
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(_WS.sub(" ", value), fmt).replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue
    return None
