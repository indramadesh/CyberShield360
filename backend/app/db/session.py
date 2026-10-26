"""Engine + session factory. Provider chosen via settings (DB-agnostic)."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

_url = settings.sqlalchemy_url
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_engine(_url, connect_args=_connect_args, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yields a session and always closes it."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create tables for dev/testing (production uses Alembic migrations)."""
    from app.db import models  # noqa: F401  (register mappers)
    from app.db.base import Base

    Base.metadata.create_all(bind=engine)
    _add_missing_columns(Base.metadata)


def _add_missing_columns(metadata) -> None:
    """Dev/test only: `create_all` never alters existing tables, so an existing
    local database would miss columns added later. Add any missing *nullable*
    columns and missing indexes. Additive only — never drops or rewrites data.
    Production schema changes go through Alembic."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table in metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have or not col.nullable:
                    continue
                ddl_type = col.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {ddl_type}'))
            have_idx = {i["name"] for i in insp.get_indexes(table.name)}
            for idx in table.indexes:
                if idx.name and idx.name not in have_idx:
                    idx.create(bind=conn)
