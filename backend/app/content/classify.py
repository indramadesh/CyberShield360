"""Rule-based classification (deterministic, no AI).

Category: from keywords in the title/summary/source categories, marked
`category_origin="system"`. Severity: taken ONLY from the source. The single
system rule is documented: a CISA KEV entry is, by the catalogue's definition,
known to be exploited in the wild → "high", marked `severity_origin="system"`.
Alarming words in a headline never raise severity.
"""
from __future__ import annotations

import re

CATEGORIES: list[tuple[str, tuple[str, ...]]] = [
    ("ransomware", ("ransomware", "extortion", "lockbit", "encrypts files")),
    ("phishing", ("phishing", "smishing", "vishing", "spear-phishing", "credential harvest", "fake login")),
    ("data-breach", ("data breach", "breach", "leaked", "exposed records", "data leak")),
    ("scams", ("scam", "fraud", "upi", "kyc", "fake job", "investment scheme", "impersonat")),
    ("malware", ("malware", "trojan", "botnet", "rat ", "infostealer", "info-stealer", "stealer", "loader", "worm", "spyware", "backdoor", "dropper")),
    ("vulnerability", ("vulnerab", "cve-", "remote code execution", "rce", "privilege escalation", "patch", "zero-day", "0-day", "exploit")),
    ("privacy", ("privacy", "personal data", "data protection", "gdpr", "dpdp")),
    ("cloud", ("cloud", "aws", "azure", "kubernetes", "saas")),
    ("network", ("router", "vpn", "firewall", "network", "dns", "ddos")),
    ("application", ("web application", "browser", "plugin", "wordpress", "php", "java", "library")),
    ("cyber-law", ("act,", "rules,", "directions", "regulation", "legislation", "law", "notification")),
]

CATEGORY_LABELS = {
    "ransomware": "Ransomware", "phishing": "Phishing", "data-breach": "Data breaches", "scams": "Online scams",
    "malware": "Malware", "vulnerability": "Vulnerabilities", "privacy": "Privacy", "cloud": "Cloud security",
    "network": "Network security", "application": "Application security", "cyber-law": "Cyber law",
    "advisory": "Security advisories", "awareness": "General awareness",
}

_SEVERITY_WORDS = {"critical": "critical", "high": "high", "medium": "warning", "moderate": "warning", "low": "info"}


def classify(title: str, summary: str, source_categories: list[str], default_kind: str) -> str:
    hay = f" {title} {summary} {' '.join(source_categories)} ".lower()
    for cat, words in CATEGORIES:
        if any(w in hay for w in words):
            return cat
    return "advisory" if default_kind == "advisory" else "awareness"


def source_severity(source_categories: list[str]) -> str | None:
    """A severity the source itself states in its categories (e.g. 'Severity: High')."""
    for c in source_categories:
        m = re.search(r"severity[:\s-]*(critical|high|medium|moderate|low)", c.lower())
        if m:
            return _SEVERITY_WORDS[m.group(1)]
    return None
