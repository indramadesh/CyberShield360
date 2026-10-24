from app.services.url_normalize import indicator_key, normalize_url


def test_normalize_adds_scheme_lowercases_strips_trailing_slash_and_fragment():
    assert normalize_url("WWW.Example.COM/Path/") == "http://www.example.com/Path"
    assert normalize_url("https://Example.com/#section") == "https://example.com/"
    # Query is preserved (can carry phishing redirects).
    assert "redirect=http://evil" in normalize_url("http://x.example/a?redirect=http://evil")


def test_indicator_key_is_stable_and_type_scoped():
    k1 = indicator_key("http://example.com/", "url")
    k2 = indicator_key("http://example.com", "url")  # normalizes to same
    assert k1 == k2
    # Same string, different type => different key.
    assert indicator_key("example.com", "url") != indicator_key("example.com", "domain")
