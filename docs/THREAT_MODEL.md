# CyberShield 360 — Threat Model

Method: asset-centric + STRIDE-informed, plus an explicit **AI threat model**
(the platform ingests attacker-controlled content by design).

## Assets
- User accounts & credentials; session/refresh tokens.
- Uploaded files & scanned content (often sensitive: screenshots, messages).
- Provider API credentials (LLM, threat intel, cloud).
- Database & threat-intelligence store.
- Admin account & configuration.

## Threat actors
- Malicious end users / abusive clients (bots).
- Attackers targeting the platform (account takeover, data theft, RCE via uploads).
- **Malicious scanned content** — a first-class actor: the URL/file/message under
  analysis is assumed hostile.
- Compromised dependencies / supply chain.

## Trust boundaries
1. Browser ↔ API (authn/z, rate limit, validation).
2. API ↔ scanned content (untrusted-data boundary; never executed/trusted).
3. API ↔ external providers (network, secrets, quota, failure isolation).
4. App ↔ website sandbox (strongest boundary; isolated, egress-restricted worker).
5. App ↔ LLM (prompt-injection boundary; see AI section).

## Threats → mitigations

| # | Threat | Mitigation | Phase |
|---|--------|-----------|-------|
| T1 | **SSRF** via website scanner reaching internal/metadata hosts | Mandatory SSRF gate: parse→resolve→reject private/loopback/link-local/metadata→re-check on every redirect→timeouts→size/redirect caps. Fetch only in sandbox worker. | 5 |
| T2 | **Prompt injection** (scanned text says "ignore instructions / leak keys") | Scanned content passed as *data* in a fenced user block; fixed system+policy prompt; output schema-validated; LLM has no tool/secret access. | 2/4 |
| T3 | **Malicious upload** (polyglot, decompression bomb, oversized) | MIME allowlist + magic-byte check, size cap, safe decode with Pillow limits, processing timeout, random temp filename, auto-delete. | 3 |
| T4 | **Account takeover** (brute force, credential stuffing) | Argon2/bcrypt hashing, login rate limit + lockout/backoff, generic errors, optional MFA, refresh-token rotation + revocation. | 1 |
| T5 | **IDOR / broken access control** | Ownership checks in service layer, RBAC middleware, UUID ids, deny-by-default. | 1/2 |
| T6 | **SQLi** | SQLAlchemy parameterized queries only; no string-built SQL; repository layer. | 1 |
| T7 | **XSS** | React auto-escaping; no `dangerouslySetInnerHTML` on scanned content; sanitize/plain-render; CSP. | 1/6 |
| T8 | **CSRF** | Bearer tokens (not cookies) for API; if cookies used, SameSite + CSRF token. | 1 |
| T9 | **Secret leakage** | Secrets only server-side/env; never sent to frontend; `.env` gitignored; not logged. | 1 |
| T10 | **API abuse / DoS** | Tiered rate limits (anon/auth/admin/expensive), input-size limits, scan timeout, queue backpressure. | 1/5 |
| T11 | **Data leakage / over-retention** | STORE_RAW_UPLOADS=false default, PII redaction, retention cleanup, redacted history & reports. | 1/3 |
| T12 | **Supply chain** | Pinned deps, lockfiles, CI dependency audit (pip-audit/npm audit). | 11 |
| T13 | **Provider compromise / outage** | Provider isolation; failures degrade gracefully; confidence lowered; no single point of failure. | 4 |
| T14 | **Info leak via errors** | Structured errors, no stack traces/paths to client, error ids for correlation. | 1 |

## AI threat model (explicit)
- **Direct & indirect prompt injection** → data/instruction separation (T2).
- **Hallucination / overconfidence** → LLM only *explains* provided evidence; it
  cannot originate indicators; risk/score come from the deterministic engine, not
  the LLM; confidence surfaced separately; "no indicators ≠ safe" disclaimer.
- **Sensitive info leakage to provider** → PII redaction before LLM calls; raw
  uploads not sent when avoidable; mock provider for dev.
- **Data poisoning** of community reports → moderation, dupe detection, confidence
  weighting; unverified reports never label a person as criminal.
- **Provider compromise** → keys server-side, least privilege, rotation.

## Non-goals / honest limits
- Not an infallible malware detector; results are assessments, not guarantees.
- PII detection is best-effort; no claim of perfect coverage.
- Threat intel is only as fresh/correct as its sources; coverage gaps are surfaced.
