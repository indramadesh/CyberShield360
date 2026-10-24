"""Risk Engine — the ONLY place signals become a score/band/confidence.

Design choices (all documented as operator-tunable, not universal science):
- Raw score = sum of signal weights, then passed through a *saturating* function
  so it normalizes to 0..100 and never grows unbounded (spec §24).
- Bands come from configurable thresholds (RISK_THRESHOLD_*).
- Confidence is separate from risk (spec §2). It combines signal reliabilities
  (noisy-OR), is capped below 1.0 (never "100% certain"), and is reduced when
  threat-intel coverage is degraded (spec §70/§71).
- Category = the hint carrying the most weight; defaults to OTHER.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from app.core.config import settings
from app.core.enums import RiskLevel
from app.services.engine.signals import DetectionSignal

# Saturation constant: larger => slower saturation. Tuned so that a threat-intel
# match (40) + credential request (25) lands solidly in HIGH.
_SATURATION_K = 60.0
_CONFIDENCE_CAP = 0.95  # we never claim certainty


@dataclass
class RiskAssessment:
    risk_level: str
    risk_score: int
    confidence: float
    category: str
    indicators: list[str]
    coverage_degraded: bool
    notes: list[str]


def _normalize(raw: float) -> int:
    if raw <= 0:
        return 0
    return round(100 * (1 - math.exp(-raw / _SATURATION_K)))


def _band(score: int) -> str:
    # Thresholds honor admin runtime overrides (fall back to env settings).
    from app.core import runtime_config

    t = runtime_config.effective_thresholds()
    if score >= t["critical"]:
        return RiskLevel.CRITICAL.value
    if score >= t["high"]:
        return RiskLevel.HIGH.value
    if score >= t["suspicious"]:
        return RiskLevel.SUSPICIOUS.value
    return RiskLevel.LOW.value


def _pick_category(signals: list[DetectionSignal]) -> str:
    totals: dict[str, float] = {}
    for s in signals:
        if s.category_hint:
            totals[s.category_hint] = totals.get(s.category_hint, 0.0) + s.weight
    if not totals:
        return "OTHER"
    return max(totals, key=totals.get)


def _confidence(signals: list[DetectionSignal], coverage_degraded: bool) -> float:
    if not signals:
        # Absence of indicators is weak evidence, not strong proof of safety.
        return 0.3
    # Noisy-OR of per-signal confidences.
    product = 1.0
    for s in signals:
        product *= (1 - max(0.0, min(1.0, s.confidence)))
    conf = 1 - product
    if coverage_degraded:
        conf *= 0.85
    return round(min(conf, _CONFIDENCE_CAP), 2)


def score(signals: list[DetectionSignal], *, coverage_degraded: bool = False) -> RiskAssessment:
    raw = sum(max(0.0, s.weight) for s in signals)
    risk_score = _normalize(raw)
    level = _band(risk_score)
    category = _pick_category(signals)
    confidence = _confidence(signals, coverage_degraded)
    indicators = sorted({s.indicator for s in signals})

    notes: list[str] = []
    if coverage_degraded:
        notes.append(
            "Analysis completed with limited threat-intelligence coverage; "
            "one or more providers were unavailable."
        )
    if not signals:
        notes.append(
            "No known malicious indicators were detected. This does not guarantee "
            "that the content is safe."
        )
    return RiskAssessment(
        risk_level=level,
        risk_score=risk_score,
        confidence=confidence,
        category=category,
        indicators=indicators,
        coverage_degraded=coverage_degraded,
        notes=notes,
    )
