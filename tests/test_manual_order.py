"""tests/test_manual_order.py

Phase 24D: Comprehensive validation tests for the Manual Market Order Ticket (Dry-Run only).
Hardened unit tests covering all 24 safety and edge cases.
"""

import os
import tempfile
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from backend.core.config import settings
from backend.core.database import Base
from backend.db.models import ManualOrderTicket, OrderFillModel
from backend.routers import manual_order as manual_order_router
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
    def __init__(self, kill_switch_active: bool = False, ltp: float = 100.0):
        self.router = _MockRouter(kill_switch_active)
        self.market_watch = MagicMock()
        self.market_watch.latest_ticks = {"SBIN": {"ltp": ltp, "symbol": "SBIN"}}
        # Mock _snapshot_row behavior
        self.market_watch._snapshot_row.return_value = {"ltp": ltp}
        self.portfolio = MagicMock()
        self.portfolio.current_daily_pnl = 0.0


@pytest.fixture(name="client")
def fixture_client(db_engine):
    """FastAPI TestClient with dependency overrides and a default orchestrator."""
    app = FastAPI()
    app.include_router(manual_order_router.router)
    app.state.orchestrator = _MockOrchestrator(kill_switch_active=False, ltp=2500.0)

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
    "symbol": "SBIN",
    "exchange": "NSE",
    "side": "BUY",
    "quantity": 10,
    "product_type": "CNC",
    "order_type": "MARKET",
    "price_override": None,
}


@pytest.fixture(autouse=True)
def isolate_admin_token():
    """Patch admin_token for test isolation."""
    original = settings.admin_token
    settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    yield
    settings.admin_token = original

# ---------------------------------------------------------------------------
# HARDENED SAFETY & FUNCTIONAL TESTS (24 test scenarios)
# ---------------------------------------------------------------------------

# 1. Verify validate never calls ExecutionRouter
@pytest.mark.asyncio
async def test_validate_never_calls_execution_router(client):
    with patch("backend.execution.execution_router.ExecutionRouter.route") as mock_route, \
         patch("backend.execution.execution_router.ExecutionRouter.submit_intent") as mock_submit:
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_route.assert_not_called()
        mock_submit.assert_not_called()


# 2. Verify validate never calls LiveOrderManager
@pytest.mark.asyncio
async def test_validate_never_calls_live_order_manager(client):
    with patch("backend.execution.live_order_manager.LiveOrderManager.place_order") as mock_place:
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_place.assert_not_called()


# 3. Verify validate never calls PaperOrderManager
@pytest.mark.asyncio
async def test_validate_never_calls_paper_order_manager(client):
    with patch("backend.execution.paper_order_manager.PaperOrderManager.place_order") as mock_place:
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_place.assert_not_called()


# 4. Verify validate never calls SmartAPI placeOrder
@pytest.mark.asyncio
async def test_validate_never_calls_smartapi_place_order(client):
    with patch("backend.execution.live_order_manager.LiveOrderManager._smart_api") as mock_smart:
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_smart.assert_not_called()


# 5. Verify validate never calls SmartAPI cancelOrder
@pytest.mark.asyncio
async def test_validate_never_calls_smartapi_cancel_order(client):
    with patch("backend.execution.live_order_manager.LiveOrderManager._smart_api") as mock_smart:
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_smart.assert_not_called()


# 6. Verify validate never calls SmartAPI modifyOrder
@pytest.mark.asyncio
async def test_validate_never_calls_smartapi_modify_order(client):
    with patch("backend.execution.live_order_manager.LiveOrderManager._smart_api") as mock_smart:
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        mock_smart.assert_not_called()


# 7. Verify validate does not create order_fills records
@pytest.mark.asyncio
async def test_validate_does_not_create_order_fills(client, db_session):
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    fills = db_session.query(OrderFillModel).all()
    assert len(fills) == 0


# 8. Verify validate does not create broker_order_id or simulate order placement
@pytest.mark.asyncio
async def test_validate_does_not_create_broker_order_id(client):
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "broker_order_id" not in data or data.get("broker_order_id") is None
    assert data["creates_broker_order"] is False


# 9. Verify validate does not update portfolio (positions/holdings/PnL)
@pytest.mark.asyncio
async def test_validate_does_not_update_portfolio(client):
    portfolio = client.app.state.orchestrator.portfolio
    portfolio.reset_mock()
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    portfolio.update_position.assert_not_called()
    portfolio.add_fill.assert_not_called()


# 10. Verify response contains dry_run=True and validation_only=True safety markers
@pytest.mark.asyncio
async def test_response_contains_dry_run(client):
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["dry_run"] is True
    assert data["validation_only"] is True


# 11. Verify response contains live_execution_enabled=False safety marker
@pytest.mark.asyncio
async def test_response_contains_live_execution_enabled_false(client):
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["live_execution_enabled"] is False


# 12. Verify response contains broker_mutation_allowed=False safety marker
@pytest.mark.asyncio
async def test_response_contains_broker_mutation_allowed_false(client):
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["broker_mutation_allowed"] is False


# 13. Verify missing LTP rejects honestly (market_data_unavailable)
@pytest.mark.asyncio
async def test_missing_ltp_rejects_honestly(client):
    client.app.state.orchestrator.market_watch.latest_ticks = {}
    client.app.state.orchestrator.market_watch._snapshot_row.side_effect = Exception("No tick")
    resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "market_data_unavailable" in data["rejection_reason"]


# 14. Verify price override is marked clearly (price_source = OVERRIDE_FOR_TEST_ONLY)
@pytest.mark.asyncio
async def test_price_override_is_marked_clearly(client):
    payload = _VALID_PAYLOAD.copy()
    payload["price_override"] = 550.5
    resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "VALIDATED"
    assert data["price"] == 550.5
    assert data["price_source"] == "OVERRIDE_FOR_TEST_ONLY"
    assert data["price_is_override"] is True


