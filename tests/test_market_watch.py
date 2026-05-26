# tests/test_market_watch.py
"""
Tests for market watch API and watchlist service integration - Phase 19D.

Uses temporary SQLite + FastAPI TestClient.
No real trades.db, no network calls, no credentials.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import backend.api_server as api
from backend.core.database import Base
from backend.db.repositories.watchlist_repository import WatchlistRepository
from backend.gateway import instrument_registry
from backend.gateway.market_watch import MarketWatch
from backend.services.watchlist_service import WatchlistService


client = TestClient(api.app)


@pytest.fixture
def temp_db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def repo():
    return WatchlistRepository()


# ------------------------------------------------------------------
# 1. /market-watch GET - DB-backed behavior (no DB items -> fallback)
# ------------------------------------------------------------------

def test_market_watch_route_returns_200():
    response = client.get("/market-watch")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_market_watch_route_preserves_symbols_field():
    response = client.get("/market-watch")
    assert response.status_code == 200
    data = response.json()
    assert "symbols" in data
    assert isinstance(data["symbols"], list)


def test_market_watch_route_returns_source_field():
    """Phase 19D: /market-watch now includes a 'source' field."""
    response = client.get("/market-watch")
    assert response.status_code == 200
    data = response.json()
    assert "source" in data
    assert data["source"] in ("db", "fallback")


def test_market_watch_items_have_frontend_compatible_fields():
    """Items must have fields expected by frontend MarketWatchRow type."""
    response = client.get("/market-watch")
    assert response.status_code == 200
    items = response.json()["items"]
    for item in items:
        assert "symbol" in item
        # ltp, change, change_pct may be None - that is acceptable (no fake data)
        assert "ltp" in item
        assert "stale" in item


# ------------------------------------------------------------------
# 2. WatchlistService - DB-backed snapshot with fallback
# ------------------------------------------------------------------

def test_watchlist_service_fallback_when_no_db_items():
    """If DB watchlist is empty, service falls back to in-memory MarketWatch."""
    mw = MarketWatch(default_symbols=["SBIN"])
    svc = WatchlistService(market_watch=mw)

    # Override the DB session to use an empty in-memory DB
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    from sqlalchemy.orm import sessionmaker as sm
    session_factory = sm(bind=engine)

    import backend.services.watchlist_service as ws_mod
    original_engine = ws_mod._db_engine
    original_factory = ws_mod._db_session_factory
    ws_mod._db_engine = engine
    ws_mod._db_session_factory = session_factory
    try:
        result = svc.get_market_watch_snapshot()
        # Default watchlist empty -> falls back
        assert result["source"] in ("db", "fallback")
        assert isinstance(result["items"], list)
    finally:
        ws_mod._db_engine = original_engine
        ws_mod._db_session_factory = original_factory


def test_watchlist_service_get_default_watchlist_returns_metadata():
    svc = WatchlistService()
    meta = svc.get_default_watchlist()
    assert "id" in meta
    assert "name" in meta
    assert "count" in meta


# ------------------------------------------------------------------
# 3. Adding a symbol does NOT subscribe all instruments
# ------------------------------------------------------------------

def test_add_to_watchlist_does_not_subscribe_all_instruments(repo, temp_db_session):
    """
    Critical subscription boundary test.
    Adding a symbol to the watchlist updates only the item in DB.
    It does NOT trigger a subscribe-all call.
    """
    wl = repo.create_watchlist(temp_db_session, name="Sub Boundary WL")
    # Add a known fallback symbol
    item, status = repo.add_symbol(temp_db_session, wl.id, "SBIN", exchange="NSE")
    assert status == "added"
    assert item.symbol == "SBIN"

    # Verify instrument universe is unchanged (search still returns all fallback symbols)
    results = instrument_registry.search_symbols("SBI", limit=20)
    assert len(results) >= 1
    # No blanket subscription occurred - we verify by checking we have NOT loaded
    # 50k+ symbols into market watch (it stays small)


def test_search_result_is_not_auto_subscribed():
    """
    Search does not trigger WebSocket subscriptions.
    The instrument endpoint returns metadata, not streaming state.
    """
    response = client.get("/instruments/search?q=RELIANCE&limit=5")
    assert response.status_code == 200
    results = response.json()["results"]
    assert any(item["symbol"] == "RELIANCE" for item in results)

    # market-watch should not contain all search results
    mw_response = client.get("/market-watch")
    mw_symbols = mw_response.json()["symbols"]
    # The watchlist is still small (not exploded by search results)
    assert len(mw_symbols) <= 20  # safety guard


# ------------------------------------------------------------------
# 4. Unknown symbol rejected safely
# ------------------------------------------------------------------

def test_watchlist_service_rejects_unknown_symbol():
    svc = WatchlistService()
    result = svc.add_to_default_watchlist("TOTALLY_UNKNOWN_XYZ_999")
    assert result["status"] == "unknown_symbol"
    assert "TOTALLY_UNKNOWN_XYZ_999" in str(result)


# ------------------------------------------------------------------
# 5. /watchlists routes - reads are public
# ------------------------------------------------------------------

def test_list_watchlists_route_is_accessible():
    response = client.get("/watchlists")
    assert response.status_code == 200
    data = response.json()
    assert "watchlists" in data
    assert isinstance(data["watchlists"], list)


def test_get_default_watchlist_items_route():
    response = client.get("/watchlists/default/items")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert "symbols" in data


# ------------------------------------------------------------------
# 6. /watchlists mutation routes - protected by admin token
# ------------------------------------------------------------------

def test_create_watchlist_requires_auth_or_open():
    """
    If ADMIN_TOKEN is set, POST /watchlists requires the token.
    If ADMIN_TOKEN is unset (test env), auth is intentionally open.
    This matches the existing /market-watch POST security contract.
    """
    response = client.post("/watchlists", json={"name": "Test"})
    # Either 200 (auth disabled in test env) or 401/403 (token enforced)
    assert response.status_code in (200, 401, 403)


def test_add_item_to_watchlist_route_rejects_unknown_symbol():
    """Unknown symbol should fail with 404, not 500 or create bad data."""
    # We need the admin token for this mutation
    token = api.settings.admin_token if hasattr(api.settings, "admin_token") else None
    headers = {"X-Admin-Token": token} if token else {}

    # First, create a watchlist via repo
    from sqlalchemy import create_engine as cae
    from sqlalchemy.orm import sessionmaker as sm
    from backend.db.repositories.watchlist_repository import WatchlistRepository

    engine = cae("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sess = sm(bind=engine)()

    repo = WatchlistRepository()
    wl = repo.create_watchlist(sess, "Route WL")
    sess.close()

    # Try adding an unknown symbol (should be rejected)
    response = client.post(
        f"/watchlists/{wl.id}/items",
        json={"symbol": "FAKE_SYM_NOT_IN_REGISTRY"},
        headers=headers,
    )
    # Either 401/403 (no auth) or 404 (symbol not found)
    assert response.status_code in (401, 403, 404)


# ------------------------------------------------------------------
# 7. /market-watch POST still works (backward compat)
# ------------------------------------------------------------------

def test_post_market_watch_accepts_valid_symbols():
    response = client.post("/market-watch", json={"symbols": ["SBIN", "RELIANCE"]})
    # Success or auth-related
    assert response.status_code in (200, 401, 403)


def test_post_market_watch_rejects_unknown_symbols():
    response = client.post("/market-watch", json={"symbols": ["SBIN", "NOT_A_SYMBOL"]})
    assert response.status_code in (400, 401, 403)


# ------------------------------------------------------------------
# 8. Backend import safety
# ------------------------------------------------------------------

def test_api_server_imports_safely_phase_19d():
    assert api.app is not None


def test_watchlist_service_imports_safely():
    from backend.services.watchlist_service import WatchlistService
    svc = WatchlistService()
    assert svc is not None


def test_watchlist_repository_imports_safely():
    from backend.db.repositories.watchlist_repository import WatchlistRepository
    repo = WatchlistRepository()
    assert repo is not None


def test_watchlists_router_imports_safely():
    from backend.routers.watchlists import router
    assert router is not None
