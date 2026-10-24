"""Shared response envelope helpers."""
from __future__ import annotations

from typing import Any


def ok(data: Any, request_id: str | None = None) -> dict:
    return {"success": True, "data": data, "request_id": request_id}
