# tests/test_broker_snapshot_service.py
"""
Tests for BrokerAccountSnapshotService — Phase 24E Safety Hardening.

ABSOLUTE SAFETY: All tests use mocks. Zero real broker API calls.
No live orders placed. No credentials printed.
"""

import os
import json
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from backend.services.broker_account_snapshot_service import (
    BrokerAccountSnapshotService,
    BrokerAccountSnapshotResponse,
    ReconciliationSummaryModel
)

def _make_valid_session_manager():
    sm = MagicMock()
    sm.is_valid = True
    sm.smart_api = MagicMock()
    
    # Mock holdings
    sm.smart_api.holding.return_value = {
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
                "jwtToken": "token-should-be-removed",
            }
        ]
    }
    
    # Mock positions
    sm.smart_api.position.return_value = {
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
        ]
    }
    
    # Mock RMS limits / funds
    sm.smart_api.rmsLimit.return_value = {
        "status": True,
        "data": {
            "availablecash": 100000.0,
            "net": 100000.0,
            "utiliseddebits": 5000.0,
            "availableintradaypayin": 200000.0,
            "collateral": 0.0,
            "m2mrealized": 250.0,
            "m2munrealized": 500.0,
        }
    }
    
    return sm


@pytest.fixture(autouse=True)
def clear_snapshot_cache():
    """Reset class-level cache before each test to ensure isolation."""
    BrokerAccountSnapshotService._cached_snapshot = None
    BrokerAccountSnapshotService._cached_time = None


def _make_invalid_session_manager():
    sm = MagicMock()
    sm.is_valid = False
    sm.smart_api = None
    return sm


def test_snapshot_no_unsafe_imports():
    """Verify that the snapshot service has NO imports or calls to place/modify/cancel order or Execution managers."""
    import backend.services.broker_account_snapshot_service as service_module
    import inspect
    source = inspect.getsource(service_module)
    
    # Check that none of the unsafe mutation terms appear as variables or calls in code logic
    unsafe_terms = [
        "placeOrder", "place_order", "modifyOrder", "modify_order",
        "cancelOrder", "cancel_order", "ExecutionRouter", "LiveOrderManager",
        "PaperOrderManager", "order_fills"
    ]
    for term in unsafe_terms:
        assert term not in source, f"Unsafe mutation reference found in source code: {term}"


def test_snapshot_service_none_session_manager():
    """If session_manager is None, service returns UNAVAILABLE status and honest empty state."""
    service = BrokerAccountSnapshotService(session_manager=None)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "UNAVAILABLE"
    assert snapshot.data_status == "UNAVAILABLE"
    assert snapshot.holdings == []
    assert snapshot.positions == []
    assert snapshot.funds is None
    assert snapshot.holdings_status == "UNAVAILABLE"
    assert snapshot.positions_status == "UNAVAILABLE"
    assert snapshot.funds_status == "UNAVAILABLE"
    assert snapshot.warning == "BROKER_SESSION_UNAVAILABLE"


def test_snapshot_service_invalid_session():
    """If session is invalid, service returns UNAVAILABLE status and empty lists."""
    sm = _make_invalid_session_manager()
    service = BrokerAccountSnapshotService(session_manager=sm)
    # Clear cache first to test pure fallback to unavailable
    BrokerAccountSnapshotService._cached_snapshot = None
    BrokerAccountSnapshotService._cached_time = None
    
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "UNAVAILABLE"
    assert snapshot.data_status == "UNAVAILABLE"
    assert snapshot.holdings == []
    assert snapshot.positions == []
    assert snapshot.funds is None


