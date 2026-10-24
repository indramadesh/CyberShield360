# CyberShield 360 — Architecture

> Status: Phase 0 (Discovery & Architecture). This document is the source of truth
> for structure and boundaries. It is updated as phases complete.

## 1. Guiding principles

1. **Every major subsystem is replaceable** without rewriting the app. Business
   logic depends on *abstractions* (repositories, providers), never on concrete
   infrastructure (a specific DB, LLM, OCR engine, or storage backend).
2. **All external input is untrusted** — URLs, files, messages, websites, and LLM
   output alike.
3. **Risk ≠ Confidence.** The product never claims certainty. It reports a risk
   band + a separate confidence + the evidence behind it.
4. **Configuration over hard-coding.** Features, providers, thresholds, and
   categories are configured, not baked into components.
5. **AI explains evidence; it never invents evidence.**

## 2. High-level topology

```
                 React + Vite + TS (frontend)
                            │  HTTPS / JSON
                            ▼
                 FastAPI API layer  (/api/v1)
        ┌───────────────────┼────────────────────┐
        │                   │                     │
   Auth / RBAC       Scan Orchestrator        Content APIs
        │                   │              (news, laws, learn)
        │        ┌──────────┴──────────┐
        │     Detectors            Providers (abstractions)
        │   url / message /       ├── LLMProvider
        │   email / image /       ├── OCRProvider
        │   qr / website          ├── ThreatIntelProvider
        │        │                └── StorageProvider
        │        ▼
        │   Risk Engine → Evidence Engine → Recommendation Engine
        │        │
        └────────┴──────────────► Repositories (data access)
                                        │
                        ┌───────────────┴───────────────┐
                   SQLAlchemy Core            (future: Mongo adapter)
                        │
                 SQLite (dev) / PostgreSQL (prod)

  Redis + Celery (optional) ── background workers ── Isolated Website Sandbox
```

## 3. Layered backend

| Layer | Package | Responsibility | May depend on |
|-------|---------|----------------|---------------|
| API | `app/api/v1` | HTTP routing, request/response schemas, authz | services, schemas |
| Schemas | `app/schemas` | Pydantic DTOs (wire contracts) | — |
| Services | `app/services` | Business logic, orchestration | repositories, providers, engines |
| Engines | `app/services/engine` | Risk / evidence / recommendation (pure, deterministic) | schemas only |
| Detectors | `app/services/detectors` | Per-modality analysis (url, message, …) | providers, engines |
| Providers | `app/providers` | Pluggable adapters (LLM/OCR/ThreatIntel/Storage) | — (interface + impls) |
| Repositories | `app/repositories` | Data access abstraction | db models |
| DB | `app/db` | SQLAlchemy models, session, migrations | — |
| Core | `app/core` | config, feature flags, security, logging, errors | — |

**Dependency rule:** arrows point *downward only*. A detector never imports an API
module; the risk engine never imports SQLAlchemy. This keeps subsystems swappable.

## 4. The abstraction seams (the heart of the design)

### 4.1 Repository pattern (DB-agnostic)
Business logic calls `ScanRepository.create(...)`, never `session.execute(sql)`.
An abstract `Repository` protocol has a SQLAlchemy implementation now; a Mongo
implementation can be added later without touching services. See `DATABASE.md`.

### 4.2 Provider abstractions (infra-agnostic)
Each external capability is an interface with a **mock** default so the whole app
runs with zero paid APIs / zero network:

```
LLMProvider          → MockLLMProvider | OpenAIProvider | AnthropicProvider | OllamaProvider
OCRProvider          → MockOCRProvider | TesseractProvider | EasyOCRProvider
ThreatIntelProvider  → InternalProvider | WebRiskProvider | PhishTankProvider | OpenPhishProvider | UrlscanProvider
StorageProvider      → LocalStorage | S3Storage
```
A registry resolves the concrete class from config at startup. Switching providers
= changing one env var.

### 4.3 Detection → Risk pipeline
Each detector returns a normalized `DetectionSignal[]` (source, weight, indicator,
evidence). The **Risk Engine** is the *single* place that turns signals into a
score/band — no scattered `if score > 70` in the app. See §6.

## 5. Scan orchestration flow

```
POST /api/v1/scans {type, payload}
   → validate + feature-flag check + rate limit
   → ScanOrchestrator.dispatch(type)
       → Detector.analyze(payload)  ──► signals[]
       → ThreatIntelProvider.lookup(indicators) ──► signals[]
       → RiskEngine.score(signals)  ──► {band, score, confidence, category}
       → EvidenceEngine.build(signals)
       → RecommendationEngine.for(category, band)
       → ScanRepository.save(result)   (respecting STORE_RAW_UPLOADS)
   → 200 ScanResult
```
Website scans are **queued** (never fetched inline) → worker → sandbox. All others
run inline within `MAX_SCAN_TIME_SECONDS`.

## 6. Risk engine contract

Input: `DetectionSignal[]` grouped by source (rule/ml/intel/domain/content/visual/community).
Output:
```json
{ "risk_level": "HIGH", "risk_score": 87, "confidence": 0.91,
  "category": "PHISHING", "indicators": [...], "evidence": [...], "recommendations": [...] }
```
- Score is a **normalized** weighted sum (capped 0–100), not unbounded addition.
- Bands come from configurable thresholds (`RISK_THRESHOLD_*`).
- Confidence is derived from signal agreement + source reliability + coverage
  (degraded when providers are unavailable — see §7).

## 7. Degraded / offline mode
The rule-based core works with no network. If a threat-intel provider fails, the
scan **continues** with remaining providers and the result is annotated
("limited threat-intelligence coverage") and confidence is lowered. No provider is
a single point of failure; failures are surfaced, never silently faked.

## 8. Frontend architecture
Feature-sliced (`src/features/*`), a shared `components/ui` design system driven by
CSS-variable **design tokens** (one token set, theme via `data-theme`), a typed
`services/` API client, and TanStack Query for server state. The UI reads the
`/config` endpoint and **auto-hides modules whose feature flag is off** — no broken
buttons. See `frontend/` and `CONFIGURATION.md`.

## 9. Security posture (summary; full detail in SECURITY.md / THREAT_MODEL.md)
- Untrusted-content boundary around all scanned data and LLM I/O (prompt-injection
  defense: system policy is never mixed with scanned content).
- SSRF gate mandatory before any outbound fetch (website scanner).
- Upload validation (size/MIME/decode/timeout), temp-only storage, auto-cleanup.
- JWT access/refresh, RBAC (USER/ANALYST/ADMIN), rate limiting, audit log,
  secure headers, structured errors (no stack traces to clients).

## 10. Environment-specific notes (this machine)
- No Docker / Postgres / Redis locally → dev runs on **SQLite + eager task backend**.
- Docker Compose targets deployment (postgres + redis + worker + sandbox).
- Tesseract/EasyOCR/real LLMs are optional; **mock providers** keep everything
  runnable and testable offline.
