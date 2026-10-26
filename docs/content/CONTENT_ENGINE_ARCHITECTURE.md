# Content Engine — Architecture

```
            ┌──────────── worker process (python -m app.content.worker) ────────────┐
            │ scheduler (DB leases in job_locks)                                     │
            │  ├─ sync_sources      6 h   registry.py → content_sources              │
            │  ├─ ingest_feeds     10 min due sources → http → adapters → ingest     │
            │  ├─ daily_selection  15 min learning.ensure_today (lesson/tip/quiz/…)  │
            │  └─ prune_old_articles 24 h retention                                  │
            └────────────────────────────────┬───────────────────────────────────────┘
                                             │ writes
                                   PostgreSQL / SQLite
                                             │ reads
            ┌────────────────────── FastAPI (app.api.v1.routes) ─────────────────────┐
            │ /updates /updates/today /updates/sources /content/status               │
            │ /legal /legal/{slug}  /news /laws (compat)                             │
            │ /learn/daily /learn/tips /learn/progress /learn/categories             │
            │ /quiz/daily|weekly|practice|review|categories  /challenges/daily       │
            │ /awareness/{slug} (+ /quiz)  /admin/content/*                          │
            └────────────────────────────────┬───────────────────────────────────────┘
                                             │ TanStack Query (cache + 5-min refetch)
                           React pages: Today's Updates, News & Advisories, Live
                           Alerts, Cyber Law Tracker, Learning Hub, Daily Quiz, Admin
```

The browser never contacts third-party sites; only the worker fetches, and only
URLs from the registry.

## Modules (`backend/app/content/`)

| Module | Responsibility |
|---|---|
| `registry.py` | Single source definition, `sync_sources()`, `NOT_ENABLED` list |
| `http.py` | SSRF-gated fetch: per-hop gate, same-site redirects (max 5), conditional requests, size/type/time caps, Retry-After |
| `adapters.py` | RSS/RDF/Atom (DTD/entity docs rejected), CISA KEV JSON, CERT-In and CSK HTML |
| `normalize.py` | HTML → plain text, URL validation/canonicalisation, strict date parsing (unknown stays `None`), hashes |
| `classify.py` | Keyword categories (`category_origin=system`); severity only from source (+ documented KEV rule) |
| `ingest.py` | Pipeline, dedupe, quality checks, health, exponential backoff, auto-pause, retention |
| `legal.py` | Curated records, status taxonomy, document watch + versions, change candidates, publish policy |
| `learning.py` | Deterministic, persisted daily/weekly selections; timezone handling |
| `quiz.py` | Answer-free payloads, server grading, attempts, progress, streak, recommendations, review |
| `scheduler.py` / `worker.py` | Leased jobs, restart-safe schedule, CLI entry point |
| `freshness.py` | Per-section state: fresh / partial / stale / never_refreshed / no_sources |
| `seed.py`, `library/` | Idempotent seeding of 25 lessons, 71 questions, 40 tips |

## Data model

Extended tables (all new columns nullable, so existing rows are untouched):

- `news_items` + source_key, external_id, canonical_url (unique), title_norm, content_hash, kind, source_updated_at, last_seen_at, severity_origin, category_origin, status, language, tags. `created_at` = ingestion date; `published_at` = the **source's** date or NULL.
- `cyber_laws` + jurisdiction, document_type, legal_status, commencement_status, related_legislation, amends, document_ref, excerpt, summary_provenance, verification_status, last_checked_at, source_key, slug (unique), content_hash, etag, last_modified, is_published.
- `awareness_content` + difficulty, objective, example, warning_signs, prevention, related_slugs, source_refs, review_status, library_version, updated_at.

New tables: `content_sources`, `source_fetch_runs`, `legal_document_versions`
(unique law+version), `legal_change_candidates` (unique dedupe_key),
`quiz_questions`, `daily_tips`, `daily_selections` (unique kind+period),
`quiz_attempts` (unique user+kind+period), `quiz_answers`, `lesson_progress`
(unique user+lesson), `job_locks`.

Content audit events reuse the existing `audit_log` (source enable/disable).

## Key rules

- **Dedupe:** (source, external id) → canonical URL (any source) → same source + same title + same day. A changed title/summary is an *update*, not a new item. Different publishers reporting the same incident stay separate.
- **Dates:** source publication date, source update date, ingestion date and last-seen date are stored separately. A missing date is shown as "date not given by the source" and sorts after dated items.
- **Severity:** source-stated only, plus one system rule (KEV = known exploited → high, labelled "rule"). Headline wording never raises severity.
- **Legal publish policy:** curated records are verified by hand. An automatically found item is published only as an *official publication, status not established* (or *draft* if the title says so) when it comes from an official source, has an https link, a title and a source date. Otherwise it stays an open candidate. A changed official file creates a version and an open candidate, never a change of legal status.
- **Selection:** seeded by date, avoids items shown in the last N days, different topic from yesterday, difficulty rotation; marks `revision` when the library is exhausted. Stored once per period (unique constraint), so concurrent requests and refreshes agree.
- **Quiz integrity:** answer keys are sent only in results; only answers for the period's selected questions count; one recorded attempt per user per daily/weekly/challenge period.
- **Failure isolation:** each source runs in its own try/commit; errors are classified (timeout, connect, http, rate_limited, too_large, content_type, redirect, ssrf, parse) and drive backoff `interval × 2^failures` (max 24 h, at least Retry-After). After 20 consecutive failures the source is paused until an admin resumes it.
- **Optional local AI:** not used. Summaries are the source's own excerpt (truncated). No paid API is required anywhere.
