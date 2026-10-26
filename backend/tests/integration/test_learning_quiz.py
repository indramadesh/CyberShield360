"""Daily learning engine, quiz grading, progress and the content API — offline."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select

from app.content import learning
from app.db.models.awareness import AwarenessContent
from app.db.models.content_engine import DailySelection, QuizQuestion


def _auth(client, email=None):
    email = email or f"learner-{uuid.uuid4().hex[:6]}@example.com"
    pw = "Str0ng!password"
    client.post("/api/v1/auth/register", json={"email": email, "password": pw})
    tok = client.post("/api/v1/auth/login", json={"email": email, "password": pw}).json()["data"]
    return {"Authorization": f"Bearer {tok['access_token']}"}


def _admin(client):
    from app.db.models.user import User
    from app.db.session import SessionLocal

    h = _auth(client)
    with SessionLocal() as s:
        me = client.get("/api/v1/auth/me", headers=h).json()["data"]
        s.get(User, me["id"]).role = "ADMIN"
        s.commit()
    return h


# ---------------- Selection engine ----------------

def test_daily_lesson_is_persisted_and_stable(session):
    day = dt.date(2031, 1, 5)
    first, sel = learning.daily_lesson(session, day)
    again, sel2 = learning.daily_lesson(session, day)
    assert first.slug == again.slug and sel.id == sel2.id
    assert session.scalars(select(DailySelection).where(DailySelection.kind == "lesson",
                                                        DailySelection.period == day.isoformat())).one()


def test_lesson_rotation_avoids_repeats_and_same_topic_back_to_back(session):
    start = dt.date(2032, 3, 1)
    picks = [learning.daily_lesson(session, start + dt.timedelta(days=i))[0] for i in range(10)]
    slugs = [p.slug for p in picks]
    assert len(set(slugs)) == 10  # no repeats while the library lasts
    assert all(picks[i].category != picks[i + 1].category for i in range(9))


def test_daily_quiz_unique_persisted_and_mixed(session):
    day = dt.date(2033, 7, 7)
    sel = learning.daily_quiz(session, day)
    assert len(sel.refs) == learning.DAILY_QUIZ_SIZE == len(set(sel.refs))
    assert learning.daily_quiz(session, day).refs == sel.refs  # refresh never changes it
    qs = session.scalars(select(QuizQuestion).where(QuizQuestion.slug.in_(sel.refs))).all()
    assert len({q.category for q in qs}) >= 4  # spread across topics
    nxt = learning.daily_quiz(session, day + dt.timedelta(days=1))
    assert not set(nxt.refs) & set(sel.refs)  # cooldown: no repeats the next day


def test_only_published_reviewed_content_is_selected(session):
    draft = QuizQuestion(slug=f"draft-{uuid.uuid4().hex[:6]}", qtype="single", prompt="Draft?", options=["a", "b"],
                         answer_index=0, category="phishing", review_status="draft", status="published")
    session.add(draft)
    session.add(AwarenessContent(slug=f"draft-lesson-{uuid.uuid4().hex[:6]}", category="phishing",
                                 title="Draft", status="draft"))
    session.commit()
    for i in range(20):
        day = dt.date(2034, 1, 1) + dt.timedelta(days=i)
        assert draft.slug not in learning.daily_quiz(session, day).refs
        assert learning.daily_lesson(session, day)[0].status == "published"


def test_today_uses_configured_timezone(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "content_timezone", "Asia/Kolkata")
    late_utc = dt.datetime(2026, 10, 26, 20, 0, tzinfo=dt.timezone.utc)  # 01:30 on the 27th in India
    assert learning.today(late_utc) == dt.date(2026, 10, 27)
    monkeypatch.setattr(settings, "content_timezone", "UTC")
    assert learning.today(late_utc) == dt.date(2026, 10, 26)
    monkeypatch.setattr(settings, "content_timezone", "Not/AZone")
    assert learning.today(late_utc) == dt.date(2026, 10, 26)  # safe fallback to UTC


# ---------------- Quiz API ----------------

def test_daily_quiz_hides_answers_and_grades_server_side(client):
    data = client.get("/api/v1/quiz/daily").json()["data"]
    assert data["available"] and len(data["questions"]) == 5
    assert all("answer_index" not in q and "explanation" not in q for q in data["questions"])
    answers = {q["id"]: 0 for q in data["questions"]}
    # A forged score in the request body is ignored — only answers are read.
    r = client.post("/api/v1/quiz/daily", json={"answers": answers, "score": 999}).json()["data"]
    assert r["total"] == 5 and 0 <= r["score"] <= 5 and r["recorded"] is False  # guest: graded, not stored
    assert all("explanation" in x and "answer_index" in x for x in r["results"])


def test_daily_quiz_one_attempt_per_user(client):
    h = _auth(client)
    qs = client.get("/api/v1/quiz/daily", headers=h).json()["data"]["questions"]
    first = client.post("/api/v1/quiz/daily", headers=h, json={"answers": {q["id"]: 0 for q in qs}}).json()["data"]
    assert first["recorded"] is True
    second = client.post("/api/v1/quiz/daily", headers=h, json={"answers": {q["id"]: 1 for q in qs}}).json()["data"]
    assert second["already_submitted"] is True and second["score"] == first["score"]
    status = client.get("/api/v1/quiz/daily", headers=h).json()["data"]
    assert status["attempt"]["score"] == first["score"]


def test_answers_for_questions_outside_the_quiz_are_ignored(client):
    data = client.get("/api/v1/quiz/daily").json()["data"]
    r = client.post("/api/v1/quiz/daily", json={"answers": {"some-other-question": 0}}).json()["data"]
    assert r["score"] == 0 and r["total"] == len(data["questions"])


def test_weekly_and_practice_and_categories(client):
    wk = client.get("/api/v1/quiz/weekly").json()["data"]
    assert wk["available"] and len(wk["questions"]) == learning.WEEKLY_SIZE and "-W" in wk["period"]
    pr = client.get("/api/v1/quiz/practice?category=phishing&limit=3").json()["data"]
    assert len(pr["questions"]) == 3 and all(q["category"] == "phishing" for q in pr["questions"])
    ids = [q["id"] for q in pr["questions"]]
    graded = client.post("/api/v1/quiz/practice", json={"ids": ids, "answers": {ids[0]: 0}}).json()["data"]
    assert graded["total"] == 3
    few = client.get("/api/v1/quiz/practice?category=cloud&difficulty=advanced&limit=5").json()["data"]
    assert few["note"]  # insufficient questions are reported, not invented
    cats = client.get("/api/v1/quiz/categories").json()["data"]
    assert any(c["category"] == "phishing" and c["total"] >= 5 for c in cats)


def test_lesson_quiz_without_answers_and_completion(client):
    h = _auth(client)
    lesson = client.get("/api/v1/awareness/upi-safety").json()["data"]
    assert lesson["quiz"] and all("answer_index" not in q for q in lesson["quiz"])
    assert lesson["warning_signs"] and lesson["prevention"] and lesson["difficulty"]
    answers = {q["id"]: 1 for q in lesson["quiz"]}
    r = client.post("/api/v1/awareness/upi-safety/quiz", headers=h, json={"answers": answers}).json()["data"]
    assert r["total"] == len(lesson["quiz"])
    prog = client.get("/api/v1/learn/progress", headers=h).json()["data"]
    assert "upi-safety" in prog["completed_slugs"] and prog["quiz_attempts"] >= 1


def test_daily_challenge_no_answer_then_graded(client):
    c = client.get("/api/v1/challenges/daily").json()["data"]
    assert "options" in c and "answer_index" not in c
    r = client.post("/api/v1/challenges/daily", json={"choice": 0}).json()["data"]
    assert r["total"] == 1 and "explanation" in r["results"][0]


def test_progress_is_per_user_and_requires_auth(client):
    a, b = _auth(client), _auth(client)
    client.post("/api/v1/learn/progress/phishing-basics", headers=a, json={"completed": True})
    pa = client.get("/api/v1/learn/progress", headers=a).json()["data"]
    pb = client.get("/api/v1/learn/progress", headers=b).json()["data"]
    assert "phishing-basics" in pa["completed_slugs"] and "phishing-basics" not in pb["completed_slugs"]
    assert pa["streak_days"] >= 1
    assert client.get("/api/v1/learn/progress").status_code == 401
    assert client.post("/api/v1/learn/progress/nope", headers=a, json={}).status_code == 404


def test_review_incorrect_and_recommendations(client):
    h = _auth(client)
    pr = client.get("/api/v1/quiz/practice?category=qr&limit=4").json()["data"]["questions"]
    ids = [q["id"] for q in pr]
    # Pick a wrong option for every question (any index that isn't correct): grade twice to learn the keys.
    first = client.post("/api/v1/quiz/practice", headers=h, json={"ids": ids, "answers": {i: 0 for i in ids}}).json()["data"]
    wrong = {r["id"]: (r["answer_index"] + 1) % 2 for r in first["results"]}
    client.post("/api/v1/quiz/practice", headers=h, json={"ids": ids, "answers": wrong})
    review = client.get("/api/v1/quiz/review", headers=h).json()["data"]
    assert review and all("explanation" in q for q in review)
    prog = client.get("/api/v1/learn/progress", headers=h).json()["data"]
    assert any(p["category"] == "qr" for p in prog["proficiency"])


# ---------------- Learning / content API ----------------

def test_learn_daily_and_tips(client):
    d = client.get("/api/v1/learn/daily").json()["data"]
    assert d["lesson"]["objective"] and d["tip"]["recommendation"]
    assert client.get("/api/v1/learn/daily").json()["data"]["lesson"]["slug"] == d["lesson"]["slug"]
    tips = client.get("/api/v1/learn/tips").json()["data"]
    assert tips and tips[0]["date"]
    assert client.get("/api/v1/learn/categories").json()["data"]


def test_updates_api_filters_pagination_and_freshness(client, session):
    from app.db.models.content import NewsItem

    tag = uuid.uuid4().hex[:8]
    now = dt.datetime.now(dt.timezone.utc)
    for i in range(3):
        session.add(NewsItem(title=f"{tag} ransomware advisory {i}", summary="s", source="Test", source_url=f"https://x.example.org/{tag}/{i}",
                             canonical_url=f"https://x.example.org/{tag}/{i}", status="published", kind="advisory",
                             category="ransomware", severity="high", severity_origin="source", source_key="test-api",
                             published_at=now - dt.timedelta(hours=i)))
    session.add(NewsItem(title=f"{tag} withheld item", source_url="https://x.example.org/w", status="withheld", kind="news"))
    session.commit()
    r = client.get(f"/api/v1/updates?q={tag}&page_size=2").json()["data"]
    assert r["total"] == 3 and len(r["items"]) == 2 and r["has_more"] is True
    assert r["items"][0]["published_at"] > r["items"][1]["published_at"]  # newest by SOURCE date first
    assert "freshness" in r and r["freshness"]["state"] in ("fresh", "partial", "stale", "never_refreshed", "no_sources")
    assert client.get(f"/api/v1/updates?q={tag}&kind=advisory&page=2&page_size=2").json()["data"]["items"]
    assert client.get(f"/api/v1/updates?q={tag}&kind=bogus").status_code == 422
    today = client.get("/api/v1/updates/today").json()["data"]
    assert "fallback" in today and "critical" in today
    assert client.get("/api/v1/updates/sources").json()["data"]
    st = client.get("/api/v1/content/status").json()["data"]
    assert {s["section"] for s in st["sections"]} == {"news", "advisories", "legal"}


def test_legal_api_statuses_and_versions(client):
    d = client.get("/api/v1/legal").json()["data"]
    slugs = {l["slug"]: l for l in d["items"]}
    assert slugs["dpdp-act-2023"]["legal_status_label"] == "Enacted legislation"
    assert slugs["dpdp-act-2023"]["effective_date"] is None
    assert "not legal advice" in d["notice"]
    detail = client.get("/api/v1/legal/it-act-2000").json()["data"]
    assert detail["effective_date"] == "2000-10-17" and "versions" in detail
    assert client.get("/api/v1/legal/does-not-exist").status_code == 404


def test_admin_content_ops_require_admin(client, monkeypatch):
    user = _auth(client)
    for method, path in [("get", "/api/v1/admin/content/sources"), ("get", "/api/v1/admin/content/runs"),
                         ("get", "/api/v1/admin/content/scheduler"), ("patch", "/api/v1/admin/content/sources/cisa-kev")]:
        kwargs = {"json": {"enabled": False}} if method == "patch" else {}
        assert getattr(client, method)(path, headers=user, **kwargs).status_code == 403
        assert getattr(client, method)(path, **kwargs).status_code == 401

    admin = _admin(client)
    srcs = client.get("/api/v1/admin/content/sources", headers=admin).json()["data"]
    assert any(s["key"] == "certin-home" for s in srcs["sources"]) and srcs["not_enabled"]
    r = client.patch("/api/v1/admin/content/sources/sans-isc", headers=admin, json={"enabled": False}).json()["data"]
    assert r["enabled"] is False
    client.patch("/api/v1/admin/content/sources/sans-isc", headers=admin, json={"enabled": True, "resume": True})

    from app.content.http import FetchError

    def offline(url, **kw):
        raise FetchError("connect", "offline test")
    monkeypatch.setattr("app.content.ingest.fetch", offline)
    run = client.post("/api/v1/admin/content/sources/sans-isc/run", headers=admin).json()["data"]
    assert run["status"] == "error" and run["source"]["consecutive_failures"] >= 1
    runs = client.get("/api/v1/admin/content/runs?source=sans-isc", headers=admin).json()["data"]
    assert runs and runs[0]["trigger"] == "manual"
    sched = client.get("/api/v1/admin/content/scheduler", headers=admin).json()["data"]
    assert {j["job"] for j in sched["jobs"]} >= {"ingest_feeds", "daily_selection"}
    out = client.post("/api/v1/admin/content/scheduler/run", headers=admin, json={"job": "daily_selection"}).json()["data"]
    assert [o["job"] for o in out] == ["daily_selection"]
    assert client.post("/api/v1/admin/content/scheduler/run", headers=admin, json={"job": "rm -rf"}).status_code == 422
