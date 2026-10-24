"""Generic repository over a SQLAlchemy session.

Business logic depends on repositories, never on the ORM/session directly, so the
storage engine can be swapped (SQLite/Postgres/MySQL now; a Mongo adapter later)
without touching services.
"""
from __future__ import annotations

from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class SQLAlchemyRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: Session):
        self.session = session

    def get(self, id_: str) -> ModelT | None:
        return self.session.get(self.model, id_)

    def list(self, *, limit: int = 50, offset: int = 0) -> list[ModelT]:
        stmt = select(self.model).limit(limit).offset(offset)
        return list(self.session.scalars(stmt).all())

    def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        self.session.flush()
        return obj

    def delete(self, obj: ModelT) -> None:
        self.session.delete(obj)
        self.session.flush()

    def commit(self) -> None:
        self.session.commit()
