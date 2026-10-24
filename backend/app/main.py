"""CyberShield 360 API entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    log.info("%s started (env=%s, db=%s)", settings.app_name, settings.app_env,
             settings.database_provider)
    yield


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
    return app


app = create_app()
