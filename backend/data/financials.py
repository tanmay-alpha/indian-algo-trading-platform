"""Fetch quarterly + annual financial statements from yfinance.

Returns a JSON-friendly structure with up to 4 quarters and 5 years of
P&L, balance sheet, and cash flow line items.
"""
import logging
import time
from typing import Any

import pandas as pd
import yfinance as yf

from backend.data.symbol_universe import yahoo_ticker

logger = logging.getLogger(__name__)
_cache: dict = {}
_CACHE_TTL = 3600  # 1 hour


def get_financials(symbol: str, exchange: str = "NSE") -> dict:
    """Get quarterly and annual P&L, balance sheet, cash flow.

    Returns a dict with `quarterly` and `annual` keys, each containing
    `income`, `balance`, `cashflow` arrays of `{period, lineItems}`.
    """
    sym = symbol.upper()
    cached = _cache.get(sym)
    if cached:
        ts, data = cached
        if time.time() - ts < _CACHE_TTL:
            return data

    ticker_str = yahoo_ticker(sym, exchange)
    try:
        t = yf.Ticker(ticker_str)
        income_q = t.quarterly_income_stmt
        income_a = t.income_stmt
        balance_q = t.quarterly_balance_sheet
        balance_a = t.balance_sheet
        cashflow_q = t.quarterly_cashflow
        cashflow_a = t.cashflow
    except Exception as e:
        logger.warning(f"[financials {sym}] yfinance error: {e}")
        return _empty(sym)

    out = {
        "symbol": sym,
        "exchange": exchange.upper(),
        "quarterly": {
            "income": _df_to_dict(income_q, periods=4),
            "balance": _df_to_dict(balance_q, periods=4),
            "cashflow": _df_to_dict(cashflow_q, periods=4),
        },
        "annual": {
            "income": _df_to_dict(income_a, periods=5),
            "balance": _df_to_dict(balance_a, periods=5),
            "cashflow": _df_to_dict(cashflow_a, periods=5),
        },
    }

    _cache[sym] = (time.time(), out)
    return out


def _df_to_dict(df: Any, periods: int) -> list:
    """Convert a yfinance DataFrame into a list of {period, lineItems: {...}}.

    Returns up to `periods` columns. Empty list if df is None/empty.
    """
    if df is None:
        return []
    try:
        if isinstance(df, pd.DataFrame) and df.empty:
            return []
    except Exception:
        return []

    try:
        cols = list(df.columns)[:periods]
        out: list = []
        for col in cols:
            period = _format_period(col)
            items = {
                str(k): float(v) if _is_number(v) else None
                for k, v in df[col].items()
            }
            out.append({"period": period, "lineItems": items})
        return out
    except Exception as e:
        logger.debug(f"[financials df] {e}")
        return []


def _format_period(col) -> str:
    """Format a Period/Timestamp column header as 'Q1 FY25' or 'FY25'."""
    try:
        if hasattr(col, "strftime"):
            s = col.strftime("%Y-%m-%d")
            # If it's a quarter, label as Qn
            if hasattr(col, "quarter"):
                return f"Q{col.quarter} {col.year}"
            return s[:7]
        return str(col)[:10]
    except Exception:
        return str(col)[:10]


def _is_number(x) -> bool:
    try:
        float(x)
        return True
    except (TypeError, ValueError):
        return False


def _empty(sym: str) -> dict:
    return {
        "symbol": sym,
        "exchange": "NSE",
        "quarterly": {"income": [], "balance": [], "cashflow": []},
        "annual": {"income": [], "balance": [], "cashflow": []},
    }
