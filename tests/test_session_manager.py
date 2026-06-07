from unittest.mock import AsyncMock, Mock

import pytest
from loguru import logger

from backend.core import session_manager as sm
from backend.core.session_manager import SessionManager


@pytest.fixture(autouse=True)
def fake_settings(monkeypatch):
    monkeypatch.setattr(sm.settings, "angel_api_key", "fake-api-key")
    monkeypatch.setattr(sm.settings, "angel_client_code", "fake-client-code")
    monkeypatch.setattr(sm.settings, "angel_password", "fake-password")
    monkeypatch.setattr(sm.settings, "angel_totp_secret", "fake-totp-secret")


@pytest.fixture
def captured_logs():
    records = []
    sink_id = logger.add(lambda message: records.append(str(message)), format="{message}")
    try:
        yield records
    finally:
        logger.remove(sink_id)


@pytest.mark.asyncio
async def test_successful_login(monkeypatch, captured_logs):
    smart = Mock()
    smart.generateSession.return_value = {
        "status": True,
        "data": {
            "jwtToken": "fake-jwt-token",
            "refreshToken": "fake-refresh-token",
        },
    }
    smart.getfeedToken.return_value = "fake-feed-token"
    monkeypatch.setattr(sm, "SmartConnect", Mock(return_value=smart))
    monkeypatch.setattr(sm.pyotp, "TOTP", Mock(return_value=Mock(now=Mock(return_value="123456"))))

    manager = SessionManager()

    assert await manager.initialize() is True
    assert manager.is_valid is True
    assert manager.auth_token == "fake-jwt-token"
    assert manager.feed_token == "fake-feed-token"
    assert "fake-jwt-token" not in "\n".join(captured_logs)
    assert "fake-feed-token" not in "\n".join(captured_logs)


@pytest.mark.asyncio
async def test_failed_login_logs_without_credentials(monkeypatch, captured_logs):
    smart = Mock()
    smart.generateSession.return_value = {
        "status": False,
        "message": "Authentication failed",
    }
    monkeypatch.setattr(sm, "SmartConnect", Mock(return_value=smart))
    monkeypatch.setattr(sm.pyotp, "TOTP", Mock(return_value=Mock(now=Mock(return_value="123456"))))

    manager = SessionManager()

    assert await manager.initialize() is False
    assert manager.is_valid is False
    joined_logs = "\n".join(captured_logs)
    assert "fake-api-key" not in joined_logs
    assert "fake-client-code" not in joined_logs
    assert "fake-password" not in joined_logs
    assert "fake-totp-secret" not in joined_logs


def test_clock_drift_within_tolerance(monkeypatch):
    client = Mock()
    client.request.return_value = Mock(offset=5)
    monkeypatch.setattr(sm.ntplib, "NTPClient", Mock(return_value=client))

    assert SessionManager().check_clock_drift() == 5


def test_clock_drift_warning_threshold(monkeypatch):
    client = Mock()
    client.request.return_value = Mock(offset=15)
    monkeypatch.setattr(sm.ntplib, "NTPClient", Mock(return_value=client))

    assert SessionManager().check_clock_drift() == 15


def test_clock_drift_too_large(monkeypatch):
    client = Mock()
    client.request.return_value = Mock(offset=45)
    monkeypatch.setattr(sm.ntplib, "NTPClient", Mock(return_value=client))

    with pytest.raises(RuntimeError):
        SessionManager().check_clock_drift()


@pytest.mark.asyncio
async def test_refresh_success():
    manager = SessionManager()
    manager._smart_api = Mock()
    manager._refresh_token = "old-refresh-token"
    manager._smart_api.generateToken.return_value = {
        "status": True,
        "data": {
            "jwtToken": "new-jwt-token",
            "refreshToken": "new-refresh-token",
            "feedToken": "new-feed-token",
        },
    }

    assert await manager.refresh() is True
    assert manager.is_valid is True
    assert manager.auth_token == "new-jwt-token"


@pytest.mark.asyncio
async def test_refresh_failure_triggers_relogin(monkeypatch):
    manager = SessionManager()
    manager._smart_api = Mock()
    manager._refresh_token = "old-refresh-token"
    manager._smart_api.generateToken.return_value = {"status": False, "message": "expired"}

    async def initialize_success():
        manager._session_valid = True
        return True

    initialize = AsyncMock(side_effect=initialize_success)
    monkeypatch.setattr(manager, "initialize", initialize)

    assert await manager.refresh() is True
    assert manager.is_valid is True
    initialize.assert_awaited_once()



