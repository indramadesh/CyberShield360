from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import db_session, require_feature
from app.schemas.common import ok

router = APIRouter(tags=["intelligence"])


def _rid(request):
    return getattr(request.state, "request_id", None)


@router.get("/news", dependencies=[Depends(require_feature("cyber_news"))])
def list_news(request: Request, limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0),
              category: str | None = Query(None, max_length=32), session: Session = Depends(db_session)):
    """Published articles collected by the content engine (newest by source date)."""
    from app.api.v1.routes.content import article_dict
    from app.db.models.content import NewsItem

    stmt = select(NewsItem).where(NewsItem.status == "published")
    if category:
        stmt = stmt.where(NewsItem.category == category)
    rows = session.scalars(stmt.order_by(NewsItem.published_at.is_(None), NewsItem.published_at.desc(),
                                         NewsItem.created_at.desc()).limit(limit).offset(offset)).all()
    return ok([article_dict(n) for n in rows], _rid(request))


@router.get("/laws", dependencies=[Depends(require_feature("cyber_law"))])
def list_laws(request: Request, session: Session = Depends(db_session)):
    from app.api.v1.routes.content import _published_laws, law_dict

    return ok([law_dict(l) for l in _published_laws(session)], _rid(request))
