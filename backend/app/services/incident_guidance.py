"""Incident-response guidance engine (spec §33).

Deterministic, situation-specific advice from the user's answers. We never
auto-file a report — we only tell the user how to do so themselves."""
from __future__ import annotations

from app.core.enums import RiskLevel

# India-specific official reporting channels (configurable via official_orgs later).
REPORTING_INFO = {
    "country": "IN",
    "channels": [
        {"name": "National Cyber Crime Reporting Portal", "url": "https://cybercrime.gov.in"},
        {"name": "Cyber Crime Helpline", "phone": "1930"},
    ],
    "note": "Reporting is an action you take yourself. CyberShield never files a "
            "report on your behalf.",
}

# answer_key -> (severity_weight, guidance lines)
_RULES: dict[str, tuple[int, list[str]]] = {
    "transferred_money": (4, [
        "Call 1930 immediately and report the transaction — fast action can help freeze funds.",
        "Contact your bank's official helpline to flag the transaction and account.",
    ]),
    "shared_upi_pin": (4, [
        "Open your UPI app and block/disable UPI; contact your bank to secure the account.",
        "Change your UPI PIN after securing the account.",
    ]),
    "shared_otp": (3, [
        "Assume the account tied to that OTP may be compromised; secure it now.",
        "Contact the service's official support to review recent activity.",
    ]),
    "entered_password": (3, [
        "Change that password immediately, and anywhere you reused it.",
        "Enable multi-factor authentication where available.",
    ]),
    "installed_app": (3, [
        "Uninstall the app and any 'remote access' tools (AnyDesk/TeamViewer/etc.).",
        "Run a reputable mobile security scan and review app permissions.",
    ]),
    "shared_personal_info": (2, [
        "Watch for follow-up scams that use your details; be skeptical of new contacts.",
        "Consider alerting the impersonated organization through official channels.",
    ]),
    "account_compromised": (3, [
        "From a device you trust, change the account's password and sign out of all other sessions.",
        "Check the account's recovery email, phone number, forwarding rules and connected apps for changes you didn't make.",
        "Turn on two-step verification. If you can't get in, use the provider's official account-recovery page.",
    ]),
    "opened_attachment": (2, [
        "Disconnect the device from the internet if it's behaving strangely, and don't open the file again.",
        "Run a full scan with your device's built-in security (e.g. Microsoft Defender or Google Play Protect).",
        "If you entered any passwords after opening it, change them from a different, trusted device.",
    ]),
    "clicked_link": (1, [
        "Do not enter any details on that page; close it.",
        "Scan the link with CyberShield if you haven't already.",
    ]),
}

_SEVERITY_BANDS = [
    (7, RiskLevel.CRITICAL.value),
    (4, RiskLevel.HIGH.value),
    (1, RiskLevel.SUSPICIOUS.value),
]


def build_guidance(answers: dict[str, bool]) -> dict:
    steps: list[str] = []
    weight = 0
    for key, (w, lines) in _RULES.items():
        if answers.get(key):
            weight += w
            steps.extend(lines)

    severity = RiskLevel.LOW.value
    for threshold, band in _SEVERITY_BANDS:
        if weight >= threshold:
            severity = band
            break

    if not steps:
        steps.append("No high-risk actions were reported. Stay alert and verify any "
                     "unexpected requests through official channels.")
    steps.append("Preserve evidence: screenshots, messages, numbers, and transaction IDs.")

    return {
        "severity": severity,
        "steps": steps,
        "reporting": REPORTING_INFO,
        "disclaimer": "This is general guidance, not legal advice.",
    }
