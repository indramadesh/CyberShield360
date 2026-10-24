from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_optional_user, require_feature
from app.core.errors import NotFoundError
from app.db.models.user import User
from app.repositories.content_repository import IncidentRepository
from app.schemas.common import ok
from app.services.incident_guidance import REPORTING_INFO, build_guidance

router = APIRouter(prefix="/incidents", tags=["incidents"])


class IncidentRequest(BaseModel):
    clicked_link: bool = False
    entered_password: bool = False
    shared_otp: bool = False
    shared_upi_pin: bool = False
    transferred_money: bool = False
    installed_app: bool = False
    shared_personal_info: bool = False


def _rid(request):
    return getattr(request.state, "request_id", None)


def _can_read(incident, user) -> bool:
    if incident.user_id is None:
        return True
    return user is not None and incident.user_id == user.id


@router.get("/reporting-info")
def reporting_info(request: Request):
    # Public & static (configurable). Never triggers a report.
    return ok(REPORTING_INFO, _rid(request))


@router.post("", dependencies=[Depends(require_feature("incident_response"))])
def create_incident(body: IncidentRequest, request: Request,
                    session: Session = Depends(db_session),
                    user: User | None = Depends(get_optional_user)):
    answers = body.model_dump()
    guidance = build_guidance(answers)
    repo = IncidentRepository(session)
    incident = repo.create(user_id=user.id if user else None, answers_json=answers,
                           guidance_json=guidance, severity=guidance["severity"])
    repo.commit()
    return ok({"incident_id": incident.id, **guidance}, _rid(request))


@router.get("/{incident_id}")
def get_incident(incident_id: str, request: Request,
                 session: Session = Depends(db_session),
                 user: User | None = Depends(get_optional_user)):
    incident = IncidentRepository(session).get(incident_id)
    if not incident or not _can_read(incident, user):
        raise NotFoundError("Incident not found.")
    return ok({"incident_id": incident.id, **incident.guidance_json}, _rid(request))