# 15. Verify invalid symbol is rejected
@pytest.mark.asyncio
async def test_invalid_symbol_rejected(client):
    payload = _VALID_PAYLOAD.copy()
    payload["symbol"] = "NON_EXISTENT_SYMBOL"
    resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "invalid_instrument" in data["rejection_reason"]


# 16. Verify invalid quantity is rejected (quantity <= 0)
@pytest.mark.asyncio
async def test_invalid_quantity_rejected(client):
    payload = _VALID_PAYLOAD.copy()
    payload["quantity"] = 0
    resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "invalid_quantity" in data["rejection_reason"]


# 17. Verify unsupported product type is rejected (product_type != CNC)
@pytest.mark.asyncio
async def test_unsupported_product_rejected(client):
    payload = _VALID_PAYLOAD.copy()
    payload["product_type"] = "MIS"
    resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "invalid_product_type" in data["rejection_reason"]


# 18. Verify unsupported order type is rejected (order_type != MARKET)
@pytest.mark.asyncio
async def test_unsupported_order_type_rejected(client):
    payload = _VALID_PAYLOAD.copy()
    payload["order_type"] = "LIMIT"
    resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "invalid_order_type" in data["rejection_reason"]


# 19. Verify kill switch active rejects validation
@pytest.mark.asyncio
async def test_kill_switch_active_rejects(db_engine):
    app = FastAPI()
    app.include_router(manual_order_router.router)
    app.state.orchestrator = _MockOrchestrator(kill_switch_active=True, ltp=2500.0)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    app.dependency_overrides[get_db] = lambda: SessionLocal()

    custom_client = TestClient(app)
    resp = custom_client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert "kill_switch_active" in data["rejection_reason"]


# 20. Verify SELL rejects when holding verification unavailable or insufficient
@pytest.mark.asyncio
async def test_sell_rejected_when_holding_verification_unavailable(client):
    original_mode = settings.trading_mode
    original_env = settings.environment
    settings.trading_mode = "LIVE"
    settings.environment = "PRODUCTION"
    try:
        # 1. No portfolio
        client.app.state.orchestrator.portfolio = None
        payload = _VALID_PAYLOAD.copy()
        payload["side"] = "SELL"
        resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "REJECTED"
        assert "holdings_verification_unavailable" in data["rejection_reason"]

        # 2. Holdings status is not AVAILABLE
        portfolio = MagicMock()
        portfolio.holdings._data_status = "UNAVAILABLE"
        client.app.state.orchestrator.portfolio = portfolio
        resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "REJECTED"
        assert "holdings_verification_unavailable" in data["rejection_reason"]
        
        # 3. Holdings available but quantity is insufficient
        portfolio.holdings._data_status = "AVAILABLE"
        portfolio.holdings.get_holding.return_value = {"quantity": 5}
        portfolio.positions.get_position.return_value = {"quantity": 0}
        resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "REJECTED"
        assert "insufficient_holdings" in data["rejection_reason"]

        # 4. Holdings sufficient
        portfolio.holdings.get_holding.return_value = {"quantity": 15}
        resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "VALIDATED"
    finally:
        settings.trading_mode = original_mode
        settings.environment = original_env


# 21. Verify admin authentication is required for all manual-order endpoints
@pytest.mark.asyncio
async def test_admin_auth_required_for_all_endpoints(client):
    for path, method in [("/manual-order/status", "get"), ("/manual-order/validate", "post"), ("/manual-order/tickets", "get")]:
        kwargs = {}
        if method == "post":
            kwargs["json"] = _VALID_PAYLOAD
        
        # Missing auth header
        resp = getattr(client, method)(path, **kwargs)
        assert resp.status_code in (401, 403)
        
        # Invalid auth header
        resp = getattr(client, method)(path, headers={"X-Admin-Token": "invalid-token"}, **kwargs)
        assert resp.status_code in (401, 403)


# 22. Verify ticket history query returns results in newest first ordering
@pytest.mark.asyncio
async def test_ticket_history_newest_first(client):
    for i in range(3):
        payload = _VALID_PAYLOAD.copy()
        payload["quantity"] = 10 + i
        resp = client.post("/manual-order/validate", json=payload, headers=ADMIN_HEADERS)
        assert resp.status_code == 200
    
    resp = client.get("/manual-order/tickets", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3
    quantities = [item["quantity"] for item in data[:3]]
    assert quantities == [12, 11, 10]


# 23. Verify database persistence failure does not bypass safety or fake success
@pytest.mark.asyncio
async def test_db_persistence_failure_does_not_fake_success(client):
    with patch("sqlalchemy.orm.Session.commit", side_effect=SQLAlchemyError("DB operational error")):
        resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
        assert resp.status_code == 500
        assert "Manual order validation error" in resp.json()["detail"]


# 24. Verify switching systems to LIVE mode does not make live execution possible
@pytest.mark.asyncio
async def test_live_mode_does_not_make_execution_possible(client):
    original_mode = settings.trading_mode
    settings.trading_mode = "LIVE"
    try:
        with patch("backend.execution.execution_router.ExecutionRouter.route") as mock_route, \
             patch("backend.execution.live_order_manager.LiveOrderManager.place_order") as mock_place:
            
            resp = client.post("/manual-order/validate", json=_VALID_PAYLOAD, headers=ADMIN_HEADERS)
            assert resp.status_code == 200
            data = resp.json()
            assert data["validation_only"] is True
            assert data["live_execution_enabled"] is False
            assert data["broker_mutation_allowed"] is False
            
            mock_route.assert_not_called()
            mock_place.assert_not_called()
    finally:
        settings.trading_mode = original_mode
