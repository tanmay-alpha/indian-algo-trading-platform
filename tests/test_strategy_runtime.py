# tests/test_strategy_runtime.py
"""
Tests for Strategy Runtime & Signal Queue - Phase 21A.
Uses temporary in-memory SQLite database, mock EventBus, and real CandleStore/IndicatorEngine components.
Strictly local testing, no live trading, no external broker calls.
"""

import json
import pytest
import asyncio
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.database import Base
from backend.db.models import StrategyConfigModel, StrategySignalModel
from backend.db.repositories.strategy_repository import StrategyRepository
from backend.strategy.runtime import StrategyRuntimeManager
from backend.core.events import OrderRequestEvent, OrderStateEvent
from backend.core.types import OrderStatus
from backend.core.orchestrator import SystemOrchestrator
from backend.core.event_bus import EventBus
from backend.candles.candle_store import CandleStore
from backend.indicators.engine import IndicatorEngine

# FastAPI Router testing imports
from fastapi import FastAPI
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Mocks & Helpers
# ---------------------------------------------------------------------------

class MockEventBus:
    def __init__(self):
        self.published = []
        self.listeners = {}

    def subscribe(self, event_type, callback):
        if event_type not in self.listeners:
            self.listeners[event_type] = []
        self.listeners[event_type].append(callback)

    async def publish(self, event):
        self.published.append(event)
        # Notify subscribers
        evt_type = getattr(event, "event_type", None) or type(event).__name__
        if evt_type in self.listeners:
            for cb in self.listeners[evt_type]:
                if asyncio.iscoroutinefunction(cb):
                    await cb(event)
                else:
                    cb(event)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

from sqlalchemy.pool import StaticPool

