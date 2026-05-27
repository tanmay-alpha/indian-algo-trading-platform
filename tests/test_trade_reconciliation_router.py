import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.routers import trade_reconciliation as trade_reconciliation_router
from backend.services.broker_trade_reconciliation import TradeReconciliationReport, TradeReconciliationMismatch


@pytest.fixture
def temp_recon_dir():
    """Create a temporary directory for reconciliation reports."""
    temp_dir = tempfile.mkdtemp()
    original_recon_dir = trade_reconciliation_router.RECON_DIR
    trade_reconciliation_router.RECON_DIR = Path(temp_dir)
    yield Path(temp_dir)
    # Clean up
    trade_reconciliation_router.RECON_DIR = original_recon_dir
    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass


def test_reconciliation_router_endpoints(temp_recon_dir):
    """Test all the /reconciliation/tradebook endpoints."""
    app = FastAPI()
    app.include_router(trade_reconciliation_router.router)

    # Bypass admin token dependency
    from backend.core.security import require_admin_token
    app.dependency_overrides[require_admin_token] = lambda: {"admin": True}

    client = TestClient(app)

    # 1. Initially, GET /status should show session_available: false, latest_report: null
    app.state.session_manager = MagicMock(is_valid=False)
    app.state.order_store = MagicMock()

    resp = client.get("/reconciliation/tradebook/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "OK"
    assert data["session_available"] is False
    assert data["latest_report"] is None

    # 2. If session is not valid, POST /run should raise 400 BROKER_SESSION_UNAVAILABLE
    resp = client.post("/reconciliation/tradebook/run")
    assert resp.status_code == 400
    assert "BROKER_SESSION_UNAVAILABLE" in resp.json()["detail"]

    # 3. Enable session and run reconciliation successfully
    app.state.session_manager.is_valid = True

    mock_report = TradeReconciliationReport(
        checked_at="2026-05-27T10:00:00Z",
        broker_trade_count=2,
        local_fill_count=2,
        matched_count=1,
        mismatch_count=1,
        mismatches=[
            TradeReconciliationMismatch(
                severity="WARNING",
                mismatch_type="QUANTITY_MISMATCH",
                symbol="SBIN",
                side="BUY",
                broker_trade_id="B1",
                fill_id="F1",
                broker_qty=10,
                local_qty=5,
                detail="Quantity difference: 5"
            )
        ]
    )

    with patch("backend.services.broker_trade_reconciliation.BrokerTradeReconciliationService.reconcile_from_broker", return_value=mock_report):
        resp = client.post("/reconciliation/tradebook/run")
        assert resp.status_code == 200
        run_data = resp.json()
        assert run_data["reconciliation_id"] == mock_report.reconciliation_id
        assert run_data["mismatch_count"] == 1
        assert run_data["overall_status"] == "WARNING"

        # 4. Check status again, it should have the latest_report populated
        resp = client.get("/reconciliation/tradebook/status")
        assert resp.status_code == 200
        status_data = resp.json()
        assert status_data["session_available"] is True
        assert status_data["latest_report"]["reconciliation_id"] == mock_report.reconciliation_id

        # 5. Check GET /latest
        resp = client.get("/reconciliation/tradebook/latest")
        assert resp.status_code == 200
        latest_data = resp.json()
        assert latest_data["reconciliation_id"] == mock_report.reconciliation_id

        # 6. Check GET /history
        resp = client.get("/reconciliation/tradebook/history")
        assert resp.status_code == 200
        history_data = resp.json()
        assert len(history_data) == 1
        assert history_data[0]["reconciliation_id"] == mock_report.reconciliation_id
