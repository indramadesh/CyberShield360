"""Recommendation Engine — maps (category, risk level) to safe, actionable advice.

Advice is generic and defensive. It never tells a user something is "safe"; it
always frames results as an assessment."""
from __future__ import annotations

from app.core.enums import RiskLevel

_DISCLAIMER = "This is an assessment, not a guarantee."

# Category-specific guidance for elevated risk.
_BY_CATEGORY: dict[str, list[str]] = {
    "PHISHING": [
        "Do not enter your password or OTP on this link.",
        "Open the official service manually by typing its address yourself.",
    ],
    "CREDENTIAL_THEFT": [
        "Do not submit any login details.",
        "If you already entered credentials, change that password immediately.",
    ],
    "UPI_FRAUD": [
        "Never approve a UPI request or share your UPI PIN to receive money.",
        "Verify the payee through your bank's official app.",
    ],
    "FAKE_KYC": [
        "Banks do not ask you to complete KYC via links or by sharing OTPs.",
        "Contact your bank using the number on the back of your card.",
    ],
    "INVESTMENT_SCAM": [
        "Be skeptical of guaranteed or unusually high returns.",
        "Verify the entity with the relevant regulator before paying.",
    ],
    "JOB_SCAM": [
        "Legitimate employers do not ask for registration or security fees.",
        "Verify the company through official channels.",
    ],
    "DELIVERY_SCAM": [
        "Track parcels only through the courier's official app or website.",
        "Do not pay 'customs' or 'redelivery' fees via random links.",
    ],
}

_ELEVATED = {RiskLevel.SUSPICIOUS.value, RiskLevel.HIGH.value, RiskLevel.CRITICAL.value}


def recommendations(category: str, risk_level: str) -> list[str]:
    recs: list[str] = []
    if risk_level in _ELEVATED:
        recs.extend(_BY_CATEGORY.get(category, [
            "Treat this content with caution and verify it through official channels.",
        ]))
        recs.append("Do not share OTPs, passwords, PINs, or card details.")
    else:
        recs.append(
            "No strong indicators were found, but stay cautious — absence of "
            "indicators does not guarantee safety."
        )
    recs.append(_DISCLAIMER)
    return recs
