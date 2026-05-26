# backend/routers/watchlists.py
"""
Watchlist API Router - Phase 19D

Routes:
  GET  /watchlists                          - List all watchlists for default user
  POST /watchlists                          - Create a new watchlist
  GET  /watchlists/{watchlist_id}           - Get specific watchlist
  PATCH /watchlists/{watchlist_id}          - Rename a watchlist
  DELETE /watchlists/{watchlist_id}         - Delete a watchlist
  POST /watchlists/{watchlist_id}/items     - Add symbol to watchlist
  DELETE /watchlists/{watchlist_id}/items/{symbol} - Remove symbol from watchlist
  GET  /watchlists/default/items            - List items in default watchlist

Auth: user_id="default" until Phase 20 auth is implemented.
Mutations: protected with require_admin_token (same pattern as /market-watch POST).
Reads: public (same as /market-watch GET).

Safety:
  - Symbol validated against InstrumentRegistry before saving.
  - Unknown symbols are rejected with 404.
  - Watchlist item cap enforced at 100.
  - No broker/network calls.
  - No WebSocket subscription to all instruments.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from backend.core.security import require_admin_token, sanitize_response
from backend.core.database import create_engine_safe, get_session_factory, init_db_metadata
from backend.db.repositories.watchlist_repository import WatchlistRepository, WATCHLIST_ITEM_CAP
from backend.gateway import instrument_registry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/watchlists", tags=["watchlists"])

_db_engine = None
_db_session_factory = None
_repo = WatchlistRepository()


def _get_session():
    global _db_engine, _db_session_factory
    if _db_engine is None:
        _db_engine = create_engine_safe()
        init_db_metadata(_db_engine)
        _db_session_factory = get_session_factory(_db_engine)
    return _db_session_factory()


class CreateWatchlistRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)


class RenameWatchlistRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)


class AddSymbolRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    exchange: Optional[str] = Field(default="NSE", max_length=8)


def _wl_to_dict(wl, item_count: int = 0) -> dict:
    return {
        "id": wl.id,
        "name": wl.name,
        "user_id": wl.user_id,
        "item_count": item_count,
        "created_at": wl.created_at,
    }


def _item_to_dict(item) -> dict:
    return {
        "id": item.id,
        "watchlist_id": item.watchlist_id,
        "symbol": item.symbol,
        "exchange": item.exch_seg or "NSE",
        "token": item.token or None,
        "created_at": item.created_at,
    }


# ------------------------------------------------------------------
# Reads (public)
# ------------------------------------------------------------------

@router.get("")
def list_watchlists():
    """List all watchlists for the default user."""
    session = None
    try:
        session = _get_session()
        watchlists = _repo.list_watchlists(session, user_id="default")
        result = []
        for wl in watchlists:
            count = _repo.count_items(session, wl.id)
            result.append(_wl_to_dict(wl, count))
        return sanitize_response({"watchlists": result, "count": len(result)})
    except Exception as exc:
        logger.error("Error listing watchlists: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to list watchlists")
    finally:
        if session:
            session.close()


@router.get("/default/items")
def get_default_watchlist_items(request: Request):
    """
    Return items in the default watchlist with available tick state.
    Used by the frontend market-watch panel as a persistence-aware alternative.
    """
    session = None
    try:
        session = _get_session()
        wl = _repo.get_or_create_default_watchlist(session, user_id="default")
        items = _repo.list_items(session, wl.id, user_id="default")
        market_watch = getattr(request.app.state, "market_watch_state", None)

        result = []
        for item in items:
            instrument = instrument_registry.get_instrument(item.symbol) or {
                "symbol": item.symbol,
                "name": item.symbol,
                "exchange": item.exch_seg or "NSE",
                "token": item.token,
            }
            tick = None
            if market_watch is not None:
                tick = getattr(market_watch, "_latest_by_symbol", {}).get(item.symbol)

            result.append({
                "symbol": instrument.get("symbol", item.symbol),
                "name": instrument.get("name") or item.symbol,
                "exchange": instrument.get("exchange") or item.exch_seg or "NSE",
                "token": instrument.get("token") or item.token or None,
                "ltp": tick.get("ltp") if tick else None,
                "change": None,
                "change_pct": None,
                "volume": tick.get("volume") if tick else None,
                "stale": tick is None,
                "source": "db",
            })

        return sanitize_response({
            "watchlist_id": wl.id,
            "watchlist_name": wl.name,
            "symbols": [item["symbol"] for item in result],
            "items": result,
        })
    except Exception as exc:
        logger.error("Error getting default watchlist items: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load watchlist items")
    finally:
        if session:
            session.close()


@router.get("/{watchlist_id}")
def get_watchlist(watchlist_id: int):
    """Get a specific watchlist by ID."""
    session = None
    try:
        session = _get_session()
        wl = _repo.get_watchlist(session, watchlist_id, user_id="default")
        if wl is None:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        count = _repo.count_items(session, wl.id)
        items = _repo.list_items(session, wl.id, user_id="default")
        return sanitize_response({
            **_wl_to_dict(wl, count),
            "items": [_item_to_dict(item) for item in items],
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error getting watchlist %s: %s", watchlist_id, exc)
        raise HTTPException(status_code=500, detail="Failed to get watchlist")
    finally:
        if session:
            session.close()


# ------------------------------------------------------------------
# Mutations (require_admin_token - same as /market-watch POST)
# ------------------------------------------------------------------

@router.post("", dependencies=[Depends(require_admin_token)])
def create_watchlist(payload: CreateWatchlistRequest):
    """Create a new watchlist."""
    session = None
    try:
        session = _get_session()
        wl = _repo.create_watchlist(session, name=payload.name, user_id="default")
        return sanitize_response(_wl_to_dict(wl, 0))
    except Exception as exc:
        logger.error("Error creating watchlist: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create watchlist")
    finally:
        if session:
            session.close()


@router.patch("/{watchlist_id}", dependencies=[Depends(require_admin_token)])
def rename_watchlist(watchlist_id: int, payload: RenameWatchlistRequest):
    """Rename a watchlist."""
    session = None
    try:
        session = _get_session()
        wl = _repo.rename_watchlist(session, watchlist_id, payload.name, user_id="default")
        if wl is None:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        count = _repo.count_items(session, wl.id)
        return sanitize_response(_wl_to_dict(wl, count))
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error renaming watchlist %s: %s", watchlist_id, exc)
        raise HTTPException(status_code=500, detail="Failed to rename watchlist")
    finally:
        if session:
            session.close()


@router.delete("/{watchlist_id}", dependencies=[Depends(require_admin_token)])
def delete_watchlist(watchlist_id: int):
    """Delete a watchlist and all its items."""
    session = None
    try:
        session = _get_session()
        deleted = _repo.delete_watchlist(session, watchlist_id, user_id="default")
        if not deleted:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        return sanitize_response({"status": "deleted", "watchlist_id": watchlist_id})
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error deleting watchlist %s: %s", watchlist_id, exc)
        raise HTTPException(status_code=500, detail="Failed to delete watchlist")
    finally:
        if session:
            session.close()


@router.post("/{watchlist_id}/items", dependencies=[Depends(require_admin_token)])
async def add_symbol_to_watchlist(watchlist_id: int, payload: AddSymbolRequest, request: Request):
    """
    Add a symbol to a watchlist.
    
    SUBSCRIPTION BOUNDARY:
    Adding a symbol persists it to DB only.
    WebSocket subscriptions are updated separately via gateway.update_subscriptions()
    only for the active selected watchlist symbols.
    We do NOT subscribe all instruments in the instrument DB.
    """
    # Validate symbol in registry
    instrument = instrument_registry.get_instrument(payload.symbol, exchange=payload.exchange or "NSE")
    if instrument is None:
        raise HTTPException(
            status_code=404,
            detail={"message": "Symbol not found in instrument registry", "symbol": payload.symbol},
        )

    clean_symbol = instrument["symbol"]
    token = instrument.get("token")
    exch = instrument.get("exchange", payload.exchange or "NSE")

    session = None
    try:
        session = _get_session()
        item, status = _repo.add_symbol(
            session, watchlist_id, clean_symbol, exchange=exch, token=token, user_id="default"
        )
        if status == "not_found":
            raise HTTPException(status_code=404, detail="Watchlist not found")
        if status == "cap_exceeded":
            raise HTTPException(
                status_code=400,
                detail=f"Watchlist item cap ({WATCHLIST_ITEM_CAP}) reached",
            )

        # Notify gateway of updated watchlist symbols for subscription (selected symbols only).
        # This does NOT subscribe all instruments - only the watchlist's symbol set.
        gateway = getattr(request.app.state, "gateway", None)
        if gateway and status == "added" and gateway.connection_state in ("CONNECTING", "CONNECTED", "RECONNECTING"):
            market_watch = getattr(request.app.state, "market_watch_state", None)
            if market_watch is not None:
                current = list(market_watch.symbols)
                if clean_symbol not in current:
                    current.append(clean_symbol)
                    import asyncio
                    asyncio.create_task(gateway.update_subscriptions(current))

        return sanitize_response({
            "status": status,
            "symbol": clean_symbol,
            "exchange": exch,
            "token": token,
            "watchlist_id": watchlist_id,
            "item": _item_to_dict(item) if item else None,
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error adding symbol to watchlist %s: %s", watchlist_id, exc)
        raise HTTPException(status_code=500, detail="Failed to add symbol to watchlist")
    finally:
        if session:
            session.close()


@router.delete("/{watchlist_id}/items/{symbol}", dependencies=[Depends(require_admin_token)])
async def remove_symbol_from_watchlist(watchlist_id: int, symbol: str, request: Request):
    """Remove a symbol from a watchlist."""
    session = None
    try:
        session = _get_session()
        removed = _repo.remove_symbol(session, watchlist_id, symbol, user_id="default")
        if not removed:
            raise HTTPException(status_code=404, detail="Symbol not found in watchlist")

        return sanitize_response({
            "status": "removed",
            "symbol": str(symbol).strip().upper().replace("-EQ", ""),
            "watchlist_id": watchlist_id,
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error removing symbol from watchlist %s: %s", watchlist_id, exc)
        raise HTTPException(status_code=500, detail="Failed to remove symbol from watchlist")
    finally:
        if session:
            session.close()
