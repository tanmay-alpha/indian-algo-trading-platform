import csv
import json
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
INSTRUMENT_DIR = PROJECT_ROOT / "data" / "instruments"
JSON_PATH = INSTRUMENT_DIR / "angel_instruments.json"
CSV_PATH = INSTRUMENT_DIR / "angel_instruments.csv"

_CACHE: Optional[list[dict]] = None
_MASTER_SOURCE = "fallback"

_FALLBACK_INSTRUMENTS = [
    {
        "symbol": "SBIN",
        "name": "State Bank of India",
        "token": "3045",
        "exchange": "NSE",
        "instrument_type": "EQ",
        "lot_size": None,
        "tick_size": None,
    },
    {
        "symbol": "RELIANCE",
        "name": "Reliance Industries",
        "token": "2885",
        "exchange": "NSE",
        "instrument_type": "EQ",
        "lot_size": None,
        "tick_size": None,
    },
    {
        "symbol": "INFY",
        "name": "Infosys",
        "token": "1594",
        "exchange": "NSE",
        "instrument_type": "EQ",
        "lot_size": None,
        "tick_size": None,
    },
]


def normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper()


def load_instruments(force_reload: bool = False) -> list[dict]:
    global _CACHE
    if _CACHE is not None and not force_reload:
        return _CACHE

    if JSON_PATH.exists():
        _CACHE = [_normalize_instrument(item) for item in _load_json(JSON_PATH)]
    elif CSV_PATH.exists():
        _CACHE = [_normalize_instrument(item) for item in _load_csv(CSV_PATH)]
    else:
        _CACHE = [item.copy() for item in _FALLBACK_INSTRUMENTS]

    _CACHE = [item for item in _CACHE if item.get("symbol") and item.get("token")]
    return _CACHE


def load_from_instrument_master(instruments: list[dict]) -> int:
    global _CACHE, _MASTER_SOURCE
    normalized = [_normalize_instrument(item) for item in instruments if isinstance(item, dict)]
    normalized = [
        item
        for item in normalized
        if item.get("symbol") and item.get("token") and item.get("exchange") == "NSE"
    ]
    if not normalized:
        if _CACHE is None:
            _CACHE = [item.copy() for item in _FALLBACK_INSTRUMENTS]
            _MASTER_SOURCE = "fallback"
        return 0

    _CACHE = normalized
    return len(_CACHE)


def set_master_source(source: str) -> None:
    global _MASTER_SOURCE
    _MASTER_SOURCE = source


def registry_status() -> dict:
    instruments = load_instruments()
    return {
        "loaded": len(instruments),
        "source": _MASTER_SOURCE,
        "fallback_active": _is_fallback_active(instruments),
    }


def get_token(symbol: str, exchange: str = "NSE") -> Optional[str]:
    instrument = get_instrument(symbol, exchange=exchange)
    return instrument.get("token") if instrument else None


def get_symbol(token: str) -> Optional[str]:
    token_value = str(token)
    for instrument in load_instruments():
        if str(instrument.get("token")) == token_value:
            return instrument.get("symbol")
    return None


def get_instrument(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    normalized = normalize_symbol(symbol)
    exchange_filter = normalize_symbol(exchange)
    candidates = {normalized}
    if normalized.endswith("-EQ"):
        candidates.add(normalized[:-3])
    else:
        candidates.add(f"{normalized}-EQ")

    for instrument in load_instruments():
        if normalize_symbol(instrument.get("exchange")) != exchange_filter:
            continue
        if normalize_symbol(instrument.get("symbol")) in candidates:
            return instrument.copy()
    return None


def search_symbols(query: str, limit: int = 50, exchange: str = "NSE") -> list[dict]:
    normalized_query = normalize_symbol(query)
    if not normalized_query:
        return []

    exchange_filter = normalize_symbol(exchange)
    results = []
    for instrument in load_instruments():
        if normalize_symbol(instrument.get("exchange")) != exchange_filter:
            continue
        symbol = normalize_symbol(instrument.get("symbol"))
        name = normalize_symbol(instrument.get("name"))
        if normalized_query in symbol or normalized_query in name:
            results.append(instrument.copy())
        if len(results) >= limit:
            break
    return results


def list_market_watch(limit: int = 100) -> list[dict]:
    return [instrument.copy() for instrument in load_instruments()[:limit]]


def validate_symbols(symbols: list[str], exchange: str = "NSE") -> tuple[list[str], list[str]]:
    valid = []
    invalid = []
    for symbol in symbols:
        normalized = normalize_symbol(symbol)
        instrument = get_instrument(normalized, exchange=exchange)
        if instrument:
            valid.append(instrument["symbol"])
        else:
            invalid.append(normalized)
    return valid, invalid


def resolve_symbols(symbols: list[str], exchange: str = "NSE") -> tuple[dict[str, str], list[str]]:
    resolved = {}
    missing = []
    for symbol in symbols:
        normalized = normalize_symbol(symbol)
        instrument = get_instrument(normalized, exchange=exchange)
        if instrument:
            resolved[instrument["symbol"]] = instrument["token"]
        else:
            missing.append(normalized)
    return resolved, missing


def reverse_token_map(symbol_token_map: dict[str, str]) -> dict[str, str]:
    return {str(token): symbol for symbol, token in symbol_token_map.items()}


def _load_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if isinstance(data, dict):
        for key in ("data", "instruments", "result"):
            value = data.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def _load_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def _normalize_instrument(raw: dict) -> dict:
    symbol = raw.get("symbol") or raw.get("tradingsymbol") or raw.get("name")
    name = raw.get("name") or raw.get("companyName") or raw.get("symbol") or raw.get("tradingsymbol")
    token = raw.get("token") or raw.get("symboltoken") or raw.get("instrument_token")
    exchange = raw.get("exchange") or raw.get("exch_seg") or "NSE"
    instrument_type = raw.get("instrument_type") or raw.get("instrumenttype") or raw.get("symbolgroup")
    lot_size = raw.get("lot_size") or raw.get("lotsize")
    tick_size = raw.get("tick_size") or raw.get("tick_size_in_rupees")

    return {
        "symbol": normalize_symbol(symbol),
        "name": name,
        "token": str(token) if token is not None else None,
        "exchange": normalize_symbol(exchange),
        "instrument_type": instrument_type,
        "lot_size": _to_number_or_none(lot_size, int),
        "tick_size": _to_number_or_none(tick_size, float),
    }


def _is_fallback_active(instruments: list[dict]) -> bool:
    fallback_symbols = {item["symbol"] for item in _FALLBACK_INSTRUMENTS}
    loaded_symbols = {item.get("symbol") for item in instruments}
    return loaded_symbols.issubset(fallback_symbols)


def _to_number_or_none(value, caster):
    if value in (None, ""):
        return None
    try:
        return caster(float(value)) if caster is int else caster(value)
    except (TypeError, ValueError):
        return None
