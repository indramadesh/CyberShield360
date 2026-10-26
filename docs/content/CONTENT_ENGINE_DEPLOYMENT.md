# Content Engine — Running & Deploying

## Locally

```bat
run-local.bat            REM opens backend, frontend and the content worker
```

or by hand:

```bash
cd backend
python -m uvicorn app.main:app --port 8000      # API (creates/updates the dev SQLite schema)
python -m app.content.worker                    # worker: runs forever, ticks every 60 s
python -m app.content.worker --once             # run whatever is due, then exit
python -m app.content.worker --once --force ingest_feeds   # fetch all sources now
```

`CONTENT_SCHEDULER_EMBEDDED=true` runs the scheduler inside the API process
instead (convenient for a single dev terminal; not for production).

## Production (Oracle Always Free VM, `deploy/docker-compose.prod.yml`)

The compose file now has a **`worker`** service built from the backend image:

- `backend` runs `alembic upgrade head` then uvicorn, and has a healthcheck.
- `worker` starts only when `backend` is healthy (so migrations are applied), runs
  `python -m app.content.worker`, and restarts automatically (`unless-stopped`).
- Both use `deploy/.env.prod`; the worker never needs to be reachable from outside.

```bash
cd deploy && ./deploy.sh          # or: docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml exec worker python -m app.content.worker --once --force ingest_feeds
```

Migration `bd8ade54c48d_content_intelligence_engine` is additive (new tables,
nullable columns, indexes). It was tested upgrade → downgrade → upgrade and
`alembic check` reports no drift.

### Why a separate worker

Hosts that sleep idle web processes (Render free tier, etc.) would stop
scheduled jobs. The VM runs the worker as its own always-on container, so content
keeps refreshing with no browser open and survives restarts: the schedule lives
in `job_locks` (last finish per job) and expired leases are reclaimed. Running
two workers is safe — each job is leased in the database.

If you ever move to a host without persistent processes, run
`python -m app.content.worker --once` from that host's cron/scheduled-job
feature every 10 minutes instead; the result is the same.

## Configuration (`.env` / `.env.prod`)

| Variable | Default | Meaning |
|---|---|---|
| `CONTENT_TIMEZONE` | `Asia/Kolkata` | Defines "today" for the daily lesson, quiz and tip |
| `CONTENT_INGESTION_ENABLED` | `true` | `false` = serve stored content only (tests use this) |
| `CONTENT_SCHEDULER_EMBEDDED` | `false` | Run the scheduler inside the API process |
| `CONTENT_USER_AGENT` | `CyberShield360-ContentBot/1.0 (+repo URL)` | Honest client identification |
| `CONTENT_STALE_HOURS` | `12` | When a section is shown as stale |
| `CONTENT_PAUSE_AFTER_FAILURES` | `20` | Auto-pause threshold per source |
| `CONTENT_RETENTION_DAYS` | `365` | Articles older than this are pruned |

No API keys are needed. Nothing secret is sent to the frontend.

## Monitoring

- Admin → **Content operations**: per-source health and errors, run log, scheduler
  jobs with last status, legal change candidates, sources evaluated but not enabled.
- Public `GET /api/v1/content/status`: freshness per section and the last ingest run
  (suitable for an external uptime check: alert if `last_ingest_finished_at` is
  older than ~30 minutes).
- Every page shows a freshness banner: "Up to date", "Some sources unavailable",
  "May be out of date" or "Not refreshed yet".
