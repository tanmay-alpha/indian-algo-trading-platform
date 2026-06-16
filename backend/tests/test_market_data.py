"""Tests for the dual-source market data service.

These tests cover the offline paths (symbol universe, ticker formatting,
interval coverage, mocked fetch_quote) so they run fast and don't require
a live network connection. The Yahoo live paths are covered by the
manual smoke test in the prompt.

Run with:
    cd backend && pytest tests/test_market_data.py -v
"""
import pytest
from unittest.mock import patch

from backend.data.yahoo_client import (
    fetch_quote,
    search_symbols,
    INTERVAL_MAP,
    get_ticker,
)
from backend.data.symbol_universe import (
    NIFTY_50,
    get_all_nse_symbols,
    search_in_universe,
    yahoo_ticker,
    get_sectors,
    get_indices as get_index_list,
)
from backend.data.angel_client import is_configured as angel_is_configured
from backend.data.supabase_client import is_configured as supa_is_configured
from backend.data.market_data import (
    _is_market_hours,
    _cache_key,
    BULK_BATCH_LIMIT,
)


# --------------------------------------------------------------------------- #
# Yahoo client: ticker + interval map
# --------------------------------------------------------------------------- #

def test_yahoo_ticker_format_nse():
    assert yahoo_ticker("RELIANCE", "NSE") == "RELIANCE.NS"


def test_yahoo_ticker_format_bse():
    assert yahoo_ticker("RELIANCE", "BSE") == "RELIANCE.BO"


def test_get_ticker_helper():
    assert get_ticker("TCS", "NSE") == "TCS.NS"
    assert get_ticker("TCS", "BSE") == "TCS.BO"


def test_interval_map_covers_all_supported_intervals():
    """All intervals the API exposes must resolve to a Yahoo interval."""
    required = {"1m", "5m", "15m", "1h", "1D", "1W", "1MO"}
    assert required.issubset(INTERVAL_MAP.keys())


def test_interval_map_uses_max_for_long_intervals():
    """1D / 1W / 1MO should always use ``period=max`` to get full history."""
    for iv in ("1D", "1W", "1MO"):
        _, period = INTERVAL_MAP[iv]
        assert period == "max", f"{iv} should be period=max"


# --------------------------------------------------------------------------- #
# Symbol universe
# --------------------------------------------------------------------------- #

def test_nifty_50_has_50_constituents():
    assert len(NIFTY_50) == 50


def test_universe_includes_megacaps():
    universe = get_all_nse_symbols()
    symbols = [s[0] for s in universe]
    for s in ("RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"):
        assert s in symbols, f"Missing megacap: {s}"


def test_universe_has_index_entries():
    indices = get_index_list()
    syms = [s[0] for s in indices]
    assert "NIFTY" in syms
    assert "BANKNIFTY" in syms
    assert "SENSEX" in syms


def test_search_in_universe_finds_reliance():
    results = search_in_universe("reliance")
    assert len(results) > 0
    assert results[0]["symbol"] == "RELIANCE"
    assert results[0]["exchange"] == "NSE"


def test_search_in_universe_case_insensitive():
    a = search_in_universe("tcs")
    b = search_in_universe("TCS")
    c = search_in_universe("Tcs")
    assert a == b == c


def test_search_in_universe_no_match():
    assert search_in_universe("xyznonexistent123") == []


def test_search_in_universe_empty_query():
    assert search_in_universe("") == []


def test_get_sectors_returns_sorted_distinct():
    sectors = get_sectors()
    assert sectors == sorted(set(sectors))
    assert "Banking" in sectors
    assert "IT" in sectors


# --------------------------------------------------------------------------- #
# Mocked Yahoo calls
# --------------------------------------------------------------------------- #