@pytest.fixture
def temp_db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def temp_db_session(temp_db_engine):
    Session = sessionmaker(bind=temp_db_engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def session_factory(temp_db_engine):
    return sessionmaker(bind=temp_db_engine)


@pytest.fixture
def mock_event_bus():
    return MockEventBus()


@pytest.fixture
def candle_store():
    # Fresh in-memory CandleStore
    return CandleStore()


@pytest.fixture
def runtime_manager(session_factory, mock_event_bus, candle_store):
    return StrategyRuntimeManager(
        session_factory=session_factory,
        event_bus=mock_event_bus,
        candle_store=candle_store
    )


@pytest.fixture
def repo():
    return StrategyRepository()


# ---------------------------------------------------------------------------
# 1. Strategy Repository CRUD Tests
# ---------------------------------------------------------------------------

def test_strategy_repository_crud(repo, temp_db_session):
    # Test Create
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Cross Test",
        template_id="ema_cross",
        symbols=["RELIANCE", "TCS"],
        timeframe="15m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    assert config.id is not None
    assert config.name == "EMA Cross Test"
    assert config.timeframe == "15m"
    assert config.status == "STOPPED"
    assert config.mode == "PAPER"
    
    # Verify symbols & parameters are correctly parsed
    assert repo.get_symbols(config) == ["RELIANCE", "TCS"]
    assert repo.get_parameters(config) == {"fast_ema": 9, "slow_ema": 21}

    # Test List
    configs = repo.list_configs(temp_db_session)
    assert len(configs) == 1
    assert configs[0].id == config.id

    # Test Retrieve by ID
    retrieved = repo.get_config_by_id(temp_db_session, config.id)
    assert retrieved is not None
    assert retrieved.name == "EMA Cross Test"

    # Test Update Status
    updated = repo.update_status(temp_db_session, config.id, "RUNNING")
    assert updated.status == "RUNNING"

    # Test Delete
    success = repo.delete_config(temp_db_session, config.id)
    assert success is True
    assert repo.get_config_by_id(temp_db_session, config.id) is None


def test_strategy_repository_signals(repo, temp_db_session):
    config = repo.create_config(
        session=temp_db_session,
        name="Signal Test Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="5m",
        parameters={},
        mode="REVIEW_ONLY"
    )
    
    # Save Signal
    sig = repo.save_signal(
        session=temp_db_session,
        strategy_id=config.id,
        symbol="SBIN",
        side="BUY",
        confidence=0.85,
        reason="EMA cross up",
        price=605.5,
        timeframe="5m",
        source_candle_time="2026-05-27T10:00:00Z"
    )
    assert sig.id is not None
    assert sig.strategy_id == config.id
    assert sig.status == "GENERATED"

    # Retrieve Signals for strategy
    signals = repo.get_signals_for_strategy(temp_db_session, config.id)
    assert len(signals) == 1
    assert signals[0].symbol == "SBIN"
    assert signals[0].side == "BUY"

    # Retrieve all signals
    all_signals = repo.get_all_signals(temp_db_session, limit=10)
    assert len(all_signals) == 1

    # Update signal status
    updated_sig = repo.update_signal_status(temp_db_session, sig.id, "APPROVED")
    assert updated_sig.status == "APPROVED"


# ---------------------------------------------------------------------------
# 2. Strategy Runtime Manager Lifecycle Tests
# ---------------------------------------------------------------------------

def test_runtime_manager_lifecycle(runtime_manager, temp_db_session):
    # Add a configuration directly to the database using repository
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Live",
        template_id="ema_cross",
        symbols=["INFY"],
        timeframe="1h",
        parameters={"fast": 5, "slow": 13},
        mode="PAPER"
    )
    # Commit is needed because manager runs in separate sessions
    temp_db_session.commit()

    # Start Strategy
    started = runtime_manager.start_strategy(config.id)
    assert started is True
    assert runtime_manager.active_strategies[config.id]["status"] == "RUNNING"
    assert runtime_manager.active_strategies[config.id]["config"]["name"] == "EMA Live"

    # Verify status in DB — expire session cache so we read fresh from DB
    temp_db_session.expire_all()
    refreshed = repo.get_config_by_id(temp_db_session, config.id)
    assert refreshed.status == "RUNNING"

    # Pause Strategy
    paused = runtime_manager.pause_strategy(config.id)
    assert paused is True
    assert runtime_manager.active_strategies[config.id]["status"] == "PAUSED"

    temp_db_session.expire_all()
    refreshed = repo.get_config_by_id(temp_db_session, config.id)
    assert refreshed.status == "PAUSED"

    # Stop Strategy
    stopped = runtime_manager.stop_strategy(config.id)
    assert stopped is True
    assert config.id not in runtime_manager.active_strategies

    temp_db_session.expire_all()
    refreshed = repo.get_config_by_id(temp_db_session, config.id)
    assert refreshed.status == "STOPPED"


# ---------------------------------------------------------------------------
# 3. Strategy Runtime Evaluation & Signal Routing Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_runtime_manager_evaluate_symbol_paper(runtime_manager, temp_db_session, mock_event_bus, candle_store):
    # Seed the strategy configuration
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Cross Paper",
        template_id="ema_cross",
        symbols=["RELIANCE"],
        timeframe="5m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    temp_db_session.commit()

    # Start it so it's active in manager memory
    runtime_manager.start_strategy(config.id)

    # Seed candles: 25 flat + 1 sharply rising candle so EMA(9) crosses EMA(21) on the final candle.
    # This satisfies the runtime's requirement that the signal timestamp == last candle timestamp.
    now = datetime.now(timezone.utc)
    base_time = int(now.timestamp()) - 30 * 300

    for i in range(25):
        candle_store.add_candle("5m", "RELIANCE", {
            "timestamp": base_time + (i * 300),
            "open": 2398.0, "high": 2405.0, "low": 2395.0, "close": 2400.0, "volume": 1000
        })
    # The final candle rises sharply — EMA9 crosses above EMA21 here
    candle_store.add_candle("5m", "RELIANCE", {
        "timestamp": base_time + 25 * 300,
        "open": 2435.0, "high": 2450.0, "low": 2430.0, "close": 2440.0, "volume": 3000
    })

    # Trigger manual evaluation for RELIANCE
    # Should calculate EMA, detect bullish crossover (fast > slow), generate BUY signal
    await runtime_manager.evaluate_symbol(config.id, "RELIANCE")

    # Verify that a signal was generated, stored in DB, and published to EventBus
    # 1. Inspect DB signals
    signals = repo.get_signals_for_strategy(temp_db_session, config.id)
    assert len(signals) == 1
    sig = signals[0]
    assert sig.symbol == "RELIANCE"
    assert sig.side == "BUY"
    assert sig.status == "GENERATED"

    # 2. Inspect EventBus messages
    assert len(mock_event_bus.published) == 0


