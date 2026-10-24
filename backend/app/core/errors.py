"""Structured error handling — consistent envelope, no stack traces to clients."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("cybershield.error")


class AppError(Exception):
    """Base application error carrying a stable machine code + safe message."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "APP_ERROR"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class AuthError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class FeatureDisabledError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "FEATURE_DISABLED"


class ValidationAppError(AppError):
    status_code = 422  # Unprocessable Content
    code = "INVALID_INPUT"


class RateLimitError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "RATE_LIMITED"


def _envelope(request: Request, code: str, message: str, status_code: int) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {"code": code, "message": message},
            "request_id": request_id,
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return _envelope(request, exc.code, exc.message, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        return _envelope(
            request, "INVALID_INPUT", "The submitted data is invalid.", 422,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND"}.get(
            exc.status_code, "HTTP_ERROR"
        )
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return _envelope(request, code, message, exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # Log full detail server-side; never leak internals to the client.
        log.exception("Unhandled error: %s", exc)
        return _envelope(
            request, "INTERNAL_ERROR", "An unexpected error occurred.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
