"""The ONE definition of every public source the engine reads.

Each entry was checked by hand on 2026-10-26 (reachable, valid format, dated
items, robots/terms permit automated reads) — see docs/content/CONTENT_SOURCE_REGISTRY.md.
`sync_sources()` upserts these into `content_sources`; runtime health and the
admin's enable/disable choice live in the database and are never overwritten.

To add a source: append an entry with a supported `fmt` (see adapters.ADAPTERS).
To disable one: set `enabled=False` here (new installs) or toggle it in Admin.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models.content_engine import ContentSource

SOURCES: list[dict] = [
    # ---------------- India ----------------
    {
        "key": "certin-home", "name": "CERT-In (Indian Computer Emergency Response Team)",
        "category": "advisory", "fmt": "certin_home", "jurisdiction": "IN", "trust": "official",
        "base_url": "https://www.cert-in.org.in/",
        "feed_url": "https://www.cert-in.org.in/s2cMainServlet?pageid=PUBWEL01",
        "interval_minutes": 120, "max_bytes": 1_500_000, "max_items": 40,
        "license_notes": "Government of India public website. No RSS is offered; the home page lists the latest "
                         "advisories (CIAD), vulnerability notes (CIVN) and current activities (CICA) with dates. "
                         "No robots.txt restrictions. We store titles, dates and links only and link to the original.",
        "attribution": "Source: CERT-In, Government of India",
    },
    {
        "key": "csk-alerts", "name": "Cyber Swachhta Kendra — Current Threats",
        "category": "alert", "fmt": "csk_alerts", "jurisdiction": "IN", "trust": "official",
        "base_url": "https://www.csk.gov.in/", "feed_url": "https://www.csk.gov.in/alerts.html",
        "interval_minutes": 360, "max_bytes": 1_000_000, "max_items": 30,
        "license_notes": "Botnet Cleaning and Malware Analysis Centre (operated by CERT-In). Static HTML list; "
                         "the list carries no dates, so items are stored with an unknown publication date.",
        "attribution": "Source: Cyber Swachhta Kendra, CERT-In",
    },
    # ---------------- International ----------------
    {
        "key": "cisa-advisories", "name": "CISA Cybersecurity Advisories",
        "category": "advisory", "fmt": "rss", "jurisdiction": "US", "trust": "official",
        "base_url": "https://www.cisa.gov/", "feed_url": "https://www.cisa.gov/cybersecurity-advisories/all.xml",
        "interval_minutes": 180, "max_bytes": 9_000_000, "max_items": 40,
        "license_notes": "US Government work. Public RSS feed (large: ~6 MB, so polled every 3 h).",
        "attribution": "Source: CISA (US Cybersecurity and Infrastructure Security Agency)",
    },
    {
        "key": "cisa-news", "name": "CISA News",
        "category": "news", "fmt": "rss", "jurisdiction": "US", "trust": "official",
        "base_url": "https://www.cisa.gov/", "feed_url": "https://www.cisa.gov/news.xml",
        "interval_minutes": 120, "max_bytes": 1_000_000, "max_items": 25,
        "license_notes": "US Government work. Public RSS feed.",
        "attribution": "Source: CISA",
    },
    {
        "key": "cisa-kev", "name": "CISA Known Exploited Vulnerabilities Catalog",
        "category": "vulnerability", "fmt": "cisa_kev", "jurisdiction": "global", "trust": "official",
        "base_url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        "feed_url": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        "interval_minutes": 360, "max_bytes": 6_000_000, "max_items": 30,
        "license_notes": "US Government work. Public JSON catalogue; we keep the 30 most recently added entries.",
        "attribution": "Source: CISA KEV Catalog",
    },
    {
        "key": "ncsc-uk", "name": "UK National Cyber Security Centre",
        "category": "news", "fmt": "rss", "jurisdiction": "UK", "trust": "official",
        "base_url": "https://www.ncsc.gov.uk/", "feed_url": "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml",
        "interval_minutes": 180, "max_bytes": 1_000_000, "max_items": 25,
        "license_notes": "Public RSS feed offered by the NCSC for news, blogs, guidance and reports. "
                         "Content © Crown copyright; we store titles, short summaries and links.",
        "attribution": "Source: NCSC (UK)",
    },
    {
        "key": "sans-isc", "name": "SANS Internet Storm Center",
        "category": "news", "fmt": "rss", "jurisdiction": "global", "trust": "research",
        "base_url": "https://isc.sans.edu/", "feed_url": "https://isc.sans.edu/rssfeed.xml",
        "interval_minutes": 120, "max_bytes": 1_000_000, "max_items": 20,
        "license_notes": "Public RSS feed of ISC handler diaries (research organisation). Titles, summaries, links only.",
        "attribution": "Source: SANS Internet Storm Center",
    },
    # ---------------- Legal document watch (official files) ----------------
    {
        "key": "legal-certin-directions-2022", "name": "CERT-In Directions under section 70B(6), 28 April 2022",
        "category": "legal", "fmt": "doc_watch", "jurisdiction": "IN", "trust": "official",
        "base_url": "https://www.cert-in.org.in/",
        "feed_url": "https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf",
        "interval_minutes": 1440, "max_bytes": 5_000_000, "max_items": 1,
        "license_notes": "Official PDF. Checked daily with conditional requests (ETag/Last-Modified); a change "
                         "creates a new version and a change candidate. The document's meaning is never inferred.",
        "attribution": "Source: CERT-In, Government of India",
        "legal_slug": "certin-directions-2022",
    },
    {
        "key": "legal-certin-directions-faq", "name": "CERT-In FAQs on the Cyber Security Directions (May 2022)",
        "category": "legal", "fmt": "doc_watch", "jurisdiction": "IN", "trust": "official",
        "base_url": "https://www.cert-in.org.in/",
        "feed_url": "https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf",
        "interval_minutes": 1440, "max_bytes": 5_000_000, "max_items": 1,
        "license_notes": "Official PDF, change-watched like the Directions.",
        "attribution": "Source: CERT-In, Government of India",
        "legal_slug": "certin-directions-faq-2022",
    },
]

# Sources evaluated and NOT enabled (kept here so the decision is visible in code).
NOT_ENABLED: list[dict] = [
    {"name": "MeitY", "url": "https://www.meity.gov.in/", "reason": "Returns 403 Access Denied to automated clients (incl. robots.txt)."},
    {"name": "India Code", "url": "https://www.indiacode.nic.in/", "reason": "Returns 403 Access Denied to automated clients."},
    {"name": "PIB press releases RSS", "url": "https://www.pib.gov.in/RssMain.aspx", "reason": "RSS URL returns Access Denied to automated clients."},
    {"name": "Gazette of India", "url": "https://egazette.gov.in/", "reason": "Search is form/session driven; no machine-readable listing."},
    {"name": "PRS Legislative Research", "url": "https://prsindia.org/billtrack", "reason": "No feed; large HTML page — too fragile to parse reliably."},
]

_RUNTIME_FIELDS = {"enabled"}  # admin-controlled once the row exists


def sync_sources(session: Session) -> int:
    """Upsert registry entries. Configuration fields follow the code; the admin's
    enabled flag and all health fields are preserved. Returns rows created."""
    created = 0
    for spec in SOURCES:
        fields = {k: v for k, v in spec.items() if k != "legal_slug"}
        row = session.query(ContentSource).filter_by(key=spec["key"]).first()
        if row is None:
            session.add(ContentSource(**{"enabled": True, **fields}))
            created += 1
        else:
            for k, v in fields.items():
                if k not in _RUNTIME_FIELDS:
                    setattr(row, k, v)
    session.commit()
    return created


def spec_for(key: str) -> dict | None:
    return next((s for s in SOURCES if s["key"] == key), None)
