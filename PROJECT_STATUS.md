# PROJECT STATUS — CyberShield 360

_Last updated: 2026-10-24 · Platform Phases 0–11 complete; **Browser Protection
extension v1.0.0** built & packaged. 97 backend tests, 6 frontend tests, 6 extension
unit tests — all green._

## Browser Protection Extension (Chrome MV3) — v1.0.0

**Done & validated**
- MV3 extension under `extension/` (dependency-free vanilla, ES modules): manifest,
  background service worker, popup, options, warning page, shared modules, icons.
- **Reuses** the platform engine via `POST /api/v1/scans` (no duplicate risk engine);
  added two small public endpoints: `/api/v1/extension/health` + `/extension/blocklist`.
- Least-privilege permissions: `activeTab`, `storage`, `declarativeNetRequest`,
  `alarms` + backend host only (others via runtime `optional_host_permissions`).
- On-demand analysis (popup: current tab + manual URL), known-bad **DNR blocking** →
  warning page, options (backend URL, protection level, trusted sites, grant-host),
  graceful offline handling, no credential/history collection.
- Dependency-free build/package: `validate` + `package` → `artifacts/…zip` (+ sha256 +
  `release-manifest.json`) + store-ready `extension/dist/`, published to
  `frontend/public/downloads/`. **ZIP verified** (integrity OK, manifest at root,
  checksum matches).
- Website `/browser-protection` page: features, real ZIP download (reads
  release-manifest), manual-install steps, permission/privacy disclosure, Web-Store
  "pending publication" (not fabricated). Sidebar + routing wired.
- Docs: extension README, INSTALLATION, PRIVACY_POLICY, EXTENSION_ARCHITECTURE,
  EXTENSION_API_CONTRACT, EXTENSION_SECURITY_THREAT_MODEL.
- Tests: backend 97/97 (incl. 2 extension-endpoint tests); frontend 6/6; extension
  6/6 unit (url/risk logic). Syntax-checked all JS with `node --check`.

**Pending / needs human step (honest)**
- **In-browser behavior** (popup interaction, DNR redirect to warning, camera-free
  flows) is validated at the structure/syntax/logic level here; it should be
  confirmed by **loading the unpacked extension** in Chrome (see INSTALLATION.md).
- **Chrome Web Store**: the store-ready ZIP exists but is **not published** — requires
  a developer account + Google review. Website shows a pending state until then.
- Automatic blocking is main-frame + known-bad-domain scoped (not a general crawler).
- CI packaging step not yet added to GitHub Actions (manual `npm run build` works).

## Completed
- **Phase 0 — Discovery & Architecture**
  - Environment inspected: Python 3.13 (FastAPI/SQLAlchemy/Alembic/Celery/Redis/
    Pillow/Uvicorn preinstalled), Node 22, Git 2.53. No Docker/Postgres/Redis
    locally → dev runs on SQLite + eager task backend + mock providers.
  - Repository structure created (backend/frontend/docs).
  - Docs authored: ARCHITECTURE, DATABASE (ERD), API, THREAT_MODEL, SECURITY,
    CONFIGURATION, TESTING, DEPLOYMENT, CONTRIBUTING, README, `.env.example`.
- **Phase 1 — Foundation** (verified)
  - Config system (`core/config.py`, pydantic-settings) + feature flags
    (`core/features.py`) exposed at `/api/v1/config`.
  - DB abstraction: `Base`/session + repository pattern (`UserRepository`,
    `RefreshTokenRepository`, `ScanRepository`); models: user, refresh_token,
    scan, threat_category, audit_log. Alembic wired; initial migration generated
    and verified (`upgrade head` creates all tables on a clean DB).
  - Provider registry with mock defaults: LLM, OCR, ThreatIntel (internal demo
    blocklist), Storage (local). Everything runs offline.
  - Auth: register/login/refresh(rotating)/logout/me, Argon2 hashing, JWT
    access+refresh, RBAC deps, optional-user + feature-gate deps.
  - Structured error envelope, request-id + security-headers middleware,
    structured logging, `/health` + `/ready` (subsystem checks).
  - Frontend: Vite+React+TS+Tailwind scaffold, design tokens (light/dark via
    `data-theme`), UI primitives (Button/Card/RiskBadge), config-driven landing +
    dashboard that auto-hide disabled modules. Builds clean; tests pass.
  - Docker (backend/frontend Dockerfiles + compose: postgres/redis/worker),
    GitHub Actions CI (lint→audit→test→build).
  - **Verified:** backend 9/9 pytest green; live uvicorn `/health` `/ready`
    `/config` OK; frontend `tsc`+`vite build` clean; 2/2 vitest green.

