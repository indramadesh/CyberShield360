"""Best-effort PII detection + redaction.

Used before persisting input and before any LLM call. We make no claim of perfect
coverage (spec §32). Order matters: redact the most specific patterns first.
"""
from __future__ import annotations

import re

# UPI handle: name@psp where psp is a known-ish suffix (kept broad but bounded).
_UPI = re.compile(r"\b[\w.\-]{2,}@(?:oksbi|okhdfcbank|okicici|okaxis|ybl|paytm|apl|ibl|upi|axl|hdfcbank)\b", re.I)
_EMAIL = re.compile(r"\b[\w.\-]+@[\w\-]+\.[A-Za-z]{2,}\b")
_PAN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
_AADHAAR = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
_CARD = re.compile(r"\b(?:\d[ -]?){13,16}\b")
_PHONE = re.compile(r"(?<!\d)(?:\+91[\-\s]?|0)?[6-9]\d{9}(?!\d)")

# (label, pattern) applied in order. UPI before EMAIL (UPI looks email-like);
# AADHAAR/CARD before PHONE (longer digit runs first).
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("UPI", _UPI),
    ("EMAIL", _EMAIL),
    ("PAN", _PAN),
    ("AADHAAR", _AADHAAR),
    ("CARD", _CARD),
    ("PHONE", _PHONE),
]


def detect(text: str) -> dict[str, int]:
    """Return counts of each PII type found (no raw values returned)."""
    counts: dict[str, int] = {}
    for label, pat in _PATTERNS:
        n = len(pat.findall(text))
        if n:
            counts[label] = n
    return counts


def redact(text: str) -> str:
    """Replace detected PII with typed placeholders."""
    out = text
    for label, pat in _PATTERNS:
        out = pat.sub(f"[REDACTED_{label}]", out)
    return out
