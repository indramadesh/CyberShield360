"""Structured logging + request-id middleware.

Technical logs are English; user-facing messages are localized elsewhere.
Secrets / passwords / OTPs / raw content must never be logged.
"""
from __future__ import annotations

import logging
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


def configure_logging(debug: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
    )
    # Ensure records always have a request_id attribute.
    old_factory = logging.getLogRecordFactory()

    def factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return record

    logging.setLogRecordFactory(factory)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a request id, exposes it on state + response header."""

    async def dispatch(self, request: Request, call_next):
        request_id = "req_" + uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Security headers. A strict CSP is applied to API responses but skipped for
    the interactive docs (/docs, /redoc) which load Swagger assets from a CDN.
    HSTS is added in production. The SPA sets its own CSP at the edge."""

    _DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

    async def dispatch(self, request: Request, call_next):
        from app.core.config import settings

        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if not any(request.url.path.startswith(p) for p in self._DOCS_PATHS):
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
