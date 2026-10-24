"""Shared enums used across DB models, schemas, and services."""
from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    USER = "USER"
    ANALYST = "ANALYST"
    ADMIN = "ADMIN"


class ScanType(str, Enum):
    URL = "URL"
    MESSAGE = "MESSAGE"
    EMAIL = "EMAIL"
    IMAGE = "IMAGE"
    QR = "QR"
    WEBSITE = "WEBSITE"


class ScanStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class RiskLevel(str, Enum):
    LOW = "LOW"
    SUSPICIOUS = "SUSPICIOUS"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Threat categories are seeded into a table (admin-configurable), but these are the
# initial defaults / canonical codes.
DEFAULT_THREAT_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("PHISHING", "Phishing"),
    ("SMISHING", "SMS phishing"),
    ("VISHING", "Voice phishing"),
    ("QR_FRAUD", "QR fraud"),
    ("UPI_FRAUD", "UPI fraud"),
    ("FAKE_KYC", "Fake KYC"),
    ("INVESTMENT_SCAM", "Investment scam"),
    ("JOB_SCAM", "Job scam"),
    ("DELIVERY_SCAM", "Delivery scam"),
    ("TECH_SUPPORT_SCAM", "Tech-support scam"),
    ("IMPERSONATION", "Impersonation"),
    ("MALWARE", "Malware"),
    ("CREDENTIAL_THEFT", "Credential theft"),
    ("ROMANCE_SCAM", "Romance scam"),
    ("ADVANCE_FEE_SCAM", "Advance-fee scam"),
    ("FAKE_SHOPPING", "Fake shopping"),
    ("OTHER", "Other"),
)
