from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import backend.api_server as api
from backend.core.config import settings
from backend.core.security import require_admin_token, sanitize_response


def test_sanitize_response_redacts_token():
    assert sanitize_response({"auth_token": "abc123"})["auth_token"] == "***REDACTED***"


def test_sanitize_response_preserves_safe():
    payload = {"ltp": 750.5, "symbol": "SBIN"}
    assert sanitize_response(payload) == payload


def test_sanitize_response_nested():
    data = sanitize_response({"broker": {"feed_token": "xyz"}})
    assert data["broker"]["feed_token"] == "***REDACTED***"


def test_sanitize_response_list():
    data = sanitize_response([{"token": "abc"}, {"price": 100}])
    assert data[0]["token"] == "***REDACTED***"
    assert data[1]["price"] == 100


@pytest.mark.asyncio
async def test_require_admin_token_passes_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "admin_token", "")
    await require_admin_token()


@pytest.mark.asyncio
async def test_require_admin_token_passes_with_correct_header(monkeypatch):
    monkeypatch.setattr(settings, "admin_token", "test123")
    await require_admin_token(x_admin_token="test123")


@pytest.mark.asyncio
async def test_require_admin_token_fails_with_wrong_header(monkeypatch):
    monkeypatch.setattr(settings, "admin_token", "test123")
    with pytest.raises(HTTPException) as exc_info:
        await require_admin_token(x_admin_token="wrong")
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_token_fails_with_no_header(monkeypatch):
    monkeypatch.setattr(settings, "admin_token", "test123")
    with pytest.raises(HTTPException) as exc_info:
        await require_admin_token()
    assert exc_info.value.status_code == 403


def test_health_no_credentials_in_response():
    client = TestClient(api.app)
    response = client.get("/health")
    assert response.status_code == 200
    _assert_no_sensitive_string_values(response.json())


def test_gitignore_has_env():
    contents = Path(".gitignore").read_text(encoding="utf-8")
    assert ".env" in contents


def test_env_example_no_real_values():
    for raw_line in Path(".env.example").read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        _, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        assert len(value) <= 40 or value.startswith("your_")


def test_cors_not_wildcard():
    contents = Path("backend/api_server.py").read_text(encoding="utf-8").replace(" ", "")
    assert "allow_origins=['*']" not in contents
    assert 'allow_origins=["*"]' not in contents


def _assert_no_sensitive_string_values(value):
    if isinstance(value, dict):
        for key, item in value.items():
            key_text = str(key).lower()
            if _is_sensitive_key(key_text) and isinstance(item, str):
                assert item == "***REDACTED***"
            else:
                _assert_no_sensitive_string_values(item)
    elif isinstance(value, list):
        for item in value:
            _assert_no_sensitive_string_values(item)


def _is_sensitive_key(key: str) -> bool:
    return any(
        marker in key
        for marker in ("token", "secret", "password", "key", "totp", "jwt", "auth", "credential")
    )
