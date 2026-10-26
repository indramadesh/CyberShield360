"""Centralized configuration.

All infrastructural choices are read from the environment (see `.env.example`).
Business logic must depend on this `settings` object and the provider registry,
never on hard-coded infrastructure.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# repo root = backend/ parent
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    app_name: str = "CyberShield 360"
    app_env: str = "development"  # development | testing | staging | production
    debug: bool = True
    secret_key: str = "dev-insecure-secret-change-me"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"

    # ---- Database ----
    database_provider: str = "sqlite"  # sqlite | postgresql | mysql
    database_url: str = ""

    # ---- Redis / tasks ----
    redis_enabled: bool = False
    redis_url: str = "redis://localhost:6379/0"
    task_backend: str = "eager"  # eager | celery

    # ---- Auth ----
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7
    password_min_length: int = 10

    # ---- Providers ----
    llm_provider: str = "mock"
    llm_model: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ocr_provider: str = "mock"
    qr_decoder: str = "auto"  # auto (opencv if available, else mock) | opencv | mock
    embedding_provider: str = "mock"
    threat_intel_provider: str = "hybrid"
    google_webrisk_api_key: str = ""
    phishtank_enabled: bool = False
    openphish_enabled: bool = False
    urlscan_api_key: str = ""
    intel_cache_ttl_seconds: int = 3600
    intel_persist_ttl_days: int = 7
    storage_provider: str = "local"
    storage_local_path: str = "./storage/local"
    s3_bucket: str = ""
    s3_region: str = ""

    # ---- Feature flags ----
    enable_url_scanner: bool = True
    enable_message_scanner: bool = True
    enable_email_scanner: bool = True
    enable_image_scanner: bool = True
    enable_qr_scanner: bool = True
    enable_website_scanner: bool = True
    enable_news: bool = True
    enable_cyber_law: bool = True
    enable_awareness: bool = True
    enable_incident_response: bool = True
    enable_browser_extension: bool = False
    enable_user_reports: bool = True
    enable_threat_campaigns: bool = False

    # ---- Privacy / limits ----
    store_raw_uploads: bool = False
    pii_redaction_enabled: bool = True
    max_file_size_mb: int = 10
    max_scan_time_seconds: int = 30
    data_retention_days: int = 90

    # ---- Rate limiting (per client IP, fixed 60s window) ----
    rate_limit_enabled: bool = True
    rate_limit_default_per_min: int = 120
    rate_limit_auth_per_min: int = 30
    rate_limit_expensive_per_min: int = 20  # uploads / website scans
    max_request_bytes: int = 15 * 1024 * 1024  # hard body cap (> max upload)

    # ---- Modes ----
    mock_threat_intelligence: bool = True
    mock_llm: bool = True
    demo_mode: bool = True

    # ---- Content-intelligence engine (no API keys required) ----
    # IANA timezone that defines "today" for the daily lesson/quiz/tip.
    content_timezone: str = "Asia/Kolkata"
    # Fetch public feeds at all (off = serve stored content only, e.g. offline tests).
    content_ingestion_enabled: bool = True
    # Run the scheduler inside the API process (dev convenience). Production runs
    # the dedicated worker: `python -m app.content.worker`.
    content_scheduler_embedded: bool = False
    content_user_agent: str = "CyberShield360-ContentBot/1.0 (+https://github.com/indramadesh/CyberShield360)"
    # A section is shown as stale when its last successful refresh is older than this.
    content_stale_hours: int = 12
    # Pause a source after this many consecutive failures (admin can resume).
    content_pause_after_failures: int = 20
    # Articles older than this are pruned (by source publication date, else ingestion date).
    content_retention_days: int = 365

    # ---- Risk thresholds (operator-tunable; not universal) ----
    risk_threshold_suspicious: int = 25
    risk_threshold_high: int = 50
    risk_threshold_critical: int = 75

    # ---- Derived ----
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Resolve the effective DB URL, providing a SQLite dev default."""
        if self.database_url:
            return self.database_url
        if self.database_provider == "sqlite":
            db_path = BACKEND_DIR / "cybershield.dev.sqlite3"
            return f"sqlite:///{db_path.as_posix()}"
        raise RuntimeError(
            f"DATABASE_URL is required for provider '{self.database_provider}'"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
