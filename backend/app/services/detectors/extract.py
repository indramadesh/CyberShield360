"""Extract indicators (URLs, phones, emails, UPI) from free text.

Shared by the message detector now and the image/OCR path later."""
from __future__ import annotations

import re

_URL = re.compile(r"\b(?:https?://|www\.)[^\s<>\"')]+", re.I)
_BARE_DOMAIN = re.compile(
    r"\b(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b", re.I
)
_PHONE = re.compile(r"(?<!\d)(?:\+91[\-\s]?|0)?[6-9]\d{9}(?!\d)")
_EMAIL = re.compile(r"\b[\w.\-]+@[\w\-]+\.[A-Za-z]{2,}\b")
_UPI = re.compile(r"\b[\w.\-]{2,}@(?:oksbi|okhdfcbank|okicici|okaxis|ybl|paytm|apl|ibl|upi|axl|hdfcbank)\b", re.I)


def extract_indicators(text: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(value: str, type_: str) -> None:
        key = f"{type_}:{value.lower()}"
        if key not in seen:
            seen.add(key)
            found.append((value, type_))

    for m in _URL.findall(text):
        add(m.rstrip(".,);"), "url")
    for m in _UPI.findall(text):
        add(m, "upi")
    for m in _EMAIL.findall(text):
        # Skip UPI handles already captured.
        if not _UPI.fullmatch(m):
            add(m, "email")
    for m in _PHONE.findall(text):
        add(m, "phone")
    # Bare domains not already part of a captured URL.
    joined_urls = " ".join(v for v, t in found if t == "url").lower()
    for m in _BARE_DOMAIN.findall(text):
        if m.lower() not in joined_urls and "@" not in m:
            add(m, "domain")
    return found
