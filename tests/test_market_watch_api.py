from fastapi.testclient import TestClient

import backend.api_server as api
from backend.gateway.instrument_registry import get_token, search_symbols, validate_symbols


client = TestClient(api.app)


def test_registry_search_returns_known_fallback_symbols():
    results = search_symbols("SBIN")

    assert any(item["symbol"] == "SBIN" for item in results)


def test_get_token_returns_known_fallback_token():
    assert get_token("SBIN") == "3045"


def test_unknown_symbol_returns_none():
    assert get_token("NOT_A_SYMBOL") is None


def test_validate_symbols_separates_valid_and_invalid():
    valid, invalid = validate_symbols(["SBIN", "NOT_A_SYMBOL"])

    assert valid == ["SBIN"]
    assert invalid == ["NOT_A_SYMBOL"]


def test_instruments_search_route_works():
    response = client.get("/instruments/search?q=RELIANCE&limit=20")

    assert response.status_code == 200
    assert any(item["symbol"] == "RELIANCE" for item in response.json()["results"])


def test_market_watch_route_works():
    response = client.get("/market-watch")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_post_market_watch_rejects_unknown_symbols():
    response = client.post("/market-watch", json={"symbols": ["SBIN", "NOT_A_SYMBOL"]})

    assert response.status_code == 400
    assert "NOT_A_SYMBOL" in response.json()["detail"]["invalid_symbols"]


def test_post_market_watch_accepts_valid_symbols():
    response = client.post("/market-watch", json={"symbols": ["SBIN", "RELIANCE"]})

    assert response.status_code == 200
    assert response.json()["symbols"] == ["SBIN", "RELIANCE"]


def test_indices_returns_safe_structure():
    response = client.get("/indices")

    assert response.status_code == 200
    items = response.json()["indices"]
    assert {item["symbol"] for item in items} == {"NIFTY", "BANKNIFTY", "SENSEX"}
    assert all(item["status"] == "unavailable" for item in items)
    assert all(item["ltp"] is None for item in items)


def test_terminal_status_returns_safe_structure():
    response = client.get("/terminal/status")

    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert "broker" in data
    assert "event_bus" in data
    assert "trading_mode" in data


def test_api_server_imports_safely():
    assert api.app is not None
