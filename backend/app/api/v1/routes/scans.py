from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import db_session, get_current_user, get_optional_user
from app.core.enums import Role, ScanType
from app.core.errors import ForbiddenError, NotFoundError, ValidationAppError
from app.db.models.feedback import ScanFeedback
from app.db.models.user import User
from app.repositories.scan_repository import ScanRepository
from app.schemas.common import ok
from app.schemas.scan import FeedbackRequest, ScanCreateRequest, WebsiteScanRequest
from app.services.scan_orchestrator import ScanOrchestrator

router = APIRouter(prefix="/scans", tags=["scans"])

# Map a scan type to the feature flag that gates it.
_FEATURE_FOR_TYPE = {
    ScanType.URL.value: "url_scanner",
    ScanType.MESSAGE.value: "message_scanner",
    ScanType.EMAIL.value: "email_scanner",
    ScanType.QR.value: "qr_scanner",
    ScanType.IMAGE.value: "image_scanner",
}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _can_read(scan, user: User | None) -> bool:
    # Anonymous scans (no owner) are readable by holders of the id.
    if scan.user_id is None:
        return True
    if user is None:
        return False
    return scan.user_id == user.id or user.role in {Role.ANALYST.value, Role.ADMIN.value}


@router.post("")
def create_scan(
    body: ScanCreateRequest,
    request: Request,
    session: Session = Depends(db_session),
    user: User | None = Depends(get_optional_user),
):
    from app.core.features import is_enabled

    if body.type == ScanType.IMAGE:
        raise ValidationAppError("Use /scans/upload for image scans.")
    if body.type == ScanType.WEBSITE:
        raise ValidationAppError("Use /scans/website for website analysis.")

    feature = _FEATURE_FOR_TYPE.get(body.type.value)
    if feature and not is_enabled(feature):
        raise NotFoundError("This scanner is currently unavailable.")

    orch = ScanOrchestrator(session)
    outcome = orch.run(
        scan_type=body.type.value,
        payload=body.payload,
        user_id=user.id if user else None,
        request_id=_rid(request),
    )
    return ok(orch.to_dict(outcome), _rid(request))


@router.post("/website")
def scan_website(
    body: WebsiteScanRequest,
    request: Request,
    session: Session = Depends(db_session),
    user: User | None = Depends(get_optional_user),
):
    from app.core.features import is_enabled

    if not is_enabled("website_scanner"):
        raise NotFoundError("This scanner is currently unavailable.")
    orch = ScanOrchestrator(session)
    outcome = orch.run_website(
        url=body.url, user_id=user.id if user else None, request_id=_rid(request))
    return ok(orch.to_dict(outcome), _rid(request))


@router.post("/upload")
def upload_scan(
    request: Request,
    file: UploadFile = File(...),
    scan_type: str = Form(ScanType.IMAGE.value),
    session: Session = Depends(db_session),
    user: User | None = Depends(get_optional_user),
):
    from app.core.features import is_enabled
    from app.providers.registry import get_qr_decoder

    feature = _FEATURE_FOR_TYPE.get(scan_type)
    if feature and not is_enabled(feature):
        raise NotFoundError("This scanner is currently unavailable.")

    data = file.file.read()
    orch = ScanOrchestrator(session)
    uid = user.id if user else None

    if scan_type == ScanType.IMAGE.value:
        outcome = orch.run_image(image_bytes=data, user_id=uid, request_id=_rid(request))
    elif scan_type == ScanType.QR.value:
        payload = get_qr_decoder().decode(data)
        if not payload:
            raise ValidationAppError("No QR code could be read from the image.")
        outcome = orch.run(scan_type=ScanType.QR.value, payload=payload,
                           user_id=uid, request_id=_rid(request))
    elif scan_type == ScanType.EMAIL.value:
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            raise ValidationAppError("The email file could not be read.")
        outcome = orch.run(scan_type=ScanType.EMAIL.value, payload=text,
                           user_id=uid, request_id=_rid(request))
    else:
        raise ValidationAppError(f"Upload not supported for type: {scan_type}")

    return ok(orch.to_dict(outcome), _rid(request))


@router.get("/{scan_id}")
def get_scan(
    scan_id: str,
    request: Request,
    session: Session = Depends(db_session),
    user: User | None = Depends(get_optional_user),
):
    scan = ScanRepository(session).get(scan_id)
    if not scan:
        raise NotFoundError("Scan not found.")
    if not _can_read(scan, user):
        # Same shape as not-found to avoid leaking existence (anti-IDOR).
        raise NotFoundError("Scan not found.")
    ev = scan.evidence_json or {}
    return ok(
        {
            "scan_id": scan.id,
            "scan_type": scan.scan_type,
            "status": scan.status,
            "risk_level": scan.risk_level,
            "risk_score": scan.risk_score,
            "confidence": scan.confidence,
            "category": scan.category,
            "evidence": ev.get("evidence", []),
            "recommendations": ev.get("recommendations", []),
            "notes": ev.get("notes", []),
            "explanation": ev.get("explanation", ""),
        },
        _rid(request),
    )


@router.get("")
def list_scans(
    request: Request,
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    scans = ScanRepository(session).list_for_user(user.id, limit=min(limit, 100), offset=offset)
    return ok(
        [
            {
                "scan_id": s.id,
                "scan_type": s.scan_type,
                "risk_level": s.risk_level,
                "risk_score": s.risk_score,
                "category": s.category,
                "created_at": s.created_at.isoformat() if s.created_at else "",
            }
            for s in scans
        ],
        _rid(request),
    )


@router.delete("/{scan_id}")
def delete_scan(
    scan_id: str,
    request: Request,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    repo = ScanRepository(session)
    scan = repo.get(scan_id)
    if not scan:
        raise NotFoundError("Scan not found.")
    if scan.user_id != user.id and user.role != Role.ADMIN.value:
        raise ForbiddenError("You cannot delete this scan.")
    repo.delete(scan)
    repo.commit()
    return ok({"deleted": True}, _rid(request))


@router.post("/{scan_id}/feedback")
def submit_feedback(
    scan_id: str,
    body: FeedbackRequest,
    request: Request,
    session: Session = Depends(db_session),
    user: User | None = Depends(get_optional_user),
):
    scan = ScanRepository(session).get(scan_id)
    if not scan or not _can_read(scan, user):
        raise NotFoundError("Scan not found.")
    session.add(ScanFeedback(
        scan_id=scan_id,
        user_id=user.id if user else None,
        useful=body.useful,
        marked_wrong=body.marked_wrong,
        note=body.note,
    ))
    session.commit()
    return ok({"recorded": True}, _rid(request))
