from pathlib import Path

from app.content.http import FetchResult

FX = Path(__file__).resolve().parents[1] / "fixtures" / "feeds"


def test_news_feed(client, session):
    """/news serves articles collected by the engine (no demo items are seeded)."""
    from app.content import ingest
    from app.db.models.content_engine import ContentSource

    src = ContentSource(key="test-news-feed", name="Test feed", fmt="atom", category="news",
                        feed_url="https://news-feed.example.org/atom.xml", base_url="https://news-feed.example.org/")
    session.add(src)
    session.commit()
    body = (FX / "atom.xml").read_bytes().replace(b"atom.example.org", b"news-feed.example.org")
    ingest.run_source(session, src, fetcher=lambda url, **kw: FetchResult(200, body, final_url=url))

    r = client.get("/api/v1/news")
    assert r.status_code == 200
    data = r.json()["data"]
    assert isinstance(data, list) and len(data) >= 1
    item = next(i for i in data if i["source_key"] == "test-news-feed")
    assert item["source_url"].startswith("https://news-feed.example.org/")
    assert "published_at" in item and "ingested_at" in item


def test_laws_tracker(client):
    r = client.get("/api/v1/laws")
    assert r.status_code == 200
    titles = [x["title"] for x in r.json()["data"]]
    assert any("Information Technology Act" in t for t in titles)
