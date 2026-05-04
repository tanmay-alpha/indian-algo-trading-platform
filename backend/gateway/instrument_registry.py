import csv
import json
import logging
import math
from pathlib import Path
from typing import Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
INSTRUMENT_DIR = PROJECT_ROOT / "data" / "instruments"
JSON_PATH = INSTRUMENT_DIR / "angel_instruments.json"
CSV_PATH = INSTRUMENT_DIR / "angel_instruments.csv"
logger = logging.getLogger(__name__)

_CACHE: Optional[list[dict]] = None
_MASTER_SOURCE = "fallback"
_BY_SYMBOL: dict[str, dict] = {}
_BY_TOKEN: dict[str, dict] = {}
_BY_CLEAN_SYMBOL: dict[str, dict] = {}
_BY_SECTOR: dict[str, list[dict]] = {}

_FALLBACK_INSTRUMENTS = [
    {
        "symbol": "SBIN",
        "clean_symbol": "SBIN",
        "name": "State Bank of India",
        "token": "3045",
        "exchange": "NSE",
        "sector": "",
        "instrument_type": "EQ",
        "lot_size": None,
        "tick_size": None,
    },
    {
        "symbol": "RELIANCE",
        "clean_symbol": "RELIANCE",
        "name": "Reliance Industries",
        "token": "2885",
        "exchange": "NSE",
        "sector": "",
        "instrument_type": "EQ",
        "lot_size": None,
        "tick_size": None,
    },
    {
        "symbol": "INFY",
        "clean_symbol": "INFY",
        "name": "Infosys",
        "token": "1594",
        "exchange": "NSE",
        "sector": "",
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
        instruments = [_normalize_instrument(item) for item in _load_json(JSON_PATH)]
    elif CSV_PATH.exists():
        instruments = [_normalize_instrument(item) for item in _load_csv(CSV_PATH)]
    else:
        instruments = [item.copy() for item in _FALLBACK_INSTRUMENTS]

    instruments = [
        item
        for item in instruments
        if item.get("symbol") and item.get("token") and item.get("exchange") == "NSE"
    ]
    _set_cache(instruments)
    return _CACHE or []


def load_from_master(instruments: list[dict]) -> int:
    normalized = [_normalize_instrument(item) for item in instruments if isinstance(item, dict)]
    normalized = [
        item
        for item in normalized
        if item.get("symbol") and item.get("token") and item.get("exchange") == "NSE"
    ]
    if not normalized:
        if _CACHE is None:
            _set_cache([item.copy() for item in _FALLBACK_INSTRUMENTS])
            set_master_source("fallback")
        return 0

    _set_cache(normalized)
    logger.info("Registry loaded %s instruments", len(normalized))
    return len(normalized)


def load_from_instrument_master(instruments: list[dict]) -> int:
    return load_from_master(instruments)


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
    instrument = _BY_TOKEN.get(str(token)) or _find_by_token(str(token))
    return instrument.get("symbol") if instrument else None


def get_instrument(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    load_instruments()
    normalized = normalize_symbol(symbol)
    exchange_filter = normalize_symbol(exchange)
    candidates = {normalized}
    if normalized.endswith("-EQ"):
        candidates.add(normalized[:-3])
    else:
        candidates.add(f"{normalized}-EQ")

    for candidate in candidates:
        instrument = _BY_SYMBOL.get(candidate) or _BY_CLEAN_SYMBOL.get(candidate)
        if instrument and normalize_symbol(instrument.get("exchange")) == exchange_filter:
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
        clean_symbol = normalize_symbol(instrument.get("clean_symbol"))
        name = normalize_symbol(instrument.get("name"))
        sector = normalize_symbol(instrument.get("sector"))
        if (
            normalized_query in symbol
            or normalized_query in clean_symbol
            or normalized_query in name
            or normalized_query in sector
        ):
            results.append(instrument.copy())
        if len(results) >= limit:
            break
    return results


def search(query: str, limit: int = 50, exchange: str = "NSE") -> list[dict]:
    return search_symbols(query=query, limit=limit, exchange=exchange)


def list_market_watch(limit: int = 100) -> list[dict]:
    return [instrument.copy() for instrument in load_instruments()[:limit]]


def get_by_sector(sector: str) -> list[dict]:
    load_instruments()
    key = normalize_symbol(sector)
    return [item.copy() for item in sorted(_BY_SECTOR.get(key, []), key=lambda row: row.get("symbol") or "")]


def get_sectors() -> list[str]:
    load_instruments()
    return sorted(sector for sector in _BY_SECTOR if sector)


def list_paginated(page: int = 1, page_size: int = 50) -> dict:
    instruments = [item.copy() for item in load_instruments()]
    return _paginate(instruments, page=page, page_size=page_size)


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


def _set_cache(instruments: list[dict]) -> None:
    global _CACHE, _BY_SYMBOL, _BY_TOKEN, _BY_CLEAN_SYMBOL, _BY_SECTOR
    _CACHE = [item.copy() for item in instruments]
    _BY_SYMBOL = {}
    _BY_TOKEN = {}
    _BY_CLEAN_SYMBOL = {}
    _BY_SECTOR = {}
    for instrument in _CACHE:
        symbol = normalize_symbol(instrument.get("symbol"))
        clean_symbol = normalize_symbol(instrument.get("clean_symbol"))
        token = str(instrument.get("token") or "")
        sector = normalize_symbol(instrument.get("sector"))
        if symbol:
            _BY_SYMBOL[symbol] = instrument
        if clean_symbol:
            _BY_CLEAN_SYMBOL[clean_symbol] = instrument
        if token:
            _BY_TOKEN[token] = instrument
        if sector:
            _BY_SECTOR.setdefault(sector, []).append(instrument)


def _find_by_token(token: str) -> Optional[dict]:
    for instrument in load_instruments():
        if str(instrument.get("token")) == token:
            return instrument
    return None


def _paginate(instruments: list[dict], page: int = 1, page_size: int = 50) -> dict:
    safe_page = max(int(page or 1), 1)
    safe_page_size = min(max(int(page_size or 50), 1), 200)
    total = len(instruments)
    total_pages = max(math.ceil(total / safe_page_size), 1)
    start = (safe_page - 1) * safe_page_size
    end = start + safe_page_size
    return {
        "instruments": instruments[start:end],
        "page": safe_page,
        "page_size": safe_page_size,
        "total": total,
        "total_pages": total_pages,
    }


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
    raw_symbol = raw.get("symbol") or raw.get("tradingsymbol") or raw.get("name")
    symbol = normalize_symbol(raw_symbol)
    clean_symbol = normalize_symbol(raw.get("clean_symbol") or (symbol[:-3] if symbol.endswith("-EQ") else symbol))
    name = raw.get("name") or raw.get("companyName") or clean_symbol or symbol
    token = raw.get("token") or raw.get("symboltoken") or raw.get("instrument_token")
    exchange = raw.get("exchange") or raw.get("exch_seg") or "NSE"
    instrument_type = raw.get("instrument_type") or raw.get("instrumenttype") or raw.get("symbolgroup")
    lot_size = raw.get("lot_size") or raw.get("lotsize")
    tick_size = raw.get("tick_size") or raw.get("tick_size_in_rupees")
    sector = raw.get("sector") or ""

    return {
        "symbol": symbol,
        "clean_symbol": clean_symbol,
        "name": str(name) if name is not None else clean_symbol,
        "token": str(token) if token is not None else None,
        "exchange": normalize_symbol(exchange),
        "sector": str(sector).strip().upper(),
        "instrument_type": instrument_type or "EQ",
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