@pytest.mark.asyncio
async def test_runtime_manager_auto_paper_publication_does_not_mark_executed(runtime_manager, temp_db_session, mock_event_bus, candle_store):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Cross Auto Paper",
        template_id="ema_cross",
        symbols=["RELIANCE"],
        timeframe="5m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    config.auto_paper_enabled = True
    temp_db_session.commit()
    runtime_manager.start_strategy(config.id)

    now = datetime.now(timezone.utc)
    base_time = int(now.timestamp()) - 30 * 300
    for i in range(25):
        candle_store.add_candle("5m", "RELIANCE", {
            "timestamp": base_time + (i * 300),
            "open": 2398.0, "high": 2405.0, "low": 2395.0, "close": 2400.0, "volume": 1000
        })
    candle_store.add_candle("5m", "RELIANCE", {
        "timestamp": base_time + 25 * 300,
        "open": 2435.0, "high": 2450.0, "low": 2430.0, "close": 2440.0, "volume": 3000
    })

    await runtime_manager.evaluate_symbol(config.id, "RELIANCE")

    signals = repo.get_signals_for_strategy(temp_db_session, config.id)
    assert len(signals) == 1
    sig = signals[0]
    assert sig.status == "APPROVED_PAPER"
    assert sig.status != "PAPER_EXECUTED"

    assert len(mock_event_bus.published) == 1
    event = mock_event_bus.published[0]
    assert event.event_type in ("SIGNAL", "SignalEvent")
    assert event.data["signal_id"] == sig.id


@pytest.mark.asyncio
async def test_runtime_manager_evaluate_symbol_review_only(runtime_manager, temp_db_session, mock_event_bus, candle_store):
    # Seed configuration in REVIEW_ONLY mode
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Cross Review",
        template_id="ema_cross",
        symbols=["TCS"],
        timeframe="5m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="REVIEW_ONLY"
    )
    temp_db_session.commit()

    # Start it
    runtime_manager.start_strategy(config.id)

    # Seed candles: 25 flat + 1 sharply rising candle so EMA(9) crosses EMA(21) on the final candle
    now = datetime.now(timezone.utc)
    base_time = int(now.timestamp()) - 30 * 300
    for i in range(25):
        candle_store.add_candle("5m", "TCS", {
            "timestamp": base_time + (i * 300),
            "open": 3198.0, "high": 3205.0, "low": 3195.0, "close": 3200.0, "volume": 500
        })
    candle_store.add_candle("5m", "TCS", {
        "timestamp": base_time + 25 * 300,
        "open": 3235.0, "high": 3250.0, "low": 3230.0, "close": 3240.0, "volume": 1200
    })

    # Evaluate
    await runtime_manager.evaluate_symbol(config.id, "TCS")

    # Verify signal generated in DB with status "GENERATED" (requires review)
    signals = repo.get_signals_for_strategy(temp_db_session, config.id)
    assert len(signals) == 1
    sig = signals[0]
    assert sig.symbol == "TCS"
    assert sig.side == "BUY"
    assert sig.status == "GENERATED"

    # Verify NO EventBus message published since it requires review
    assert len(mock_event_bus.published) == 0


