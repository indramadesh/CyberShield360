from app.services.detectors.qr_detector import QrDetector, classify

det = QrDetector()


def _inds(r):
    return {s.indicator for s in r.signals}


def test_classify():
    assert classify("upi://pay?pa=x@oksbi") == "upi"
    assert classify("https://example.com") == "url"
    assert classify("tel:+911234567890") == "phone"
    assert classify("WIFI:S:net;T:WPA;P:pw;;") == "wifi"
    assert classify("just some text") == "text"


def test_unknown_upi_is_not_high_risk():
    # An unknown payee alone must NOT be flagged malicious (spec §21).
    r = det.analyze("upi://pay?pa=stranger@oksbi&pn=Someone&am=100&cu=INR")
    assert "upi_payment_request" in _inds(r)
    total = sum(s.weight for s in r.signals)
    assert total < 25  # stays LOW/low-SUSPICIOUS, never auto-critical


def test_qr_with_phishing_url_inherits_url_signals():
    r = det.analyze("http://secure-login-verify.example/login")
    assert ("secure-login-verify.example", "domain") in r.indicators
    assert "no_https" in _inds(r)
