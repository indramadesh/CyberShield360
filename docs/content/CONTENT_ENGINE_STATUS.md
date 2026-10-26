# Content Engine — Status

Last updated: 2026-10-26. See also [AUDIT](CONTENT_ENGINE_AUDIT.md) ·
[SOURCES](CONTENT_SOURCE_REGISTRY.md) · [ARCHITECTURE](CONTENT_ENGINE_ARCHITECTURE.md) ·
[DEPLOYMENT](CONTENT_ENGINE_DEPLOYMENT.md)

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Repository audit | Done |
| 1 | Source registry (DB table + single code definition) | Done |
| 2 | Public sources verified and configured | Done — 7 sources + 2 legal document watches; 5 evaluated and not enabled |
| 3 | Ingestion pipeline (fetch, parse, normalise, dedupe, classify, quality, health) | Done |
| 4 | News + Today's Updates (API + pages, freshness, refetch) | Done |
| 5 | Indian Cyber Law Tracker (curated records, statuses, document watch, versions, candidates, publish policy) | Done |
| 6 | Daily learning engine (25 lessons, rotation, progress) | Done |
| 7 | Daily quiz engine (71 questions, server grading, attempts) | Done |
| 8 | Daily tips (40, history) | Done |
| 9 | Weekly assessment, daily challenge, practice, review, recommendations | Done |
| 10 | Database (migration `bd8ade54c48d`, additive) | Done |
| 11 | Scheduler + worker (DB leases, restart-safe) | Done |
| 12 | Frontend pages | Done |
| 13 | API | Done |
| 14 | Source health and failure recovery | Done |
| 15 | Content safety (sanitising, SSRF, limits) | Done |
| 16 | Optional local AI | Not used (not required); summaries are source excerpts |
| 17 | Tests | Done (results below) |
| 18 | Deployment (worker service, healthcheck, env) | Done in config; not yet deployed to the VM |
| 19 | Admin controls | Done |

## Live run against real sources (2026-10-26, this machine)

First run of `python -m app.content.worker --once` on an empty database:

| Source | Result |
|---|---|
| certin-home | 200 · 9 items (6 dated by the source) |
| csk-alerts | 200 · 30 items (no dates — stored as unknown) |
| cisa-kev | 200 · 30 items · ETag/Last-Modified |
| ncsc-uk | 200 · 20 items · ETag |
| sans-isc | 200 · 10 items · ETag |
| cisa-advisories | **HTTP 403** (recorded, backing off) |
| cisa-news | **HTTP 403** (recorded, backing off) |
| legal-certin-directions-2022 / -faq | 200 · baseline version stored |

Second forced run (idempotency): sans-isc, ncsc-uk and cisa-kev returned
**304 Not Modified**; certin-home and csk-alerts were all duplicates; still 99
articles, 2 legal versions, 0 false change candidates, 5 daily selections.

Daily selection for 2026-10-26 (Asia/Kolkata): lesson `dpdp-rights`, tip
`cracked-software`, quiz of 5 questions from 5 different topics and all three
difficulty levels, a challenge, and weekly set `2026-W44`.

## Tests (run 2026-10-26)

| Suite | Result |
|---|---|
| Backend `pytest` (all) | **153 passed** (100 existing + 53 new content-engine tests) |
| — `tests/unit/test_content_adapters.py` | RSS/Atom/RDF, KEV, CERT-In, CSK, malformed + DTD/entity XML rejected, sanitising, unsafe links, missing dates, multiply-encoded entities |
| — `tests/unit/test_content_http.py` | 200/304 + conditional headers, 403/404/429/500/503, timeouts, connect errors, size cap, content type, redirect revalidation + off-site block, SSRF (loopback, metadata IP) |
| — `tests/integration/test_content_ingest.py` | Provenance and dates, idempotency + updates, conditional requests, backoff + Retry-After + pause, failure isolation, parse errors, KEV rule, retention, curated legal records, document watch versions/candidates, keyword publish policy, job leases, job failure isolation |
| — `tests/integration/test_learning_quiz.py` | Lesson persistence + rotation, quiz uniqueness/persistence/cooldown, published-only selection, timezone boundary, no answer keys, forged score ignored, one attempt per day, out-of-set answers ignored, weekly/practice/categories, lesson quiz + completion, challenge, per-user progress + auth, review + proficiency, updates filters/pagination/freshness, legal statuses/versions, admin-only operations |
| Alembic | upgrade → downgrade → upgrade OK; `alembic check`: no drift |
| Frontend `vitest` | **21 passed** (freshness states, undated articles, severity provenance, quiz runner, results, new routes) |
| Frontend `tsc` + `npm run build` | Clean |
| Real browser (`node tools/ui-check.mjs`) | **64/64 passed** (incl. Today's Updates, Law Tracker, a full daily quiz submit, landing gate, theme toggle) |

## Known limitations

- **CISA RSS feeds return 403** to the engine's client from this network. They stay enabled with backoff and will auto-pause after 20 failures; the KEV catalogue from CISA works.
- **No automated access to MeitY, India Code, PIB or the Gazette** (blocked or form-driven). The legal tracker therefore relies on curated verified records plus change-watching of CERT-In's official PDFs and keyword detection in CERT-In items. It does **not** detect new MeitY notifications automatically.
- CSK alerts carry no dates on the source page; they appear with "date not given by the source".
- Summaries are short source excerpts, not rewritten text (no AI). Legal summaries are curated by hand.
- The worker must be running for news to refresh. Learning, quiz and tip selection also happen on demand through the API, so they keep working even if the worker is down.
- Progress for a guest isn't stored (by design); sign in to record attempts.
