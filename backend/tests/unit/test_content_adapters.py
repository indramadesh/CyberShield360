"""Source adapters + normalisation, against local fixtures (no network)."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from app.content.adapters import (
    ParseError, parse_certin_home, parse_cisa_kev, parse_csk_alerts, parse_feed,
)
from app.content.classify import classify, source_severity
from app.content.normalize import canonical_url, clean_text, parse_date, safe_url

FX = Path(__file__).resolve().parents[1] / "fixtures" / "feeds"


def _b(name: str) -> bytes:
    return (FX / name).read_bytes()


def test_rss_items_dates_and_sanitisation():
    items = parse_feed(_b("rss.xml"))
    titles = [i.title for i in items]
    assert "Bad link item" not in titles  # javascript: link rejected
    first = items[0]
    assert first.published == dt.datetime(2026, 10, 26, 6, 30, tzinfo=dt.timezone.utc)
    assert "<" not in first.summary and "alert(1)" not in first.summary  # HTML/script stripped
    assert first.summary.startswith("A remote code execution vulnerability")
    # Timezone offsets are converted to UTC.
    assert items[1].published == dt.datetime(2026, 10, 25, 4, 30, tzinfo=dt.timezone.utc)


def test_rss_missing_date_is_none_not_now():
    item = next(i for i in parse_feed(_b("rss.xml")) if i.title.startswith("Item without a date"))
    assert item.published is None


def test_atom_and_relative_links():
    items = parse_feed(_b("atom.xml"), base_url="https://atom.example.org/")
    assert items[0].published == dt.datetime(2026, 10, 24, 8, 0, tzinfo=dt.timezone.utc)
    assert items[0].updated == dt.datetime(2026, 10, 25, 9, 0, tzinfo=dt.timezone.utc)
    assert items[0].categories == ["ransomware"]
    assert items[1].url == "https://atom.example.org/posts/2"
    assert items[1].published is None  # only <updated> — not treated as the publication date


def test_rdf_feed():
    items = parse_feed(_b("rdf.xml"))
    assert len(items) == 1 and items[0].published.date() == dt.date(2026, 10, 22)


def test_malformed_and_entity_xml_rejected():
    with pytest.raises(ParseError):
        parse_feed(_b("malformed.xml"))
    with pytest.raises(ParseError):
        parse_feed(_b("xxe.xml"))  # DTD/entity declarations are refused outright
    with pytest.raises(ParseError):
        parse_feed(b"<html><body>not a feed</body></html>")


def test_cisa_kev_newest_first_and_valid_ids():
    items = parse_cisa_kev(_b("kev.json"), max_items=5)
    assert [i.external_id for i in items] == ["CVE-2026-0002", "CVE-2026-0001"]  # newest first, junk dropped
    assert items[1].tags == ["known exploited", "used in ransomware"]
    assert items[0].url == "https://nvd.nist.gov/vuln/detail/CVE-2026-0002"
    with pytest.raises(ParseError):
        parse_cisa_kev(b'{"nope": 1}')


def test_certin_home_parser():
    items = parse_certin_home(_b("certin.html"))
    by_code = {i.external_id: i for i in items}
    note = by_code["CIVN-2026-0527"]
    assert note.title == "DLL Sideloading Vulnerability in Siemens Software Center (CIVN-2026-0527)"
    assert note.kind == "vulnerability" and note.published.date() == dt.date(2026, 10, 26)
    assert by_code["CIAD-2026-0054"].kind == "advisory"
    cica = by_code["CICA-2026-3650"]
    assert cica.kind == "alert" and cica.title.startswith("Critical remote code execution")
    assert cica.url.startswith("https://www.cert-in.org.in/s2cMainServlet?pageid=PUBADV01")
    with pytest.raises(ParseError):
        parse_certin_home(b"<html>layout changed</html>")


def test_csk_alerts_have_no_invented_dates():
    items = parse_csk_alerts(_b("csk.html"))
    assert len(items) == 2
    assert all(i.published is None for i in items)
    assert items[0].url == "https://www.csk.gov.in/alerts/php2shell-rce-vuln.html"


def test_normalisation_helpers():
    assert canonical_url("HTTPS://Example.ORG/a/1/?utm_source=x&b=2&a=1#frag") == "https://example.org/a/1?a=1&b=2"
    assert safe_url("javascript:alert(1)") is None
    assert safe_url("data:text/html,hi") is None
    assert safe_url("/x", "https://a.example/") == "https://a.example/x"
    assert clean_text("&lt;img src=x onerror=alert(1)&gt;Hi &amp; bye") == "Hi & bye"
    assert clean_text("YARA-X&amp;#x26;#39;s release") == "YARA-X's release"  # multiply-encoded entities
    assert parse_date("not a date") is None
    assert parse_date("(October   26, 2026)".strip("()")) is not None


def test_classification_is_rule_based_and_severity_comes_from_source():
    assert classify("New ransomware strain", "", [], "news") == "ransomware"
    assert classify("Quarterly report", "", [], "advisory") == "advisory"
    assert source_severity(["Severity: High"]) == "high"
    # Alarming words in a headline do NOT produce a severity.
    assert source_severity(["URGENT!!! CRITICAL DANGER"]) is None