- **Phase 2 — Core scanners + risk engine** (verified)
  - Normalized `DetectionSignal` model; detectors emit signals only.
  - **Risk Engine** (single scoring authority): saturating normalization → 0–100,
    configurable bands, confidence via noisy-OR capped at 0.95 (never certain),
    coverage-degraded reduces confidence + annotates. Evidence + Recommendation
    engines (defensive, category-aware, never "safe").
  - **URL detector**: scheme/https, userinfo trick, IP host, punycode, subdomains,
    shorteners, suspicious tokens, redirect params, brand impersonation.
  - **Message detector**: 11 social-engineering families + combination boosts
    (not keyword-only), indicator extraction, PII redaction of stored text.
  - **PII module**: phone/email/PAN/Aadhaar/card/UPI detect + redact.
  - **Scan orchestrator**: detector → threat-intel → engines → evidence-only LLM
    explanation → persist (redacted by default, retention `expires_at`).
  - **`/scans` API**: create (anon allowed), get (ownership check = anti-IDOR),
    list (auth), delete (owner/admin), feedback (+`scan_feedback` table/migration).
  - **Frontend**: shared `ScanResult` (risk+confidence separate, evidence, recs,
    collapsed technical details) + working `ScannerPage` (tabs, loading/error
    states) wired to the API; dashboard actions link to it.
  - **Verified:** backend 30/30 pytest (incl. prompt-injection + IDOR security
    tests); live server scans — phishing URL→HIGH, scam SMS→HIGH+PII, benign→LOW;
    frontend build clean + 4/4 vitest.

- **Phase 3 — Multi-modal** (verified)
  - **OCR** provider abstraction: offline mock (reads a PNG `ocr_text` chunk so the
    image pipeline is deterministically testable) + optional lazy `TesseractProvider`.
  - **QR** decoder abstraction: offline mock (`qr_payload` chunk) + optional
    `OpenCVQRDecoder`; selectable via `QR_DECODER` (auto|opencv|mock).
  - **Image scanner**: `/scans/upload` → `validate_image` (size/MIME-by-decode/
    decompression-bomb guard) → OCR → reuse message analysis. Raw images never
    persisted to the DB (only redacted extracted text).
  - **QR analyzer**: classifies url/upi/tel/wifi/text; URL payloads inherit URL
    heuristics; UPI is parsed and treated as *informational* (unknown payee is not
    malicious). Accepts client-decoded payload (JSON) or an image (multipart).
  - **Email scanner**: stdlib parse of From/Reply-To/Return-Path, domain-mismatch
    signals, embedded-link URL heuristics, body content via the message detector.
  - EMAIL + QR string payloads flow through the existing `/scans` JSON endpoint;
    orchestrator refactored to a shared `_assess` + `run_image`.
  - **Frontend**: scanner now has URL/Message/Email/QR (text) + Image (upload)
    tabs; multipart `apiUpload` helper.
  - **Verified:** backend 47/47 pytest (adds QR/email unit, multimodal integration,
    upload-security tests); live server — IMAGE→HIGH, QR-url→HIGH, QR-unknown-UPI
    →LOW, EMAIL→CRITICAL; frontend build clean + 4/4 vitest.

- **Phase 4 — Threat intelligence** (verified)
  - `threat_intel` table + `ThreatRepository` (find/upsert, TTL-aware) + migration.
  - `DatabaseThreatIntelProvider` (always-available local store) +
    `InternalThreatIntelProvider` (demo blocklist) + external adapters
    (WebRisk/PhishTank/OpenPhish/urlscan) that fail *soft* and are only registered
    when not mocked and configured (no network in tests).
  - `ThreatIntelService`: TTL cache keyed by SHA-256 of the normalized indicator,
    aggregation + de-dupe across providers, persists external hits locally, reports
    degraded coverage when a provider errors/is unavailable.
  - `url_normalize` (scheme/host/trailing-slash/fragment) + `indicator_key`.
  - Orchestrator now routes intel through the service.
  - Admin `GET /threat-intel/status` (RBAC) — provider list, mock flag, cache size.
  - Seeded synthetic DB indicators.
  - **Verified:** backend 55/55 pytest (url-normalize, service cache/degradation,
    DB-match, admin-status RBAC); live — seeded-domain scan→HIGH w/ intel_match,
    admin status lists 6 providers, cache populates.

- **Phase 5 — Website analysis** (verified)
  - **SSRF gate** (`ssrf.py`): blocks non-http(s), private/loopback/link-local/
    reserved/multicast/unspecified/CGNAT + IPv4-mapped IPv6 + cloud metadata;
    resolves hostnames and checks every resolved IP; raises `SSRFError` (400).
  - **SSRF-guarded fetcher** (`website_fetcher.py`): manual redirect following that
    re-runs the gate on every hop; caps redirects, bytes (2 MB stream), and time.
    Only place that fetches; runs via the task backend, never inline.
  - **Website analyzer** (stdlib HTML parser): password/OTP/payment fields,
    external form actions, meta-refresh, long redirect chains, iframes, external
    scripts + final-URL heuristics.
  - Orchestrator refactored to `_compute`/`_persist`/`_outcome`; `run_website`
    creates a QUEUED scan and processes via eager path (dev) or Celery task
    (`app/tasks/website_tasks.py`); failures (SSRF/timeout) → FAILED with reason.
  - `POST /scans/website` endpoint; frontend Website tab; `ScanResult` now renders
    FAILED/QUEUED states honestly (no risk badge on a non-complete scan).
  - **Verified:** backend 74/74 pytest (15 SSRF assertions incl. metadata/CGNAT/
    IPv4-mapped, analyzer, queued pipeline, graceful-fail, monkeypatched fetch);
    live — loopback/metadata/private/ftp all 400 SSRF_BLOCKED; frontend build +
    4/4 vitest.

