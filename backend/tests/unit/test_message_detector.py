from app.services.detectors.message_detector import MessageDetector

det = MessageDetector()


def _inds(r):
    return {s.indicator for s in r.signals}


def test_benign_message_has_no_family_signals():
    r = det.analyze("Hey, are we still on for lunch tomorrow at noon?")
    assert not any(s.indicator.startswith("msg_") for s in r.signals)


def test_phishing_combo_detected():
    r = det.analyze(
        "URGENT: your account is suspended. Verify your OTP immediately at "
        "http://bit.ly/verify-now or it will be blocked."
    )
    inds = _inds(r)
    assert "msg_urgency" in inds
    assert "msg_credential_request" in inds
    assert "urgency_plus_credential" in inds
    assert "contains_link" in inds


def test_pii_is_redacted_in_normalized_input():
    r = det.analyze("Call me on 9876543210 or email scammer@example.com to claim.")
    assert "[REDACTED_PHONE]" in r.normalized_input
    assert "[REDACTED_EMAIL]" in r.normalized_input
    assert "9876543210" not in r.normalized_input
