"""Message-intelligence analysis: classification, email signals, secret stripping."""
import pytest

from app.messaging import analysis, email_signals
from app.messaging.gateway import strip_secrets
from app.messaging.schema import NormalizedMessage, Sender

GOOGLE_PASS = {"authentication-results": ["mx.google.com; spf=pass smtp.mailfrom=x; dkim=pass; dmarc=pass"]}


@pytest.fixture
def s(session):
    return session


def _email(**kw):
    defaults = dict(source_type="email", source_provider="gmail", headers=dict(GOOGLE_PASS))
    defaults.update(kw)
    return NormalizedMessage(**defaults)


def test_phishing_email_is_classified_and_explained(s):
    a = analysis.analyze(s, _email(
        sender=Sender("SBI Security", "sbi.alerts@gmail.com", "gmail.com", '"SBI Security" <sbi.alerts@gmail.com>'),
        subject="URGENT: account suspended",
        text="Your account is suspended. Verify your account immediately at http://sbi-verify-login.example/login"))
    assert a.classification == "PHISHING"
    assert a.risk_level in {"HIGH", "CRITICAL"}
    inds = {e["indicator"] for e in a.evidence}
    assert "display_name_impersonation" in inds
    assert a.engine_version == analysis.ENGINE_VERSION


def test_upi_scam_notification_gets_scam_and_multiple_categories(s):
    a = analysis.analyze(s, NormalizedMessage(
        "notification", "android", "com.whatsapp", text="You won a prize! Share your UPI PIN to claim reward now",
        completeness="partial"))
    assert a.classification == "SCAM"
    assert {"SCAM", "PHISHING"} <= set(a.categories)
    assert any("notification text" in lim for lim in a.limitations)


def test_no_signals_is_unknown_not_safe(s):
    a = analysis.analyze(s, NormalizedMessage("notification", "android", "com.whatsapp", text="See you at 6",
                                              completeness="partial"))
    assert a.classification == "UNKNOWN"
    assert a.risk_level == "LOW"


def test_empty_content_is_unknown_risk(s):
    a = analysis.analyze(s, NormalizedMessage("notification", "android", "x", text="", completeness="metadata"))
    assert (a.classification, a.risk_level) == ("UNKNOWN", "UNKNOWN")


def test_likely_legitimate_needs_provider_authentication(s):
    msg = dict(sender=Sender("Ravi", "ravi@company.com", "company.com"), subject="Notes",
               text="Hi, attaching notes from the meeting.")
    assert analysis.analyze(s, _email(**msg)).classification == "LIKELY_LEGITIMATE"
    # Same message, no trusted authentication results -> not called legitimate.
    assert analysis.analyze(s, _email(headers={}, **msg)).classification == "UNKNOWN"
    # Pasted ("manual") headers are never trusted, even if they claim a pass.
    assert analysis.analyze(s, _email(source_provider="manual", **msg)).classification == "UNKNOWN"


def test_promotional_vs_spam(s):
    base = dict(sender=Sender("Amazon", "store-news@amazon.in", "amazon.in", "Amazon <store-news@amazon.in>"),
                subject="Deals for you", text="Great deals this week. Shop now. Unsubscribe here.",
                urls=["https://www.amazon.in/deals"])
    promo = analysis.analyze(s, _email(headers={**GOOGLE_PASS, "list-unsubscribe": ["<mailto:x@amazon.in>"]}, **base))
    assert promo.classification == "PROMOTIONAL"
    spam = analysis.analyze(s, _email(**base))  # bulk-looking mail without List-Unsubscribe
    assert spam.classification == "SPAM"


def test_only_topmost_trusted_auth_header_counts():
    forged_below = {"authentication-results": ["mx.google.com; spf=fail; dmarc=fail",
                                               "evil.example; spf=pass; dmarc=pass"]}
    assert email_signals.parse_auth_results(forged_below, "gmail")["dmarc"] == "fail"
    not_google = {"authentication-results": ["evil.example; dmarc=pass"]}
    assert email_signals.parse_auth_results(not_google, "gmail") == {}
    assert email_signals.parse_auth_results(GOOGLE_PASS, "manual") == {}


def test_display_name_signals():
    inds = lambda f: {x.indicator for x in email_signals.sender_signals(f)}  # noqa: E731
    assert "display_name_impersonation" in inds('"HDFC Bank" <alerts@hdfc-secure.example>')
    assert not inds('"HDFC Bank" <alerts@hdfcbank.com>')
    assert not inds('"HDFC Bank" <alerts@mail.hdfcbank.com>')
    assert "display_name_impersonation" in inds('"SBI" <x@evilsbi.com>')  # suffix trick is not official
    assert "display_name_address_mismatch" in inds('"support@paypal.com" <x@paypa1.example>')
    assert "freemail_role_sender" in inds('"Customer Care" <helpline.desk@gmail.com>')


def test_attachment_metadata_signals():
    sig = lambda n: {x.indicator for x in email_signals.attachment_signals([{"filename": n}])}  # noqa: E731
    assert sig("Invoice.pdf.exe") == {"attachment_double_extension"}
    assert sig("setup.msi") == {"attachment_executable"}
    assert sig("report.xlsm") == {"attachment_macro"}
    assert sig("photos.zip") == {"attachment_archive"}
    assert sig("notes.pdf") == set()


def test_secret_values_are_stripped_but_words_kept():
    out = strip_secrets("Your OTP is 482913. Password: hunter2. 1234 is your verification code")
    assert "482913" not in out and "hunter2" not in out and "1234" not in out
    assert "OTP" in out and "verification code" in out


def test_correlated_link_signals_count_once(s):
    one = analysis.analyze(s, NormalizedMessage("shared_text", "manual", text="see http://a.example/x"))
    two = analysis.analyze(s, NormalizedMessage("shared_text", "manual",
                                                text="see http://a.example/x and http://b.example/y"))
    assert one.risk_score == two.risk_score
