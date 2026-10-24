"""Tiered rate limiting + body-size guard (spec §47/§75).

Fixed 60-second window per (client IP, tier). In-memory here; a production deploy
with Redis enabled would back this with Redis. Limits are configurable and tiers
are stricter for expensive (upload/website) and auth-sensitive endpoints."""
from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

_WINDOW = 60.0
# key -> (window_start_epoch, count)
_BUCKETS: dict[str, tuple[float, int]] = {}


def clear() -> None:
    _BUCKETS.clear()


def _tier(path: str, method: str) -> tuple[str, int]:
    if path.endswith("/scans/website") or path.endswith("/scans/upload"):
        return "expensive", settings.rate_limit_expensive_per_min
    if "/auth/login" in path or "/auth/register" in path:
        return "auth", settings.rate_limit_auth_per_min
    return "default", settings.rate_limit_default_per_min


def _allow(key: str, limit: int) -> bool:
    now = time.time()
    start, count = _BUCKETS.get(key, (now, 0))
    if now - start >= _WINDOW:
        _BUCKETS[key] = (now, 1)
        return True
    if count >= limit:
        return False
    _BUCKETS[key] = (start, count + 1)
    return True


def _deny(request: Request) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"success": False,
                 "error": {"code": "RATE_LIMITED", "message": "Too many requests. Please slow down."},
                 "request_id": getattr(request.state, "request_id", None)},
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Body-size guard first (reject oversized bodies cheaply).
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > settings.max_request_bytes:
            return JSONResponse(
                status_code=413,
                content={"success": False,
                         "error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request body too large."},
                         "request_id": getattr(request.state, "request_id", None)})

        if settings.rate_limit_enabled and request.url.path.startswith("/api/"):
            client_ip = request.client.host if request.client else "unknown"
            tier, limit = _tier(request.url.path, request.method)
            if not _allow(f"{client_ip}:{tier}", limit):
                return _deny(request)
        return await call_next(request)
