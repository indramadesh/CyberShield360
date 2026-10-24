# CyberShield 360 — Configuration

Configuration is **centralized** and layered; nothing infrastructural is hard-coded.

## Layers (highest wins)
1. Process env / `.env` (see `.env.example`) — loaded by `app/core/config.py`
   (`pydantic-settings`).
2. `app_config` DB table — admin-editable overrides (feature flags, thresholds,
   retention, rate limits) applied at runtime **without redeploy**.
3. Code defaults in `Settings` — safe, offline-friendly defaults.

## What is configurable
- **App**: name, env, debug, secret, CORS, API prefix.
- **Database**: `DATABASE_PROVIDER` (sqlite|postgresql|mysql) + URL. Business logic
  is unaffected by the choice (repository pattern).
- **Redis/tasks**: `REDIS_ENABLED`, `TASK_BACKEND` (eager|celery).
- **Providers**: LLM / OCR / ThreatIntel / Storage / Embedding — each resolves from
  a name to a concrete adapter via the provider registry; `mock` defaults everywhere.
- **Feature flags**: `ENABLE_*` → exposed at `/api/v1/config`; UI hides disabled
  modules and backend guards the routes.
- **Privacy/limits**: `STORE_RAW_UPLOADS`, `PII_REDACTION_ENABLED`, file size,
  scan time, retention days.
- **Risk thresholds**: `RISK_THRESHOLD_SUSPICIOUS/HIGH/CRITICAL` (documented as
  operator-tunable, not universal science).
- **Modes**: `APP_ENV`, `MOCK_*`, `DEMO_MODE`.

## Feature flags
Single source: `app/core/features.py` reads `ENABLE_*` into a `FeatureFlags` object.
- Backend: a dependency rejects requests to disabled features (404/feature-off).
- Frontend: fetches `/api/v1/config`, renders only enabled modules. **No broken
  buttons for disabled features.**

## Provider registry
`app/providers/registry.py` maps `LLM_PROVIDER=openai` → `OpenAIProvider`. Unknown
or unconfigured providers fall back to the mock and log a warning. Switching
providers is a one-line env change; no business-logic edits.

## Environments
`development` (SQLite, mocks, demo data), `testing` (isolated SQLite, all mocks),
`staging`, `production` (real secrets required, debug off, HTTPS, rate limits on,
demo data off). Each supplies its own `.env`.
