# CyberShield 360 — Deployment

## Local development (this machine: no Docker/Postgres/Redis)
Backend:
```
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\.env.example ..\.env        # then edit
alembic upgrade head                 # creates SQLite schema
uvicorn app.main:app --reload
```
Frontend:
```
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api to :8000)
```
Defaults: SQLite, `TASK_BACKEND=eager` (website scans run in-process worker),
all providers mocked, demo data on. Fully offline.

## Docker (deploy target)
`docker-compose.yml` brings up: `frontend`, `backend`, `postgres`, `redis`,
`worker` (Celery), and optional `sandbox` (egress-restricted website worker).
Not required locally; used for staging/prod-like runs.

## Production checklist
- `APP_ENV=production`, `DEBUG=false`, `DEMO_MODE=false`, `MOCK_*=false`.
- Strong `SECRET_KEY`; real provider credentials via secret manager (not `.env` in image).
- `DATABASE_PROVIDER=postgresql`; run `alembic upgrade head` on release.
- `REDIS_ENABLED=true`, `TASK_BACKEND=celery`; scale workers; isolate the sandbox
  worker network (egress allowlist) for SSRF safety.
- HTTPS/HSTS at the edge; security headers on; rate limiting on; audit logging on.
- Backups for Postgres; log/metric shipping (`/health`, `/ready`, Prometheus via
  `prometheus-fastapi-instrumentator`).

## CI/CD
Pipeline: lint → type-check → unit → integration → security (pip-audit/npm audit)
→ build images. No deploy on failure. Migrations applied as a release step.
