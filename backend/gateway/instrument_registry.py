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
    # Large Cap - Banking
    {"symbol": "SBIN", "clean_symbol": "SBIN", "name": "State Bank of India", "token": "3045", "exchange": "NSE", "sector": "Banking", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "HDFCBANK", "clean_symbol": "HDFCBANK", "name": "HDFC Bank", "token": "1333", "exchange": "NSE", "sector": "Banking", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "ICICIBANK", "clean_symbol": "ICICIBANK", "name": "ICICI Bank", "token": "4963", "exchange": "NSE", "sector": "Banking", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "KOTAKBANK", "clean_symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank", "token": "1922", "exchange": "NSE", "sector": "Banking", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "AXISBANK", "clean_symbol": "AXISBANK", "name": "Axis Bank", "token": "5900", "exchange": "NSE", "sector": "Banking", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - IT
    {"symbol": "TCS", "clean_symbol": "TCS", "name": "Tata Consultancy Services", "token": "11536", "exchange": "NSE", "sector": "IT", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "INFY", "clean_symbol": "INFY", "name": "Infosys", "token": "1594", "exchange": "NSE", "sector": "IT", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "WIPRO", "clean_symbol": "WIPRO", "name": "Wipro", "token": "3787", "exchange": "NSE", "sector": "IT", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "TECHM", "clean_symbol": "TECHM", "name": "Tech Mahindra", "token": "13538", "exchange": "NSE", "sector": "IT", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "HCLTECH", "clean_symbol": "HCLTECH", "name": "HCL Technologies", "token": "7229", "exchange": "NSE", "sector": "IT", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - Energy / Conglomerates
    {"symbol": "RELIANCE", "clean_symbol": "RELIANCE", "name": "Reliance Industries", "token": "2885", "exchange": "NSE", "sector": "Energy", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "ONGC", "clean_symbol": "ONGC", "name": "Oil and Natural Gas Corp", "token": "2475", "exchange": "NSE", "sector": "Energy", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "NTPC", "clean_symbol": "NTPC", "name": "NTPC", "token": "11630", "exchange": "NSE", "sector": "Power", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "POWERGRID", "clean_symbol": "POWERGRID", "name": "Power Grid Corp", "token": "14977", "exchange": "NSE", "sector": "Power", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "COALINDIA", "clean_symbol": "COALINDIA", "name": "Coal India", "token": "20374", "exchange": "NSE", "sector": "Mining", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - FMCG / Consumer
    {"symbol": "ITC", "clean_symbol": "ITC", "name": "ITC", "token": "1660", "exchange": "NSE", "sector": "FMCG", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "HINDUNILVR", "clean_symbol": "HINDUNILVR", "name": "Hindustan Unilever", "token": "1394", "exchange": "NSE", "sector": "FMCG", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "NESTLEIND", "clean_symbol": "NESTLEIND", "name": "Nestle India", "token": "17963", "exchange": "NSE", "sector": "FMCG", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - Pharma
    {"symbol": "SUNPHARMA", "clean_symbol": "SUNPHARMA", "name": "Sun Pharmaceutical", "token": "3351", "exchange": "NSE", "sector": "Pharma", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "DRREDDY", "clean_symbol": "DRREDDY", "name": "Dr Reddys Laboratories", "token": "881", "exchange": "NSE", "sector": "Pharma", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "CIPLA", "clean_symbol": "CIPLA", "name": "Cipla", "token": "694", "exchange": "NSE", "sector": "Pharma", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - Auto
    {"symbol": "MARUTI", "clean_symbol": "MARUTI", "name": "Maruti Suzuki", "token": "10999", "exchange": "NSE", "sector": "Auto", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "TATAMOTORS", "clean_symbol": "TATAMOTORS", "name": "Tata Motors", "token": "3456", "exchange": "NSE", "sector": "Auto", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "BAJAJ-AUTO", "clean_symbol": "BAJAJAUTO", "name": "Bajaj Auto", "token": "16669", "exchange": "NSE", "sector": "Auto", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "M&M", "clean_symbol": "MM", "name": "Mahindra and Mahindra", "token": "2031", "exchange": "NSE", "sector": "Auto", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - Metals / Infra
    {"symbol": "TATASTEEL", "clean_symbol": "TATASTEEL", "name": "Tata Steel", "token": "3499", "exchange": "NSE", "sector": "Metals", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "HINDALCO", "clean_symbol": "HINDALCO", "name": "Hindalco Industries", "token": "1363", "exchange": "NSE", "sector": "Metals", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "JSWSTEEL", "clean_symbol": "JSWSTEEL", "name": "JSW Steel", "token": "11723", "exchange": "NSE", "sector": "Metals", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - NBFC / Finance
    {"symbol": "BAJFINANCE", "clean_symbol": "BAJFINANCE", "name": "Bajaj Finance", "token": "317", "exchange": "NSE", "sector": "Finance", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "BAJAJFINSV", "clean_symbol": "BAJAJFINSV", "name": "Bajaj Finserv", "token": "16675", "exchange": "NSE", "sector": "Finance", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - Consumer / Retail
    {"symbol": "TITAN", "clean_symbol": "TITAN", "name": "Titan Company", "token": "3506", "exchange": "NSE", "sector": "Consumer", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "ASIANPAINT", "clean_symbol": "ASIANPAINT", "name": "Asian Paints", "token": "236", "exchange": "NSE", "sector": "Consumer", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    # Large Cap - Telecom / Diversified
    {"symbol": "BHARTIARTL", "clean_symbol": "BHARTIARTL", "name": "Bharti Airtel", "token": "10604", "exchange": "NSE", "sector": "Telecom", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "ULTRACEMCO", "clean_symbol": "ULTRACEMCO", "name": "UltraTech Cement", "token": "2952", "exchange": "NSE", "sector": "Cement", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
    {"symbol": "LT", "clean_symbol": "LT", "name": "Larsen and Toubro", "token": "11483", "exchange": "NSE", "sector": "Infrastructure", "instrument_type": "EQ", "lot_size": None, "tick_size": None},
]

_db_engine = None
_db_session_factory = None
_db_disabled = False

def _get_db_session():
    global _db_engine, _db_session_factory, _db_disabled
    if _db_disabled:
        return None
    if _db_engine is None:
        from backend.core.database import create_engine_safe, get_session_factory
        _db_engine = create_engine_safe()
        _db_session_factory = get_session_factory(_db_engine)
    return _db_session_factory()

def _instrument_to_dict(inst) -> dict:
    if not inst:
        return {}
    return {
        "symbol": inst.symbol,
        "clean_symbol": normalize_symbol(inst.symbol),
        "name": inst.name or "",
        "token": inst.token,
        "exchange": inst.exch_seg or "NSE",
        "sector": inst.sector or "",
        "instrument_type": inst.instrumenttype or "EQ",
        "lot_size": inst.lotsize,
        "tick_size": inst.tick_size,
    }

def normalize_symbol(symbol: str) -> str:
    s = str(symbol or "").strip().upper()
    if s.endswith("-EQ"):
        s = s[:-3]
    for suffix in ["-BE", "-BL", "-SM", "-N"]:
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    return s


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

    # Ingest fallback list or loaded lists to database
    if instruments and not _is_fallback_active(instruments):
        session = None
        try:
            session = _get_db_session()
            from backend.db.repositories.instrument_repository import InstrumentRepository
            repo = InstrumentRepository()
            repo.bulk_upsert(session, instruments)
            logger.info("Ingested %s instruments into database via load_instruments", len(instruments))
        except Exception as e:
            logger.warning("Failed to ingest instruments to database in load_instruments: %s", e)
        finally:
            if session:
                session.close()

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

    # Ingest into database
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        repo.bulk_upsert(session, normalized)
        logger.info("Ingested %s instruments into database via load_from_master", len(normalized))
    except Exception as e:
        logger.warning("Failed to ingest instruments to database in load_from_master: %s", e)
    finally:
        if session:
            session.close()

    return len(normalized)


def load_from_instrument_master(instruments: list[dict]) -> int:
    return load_from_master(instruments)


def set_master_source(source: str) -> None:
    global _MASTER_SOURCE
    _MASTER_SOURCE = source


def registry_status() -> dict:
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        db_count = repo.count(session)
        if db_count > 0:
            return {
                "loaded": db_count,
                "source": "database",
                "fallback_active": False,
            }
    except Exception as e:
        logger.warning("Database query failed in registry_status: %s", e)
    finally:
        if session:
            session.close()

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
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        inst = repo.get_by_token(session, token)
        if inst:
            return inst.symbol
    except Exception as e:
        logger.warning("Database query failed in get_symbol, falling back: %s", e)
    finally:
        if session:
            session.close()

    instrument = _BY_TOKEN.get(str(token)) or _find_by_token(str(token))
    return instrument.get("symbol") if instrument else None


def get_instrument(symbol: str, exchange: str = "NSE") -> Optional[dict]:
    load_instruments()
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        inst = repo.get_by_symbol(session, symbol)
        if inst and normalize_symbol(inst.exch_seg) == normalize_symbol(exchange):
            return _instrument_to_dict(inst)
    except Exception as e:
        logger.warning("Database query failed in get_instrument, falling back: %s", e)
    finally:
        if session:
            session.close()

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


def search_symbols(query: str, limit: int = 25, exchange: str = "NSE") -> list[dict]:
    safe_limit = min(max(limit, 1), 100)
    normalized_query = normalize_symbol(query)
    if not normalized_query:
        return []

    exchange_filter = normalize_symbol(exchange)
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        db_results = repo.search(session, query, limit=safe_limit)
        filtered = [
            _instrument_to_dict(r)
            for r in db_results
            if normalize_symbol(r.exch_seg) == exchange_filter
        ]
        if filtered:
            return filtered
    except Exception as e:
        logger.warning("Database query failed in search_symbols, falling back: %s", e)
    finally:
        if session:
            session.close()

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
        if len(results) >= safe_limit:
            break
    return results


def search(query: str, limit: int = 25, exchange: str = "NSE") -> list[dict]:
    return search_symbols(query=query, limit=limit, exchange=exchange)


def list_market_watch(limit: int = 100) -> list[dict]:
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        db_results, _ = repo.list_paginated(session, page=1, page_size=limit)
        if db_results:
            return [_instrument_to_dict(r) for r in db_results]
    except Exception as e:
        logger.warning("Database query failed in list_market_watch, falling back: %s", e)
    finally:
        if session:
            session.close()

    return [instrument.copy() for instrument in load_instruments()[:limit]]


def get_by_sector(sector: str) -> list[dict]:
    load_instruments()
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        db_results = repo.get_by_sector(session, sector)
        if db_results:
            return [_instrument_to_dict(r) for r in db_results]
    except Exception as e:
        logger.warning("Database query failed in get_by_sector, falling back: %s", e)
    finally:
        if session:
            session.close()

    key = normalize_symbol(sector)
    return [item.copy() for item in sorted(_BY_SECTOR.get(key, []), key=lambda row: row.get("symbol") or "")]


def get_sectors() -> list[str]:
    load_instruments()
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        sectors = repo.get_sectors(session)
        if sectors:
            return sectors
    except Exception as e:
        logger.warning("Database query failed in get_sectors, falling back: %s", e)
    finally:
        if session:
            session.close()

    return sorted(sector for sector in _BY_SECTOR if sector)


def list_paginated(page: int = 1, page_size: int = 50) -> dict:
    session = None
    try:
        session = _get_db_session()
        from backend.db.repositories.instrument_repository import InstrumentRepository
        repo = InstrumentRepository()
        total = repo.count(session)
        if total > 0:
            safe_page = max(int(page or 1), 1)
            safe_page_size = min(max(int(page_size or 50), 1), 200)
            db_results, total = repo.list_paginated(session, page=safe_page, page_size=safe_page_size)
            total_pages = max(math.ceil(total / safe_page_size), 1)
            return {
                "instruments": [_instrument_to_dict(r) for r in db_results],
                "page": safe_page,
                "page_size": safe_page_size,
                "total": total,
                "total_pages": total_pages,
            }
    except Exception as e:
        logger.warning("Database query failed in list_paginated, falling back: %s", e)
    finally:
        if session:
            session.close()

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
    symbol = str(raw_symbol or "").strip().upper()
    clean_symbol = normalize_symbol(raw.get("clean_symbol") or symbol)
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
