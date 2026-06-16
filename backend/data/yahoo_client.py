"""Yahoo Finance data client for NSE/BSE history (up to 20 years).

This is the workhorse of the historical layer. Yahoo returns:
  * 1m bars → 7 days
  * 5m / 15m bars → 60 days
  * 1h bars → 730 days
  * 1D / 1W / 1MO bars → all available history (often 20+ years)

We map our internal interval names (``1D``, ``1W``, ``1MO``) to Yahoo's
``1d`` / ``1wk`` / ``1mo`` and ask for ``period=max`` to get the long tail.
"""
import yfinance as yf
import pandas as pd
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# internal → (yfinance interval, period)
INTERVAL_MAP = {
    "1m": ("1m", "7d"),
    "5m": ("5m", "60d"),
    "15m": ("15m", "60d"),
    "1h": ("60m", "730d"),
    "1D": ("1d", "max"),
    "1W": ("1wk", "max"),
    "1MO": ("1mo", "max"),
}


def get_ticker(symbol: str, exchange: str = "NSE") -> str:
    """Convert a NSE/BSE symbol to Yahoo's suffixed ticker."""
    # For indices (which have their own special Yahoo tickers), pass as-is
    if symbol.startswith("^"):
        return symbol
    suffix = ".NS" if exchange == "NSE" else ".BO"
    return f"{symbol}{suffix}"


def fetch_history(
    symbol: str,
    exchange: str,
    interval: str,
    lookback_days: int = 7300,
) -> list:
    """Fetch candle history from Yahoo Finance.

    Returns a list of dicts with ``time`` (unix epoch seconds), ``open``,
    ``high``, ``low``, ``close``, ``volume``. Empty list on any failure.
    """
    ticker = get_ticker(symbol, exchange)
    yf_interval, period = INTERVAL_MAP.get(interval, ("1d", "max"))

    # For long periods, do not pass lookback (let Yahoo return max)
    if interval in ("1D", "1W", "1MO"):
        period = "max"

    try:
        logger.info(f"[yahoo] Fetching {ticker} interval={interval} period={period}")
        df = yf.Ticker(ticker).history(period=period, interval=yf_interval)
        if df.empty:
            logger.warning(f"[yahoo] No data for {ticker}")
            return []

        # Drop timezone info, convert to unix epoch
        if df.index.tz is not None:
            df.index = df.index.tz_localize(None)

        candles = []
        for idx, row in df.iterrows():
            candles.append({
                "time": int(idx.timestamp()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]) if row["Volume"] > 0 else 0,
            })
        logger.info(f"[yahoo] Got {len(candles)} candles for {ticker}")
        return candles
    except Exception as e:
        logger.error(f"[yahoo] fetch_history failed for {ticker}: {e}")
        return []


def fetch_quote(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    """Get current quote (15-min delayed on the free tier).

    If info is rate-limited or broken, falls back to deriving LTP from the
    last 1D candle (the standard yfinance workaround)."""
    ticker = get_ticker(symbol, exchange)
    try:
        # Path 1: Try Ticker.info (can be rate-limited in CI/cloud)
        t = yf.Ticker(ticker)
        try:
            info = t.info or {}
        except Exception as info_err:
            logger.warning(f"[yahoo] t.info raised for {ticker}: {info_err}")
            info = {}

        ltp = (
            info.get("currentPrice")
            or info.get("regularMarketPrice")
            or info.get("previousClose", 0)
        )
        prev_close = info.get("previousClose", 0)

        # If we don't have a usable LTP, derive it from the latest candle
        if not ltp or ltp == 0:
            logger.warning(f"[yahoo] Info rate-limited for {ticker}, falling back to last candle")
            # Get 2d of daily candles so we have previous close too
            # Use yf.download (chart endpoint) — less rate-limited than info
            try:
                daily = yf.download(
                    ticker,
                    period="5d",
                    interval="1d",
                    progress=False,
                    auto_adjust=False,
                )
            except Exception as hist_err:
                logger.error(f"[yahoo] history fallback failed for {ticker}: {hist_err}")
                daily = None
            if daily is not None and not daily.empty and len(daily) > 0:
                # yf.download returns multi-level columns for single ticker
                # in some versions — flatten
                if hasattr(daily.columns, "levels"):
                    daily.columns = daily.columns.get_level_values(0)
                last_candle = daily.iloc[-1]
                ltp = float(last_candle["Close"])
                # prev_close = close of the candle before
                if len(daily) >= 2:
                    prev_close = float(daily.iloc[-2]["Close"])
                elif prev_close == 0:
                    prev_close = ltp  # Single-day data, no change
                # Re-derive from candle so we can fill open/high/low too
                if not info.get("regularMarketOpen"):
                    info["regularMarketOpen"] = float(last_candle["Open"])
                if not info.get("dayHigh"):
                    info["dayHigh"] = float(last_candle["High"])
                if not info.get("dayLow"):
                    info["dayLow"] = float(last_candle["Low"])
                if not info.get("volume"):
                    info["volume"] = int(last_candle["Volume"])
            else:
                logger.error(f"[yahoo] No data from history for {ticker}")
                return None

        # Compute change / changePct defensively
        change = float(ltp - prev_close) if (ltp and prev_close) else 0.0
        change_pct = (
            float((ltp - prev_close) / prev_close * 100)
            if (ltp and prev_close)
            else 0.0
        )

        return {
            "symbol": symbol,
            "exchange": exchange,
            "ltp": round(float(ltp or 0), 2),
            "open": round(float(info.get("regularMarketOpen") or prev_close or 0), 2),
            "high": round(float(info.get("dayHigh") or ltp or 0), 2),
            "low": round(float(info.get("dayLow") or ltp or 0), 2),
            "close": round(float(prev_close or 0), 2),
            "change": round(change, 2),
            "changePct": round(change_pct, 2),
            "volume": int(info.get("volume") or 0),
            "bid": round(float(info.get("bid") or 0), 2),
            "ask": round(float(info.get("ask") or 0), 2),
            "source": "yahoo",
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"[yahoo] fetch_quote failed for {ticker}: {e}")
        return None


def search_symbols(query: str) -> list:
    """Search Yahoo Finance for symbols matching query.

    Filters to NSE (``*.NS``) and BSE (``*.BO``) tickers only — we don't
    expose US/EU markets on the landing page yet.
    """
    try:
        if not query or len(query) < 1:
            return []
        results = yf.Search(query, max_results=20).quotes or []
        out = []
        for r in results:
            sym = r.get("symbol", "")
            if not (sym.endswith(".NS") or sym.endswith(".BO")):
                continue
            exchange = "NSE" if sym.endswith(".NS") else "BSE"
            out.append({
                "symbol": sym.replace(".NS", "").replace(".BO", ""),
                "name": r.get("longname") or r.get("shortname", ""),
                "exchange": exchange,
                "yahoo_ticker": sym,
                "type": r.get("quoteType", "EQUITY"),
            })
        return out
    except Exception as e:
        logger.error(f"[yahoo] search failed: {e}")
        return []
