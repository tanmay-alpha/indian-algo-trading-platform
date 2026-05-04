import json

from fastapi.testclient import TestClient

from backend.api_server import app
from backend.gateway import instrument_registry
from backend.gateway.instrument_loader import InstrumentLoader


def setup_function():
    instrument_registry._CACHE = None
    instrument_registry._MASTER_SOURCE = "fallback"


def teardown_function():
    instrument_registry._CACHE = None
    instrument_registry._MASTER_SOURCE = "fallback"


def test_filter_nse_equity():
    loader = InstrumentLoader()
    rows = [
        {
            "exch_seg": "NSE",
            "symbol": "SBIN-EQ",
            "token": "3045",
            "name": "STATE BANK",
            "lotsize": "1",
            "tick_size": "0.05",
            "instrumenttype": "",
        },
        {"exch_seg": "NFO", "symbol": "SBIN-EQ", "token": "x"},
        {"exch_seg": "NSE", "symbol": "SBIN-BL", "token": "y"},
    ]

    filtered = loader.filter_nse_equity(rows)

    assert len(filtered) == 1
    assert filtered[0]["symbol"] == "SBIN-EQ"
    assert filtered[0]["name"] == "STATE BANK"


def test_load_from_cache_missing_file_returns_empty(tmp_path):
    loader = InstrumentLoader(
        cache_path=tmp_path / "missing.json",
        meta_path=tmp_path / "missing_meta.json",
    )

    assert loader.load_from_cache() == []


def test_registry_loads_normalized_instruments():
    count = instrument_registry.load_from_instrument_master([
        {
            "symbol": "TESTCO-EQ",
            "token": "111",
            "name": "Test Company",
            "exchange": "NSE",
            "instrument_type": "EQ",
            "lotsize": "1",
            "tick_size": "0.05",
        }
    ])

    assert count == 1
    assert instrument_registry.get_token("TESTCO") == "111"
    assert instrument_registry.search_symbols("test")[0]["symbol"] == "TESTCO-EQ"


def test_registry_keeps_fallback_on_empty_or_bad_input():
    fallback_count = len(instrument_registry.load_instruments(force_reload=True))

    assert instrument_registry.load_from_instrument_master([]) == 0
    assert len(instrument_registry.load_instruments()) == fallback_count
    assert instrument_registry.get_token("SBIN") == "3045"

    assert instrument_registry.load_from_instrument_master([{"symbol": "", "token": None}]) == 0
    assert len(instrument_registry.load_instruments()) == fallback_count
    assert instrument_registry.get_token("SBIN") == "3045"


def test_instrument_master_status_route_returns_safe_shape():
    client = TestClient(app)
    response = client.get("/instruments/master/status")

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {
        "loaded",
        "source",
        "cached_at",
        "cache_fresh",
        "fallback_active",
    }
    assert isinstance(data["loaded"], int)
    assert data["source"] in {"cache", "download", "fallback"}


def test_cache_is_fresh_uses_metadata(tmp_path):
    cache_path = tmp_path / "instrument_master.json"
    meta_path = tmp_path / "instrument_master_meta.json"
    cache_path.write_text("[]", encoding="utf-8")
    meta_path.write_text(
        json.dumps({"cached_at": "2099-01-01T00:00:00Z", "source": "download", "count": 0}),
        encoding="utf-8",
    )
    loader = InstrumentLoader(cache_path=cache_path, meta_path=meta_path)

    assert loader.cache_is_fresh()
