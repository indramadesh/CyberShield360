# CyberShield 360 — Testing

A module is not "done" without tests. Offline-first: everything runs against mock
providers and SQLite, so the full suite passes with no network or paid APIs.

## Backend (pytest)
- **Unit** (`backend/tests/unit`): URL parser/normalizer, risk engine + scoring,
  PII detection, QR parsing, domain heuristics, recommendation engine.
- **Integration** (`backend/tests/integration`): auth flow, repository CRUD on
  SQLite, scan API end-to-end (mock providers), config/feature-flag gating.
- **Security** (`backend/tests/security`): SSRF gate (private/metadata/redirect),
  malicious upload rejection, XSS/SQLi payloads through APIs, IDOR (user A cannot
  read user B's scan), rate limiting, prompt-injection (scanned "ignore
  instructions" text must not change behavior/leak).

Run: `cd backend && pytest -q`

## Frontend (Vitest + Testing Library)
Forms & validation (Zod), routing/guards, scanner workflow states
(loading/result/error), empty & error states, responsive smoke, feature-flag hiding.

Run: `cd frontend && npm test`

## Test data
Synthetic only, clearly labeled `DEMO/SYNTHETIC`. Includes legit + phishing URLs,
legit + scam messages, benign + suspicious QR payloads, synthetic scam screenshots.
No real personal data. See seed scripts.

## CI gates
lint → type-check → unit → integration → security → build. Failing gate blocks merge.
