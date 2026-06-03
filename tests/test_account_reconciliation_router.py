import pytest
from fastapi.testclient import TestClient
from backend.api_server import app
from backend.core.config import settings

client = TestClient(app)

from unittest.mock import Mock

@pytest.fixture
def auth_headers():
    return {"X-Admin-Token": "test-admin-token"}

@pytest.fixture
def mock_app_state():
    mock_sm = Mock()
    mock_pe = Mock()
    mock_sm._is_available = Mock(return_value=True)
    mock_sm.get_holdings = Mock(return_value={"holdings": []})
    mock_sm.get_positions = Mock(return_value={"positions": []})
    mock_sm.get_funds = Mock(return_value={"funds": {}})
    app.state.session_manager = mock_sm
    app.state.portfolio_engine = mock_pe
    yield
    app.state.session_manager = None
    app.state.portfolio_engine = None

def test_account_reconciliation_status_unauthorized():
    if not settings.admin_token:
        pytest.skip("Admin token not set in tests")
    response = client.get("/reconciliation/account/status")
    assert response.status_code == 403

def test_account_reconciliation_status(auth_headers):
    # This might return 200 with 'NO_REPORTS' if none exist, or the latest report status
    response = client.get("/reconciliation/account/status", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "status" in data

def test_account_reconciliation_history(auth_headers):
    response = client.get("/reconciliation/account/history", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_account_reconciliation_run(auth_headers, mock_app_state):
    # Mocked the app state, so this should succeed.
    response = client.post("/reconciliation/account/run", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["OK", "ERROR"]
    if data["status"] == "OK":
        assert "report" in data
