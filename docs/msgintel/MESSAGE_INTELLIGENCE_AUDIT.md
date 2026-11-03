# Message Intelligence — Phase 0 audit

Audit of the CyberShield 360 repository (2026-11-03) before building automatic
message and email protection. See also [ARCHITECTURE](MESSAGE_INTELLIGENCE_ARCHITECTURE.md) ·
[CAPABILITIES](PLATFORM_CAPABILITY_MATRIX.md) · [API](MESSAGE_INTELLIGENCE_API.md) ·
[PRIVACY](MESSAGE_INTELLIGENCE_PRIVACY.md) · [STATUS](MESSAGE_INTELLIGENCE_STATUS.md)

## What exists

| Area | Found | Reuse |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query (`frontend/`) | New dashboard pages in the same app and design system |
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2 (`backend/app`) | New `app/messaging` package and `/msgintel` routes |
| Database | SQLite in development (create_all + additive column sync), PostgreSQL in production via Alembic | New tables + one additive Alembic migration |
| Auth | Email + password (Argon2), JWT access tokens + rotating refresh tokens; roles USER / ANALYST / ADMIN (`app/api/deps.py`) | Unchanged. Devices get separate, revocable pairing tokens |
| URL scanner | `services/detectors/url_detector.py` (offline heuristics: HTTPS, IP hosts, punycode, shorteners, redirects, brand impersonation) | Reused for every extracted link |
| Message scanner | `services/detectors/message_detector.py` (scam families + combinations, embedded-link analysis) | Reused for all text |
| Email scanner | `services/detectors/email_detector.py` (From / Reply-To / Return-Path mismatch, links, content) | Reused; extended with authentication results, display-name impersonation and attachment metadata |
| OCR / QR | Provider layer (`providers/ocr`, `providers/qr`), mock by default | Not needed by this module |
| ML models | None. `SignalSource.ML` is reserved | Rules + heuristics only; documented as such |
| Threat intel | `services/threat_intel.py` (internal list + mock provider) | Reused via the orchestrator's intel lookup |
| Risk engine | `services/engine/risk_engine.py` — the only place signals become score / band / confidence | Reused unchanged |
| Evidence / advice | `evidence_engine.py`, `recommendation_engine.py` | Reused |
| PII | `services/pii.py` (UPI, email, PAN, Aadhaar, card, phone redaction) | Reused; extended with OTP / password value stripping |
| SSRF | `services/ssrf.py` + content fetcher with per-hop checks | No link is ever opened by this module |
| Incident response | `services/incident_guidance.py` + `/incidents` | Reused; two scenarios added |
| Feedback | `ScanFeedback` for scans | Same pattern for analysed messages |
| Scheduler | `app/content/scheduler.py` (DB leases, worker process) | Mail sync + retention run as scheduler jobs |
| Extension | MV3 Browser Protection v1.4.0 (`extension/`), minimal permissions, page-risk checks | Extended with "check selected text" and device pairing; no second extension |
| Notifications | Extension uses `chrome.notifications`; the web app has an in-page alert bell | Alerts get their own table and API |
| Deployment | Docker (VM + Caddy) and Render + Neon + GitHub Actions | Same; new optional env vars for OAuth |

## Gaps this module fills

- No connected sources, consent records, device pairing or monitoring settings.
- Email scanner ignores `Authentication-Results`, display-name impersonation and attachments.
- No message-level classification (scam / phishing / spam / promotional / likely legitimate / unknown).
- No alert records, quiet hours or per-source preferences.
- No Gmail / Outlook integration and no encrypted token storage.
- No Android or iOS code in the repository.

## Constraints kept

- Existing scans, routes, schemas and pages are unchanged. The new tables don't alter existing ones.
- The risk engine stays the single scoring path; messaging adds signals, not a second scorer.
- No paid AI: explanations use the existing mock/internal provider.

## Build environment (this machine)

| Tool | State |
|---|---|
| Python 3.13 + backend venv | Present |
| Node 22 + npm | Present |
| Android SDK (platform 35, build-tools 35/36, emulator, Android 36 x86_64 image), Android Studio JBR, Gradle 8.11.1 cache, AGP 8.9.1 + Kotlin 2.0.21 cache | Present; no AVD and no command-line tools |
| Xcode / macOS | **Not available.** iOS code can be written but not compiled or tested here |
| Docker | Not installed |
