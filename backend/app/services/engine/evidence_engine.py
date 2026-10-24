"""Evidence Engine — turns signals into user-facing evidence items.

Evidence is *descriptive*: what was found and where it came from. It is derived
only from real signals (the LLM never adds evidence here)."""
from __future__ import annotations

from app.services.engine.signals import DetectionSignal


def build_evidence(signals: list[DetectionSignal]) -> list[dict]:
    evidence: list[dict] = []
    for s in signals:
        evidence.append(
            {
                "indicator": s.indicator,
                "summary": s.summary,
                "source": s.source.value,
                "weight": s.weight,
                "detail": s.detail,
            }
        )
    # Strongest-first so the UI leads with the most important findings.
    evidence.sort(key=lambda e: e["weight"], reverse=True)
    return evidence
