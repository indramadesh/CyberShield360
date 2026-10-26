"""Source adapters: bytes from a registry source → list[ParsedItem].

Supported formats: rss (RSS 2.0 / RDF), atom, cisa_kev (JSON), certin_home and
csk_alerts (HTML pages whose layout was inspected by hand). XML is parsed only
after rejecting DTD/entity declarations (no XXE / entity-expansion).
Adapters never fetch; they only parse.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

from app.content.normalize import clean_text, parse_date, safe_url


class ParseError(Exception):
    pass


@dataclass
class ParsedItem:
    title: str
    url: str
    external_id: str
    summary: str = ""
    published: dt.datetime | None = None
    updated: dt.datetime | None = None
    categories: list[str] = field(default_factory=list)
    kind: str | None = None  # overrides the source's default kind
    severity: str | None = None  # only when the SOURCE states one
    tags: list[str] = field(default_factory=list)


def _xml_root(body: bytes) -> ET.Element:
    head = body[:4096].lower()
    if b"<!doctype" in head or b"<!entity" in body[:65536].lower():
        raise ParseError("XML with a DTD/entity declaration was rejected.")
    try:
        return ET.fromstring(body)
    except ET.ParseError as exc:
        raise ParseError(f"Malformed XML: {exc}") from exc


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _child(el: ET.Element, *names: str) -> ET.Element | None:
    for c in el:
        if _local(c.tag) in names:
            return c
    return None


def _text(el: ET.Element, *names: str) -> str:
    c = _child(el, *names)
    return (c.text or "").strip() if c is not None and c.text else ""


def parse_feed(body: bytes, base_url: str = "") -> list[ParsedItem]:
    """RSS 2.0, RSS 1.0 (RDF) or Atom — detected from the document itself."""
    root = _xml_root(body)
    kind = _local(root.tag)
    items: list[ParsedItem] = []
    if kind == "feed":  # Atom
        for e in [c for c in root if _local(c.tag) == "entry"]:
            link = None
            for l in [c for c in e if _local(c.tag) == "link"]:
                if l.get("rel", "alternate") == "alternate" and l.get("href"):
                    link = l.get("href")
                    break
            url = safe_url(link, base_url)
            title = clean_text(_text(e, "title"), 300)
            if not url or not title:
                continue
            cats = [c.get("term", "") for c in e if _local(c.tag) == "category" and c.get("term")]
            items.append(ParsedItem(
                title=title, url=url, external_id=_text(e, "id") or url,
                summary=clean_text(_text(e, "summary") or _text(e, "content")),
                published=parse_date(_text(e, "published") or _text(e, "issued")),
                updated=parse_date(_text(e, "updated")), categories=cats,
            ))
        return items
    if kind not in ("rss", "rdf"):
        raise ParseError(f"Not a feed document (root element <{kind}>).")
    channel = _child(root, "channel")
    entries = root.iter() if kind == "rdf" or channel is None else channel.iter()
    for it in [e for e in entries if _local(e.tag) == "item"]:
        url = safe_url(_text(it, "link") or _text(it, "guid"), base_url)
        title = clean_text(_text(it, "title"), 300)
        if not url or not title:
            continue
        cats = [clean_text(c.text, 60) for c in it if _local(c.tag) in ("category", "subject") and c.text]
        items.append(ParsedItem(
            title=title, url=url, external_id=_text(it, "guid") or url,
            summary=clean_text(_text(it, "description") or _text(it, "encoded")),
            published=parse_date(_text(it, "pubdate") or _text(it, "date")),
            categories=[c for c in cats if c],
        ))
    return items


def parse_cisa_kev(body: bytes, base_url: str = "", max_items: int = 30) -> list[ParsedItem]:
    """CISA KEV catalogue → newest `max_items` entries (by dateAdded)."""
    try:
        data = json.loads(body)
        vulns = data["vulnerabilities"]
    except (ValueError, KeyError, TypeError) as exc:
        raise ParseError(f"Not a KEV catalogue: {exc}") from exc
    vulns = sorted((v for v in vulns if isinstance(v, dict)), key=lambda v: v.get("dateAdded", ""), reverse=True)
    out: list[ParsedItem] = []
    for v in vulns[:max_items]:
        cve = str(v.get("cveID", "")).strip()
        if not re.fullmatch(r"CVE-\d{4}-\d{4,}", cve):
            continue
        name = clean_text(v.get("vulnerabilityName") or f"{v.get('vendorProject', '')} {v.get('product', '')}", 200)
        desc = clean_text(v.get("shortDescription", ""))
        action = clean_text(v.get("requiredAction", ""), 240)
        tags = ["known exploited"]
        if str(v.get("knownRansomwareCampaignUse", "")).lower() == "known":
            tags.append("used in ransomware")
        out.append(ParsedItem(
            title=f"{cve}: {name}", url=f"https://nvd.nist.gov/vuln/detail/{cve}", external_id=cve,
            summary=(desc + (f" Required action: {action}" if action else "")).strip(),
            published=parse_date(v.get("dateAdded")), kind="vulnerability", tags=tags,
            categories=["vulnerability"],
        ))
    return out


_CERTIN_BLOCK = re.compile(
    r"<span class=\"BContent\">\s*<a href='(?P<href>s2cMainServlet\?pageid=(?P<page>PUB[A-Z0-9]+)&(?:VLCODE|CACODE|VACODE)=(?P<code>[A-Z]+-\d{4}-\d+))'>(?P<link>.*?)</a>"
    r"(?P<rest>.*?)(?=<span class=\"BContent\">|</table>)",
    re.S,
)
_CERTIN_DATE = re.compile(r"<span class=\"DateContent\"[^>]*>\s*\(([^)]+)\)")
_CERTIN_DESC = re.compile(r"convertHTMLtoText\('((?:[^'\\]|\\.)*)'\)")
_CERTIN_KIND = {"CIVN": "vulnerability", "CIAD": "advisory", "CICA": "alert", "CIVA": "vulnerability"}
_CERTIN_LABEL = {"CIVN": "Vulnerability Note", "CIAD": "Advisory", "CICA": "Current Activity", "CIVA": "Vulnerability Alert"}


def parse_certin_home(body: bytes, base_url: str = "https://www.cert-in.org.in/") -> list[ParsedItem]:
    """CERT-In home page lists (advisories, vulnerability notes, current activities)."""
    html_text = body.decode("iso-8859-1", errors="replace")
    out: list[ParsedItem] = []
    seen: set[str] = set()
    for m in _CERTIN_BLOCK.finditer(html_text):
        code = m.group("code")
        if code in seen:
            continue
        seen.add(code)
        prefix = code.split("-")[0]
        rest = m.group("rest")
        desc_m = _CERTIN_DESC.search(rest)
        desc = clean_text(desc_m.group(1).replace("\\'", "'") if desc_m else "", 400)
        link_text = clean_text(m.group("link"), 200)
        date_m = _CERTIN_DATE.search(rest)
        # Vulnerability notes / advisories: the link text is the code; the description is the subject.
        if prefix in ("CIVN", "CIAD", "CIVA"):
            title = f"{desc or link_text} ({code})" if desc else f"CERT-In {_CERTIN_LABEL.get(prefix, 'Note')} {code}"
            summary = f"CERT-In {_CERTIN_LABEL.get(prefix, 'note')} {code}."
        else:
            title = link_text
            summary = desc
        url = safe_url(m.group("href"), base_url)
        if not url or not title:
            continue
        out.append(ParsedItem(
            title=title, url=url, external_id=code, summary=summary,
            published=parse_date(date_m.group(1)) if date_m else None,
            kind=_CERTIN_KIND.get(prefix, "advisory"), tags=[code],
        ))
    if not out:
        raise ParseError("No CERT-In entries found — the page layout may have changed.")
    return out


_CSK_ITEM = re.compile(r"<li>\s*<a href=\"(?P<href>alerts/[^\"]+\.html)\">(?P<title>.*?)</a>", re.S | re.I)


def parse_csk_alerts(body: bytes, base_url: str = "https://www.csk.gov.in/") -> list[ParsedItem]:
    """Cyber Swachhta Kendra 'Current Threats' list. The list carries no dates."""
    text = body.decode("utf-8", errors="replace")
    out: list[ParsedItem] = []
    for m in _CSK_ITEM.finditer(text):
        title = clean_text(m.group("title"), 200)
        url = safe_url(m.group("href"), base_url)
        if title and url:
            out.append(ParsedItem(title=title, url=url, external_id=m.group("href"),
                                  summary="", published=None, kind="alert"))
    if not out:
        raise ParseError("No CSK alerts found — the page layout may have changed.")
    return out


ADAPTERS = {
    "rss": parse_feed,
    "atom": parse_feed,
    "cisa_kev": parse_cisa_kev,
    "certin_home": parse_certin_home,
    "csk_alerts": parse_csk_alerts,
}
