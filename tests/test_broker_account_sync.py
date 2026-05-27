# tests/test_broker_account_sync.py
"""
Tests for BrokerAccountSyncService — Phase 22A

ABSOLUTE SAFETY: All tests use mocks. Zero real broker API calls.
No live orders placed. No credentials printed.

Required coverage (12 items from spec):
1.  import safe / no broker login at module load
2.  missing session → BROKER_SESSION_UNAVAILABLE
3.  holdings normalization from mocked response
4.  positions normalization from mocked response
5.  funds normalization from mocked response
6.  orders normalization from mocked response
7.  trades normalization from mocked response
8.  snapshot combines all read-only sections
9.  routes require admin token where expected (using mocked settings)
10. service never calls placeOrder / cancel / modify
11. sanitizer removes token-like fields
12. backend import safe

Run: pytest tests/test_broker_account_sync.py -v
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

from backend.services.broker_account_sync import (
    BrokerAccountSyncService,
    _normalize_holding,
    _normalize_position,
    _normalize_funds,
    _normalize_order,
    _normalize_trade,
    _sanitize_record,
)
from backend.routers.broker_account import router as broker_account_router


# =====================================================================
# Mock factories
# =====================================================================

def _make_mock_smart_api():
    """Mock SmartConnect with realistic read-only response data."""
    mock = MagicMock(spec_set=[
        "holding", "position", "rmsLimit", "orderBook", "tradeBook",
    ])
    mock.holding.return_value = {
        "status": True,
        "data": [
            {
                "tradingsymbol": "INFY",
                "isin": "INE009A01021",
                "quantity": 10,
                "averageprice": 1500.0,
                "ltp": 1550.0,
                "realisedquantity": 10,
                "product": "CNC",
                "exchange": "NSE",
                # Should be stripped by sanitizer
                "jwtToken": "should-be-gone",
            }
        ],
    }
    mock.position.return_value = {
        "status": True,
        "data": [
            {
                "tradingsymbol": "NIFTY23NOVFUT",
                "product": "NRML",
                "exchange": "NFO",
                "netqty": 50,
                "averageprice": 19500.0,
                "ltp": 19600.0,
                "unrealisedpnl": 5000.0,
                "realisedpnl": 0.0,
            }
        ],
    }
    mock.rmsLimit.return_value = {
        "status": True,
        "data": {
            "availablecash": 100000.0,
            "net": 100000.0,
            "utiliseddebits": 5000.0,
            "availableintradaypayin": 200000.0,
            "collateral": 0.0,
            "m2mrealized": 250.0,
            "m2munrealized": 500.0,
        },
    }
    mock.orderBook.return_value = {
        "status": True,
        "data": [
            {
                "orderid": "ORDER-12345678",
                "tradingsymbol": "TCS",
                "transactiontype": "BUY",
                "quantity": 5,
                "price": 3500.0,
                "status": "COMPLETE",
                "product": "CNC",
                "exchange": "NSE",
                "ordertype": "LIMIT",
                "updatetime": "14:30:00",
            }
        ],
    }
    mock.tradeBook.return_value = {
        "status": True,
        "data": [
            {
                "tradeid": "TRADE-987654321",
                "tradingsymbol": "RELIANCE",
                "transactiontype": "SELL",
                "quantity": 10,
                "tradeprice": 2400.0,
                "product": "MIS",
                "exchange": "NSE",
                "updatetime": "14:45:00",
            }
        ],
    }
    return mock


def _make_valid_session_manager():
    sm = MagicMock()
    sm.is_valid = True
    sm.smart_api = _make_mock_smart_api()
    sm.status = {
        "is_valid": True,
        "auth_token_available": True,
        "feed_token_available": True,
        "last_error": None,
        "last_refresh": None,
    }
    return sm


def _make_invalid_session_manager():
    sm = MagicMock()
    sm.is_valid = False
    sm.smart_api = None
    sm.status = {
        "is_valid": False,
        "auth_token_available": False,
        "feed_token_available": False,
        "last_error": "Session expired",
        "last_refresh": None,
    }
    return sm


def _make_test_app(session_manager=None):
    """Create a minimal FastAPI app with the broker_account router mounted."""
    test_app = FastAPI()
    test_app.include_router(broker_account_router)
    test_app.state.session_manager = session_manager
    return test_app


# =====================================================================
# Test 12: Backend import is safe — no broker login at module load
# =====================================================================

def test_backend_import_safe_no_login_at_module_load():
    """
    Importing the service and router modules must never trigger a broker login,
    create a session, or fail due to missing credentials.
    """
    # If we reached this line, the imports at top of file were safe
    assert BrokerAccountSyncService is not None
    assert broker_account_router is not None


def test_service_instantiation_does_not_call_broker():
    """Creating BrokerAccountSyncService must not call any broker API."""
    with patch("backend.services.broker_account_sync.logger") as mock_logger:
        svc = BrokerAccountSyncService(session_manager=None)
        # No warning/error should be emitted just from instantiation
        mock_logger.warning.assert_not_called()
        mock_logger.error.assert_not_called()
    assert svc is not None


# =====================================================================
# Test 11: Sanitizer removes token-like fields
# =====================================================================

def test_sanitize_record_removes_jwt_token():
    raw = {"jwtToken": "eyJhbGciOi...", "symbol": "TCS", "price": 3500.0}
    result = _sanitize_record(raw)
    assert "jwtToken" not in result
    assert result["symbol"] == "TCS"
    assert result["price"] == 3500.0


def test_sanitize_record_removes_auth_token():
    raw = {"authToken": "secret-auth-here", "ltp": 1500.0}
    result = _sanitize_record(raw)
    assert "authToken" not in result
    assert result["ltp"] == 1500.0


def test_sanitize_record_removes_feed_token():
    raw = {"feedToken": "feed-secret", "name": "TCS"}
    result = _sanitize_record(raw)
    assert "feedToken" not in result
    assert result["name"] == "TCS"


def test_sanitize_record_removes_refresh_token():
    raw = {"refreshToken": "rtoken", "quantity": 100}
    result = _sanitize_record(raw)
    assert "refreshToken" not in result
    assert result["quantity"] == 100


def test_sanitize_record_removes_password_and_totp():
    raw = {"password": "p@ss!", "totp": "123456", "symbol": "INFY"}
    result = _sanitize_record(raw)
    assert "password" not in result
    assert "totp" not in result
    assert result["symbol"] == "INFY"


def test_sanitize_record_removes_api_key():
    raw = {"apiKey": "ABCD1234", "price": 200.0}
    result = _sanitize_record(raw)
    assert "apiKey" not in result
    assert result["price"] == 200.0


def test_sanitize_record_removes_nested_sensitive_fields():
    raw = {
        "jwtToken": "should-be-removed",
        "authToken": "also-removed",
        "symbol": "TCS",
        "price": 3500.0,
        "password": "secret",
        "nested": {
            "apiKey": "nope",
            "ltp": 3510.0,
        },
        "list_field": [
            {"token": "remove-me", "qty": 10},
        ],
    }
    result = _sanitize_record(raw)
    assert "jwtToken" not in result
    assert "authToken" not in result
    assert "password" not in result
    assert result["symbol"] == "TCS"
    assert result["price"] == 3500.0
    assert "apiKey" not in result["nested"]
    assert result["nested"]["ltp"] == 3510.0
    assert "token" not in result["list_field"][0]
    assert result["list_field"][0]["qty"] == 10


# =====================================================================
# Test 3: Holdings normalization
# =====================================================================

def test_normalize_holding_from_angel_format():
    raw = {
        "tradingsymbol": "INFY",
        "isin": "INE009A01021",
        "quantity": 10,
        "averageprice": 1500.0,
        "ltp": 1550.0,
        "realisedquantity": 10,
        "product": "CNC",
        "exchange": "NSE",
    }
    result = _normalize_holding(raw)
    assert result["symbol"] == "INFY"
    assert result["isin"] == "INE009A01021"
    assert result["quantity"] == 10.0
    assert result["avg_price"] == 1500.0
    assert result["ltp"] == 1550.0
    assert result["product"] == "CNC"
    assert result["exchange"] == "NSE"


def test_normalize_holding_handles_missing_optional_fields():
    raw = {"tradingsymbol": "HDFC", "quantity": 5}
    result = _normalize_holding(raw)
    assert result["symbol"] == "HDFC"
    assert result["avg_price"] is None
    assert result["ltp"] is None


# =====================================================================
# Test 4: Positions normalization
# =====================================================================

def test_normalize_position_from_angel_format():
    raw = {
        "tradingsymbol": "NIFTY23NOVFUT",
        "product": "NRML",
        "exchange": "NFO",
        "netqty": 50,
        "averageprice": 19500.0,
        "ltp": 19600.0,
        "unrealisedpnl": 5000.0,
        "realisedpnl": 0.0,
    }
    result = _normalize_position(raw)
    assert result["symbol"] == "NIFTY23NOVFUT"
    assert result["net_qty"] == 50.0
    assert result["avg_price"] == 19500.0
    assert result["ltp"] == 19600.0
    assert result["unrealised_pnl"] == 5000.0
    assert result["realised_pnl"] == 0.0


def test_normalize_position_handles_missing_fields():
    raw = {"symbol": "BANKNIFTY", "netqty": 0}
    result = _normalize_position(raw)
    assert result["net_qty"] == 0.0
    assert result["unrealised_pnl"] is None


# =====================================================================
# Test 5: Funds normalization
# =====================================================================

def test_normalize_funds_from_angel_format():
    raw = {
        "availablecash": 100000.0,
        "net": 100000.0,
        "utiliseddebits": 5000.0,
        "availableintradaypayin": 200000.0,
        "collateral": 10000.0,
        "m2mrealized": 250.0,
        "m2munrealized": 500.0,
    }
    result = _normalize_funds(raw)
    assert result["available_cash"] == 100000.0
    assert result["used_margin"] == 5000.0
    assert result["net"] == 100000.0
    assert result["collateral"] == 10000.0
    assert result["m2mrealized"] == 250.0
    assert result["m2munrealized"] == 500.0


def test_normalize_funds_empty_dict():
    result = _normalize_funds({})
    assert result["available_cash"] is None
    assert result["net"] is None


# =====================================================================
# Test 6: Orders normalization
# =====================================================================

def test_normalize_order_masks_full_order_id():
    raw = {
        "orderid": "ORDER-12345678",
        "tradingsymbol": "TCS",
        "transactiontype": "BUY",
        "quantity": 5,
        "price": 3500.0,
        "status": "COMPLETE",
        "product": "CNC",
        "exchange": "NSE",
        "ordertype": "LIMIT",
        "updatetime": "14:30:00",
    }
    result = _normalize_order(raw)
    assert "orderid" not in result       # raw field removed
    assert "order_id" not in result      # raw id should not appear
    assert "order_id_masked" in result   # only masked version
    assert "45678" in result["order_id_masked"]  # last 6 chars
    assert result["symbol"] == "TCS"
    assert result["side"] == "BUY"
    assert result["quantity"] == 5.0
    assert result["price"] == 3500.0
    assert result["status"] == "COMPLETE"


def test_normalize_order_handles_missing_id():
    raw = {"tradingsymbol": "SBIN", "transactiontype": "SELL"}
    result = _normalize_order(raw)
    assert result["order_id_masked"] == "N/A"


# =====================================================================
# Test 7: Trades normalization
# =====================================================================

def test_normalize_trade_masks_full_trade_id():
    raw = {
        "tradeid": "TRADE-987654321",
        "tradingsymbol": "RELIANCE",
        "transactiontype": "SELL",
        "quantity": 10,
        "tradeprice": 2400.0,
        "product": "MIS",
        "exchange": "NSE",
        "updatetime": "14:45:00",
    }
    result = _normalize_trade(raw)
    assert "tradeid" not in result         # raw field removed
    assert "trade_id" not in result        # raw id should not appear
    assert "trade_id_masked" in result     # only masked version
    assert "54321" in result["trade_id_masked"]  # last 6 chars
    assert result["symbol"] == "RELIANCE"
    assert result["side"] == "SELL"
    assert result["price"] == 2400.0


def test_normalize_trade_handles_missing_id():
    raw = {"tradingsymbol": "ITC", "transactiontype": "BUY"}
    result = _normalize_trade(raw)
    assert result["trade_id_masked"] == "N/A"


# =====================================================================
# Test 2: Missing session returns BROKER_SESSION_UNAVAILABLE
# =====================================================================

def test_session_none_returns_unavailable_for_all_methods():
    """All data methods must return safe fallback when session is None."""
    svc = BrokerAccountSyncService(session_manager=None)
    for method_name, method in [
        ("get_holdings", svc.get_holdings),
        ("get_positions", svc.get_positions),
        ("get_funds", svc.get_funds),
        ("get_order_book", svc.get_order_book),
        ("get_trade_book", svc.get_trade_book),
    ]:
        result = method()
        assert result["status"] == "BROKER_SESSION_UNAVAILABLE", (
            f"{method_name} should return BROKER_SESSION_UNAVAILABLE, got {result['status']}"
        )


def test_invalid_session_returns_unavailable_snapshot():
    """When session.is_valid is False, snapshot must return BROKER_SESSION_UNAVAILABLE."""
    sm = _make_invalid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_account_snapshot()
    assert result["status"] == "BROKER_SESSION_UNAVAILABLE"
    assert result["holdings"] == []
    assert result["positions"] == []
    assert result["orders"] == []
    assert result["trades"] == []


def test_broker_exception_returns_broker_error_not_crash():
    """Broker API exceptions must be caught and return BROKER_ERROR, never propagate."""
    sm = _make_valid_session_manager()
    sm.smart_api.holding.side_effect = Exception("Connection timeout")
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_holdings()
    assert result["status"] == "BROKER_ERROR"
    assert result["holdings"] == []


# =====================================================================
# Test: Service with valid session returns correct data
# =====================================================================

def test_get_holdings_valid_session():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_holdings()
    assert result["status"] == "OK"
    assert len(result["holdings"]) == 1
    assert result["holdings"][0]["symbol"] == "INFY"
    # Verify jwtToken injected in mock response was stripped
    assert "jwtToken" not in result["holdings"][0]


def test_get_positions_valid_session():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_positions()
    assert result["status"] == "OK"
    assert len(result["positions"]) == 1
    assert result["positions"][0]["symbol"] == "NIFTY23NOVFUT"


def test_get_funds_valid_session():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_funds()
    assert result["status"] == "OK"
    assert result["funds"]["available_cash"] == 100000.0
    assert result["funds"]["used_margin"] == 5000.0


def test_get_order_book_valid_session():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_order_book()
    assert result["status"] == "OK"
    assert len(result["orders"]) == 1
    assert "order_id" not in result["orders"][0]
    assert "order_id_masked" in result["orders"][0]


def test_get_trade_book_valid_session():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.get_trade_book()
    assert result["status"] == "OK"
    assert len(result["trades"]) == 1
    assert "trade_id" not in result["trades"][0]
    assert "trade_id_masked" in result["trades"][0]


# =====================================================================
# Test 8: Snapshot combines all read-only sections
# =====================================================================

def test_account_snapshot_combines_all_sections():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    snapshot = svc.get_account_snapshot()
    assert snapshot["status"] == "OK"
    assert len(snapshot["holdings"]) == 1
    assert len(snapshot["positions"]) == 1
    assert len(snapshot["orders"]) == 1
    assert len(snapshot["trades"]) == 1
    assert snapshot["funds"]["available_cash"] == 100000.0
    assert "synced_at" in snapshot
    assert snapshot["source"] == "angel_one_read_only"


def test_sync_all_read_only_is_alias_for_snapshot():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    result = svc.sync_all_read_only()
    assert result["status"] == "OK"
    assert "synced_at" in result
    assert "holdings" in result
    assert "funds" in result


def test_snapshot_has_valid_synced_at_iso_format():
    sm = _make_valid_session_manager()
    svc = BrokerAccountSyncService(session_manager=sm)
    snapshot = svc.get_account_snapshot()
    synced_at = snapshot["synced_at"]
    assert isinstance(synced_at, str)
    assert "Z" in synced_at or "+" in synced_at  # ISO 8601 UTC


# =====================================================================
# Test 10: Service never calls placeOrder, cancelOrder, modifyOrder
# =====================================================================

def test_service_never_calls_place_order():
    """
    BrokerAccountSyncService must have NO placeOrder-like methods
    and must never call them on the SmartConnect instance.
    """
    svc = BrokerAccountSyncService(session_manager=None)
    # Service has no mutation methods
    assert not hasattr(svc, "place_order")
    assert not hasattr(svc, "placeOrder")
    assert not hasattr(svc, "cancel_order")
    assert not hasattr(svc, "cancelOrder")
    assert not hasattr(svc, "modify_order")
    assert not hasattr(svc, "modifyOrder")


def test_smart_api_mock_is_constrained_to_read_only_methods():
    """Verify mock SmartAPI only allows the read-only methods we expect."""
    mock_api = _make_mock_smart_api()
    # These read-only methods must exist on the mock
    assert hasattr(mock_api, "holding")
    assert hasattr(mock_api, "position")
    assert hasattr(mock_api, "rmsLimit")
    assert hasattr(mock_api, "orderBook")
    assert hasattr(mock_api, "tradeBook")
    # The mock is built with spec_set so any mutation call should raise AttributeError
    with pytest.raises(AttributeError):
        mock_api.placeOrder()
    with pytest.raises(AttributeError):
        mock_api.cancelOrder()
    with pytest.raises(AttributeError):
        mock_api.modifyOrder()


# =====================================================================
# Test 9: Routes require admin token when ADMIN_TOKEN is configured
# =====================================================================

def test_router_status_no_session_returns_unavailable():
    """GET /status is public and returns safe BROKER_SESSION_UNAVAILABLE."""
    client = TestClient(_make_test_app(session_manager=None))
    resp = client.get("/broker/account/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "BROKER_SESSION_UNAVAILABLE"
    assert data["is_valid"] is False


def test_router_status_with_valid_session():
    """GET /status returns OK when session is valid (no admin token needed)."""
    sm = _make_valid_session_manager()
    client = TestClient(_make_test_app(session_manager=sm))
    resp = client.get("/broker/account/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"


def test_router_holdings_requires_admin_when_token_configured():
    """
    When ADMIN_TOKEN is set, /holdings should reject requests without the token (403).
    We patch settings.admin_token to simulate a configured token.
    """
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        # No token → 403
        resp = client.get("/broker/account/holdings")
        assert resp.status_code == 403
        # Correct token → 200
        resp = client.get(
            "/broker/account/holdings",
            headers={"X-Admin-Token": "test-secret-token"},
        )
        assert resp.status_code == 200


def test_router_snapshot_requires_admin_when_token_configured():
    """GET /snapshot must be blocked without admin token when ADMIN_TOKEN is set."""
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get("/broker/account/snapshot")
        assert resp.status_code == 403


def test_router_sync_readonly_requires_admin_when_token_configured():
    """POST /sync-readonly must be blocked without admin token when ADMIN_TOKEN is set."""
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.post("/broker/account/sync-readonly")
        assert resp.status_code == 403


def test_router_holdings_no_admin_token_configured_open_access():
    """
    When ADMIN_TOKEN is empty (default dev mode), holdings is accessible without token.
    This matches the intentional 'optional admin' design.
    """
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = ""   # no token configured → guard disabled
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get("/broker/account/holdings")
        assert resp.status_code == 200


def test_router_funds_requires_admin_when_token_configured():
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get("/broker/account/funds")
        assert resp.status_code == 403


def test_router_orders_requires_admin_when_token_configured():
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get("/broker/account/orders")
        assert resp.status_code == 403


def test_router_trades_requires_admin_when_token_configured():
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get("/broker/account/trades")
        assert resp.status_code == 403


def test_router_snapshot_with_valid_token_returns_200():
    """Valid admin token + valid session → 200 with snapshot data."""
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get(
            "/broker/account/snapshot",
            headers={"X-Admin-Token": "test-secret-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "OK"
        assert "holdings" in data
        assert "positions" in data
        assert "funds" in data


def test_router_sync_readonly_with_valid_token_returns_200():
    """POST /sync-readonly with valid token returns snapshot."""
    sm = _make_valid_session_manager()
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = "test-secret-token"
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.post(
            "/broker/account/sync-readonly",
            headers={"X-Admin-Token": "test-secret-token"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "synced_at" in data


# =====================================================================
# Test: Response does not expose raw tokens even via router
# =====================================================================

def test_router_holdings_response_does_not_contain_jwt():
    """
    Even if broker mistakenly includes jwtToken in holding response,
    the sanitizer + normalizer must strip it before response.
    """
    sm = _make_valid_session_manager()
    # jwtToken is already in mock data for holdings
    with patch("backend.core.security.settings") as mock_settings:
        mock_settings.admin_token = ""   # open in dev
        client = TestClient(_make_test_app(session_manager=sm))
        resp = client.get("/broker/account/holdings")
        assert resp.status_code == 200
        data = resp.json()
        for h in data.get("holdings", []):
            assert "jwtToken" not in h
            assert "authToken" not in h
            assert "token" not in h
