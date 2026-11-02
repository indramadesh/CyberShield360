"""CyberShield 360 API entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse

from app.api.v1.router import api_router
from app.api.v1.routes import health
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import (
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
    configure_logging,
)
from app.core.ratelimit import RateLimitMiddleware

log = logging.getLogger("cybershield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev/testing: ensure schema + seed exist. Production relies on Alembic; seeding
    # of reference data is safe/idempotent.
    from app.db.seed import run_all
    from app.db.session import SessionLocal, init_db

    if not settings.is_production:
        init_db()
    with SessionLocal() as session:
        run_all(session)
        # Load admin runtime overrides (feature flags / thresholds) into cache.
        from app.core import runtime_config

        runtime_config.load(session)
    stop_scheduler = None
    if settings.content_scheduler_embedded:
        # Dev convenience only; production runs `python -m app.content.worker`.
        from app.content.scheduler import start_embedded

        stop_scheduler = start_embedded(SessionLocal)
    log.info("%s started (env=%s, db=%s)", settings.app_name, settings.app_env,
             settings.database_provider)
    yield
    if stop_scheduler is not None:
        stop_scheduler.set()


def create_app() -> FastAPI:
    configure_logging(settings.debug)
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Multi-modal cybersecurity awareness & threat-analysis platform.",
        lifespan=lifespan,
        docs_url="/docs",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)
    # RequestContext added last => outermost => request_id is set before the
    # rate limiter runs (so 429 responses carry a request id).
    app.add_middleware(RequestContextMiddleware)

    register_error_handlers(app)

    app.include_router(health.router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)
    if settings.static_dir:
        app.add_middleware(GZipMiddleware, minimum_size=1024)
        _serve_site(app, Path(settings.static_dir).resolve())
    return app


def _serve_site(app: FastAPI, root: Path) -> None:
    """Serve the built website; unknown paths get index.html for client-side routes."""

    @app.get("/{path:path}", include_in_schema=False)
    def site(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        target = (root / path).resolve()
        if path and target.is_file() and target.is_relative_to(root):
            # Vite puts a content hash in asset names, so they can be cached for good.
            immutable = path.startswith("assets/")
            return FileResponse(target, headers={"Cache-Control": (
                "public, max-age=31536000, immutable" if immutable else "no-cache")})
        return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})


app = create_app()
