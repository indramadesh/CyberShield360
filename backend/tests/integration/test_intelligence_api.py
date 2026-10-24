def test_news_feed(client):
    r = client.get("/api/v1/news")
    assert r.status_code == 200
    assert isinstance(r.json()["data"], list)
    assert len(r.json()["data"]) >= 1


def test_laws_tracker(client):
    r = client.get("/api/v1/laws")
    assert r.status_code == 200
    titles = [x["title"] for x in r.json()["data"]]
    assert any("Information Technology Act" in t for t in titles)
