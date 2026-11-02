"""QR payload analyzer. Input is the decoded QR string.

Classifies the payload (URL / UPI / tel / wifi / text) and produces signals.
Important: an unknown UPI ID is NOT treated as malicious on its own (spec §21)."""
from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from app.core.enums import ScanType
from app.services.detectors.base import Detector
from app.services.detectors.message_detector import MessageDetector
from app.services.detectors.url_detector import UrlDetector
from app.services.engine.signals import DetectionResult, DetectionSignal, SignalSource

# A payment QR whose payee poses as a refund / prize / helpdesk is the classic
# "scan to receive money" scam: paying never brings money in.
_BAIT_PAYEE = (
    "refund", "cashback", "cash back", "reward", "prize", "lottery", "winner",
    "lucky", "gift", "bonus", "claim", "kyc", "helpdesk", "help desk",
    "customer care", "customer support", "support desk", "reversal",
)
# A real VPA is name@handle, and PSP handles are single alphanumeric words
# (oksbi, ybl, paytm…), never a domain like "ybl.example".
_VALID_VPA = re.compile(r"^[a-z0-9.\-_]{2,256}@[a-z][a-z0-9]{1,63}$", re.I)

_url_detector = UrlDetector()
_message_detector = MessageDetector()


def classify(payload: str) -> str:
    p = payload.strip()
    low = p.lower()
    if low.startswith("upi://"):
        return "upi"
    if low.startswith(("http://", "https://")) or low.startswith("www."):
        return "url"
    if low.startswith("tel:"):
        return "phone"
    if low.startswith("wifi:"):
        return "wifi"
    if "://" in low:
        return "deeplink"
    return "text"


class QrDetector(Detector):
    scan_type = ScanType.QR.value

    def analyze(self, payload: str) -> DetectionResult:
        kind = classify(payload)
        signals: list[DetectionSignal] = []
        indicators: list[tuple[str, str]] = []

        signals.append(DetectionSignal(
            source=SignalSource.CONTENT, indicator="qr_kind", weight=0,
            summary=f"QR code decoded as: {kind}.", confidence=0.5,
            detail={"kind": kind, "payload_preview": payload[:120]},
        ))

        if kind == "url":
            sub = _url_detector.analyze(payload)
            signals.extend(sub.signals)
            indicators.extend(sub.indicators)
        elif kind == "upi":
            q = parse_qs(urlparse(payload).query)
            pa = (q.get("pa") or [""])[0]
            pn = (q.get("pn") or [""])[0]
            am = (q.get("am") or [""])[0]
            cu = (q.get("cu") or [""])[0]
            # Informational, low weight — a payment request is normal; we advise
            # verification rather than asserting fraud.
            signals.append(DetectionSignal(
                source=SignalSource.CONTENT, indicator="upi_payment_request", weight=6,
                summary="This QR requests a UPI payment. Verify the payee before paying.",
                confidence=0.4, category_hint="UPI_FRAUD",
                detail={"payee_vpa": pa, "payee_name": pn, "amount": am, "currency": cu},
            ))
            if am and am not in ("0", "0.0", ""):
                signals.append(DetectionSignal(
                    source=SignalSource.CONTENT, indicator="upi_prefilled_amount", weight=8,
                    summary=f"The payment amount is pre-filled ({am}). Confirm it is correct.",
                    confidence=0.4, category_hint="UPI_FRAUD",
                ))
            if pa and "@" in pa:
                indicators.append((pa, "upi"))
            if not _VALID_VPA.match(pa):
                signals.append(DetectionSignal(
                    source=SignalSource.RULE, indicator="upi_invalid_vpa", weight=15,
                    summary=(f"The payee UPI ID '{pa}' is not a valid UPI address."
                             if pa else "The QR has no payee UPI ID."),
                    confidence=0.7, category_hint="UPI_FRAUD", detail={"payee_vpa": pa},
                ))
            hay = f"{pa} {pn}".lower()
            bait = sorted({w for w in _BAIT_PAYEE if w in hay})
            if bait:
                signals.append(DetectionSignal(
                    source=SignalSource.RULE, indicator="upi_bait_payee", weight=25,
                    summary="The payee presents itself as a refund, prize or support desk, "
                            "but this QR takes money from you. Genuine refunds and prizes "
                            "never need you to scan or pay.",
                    confidence=0.75, category_hint="UPI_FRAUD", detail={"matched": bait},
                ))
                if am and am not in ("0", "0.0"):
                    signals.append(DetectionSignal(
                        source=SignalSource.RULE, indicator="upi_bait_with_amount", weight=15,
                        summary=f"A fixed amount ({am}) is demanded by a 'refund/prize' payee "
                                "— a reverse-payment scam pattern.",
                        confidence=0.75, category_hint="UPI_FRAUD",
                    ))
        elif kind in ("text", "deeplink"):
            sub = _message_detector.analyze(payload)
            signals.extend(sub.signals)
            indicators.extend(sub.indicators)

        return DetectionResult(signals=signals, indicators=indicators, normalized_input=payload[:2000])
