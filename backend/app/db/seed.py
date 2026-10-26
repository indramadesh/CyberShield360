"""Idempotent seed for threat categories (and dev admin in non-prod)."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import DEFAULT_THREAT_CATEGORIES, Role
from app.db.models.threat import ThreatCategory
from app.db.models.threat_intel import ThreatIntel
from app.db.models.user import User
from app.core.security import hash_password

log = logging.getLogger("cybershield.seed")


def seed_threat_categories(session: Session) -> None:
    existing = {c.code for c in session.query(ThreatCategory).all()}
    for code, label in DEFAULT_THREAT_CATEGORIES:
        if code not in existing:
            session.add(ThreatCategory(code=code, label=label, enabled=True))
    session.commit()


# SYNTHETIC / DEMO indicators for the local store — clearly not real threat data.
_DEMO_INTEL: tuple[tuple[str, str, str, float], ...] = (
    ("account-verify-login.example", "domain", "PHISHING", 0.88),
    ("upi-refund-claim.example", "domain", "UPI_FRAUD", 0.82),
    ("http://parcel-customs-fee.example/pay", "url", "DELIVERY_SCAM", 0.8),
)


def seed_threat_intel(session: Session) -> None:
    existing = {(i.indicator, i.provider) for i in session.query(ThreatIntel).all()}
    for indicator, itype, threat, conf in _DEMO_INTEL:
        if (indicator.lower(), "seed-demo") not in existing:
            session.add(ThreatIntel(
                provider="seed-demo", indicator=indicator.lower(), indicator_type=itype,
                threat_type=threat, confidence=conf, source_url=None,
            ))
    session.commit()


def seed_dev_admin(session: Session) -> None:
    """Create a dev admin ONLY outside production. No hard-coded prod creds."""
    if settings.is_production:
        return
    # Use a real TLD: email-validator rejects special-use domains like `.local`,
    # which would otherwise make this seeded account unable to log in.
    email = "admin@cybershield.dev"
    if session.query(User).filter(User.email == email).first():
        return
    session.add(
        User(
            email=email,
            password_hash=hash_password("ChangeMe!Dev12345"),
            role=Role.ADMIN.value,
            is_verified=True,
        )
    )
    session.commit()
    log.info("Seeded dev admin %s (development only).", email)


_LESSONS = [
    ("phishing-basics", "phishing", "Spotting Phishing",
     "Recognize fake messages that try to steal your login or OTP.",
     "Phishing tricks you into revealing credentials. Check the sender, hover links, "
     "and never enter passwords from a link in a message.",
     [{"question": "A 'bank' SMS asks for your OTP via a link. You should:",
       "options": ["Share the OTP", "Ignore and open the bank app yourself", "Reply STOP"],
       "answer_index": 1, "explanation": "Banks never ask for OTPs; open the official app directly."}]),
    ("upi-safety", "upi", "UPI Safety",
     "Understand why you never share a UPI PIN to RECEIVE money.",
     "A UPI PIN is only needed to SEND money. Anyone asking you to enter it to "
     "'receive' funds is trying to debit your account.",
     [{"question": "To receive money on UPI you must enter your PIN.",
       "options": ["True", "False"], "answer_index": 1,
       "explanation": "You never enter a UPI PIN to receive money."}]),
    ("qr-safety", "qr", "QR Code Safety",
     "Check what a QR code actually does before you act on it.",
     "QR codes can hide links or payment requests. Scanning to 'receive' a payment "
     "is a red flag — that flow is for paying, not receiving.",
     [{"question": "A seller sends a QR to 'send you a refund'. Scanning and approving it:",
       "options": ["Credits you", "Debits you"], "answer_index": 1,
       "explanation": "Approving a collect request debits your account."}]),
    ("passwords-mfa", "passwords", "Passwords & MFA",
     "Use unique passwords and turn on multi-factor authentication.",
     "Reused passwords let one breach unlock many accounts. A password manager plus "
     "MFA dramatically reduces account-takeover risk.", []),
]

_CHALLENGES = [
    ("scam-or-safe-1", "scam_or_safe",
     "'Your electricity will be disconnected tonight. Pay now: http://bit.ly/pay-bill' — scam or safe?",
     ["Scam", "Safe"], 0,
     "Urgency + a shortened link + payment pressure are classic scam markers."),
    ("spot-phish-1", "spot_the_phish",
     "Which sender is most suspicious for a 'bank' email?",
     ["security@yourbank.com", "yourbank.secure-verify@gmail.com", "alerts@yourbank.com"],
     1, "A bank won't use a generic gmail address for official security mail."),
]

_ORGS = [
    ("State Bank of India", ["onlinesbi.sbi", "sbi.co.in"], ["YONO SBI"], ["1800 1234"]),
    ("National Payments Corporation of India", ["npci.org.in"], ["BHIM"], []),
]


def seed_learn_and_content(session: Session) -> None:
    from app.db.models.awareness import AwarenessContent, Challenge
    from app.db.models.content import OfficialOrg

    if not session.query(AwarenessContent).first():
        for slug, cat, title, summary, body, quiz in _LESSONS:
            session.add(AwarenessContent(slug=slug, category=cat, title=title,
                                         summary=summary, body_md=body, quiz_json=quiz,
                                         status="published"))
    if not session.query(Challenge).first():
        for slug, kind, q, opts, ans, expl in _CHALLENGES:
            session.add(Challenge(slug=slug, kind=kind, question=q, options_json=opts,
                                  answer_index=ans, explanation=expl, active=True))
    # News and legal records now come from the content engine (real sources +
    # curated, verified legal records) — no demo items are seeded.
    if not session.query(OfficialOrg).first():
        for name, domains, apps, channels in _ORGS:
            session.add(OfficialOrg(name=name, official_domains=domains,
                                    official_apps=apps, support_channels=channels))
    session.commit()


def run_all(session: Session) -> None:
    from app.content.seed import seed_content_engine

    seed_threat_categories(session)
    seed_threat_intel(session)
    seed_learn_and_content(session)
    seed_content_engine(session)
    seed_dev_admin(session)
