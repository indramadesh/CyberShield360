# CyberShield 360 — Security

Companion to `THREAT_MODEL.md`. This lists the concrete controls and where they live.

## Authentication & sessions
- Password hashing: Argon2 (preferred) / bcrypt via `passlib`; never plaintext.
- JWT access tokens (short TTL) + rotating refresh tokens (hashed at rest,
  revocable). Logout revokes refresh.
- Optional MFA (TOTP) architecture; `mfa_secret` column reserved.
- Login: rate limit + exponential backoff, generic failure messages.

## Authorization
- RBAC (USER/ANALYST/ADMIN) via FastAPI dependencies.
- Ownership checks in the service layer for every user-scoped resource (anti-IDOR).
- Deny-by-default; UUID identifiers.

## Input & data
- All request bodies validated by Pydantic schemas; size limits enforced.
- Uploads: MIME allowlist + magic-byte sniff, size cap, safe decode, timeout,
  random temp names, auto-delete, no trust in original filename.
- Output: structured error envelope; no stack traces/paths/secrets to clients.

## SSRF (website scanner) — mandatory gate
Order: parse URL → block non-http(s) → resolve host → reject private/loopback/
link-local/ULA/metadata (169.254.169.254, etc.) → fetch in sandbox worker only →
re-validate on **every** redirect → connect/read timeouts → max redirects → max
response bytes. First validation is never assumed sufficient.

## LLM / prompt-injection
- Fixed system prompt + security policy; scanned content injected only inside a
  fenced, clearly-labeled untrusted-data block.
- LLM output is schema-validated; the LLM cannot set risk/score or access secrets
  or tools. It explains evidence produced by deterministic detectors/intel.

## Transport & headers
- HTTPS in prod (HSTS); security headers: CSP, X-Content-Type-Options,
  Referrer-Policy, frame protections. CSP is tested against the SPA, not blindly copied.

## Secrets
- Server-side/env only; never shipped to the frontend or logged; `.env` gitignored;
  `.env.example` holds placeholders.

## Audit logging
Logged: login/logout/failed-login, password reset, admin actions, scan requests,
config changes, provider failures, report moderation. **Not** logged: passwords,
API keys, OTPs, full payment credentials, unnecessary raw content.

## Rate limiting
Tiers: anonymous < authenticated < admin; stricter for uploads & website scans.
Configurable; backed by Redis when enabled, in-memory fallback otherwise.

## Dependency & CI
Pinned deps + lockfiles; `pip-audit` + `npm audit` and lint/type/tests in CI;
no deploy on failing checks.