@pytest.mark.asyncio
async def test_runtime_manager_evaluate_symbol_duplicate_suppression(runtime_manager, temp_db_session, candle_store):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Cross Suppressed",
        template_id="ema_cross",
        symbols=["INFY"],
        timeframe="5m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    temp_db_session.commit()
    runtime_manager.start_strategy(config.id)

    # Seed candles: 25 flat + 1 sharply rising candle so EMA(9) crosses EMA(21) on the final candle
    now = datetime.now(timezone.utc)
    base_time = int(now.timestamp()) - 30 * 300
    for i in range(25):
        candle_store.add_candle("5m", "INFY", {
            "timestamp": base_time + (i * 300),
            "open": 1398.0, "high": 1405.0, "low": 1395.0, "close": 1400.0, "volume": 2000
        })
    candle_store.add_candle("5m", "INFY", {
        "timestamp": base_time + 25 * 300,
        "open": 1435.0, "high": 1448.0, "low": 1430.0, "close": 1440.0, "volume": 4000
    })

    # Evaluate first time -> generates signal
    await runtime_manager.evaluate_symbol(config.id, "INFY")
    assert len(repo.get_signals_for_strategy(temp_db_session, config.id)) == 1

    # Evaluate second time immediately -> should be suppressed
    await runtime_manager.evaluate_symbol(config.id, "INFY")
    assert len(repo.get_signals_for_strategy(temp_db_session, config.id)) == 1  # Still 1, no duplicate


@pytest.mark.asyncio
async def test_runtime_manager_approve_signal(runtime_manager, temp_db_session, mock_event_bus):
    # Seed config and signal in DB
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="EMA Review",
        template_id="ema_cross",
        symbols=["TCS"],
        timeframe="5m",
        parameters={},
        mode="REVIEW_ONLY"
    )
    sig = repo.save_signal(
        session=temp_db_session,
        strategy_id=config.id,
        symbol="TCS",
        side="BUY",
        confidence=0.9,
        reason="EMA cross up",
        price=3500.0,
        timeframe="5m",
        source_candle_time="2026-05-27T10:00:00Z"
    )
    temp_db_session.commit()

    # Manual approval via manager
    success = await runtime_manager.approve_signal(sig.id)
    assert success is True

    # Check signal status is APPROVED_PAPER in DB. Actual PAPER_EXECUTED is set
    # only after the order/fill outcome is confirmed.
    temp_db_session.refresh(sig)
    assert sig.status == "APPROVED_PAPER"

    # Check published to event bus
    assert len(mock_event_bus.published) == 1
    event = mock_event_bus.published[0]
    assert event.event_type in ("SIGNAL", "SignalEvent")
    assert event.data["symbol"] == "TCS"
    assert event.data["side"] == "BUY"
    assert event.data["mode"] == "PAPER"  # executes as paper trade on OMS once approved
    assert event.data["signal_id"] == sig.id


# ---------------------------------------------------------------------------
# 4. Strategy Signal Execution Status Mapping
# ---------------------------------------------------------------------------

def _status_orchestrator(session_factory):
    orchestrator = object.__new__(SystemOrchestrator)
    orchestrator.session_factory = session_factory
    return orchestrator


def _strategy_signal(repo, session):
    config = repo.create_strategy_config(
        session=session,
        name="Status Mapping Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="5m",
        parameters={},
        mode="PAPER",
        auto_paper_enabled=True,
    )
    return repo.save_signal(
        session=session,
        strategy_id=config.id,
        symbol="SBIN",
        side="BUY",
        confidence=0.9,
        reason="status mapping",
        price=500.0,
        timeframe="5m",
        source_candle_time="2026-05-27T10:00:00Z",
        status="APPROVED_PAPER",
    )


def _order_request_for_signal(signal_id: int) -> OrderRequestEvent:
    return OrderRequestEvent(
        symbol="SBIN",
        side="BUY",
        quantity=1,
        order_type="MARKET",
        price=500.0,
        strategy_name="ema_cross",
        signal_event_id="signal-event-id",
        trading_mode="PAPER",
        source="AUTOMATIC",
        strategy_signal_id=signal_id,
    )


def _order_state(status: str, reason: str | None = None) -> OrderStateEvent:
    return OrderStateEvent(
        order_id="order-1",
        broker_order_id=None,
        symbol="SBIN",
        side="BUY",
        quantity=1,
        filled_quantity=1 if status == OrderStatus.FILLED.value else 0,
        avg_fill_price=500.0 if status == OrderStatus.FILLED.value else None,
        status=status,
        reject_reason=reason,
        order_request_id="request-1",
    )


