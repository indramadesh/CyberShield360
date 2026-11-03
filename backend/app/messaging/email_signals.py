"""Email-specific signals the generic email scanner doesn't cover: provider
authentication results, display-name impersonation and attachment metadata.

Authentication results are read only from headers a trusted provider added
(Gmail's mx.google.com, Microsoft's Exchange Online Protection). We never infer a
pass from the sender's name or address."""
from __future__ import annotations

import re
from email.utils import parseaddr

from app.services.engine.signals import DetectionSignal, SignalSource

# Providers whose topmost Authentication-Results header is their own verdict: the
# receiving server prepends it, so anything below it may have been forged by a sender.
# Gmail marks it with its authserv-id; Exchange Online Protection writes no stable id.
TRUSTED_AUTHSERV = {"gmail": "mx.google.com", "outlook": None}
_RESULT = re.compile(r"\b(spf|dkim|dmarc)\s*=\s*(pass|fail|softfail|neutral|none|temperror|permerror|bestguesspass)\b", re.I)

_FREE_MAIL = {
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com",
    "live.com", "rediffmail.com", "aol.com", "icloud.com", "proton.me", "protonmail.com", "gmx.com",
}
# Names people trust in a From line → domains that genuinely send for them.
_BRANDS = {
    "sbi": ("sbi.co.in", "onlinesbi.sbi", "sbi"), "state bank": ("sbi.co.in", "onlinesbi.sbi"),
    "hdfc": ("hdfcbank.com", "hdfcbank.net"), "icici": ("icicibank.com",), "axis bank": ("axisbank.com",),
    "paytm": ("paytm.com",), "phonepe": ("phonepe.com",), "amazon": ("amazon.in", "amazon.com"),
    "flipkart": ("flipkart.com",), "paypal": ("paypal.com",), "microsoft": ("microsoft.com",),
    "google": ("google.com",), "apple": ("apple.com",), "netflix": ("netflix.com",),
    "income tax": ("incometax.gov.in", "gov.in"), "uidai": ("uidai.gov.in",), "aadhaar": ("uidai.gov.in",),
    "rbi": ("rbi.org.in",), "india post": ("indiapost.gov.in",), "cert-in": ("cert-in.org.in",),
}
_ROLE_WORDS = ("support", "security", "helpdesk", "help desk", "customer care", "account team", "billing", "kyc")

# Executable or script types that run when opened; macro-enabled Office files.
_DANGEROUS_EXT = {
    "exe", "scr", "com", "pif", "bat", "cmd", "msi", "msix", "ps1", "vbs", "vbe", "js", "jse", "wsf",
    "hta", "lnk", "jar", "apk", "dll", "cpl", "reg", "iso", "img", "vhd", "xll",
}
_MACRO_EXT = {"docm", "xlsm", "pptm", "dotm", "xltm", "xlam"}
_ARCHIVE_EXT = {"zip", "rar", "7z", "gz", "tar", "cab", "ace"}
_DOC_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "txt"}


def _sig(indicator, weight, summary, *, conf=0.6, cat=None, src=SignalSource.DOMAIN, **detail):
    return DetectionSignal(source=src, indicator=indicator, weight=weight, summary=summary,
                           confidence=conf, category_hint=cat, detail=detail)


def parse_auth_results(headers: dict[str, list[str]], provider: str) -> dict:
    """{"spf": "pass", "dkim": "fail", "dmarc": "pass", "source": "provider"} from the
    topmost trusted Authentication-Results header, or {} when none is trusted."""
    if provider not in TRUSTED_AUTHSERV:
        return {}
    values = headers.get("authentication-results", [])
    if not values:
        return {}
    top = values[0]
    authserv = TRUSTED_AUTHSERV[provider]
    if authserv and not top.strip().lower().startswith(authserv):
        return {}
    found = {m.group(1).lower(): m.group(2).lower() for m in _RESULT.finditer(top)}
    return {**found, "source": f"{provider} Authentication-Results header"} if found else {}


