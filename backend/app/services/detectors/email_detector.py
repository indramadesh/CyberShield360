"""Email scanner. Input is raw email text (pasted) or a parsed .eml body.

Analyzes sender / reply-to / return-path, links, and content. Uses the stdlib
`email` parser so it works on full messages with headers; falls back to treating
the whole input as body text when no headers are present."""
from __future__ import annotations

import re
from email import message_from_string
from email.utils import parseaddr

from app.core.enums import ScanType
from app.services.detectors.base import Detector
from app.services.detectors.extract import extract_indicators
from app.services.detectors.message_detector import MessageDetector
from app.services.detectors.url_detector import UrlDetector
from app.services.engine.signals import DetectionResult, DetectionSignal, SignalSource

_url_detector = UrlDetector()
_message_detector = MessageDetector()
_TAG = re.compile(r"<[^>]+>")


def _domain(addr: str) -> str:
    _, email = parseaddr(addr)
    return email.split("@")[-1].lower() if "@" in email else ""


class EmailDetector(Detector):
    scan_type = ScanType.EMAIL.value

    def analyze(self, payload: str) -> DetectionResult:
        msg = message_from_string(payload)
        from_addr = msg.get("From", "")
        reply_to = msg.get("Reply-To", "")
        return_path = msg.get("Return-Path", "")

        # Extract a plain-text body.
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body += part.get_payload(decode=False) or ""
        else:
            body = msg.get_payload(decode=False) or ""
        if not body.strip() and not from_addr:
            body = payload  # no headers -> treat input as body
        body_text = _TAG.sub(" ", body)

        signals: list[DetectionSignal] = []
        from_dom = _domain(from_addr)
        reply_dom = _domain(reply_to)
        return_dom = _domain(return_path)

        if reply_dom and from_dom and reply_dom != from_dom:
            signals.append(DetectionSignal(
                source=SignalSource.DOMAIN, indicator="replyto_mismatch", weight=18,
                summary=f"Reply-To domain ({reply_dom}) differs from the sender "
                        f"domain ({from_dom}).", confidence=0.65, category_hint="PHISHING",
                detail={"from": from_dom, "reply_to": reply_dom},
            ))
        if return_dom and from_dom and return_dom != from_dom:
            signals.append(DetectionSignal(
                source=SignalSource.DOMAIN, indicator="returnpath_mismatch", weight=12,
                summary=f"Return-Path domain ({return_dom}) differs from the sender "
                        f"domain ({from_dom}).", confidence=0.55, category_hint="PHISHING",
            ))

        # Content analysis via the message detector.
        content = _message_detector.analyze(body_text)
        signals.extend(content.signals)
        indicators = list(content.indicators)

        # Run URL heuristics on the first few links in the email.
        link_count = 0
        for value, itype in content.indicators:
            if itype == "url" and link_count < 5:
                link_count += 1
                sub = _url_detector.analyze(value)
                signals.extend(sub.signals)
                indicators.extend(sub.indicators)

        signals.insert(0, DetectionSignal(
            source=SignalSource.CONTENT, indicator="email_sender", weight=0,
            summary=f"Sender: {from_dom or 'unknown'}.", confidence=0.4,
            detail={"from": from_addr, "reply_to": reply_to, "links": link_count},
        ))

        return DetectionResult(signals=signals, indicators=indicators,
                               normalized_input=content.normalized_input or body_text[:2000])