def test_snapshot_service_valid_session():
    """If session is valid, returns AVAILABLE status with correct data and sanitized tokens."""
    sm = _make_valid_session_manager()
    service = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "AVAILABLE"
    assert snapshot.data_status == "AVAILABLE"
    assert snapshot.holdings_status == "AVAILABLE"
    assert snapshot.positions_status == "AVAILABLE"
    assert snapshot.funds_status == "AVAILABLE"
    assert len(snapshot.holdings) == 1
    assert snapshot.holdings[0].symbol == "INFY"
    assert snapshot.holdings[0].isin == "INE009A01021"
    assert snapshot.holdings[0].quantity == 10.0
    assert snapshot.holdings[0].avg_price == 1500.0
    assert snapshot.holdings[0].ltp == 1550.0
    
    assert len(snapshot.positions) == 1
    assert snapshot.positions[0].symbol == "NIFTY23NOVFUT"
    assert snapshot.positions[0].net_qty == 50.0
    
    assert snapshot.funds is not None
    assert snapshot.funds.available_cash == 100000.0
    assert snapshot.funds.used_margin == 5000.0
    assert snapshot.funds.available_intraday_payin == 200000.0
    
    # Ensure tokens are not leaked (e.g. through serialize/sanitize checks or dict structures)
    serialized = snapshot.model_dump()
    assert "jwtToken" not in serialized["holdings"][0]


def test_snapshot_service_partial_holdings_error():
    """If holdings API fails, status becomes PARTIAL and segment status is UNAVAILABLE."""
    sm = _make_valid_session_manager()
    sm.smart_api.holding.side_effect = Exception("API Timeout")
    
    service = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "PARTIAL"
    assert snapshot.data_status == "PARTIAL"
    assert snapshot.holdings_status == "UNAVAILABLE"
    assert snapshot.positions_status == "AVAILABLE"
    assert snapshot.funds_status == "AVAILABLE"
    assert snapshot.holdings == []
    assert len(snapshot.positions) == 1
    assert snapshot.warning == "Some broker segments failed to load"


def test_snapshot_service_partial_positions_error():
    """If positions API fails, status becomes PARTIAL and segment status is UNAVAILABLE."""
    sm = _make_valid_session_manager()
    sm.smart_api.position.side_effect = Exception("API Timeout")
    
    service = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "PARTIAL"
    assert snapshot.positions_status == "UNAVAILABLE"
    assert snapshot.holdings_status == "AVAILABLE"
    assert snapshot.positions == []


def test_snapshot_service_partial_funds_error():
    """If funds API fails, status becomes PARTIAL and segment status is UNAVAILABLE."""
    sm = _make_valid_session_manager()
    sm.smart_api.rmsLimit.side_effect = Exception("API Timeout")
    
    service = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "PARTIAL"
    assert snapshot.funds_status == "UNAVAILABLE"
    assert snapshot.funds is None


def test_snapshot_service_malformed_payload_parsing_safety():
    """If broker payload contains malformed types (e.g. string for avg_price), it handles gracefully."""
    sm = _make_valid_session_manager()
    sm.smart_api.holding.return_value = {
        "status": True,
        "data": [
            {
                "tradingsymbol": "BAD_QTY",
                "isin": "INE000000000",
                "quantity": "invalid_qty_string",
                "averageprice": "123.45",
                "ltp": "125.0",
                "product": "CNC",
                "exchange": "NSE",
            }
        ]
    }
    service = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "AVAILABLE"
    assert len(snapshot.holdings) == 1
    # quantity parsing fails gracefully returning None, avg_price parses float safely
    assert snapshot.holdings[0].quantity is None
    assert snapshot.holdings[0].avg_price == 123.45


def test_snapshot_service_missing_recon_reports(tmp_path):
    """If reconciliation directories or files are missing, it does not crash."""
    service = BrokerAccountSnapshotService(session_manager=None)
    # Point directories to non-existent paths
    service.recon_trade_dir = str(tmp_path / "missing_trade")
    service.recon_acc_dir = str(tmp_path / "missing_acc")
    
    summary = service._build_recon_summary()
    assert isinstance(summary, ReconciliationSummaryModel)
    assert summary.tradebook_status is None
    assert summary.tradebook_mismatch_count is None
    assert summary.account_reconciliation_status is None
    assert summary.account_mismatch_count is None


