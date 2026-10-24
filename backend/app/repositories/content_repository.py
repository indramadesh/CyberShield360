from __future__ import annotations

from sqlalchemy import desc, select

from app.db.models.awareness import AwarenessContent, Challenge
from app.db.models.community import CommunityReport
from app.db.models.content import CyberLaw, NewsItem, OfficialOrg
from app.db.models.incident import Incident
from app.repositories.base import SQLAlchemyRepository


class AwarenessRepository(SQLAlchemyRepository[AwarenessContent]):
    model = AwarenessContent

    def list_published(self, category: str | None = None) -> list[AwarenessContent]:
        stmt = select(AwarenessContent).where(AwarenessContent.status == "published")
        if category:
            stmt = stmt.where(AwarenessContent.category == category)
        return list(self.session.scalars(stmt.order_by(AwarenessContent.title)).all())

    def get_by_slug(self, slug: str) -> AwarenessContent | None:
        return self.session.scalars(
            select(AwarenessContent).where(AwarenessContent.slug == slug)
        ).first()

    def by_categories(self, categories: list[str]) -> list[AwarenessContent]:
        if not categories:
            return []
        stmt = select(AwarenessContent).where(
            AwarenessContent.status == "published",
            AwarenessContent.category.in_(categories),
        )
        return list(self.session.scalars(stmt).all())


class ChallengeRepository(SQLAlchemyRepository[Challenge]):
    model = Challenge

    def active(self) -> list[Challenge]:
        return list(self.session.scalars(
            select(Challenge).where(Challenge.active.is_(True)).order_by(Challenge.slug)
        ).all())


class NewsRepository(SQLAlchemyRepository[NewsItem]):
    model = NewsItem

    def recent(self, *, limit: int = 20, offset: int = 0, category: str | None = None):
        stmt = select(NewsItem)
        if category:
            stmt = stmt.where(NewsItem.category == category)
        stmt = stmt.order_by(desc(NewsItem.published_at)).limit(limit).offset(offset)
        return list(self.session.scalars(stmt).all())


class LawRepository(SQLAlchemyRepository[CyberLaw]):
    model = CyberLaw

    def all_ordered(self):
        return list(self.session.scalars(
            select(CyberLaw).order_by(desc(CyberLaw.publication_date))
        ).all())


class OrgRepository(SQLAlchemyRepository[OfficialOrg]):
    model = OfficialOrg


class IncidentRepository(SQLAlchemyRepository[Incident]):
    model = Incident

    def create(self, **fields) -> Incident:
        return self.add(Incident(**fields))


class ReportRepository(SQLAlchemyRepository[CommunityReport]):
    model = CommunityReport

    def recent_by_reporter(self, reporter_id: str, since) -> int:
        from sqlalchemy import func

        return self.session.scalar(
            select(func.count()).select_from(CommunityReport).where(
                CommunityReport.reporter_id == reporter_id,
                CommunityReport.created_at >= since,
            )
        ) or 0

    def find_same(self, indicator_type: str, value: str) -> list[CommunityReport]:
        return list(self.session.scalars(
            select(CommunityReport).where(
                CommunityReport.indicator_type == indicator_type,
                CommunityReport.value == value.lower(),
            )
        ).all())

    def queue(self, status: str | None = None, *, limit: int = 50, offset: int = 0):
        stmt = select(CommunityReport)
        if status:
            stmt = stmt.where(CommunityReport.status == status)
        stmt = stmt.order_by(desc(CommunityReport.created_at)).limit(limit).offset(offset)
        return list(self.session.scalars(stmt).all())