def test_strategy_signal_marked_executed_only_after_filled_order(session_factory, temp_db_session):
    repo = StrategyRepository()
    signal = _strategy_signal(repo, temp_db_session)
    orchestrator = _status_orchestrator(session_factory)

    orchestrator._update_strategy_signal_from_order_result(
        _order_request_for_signal(signal.id),
        _order_state(OrderStatus.FILLED.value),
    )

    temp_db_session.refresh(signal)
    assert signal.status == "PAPER_EXECUTED"


def test_strategy_signal_rejected_order_is_not_marked_executed(session_factory, temp_db_session):
    repo = StrategyRepository()
    signal = _strategy_signal(repo, temp_db_session)
    orchestrator = _status_orchestrator(session_factory)

    orchestrator._update_strategy_signal_from_order_result(
        _order_request_for_signal(signal.id),
        _order_state(OrderStatus.REJECTED.value, "max_order_qty"),
    )

    temp_db_session.refresh(signal)
    assert signal.status == "REJECTED"
    assert signal.dismiss_reason == "max_order_qty"


def test_strategy_signal_open_order_is_pending_not_executed(session_factory, temp_db_session):
    repo = StrategyRepository()
    signal = _strategy_signal(repo, temp_db_session)
    orchestrator = _status_orchestrator(session_factory)

    orchestrator._update_strategy_signal_from_order_result(
        _order_request_for_signal(signal.id),
        _order_state(OrderStatus.OPEN.value, "LIMIT_NOT_CROSSED"),
    )

    temp_db_session.refresh(signal)
    assert signal.status == "PAPER_PENDING"
    assert signal.status != "PAPER_EXECUTED"


# ---------------------------------------------------------------------------
# 5. Strategy API Router Tests
# ---------------------------------------------------------------------------

@pytest.fixture
def router_app(session_factory, runtime_manager, monkeypatch):
    """Build a TestClient whose routes run against our mock DB & runtime manager."""
    from backend.routers import strategies as strategies_module
    from backend.routers.strategies import router as strategies_router
    
    # Overwrite DB session getter
    monkeypatch.setattr(strategies_module, "_get_session", lambda: session_factory())

    # Monkeypatch the module level cache for strategy_runtime_manager
    # In backend/routers/strategies.py:
    # runtime = getattr(request.app.state, "strategy_runtime_manager", None)
    
    app = FastAPI()
    app.include_router(strategies_router)
    app.state.strategy_runtime_manager = runtime_manager
    
    # Setup settings admin_token bypass for test
    from backend.core import config as _cfg
    monkeypatch.setattr(_cfg.settings, "admin_token", "test-admin-token")
    
    return TestClient(app, raise_server_exceptions=True)


ADMIN_HEADERS = {"X-Admin-Token": "test-admin-token"}


def test_api_list_configs(router_app, temp_db_session):
    repo = StrategyRepository()
    repo.create_config(
        session=temp_db_session,
        name="API Strategy 1",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="15m",
        parameters={},
        mode="PAPER"
    )
    temp_db_session.commit()

    resp = router_app.get("/strategies/configs")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "API Strategy 1"
    assert data[0]["status"] == "STOPPED"