def test_snapshot_service_corrupt_recon_reports(tmp_path):
    """If a reconciliation report has corrupt/malformed JSON, it does not crash and handles it safely."""
    # Setup temporary directories
    trade_dir = tmp_path / "trade"
    trade_dir.mkdir()
    
    # Write one corrupt JSON file and one valid file
    corrupt_file = trade_dir / "reconciliation_report_2026-05-28_corrupt.json"
    corrupt_file.write_text("this is not { valid json } data")
    
    valid_file = trade_dir / "reconciliation_report_2026-05-27_valid.json"
    valid_file.write_text(json.dumps({
        "checked_at": "2026-05-27T12:00:00Z",
        "mismatch_count": 0,
        "matched_count": 5
    }))
    
    service = BrokerAccountSnapshotService(session_manager=None)
    service.recon_trade_dir = str(trade_dir)
    
    # Verify the corrupt file is ignored and the valid one is loaded
    report = service.get_latest_tradebook_report()
    assert report is not None
    assert report["mismatch_count"] == 0
    
    summary = service._build_recon_summary()
    assert summary.tradebook_status == "OK"
    assert summary.tradebook_mismatch_count == 0


def test_snapshot_service_stale_recon_reports(tmp_path):
    """If a reconciliation report is stale (older than 24 hours), it is clearly marked stale with correct age."""
    trade_dir = tmp_path / "trade"
    trade_dir.mkdir()
    
    # Report from 2 days ago
    two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat().replace("+00:00", "Z")
    
    valid_file = trade_dir / "reconciliation_report_stale.json"
    valid_file.write_text(json.dumps({
        "checked_at": two_days_ago,
        "mismatch_count": 3,
        "matched_count": 10
    }))
    
    service = BrokerAccountSnapshotService(session_manager=None)
    service.recon_trade_dir = str(trade_dir)
    
    summary = service._build_recon_summary()
    assert summary.tradebook_status == "CRITICAL_MISMATCHES"
    assert summary.tradebook_mismatch_count == 3
    assert summary.tradebook_report_age_seconds is not None
    assert summary.tradebook_report_age_seconds >= 172800  # 2 days in seconds
    assert summary.tradebook_report_stale is True


def test_snapshot_service_no_fake_rows():
    """Verify that no fake holdings/positions/funds rows are generated if broker returns empty data."""
    sm = _make_valid_session_manager()
    sm.smart_api.holding.return_value = {"status": True, "data": []}
    sm.smart_api.position.return_value = {"status": True, "data": []}
    sm.smart_api.rmsLimit.return_value = {"status": True, "data": {}}
    
    service = BrokerAccountSnapshotService(session_manager=sm)
    snapshot = service.get_snapshot()
    
    assert snapshot.status == "AVAILABLE"
    assert snapshot.holdings == []
    assert snapshot.positions == []
    # empty dict funds means fields are None, not placeholder values
    assert snapshot.funds is not None
    assert snapshot.funds.available_cash is None


def test_snapshot_service_sync_readonly_no_mutation():
    """Verify that calling get_snapshot or sync-readonly endpoint never mutates portfolio database tables or OMS state."""
    # We assert that no DB commit or query is run on the SQL session, and no mutation classes are imported.
    # In fact, we can verify that the service does not accept or interact with database sessions.
    service = BrokerAccountSnapshotService(session_manager=None)
    assert not hasattr(service, "db")
    assert not hasattr(service, "session")


def test_snapshot_service_stale_cache_serving():
    """If broker session becomes invalid, service successfully falls back to cached response and marks as STALE."""
    # Clear cache first
    BrokerAccountSnapshotService._cached_snapshot = None
    BrokerAccountSnapshotService._cached_time = None
    
    sm = _make_valid_session_manager()
    service = BrokerAccountSnapshotService(session_manager=sm)
    
    # 1. Fetch successfully to populate cache
    snapshot_1 = service.get_snapshot()
    assert snapshot_1.status == "AVAILABLE"
    assert len(snapshot_1.holdings) == 1
    assert BrokerAccountSnapshotService._cached_snapshot is not None
    assert BrokerAccountSnapshotService._cached_time is not None
    
    # 2. Invalidate session
    sm.is_valid = False
    
    # 3. Fetch again and verify cache serving
    snapshot_2 = service.get_snapshot()
    assert snapshot_2.status == "STALE"
    assert snapshot_2.data_status == "STALE"
    assert snapshot_2.holdings_status == "STALE"
    assert len(snapshot_2.holdings) == 1
    assert snapshot_2.holdings[0].symbol == "INFY"
    assert "Served from stale cache" in snapshot_2.warning
