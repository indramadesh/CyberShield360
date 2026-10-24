from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    h = hash_password("correct horse battery staple")
    assert h != "correct horse battery staple"
    assert verify_password("correct horse battery staple", h)
    assert not verify_password("wrong", h)


def test_access_token_roundtrip():
    token = create_access_token(subject="user-123", role="USER")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["role"] == "USER"
    assert payload["type"] == "access"
