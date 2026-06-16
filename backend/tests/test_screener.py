"""Tests for the screener engine."""
import pytest
from backend.data.screener import _matches, FILTER_SCHEMA, run_screener
from backend.data.presets import PRESETS


def test_filter_schema_has_core_filters():
    required = {
        "sector",
        "marketCap",
        "pe",
        "roe",
        "dividendYield",
        "debtToEquity",
        "pb",
    }
    assert required.issubset(FILTER_SCHEMA.keys())


def test_matches_categorical():
    stock = {"sector": "IT", "marketCap": 5000, "pe": 15}
    assert _matches(stock, {"sector": ["IT"]}) is True
    assert _matches(stock, {"sector": ["Banking"]}) is False


def test_matches_range():
    stock = {"marketCap": 5000, "pe": 15, "roe": 18}
    assert _matches(stock, {"marketCap": [1000, 10000]}) is True
    assert _matches(stock, {"marketCap": [10000, None]}) is False
    assert _matches(stock, {"roe": [15, None]}) is True
    assert _matches(stock, {"roe": [20, None]}) is False


def test_matches_missing_data():
    stock = {"sector": "IT", "pe": None}
    # Missing numeric value should exclude the stock
    assert _matches(stock, {"pe": [0, 30]}) is False


def test_matches_unknown_key():
    stock = {"sector": "IT"}
    # Unknown keys are silently ignored — never crash
    assert _matches(stock, {"not_a_real_filter": [0, 100]}) is True


def test_matches_multi_combined():
    stock = {"sector": "IT", "pe": 15, "roe": 22, "marketCap": 5000}
    assert (
        _matches(stock, {"sector": ["IT", "Banking"], "pe": [0, 30]}) is True
    )
    assert (
        _matches(stock, {"sector": ["IT", "Banking"], "pe": [0, 10]}) is False
    )


def test_presets_have_filters():
    assert len(PRESETS) >= 8
    for k, v in PRESETS.items():
        assert "name" in v
        assert "filters" in v
        assert len(v["filters"]) > 0


def test_preset_known_ids():
    expected = {
        "cash_rich_smallcaps",
        "momentum_monsters",
        "near_52w_lows",
        "dividend_aristocrats",
        "quality_compounders",
        "penny_gems",
        "it_powerhouses",
        "banking_bellwethers",
    }
    assert expected.issubset(PRESETS.keys())


def test_get_presets_returns_list():
    from backend.data.screener import get_presets

    presets = get_presets()
    assert isinstance(presets, list)
    assert len(presets) >= 8
    for p in presets:
        assert "id" in p
        assert "name" in p
        assert "description" in p


def test_fundamentals_pct_helper():
    from backend.data.fundamentals import _pct

    assert _pct(0.15) == 15.0
    assert _pct(None) is None
    assert _pct("0.5") == 50.0
    assert _pct("not a number") is None


def test_fundamentals_safe_helper():
    from backend.data.fundamentals import _safe

    assert _safe(1.5) == 1.5
    assert _safe("2.5") == 2.5
    assert _safe(None) is None
    assert _safe(None, 0) == 0
    assert _safe("bad") is None
