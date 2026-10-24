"""Normalized detection signals shared by every detector.

Detectors NEVER compute a risk score — they only emit signals. The Risk Engine is
the single place that turns signals into a band/score/confidence (ARCHITECTURE §6).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class SignalSource(str, Enum):
    RULE = "rule"
    ML = "ml"
    INTEL = "intel"
    DOMAIN = "domain"
    CONTENT = "content"
    VISUAL = "visual"
    COMMUNITY = "community"


@dataclass
class DetectionSignal:
    source: SignalSource
    indicator: str          # stable code, e.g. "credential_request"
    weight: float           # points contributed to the raw score (pre-normalization)
    summary: str            # human-readable, safe to show the user
    confidence: float = 0.6  # per-signal reliability, 0..1
    category_hint: str | None = None  # threat category this signal points to
    detail: dict = field(default_factory=dict)  # technical specifics (collapsed in UI)


@dataclass
class DetectionResult:
    """What a detector returns: its signals plus any indicators it extracted
    (URLs/domains/phones/UPI/emails) for downstream threat-intel lookup."""

    signals: list[DetectionSignal] = field(default_factory=list)
    indicators: list[tuple[str, str]] = field(default_factory=list)  # (value, type)
    normalized_input: str = ""  # redacted/normalized text safe to persist & show