@patch("backend.data.yahoo_client.yf.Ticker")
def test_fetch_quote_mock(mock_ticker):
    """Mock Yahoo Finance to verify our shape & change calculation."""
    mock_ticker.return_value.info = {
        "currentPrice": 2914.50,
        "regularMarketOpen": 2890.00,
        "dayHigh": 2925.00,
        "dayLow": 2885.00,
        "previousClose": 2878.00,
        "volume": 5234567,
    }
    q = fetch_quote("RELIANCE", "NSE")
    assert q is not None
    assert q["symbol"] == "RELIANCE"
    assert q["ltp"] == 2914.50
    assert q["change"] > 0
    assert q["changePct"] > 0
    assert q["source"] == "yahoo"
    assert "timestamp" in q


@patch("backend.data.yahoo_client.yf.Ticker")
def test_fetch_quote_handles_missing_fields(mock_ticker):
    """If Yahoo returns a sparse info dict, we still return a valid quote."""
    mock_ticker.return_value.info = {"currentPrice": 100.0, "previousClose": 95.0}
    q = fetch_quote("TEST", "NSE")
    assert q is not None
    assert q["ltp"] == 100.0
    assert q["change"] == 5.0
    assert abs(q["changePct"] - 5.26) < 0.01


@patch("backend.data.yahoo_client.yf.Ticker")
def test_fetch_quote_returns_none_on_error(mock_ticker):
    """A complete failure yields ``None`` (never raises)."""
    # yfinance wraps exceptions in its own retry logic. Simulate a fatal
    # failure at the ``Ticker()`` constructor (the layer we control).
    mock_ticker.side_effect = RuntimeError("boom")
    assert fetch_quote("XYZ", "NSE") is None


@patch("backend.data.yahoo_client.yf.Search")
def test_search_symbols_filters_to_nse_bse(mock_search):
    """We should only return NSE/BSE tickers, not AAPL etc."""
    mock_search.return_value.quotes = [
        {"symbol": "RELIANCE.NS", "longname": "Reliance Industries", "quoteType": "EQUITY"},
        {"symbol": "AAPL", "longname": "Apple Inc", "quoteType": "EQUITY"},
        {"symbol": "TCS.NS", "longname": "Tata Consultancy", "quoteType": "EQUITY"},
        {"symbol": "MSFT", "longname": "Microsoft", "quoteType": "EQUITY"},
    ]
    results = search_symbols("test")
    assert len(results) == 2
    symbols = {r["symbol"] for r in results}
    assert symbols == {"RELIANCE", "TCS"}
    assert all(r["exchange"] == "NSE" for r in results)


@patch("backend.data.yahoo_client.yf.Search")
def test_search_symbols_empty_query(mock_search):
    assert search_symbols("") == []
    assert search_symbols(None) == []  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Angel client: is_configured
# --------------------------------------------------------------------------- #

def test_angel_not_configured_in_test_env(monkeypatch):
    """In a test env we don't have ANGEL_* set, so the client must report unconfigured."""
    for k in ("ANGEL_API_KEY", "ANGEL_CLIENT_ID", "ANGEL_PASSWORD", "ANGEL_TOTP_SECRET"):
        monkeypatch.delenv(k, raising=False)
    assert angel_is_configured() is False


def test_angel_configured_when_all_set(monkeypatch):
    monkeypatch.setenv("ANGEL_API_KEY", "test-key")
    monkeypatch.setenv("ANGEL_CLIENT_ID", "T12345")
    monkeypatch.setenv("ANGEL_PASSWORD", "test-pwd")
    monkeypatch.setenv("ANGEL_TOTP_SECRET", "JBSWY3DPEHPK3PXP")
    assert angel_is_configured() is True


# --------------------------------------------------------------------------- #
# Supabase: graceful degradation
# --------------------------------------------------------------------------- #

def test_supabase_not_configured_in_test_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    assert supa_is_configured() is False


# --------------------------------------------------------------------------- #
# Market data service: helpers
# --------------------------------------------------------------------------- #

def test_cache_key_format():
    k = _cache_key("RELIANCE", "NSE", "1D")
    assert k == "RELIANCE:NSE:1D"


def test_bulk_batch_limit_sane():
    """Bulk API caps at 50 to keep Yahoo happy."""
    assert BULK_BATCH_LIMIT <= 100


def test_is_market_hours_returns_bool():
    """Helper should never raise; just return a bool."""
    assert isinstance(_is_market_hours(), bool)
