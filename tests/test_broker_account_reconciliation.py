import pytest
from unittest.mock import Mock, patch
from backend.services.broker_account_reconciliation import BrokerAccountReconciliationService, AccountReconciliationMismatch

@pytest.fixture
def broker_sync_mock():
    mock = Mock()
    mock._is_available = Mock(return_value=True)
    mock.get_holdings = Mock(return_value={"holdings": []})
    mock.get_positions = Mock(return_value={"positions": []})
    mock.get_funds = Mock(return_value={"funds": {}})
    return mock

@pytest.fixture
def portfolio_engine_mock():
    mock = Mock()
    mock.get_holdings = Mock(return_value=[])
    mock.get_positions = Mock(return_value=[])
    mock.get_summary = Mock(return_value={})
    return mock

def test_broker_unavailable(portfolio_engine_mock, broker_sync_mock):
    broker_sync_mock._is_available.return_value = False
    svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine_mock)
    report = svc.reconcile_from_broker(broker_sync_mock)
    assert report.broker_session_available is False
    assert report.overall_status == "BROKER_UNAVAILABLE"

def test_holdings_match(portfolio_engine_mock, broker_sync_mock):
    broker_sync_mock.get_holdings.return_value = {
        "holdings": [
            {"symbol": "SBIN-EQ", "quantity": 100, "avg_price": 500}
        ]
    }
    portfolio_engine_mock.get_holdings.return_value = [
        {"symbol": "SBIN-EQ", "quantity": 100, "avg_price": 500}
    ]
    svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine_mock)
    report = svc.reconcile_from_broker(broker_sync_mock)
    
    assert report.overall_status == "OK"
    assert report.mismatch_count == 0

def test_holdings_quantity_mismatch(portfolio_engine_mock, broker_sync_mock):
    broker_sync_mock.get_holdings.return_value = {
        "holdings": [
            {"symbol": "SBIN-EQ", "quantity": 100, "avg_price": 500}
        ]
    }
    portfolio_engine_mock.get_holdings.return_value = [
        {"symbol": "SBIN-EQ", "quantity": 50, "avg_price": 500}
    ]
    svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine_mock)
    report = svc.reconcile_from_broker(broker_sync_mock)
    
    assert report.overall_status == "CRITICAL_MISMATCHES"
    assert report.mismatch_count == 1
    anomaly = report.anomalies[0]
    assert anomaly.mismatch_type == "QUANTITY_MISMATCH"
    assert anomaly.symbol == "SBIN-EQ"

def test_positions_missing_broker(portfolio_engine_mock, broker_sync_mock):
    # Local has position, broker does not
    broker_sync_mock.get_positions.return_value = {"positions": []}
    portfolio_engine_mock.get_positions.return_value = [
        {"symbol": "RELIANCE-EQ", "quantity": 10, "entry_price": 2500, "unrealized_pnl": 0, "realized_pnl": 0}
    ]
    svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine_mock)
    report = svc.reconcile_from_broker(broker_sync_mock)
    
    assert report.overall_status == "CRITICAL_MISMATCHES"
    assert report.mismatch_count == 1
    assert report.anomalies[0].mismatch_type == "LOCAL_POSITION_MISSING_BROKER"

def test_positions_pnl_mismatch(portfolio_engine_mock, broker_sync_mock):
    # Position exists on both, but PnL differs by more than 5
    broker_sync_mock.get_positions.return_value = {
        "positions": [
            {"symbol": "RELIANCE-EQ", "net_qty": 10, "avg_price": 2500, "unrealised_pnl": 100, "realised_pnl": 0}
        ]
    }
    portfolio_engine_mock.get_positions.return_value = [
        {"symbol": "RELIANCE-EQ", "net_qty": 10, "entry_price": 2500, "unrealized_pnl": 50, "realized_pnl": 0}
    ]
    svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine_mock)
    report = svc.reconcile_from_broker(broker_sync_mock)
    
    assert report.overall_status == "OK"
    assert report.mismatch_count == 1
    assert report.anomalies[0].mismatch_type == "PNL_MISMATCH"

def test_funds_negative_cash(portfolio_engine_mock, broker_sync_mock):
    broker_sync_mock.get_funds.return_value = {
        "funds": {"available_cash": -500}
    }
    portfolio_engine_mock.get_summary.return_value = {"equity": 1000}
    svc = BrokerAccountReconciliationService(portfolio_engine=portfolio_engine_mock)
    report = svc.reconcile_from_broker(broker_sync_mock)
    
    assert report.overall_status == "CRITICAL_MISMATCHES"
    # Negative cash is 1 critical anomaly, plus mismatch with local (abs(-500 - 1000) > 5) is 1 warning
    anomalies = [a.mismatch_type for a in report.anomalies]
    assert "NEGATIVE_OR_INVALID_BROKER_VALUE" in anomalies
    assert "FUNDS_AVAILABLE_MISMATCH" in anomalies
