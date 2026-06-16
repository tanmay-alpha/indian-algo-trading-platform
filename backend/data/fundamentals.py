"""Fetch fundamental data from Yahoo Finance: P/E, P/B, ROE, market cap, etc.

Yahoo .info is rate-limited and slow. We cache aggressively in memory.
"""
import yfinance as yf
import logging
import time
from typing import Optional
from backend.data.symbol_universe import yahoo_ticker

logger = logging.getLogger(__name__)

# In-memory cache: symbol → (timestamp, data)
_cache: dict = {}
_CACHE_TTL = 3600  # 1 hour


def get_fundamentals(symbol: str, exchange: str = "NSE") -> dict:
    """Fetch fundamentals. Returns flat dict for filtering."""
    sym = symbol.upper()
    cached = _cache.get(sym)
    if cached:
        ts, data = cached
        if time.time() - ts < _CACHE_TTL:
            return data

    ticker = yahoo_ticker(sym, exchange)
    try:
        info = yf.Ticker(ticker).info or {}
    except Exception as e:
        logger.warning(f"[fundamentals] {ticker} info fetch failed: {e}")
        return _empty(sym)

    data = {
        "symbol": sym,
        "name": info.get("longName") or info.get("shortName", sym),
        "sector": info.get("sector", "Other"),
        "industry": info.get("industry", ""),
        # Valuation
        "pe": _safe(info.get("trailingPE")),
        "forward_pe": _safe(info.get("forwardPE")),
        "pb": _safe(info.get("priceToBook")),
        "ps": _safe(info.get("priceToSalesTrailing12Months")),
        "ev_ebitda": _safe(info.get("enterpriseToEbitda")),
        "peg": _safe(info.get("pegRatio")),
        # Market data
        "marketCap": _safe(info.get("marketCap"), 0),
        "enterpriseValue": _safe(info.get("enterpriseValue"), 0),
        "beta": _safe(info.get("beta"), 0),
        # Returns
        "roe": _pct(info.get("returnOnEquity")),
        "roa": _pct(info.get("returnOnAssets")),
        "roce": _pct(info.get("returnOnEquity")),  # proxy
        "profitMargin": _pct(info.get("profitMargins")),
        # Balance sheet
        "debtToEquity": _safe(info.get("debtToEquity"), 0),
        "currentRatio": _safe(info.get("currentRatio")),
        "quickRatio": _safe(info.get("quickRatio")),
        # Dividends
        "dividendYield": _pct(info.get("dividendYield")),
        "payoutRatio": _pct(info.get("payoutRatio")),
        "trailingAnnualDividendYield": _pct(
            info.get("trailingAnnualDividendYield")
        ),
        # 52w
        "52wHigh": _safe(info.get("fiftyTwoWeekHigh")),
        "52wLow": _safe(info.get("fiftyTwoWeekLow")),
        "50dAvg": _safe(info.get("fiftyDayAverage")),
        "200dAvg": _safe(info.get("twoHundredDayAverage")),
        # Volume
        "avgVolume": _safe(info.get("averageVolume"), 0),
        "avgVolume10d": _safe(info.get("averageVolume10days"), 0),
        "volume": _safe(info.get("volume"), 0),
        # Growth
        "revenueGrowth": _pct(info.get("revenueGrowth")),
        "earningsGrowth": _pct(info.get("earningsGrowth")),
    }

    _cache[sym] = (time.time(), data)
    return data


def get_fundamentals_bulk(symbols: list, exchange: str = "NSE") -> list:
    """Bulk fetch. Yahoo is slow, so we process sequentially with timeout.

    Skips symbols whose data is already cached.
    """
    out = []
    for sym in symbols:
        try:
            out.append(get_fundamentals(sym, exchange))
        except Exception as e:
            logger.debug(f"[bulk] {sym} skipped: {e}")
    return out


def clear_cache() -> None:
    """Test helper — wipe the in-memory cache."""
    _cache.clear()


def _safe(val, default=None):
    """Convert to float, return default on None/error."""
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _pct(val) -> Optional[float]:
    """Convert a Yahoo ratio (e.g. 0.15) to a percentage (15.0).

    Returns None on missing/zero to match 'we don't have this number'.
    """
    if val is None:
        return None
    try:
        f = float(val)
    except (TypeError, ValueError):
        return None
    return f * 100


def _empty(symbol: str) -> dict:
    return {
        "symbol": symbol,
        "name": symbol,
        "sector": "Other",
        "industry": "",
        "pe": None,
        "forward_pe": None,
        "pb": None,
        "ps": None,
        "ev_ebitda": None,
        "peg": None,
        "marketCap": 0,
        "enterpriseValue": 0,
        "beta": 0,
        "roe": None,
        "roa": None,
        "roce": None,
        "profitMargin": None,
        "debtToEquity": 0,
        "currentRatio": None,
        "quickRatio": None,
        "dividendYield": None,
        "payoutRatio": None,
        "trailingAnnualDividendYield": None,
        "52wHigh": None,
        "52wLow": None,
        "50dAvg": None,
        "200dAvg": None,
        "avgVolume": 0,
        "avgVolume10d": 0,
        "volume": 0,
        "revenueGrowth": None,
        "earningsGrowth": None,
    }
