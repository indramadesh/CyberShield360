"""Import all models so SQLAlchemy mappers + metadata are registered."""
from app.db.models.appconfig import AppConfig
from app.db.models.audit import AuditLog
from app.db.models.awareness import AwarenessContent, Challenge
from app.db.models.community import CommunityReport
from app.db.models.content import CyberLaw, NewsItem, OfficialOrg
from app.db.models.content_engine import (
    ContentSource, DailySelection, DailyTip, JobLock, LegalChangeCandidate, LegalDocumentVersion,
    LessonProgress, QuizAnswer, QuizAttempt, QuizQuestion, SourceFetchRun,
)
from app.db.models.feedback import ScanFeedback
from app.db.models.incident import Incident
from app.db.models.scan import Scan
from app.db.models.threat import ThreatCategory
from app.db.models.threat_intel import ThreatIntel
from app.db.models.user import RefreshToken, User

__all__ = [
    "User", "RefreshToken", "Scan", "ThreatCategory", "AuditLog", "ScanFeedback",
    "ThreatIntel", "AwarenessContent", "Challenge", "Incident", "NewsItem",
    "CyberLaw", "OfficialOrg", "CommunityReport", "AppConfig",
    "ContentSource", "SourceFetchRun", "LegalDocumentVersion", "LegalChangeCandidate",
    "QuizQuestion", "DailyTip", "DailySelection", "QuizAttempt", "QuizAnswer",
    "LessonProgress", "JobLock",
]
