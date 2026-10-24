from __future__ import annotations

import datetime as dt

from sqlalchemy import select

from app.db.models.user import RefreshToken, User
from app.repositories.base import SQLAlchemyRepository


class UserRepository(SQLAlchemyRepository[User]):
    model = User

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return self.session.scalars(stmt).first()

    def create(self, *, email: str, password_hash: str, role: str) -> User:
        user = User(email=email.lower(), password_hash=password_hash, role=role)
        return self.add(user)


class RefreshTokenRepository(SQLAlchemyRepository[RefreshToken]):
    model = RefreshToken

    def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        return self.session.scalars(stmt).first()

    def create(self, *, user_id: str, token_hash: str, expires_at: dt.datetime) -> RefreshToken:
        rt = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        return self.add(rt)

    def revoke(self, rt: RefreshToken) -> None:
        rt.revoked = True
        self.session.flush()
