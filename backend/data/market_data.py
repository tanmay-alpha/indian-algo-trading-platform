"""Unified market data service: Yahoo for history, Angel for live, Supabase cache.

Resolution order for ``get_candles``:
    1. Supabase cache (if configured)  → fast, persistent
    2. In-memory cache (5-min TTL)     → protects Yahoo from rate limits
    3. Yahoo Finance                   → up to 20 years of history
    4. Angel One intraday              → only during market hours, 1m/5m/15m/1h

Resolution order for ``get_quote``:
    1. Angel One                       → real-time during market hours (needs token)
    2. Yahoo Finance                   → 15-min delayed, but works always

Every function is safe to call without any env vars set — it falls back
to in-memory state and logs warnings instead of raising.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import pytz

from backend.data.yahoo_client import (
    fetch_history,
    fetch_quote as yahoo_quote,
    search_symbols,
)
from backend.data.angel_client import (
    is_configured as angel_configured,
    get_quote as angel_quote,
)
from backend.data.supabase_client import get_client as get_supabase
from backend.data.symbol_universe import (
    NIFTY_50,
    TOP_200_EXTRA,
    INDICES,
    get_all_nse_symbols,
    search_in_universe,
    yahoo_ticker,
)

logger = logging.getLogger(__name__)
IST = pytz.timezone("Asia/Kolkata")

# In-memory cache fallback: (symbol, exchange, interval) → (timestamp, data)
_mem_cache: dict = {}
_MEM_TTL_SECONDS = 300  # 5 minutes

# Quote cache: 60s TTL — short because LTP is the only thing that moves in
# real time. If we cached quotes for 5 minutes like candles, the ticker
# strip would feel stale. 60s is a good balance.
_quote_cache: dict = {}
_QUOTE_TTL_SECONDS = 60

# How many symbols to bulk-quote at once. Above 20 Yahoo starts throttling.
BULK_PARALLELISM = 10
BULK_BATCH_LIMIT = 50  # hard cap for the API endpoint


def _is_market_hours() -> bool:
    """Check if NSE market is open (09:15-15:30 IST, Mon-Fri)."""
    now = datetime.now(IST)
    if now.weekday() >= 5:  # Sat/Sun
        return False
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return market_open <= now <= market_close


def _cache_key(symbol: str, exchange: str, interval: str) -> str:
    return f"{symbol}:{exchange}:{interval}"


def _get_from_cache(
    symbol: str, exchange: str, interval: str, lookback_days: int
) -> Optional[list]:
    """Check Supabase, then in-memory. Returns candles list or None."""
    # Try Supabase first
    supa = get_supabase()
    if supa:
        try:
            from_time = int(
                (datetime.now() - timedelta(days=lookback_days)).timestamp()
            )
            res = (
                supa.table("candles")
                .select("time,open,high,low,close,volume")
                .eq("symbol", symbol)
                .eq("exchange", exchange)
                .eq("interval", interval)
                .gte("time", from_time)
                .order("time", desc=False)
                .execute()
            )
            if res.data and len(res.data) > 10:
                return res.data
        except Exception as e:
            logger.warning(f"[market_data] Supabase read failed: {e}")

    # In-memory fallback
    key = _cache_key(symbol, exchange, interval)
    if key in _mem_cache:
        ts, data = _mem_cache[key]
        if (datetime.now() - ts).total_seconds() < _MEM_TTL_SECONDS:
            return data
    return None


def _store_to_cache(
    symbol: str,
    exchange: str,
    interval: str,
    candles: list,
    source: str,
) -> None:
    """Store candles to Supabase (if configured) and in-memory."""
    # In-memory
    key = _cache_key(symbol, exchange, interval)
    _mem_cache[key] = (datetime.now(), candles)

    # Supabase (best-effort, never raises)
    supa = get_supabase()
    if supa and candles:
        try:
            rows = []
            for c in candles:
                rows.append({
                    "symbol": symbol,
                    "exchange": exchange,
                    "yahoo_ticker": yahoo_ticker(symbol, exchange),
                    "interval": interval,
                    "time": c["time"],
                    "open": c["open"],
                    "high": c["high"],
                    "low": c["low"],
                    "close": c["close"],
                    "volume": c["volume"],
                    "source": source,
                })
            # Upsert in batches of 500
            for i in range(0, len(rows), 500):
                batch = rows[i:i + 500]
                supa.table("candles").upsert(batch).execute()
            logger.info(
                f"[market_data] Cached {len(rows)} candles for {symbol} {interval}"
            )
        except Exception as e:
            logger.warning(f"[market_data] Supabase write failed: {e}")


def get_candles(
    symbol: str,
    exchange: str = "NSE",
    interval: str = "1D",
    lookback_days: int = 7300,
) -> list:
    """Get candle data. Tries cache → Yahoo → Angel."""
    # 1. Check cache
    cached = _get_from_cache(symbol, exchange, interval, lookback_days)
    if cached:
        logger.info(
            f"[market_data] Cache hit: {symbol} {interval} ({len(cached)} bars)"
        )
        return cached

    # 2. Fetch from Yahoo (best for history)
    fresh = fetch_history(symbol, exchange, interval, lookback_days)
    if fresh:
        _store_to_cache(symbol, exchange, interval, fresh, "yahoo")
        return fresh

    # 3. Try Angel for intraday during market hours
    #    Note: requires a symbol token, which we don't have yet — that
    #    wiring lands in Prompt 3 when the terminal subscribes per-symbol.
    if interval in ("1m", "5m", "15m", "1h") and _is_market_hours():
        logger.debug(
            f"[market_data] Angel fallback skipped for {symbol} "
            "(no token; resolves in terminal watchlist)"
        )

    return []


def _quote_cache_key(symbol: str, exchange: str) -> str:
    return f"{symbol}:{exchange}"


def _get_quote_from_cache(symbol: str, exchange: str) -> Optional[dict]:
    """Return cached quote if it's < 60s old. None otherwise."""
    key = _quote_cache_key(symbol, exchange)
    if key in _quote_cache:
        ts, data = _quote_cache[key]
        if (datetime.now() - ts).total_seconds() < _QUOTE_TTL_SECONDS:
            return data
    return None


