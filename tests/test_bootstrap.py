"""tests/test_bootstrap.py

Verifies the read-only, public GET /frontend/bootstrap endpoint is accessible
and returns correct system locks and module information.
"""

from fastapi.testclient import TestClient
from backend.api_server import app


def test_frontend_bootstrap_endpoint():
    """Verify that the /frontend/bootstrap endpoint is public and returns the correct state."""
    client = TestClient(app)
    response = client.get("/frontend/bootstrap")
    
    assert response.status_code == 200
    data = response.json()
    
    # Check app details
    assert "app" in data
    assert data["app"]["name"] == "MAET Terminal"
    assert data["app"]["version"] == "1.0.0"
    assert "environment" in data["app"]
    assert data["app"]["status"] == "online"
    
    # Check trading mode and demo settings
    assert "trading_mode" in data
    assert "demo_mode" in data
    
    # Check safety locks (critically checking live trading lockout)
    assert "safety_locks" in data
    locks = data["safety_locks"]
    assert locks["live_trading_locked"] is True
    assert locks["live_execution_build_enabled"] is False
    assert "live_approval_sandbox_enabled" in locks
    assert locks["broker_mutation_guard_active"] is True
    
    # Check module list
    assert "modules" in data
    assert isinstance(data["modules"], list)
    assert "auth" in data["modules"]
    assert "safety" in data["modules"]
    assert "broker_account" in data["modules"]
    assert "manual_order" in data["modules"]
    assert "oms" in data["modules"]
    assert "strategies" in data["modules"]
