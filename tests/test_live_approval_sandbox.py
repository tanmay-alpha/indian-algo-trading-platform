"""tests/test_live_approval_sandbox.py

Phase 24A-AUDIT: Comprehensive hardening tests for the Manual Live Approval Sandbox.

Audit spec coverage (18 items):
  1.  Disabled status returns live_execution_enabled=False
  2.  Disabled validate returns status DISABLED
  3.  Enabled validate response includes validation_only=True
  4.  Enabled validate NEVER calls ExecutionRouter
  5.  Enabled validate NEVER calls LiveOrderManager
  6.  Enabled validate NEVER calls PaperOrderManager
  7.  Enabled validate NEVER calls broker place/cancel/modify
  8.  Active kill switch → REJECTED
  9.  Invalid side → REJECTED
  10. Invalid quantity → REJECTED
  11. Missing symbol → REJECTED
  12. Risk gate rejection persists rejection_reason
  13. Successful validation persists VALIDATED
  14. History returns newest first
  15. All endpoints require admin token
  16. No response leaks sensitive config/secrets
  17. LIVE mode does not make execution possible
  18. No route named approve-live or execute-live
"""

import os
import tempfile
import pytest
from unittest.mock import MagicMock, AsyncMock, patch, call
from fastapi.testclient import TestClient
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.config import settings
from backend.core.database import Base
from backend.db.models import LiveApprovalIntent
from backend.routers import live_approval_sandbox as live_approval_sandbox_router
from backend.core.security import get_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(name="db_engine")
def fixture_db_engine():
    """File-backed SQLite database per test run for thread safety."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    try:
        os.unlink(path)
    except Exception:
        pass


@pytest.fixture(name="db_session")
def fixture_db_session(db_engine):
    """Test database session for manual verification queries."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


class _MockKillSwitch:
    """Minimal mock kill switch for testing."""
    def __init__(self, active: bool = False):
        self.is_active = active


class _MockRouter:
    """Minimal mock execution router."""
    def __init__(self, kill_switch_active: bool = False):
        self.kill_switch = _MockKillSwitch(kill_switch_active)


class _MockOrchestrator:
    """Minimal mock orchestrator with controlled kill switch state."""
    def __init__(self, kill_switch_active: bool = False):
        self.router = _MockRouter(kill_switch_active)
        self.market_watch = None
        self.portfolio = None


@pytest.fixture(name="client")
def fixture_client(db_engine):
    """FastAPI TestClient with dependency overrides and a default orchestrator."""
    app = FastAPI()
    app.include_router(live_approval_sandbox_router.router)
    app.state.orchestrator = _MockOrchestrator(kill_switch_active=False)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


ADMIN_HEADERS = {"X-Admin-Token": "ci-test-admin-token-do-not-use-in-prod"}

_VALID_PAYLOAD = {
    "symbol": "RELIANCE",
    "side": "BUY",
    "quantity": 5,
    "product_type": "CNC",
    "order_type": "LIMIT",
    "price": 2500.0,
}


@pytest.fixture(autouse=True)
def isolate_admin_token():
    """Patch admin_token for test isolation."""
    original = settings.admin_token
    settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    yield
    settings.admin_token = original


# ---------------------------------------------------------------------------
# Helper: build a client with custom kill switch state
# ---------------------------------------------------------------------------

def _make_client_with_kill_switch(db_engine, active: bool):
    app = FastAPI()
    app.include_router(live_approval_sandbox_router.router)
    app.state.orchestrator = _MockOrchestrator(kill_switch_active=active)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Disabled status returns live_execution_enabled=False (audit item 1)
# ---------------------------------------------------------------------------

