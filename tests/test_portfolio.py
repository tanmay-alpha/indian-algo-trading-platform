from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from backend.core.events import OrderStateEvent
from backend.core.config import settings
from backend.core.types import OrderSide, OrderStatus, TradingMode
from backend.portfolio.broker_reconciliation import BrokerReconciliation
from backend.portfolio.equity_curve import EquityCurve
from backend.portfolio.holdings_tracker import HoldingsTracker
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.portfolio.position_tracker import PositionTracker
from backend.routers.portfolio import router as portfolio_router


def fill_event(symbol="SBIN", side=OrderSide.BUY.value, qty=10, price=100.0, status=OrderStatus.FILLED.value):
    return OrderStateEvent(
        order_id=f"order-{symbol}-{side}-{qty}-{price}",
        broker_order_id=None,
        symbol=symbol,
        side=side,
        quantity=qty,
        filled_quantity=qty,
        avg_fill_price=price,
        status=status,
        reject_reason=None if status == OrderStatus.FILLED.value else "not_filled",
        order_request_id="request-1",
    )


def test_position_tracker_buy_creates_position():
    tracker = PositionTracker()
    tracker.on_fill(fill_event())
    position = tracker.get_position("SBIN")
    assert position["quantity"] == 10
    assert position["avg_price"] == 100.0


def test_position_tracker_update_unrealized():
    tracker = PositionTracker()
    tracker.on_fill(fill_event(price=100.0))
    tracker.update_unrealized("SBIN", 110.0)
    assert tracker.get_position("SBIN")["unrealized_pnl"] == 100.0


def test_position_tracker_round_trip_realized_pnl():
    tracker = PositionTracker()
    tracker.on_fill(fill_event(side=OrderSide.BUY.value, qty=10, price=100.0))
    tracker.on_fill(fill_event(side=OrderSide.SELL.value, qty=10, price=110.0))
    summary = tracker.get_summary()
    assert tracker.get_position("SBIN") is None
    assert summary["gross_pnl"] == 100.0
    assert summary["net_pnl"] < 100.0


def test_position_tracker_partial_exit():
    tracker = PositionTracker()
    tracker.on_fill(fill_event(side=OrderSide.BUY.value, qty=10, price=100.0))
    tracker.on_fill(fill_event(side=OrderSide.SELL.value, qty=5, price=110.0))
    position = tracker.get_position("SBIN")
    assert position["quantity"] == 5
    assert tracker.get_summary()["gross_pnl"] == 50.0


def test_position_tracker_total_open_notional():
    tracker = PositionTracker()
    tracker.on_fill(fill_event(qty=10, price=100.0))
    tracker.update_unrealized("SBIN", 105.0)
    assert tracker.total_open_notional() == 1050.0


def test_holdings_tracker_update_from_broker():
    tracker = HoldingsTracker()
    warnings = tracker.update_from_broker([
        {"tradingsymbol": "SBIN", "quantity": 2, "averageprice": 100.0, "ltp": 105.0}
    ])
    assert warnings == []
    assert tracker.get_holding("SBIN")["market_value"] == 210.0
    assert tracker.get_summary()["data_status"] == "AVAILABLE"


def test_equity_curve_add_point():
    curve = EquityCurve(initial_capital=1000)
    curve.add_point(1010.0, datetime(2024, 1, 1, tzinfo=timezone.utc))
    assert curve.latest()["equity"] == 1010.0


def test_equity_curve_drawdown():
    curve = EquityCurve(initial_capital=1000)
    curve.add_point(1100.0)
    curve.add_point(950.0)
    assert curve.current_drawdown() == 150.0
    assert curve.max_drawdown() == 150.0


def test_broker_reconciliation_detects_quantity_mismatch():
    rec = BrokerReconciliation()
    mismatches = rec.reconcile_positions(
        [{"symbol": "SBIN", "quantity": 10, "avg_price": 100.0}],
        [{"symbol": "SBIN", "quantity": 8, "avg_price": 100.0}],
    )
    assert mismatches[0]["field"] == "quantity"
    assert mismatches[0]["severity"] == "CRITICAL"


def test_broker_reconciliation_detects_missing_symbol():
    rec = BrokerReconciliation()
    mismatches = rec.reconcile_positions(
        [{"symbol": "SBIN", "quantity": 10, "avg_price": 100.0}],
        [],
    )
    assert mismatches[0]["symbol"] == "SBIN"
    assert mismatches[0]["severity"] == "CRITICAL"


@pytest.mark.asyncio
async def test_portfolio_engine_processes_filled_order():
    engine = PortfolioEngine(initial_capital=1000)
    await engine.on_order_state_event(fill_event())
    assert engine.get_positions()[0]["symbol"] == "SBIN"


@pytest.mark.asyncio
async def test_portfolio_engine_ignores_non_filled_order():
    engine = PortfolioEngine(initial_capital=1000)
    await engine.on_order_state_event(fill_event(status=OrderStatus.OPEN.value))
    assert engine.get_positions() == []


@pytest.mark.asyncio
async def test_portfolio_engine_updates_on_tick():
    engine = PortfolioEngine(initial_capital=1000)
    await engine.on_order_state_event(fill_event(price=100.0))
    await engine.on_tick("SBIN", 120.0)
    assert engine.get_summary()["unrealized_pnl"] == 200.0


def test_portfolio_summary_empty_state():
    summary = PortfolioEngine(initial_capital=1000).get_summary()
    assert summary["open_positions_count"] == 0
    assert summary["net_pnl"] == 0.0
    assert summary["source_of_truth"] == "INTERNAL"


@pytest.mark.asyncio
async def test_portfolio_routes_return_safe_json():
    original_token = settings.admin_token
    settings.admin_token = "ci-test-admin-token-do-not-use-in-prod"
    app = FastAPI()
    app.include_router(portfolio_router)
    app.state.portfolio_engine = PortfolioEngine(initial_capital=1000)
    transport = ASGITransport(app=app)
    headers = {"X-Admin-Token": "ci-test-admin-token-do-not-use-in-prod"}
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            summary = await client.get("/portfolio/summary")
            positions = await client.get("/portfolio/positions", headers=headers)
            holdings = await client.get("/portfolio/holdings", headers=headers)
            curve = await client.get("/portfolio/equity-curve", headers=headers)
            rec = await client.get("/portfolio/reconciliation/status", headers=headers)
    finally:
        settings.admin_token = original_token
    assert summary.status_code == 200
    assert positions.json() == {"positions": []}
    assert "summary" in holdings.json()
    assert "points" in curve.json()
    assert rec.json()["summary"]["ok"] is True


def test_api_server_import_safe():
    import backend.api_server as api_server

    assert api_server.execution_mode == TradingMode.PAPER.value
