"""Helpers shared by the mail connectors: HTML → text, link extraction, addresses."""
from __future__ import annotations

import re
from email.utils import parseaddr

from app.content.normalize import clean_text
from app.messaging.schema import Sender

_HREF = re.compile(r"""href\s*=\s*["'](https?://[^"'\s<>]{4,2000})["']""", re.I)
_MAX_LINKS = 20


def html_to_text(html: str) -> str:
    return clean_text(html, limit=20_000)


def links_from_html(html: str) -> list[str]:
    out: list[str] = []
    for m in _HREF.finditer(html or ""):
        u = m.group(1)
        if u not in out:
            out.append(u)
        if len(out) >= _MAX_LINKS:
            break
    return out


def sender_from(raw_from: str) -> Sender:
    name, addr = parseaddr(raw_from or "")
    addr = addr.lower()
    return Sender(display_name=name.strip(), email=addr,
                  domain=addr.split("@")[-1] if "@" in addr else "", raw_from=raw_from or "")


def headers_map(pairs: list[tuple[str, str]]) -> dict[str, list[str]]:
    """Header list in received order (topmost first) → {lower-name: [values…]}."""
    out: dict[str, list[str]] = {}
    for name, value in pairs:
        out.setdefault(name.lower(), []).append(value or "")
    return out
