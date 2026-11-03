"""The one normalised shape every source is converted into before analysis."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

SOURCE_TYPES = ("email", "notification", "sms", "shared_text")
COMPLETENESS = ("full", "partial", "preview", "metadata")


@dataclass
class Sender:
    display_name: str = ""
    email: str = ""
    domain: str = ""
    raw_from: str = ""  # the From header as received (email only)


@dataclass
class NormalizedMessage:
    source_type: str  # one of SOURCE_TYPES
    source_provider: str  # gmail|outlook|android|extension|ios|manual
    source_application: str = ""  # e.g. com.whatsapp, gmail
    external_id: str = ""  # provider id — untrusted, used only for dedupe
    received_at: dt.datetime | None = None
    sender: Sender = field(default_factory=Sender)
    subject: str = ""
    text: str = ""
    # Lower-cased header name -> values, topmost first. Only from provider APIs.
    headers: dict[str, list[str]] = field(default_factory=dict)
    reply_to: str = ""
    urls: list[str] = field(default_factory=list)  # links found in HTML (hrefs) by the collector
    attachments: list[dict] = field(default_factory=list)  # {"filename", "mime_type", "size"}
    completeness: str = "full"  # notification text is "partial" or "preview"
    collection_method: str = "oauth"  # oauth|notification_listener|share|context_menu|manual
