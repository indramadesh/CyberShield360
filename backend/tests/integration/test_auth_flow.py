def test_register_login_me_refresh(client):
    email = "flow@example.com"
    password = "Str0ng!password"

    r = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["email"] == email

    # Duplicate registration is rejected with a structured error.
    dup = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert dup.status_code == 422
    assert dup.json()["success"] is False

    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    tokens = r.json()["data"]
    access, refresh = tokens["access_token"], tokens["refresh_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["data"]["email"] == email

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert "access_token" in r.json()["data"]

    # Rotated: the old refresh token must no longer work.
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 401


def test_login_wrong_password_is_generic_401(client):
    email = "wrongpw@example.com"
    client.post("/api/v1/auth/register", json={"email": email, "password": "Str0ng!password"})
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "nope-nope-nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_seeded_dev_admin_can_log_in(client):
    # Guards against seeding an admin whose email the login schema would reject
    # (e.g. a special-use `.local` domain). The seeded admin must be usable.
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@cybershield.dev", "password": "ChangeMe!Dev12345"},
    )
    assert r.status_code == 200, r.text
    access = r.json()["data"]["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.json()["data"]["role"] == "ADMIN"
