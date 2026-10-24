"""The SSRF gate is mandatory before any fetch and on every redirect (spec §46)."""
import pytest

from app.services.ssrf import SSRFError, assert_url_allowed

BLOCKED = [
    "ftp://example.com/",                 # non-http scheme
    "file:///etc/passwd",                 # non-http scheme
    "http://127.0.0.1/",                  # loopback
    "http://localhost/",                  # resolves to loopback
    "http://169.254.169.254/latest/meta-data/",  # cloud metadata (link-local)
    "http://10.0.0.5/",                   # private
    "http://192.168.1.1/",                # private
    "http://172.16.0.1/",                 # private
    "http://[::1]/",                      # IPv6 loopback
    "http://100.64.0.1/",                 # CGNAT
    "http://0.0.0.0/",                    # unspecified
    "http://[::ffff:127.0.0.1]/",         # IPv4-mapped loopback
]


@pytest.mark.parametrize("url", BLOCKED)
def test_blocked_targets_raise(url):
    with pytest.raises(SSRFError):
        assert_url_allowed(url)


def test_public_ip_is_allowed():
    # A globally-routable literal IP passes the gate (no network call made).
    assert assert_url_allowed("http://93.184.216.34/") == "http://93.184.216.34/"


def test_unresolvable_host_is_blocked():
    with pytest.raises(SSRFError):
        assert_url_allowed("http://this-domain-should-not-resolve.invalid/")
