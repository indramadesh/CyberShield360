"""Website content analyzer. Operates on already-fetched HTML (fetching is done
by the SSRF-guarded sandbox fetcher). Uses the stdlib HTML parser — no network,
no heavy dependency."""
from __future__ import annotations

from html.parser import HTMLParser
from urllib.parse import urlparse

from app.services.detectors.url_detector import UrlDetector
from app.services.engine.signals import DetectionResult, DetectionSignal, SignalSource

_url_detector = UrlDetector()
_PAYMENT_HINTS = ("card", "cardnumber", "cc-number", "cvv", "cvc", "creditcard")
_OTP_HINTS = ("otp", "one-time", "onetime", "mfa", "2fa", "verification code")


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self.has_password = False
        self.has_payment = False
        self.has_otp = False
        self.form_actions: list[str] = []
        self.iframes = 0
        self.external_scripts: list[str] = []
        self.meta_refresh = False
        self.password_count = 0

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self._in_title = True
        elif tag == "input":
            itype = a.get("type", "text").lower()
            name = f"{a.get('name','')} {a.get('id','')} {a.get('autocomplete','')}".lower()
            if itype == "password":
                self.has_password = True
                self.password_count += 1
            if itype == "tel" or any(h in name for h in _OTP_HINTS):
                self.has_otp = True
            if any(h in name for h in _PAYMENT_HINTS):
                self.has_payment = True
        elif tag == "form":
            self.form_actions.append(a.get("action", ""))
        elif tag == "iframe":
            self.iframes += 1
        elif tag == "script" and a.get("src"):
            self.external_scripts.append(a["src"])
        elif tag == "meta":
            if a.get("http-equiv", "").lower() == "refresh" and "url=" in a.get("content", "").lower():
                self.meta_refresh = True

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data.strip()


def analyze(html: str, final_url: str, redirect_chain: list[str] | None = None) -> DetectionResult:
    redirect_chain = redirect_chain or []
    parser = _Parser()
    try:
        parser.feed(html)
    except Exception:
        pass  # malformed HTML is expected from hostile pages

    page_host = (urlparse(final_url).hostname or "").lower()
    signals: list[DetectionSignal] = []

    def sig(ind, weight, summary, *, conf=0.6, cat=None, **detail):
        signals.append(DetectionSignal(source=SignalSource.VISUAL, indicator=ind,
                                       weight=weight, summary=summary, confidence=conf,
                                       category_hint=cat, detail=detail or {}))

    if parser.has_password:
        sig("password_field", 22, "The page contains a password field.",
            conf=0.7, cat="CREDENTIAL_THEFT")
    if parser.has_otp:
        sig("otp_field", 18, "The page asks for an OTP / verification code.",
            conf=0.65, cat="CREDENTIAL_THEFT")
    if parser.has_payment:
        sig("payment_field", 18, "The page contains card/payment fields.",
            conf=0.6, cat="FAKE_SHOPPING")

    # Forms posting to a different domain than the page.
    for action in parser.form_actions:
        if action.startswith(("http://", "https://")):
            action_host = (urlparse(action).hostname or "").lower()
            if action_host and page_host and action_host != page_host:
                sig("form_posts_external", 16,
                    f"A form submits to a different domain ({action_host}).",
                    conf=0.65, cat="PHISHING", action_host=action_host)
                break

    if parser.meta_refresh:
        sig("meta_refresh", 10, "The page auto-redirects via a meta refresh.", conf=0.5)
    if len(redirect_chain) >= 2:
        sig("long_redirect_chain", 12,
            f"The page was reached through {len(redirect_chain)} redirects.", conf=0.55,
            cat="PHISHING", chain_length=len(redirect_chain))
    if parser.iframes:
        sig("iframe_present", 6, f"The page embeds {parser.iframes} iframe(s).", conf=0.4)
    if len(parser.external_scripts) >= 8:
        sig("many_external_scripts", 8,
            f"The page loads {len(parser.external_scripts)} external scripts.", conf=0.4)

    # Reuse URL heuristics on the final URL; collect indicators for intel.
    url_result = _url_detector.analyze(final_url)
    signals.extend(url_result.signals)
    indicators = list(url_result.indicators)

    signals.insert(0, DetectionSignal(
        source=SignalSource.VISUAL, indicator="page_title", weight=0,
        summary=f"Page title: {parser.title[:120] or '(none)'}.", confidence=0.3,
        detail={"title": parser.title[:200], "final_url": final_url,
                "forms": len(parser.form_actions), "redirects": len(redirect_chain)},
    ))
    return DetectionResult(signals=signals, indicators=indicators, normalized_input=final_url)
