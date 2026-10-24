# CyberShield 360 — Data Model & ERD

> DB-agnostic by design. Core entities are normalized relational tables; flexible,
> provider-specific evidence is stored in JSON columns (`evidence_json`,
> `provider_results_json`) — never the whole app in one giant JSON blob.

## Access rule
Business logic uses **repositories** (`ScanRepository`, `UserRepository`, …), never
raw SQL. Swapping SQLite→Postgres→(future) Mongo changes the repository impl only.

## ERD (logical)

```
┌───────────────┐        ┌────────────────────┐        ┌─────────────────────┐
│ users         │1      *│ scans              │*      1│ threat_categories   │
├───────────────┤────────├────────────────────┤────────├─────────────────────┤
│ id (uuid) PK  │        │ id (uuid) PK        │        │ code PK (PHISHING…) │
│ email UQ      │        │ user_id FK (nullable│        │ label               │
│ password_hash │        │  = anonymous)       │        │ description         │
│ role (enum)   │        │ scan_type (enum)    │        │ enabled             │
│ is_verified   │        │ status (enum)       │        └─────────────────────┘
│ mfa_secret    │        │ risk_level (enum)   │
│ created_at    │        │ risk_score int      │        ┌─────────────────────┐
└───────┬───────┘        │ confidence float    │        │ threat_intel        │
        │                │ category FK         │        ├─────────────────────┤
        │1               │ input_ref (redacted)│        │ id PK               │
        │                │ evidence_json       │        │ provider            │
        │*               │ provider_results_jsn│        │ indicator           │
┌───────┴────────┐       │ request_id          │        │ indicator_type      │
│ scan_feedback  │       │ created_at          │        │ threat_type         │
├────────────────┤       │ expires_at (retain) │        │ confidence          │
│ id PK          │       └─────────┬───────────┘        │ first_seen/last_seen│
│ scan_id FK     │                 │                    │ source_url          │
│ useful bool    │                 │* (evidence rows    │ expires_at          │
│ marked_wrong   │                 │  optional/denorm)  │ UQ(provider,indic.) │
│ note           │       ┌─────────┴───────────┐        └─────────────────────┘
└────────────────┘       │ scan_indicators     │
                         ├─────────────────────┤        ┌─────────────────────┐
┌────────────────┐       │ id PK               │        │ incidents           │
│ community_report│      │ scan_id FK          │        ├─────────────────────┤
├────────────────┤       │ type (url/phone/upi)│        │ id PK               │
│ id PK          │       │ value_redacted      │        │ user_id FK          │
│ reporter_id FK │       │ weight              │        │ answers_json        │
│ indicator_type │       └─────────────────────┘        │ guidance_json       │
│ value          │                                      │ created_at          │
│ status (enum)  │       ┌─────────────────────┐        └─────────────────────┘
│ dupe_group     │       │ awareness_content   │
│ confidence     │       ├─────────────────────┤        ┌─────────────────────┐
│ created_at     │       │ id PK               │        │ news_items          │
└────────────────┘       │ slug UQ             │        ├─────────────────────┤
                         │ category            │        │ id PK               │
┌────────────────┐       │ title / body_md     │        │ title / summary     │
│ audit_log      │       │ quiz_json           │        │ source / source_url │
├────────────────┤       │ status (draft/pub)  │        │ published_at        │
│ id PK          │       └─────────────────────┘        │ category / region   │
│ actor_id FK    │                                      │ severity            │
│ action         │       ┌─────────────────────┐        └─────────────────────┘
│ target         │       │ cyber_laws          │
│ meta_json      │       ├─────────────────────┤        ┌─────────────────────┐
│ request_id     │       │ id PK               │        │ official_orgs       │
│ created_at     │       │ authority           │        ├─────────────────────┤
└────────────────┘       │ title               │        │ id PK               │
                         │ publication_date    │        │ name                │
┌────────────────┐       │ effective_date      │        │ official_domains[]  │
│ refresh_tokens │       │ status              │        │ official_apps[]     │
├────────────────┤       │ official_source     │        │ support_channels[]  │
│ id PK          │       │ plain_summary       │        └─────────────────────┘
│ user_id FK     │       └─────────────────────┘
│ token_hash UQ  │
│ expires_at     │       ┌─────────────────────┐
│ revoked bool   │       │ app_config          │  (admin-editable flags/thresholds
└────────────────┘       ├─────────────────────┤   so admin changes need no redeploy)
                         │ key PK / value_json │
                         └─────────────────────┘
```

## Enums
- `role`: USER | ANALYST | ADMIN
- `scan_type`: URL | MESSAGE | EMAIL | IMAGE | QR | WEBSITE
- `scan_status`: QUEUED | RUNNING | COMPLETE | FAILED
- `risk_level`: LOW | SUSPICIOUS | HIGH | CRITICAL
- `report_status`: PENDING | REVIEWING | ACCEPTED | REJECTED
- threat categories: seeded table, not a hard-coded enum (admin-configurable).

## Privacy in the schema
- `scans.input_ref` stores a **redacted** representation (or a hash) by default;
  raw content is persisted only when `STORE_RAW_UPLOADS=true` or the user opts in.
- `expires_at` drives automated retention cleanup (`DATA_RETENTION_DAYS`).
- Never store passwords/OTPs/full card numbers/API keys (enforced in audit + PII).

## Indexes (initial)
- `users(email)` unique; `scans(user_id, created_at)`; `scans(risk_level)`;
  `threat_intel(indicator)`, unique `(provider, indicator)`;
  `refresh_tokens(token_hash)` unique; `news_items(published_at)`.

## Migrations
Alembic; every schema change = a versioned migration in `backend/alembic/versions/`.