def auth_signals(auth: dict) -> list[DetectionSignal]:
    out: list[DetectionSignal] = []
    if not auth:
        return out
    if auth.get("dmarc") == "fail":
        out.append(_sig("dmarc_fail", 25, "The sender's domain failed DMARC: the message may not really "
                        "come from the domain in the From address.", conf=0.8, cat="IMPERSONATION"))
    elif auth.get("spf") in ("fail", "softfail") and auth.get("dkim") not in ("pass",):
        out.append(_sig("spf_fail", 15, "The sending server isn't authorised by the sender's domain (SPF "
                        f"{auth['spf']}) and there's no passing DKIM signature.", conf=0.65, cat="IMPERSONATION"))
    if auth.get("dkim") == "fail" and auth.get("dmarc") != "fail":
        out.append(_sig("dkim_fail", 8, "A DKIM signature on this message failed verification.", conf=0.5))
    return out


def sender_signals(from_header: str) -> list[DetectionSignal]:
    out: list[DetectionSignal] = []
    name, addr = parseaddr(from_header or "")
    name_low, addr_low = name.lower().strip(), addr.lower()
    domain = addr_low.split("@")[-1] if "@" in addr_low else ""
    if not domain:
        return out
    # Display name shows a different address than the one actually sending.
    shown = re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", name_low)
    if shown and all(s != addr_low for s in shown):
        out.append(_sig("display_name_address_mismatch", 20,
                        f"The sender's name shows the address {shown[0]}, but the message comes from {addr_low}.",
                        conf=0.75, cat="IMPERSONATION", shown=shown[0], actual=addr_low))
    for brand, official in _BRANDS.items():
        if re.search(rf"\b{re.escape(brand)}\b", name_low):
            if not any(domain == d or domain.endswith("." + d) for d in official):
                free = domain in _FREE_MAIL
                out.append(_sig("display_name_impersonation", 25 if free else 18,
                                f"The sender calls itself '{name.strip()}' but writes from {domain}, "
                                f"which isn't an official {brand.upper() if len(brand) <= 5 else brand.title()} domain.",
                                conf=0.75 if free else 0.65, cat="IMPERSONATION", brand=brand, domain=domain))
            break
    else:
        if domain in _FREE_MAIL and any(w in name_low for w in _ROLE_WORDS):
            out.append(_sig("freemail_role_sender", 10,
                            f"A '{name.strip()}' sender is using a free personal mailbox ({domain}).",
                            conf=0.55, cat="IMPERSONATION"))
    return out


def attachment_signals(attachments: list[dict]) -> list[DetectionSignal]:
    """Metadata only (name, type, size). Nothing is downloaded or opened, so a clean
    result never means a file is safe."""
    out: list[DetectionSignal] = []
    for a in attachments[:20]:
        name = str(a.get("filename") or "").strip().lower()
        if not name:
            continue
        parts = name.rsplit(".", 2)
        ext = parts[-1] if len(parts) > 1 else ""
        prev = parts[-2] if len(parts) > 2 else ""
        if ext in _DANGEROUS_EXT and prev in _DOC_EXT:
            out.append(_sig("attachment_double_extension", 35,
                            f"'{a['filename']}' pretends to be a .{prev} file but is a .{ext} program.",
                            conf=0.85, cat="MALWARE", src=SignalSource.CONTENT, filename=a["filename"]))
        elif ext in _DANGEROUS_EXT:
            out.append(_sig("attachment_executable", 25,
                            f"'{a['filename']}' is a .{ext} file, which can run code when opened.",
                            conf=0.75, cat="MALWARE", src=SignalSource.CONTENT, filename=a["filename"]))
        elif ext in _MACRO_EXT:
            out.append(_sig("attachment_macro", 18,
                            f"'{a['filename']}' is a macro-enabled Office file; macros can run code.",
                            conf=0.65, cat="MALWARE", src=SignalSource.CONTENT, filename=a["filename"]))
        elif ext in _ARCHIVE_EXT:
            out.append(_sig("attachment_archive", 6,
                            f"'{a['filename']}' is an archive; its contents weren't inspected.",
                            conf=0.4, src=SignalSource.CONTENT, filename=a["filename"]))
    return out
