# tests/test_strategy_scheduler.py
"""
Tests for Strategy Autopilot Scheduler - Phase 21D.
Uses temporary in-memory SQLite database, MockRuntimeManager, and TestClient.
Strictly local testing, no live trading, no external broker calls.
"""

import json
import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.database import Base
from backend.db.models import StrategyConfigModel, StrategySignalModel
from backend.db.repositories.strategy_repository import StrategyRepository
from backend.strategy.scheduler import StrategyScheduler

# FastAPI Router testing imports
from fastapi import FastAPI
from fastapi.testclient import TestClient

class MockRuntimeManager:
    def __init__(self):
        self.evaluated = []

    async def evaluate_symbol(self, strategy_config, symbol, session=None):
        self.evaluated.append((strategy_config.id, symbol))


@pytest.fixture
def temp_db_engine():
    from sqlalchemy.pool import StaticPool
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
def mock_runtime_manager():
    return MockRuntimeManager()


@pytest.fixture
def scheduler(session_factory, mock_runtime_manager):
    return StrategyScheduler(
        session_factory=session_factory,
        runtime_manager=mock_runtime_manager
    )


@pytest.fixture
def repo():
    return StrategyRepository()


@pytest.fixture
def router_app(session_factory, scheduler, monkeypatch):
    """Build a TestClient whose routes run against our mock DB & scheduler."""
    from backend.routers import strategies as strategies_module
    from backend.routers.strategies import router as strategies_router
    
    # Overwrite DB session getter
    monkeypatch.setattr(strategies_module, "_get_session", lambda: session_factory())
    
    app = FastAPI()
    app.include_router(strategies_router)
    app.state.strategy_scheduler = scheduler
    
    # Setup settings admin_token bypass for test
    from backend.core import config as _cfg
    monkeypatch.setattr(_cfg.settings, "admin_token", "test-admin-token")
    
    return TestClient(app, raise_server_exceptions=True)


ADMIN_HEADERS = {"X-Admin-Token": "test-admin-token"}


@pytest.mark.asyncio
async def test_scheduler_lifecycle(scheduler):
    # Initial state
    assert scheduler.is_running is False
    
    # Start scheduler
    await scheduler.start()
    assert scheduler.is_running is True
    
    # Starting again should be idempotent
    await scheduler.start()
    assert scheduler.is_running is True
    
    # Stop scheduler
    await scheduler.stop()
    assert scheduler.is_running is False
    
    # Stopping again should be idempotent
    await scheduler.stop()
    assert scheduler.is_running is False


@pytest.mark.asyncio
async def test_scheduler_tick_due(scheduler, temp_db_session, mock_runtime_manager, repo):
    # Seed a RUNNING config with auto_paper_enabled = True and next_evaluation_at = None (or past)
    config = repo.create_strategy_config(
        session=temp_db_session,
        name="Auto Strategy Due",
        template_id="ema_cross",
        symbols=["TCS", "INFY"],
        timeframe="5m",
        parameters={},
        mode="PAPER",
        auto_paper_enabled=True,
        evaluation_interval_seconds=60,
    )
    # Set status to RUNNING
    repo.update_strategy_status(temp_db_session, config.id, "RUNNING")
    temp_db_session.commit()
    
    # Run tick_once
    await scheduler.tick_once()
    
    # Verify evaluate_symbol was called for both TCS and INFY
    assert len(mock_runtime_manager.evaluated) == 2
    assert (config.id, "TCS") in mock_runtime_manager.evaluated
    assert (config.id, "INFY") in mock_runtime_manager.evaluated
    
    # Verify database fields updated
    temp_db_session.refresh(config)
    assert config.last_evaluated_at is not None
    assert config.next_evaluation_at is not None
    
    # Check next_evaluation_at is roughly 60 seconds from last_evaluated_at
    last_dt = datetime.fromisoformat(config.last_evaluated_at.replace("Z", "+00:00"))
    next_dt = datetime.fromisoformat(config.next_evaluation_at.replace("Z", "+00:00"))
    diff = (next_dt - last_dt).total_seconds()
    assert abs(diff - 60.0) < 5.0


@pytest.mark.asyncio
async def test_scheduler_tick_not_due(scheduler, temp_db_session, mock_runtime_manager, repo):
    # Seed a RUNNING config with next_evaluation_at in the future
    future_time = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
    config = repo.create_strategy_config(
        session=temp_db_session,
        name="Auto Strategy Future",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="5m",
        parameters={},
        mode="PAPER",
        auto_paper_enabled=True,
        evaluation_interval_seconds=60,
    )
    # Set next_evaluation_at and RUNNING
    repo.update_strategy_config(temp_db_session, config.id, next_evaluation_at=future_time, status="RUNNING")
    temp_db_session.commit()
    
    # Run tick_once
    await scheduler.tick_once()
    
    # Verify evaluate_symbol was NOT called
    assert len(mock_runtime_manager.evaluated) == 0
    
    # Verify database fields NOT updated
    temp_db_session.refresh(config)
    assert config.last_evaluated_at is None
    assert config.next_evaluation_at == future_time


def test_api_scheduler_endpoints(router_app, temp_db_session, repo):
    # 1. Check status (initially not running)
    resp = router_app.get("/strategies/scheduler/status", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_running"] is False
    assert data["active_tasks_count"] == 0
    assert data["running_strategy_ids"] == []

    # Seed a running strategy to verify count
    config = repo.create_strategy_config(
        session=temp_db_session,
        name="API Running Strategy",
        template_id="ema_cross",
        symbols=["SBIN"],
        timeframe="5m",
        parameters={},
        mode="PAPER",
        auto_paper_enabled=True,
    )
    repo.update_strategy_status(temp_db_session, config.id, "RUNNING")
    temp_db_session.commit()

    # Get status again
    resp = router_app.get("/strategies/scheduler/status", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_tasks_count"] == 1
    assert config.id in data["running_strategy_ids"]

    # 2. Start scheduler via API
    resp = router_app.post("/strategies/scheduler/start", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUCCESS"

    # Status check after starting
    resp = router_app.get("/strategies/scheduler/status", headers=ADMIN_HEADERS)
    assert resp.json()["is_running"] is True

    # 3. Stop scheduler via API
    resp = router_app.post("/strategies/scheduler/stop", headers=ADMIN_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUCCESS"

    # Status check after stopping
    resp = router_app.get("/strategies/scheduler/status", headers=ADMIN_HEADERS)
    assert resp.json()["is_running"] is False
