from __future__ import annotations

from sqlalchemy import desc, select

from app.db.models.scan import Scan
from app.repositories.base import SQLAlchemyRepository


class ScanRepository(SQLAlchemyRepository[Scan]):
    model = Scan

    def create(self, **fields) -> Scan:
        return self.add(Scan(**fields))

    def list_for_user(self, user_id: str, *, limit: int = 50, offset: int = 0) -> list[Scan]:
        stmt = (
            select(Scan)
            .where(Scan.user_id == user_id)
            .order_by(desc(Scan.created_at))
            .limit(limit)
            .offset(offset)
        )
        return list(self.session.scalars(stmt).all())
