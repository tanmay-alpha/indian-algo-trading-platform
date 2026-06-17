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
        # yfinance can raise on rate limits, JSON decode errors, or missing
        # tickers. Catch per-call so one bad statement doesn't kill the
        # whole response.
        try:
            income_q = t.quarterly_income_stmt
        except Exception as e:
            logger.debug(f"[financials {sym}] quarterly_income_stmt: {e}")
            income_q = None
        try:
            income_a = t.income_stmt
        except Exception as e:
            logger.debug(f"[financials {sym}] income_stmt: {e}")
            income_a = None
        try:
            balance_q = t.quarterly_balance_sheet
        except Exception as e:
            logger.debug(f"[financials {sym}] quarterly_balance_sheet: {e}")
            balance_q = None
        try:
            balance_a = t.balance_sheet
        except Exception as e:
            logger.debug(f"[financials {sym}] balance_sheet: {e}")
            balance_a = None
        try:
            cashflow_q = t.quarterly_cashflow
        except Exception as e:
            logger.debug(f"[financials {sym}] quarterly_cashflow: {e}")
            cashflow_q = None
        try:
            cashflow_a = t.cashflow
        except Exception as e:
            logger.debug(f"[financials {sym}] cashflow: {e}")
            cashflow_a = None
    except Exception as e:
        logger.warning(f"[financials {sym}] yfinance init error: {e}")
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
            items: dict = {}
            try:
                for k, v in df[col].items():
                    try:
                        items[str(k)] = float(v) if _is_number(v) else None
                    except Exception:
                        items[str(k)] = None
            except Exception as e:
                logger.debug(f"[financials df.items] {e}")
            out.append({"period": period, "lineItems": items})
        return out
    except Exception as e:
        logger.debug(f"[financials df] {e}")
        return []


def _format_period(col) -> str:
    """Format a Period/Timestamp column header as 'Q1 FY25' or 'FY25'."""
    try:
        # pandas Timestamp / Period — strftime works on both
        if hasattr(col, "strftime"):
            try:
                s = col.strftime("%Y-%m-%d")
            except Exception:
                s = str(col)[:10]
            # If it's a quarter, label as Qn
            if hasattr(col, "quarter"):
                try:
                    return f"Q{col.quarter} {col.year}"
                except Exception:
                    pass
            return s[:10]
        return str(col)[:10]
    except Exception:
        return str(col)[:10]


def _is_number(x) -> bool:
    try:
        # numpy types may not coerce with float(); catch broader
        v = float(x)
        # Reject NaN/inf so JSON serializes as null
        import math
        if math.isnan(v) or math.isinf(v):
            return False
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
