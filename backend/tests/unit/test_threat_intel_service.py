from app.providers.threatintel.base import IntelLookup, IntelMatch, ThreatIntelProvider
from app.services import threat_intel
from app.services.threat_intel import ThreatIntelService


class _FailingProvider(ThreatIntelProvider):
    name = "flaky"

    def lookup(self, indicator, indicator_type):
        raise RuntimeError("provider down")


class _UnavailableProvider(ThreatIntelProvider):
    name = "offline"

    def lookup(self, indicator, indicator_type):
        return IntelLookup(matches=[], provider=self.name, available=False)


def test_db_provider_match_found(session):
    svc = ThreatIntelService(session)
    svc.repo.upsert(provider="unit", indicator="evil-unit.example", indicator_type="domain",
                    threat_type="PHISHING", confidence=0.9)
    session.commit()
    matches, degraded = svc.lookup("evil-unit.example", "domain")
    assert any(m.threat_type == "PHISHING" for m in matches)
    assert degraded is False


def test_cache_returns_prior_result_until_cleared(session):
    svc = ThreatIntelService(session)
    first, _ = svc.lookup("nothing-here.example", "domain")
    assert first == []
    # Insert a matching row AFTER the first (cached) lookup.
    svc.repo.upsert(provider="unit", indicator="nothing-here.example", indicator_type="domain",
                    threat_type="PHISHING", confidence=0.9)
    session.commit()
    cached, _ = svc.lookup("nothing-here.example", "domain")
    assert cached == []  # served from cache
    threat_intel.clear_cache()
    fresh, _ = svc.lookup("nothing-here.example", "domain")
    assert any(m.threat_type == "PHISHING" for m in fresh)


def test_failing_or_unavailable_provider_degrades_coverage(session):
    svc = ThreatIntelService(session)
    svc._external = [_FailingProvider(), _UnavailableProvider()]  # noqa: SLF001
    _, degraded = svc.lookup("account-verify-login.example", "domain")
    assert degraded is True
