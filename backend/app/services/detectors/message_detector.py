"""Message scanner: social-engineering heuristics over text.

Keyword families are a baseline; the detector also rewards *combinations* (e.g.
urgency + credential request => stronger phishing signal) so it is not purely
keyword matching. ML/NLP signals plug in here later via SignalSource.ML.
"""
from __future__ import annotations

import re

from app.core.enums import ScanType
from app.services import pii
from app.services.detectors.base import Detector
from app.services.detectors.extract import extract_indicators
from app.services.engine.signals import DetectionResult, DetectionSignal, SignalSource

# family -> (weight, category_hint, phrases)
_FAMILIES: dict[str, tuple[float, str | None, tuple[str, ...]]] = {
    "urgency": (10, None, (
        "urgent", "immediately", "act now", "within 24 hours", "expire", "expires",
        "last warning", "account suspended", "suspended", "blocked", "deactivat",
    )),
    "threat_fear": (10, "IMPERSONATION", (
        "legal action", "arrest", "police", "penalty", "fine", "court", "fir",
    )),
    "reward_bait": (10, "ADVANCE_FEE_SCAM", (
        "you won", "winner", "lottery", "prize", "cashback", "reward", "bonus",
        "free gift", "claim now", "congratulations",
    )),
    "authority": (8, "IMPERSONATION", (
        "income tax", "rbi", "government", "customs", "electricity board",
        "bank official", "kyc team",
    )),
    "credential_request": (25, "CREDENTIAL_THEFT", (
        "otp", "one time password", "password", "pin", "cvv", "login details",
        "verify your account", "confirm your identity",
    )),
    "kyc": (18, "FAKE_KYC", (
        "update kyc", "kyc pending", "kyc expired", "complete kyc", "re-kyc",
    )),
    "upi": (18, "UPI_FRAUD", (
        "upi pin", "approve the request", "collect request", "scan to receive",
        "autopay", "upi id",
    )),
    "remote_access": (22, "TECH_SUPPORT_SCAM", (
        "anydesk", "teamviewer", "quicksupport", "screen share", "remote access",
    )),
    "investment": (15, "INVESTMENT_SCAM", (
        "guaranteed return", "double your money", "trading profit", "crypto profit",
        "investment opportunity", "high returns",
    )),
    "job_scam": (15, "JOB_SCAM", (
        "work from home", "earn daily", "part time job", "registration fee",
        "earn from home", "data entry job",
    )),
    "delivery": (12, "DELIVERY_SCAM", (
        "parcel", "customs fee", "redelivery", "package held", "delivery failed",
    )),
}


class MessageDetector(Detector):
    scan_type = ScanType.MESSAGE.value

    def analyze(self, payload: str) -> DetectionResult:
        text = payload.strip()
        low = text.lower()
        signals: list[DetectionSignal] = []
        hit_families: set[str] = set()

        for family, (weight, cat, phrases) in _FAMILIES.items():
            matched = sorted({p for p in phrases if p in low})
            if matched:
                hit_families.add(family)
                signals.append(DetectionSignal(
                    source=SignalSource.CONTENT,
                    indicator=f"msg_{family}",
                    weight=weight,
                    summary=f"Message shows '{family.replace('_', ' ')}' language.",
                    confidence=0.5 if weight < 15 else 0.6,
                    category_hint=cat,
                    detail={"matched": matched},
                ))

        # Combination boosts — social engineering rarely uses one lever alone.
        if "urgency" in hit_families and hit_families & {"credential_request", "kyc", "upi"}:
            signals.append(DetectionSignal(
                source=SignalSource.RULE, indicator="urgency_plus_credential",
                weight=15, summary="Urgency is combined with a request for sensitive "
                "details — a classic phishing pattern.", confidence=0.7,
                category_hint="PHISHING",
            ))
        if "reward_bait" in hit_families and "upi" in hit_families:
            signals.append(DetectionSignal(
                source=SignalSource.RULE, indicator="reward_plus_upi",
                weight=12, summary="A reward offer is paired with a UPI action.",
                confidence=0.65, category_hint="UPI_FRAUD",
            ))

        indicators = extract_indicators(text)
        if any(t in ("url", "domain") for _, t in indicators):
            signals.append(DetectionSignal(
                source=SignalSource.CONTENT, indicator="contains_link", weight=6,
                summary="The message contains a link.", confidence=0.4,
            ))

        normalized = pii.redact(text)
        return DetectionResult(signals=signals, indicators=indicators, normalized_input=normalized)
