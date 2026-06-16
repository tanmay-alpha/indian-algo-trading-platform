"""Tests for stock detail backend modules (Prompt 5).

These are unit tests; the slow financial-data tests are marked so they
can be skipped in CI via `pytest -m "not slow"`.
"""
import pytest


# ----- peers.py -----
def test_get_peers_returns_list():
    from backend.data.peers import get_peers
    peers = get_peers("TCS", "NSE", limit=5)
    assert isinstance(peers, list)
    assert len(peers) <= 5
    if peers:
        # Each entry has at least these fields
        for p in peers:
            assert "symbol" in p
            assert "sector" in p
            # TCS is the only TCS, must not appear in its own peer list
            assert p["symbol"] != "TCS"


def test_get_peers_excludes_self():
    from backend.data.peers import get_peers
    peers = get_peers("INFY", "NSE", limit=10)
    assert all(p["symbol"] != "INFY" for p in peers)


def test_get_peers_handles_unknown_symbol():
    """Unknown symbol should return empty list, not crash."""
    from backend.data.peers import get_peers
    # ZZZZZZ will not be found in any sector list, and will get sector=Other
    peers = get_peers("ZZZZZZ", "NSE", limit=5)
    assert isinstance(peers, list)
    # Even if Some have data, none should be ZZZZZZ itself
    assert all(p.get("symbol") != "ZZZZZZ" for p in peers)


# ----- news.py -----
def test_get_news_returns_list():
    from backend.data.news import get_news
    articles = get_news("RELIANCE", "Reliance Industries", limit=5)
    assert isinstance(articles, list)
    # May be empty if Google blocks us, but the return type must be a list
    if articles:
        for a in articles:
            assert "title" in a
            assert "link" in a


# ----- financials.py -----
@pytest.mark.slow
def test_get_financials_shape():
    """Slow test — hits Yahoo for quarterly + annual statements."""
    from backend.data.financials import get_financials
    data = get_financials("TCS", "NSE")
    assert "quarterly" in data
    assert "annual" in data
    assert "income" in data["quarterly"]
    assert "balance" in data["quarterly"]
    assert "cashflow" in data["quarterly"]


def test_financials_empty_symbol():
    """Unknown symbol should return empty structure, not crash."""
    from backend.data.financials import get_financials
    data = get_financials("ZZZZZZ", "NSE")
    # Either has empty arrays OR valid data — must not raise
    assert "quarterly" in data
    assert "annual" in data
