# Extension Security Threat Model

## Assets
- User's browsing safety; the URLs they choose to analyze.
- Extension settings + local cache.
- The backend the extension talks to.

## Trust boundaries
1. Web page ↔ extension — pages are **untrusted**; the extension reads no page
   content and injects nothing into privileged pages.
2. Extension ↔ backend — over host-permission'd fetch; backend enforces its own authz.
3. Extension ↔ user — explicit actions only (click to analyze, proceed past a warning).

## Threats → mitigations
| Threat | Mitigation |
|--------|-----------|
| Over-broad permissions | `activeTab`/`storage`/`declarativeNetRequest`/`alarms` only; backend host pinned; other hosts via runtime `optional_host_permissions`. |
| Reading/leaking page content | No content scripts, no `tabs`; only the active tab URL on click. |
| Credential/OTP capture | Never implemented; the extension has no form/keystroke access. |
| XSS / HTML injection into extension pages | All dynamic text is HTML-escaped (`esc()`); no `innerHTML` from network data without escaping; no `eval`. |
| Prompt injection via scanned content | Scanned URLs are sent as data to `/scans`; explanations come from the backend's guarded LLM layer, not the extension. |
| Secrets in the bundle | None embedded; validator secret-scans sources before packaging. |
| Token theft | No auth tokens stored by default; anonymous scans used. |
| Backend outage treated as "safe" | Analysis shows "unavailable"; block rules retained; never a green "safe". |
| Blocking all unknown sites | Only high-confidence known-bad domains get DNR rules; unknown ≠ blocked. |
| Package tampering / path traversal | Fixed include-list packaging; `manifest.json` at root; SHA-256 published; `dist` is file-by-file copy. |
| SSRF via backend website fetch | Handled in the platform backend (SSRF gate); the extension never fetches arbitrary sites itself. |

## Privacy
Only user-chosen URLs reach the configured backend. No history upload, no third-party
calls from the extension, no PII collection. See `PRIVACY_POLICY.md`.

## Known limitations
- The blocklist is a bounded demo/internal list — not exhaustive.
- Automatic blocking covers main-frame navigations to listed domains; it is not a
  general real-time crawler and cannot catch every threat.
- In-browser behavior (DNR redirect, popup) must be verified by loading the unpacked
  extension; the build validates structure, syntax, and the pure logic via unit tests.
