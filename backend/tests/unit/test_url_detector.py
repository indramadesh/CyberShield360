from app.services.detectors.url_detector import UrlDetector

det = UrlDetector()


def _indicators(result):
    return {s.indicator for s in result.signals}


def test_benign_url_has_few_signals():
    r = det.analyze("https://www.google.com")
    # No high-weight phishing indicators on a plain HTTPS root domain.
    assert "ip_based_url" not in _indicators(r)
    assert "userinfo_in_url" not in _indicators(r)


def test_ip_based_url_flagged():
    r = det.analyze("http://192.168.0.10/login")
    assert "ip_based_url" in _indicators(r)
    assert "no_https" in _indicators(r)


def test_userinfo_trick_flagged():
    r = det.analyze("http://support@evil.example/account")
    assert "userinfo_in_url" in _indicators(r)


def test_redirect_and_tokens_flagged():
    r = det.analyze("http://foo.example/login?redirect=http://evil.example")
    inds = _indicators(r)
    assert "suspicious_redirect" in inds
    assert "suspicious_tokens" in inds


def test_brand_impersonation_flagged():
    r = det.analyze("http://paypal.account-verify.example/login")
    assert "brand_impersonation" in _indicators(r)


def test_extracts_domain_indicator_for_intel():
    r = det.analyze("http://secure-login-verify.example/login")
    assert ("secure-login-verify.example", "domain") in r.indicators
