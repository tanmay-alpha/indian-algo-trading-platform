# tests/test_broker_history_and_pnl_routes.py
"""
Tests for Broker History and PnL routes.
ABSOLUTE SAFETY: All tests use mocks. Zero real broker API calls.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.api_server import app
from backend.core.config import settings

client = TestClient(app)

@pytest.fixture
def auth_headers():
    return {"X-Admin-Token": "test-admin-token"}

@pytest.fixture
def mock_app_state_valid():
    mock_sm = MagicMock()
    mock_sm.is_valid = True
    app.state.session_manager = mock_sm
    yield mock_sm
    app.state.session_manager = None

@pytest.fixture
def mock_app_state_invalid():
    mock_sm = MagicMock()
    mock_sm.is_valid = False
    app.state.session_manager = mock_sm
    yield mock_sm
    app.state.session_manager = None

def test_history_routes_unauthorized():
    if not settings.admin_token:
        pytest.skip("Admin token not set in tests")
    
    for method, path in [
        ("POST", "/broker/account/history/import"),
        ("GET", "/broker/account/history/trades"),
        ("GET", "/broker/account/history/orders"),
        ("GET", "/broker/account/history/pnl"),
        ("POST", "/broker/account/history/pnl/calculate"),
    ]:
        if method == "POST":
            response = client.post(path)
        else:
            response = client.get(path)
        assert response.status_code == 403

@patch("backend.routers.broker_account.BrokerTradeHistoryService")
def test_get_historical_trades(mock_svc_class, auth_headers):
    mock_svc = mock_svc_class.return_value
    mock_svc.get_merged_trades.return_value = [
        {"symbol": "INFY", "side": "BUY", "quantity": 10, "price": 1500.0, "trade_time": "2026-05-29T10:00:00Z"}
    ]
    
    response = client.get("/broker/account/history/trades", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert len(data["trades"]) == 1
    assert data["trades"][0]["symbol"] == "INFY"

@patch("backend.routers.broker_account.BrokerTradeHistoryService")
def test_get_historical_orders(mock_svc_class, auth_headers):
    mock_svc = mock_svc_class.return_value
    mock_svc.get_merged_orders.return_value = [
        {"symbol": "INFY", "side": "BUY", "quantity": 10, "price": 1500.0, "status": "COMPLETE"}
    ]
    
    response = client.get("/broker/account/history/orders", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert len(data["orders"]) == 1
    assert data["orders"][0]["symbol"] == "INFY"

@patch("backend.routers.broker_account.BrokerTradeHistoryService")
def test_import_broker_history_success(mock_svc_class, auth_headers, mock_app_state_valid):
    mock_svc = mock_svc_class.return_value
    mock_svc.import_history.return_value = {
        "last_import_time": "2026-05-29T12:00:00Z",
        "total_historical_trades": 15,
        "total_historical_orders": 30
    }
    
    response = client.post("/broker/account/history/import", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["metadata"]["total_historical_trades"] == 15
    mock_svc.calculate_pnl_analytics.assert_called_once()

@patch("backend.routers.broker_account.BrokerTradeHistoryService")
def test_import_broker_history_unavailable(mock_svc_class, auth_headers, mock_app_state_invalid):
    mock_svc = mock_svc_class.return_value
    mock_svc.import_history.side_effect = ValueError("BROKER_SESSION_UNAVAILABLE")
    
    response = client.post("/broker/account/history/import", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "BROKER_SESSION_UNAVAILABLE"

@patch("backend.routers.broker_account.PnLSnapshotService")
@patch("backend.routers.broker_account.BrokerTradeHistoryService")
def test_get_pnl_history(mock_hist_class, mock_pnl_class, auth_headers):
    mock_pnl = mock_pnl_class.return_value
    mock_pnl.get_latest_pnl_snapshot.return_value = {"total_unrealized_pnl": 500.0}
    mock_pnl.get_pnl_history.return_value = [{"timestamp": "2026-05-29T12:00:00Z", "total_unrealized_pnl": 500.0}]
    
    mock_hist = mock_hist_class.return_value
    mock_hist.calculate_pnl_analytics.return_value = {
        "total_realized_pnl": 1000.0,
        "win_rate_percent": 75.0
    }
    
    with patch("backend.routers.broker_account.Path.exists", return_value=False):
        response = client.get("/broker/account/history/pnl", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OK"
        assert data["latest"]["total_unrealized_pnl"] == 500.0
        assert data["analytics"]["total_realized_pnl"] == 1000.0

@patch("backend.routers.broker_account.PnLSnapshotService")
def test_calculate_pnl_endpoint_success(mock_pnl_class, auth_headers, mock_app_state_valid):
    mock_pnl = mock_pnl_class.return_value
    mock_pnl.calculate_and_save_pnl_snapshot.return_value = {
        "timestamp": "2026-05-29T12:00:00Z",
        "total_unrealized_pnl": 500.0,
        "total_realized_pnl": 1000.0
    }
    
    response = client.post("/broker/account/history/pnl/calculate", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert data["report"]["total_unrealized_pnl"] == 500.0

@patch("backend.routers.broker_account.PnLSnapshotService")
def test_calculate_pnl_endpoint_error(mock_pnl_class, auth_headers, mock_app_state_invalid):
    mock_pnl = mock_pnl_class.return_value
    mock_pnl.calculate_and_save_pnl_snapshot.side_effect = ValueError("BROKER_SESSION_UNAVAILABLE")
    
    response = client.post("/broker/account/history/pnl/calculate", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "BROKER_SESSION_UNAVAILABLE"
