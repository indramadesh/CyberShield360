"""Test fixtures. Configures an isolated SQLite DB + all-mock providers BEFORE
the app is imported, so the suite runs fully offline."""
from __future__ import annotations

import os
import tempfile

# --- Must be set before importing app modules (settings is cached at import) ---
_tmp_db = os.path.join(tempfile.gettempdir(), "cybershield_test.sqlite3")
if os.path.exists(_tmp_db):
    os.remove(_tmp_db)

os.environ.update(
    APP_ENV="testing",
    DEBUG="false",
    SECRET_KEY="test-secret-key-not-for-production",
    DATABASE_PROVIDER="sqlite",
    DATABASE_URL=f"sqlite:///{_tmp_db}",
    REDIS_ENABLED="false",
    MOCK_LLM="true",
    MOCK_THREAT_INTELLIGENCE="true",
    DEMO_MODE="true",
    OCR_PROVIDER="mock",
    QR_DECODER="mock",
    RATE_LIMIT_ENABLED="false",  # dedicated test enables it locally
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.db.session import init_db
    from app.main import app

    init_db()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def session(client):
    """A DB session over the same (initialized) test database as `client`."""
    from app.db.session import SessionLocal

    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture(autouse=True)
def _reset_caches():
    # Module-level caches: reset between tests for isolation.
    from app.core import ratelimit, runtime_config
    from app.services import threat_intel

    threat_intel.clear_cache()
    runtime_config._OVERRIDES.clear()  # noqa: SLF001
    ratelimit.clear()
    yield
    threat_intel.clear_cache()
    runtime_config._OVERRIDES.clear()  # noqa: SLF001
    ratelimit.clear()


@pytest.fixture
def registered_user(client):
    email = "user1@example.com"
    password = "Sup3rSecret!pw"
    client.post("/api/v1/auth/register", json={"email": email, "password": password})
    return {"email": email, "password": password}
