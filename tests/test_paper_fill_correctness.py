from datetime import datetime, timezone

import pytest

from backend.core.events import OrderRequestEvent
from backend.core.types import OrderSide, OrderStatus, OrderType, TradingMode
from backend.execution.execution_router import ExecutionRouter
from backend.execution.order_store import OrderStore
from backend.execution.paper_execution_config import PaperExecutionConfig
from backend.execution.paper_order_manager import PaperOrderManager
from backend.portfolio.portfolio_engine import PortfolioEngine
from backend.portfolio.rebuild import rebuild_portfolio_from_fills


def _request(symbol: str = "SBIN", side: str = OrderSide.BUY.value) -> OrderRequestEvent:
    return OrderRequestEvent(
        symbol=symbol,
        side=side,
        quantity=10,
        order_type=OrderType.MARKET.value,
        price=None,
        strategy_name="paper_correctness",
        signal_event_id=None,
        trading_mode=TradingMode.PAPER.value,
        source="TEST",
    )


@pytest.mark.asyncio
async def test_paper_manager_without_order_store_is_compatibility_only():
    manager = PaperOrderManager(config=PaperExecutionConfig(allow_after_hours=True))

    event = await manager.place_order(_request(), {"ltp": 500.0})

    assert event.status == OrderStatus.FILLED.value
    assert manager.order_store is None


@pytest.mark.asyncio
async def test_router_paper_fill_is_visible_to_oms_and_portfolio_rebuild(tmp_path):
    store = OrderStore(str(tmp_path / "paper_oms.db"))
    router = ExecutionRouter(
        order_store=store,
        paper_config=PaperExecutionConfig(allow_after_hours=True),
    )
    request = _request()

    event = await router.route(
        request,
        {"ltp": 500.0, "received_at": datetime.now(timezone.utc).isoformat()},
    )

    assert event.status == OrderStatus.FILLED.value
    fills = store.get_recent_fills()
    assert len(fills) == 1
    assert fills[0]["request_id"] == request.event_id
    assert fills[0]["source"] == "paper"
    assert fills[0]["broker_order_id"] is None

    audit = store.get_order_audit(request.event_id)
    assert len(audit["fills"]) == 1
    assert audit["fills"][0]["fill_id"] == f"{request.event_id}:0"

    portfolio = PortfolioEngine(initial_capital=100_000.0)
    summary = rebuild_portfolio_from_fills(store, portfolio)

    assert summary.source == "fill_ledger"
    assert summary.total_fills_processed == 1
    assert summary.skipped_rows == 0
    position = portfolio.positions.get_position("SBIN")
    assert position is not None
    assert position["quantity"] == 10
