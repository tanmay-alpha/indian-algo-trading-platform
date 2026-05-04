from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.candles.candle_store import CandleStore
from backend.discovery.market_board import MarketBoard
from backend.discovery.screener_engine import ScreenerEngine
from backend.gateway import instrument_registry
from backend.indicators.engine import IndicatorEngine


router = APIRouter(prefix="/discovery", tags=["discovery"])


class ScreenerRequest(BaseModel):
    filters: dict[str, Any] = Field(default_factory=dict)
    timeframe: str = "1m"
    limit: int = 20


@router.get("/board")
def discovery_board(request: Request):
    board = _get_market_board(request)
    return {
        "summary": board.summary(),
        "gainers": board.gainers(limit=5),
        "losers": board.losers(limit=5),
        "most_active": board.most_active(limit=5),
        "note": "Data reflects only currently subscribed symbols.",
    }


@router.get("/gainers")
def discovery_gainers(request: Request, limit: int = Query(default=10, ge=1, le=50)):
    return {"gainers": _get_market_board(request).gainers(limit=limit)}


@router.get("/losers")
def discovery_losers(request: Request, limit: int = Query(default=10, ge=1, le=50)):
    return {"losers": _get_market_board(request).losers(limit=limit)}


@router.get("/most-active")
def discovery_most_active(request: Request, limit: int = Query(default=10, ge=1, le=50)):
    return {"most_active": _get_market_board(request).most_active(limit=limit)}


@router.get("/sectors")
def discovery_sectors():
    sectors = instrument_registry.get_sectors()
    return {"sectors": sectors, "count": len(sectors)}


@router.get("/sector/{sector}")
def discovery_sector(
    sector: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    instruments = instrument_registry.get_by_sector(sector)
    if not instruments:
        raise HTTPException(status_code=404, detail="Sector not found")
    paginated = _paginate(instruments, page=page, page_size=page_size)
    return {"sector": sector, **paginated}


@router.post("/screener")
async def discovery_screener(payload: ScreenerRequest, request: Request):
    if payload.timeframe not in CandleStore.MAX_CANDLES:
        raise HTTPException(status_code=422, detail="Unsupported timeframe")
    result = await _get_screener(request).run_screen(
        filters=payload.filters,
        timeframe=payload.timeframe,
        limit=payload.limit,
    )
    result["note"] = "Screener evaluates only currently loaded candle data."
    return result


@router.get("/instruments")
def discovery_instruments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    q: str = Query(default=""),
):
    if q:
        instruments = instrument_registry.search_symbols(q, limit=5000)
        return _paginate(instruments, page=page, page_size=page_size)
    return instrument_registry.list_paginated(page=page, page_size=page_size)


@router.get("/status")
def discovery_status(request: Request):
    registry_status = instrument_registry.registry_status()
    candle_stats = _get_store(request).stats()
    market_watch = getattr(request.app.state, "market_watch_state", None)
    symbols_in_watch = len(getattr(market_watch, "symbols", []) or [])
    loader = getattr(request.app.state, "instrument_loader", None)
    source = registry_status.get("source", "fallback")
    if loader is not None and hasattr(loader, "_last_source"):
        source = getattr(loader, "_last_source") or source
    return {
        "instrument_count": registry_status["loaded"],
        "sectors_available": len(instrument_registry.get_sectors()),
        "symbols_in_market_watch": symbols_in_watch,
        "symbols_with_candle_data": len(candle_stats.get("symbols") or []),
        "screener_available": True,
        "board_available": True,
        "instrument_master_source": source,
        "note": "Discovery uses the loaded instrument master, subscribed tick state, and cached CandleStore data only.",
    }


def _get_market_board(request: Request) -> MarketBoard:
    board = getattr(request.app.state, "market_board", None)
    if board is None:
        board = MarketBoard(getattr(request.app.state, "market_watch_state", None))
        request.app.state.market_board = board
    return board


def _get_screener(request: Request) -> ScreenerEngine:
    screener = getattr(request.app.state, "screener_engine", None)
    if screener is None:
        screener = ScreenerEngine(
            getattr(request.app.state, "indicator_engine", IndicatorEngine()),
            _get_store(request),
            getattr(request.app.state, "market_watch_state", None),
        )
        request.app.state.screener_engine = screener
    return screener


def _get_store(request: Request) -> CandleStore:
    store = getattr(request.app.state, "candle_store", None)
    if store is None:
        store = CandleStore()
        request.app.state.candle_store = store
    return store


def _paginate(instruments: list[dict], page: int = 1, page_size: int = 50) -> dict:
    safe_page = max(int(page or 1), 1)
    safe_page_size = min(max(int(page_size or 50), 1), 200)
    total = len(instruments)
    total_pages = max((total + safe_page_size - 1) // safe_page_size, 1)
    start = (safe_page - 1) * safe_page_size
    end = start + safe_page_size
    return {
        "instruments": instruments[start:end],
        "page": safe_page,
        "page_size": safe_page_size,
        "total": total,
        "total_pages": total_pages,
    }

