# Content Engine — Phase 0 Audit (2026-10-26)

What existed before the content-intelligence engine, and what was reused.

| Area | Found | Decision |
|---|---|---|
| Backend | FastAPI, SQLAlchemy 2, repository pattern, envelope `{success,data,error,request_id}` | Reused as-is |
| Database | SQLite (dev, `create_all`), PostgreSQL (prod, Alembic). 4 migrations | New migration `bd8ade54c48d`; dev gets an additive column/index sync in `init_db` |
| Auth | JWT + RBAC (`USER`/`ANALYST`/`ADMIN`), `get_current_user` / `get_optional_user` / `require_role` | Reused for progress, attempts and admin ops |
| News | `news_items` table, `/news` endpoint, 2 seeded `[DEMO]` items, admin "create news" | Table **extended**; `/news` now serves published engine items; demo seeding removed |
| Cyber law | `cyber_laws` table, `/laws`, 2 `[DEMO summary]` rows | Table **extended** (status taxonomy, provenance, verification, watch fields); curated verified records seeded |
| Learning | `awareness_content` lessons with embedded `quiz_json`, `/awareness`, admin CMS upsert, recommendations | Table **extended** (difficulty, objective, example, warning signs, prevention, related, sources); 25 curated lessons |
| Quiz | Lesson `quiz_json` and `/challenges/daily` returned **answers to the browser**, graded client-side | Replaced by a server-graded question bank (71 questions); answers never sent before submission |
| Workers | Celery app (optional, `TASK_BACKEND=celery`), Redis only in dev compose; **no scheduled jobs**; prod compose had no worker | New DB-leased scheduler + dedicated `worker` service (no Redis needed) |
| Outbound HTTP | `website_fetcher` (httpx, manual redirects, SSRF gate per hop) | Same pattern in `app/content/http.py`, plus conditional requests, size/type caps, host pinning |
| Admin | Analytics, feature flags, thresholds, CMS | Added content operations (sources, runs, scheduler, legal candidates) |
| Frontend | React/Vite/TanStack Query, emerald design system, News/Learn pages on demo data | New pages wired to real endpoints; old localStorage lesson progress replaced by server progress |
| Tests | 100 backend (pytest, offline mocks), 15 frontend (vitest), headless UI check | +54 backend, +6 frontend; all offline with fixtures |

## Feature checklist

| # | Section | Status |
|---|---|---|
| 1 | Today's Cybersecurity Updates | New page `/app/updates`, `/updates/today` |
| 2 | Live Cybersecurity News | `/app/news` on `/updates` (search, filters, pagination) |
| 3 | Official Security Advisories | `kind=advisory` filter (CERT-In CIAD, CISA when reachable) |
| 4 | Indian Cybersecurity Alerts | CERT-In + CSK sources, `region=IN` filter, Live Alerts page |
| 5 | Indian Cyber Law Tracker | `/app/law`, `/legal`, document watch, candidates |
| 6 | Daily Learning Hub | Daily lesson selection + structured lessons |
| 7 | Daily Cybersecurity Quiz | `/quiz/daily` (5 questions, persisted) |
| 8 | Daily Cybersecurity Tip | `/learn/daily`, `/learn/tips` (history) |
| 9 | Daily Security Challenge | `/challenges/daily` (server-graded) |
| 10 | Weekly Knowledge Assessment | `/quiz/weekly` (10 questions per ISO week) |
| 11 | Learning Progress | `/learn/progress` (lessons, accuracy by topic, streak, recommendations) |
| 12 | Incident Awareness | Existing incident guide + `incident_response` lessons/tips |
| 13 | Official reporting resources | 1930 / cybercrime.gov.in in lessons, tips, incident page |
| 14 | Source health & freshness | `/content/status`, freshness banners, admin health |
| 15 | Automated content management | Worker + scheduler; admin only for exceptions |
