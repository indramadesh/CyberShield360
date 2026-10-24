from app.services.engine import risk_engine
from app.services.engine.signals import DetectionSignal, SignalSource


def _sig(weight, conf=0.6, cat=None, ind="x"):
    return DetectionSignal(source=SignalSource.RULE, indicator=ind, weight=weight,
                           summary="s", confidence=conf, category_hint=cat)


def test_no_signals_is_low_with_humble_confidence():
    a = risk_engine.score([])
    assert a.risk_level == "LOW"
    assert a.risk_score == 0
    assert a.confidence <= 0.4  # never confidently "safe"
    assert any("does not guarantee" in n for n in a.notes)


def test_strong_signals_are_high_or_critical():
    a = risk_engine.score([
        _sig(45, conf=0.9, cat="PHISHING", ind="intel_match"),
        _sig(25, conf=0.7, cat="CREDENTIAL_THEFT", ind="credential_request"),
    ])
    assert a.risk_level in {"HIGH", "CRITICAL"}
    assert a.category == "PHISHING"  # highest-weight hint wins


def test_confidence_never_reaches_one():
    many = [_sig(50, conf=0.99) for _ in range(5)]
    a = risk_engine.score(many)
    assert a.confidence < 1.0
    assert a.risk_score <= 100  # normalized, never unbounded


def test_degraded_coverage_lowers_confidence_and_notes_it():
    sigs = [_sig(45, conf=0.9, cat="PHISHING", ind="intel_match")]
    full = risk_engine.score(sigs, coverage_degraded=False)
    degraded = risk_engine.score(sigs, coverage_degraded=True)
    assert degraded.confidence < full.confidence
    assert any("limited threat-intelligence" in n for n in degraded.notes)
