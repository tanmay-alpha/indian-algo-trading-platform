"""Filter engine for the screener. Apply JSON filter spec to a list of stocks."""
import logging
from typing import Optional
from backend.data.fundamentals import get_fundamentals_bulk, get_fundamentals
from backend.data.symbol_universe import get_all_nse_symbols

logger = logging.getLogger(__name__)

# Numeric range filter: value is [min, max] (None = no bound)
# Categorical: value is list of allowed options
# Bool: value is true/false

# Available filter keys (frontend can use any of these):
FILTER_SCHEMA = {
    # Categorical
    "sector": {
        "type": "multi",
        "options": [
            "Banking",
            "IT",
            "Auto",
            "Pharma",
            "FMCG",
            "Energy",
            "Metals",
            "Services",
            "Consumer",
            "Finance",
            "Industrial",
            "Power",
            "Realty",
            "Retail",
            "Telecom",
            "Cement",
            "Construction",
            "Chemicals",
            "Healthcare",
            "Mining",
            "Other",
        ],
    },
    "industry": {"type": "multi"},
    # Numeric ranges [min, max]
    "marketCap": {"type": "range", "unit": "Cr"},  # in INR
    "pe": {"type": "range"},
    "forward_pe": {"type": "range"},
    "pb": {"type": "range"},
    "ps": {"type": "range"},
    "ev_ebitda": {"type": "range"},
    "peg": {"type": "range"},
    "dividendYield": {"type": "range", "unit": "%"},
    "payoutRatio": {"type": "range", "unit": "%"},
    "roe": {"type": "range", "unit": "%"},
    "roa": {"type": "range", "unit": "%"},
    "profitMargin": {"type": "range", "unit": "%"},
    "debtToEquity": {"type": "range"},
    "currentRatio": {"type": "range"},
    "beta": {"type": "range"},
    "52wHigh": {"type": "range"},
    "52wLow": {"type": "range"},
    "50dAvg": {"type": "range"},
    "200dAvg": {"type": "range"},
    "avgVolume": {"type": "range"},
    "revenueGrowth": {"type": "range", "unit": "%"},
    "earningsGrowth": {"type": "range", "unit": "%"},
    "price": {"type": "range"},  # current LTP
    "changePct": {"type": "range", "unit": "%"},  # today's change
    "rsi": {"type": "range", "unit": ""},  # 14-day RSI 0-100
    "pctFrom52wHigh": {"type": "range", "unit": "%"},
    "pctFrom52wLow": {"type": "range", "unit": "%"},
}


def _matches(stock: dict, filters: dict) -> bool:
    """Check if a stock matches the filter spec."""
    for key, spec in filters.items():
        if key not in FILTER_SCHEMA:
            continue
        meta = FILTER_SCHEMA[key]
        val = stock.get(key)

        if meta["type"] == "multi":
            if not isinstance(spec, list) or val not in spec:
                return False
        elif meta["type"] == "range":
            if not isinstance(spec, list) or len(spec) != 2:
                continue
            lo, hi = spec
            if val is None:
                return False
            try:
                v = float(val)
            except (TypeError, ValueError):
                return False
            if lo is not None and v < float(lo):
                return False
            if hi is not None and v > float(hi):
                return False
    return True


def _coerce_sort(val):
    """Convert a value into something sortable, putting None at the end."""
    if val is None:
        return (1, 0)  # Nones sort last regardless of direction
    if isinstance(val, (int, float)):
        return (0, val)
    try:
        return (0, float(val))
    except (TypeError, ValueError):
        return (1, 0)


def run_screener(
    filters: dict,
    limit: int = 50,
    sort_by: str = "marketCap",
    sort_dir: str = "desc",
) -> list:
    """Run screener. Returns list of stocks passing filters, sorted.

    Performance: fetch fundamentals for top 200 by market cap, then filter.
    For real-time volume/RSI, we use bulk quote + derived metrics.
    """
    from backend.data.market_data import get_quotes_bulk

    universe = get_all_nse_symbols()[:200]
    symbols = [s[0] for s in universe]

    # Get fundamentals (cached, 1hr TTL)
    logger.info(f"[screener] Fetching fundamentals for {len(symbols)} symbols")
    fundamentals = get_fundamentals_bulk(symbols)
    fmap = {f["symbol"]: f for f in fundamentals}

    # Get live quotes (LTP, changePct)
    quotes = get_quotes_bulk(symbols)

    # Merge
    stocks = []
    for sym, f in fmap.items():
        q = quotes.get(sym, {})
        merged = {
            **f,
            "ltp": q.get("ltp"),
            "changePct": q.get("changePct"),
            "volume": q.get("volume", 0),
        }
        # Compute price as % of 52w high/low
        if merged.get("52wHigh") and merged.get("ltp"):
            merged["pctFrom52wHigh"] = round(
                (merged["ltp"] / merged["52wHigh"] - 1) * 100, 2
            )
        else:
            merged["pctFrom52wHigh"] = None
        if merged.get("52wLow") and merged.get("ltp"):
            merged["pctFrom52wLow"] = round(
                (merged["ltp"] / merged["52wLow"] - 1) * 100, 2
            )
        else:
            merged["pctFrom52wLow"] = None
        stocks.append(merged)

    # Filter
    filtered = [s for s in stocks if _matches(s, filters)]
    logger.info(
        f"[screener] {len(filtered)} of {len(stocks)} passed filters"
    )

    # Sort
    if sort_by and sort_by in FILTER_SCHEMA:
        reverse = sort_dir == "desc"
        # Nones always go last regardless of direction.
        filtered.sort(
            key=lambda s: _coerce_sort(s.get(sort_by)),
            reverse=reverse,
        )

    return filtered[:limit]


def run_preset(preset_id: str, limit: int = 25) -> list:
    """Run a pre-built screen."""
    from backend.data.presets import PRESETS

    preset = PRESETS.get(preset_id)
    if not preset:
        return []
    return run_screener(
        preset.get("filters", {}),
        limit,
        preset.get("sort_by", "marketCap"),
        preset.get("sort_dir", "desc"),
    )


def get_presets() -> list:
    from backend.data.presets import PRESETS

    return [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in PRESETS.items()
    ]