- **Phase 6 — Awareness** (verified): `awareness_content` + `challenges` tables;
  lessons + quizzes, daily challenge (deterministic rotation), personalized
  recommendations from scan-history categories; Learn UI (lessons, quiz, challenge).
- **Phase 7 — Incident Response** (verified): `incidents` table; rule-based
  guidance engine (severity + situation-specific steps), India reporting info
  (cybercrime.gov.in, 1930), never auto-files; Incident questionnaire UI.
- **Phase 8 — Intelligence** (verified): `news_items`, `cyber_laws`,
  `official_orgs`, `community_reports`; news feed, cyber-law tracker, community
  reporting with daily rate limit + duplicate detection + moderation that promotes
  accepted URL/domain indicators to the local store at LOW confidence (never a
  public accusation of a person); Intel UI (news + laws tabs).
- **Phase 9 — Admin** (verified): `app_config` runtime overrides (feature flags +
  thresholds, no redeploy — wired into `current_flags()` and the risk engine),
  analytics, system health, CMS (awareness/news upsert), feedback-based evaluation
  (explicitly not ground-truth); auth flow + Admin UI (analytics + flag toggles).
- **Phase 10 — Hardening** (verified): tiered rate limiting + body-size guard
  middleware, strict CSP (skipped on /docs) + HSTS in prod, audit logging of
  sensitive events (login success/failure, config change, report moderation).
- **Phase 11 — Deployment** (prepared): Docker/compose + Dockerfiles, GitHub
  Actions CI, prod checklist, `.env.example` updated; migration chain verified
  from zero (4 migrations → 15 tables); OpenAPI at /docs (31 paths).

## Acceptance criteria (spec §111)
- Functionality: auth, URL/message/email/image(OCR)/QR/website scanners, risk
  engine, threat intel, explainability, incident response, awareness, admin — all ✅.
- Architecture: modular, configurable, DB abstraction, AI/OCR/intel/storage/QR
  provider abstractions, feature flags — all ✅.
- Security: authn/z, rate limiting, SSRF, upload security, prompt-injection
  defense, secret management, audit logging, secure headers — all ✅ (tested).
- UX: responsive, light/dark, mobile-friendly scan, loading/error/empty states,
  no clutter — ✅.
- Quality: unit + integration + security tests (backend 95, frontend 4),
  API docs, deployment docs — ✅.

## In progress
- None — Phases 0–11 complete and verified.

## Blocked
- None. (Docker/Postgres/Redis absent locally — mitigated by SQLite + mocks.)

## Next (follow-ups / not blocking)
- Full auth UI polish (password reset, MFA) and richer admin CMS screens.
- Live-network integration tests for the external threat-intel adapters (behind a
  marker; offline suite uses injected fakes).
- Campaign correlation (feature-flagged off) and notification center (optional).

## Architecture decisions (ADR-style log)
- **ADR-1**: DB access via repository abstraction; SQLite dev / Postgres prod;
  no raw SQL in business logic. Rationale: DB-swappable per spec §6, §97.
- **ADR-2**: All external capabilities behind provider interfaces with **mock**
  defaults. Rationale: offline dev, no single point of failure, swappable per §28/§8.
- **ADR-3**: Risk scoring centralized in one Risk Engine; detectors emit normalized
  signals only. Rationale: no scattered thresholds (§23).
- **ADR-4**: LLM explains evidence, never originates it; risk/score are deterministic.
  Rationale: §29, AI threat model.
- **ADR-5**: Tasks default to `eager` (in-process) when Redis disabled; website
  scans still go through the queue/worker/SSRF-gate code path. Rationale: local
  runnability without weakening the sandbox boundary.

## Known bugs
- None open.
- **Fixed during Phase 1:** (a) refresh-token expiry compared tz-aware vs
  SQLite-naive datetimes → normalize to UTC; (b) seeded dev admin used a `.local`
  email that `email-validator` rejects, making it unable to log in → switched to
  `admin@cybershield.dev` + added a regression test.

## Security issues / watchlist
- SSRF gate (Phase 5) must re-validate on every redirect — tracked in THREAT_MODEL T1.
- Ensure PII redaction runs before any LLM call (Phase 2/4).

## Technical debt
- Frontend feature UIs land per phase (scanner done; awareness/news/laws/admin pending).
- Mongo repository adapter is designed-for but not implemented (relational only now).
- Risk confidence saturates to the 0.95 cap quickly when several mid-confidence
  signals stack; revisit the noisy-OR weighting when ML signals (Phase 3+) arrive.
- `_registrable()` uses a last-two-labels heuristic (imperfect for multi-part TLDs
  like `co.uk`); replace with `tldextract` when that dependency is added.
- Real threat-intel + LLM/OCR adapters still mocked (Phases 3–4).