def test_status_disabled_returns_no_execution(client):
    settings.live_approval_sandbox_enabled = False
    resp = client.get("/live-approval/sandbox/status", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sandbox_enabled"] is False
    # Audit item 1
    assert data["live_execution_enabled"] is False
    assert data["validation_only"] is True
    assert data["broker_mutation_allowed"] is False
    assert data["mode"] == "VALIDATION_ONLY"


# ---------------------------------------------------------------------------
# 2. Disabled validate returns status DISABLED (audit item 2)
# ---------------------------------------------------------------------------

def test_validate_disabled_sandbox_returns_disabled(client, db_session):
    settings.live_approval_sandbox_enabled = False
    resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    # Audit item 2
    assert data["status"] == "DISABLED"
    assert data["rejection_reason"] == "live_approval_sandbox_disabled"
    # Persisted in DB
    db_intent = db_session.query(LiveApprovalIntent).filter_by(intent_id=data["intent_id"]).first()
    assert db_intent is not None
    assert db_intent.status == "DISABLED"


# ---------------------------------------------------------------------------
# 3. Enabled validate response includes validation_only=True (audit item 3)
# ---------------------------------------------------------------------------

def test_validate_enabled_includes_safety_markers(client):
    settings.live_approval_sandbox_enabled = True
    resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    # Audit item 3
    assert data["validation_only"] is True
    assert data["live_execution_enabled"] is False
    assert data["broker_mutation_allowed"] is False


# ---------------------------------------------------------------------------
# 4-7. Validate never calls ExecutionRouter, LiveOrderManager,
#       PaperOrderManager, or broker APIs (audit items 4-7)
# ---------------------------------------------------------------------------

def test_validate_never_calls_execution_router(client):
    """Audit item 4: ExecutionRouter must not be called."""
    settings.live_approval_sandbox_enabled = True
    with patch("backend.execution.execution_router.ExecutionRouter") as mock_router_cls:
        resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_router_cls.assert_not_called()


def test_validate_never_calls_live_order_manager(client):
    """Audit item 5: LiveOrderManager must not be called."""
    settings.live_approval_sandbox_enabled = True
    with patch("backend.execution.live_order_manager.LiveOrderManager") as mock_lom:
        resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_lom.assert_not_called()


def test_validate_never_calls_paper_order_manager(client):
    """Audit item 6: PaperOrderManager must not be called."""
    settings.live_approval_sandbox_enabled = True
    with patch("backend.execution.paper_order_manager.PaperOrderManager") as mock_pom:
        resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_pom.assert_not_called()


def test_validate_never_calls_broker_place_cancel_modify(client):
    """Audit item 7: SmartAPI placeOrder, cancelOrder, modifyOrder must not be called."""
    settings.live_approval_sandbox_enabled = True
    with patch("SmartApi.SmartConnect.placeOrder", create=True) as mock_place, \
         patch("SmartApi.SmartConnect.cancelOrder", create=True) as mock_cancel, \
         patch("SmartApi.SmartConnect.modifyOrder", create=True) as mock_modify:
        resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_place.assert_not_called()
        mock_cancel.assert_not_called()
        mock_modify.assert_not_called()


# ---------------------------------------------------------------------------
# 8. Active kill switch → REJECTED (audit item 8)
# ---------------------------------------------------------------------------

def test_validate_kill_switch_active_rejects(db_engine, db_session):
    """Audit item 8: Active kill switch must cause REJECTED, not just a warning."""
    settings.live_approval_sandbox_enabled = True
    client_ks = _make_client_with_kill_switch(db_engine, active=True)
    resp = client_ks.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "kill_switch_active" in data["rejection_reason"]
    # Persisted
    db_session.expire_all()
    db_intent = db_session.query(LiveApprovalIntent).filter_by(intent_id=data["intent_id"]).first()
    assert db_intent is not None
    assert db_intent.status == "REJECTED"


# ---------------------------------------------------------------------------
# 9. Invalid side → REJECTED (audit item 9)
# ---------------------------------------------------------------------------

def test_validate_invalid_side_rejects(client):
    """Audit item 9: Side other than BUY/SELL must be REJECTED."""
    settings.live_approval_sandbox_enabled = True
    payload = {**_VALID_PAYLOAD, "side": "HOLD"}
    resp = client.post("/live-approval/sandbox/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "invalid_action" in data["rejection_reason"]


# ---------------------------------------------------------------------------
# 10. Invalid quantity → REJECTED (audit item 10)
# ---------------------------------------------------------------------------

def test_validate_invalid_quantity_rejects(client):
    """Audit item 10: Non-positive quantity must be REJECTED."""
    settings.live_approval_sandbox_enabled = True
    payload = {**_VALID_PAYLOAD, "quantity": -1}
    resp = client.post("/live-approval/sandbox/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "invalid_quantity" in data["rejection_reason"]


# ---------------------------------------------------------------------------
# 11. Missing symbol → REJECTED (audit item 11)
# ---------------------------------------------------------------------------

def test_validate_missing_symbol_rejects(client):
    """Audit item 11: Empty symbol must be REJECTED."""
    settings.live_approval_sandbox_enabled = True
    payload = {**_VALID_PAYLOAD, "symbol": ""}
    resp = client.post("/live-approval/sandbox/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "missing_symbol" in data["rejection_reason"]


# ---------------------------------------------------------------------------
# 12. Risk gate rejection persists rejection_reason (audit item 12)
# ---------------------------------------------------------------------------

def test_risk_gate_rejection_persisted(client, db_session):
    """Audit item 12: When risk gate rejects, rejection_reason is stored in DB."""
    settings.live_approval_sandbox_enabled = True
    # Quantity 0 triggers invalid_quantity check
    payload = {**_VALID_PAYLOAD, "quantity": 0}
    resp = client.post("/live-approval/sandbox/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert data["rejection_reason"]
    db_session.expire_all()
    db_intent = db_session.query(LiveApprovalIntent).filter_by(intent_id=data["intent_id"]).first()
    assert db_intent is not None
    assert db_intent.rejection_reason


# ---------------------------------------------------------------------------
# 13. Successful validation persists VALIDATED (audit item 13)
# ---------------------------------------------------------------------------

def test_successful_validation_persists_validated(client, db_session):
    """Audit item 13: Valid intent with enabled sandbox persists VALIDATED status."""
    settings.live_approval_sandbox_enabled = True
    resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "VALIDATED"
    db_session.expire_all()
    db_intent = db_session.query(LiveApprovalIntent).filter_by(intent_id=data["intent_id"]).first()
    assert db_intent is not None
    assert db_intent.status == "VALIDATED"
    assert db_intent.rejection_reason is None


# ---------------------------------------------------------------------------
# 14. History returns newest first (audit item 14)
# ---------------------------------------------------------------------------

def test_intents_history_newest_first(client, db_session):
    """Audit item 14: GET /intents must return newest intents first."""
    settings.live_approval_sandbox_enabled = True
    # Create two intents sequentially
    resp1 = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    resp2 = client.post(
        "/live-approval/sandbox/validate",
        json={**_VALID_PAYLOAD, "symbol": "INFY"},
        headers=ADMIN_HEADERS
    )
    id1 = resp1.json()["intent_id"]
    id2 = resp2.json()["intent_id"]

    resp = client.get("/live-approval/sandbox/intents?limit=10", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    ids = [item["intent_id"] for item in data]
    # id2 was created after id1, must appear first
    assert ids.index(id2) < ids.index(id1)


# ---------------------------------------------------------------------------
# 15. All endpoints require admin token (audit item 15)
# ---------------------------------------------------------------------------

def test_all_endpoints_require_admin_token(client):
    """Audit item 15: Unauthenticated requests must be rejected with 403."""
    # GET /status
    assert client.get("/live-approval/sandbox/status").status_code == 403
    # POST /validate
    assert client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD).status_code == 403
    # GET /intents
    assert client.get("/live-approval/sandbox/intents").status_code == 403


# ---------------------------------------------------------------------------
# 16. No response leaks sensitive config/secrets (audit item 16)
# ---------------------------------------------------------------------------

_SENSITIVE_TERMS = {
    "password", "secret", "token", "api_key", "totp", "refresh",
    "feed_token", "auth_token", "database_url", "db_url", "admin_token",
    "jwt_secret", "passphrase",
}

def _check_no_secrets(data: dict) -> None:
    """Recursively verify dict contains no sensitive field names or values."""
    for key, value in data.items():
        assert key.lower() not in _SENSITIVE_TERMS, f"Sensitive key found in response: {key}"
        if isinstance(value, str):
            lower_val = value.lower()
            for term in _SENSITIVE_TERMS:
                assert term not in lower_val, f"Sensitive term '{term}' in response value: {value}"
        elif isinstance(value, dict):
            _check_no_secrets(value)


def test_status_response_no_secrets(client):
    """Audit item 16a: Status endpoint response contains no sensitive fields."""
    settings.live_approval_sandbox_enabled = True
    resp = client.get("/live-approval/sandbox/status", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    _check_no_secrets(resp.json())


def test_validate_response_no_secrets(client):
    """Audit item 16b: Validate endpoint response contains no sensitive fields."""
    settings.live_approval_sandbox_enabled = True
    resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    _check_no_secrets(resp.json())


def test_intents_response_no_secrets(client):
    """Audit item 16c: Intents history endpoint contains no sensitive fields."""
    settings.live_approval_sandbox_enabled = True
    client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    resp = client.get("/live-approval/sandbox/intents?limit=5", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    for item in resp.json():
        _check_no_secrets(item)


# ---------------------------------------------------------------------------
# 17. LIVE trading mode does not make execution possible (audit item 17)
# ---------------------------------------------------------------------------

def test_live_mode_does_not_enable_execution(client):
    """Audit item 17: Even with LIVE in the payload intent, execution is impossible.
    live_execution_enabled must always be False in the response.
    """
    settings.live_approval_sandbox_enabled = True
    resp = client.post("/live-approval/sandbox/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    # Even though service uses trading_mode='LIVE' internally for risk checks,
    # the API response must always declare execution disabled.
    assert data["live_execution_enabled"] is False
    assert data["broker_mutation_allowed"] is False
    # Status must be VALIDATED or REJECTED — never EXECUTED, PLACED, FILLED
    assert data["status"] in {"VALIDATED", "REJECTED", "DISABLED", "EXPIRED"}
    assert data["status"] not in {"EXECUTED", "APPROVED_LIVE", "PLACED", "FILLED", "LIVE_EXECUTED"}


# ---------------------------------------------------------------------------
# 18. No approve-live or execute-live routes exist (audit item 18)
# ---------------------------------------------------------------------------

def test_no_approve_live_or_execute_live_routes(client):
    """Audit item 18: No routes named approve-live or execute-live must exist."""
    all_routes = [route.path for route in client.app.routes if hasattr(route, "path")]
    for path in all_routes:
        assert "approve-live" not in path, f"Forbidden route found: {path}"
        assert "execute-live" not in path, f"Forbidden route found: {path}"
        assert "approve_live" not in path, f"Forbidden route found: {path}"
        assert "execute_live" not in path, f"Forbidden route found: {path}"


# ---------------------------------------------------------------------------
# Additional: Forbidden status values are never used
# ---------------------------------------------------------------------------

def test_forbidden_statuses_not_in_model():
    """Sanity check: LiveApprovalIntent status column must never contain forbidden values."""
    FORBIDDEN = {"EXECUTED", "APPROVED_LIVE", "PLACED", "FILLED", "LIVE_EXECUTED"}
    from backend.services.live_approval_sandbox_service import _ALLOWED_STATUSES
    assert FORBIDDEN.isdisjoint(_ALLOWED_STATUSES), (
        f"Forbidden statuses found in allowed set: {FORBIDDEN & _ALLOWED_STATUSES}"
    )


def test_safety_violation_raises_on_forbidden_status():
    """_safe_status() must raise ValueError for forbidden status values."""
    from backend.services.live_approval_sandbox_service import LiveApprovalSandboxService
    from unittest.mock import MagicMock

    service = LiveApprovalSandboxService(db=MagicMock(), settings=settings)
    for bad in ["EXECUTED", "APPROVED_LIVE", "PLACED", "FILLED"]:
        with pytest.raises(ValueError, match="SANDBOX SAFETY VIOLATION"):
            service._safe_status(bad)


# ---------------------------------------------------------------------------
# Additional: Enabled status returns live_execution_enabled=False
# ---------------------------------------------------------------------------

def test_status_enabled_still_no_execution(client):
    """Even when sandbox is enabled, live_execution_enabled must be False."""
    settings.live_approval_sandbox_enabled = True
    resp = client.get("/live-approval/sandbox/status", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sandbox_enabled"] is True
    assert data["live_execution_enabled"] is False
    assert data["validation_only"] is True
    assert data["broker_mutation_allowed"] is False
    assert data["mode"] == "VALIDATION_ONLY"
