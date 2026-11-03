import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


@pytest.fixture
def site(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<title>home</title>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("js")
    (tmp_path.parent / "secret.txt").write_text("secret")
    monkeypatch.setattr(settings, "static_dir", str(tmp_path))
    return TestClient(create_app())


def test_serves_files_and_client_routes(site):
    assert "home" in site.get("/").text
    assert site.get("/assets/app.js").text == "js"
    assert "home" in site.get("/app/scan").text


def test_site_is_not_blocked_by_api_csp(site):
    assert "content-security-policy" not in site.get("/").headers
    assert "default-src 'none'" in site.get("/health").headers["content-security-policy"]


def test_unknown_api_path_is_404_not_the_site(site):
    assert site.get("/api/v1/nope").status_code == 404


def test_cannot_read_outside_site_folder(site):
    r = site.get("/%2e%2e/secret.txt")
    assert "secret" not in r.text


def test_apk_is_served_as_an_android_package(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("x")
    (tmp_path / "apps").mkdir()
    (tmp_path / "apps" / "app.apk").write_bytes(b"PK")
    monkeypatch.setattr(settings, "static_dir", str(tmp_path))
    r = TestClient(create_app()).get("/apps/app.apk")
    assert r.headers["content-type"] == "application/vnd.android.package-archive"


def test_plain_postgres_url_uses_psycopg(monkeypatch):
    monkeypatch.setattr(settings, "database_url", "postgresql://u:p@h/db?sslmode=require")
    assert settings.sqlalchemy_url == "postgresql+psycopg://u:p@h/db?sslmode=require"


def test_assets_are_cached_and_compressed(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<title>home</title>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app-abc.js").write_text("x" * 5000)
    monkeypatch.setattr(settings, "static_dir", str(tmp_path))
    c = TestClient(create_app())
    r = c.get("/assets/app-abc.js", headers={"accept-encoding": "gzip"})
    assert "immutable" in r.headers["cache-control"]
    assert r.headers["content-encoding"] == "gzip"
    assert c.get("/").headers["cache-control"] == "no-cache"  # new releases show at once
