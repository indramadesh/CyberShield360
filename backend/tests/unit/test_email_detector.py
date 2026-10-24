from app.services.detectors.email_detector import EmailDetector

det = EmailDetector()

_PHISH_EMAIL = (
    "From: Support <support@yourbank.com>\n"
    "Reply-To: recover@totally-different.example\n"
    "Subject: Urgent: verify your account\n"
    "\n"
    "Your account is suspended. Verify your OTP immediately at "
    "http://secure-login-verify.example/login or it will be blocked.\n"
)


def _inds(r):
    return {s.indicator for s in r.signals}


def test_replyto_mismatch_detected():
    r = det.analyze(_PHISH_EMAIL)
    assert "replyto_mismatch" in _inds(r)


def test_email_body_content_and_links_analyzed():
    r = det.analyze(_PHISH_EMAIL)
    inds = _inds(r)
    assert "msg_urgency" in inds            # content signal from message detector
    assert "no_https" in inds                # URL heuristic on the embedded link
    assert ("secure-login-verify.example", "domain") in r.indicators


def test_plain_body_without_headers_is_handled():
    r = det.analyze("Congratulations! You won a prize, share your UPI PIN to claim.")
    assert any(s.indicator.startswith("msg_") for s in r.signals)
