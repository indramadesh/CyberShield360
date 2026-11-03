"""Unified analysis: every source goes through the existing CyberShield detectors,
threat-intel lookup and the single risk engine. This module adds email-only signals,
merges correlated signals, and turns the result into a message classification.

Rules and heuristics only — no ML model and no paid AI. Classification never says
"safe": with no evidence either way the answer is UNKNOWN."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.enums import RiskLevel
from app.messaging import email_signals
from app.messaging.schema import NormalizedMessage
from app.services.detectors.message_detector import MessageDetector
from app.services.detectors.url_detector import UrlDetector
from app.services.engine import evidence_engine, recommendation_engine, risk_engine
from app.services.engine.signals import DetectionSignal

ENGINE_VERSION = "msgintel-1.0-rules"
CLASSIFICATIONS = ("SCAM", "PHISHING", "SUSPICIOUS", "SPAM", "PROMOTIONAL", "LIKELY_LEGITIMATE", "UNKNOWN")

_message_detector = MessageDetector()
_url_detector = UrlDetector()
_MAX_EXTRA_URLS = 5

_PHISHING_HINTS = {"PHISHING", "CREDENTIAL_THEFT", "IMPERSONATION"}
_SCAM_HINTS = {"ADVANCE_FEE_SCAM", "UPI_FRAUD", "FAKE_KYC", "INVESTMENT_SCAM", "JOB_SCAM", "DELIVERY_SCAM",
               "TECH_SUPPORT_SCAM", "ROMANCE_SCAM", "FAKE_SHOPPING"}
_PROMO = re.compile(r"\b(unsubscribe|% ?off|sale ends|limited[- ]time offer|shop now|use code|coupon|"
                    r"newsletter|special offer|deal of the day|flat \d+%|buy now)\b", re.I)


@dataclass
class Analysis:
    classification: str
    categories: list[str]
    risk_level: str  # CRITICAL|HIGH|MEDIUM|LOW|UNKNOWN
    risk_score: int
    confidence: float
    threat_category: str
    evidence: list[dict]
    urls: list[dict]
    attachments: list[dict]
    auth: dict
    limitations: list[str]
    recommendations: list[str]
    engine_version: str = ENGINE_VERSION
    indicators: list[str] = field(default_factory=list)


def _merge_correlated(signals: list[DetectionSignal]) -> list[DetectionSignal]:
    """The same indicator from several links (e.g. two http:// links) is one piece of
    evidence, not two: keep the strongest instance of each indicator."""
    best: dict[str, DetectionSignal] = {}
    for s in signals:
        cur = best.get(s.indicator)
        if cur is None or s.weight > cur.weight:
            best[s.indicator] = s
    return list(best.values())


def _band(level: str) -> str:
    return "MEDIUM" if level == RiskLevel.SUSPICIOUS.value else level


def analyze(session: Session, msg: NormalizedMessage) -> Analysis:
    from app.services.scan_orchestrator import _intel_signals

    text = "\n".join(p for p in (msg.subject, msg.text) if p).strip()
    signals: list[DetectionSignal] = []
    indicators: list[tuple[str, str]] = []

    if text:
        content = _message_detector.analyze(text)
        signals += content.signals
        indicators += content.indicators

    seen_urls = {v for v, t in indicators if t == "url"}
    extra = [u for u in msg.urls if u not in seen_urls][:_MAX_EXTRA_URLS]
    for u in extra:
        sub = _url_detector.analyze(u)
        signals += sub.signals
        indicators += sub.indicators

    auth: dict = {}
    if msg.source_type == "email":
        auth = email_signals.parse_auth_results(msg.headers, msg.source_provider)
        signals += email_signals.auth_signals(auth)
        signals += email_signals.sender_signals(msg.sender.raw_from or msg.sender.email)
        if msg.reply_to and msg.sender.domain:
            rd = msg.reply_to.rsplit("@", 1)[-1].strip(" >").lower()
            if rd and rd != msg.sender.domain:
                from app.services.engine.signals import SignalSource

                signals.append(DetectionSignal(
                    source=SignalSource.DOMAIN, indicator="replyto_mismatch", weight=18, confidence=0.65,
                    summary=f"Replies would go to {rd}, not to the sender's domain ({msg.sender.domain}).",
                    category_hint="PHISHING", detail={"from": msg.sender.domain, "reply_to": rd}))
        if msg.sender.domain:
            indicators.append((msg.sender.domain, "domain"))
    signals += email_signals.attachment_signals(msg.attachments)

    intel, degraded, _ = _intel_signals(session, list(dict.fromkeys(indicators)))
    signals = _merge_correlated(signals + intel)
    scored = risk_engine.score(signals, coverage_degraded=degraded)

    hints = {s.category_hint for s in signals if s.category_hint and s.weight > 0}
    elevated = scored.risk_level != RiskLevel.LOW.value
    promo = bool(_PROMO.search(text)) or "list-unsubscribe" in msg.headers
    categories: list[str] = []
    if elevated and hints & _PHISHING_HINTS:
        categories.append("PHISHING")
    if elevated and hints & _SCAM_HINTS:
        categories.append("SCAM")

    limitations = _limitations(msg, auth, degraded, text)
    evidence_signals = [s for s in signals if s.weight > 0]
    no_content = not text and not msg.urls and not msg.attachments

    if categories:
        # Both can apply; the headline follows the strongest evidence.
        classification = "SCAM" if "SCAM" in categories and scored.category in _SCAM_HINTS else categories[0]
    elif elevated:
        classification = "SUSPICIOUS"
        categories.append("SUSPICIOUS")
    elif no_content:
        classification = "UNKNOWN"
    elif promo:
        spammy = msg.source_type == "email" and (
            auth.get("dmarc") == "fail" or auth.get("spf") in ("fail", "softfail")
            or "list-unsubscribe" not in msg.headers)
        classification = "SPAM" if spammy else "PROMOTIONAL"
        categories.append(classification)
    elif (msg.source_type == "email" and msg.completeness == "full" and scored.risk_score < 10
          and (auth.get("dmarc") == "pass" or (auth.get("spf") == "pass" and auth.get("dkim") == "pass"))):
        # Only a fully read email that its provider authenticated, with no warning signs.
        classification = "LIKELY_LEGITIMATE"
        categories.append(classification)
    else:
        classification = "UNKNOWN"

    risk_level = "UNKNOWN" if no_content and not evidence_signals else _band(scored.risk_level)
    urls = [{"url": u, "checked": True} for u in list(dict.fromkeys([v for v, t in indicators if t == "url"]))[:10]]
    return Analysis(
        classification=classification,
        categories=categories or [classification],
        risk_level=risk_level,
        risk_score=scored.risk_score,
        confidence=scored.confidence,
        threat_category=scored.category,
        evidence=evidence_engine.build_evidence(signals),
        urls=urls,
        attachments=[{"filename": a.get("filename"), "mime_type": a.get("mime_type"), "size": a.get("size")}
                     for a in msg.attachments[:20]],
        auth=auth,
        limitations=limitations,
        recommendations=recommendation_engine.recommendations(scored.category, scored.risk_level),
        indicators=scored.indicators,
    )


def _limitations(msg: NormalizedMessage, auth: dict, degraded: bool, text: str) -> list[str]:
    out: list[str] = []
    if msg.completeness in ("partial", "preview"):
        out.append("Only the notification text was available, which may be cut short or summarised by the app.")
    if msg.completeness == "metadata" or not text:
        out.append("No message text was available to analyse.")
    if msg.source_type == "email" and not auth:
        out.append("No trusted authentication results (SPF/DKIM/DMARC) were available, so the sender's "
                   "authenticity wasn't verified.")
    if msg.source_type in ("notification", "sms", "shared_text"):
        out.append("Sender identity can't be verified from a notification or shared text.")
    if msg.attachments:
        out.append("Attachments were judged by name and type only; they weren't downloaded or scanned for malware.")
    if text or msg.urls:
        out.append("Links were checked by their address and our threat lists; they weren't opened.")
    if degraded:
        out.append("Some threat-intelligence sources were unavailable during this analysis.")
    out.append("This is a rule-based assessment and can be wrong. No result means a message is guaranteed safe.")
    return out
