"""Indian Cyber Law Tracker.

Three inputs, all conservative:
1. Curated records (below) — hand-verified facts only. An effective date is set
   only where it is well established; otherwise it stays NULL.
2. Document watch — official files (registry `doc_watch` sources) are checked
   with conditional GETs. A changed file creates a new version + an open change
   candidate. A file change is NEVER presented as a legal change.
3. Keyword candidates — items from official feeds whose titles name a legal
   instrument. Auto-published only as an "official publication" with status
   "not established", and only when every policy condition holds.
Summaries are informational, not legal advice.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.content.normalize import sha256
from app.db.base import utcnow
from app.db.models.content import CyberLaw
from app.db.models.content_engine import ContentSource, LegalChangeCandidate, LegalDocumentVersion

LEGAL_STATUSES = {
    "draft": "Draft proposal",
    "consultation": "Public consultation",
    "published_notification": "Published notification",
    "enacted": "Enacted legislation",
    "commencement_notification": "Commencement notification",
    "effective": "In force",
    "amendment": "Amendment",
    "repealed": "Repealed",
    "superseded": "Superseded",
    "guidance": "Official guidance (not law)",
    "status_not_established": "Status not established",
}

INDIA_CODE = "https://www.indiacode.nic.in/"

CURATED: list[dict] = [
    {
        "slug": "it-act-2000", "title": "Information Technology Act, 2000",
        "authority": "Parliament of India", "document_type": "act", "legal_status": "effective",
        "document_ref": "Act No. 21 of 2000", "publication_date": dt.date(2000, 6, 9),
        "effective_date": dt.date(2000, 10, 17), "commencement_status": "in_force",
        "official_source": INDIA_CODE, "related_legislation": [],
        "plain_summary": "India's primary law on electronic records, digital signatures and cybercrime. It defines "
                         "offences such as unauthorised access, identity theft and cheating by impersonation using a "
                         "computer resource, and sets up CERT-In under section 70B. Received assent on 9 June 2000 and "
                         "came into force on 17 October 2000. Search “Information Technology Act” on India Code for the "
                         "current consolidated text.",
    },
    {
        "slug": "it-amendment-act-2008", "title": "Information Technology (Amendment) Act, 2008",
        "authority": "Parliament of India", "document_type": "act", "legal_status": "amendment",
        "document_ref": "Act No. 10 of 2009", "publication_date": dt.date(2009, 2, 5),
        "effective_date": dt.date(2009, 10, 27), "commencement_status": "in_force",
        "amends": "Information Technology Act, 2000", "official_source": INDIA_CODE,
        "related_legislation": ["it-act-2000"],
        "plain_summary": "Major amendment to the IT Act, 2000. It added offences including identity theft (section 66C) "
                         "and cheating by personation using a computer resource (section 66D), and strengthened "
                         "CERT-In's role. Brought into force on 27 October 2009.",
    },
    {
        "slug": "it-rules-2021", "title": "Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021",
        "authority": "Ministry of Electronics and Information Technology (MeitY)", "document_type": "rules",
        "legal_status": "published_notification", "publication_date": dt.date(2021, 2, 25), "effective_date": None,
        "commencement_status": "status_not_established", "official_source": "https://www.meity.gov.in/",
        "related_legislation": ["it-act-2000"],
        "plain_summary": "Rules made under the IT Act setting due-diligence and grievance-redressal duties for "
                         "intermediaries such as social media platforms. Notified on 25 February 2021 and amended "
                         "since; check the official consolidated text for the current version. Commencement dates of "
                         "individual provisions are not recorded here.",
    },
    {
        "slug": "dpdp-act-2023", "title": "Digital Personal Data Protection Act, 2023",
        "authority": "Parliament of India", "document_type": "act", "legal_status": "enacted",
        "document_ref": "Act No. 22 of 2023", "publication_date": dt.date(2023, 8, 11), "effective_date": None,
        "commencement_status": "status_not_established", "official_source": INDIA_CODE,
        "related_legislation": [],
        "plain_summary": "India's law on processing digital personal data: consent, notice, rights of the data "
                         "principal (access, correction, erasure, grievance redressal) and duties of data "
                         "fiduciaries, overseen by the Data Protection Board of India. Published on 11 August 2023. "
                         "Its provisions come into force on dates notified by the Government — those dates are not "
                         "recorded here, so check the official Gazette before relying on any provision.",
    },
    {
        "slug": "certin-directions-2022",
        "title": "CERT-In Directions under section 70B(6) of the IT Act, 2000 — information security practices and reporting of cyber incidents",
        "authority": "CERT-In, Ministry of Electronics and Information Technology", "document_type": "directions",
        "legal_status": "published_notification", "publication_date": dt.date(2022, 4, 28), "effective_date": None,
        "commencement_status": "status_not_established",
        "official_source": "https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf",
        "related_legislation": ["it-act-2000"], "source_key": "legal-certin-directions-2022",
        "plain_summary": "Directions requiring service providers, intermediaries, data centres, body corporates and "
                         "government organisations to report specified cyber incidents to CERT-In within 6 hours of "
                         "noticing them, synchronise system clocks, and retain logs for 180 days, among other "
                         "obligations. Issued 28 April 2022. Effective dates and later extensions for some entities "
                         "are set out in CERT-In's notices and FAQs.",
    },
    {
        "slug": "certin-directions-faq-2022", "title": "CERT-In FAQs on the Cyber Security Directions of 28 April 2022",
        "authority": "CERT-In, Ministry of Electronics and Information Technology", "document_type": "guidance",
        "legal_status": "guidance", "publication_date": dt.date(2022, 5, 18), "effective_date": None,
        "commencement_status": None,
        "official_source": "https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf",
        "related_legislation": ["certin-directions-2022"], "source_key": "legal-certin-directions-faq",
        "plain_summary": "CERT-In's official answers to frequently asked questions about the April 2022 Directions — "
                         "explanatory guidance, not law in itself.",
    },
]


def seed_curated(session: Session) -> None:
    """Idempotent upsert of curated legal records (by slug)."""
    for rec in CURATED:
        row = session.scalars(select(CyberLaw).where(CyberLaw.slug == rec["slug"])).first()
        fields = dict(rec, jurisdiction="IN", verification_status="verified", summary_provenance="curated",
                      is_published=True, status=rec["legal_status"])
        if row is None:
            session.add(CyberLaw(**fields))
        else:
            for k, v in fields.items():
                if k not in ("content_hash", "etag", "last_modified", "last_checked_at"):
                    setattr(row, k, v)
    session.commit()


@dataclass
class WatchOutcome:
    status: int
    elapsed_ms: int
    not_modified: bool
    changed: bool


def _snapshot(session: Session, law: CyberLaw, *, etag, last_modified, content_hash, size: int) -> int:
    n = (session.scalar(select(func.max(LegalDocumentVersion.version_no)).where(LegalDocumentVersion.law_id == law.id)) or 0) + 1
    session.add(LegalDocumentVersion(
        law_id=law.id, version_no=n, title=law.title, legal_status=law.legal_status or "status_not_established",
        publication_date=law.publication_date, effective_date=law.effective_date, content_hash=content_hash,
        etag=etag, last_modified=last_modified,
        snapshot={"size_bytes": size, "official_source": law.official_source, "status": law.legal_status},
    ))
    return n


def watch_document(session: Session, src: ContentSource, *, now: dt.datetime, fetcher) -> WatchOutcome:
    """Conditional GET of an official legal file; version + candidate on change.
    (HEAD is not used: some government servers answer HEAD with a generic page.)"""
    from app.content.registry import spec_for

    spec = spec_for(src.key) or {}
    law = session.scalars(select(CyberLaw).where(CyberLaw.slug == spec.get("legal_slug"))).first()
    res = fetcher(src.feed_url, etag=src.etag, last_modified=src.last_modified,
                  timeout=src.timeout_seconds, max_bytes=src.max_bytes)
    if law is not None:
        law.last_checked_at = now
    if res.not_modified:
        return WatchOutcome(304, res.elapsed_ms, True, False)

    digest = hashlib.sha256(res.body).hexdigest() if res.body else None
    changed = False
    if law is not None:
        if law.content_hash is None:  # first observation = baseline, not a change
            _snapshot(session, law, etag=res.etag, last_modified=res.last_modified, content_hash=digest, size=len(res.body))
        elif digest and digest != law.content_hash:
            changed = True
            n = _snapshot(session, law, etag=res.etag, last_modified=res.last_modified, content_hash=digest, size=len(res.body))
            key = sha256(src.key, digest)
            if not session.scalars(select(LegalChangeCandidate).where(LegalChangeCandidate.dedupe_key == key)).first():
                session.add(LegalChangeCandidate(
                    source_key=src.key, url=src.feed_url, title=law.title, change_type="updated",
                    law_id=law.id, dedupe_key=key, status="open",
                    reason="The official file changed. Its legal effect has not been assessed — review before publishing any update.",
                    details={"version": n, "previous_hash": law.content_hash, "new_hash": digest,
                             "etag": res.etag, "last_modified": res.last_modified, "size_bytes": len(res.body)},
                ))
        law.content_hash, law.etag, law.last_modified = digest, res.etag, res.last_modified
    src.etag, src.last_modified = res.etag, res.last_modified
    return WatchOutcome(res.status, res.elapsed_ms, False, changed)


_INSTRUMENT = re.compile(r"\b(act|rules|regulations?|directions?|amendment|notification|ordinance|bill)\b", re.I)
_SUBJECT = re.compile(r"(information technology|it act|data protection|dpdp|cyber ?security|personal data|intermediar)", re.I)
_DRAFT = re.compile(r"\b(draft|consultation|proposed|comments invited)\b", re.I)


def maybe_candidate_from_item(session: Session, src: ContentSource, item, published: dt.datetime | None) -> None:
    """Official feed item that names a legal instrument → candidate (and, if the
    policy allows, a published 'status not established' record)."""
    title = item.title
    if src.jurisdiction != "IN" or not (_INSTRUMENT.search(title) and _SUBJECT.search(title)):
        return
    key = sha256("kw", src.key, item.url)
    if session.scalars(select(LegalChangeCandidate).where(LegalChangeCandidate.dedupe_key == key)).first():
        return
    status = "draft" if _DRAFT.search(title) else "status_not_established"
    policy_ok = bool(published and item.url.startswith("https://") and len(title) >= 12)
    cand = LegalChangeCandidate(
        source_key=src.key, url=item.url, title=title, change_type="keyword_match", dedupe_key=key,
        details={"published": published.isoformat() if published else None, "inferred_status": status},
    )
    if policy_ok:
        slug = f"auto-{key[:16]}"
        law = CyberLaw(
            slug=slug, title=title, authority=src.name, jurisdiction="IN", document_type="official_publication",
            legal_status=status, status=status, publication_date=published.date() if published else None,
            effective_date=None, official_source=item.url, plain_summary=item.summary or "",
            summary_provenance="source", verification_status="unverified", is_published=True,
            source_key=src.key, last_checked_at=utcnow(),
        )
        session.add(law)
        session.flush()
        cand.law_id, cand.status = law.id, "auto_published"
        cand.reason = ("Published as an official publication with status not established: official source, "
                       "valid link, title and date extracted. Its legal effect is not stated.")
    else:
        cand.reason = "Held for review: missing a reliable date or a valid official link."
    session.add(cand)
