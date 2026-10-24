"""Declarative base + shared column helpers (DB-portable)."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def gen_uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Base(DeclarativeBase):
    """All models inherit this. String UUID PKs keep us portable across
    SQLite / PostgreSQL / MySQL without native-UUID coupling."""


class UUIDMixin:
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_uuid)


class TimestampMixin:
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
