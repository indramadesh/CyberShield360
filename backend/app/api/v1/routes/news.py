from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import db_session, require_feature
from app.repositories.content_repository import LawRepository, NewsRepository
from app.schemas.common import ok

router = APIRouter(tags=["intelligence"])


def _rid(request):
    return getattr(request.state, "request_id", None)


@router.get("/news", dependencies=[Depends(require_feature("cyber_news"))])
def list_news(request: Request, limit: int = 20, offset: int = 0,
              category: str | None = None, session: Session = Depends(db_session)):
    items = NewsRepository(session).recent(limit=min(limit, 50), offset=offset, category=category)
    return ok([
        {"id": n.id, "title": n.title, "summary": n.summary, "source": n.source,
         "source_url": n.source_url, "category": n.category, "region": n.region,
         "severity": n.severity,
         "published_at": n.published_at.isoformat() if n.published_at else None}
        for n in items
    ], _rid(request))


@router.get("/laws", dependencies=[Depends(require_feature("cyber_law"))])
def list_laws(request: Request, session: Session = Depends(db_session)):
    laws = LawRepository(session).all_ordered()
    return ok([
        {"id": law.id, "authority": law.authority, "title": law.title,
         "status": law.status, "official_source": law.official_source,
         "plain_summary": law.plain_summary,
         "publication_date": law.publication_date.isoformat() if law.publication_date else None,
         "effective_date": law.effective_date.isoformat() if law.effective_date else None}
        for law in laws
    ], _rid(request))
