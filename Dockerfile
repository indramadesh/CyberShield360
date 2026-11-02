# Single-service image: the FastAPI backend also serves the built website.
# Used by render.yaml. The VM setup (deploy/) uses backend/Dockerfile + Caddy instead.

# ---- Website + extension download ----
FROM node:22-slim AS site
WORKDIR /repo
COPY extension ./extension
COPY frontend ./frontend
RUN cd extension && npm run build
RUN cd frontend && npm ci && npm run build

# ---- API ----
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 STATIC_DIR=/app/static
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "psycopg[binary]"
COPY backend/ .
COPY --from=site /repo/frontend/dist ./static
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser
# The host's proxy is the only way in, so its forwarded client IP is used for rate limits.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
