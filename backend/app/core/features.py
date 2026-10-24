"""Single source of truth for feature flags.

Backend routes guard on these; the frontend fetches them from `/api/v1/config`
and hides disabled modules so there are never broken buttons.
"""
from __future__ import annotations

from app.core.config import settings

# Stable feature keys used by both backend guards and the frontend.
FEATURE_KEYS = (
    "url_scanner",
    "message_scanner",
    "email_scanner",
    "image_scanner",
    "qr_scanner",
    "website_scanner",
    "threat_intelligence",
    "cyber_news",
    "cyber_law",
    "awareness",
    "incident_response",
    "community_reports",
    "campaign_detection",
)


def current_flags() -> dict[str, bool]:
    """Resolve flags from settings, then apply admin runtime overrides on top."""
    from app.core import runtime_config

    base = {
        "url_scanner": settings.enable_url_scanner,
        "message_scanner": settings.enable_message_scanner,
        "email_scanner": settings.enable_email_scanner,
        "image_scanner": settings.enable_image_scanner,
        "qr_scanner": settings.enable_qr_scanner,
        "website_scanner": settings.enable_website_scanner,
        "threat_intelligence": True,  # always-on internal layer
        "cyber_news": settings.enable_news,
        "cyber_law": settings.enable_cyber_law,
        "awareness": settings.enable_awareness,
        "incident_response": settings.enable_incident_response,
        "community_reports": settings.enable_user_reports,
        "campaign_detection": settings.enable_threat_campaigns,
    }
    overrides = runtime_config.feature_overrides()
    for key, value in overrides.items():
        if key in base and isinstance(value, bool):
            base[key] = value
    return base


def is_enabled(feature: str) -> bool:
    return current_flags().get(feature, False)