def test_api_create_config_validation(router_app, temp_db_session):
    # 1. Invalid Template
    resp = router_app.post(
        "/strategies/configs",
        json={
            "name": "Invalid Template Strategy",
            "template_id": "nonexistent_template",
            "symbols": ["SBIN"],
            "timeframe": "15m",
            "parameters": {},
            "mode": "PAPER"
        },
        headers=ADMIN_HEADERS
    )
    assert resp.status_code == 400
    assert "Unsupported strategy template" in resp.json()["detail"]

    # 2. Invalid Timeframe
    resp = router_app.post(
        "/strategies/configs",
        json={
            "name": "Invalid Timeframe Strategy",
            "template_id": "ema_cross",
            "symbols": ["SBIN"],
            "timeframe": "60hr",
            "parameters": {"fast_ema": 9, "slow_ema": 21},
            "mode": "PAPER"
        },
        headers=ADMIN_HEADERS
    )
    assert resp.status_code == 400
    assert "Invalid timeframe" in resp.json()["detail"]

    # 3. Invalid parameters schema
    resp = router_app.post(
        "/strategies/configs",
        json={
            "name": "Invalid Params Strategy",
            "template_id": "ema_cross",
            "symbols": ["SBIN"],
            "timeframe": "15m",
            "parameters": {"fast_ema": "should_be_int", "slow_ema": 21},
            "mode": "PAPER"
        },
        headers=ADMIN_HEADERS
    )
    assert resp.status_code == 400
    assert "validation error" in resp.json()["detail"].lower()

    # 4. Valid Config Creation
    resp = router_app.post(
        "/strategies/configs",
        json={
            "name": "Valid Strategy",
            "template_id": "ema_cross",
            "symbols": ["SBIN"],
            "timeframe": "15m",
            "parameters": {"fast_ema": 9, "slow_ema": 21},
            "mode": "PAPER"
        },
        headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Valid Strategy"
    assert data["mode"] == "PAPER"
    assert data["status"] == "STOPPED"


def test_api_patch_config(router_app, temp_db_session):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="Patch Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="15m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    temp_db_session.commit()

    resp = router_app.patch(
        f"/strategies/configs/{config.id}",
        json={
            "name": "Patched Name",
            "symbols": ["SBIN", "RELIANCE"],
            "parameters": {"fast_ema": 10, "slow_ema": 30}
        },
        headers=ADMIN_HEADERS
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Patched Name"
    assert data["symbols"] == ["SBIN", "RELIANCE"]
    assert data["parameters"] == {"fast_ema": 10, "slow_ema": 30}


def test_api_delete_config(router_app, temp_db_session):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="Delete Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="15m",
        parameters={},
        mode="PAPER"
    )
    temp_db_session.commit()

    resp = router_app.delete(f"/strategies/configs/{config.id}", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"

    # Verify not in DB
    assert repo.get_config_by_id(temp_db_session, config.id) is None


def test_api_start_stop_pause_strategy(router_app, temp_db_session, runtime_manager):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="Lifecycle Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="15m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    temp_db_session.commit()

    # 1. Start it
    resp = router_app.post(f"/strategies/configs/{config.id}/start", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "RUNNING"
    assert config.id in runtime_manager.active_strategies

    # 2. Pause it
    resp = router_app.post(f"/strategies/configs/{config.id}/pause", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "PAUSED"
    assert runtime_manager.active_strategies[config.id]["status"] == "PAUSED"

    # 3. Stop it
    resp = router_app.post(f"/strategies/configs/{config.id}/stop", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "STOPPED"
    assert config.id not in runtime_manager.active_strategies


def test_api_evaluate_endpoint(router_app, temp_db_session):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="Evaluate Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="15m",
        parameters={"fast_ema": 9, "slow_ema": 21},
        mode="PAPER"
    )
    temp_db_session.commit()

    # Must start first to evaluate
    router_app.post(f"/strategies/configs/{config.id}/start", headers=ADMIN_HEADERS)

    # Trigger evaluate
    resp = router_app.post(f"/strategies/configs/{config.id}/evaluate", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert "evaluation_triggered" in resp.json()


def test_api_signals_endpoints(router_app, temp_db_session):
    repo = StrategyRepository()
    config = repo.create_config(
        session=temp_db_session,
        name="Signals API Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="15m",
        parameters={},
        mode="REVIEW_ONLY"
    )
    sig = repo.save_signal(
        session=temp_db_session,
        strategy_id=config.id,
        symbol="SBIN",
        side="BUY",
        confidence=0.9,
        reason="EMA cross up",
        price=600.0,
        timeframe="15m",
        source_candle_time="2026-05-27T10:00:00Z"
    )
    temp_db_session.commit()

    # 1. Get strategy-specific signals
    resp = router_app.get(f"/strategies/configs/{config.id}/signals")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "SBIN"
    assert data[0]["side"] == "BUY"

    # 2. Get all signals
    resp = router_app.get("/strategies/signals")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "SBIN"

    # 3. Approve signal
    resp = router_app.post(f"/strategies/signals/{sig.id}/approve-paper", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "APPROVED_PAPER"

    # Verify status updated
    temp_db_session.refresh(sig)
    assert sig.status == "APPROVED_PAPER"
