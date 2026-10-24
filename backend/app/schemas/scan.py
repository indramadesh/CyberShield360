from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.enums import ScanType


class ScanCreateRequest(BaseModel):
    type: ScanType
    payload: str = Field(min_length=1, max_length=20_000)


class WebsiteScanRequest(BaseModel):
    url: str = Field(min_length=3, max_length=2048)


class EvidenceItem(BaseModel):
    indicator: str
    summary: str
    source: str
    weight: float
    detail: dict = {}


class ScanResultOut(BaseModel):
    scan_id: str
    scan_type: str
    status: str
    risk_level: str
    risk_score: int
    confidence: float
    category: str
    indicators: list[str]
    evidence: list[EvidenceItem]
    recommendations: list[str]
    explanation: str
    notes: list[str]
    pii_found: dict = {}


class ScanSummary(BaseModel):
    scan_id: str
    scan_type: str
    risk_level: str | None
    risk_score: int | None
    category: str | None
    created_at: str


class FeedbackRequest(BaseModel):
    useful: bool | None = None
    marked_wrong: bool | None = None
    note: str | None = Field(default=None, max_length=1000)
