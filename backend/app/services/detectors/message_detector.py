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
    "payment_demand": (15, "ADVANCE_FEE_SCAM", (
        "delivery charge", "delivery fee", "shipping charge", "shipping fee",
        "processing fee", "handling charge", "service charge", "token amount",
        "small fee", "pay rs", "pay ₹", "pay inr", "to claim", "claim your",
    )),
}

_PROTECTIVE = re.compile(r"\b(do not|don't|dont|never|not to)\s+(share|disclose|tell)")
# "share your OTP", "send the code", "tell us the PIN" — but not "do not share your OTP".
_ASKS_FOR_SECRET = re.compile(
    r"(?<!not )(?<!never )(?<!n't )\b(share|send|tell|forward|give|provide|reply with|enter)\s+"
    r"(?:\w+\s+){0,3}(otp|code|pin|password|cvv)\b")

# Embedded links are checked with the URL scanner; capped so a message stuffed
# with links can't add unbounded weight.
_MAX_LINKS_CHECKED = 3
_LINK_WEIGHT_CAP = 30.0
_url_detector = None


def _url_signals(urls: list[str]) -> list[DetectionSignal]:
    global _url_detector
    if _url_detector is None:  # lazy: url_detector has no dependency on us
        from app.services.detectors.url_detector import UrlDetector
        _url_detector = UrlDetector()
    out: list[DetectionSignal] = []
    for url in urls[:_MAX_LINKS_CHECKED]:
        sub = _url_detector.analyze(url)
        total = sum(max(0.0, s.weight) for s in sub.signals)
        scale = min(1.0, _LINK_WEIGHT_CAP / total) if total else 1.0
        for s in sub.signals:
            s.weight = round(s.weight * scale, 1)
            s.summary = f"Link in message: {s.summary}"
            s.detail = {**s.detail, "url": url}
            out.append(s)
    return out


class MessageDetector(Detector):
    scan_type = ScanType.MESSAGE.value

    def analyze(self, payload: str) -> DetectionResult:
        text = payload.strip()
        low = text.lower()
        signals: list[DetectionSignal] = []
        hit_families: set[str] = set()

        # A genuine one-time-code message warns you NOT to share it; only a request to
        # share or send the code counts as asking for credentials.
        otp_delivery = bool(_PROTECTIVE.search(low)) and not _ASKS_FOR_SECRET.search(low)

        for family, (weight, cat, phrases) in _FAMILIES.items():
            if family == "credential_request" and otp_delivery:
                continue
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

        asked = _ASKS_FOR_SECRET.search(low)
        if asked and "credential_request" not in hit_families:
            hit_families.add("credential_request")
            weight, cat, _ = _FAMILIES["credential_request"]
            signals.append(DetectionSignal(
                source=SignalSource.CONTENT, indicator="msg_credential_request", weight=weight,
                summary="Message shows 'credential request' language.", confidence=0.6,
                category_hint=cat, detail={"matched": [asked.group(0)]},
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

        if "reward_bait" in hit_families and "payment_demand" in hit_families:
            signals.append(DetectionSignal(
                source=SignalSource.RULE, indicator="reward_plus_payment",
                weight=20, summary="A prize or reward is offered but you must pay first "
                "to receive it — a classic advance-fee scam.", confidence=0.75,
                category_hint="ADVANCE_FEE_SCAM",
            ))

        indicators = extract_indicators(text)
        has_link = any(t in ("url", "domain") for _, t in indicators)
        if has_link:
            signals.append(DetectionSignal(
                source=SignalSource.CONTENT, indicator="contains_link", weight=6,
                summary="The message contains a link.", confidence=0.4,
            ))
            signals.extend(_url_signals([v for v, t in indicators if t == "url"]))
        lure = hit_families & {"reward_bait", "payment_demand", "credential_request", "kyc", "upi"}
        if has_link and lure:
            signals.append(DetectionSignal(
                source=SignalSource.RULE, indicator="lure_plus_link",
                weight=12, summary="The message pushes you to act on an offer or request "
                "through a link — links like this often lead to phishing pages.",
                confidence=0.65, category_hint="PHISHING",
            ))

        normalized = pii.redact(text)
        return DetectionResult(signals=signals, indicators=indicators, normalized_input=normalized)