def _store_quote_in_cache(symbol: str, exchange: str, quote: dict) -> None:
    """Stash a fresh quote in the in-memory cache."""
    _quote_cache[_quote_cache_key(symbol, exchange)] = (datetime.now(), quote)


def get_quote(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    """Get live quote: Angel during market hours, Yahoo fallback.

    Angel path requires a symbol token, which is not yet wired here — the
    terminal watchlist resolves tokens per-symbol. Until then we always
    fall through to Yahoo (15-min delayed, but always available).

    Results are memoized for 60s — Yahoo rate-limits the bulk-overview
    endpoint (20 simultaneous calls ≈ 20 throttled responses).
    """
    # 0. Cache check
    cached = _get_quote_from_cache(symbol, exchange)
    if cached is not None:
        return cached

    # 1. Yahoo (always-available, delayed)
    quote = yahoo_quote(symbol, exchange)
    if not quote:
        return None

    # If Yahoo forgot to compute changePct, fix it
    if quote.get("changePct") in (None, 0) and quote.get("close"):
        try:
            quote["changePct"] = round(
                (quote["change"] / quote["close"]) * 100, 2
            )
        except ZeroDivisionError:
            pass

    _store_quote_in_cache(symbol, exchange, quote)
    return quote


def get_quotes_bulk(symbols: list, exchange: str = "NSE") -> dict:
    """Bulk fetch quotes in parallel. Returns ``{symbol: quote}``.

    Uses a 15s deadline per call; we never let one slow Yahoo request
    take down the whole bulk (e.g. when Yahoo throttles and the call
    hangs for 60s, we'd 504 the whole API).
    """
    out: dict = {}
    with ThreadPoolExecutor(max_workers=BULK_PARALLELISM) as ex:
        futures = {ex.submit(get_quote, s, exchange): s for s in symbols}
        for f in as_completed(futures, timeout=15):
            try:
                q = f.result(timeout=5)
                if q:
                    out[futures[f]] = q
            except Exception as e:
                logger.debug(f"[market_data] bulk quote failed for {futures[f]}: {e}")
    return out


def search(query: str) -> list:
    """Search symbols. Local universe first, Yahoo as fallback."""
    # Local universe (fast, offline)
    local = search_in_universe(query)
    if local and len(local) >= 5:
        return local[:20]
    # Yahoo fallback
    return search_symbols(query)


def get_market_overview() -> list:
    """Top 20 NSE stocks summary for the landing-page ticker."""
    universe = NIFTY_50[:20]
    symbols = [s[0] for s in universe]
    quotes = get_quotes_bulk(symbols)
    out = []
    for sym, name, sector in universe:
        q = quotes.get(sym)
        if q:
            out.append({
                "symbol": sym,
                "name": name,
                "ltp": q["ltp"],
                "change": q["change"],
                "changePct": q["changePct"],
            })
    return out


def get_indices() -> list:
    """NIFTY, BANKNIFTY, SENSEX."""
    indices = [
        ("NIFTY", "NIFTY 50", "NSE"),
        ("BANKNIFTY", "NIFTY Bank", "NSE"),
        ("SENSEX", "BSE Sensex", "BSE"),
    ]
    out = []
    for sym, name, exch in indices:
        q = get_quote(sym, exch)
        if q:
            out.append({
                "symbol": sym,
                "name": name,
                "ltp": q["ltp"],
                "change": q["change"],
                "changePct": q["changePct"],
            })
    return out


def get_scanner(
    exchange: str = "NSE",
    sector: str = "ALL",
    min_change: float = -100.0,
    max_change: float = 100.0,
    min_volume: int = 0,
) -> list:
    """Market scanner: all NSE stocks with filters.

    Capped at the first 50 symbols to keep Yahoo rate limits happy. The
    full NIFTY 50 + top 200 universe = 244 stocks; we chunk these into
    50-symbol batches internally if needed (Prompt 3 wires the batch
    loop once we have UI pagination).
    """
    universe = get_all_nse_symbols()
    symbols = [s[0] for s in universe]
    try:
        quotes = get_quotes_bulk(symbols[:50])  # protect against rate limit
    except Exception as e:
        logger.warning(f"[scanner] bulk quote timeout/failure: {e}")
        quotes = {}

    out = []
    for sym, name, sec in universe:
        q = quotes.get(sym)
        if not q:
            continue
        if sector != "ALL" and sec != sector:
            continue
        if q["changePct"] < min_change or q["changePct"] > max_change:
            continue
        if q["volume"] < min_volume:
            continue
        out.append({
            "symbol": sym,
            "name": name,
            "sector": sec,
            "ltp": q["ltp"],
            "change": q["change"],
            "changePct": q["changePct"],
            "volume": q["volume"],
        })
    return out
