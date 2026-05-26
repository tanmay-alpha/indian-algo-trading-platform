# backend/services/watchlist_service.py
"""
Watchlist Service - bridges DB persistence, instrument resolution, and tick snapshots.

Flow:
  Search instrument -> resolve symbol in InstrumentRegistry/InstrumentRepository
  -> validate symbol exists -> persist to DB watchlist via WatchlistRepository
  -> return market watch snapshot (DB items + in-memory tick state)

IMPORTANT:
  - Instrument DB = metadata/search universe (all 50k+ instruments).
  - WebSocket subscriptions = selected active symbols ONLY.
  - Adding a symbol to a watchlist does NOT subscribe all instruments.
  - Subscriptions are updated only for selected watchlist symbols.
"""

import logging
from typing import Optional

from backend.core.database import create_engine_safe, get_session_factory, init_db_metadata
from backend.db.repositories.watchlist_repository import WatchlistRepository
from backend.gateway import instrument_registry

logger = logging.getLogger(__name__)

_db_engine = None
_db_session_factory = None


def _get_db_session():
    global _db_engine, _db_session_factory
    if _db_engine is None:
        _db_engine = create_engine_safe()
        init_db_metadata(_db_engine)
        _db_session_factory = get_session_factory(_db_engine)
    return _db_session_factory()


class WatchlistService:
    """
    Service layer for watchlist management.
    
    Uses user_id="default" until Phase 20 auth is implemented.
    Resolves symbols through InstrumentRegistry (DB-first, fallback to static list).
    Attaches tick snapshots from the live MarketWatch state when available.
    """

    def __init__(self, market_watch=None):
        """
        Args:
            market_watch: Optional MarketWatch instance for tick snapshot attachment.
                          If None, items are returned with ltp=None (honest empty state).
        """
        self._market_watch = market_watch
        self._repo = WatchlistRepository()

    # ------------------------------------------------------------------
    # Default Watchlist Accessors
    # ------------------------------------------------------------------

    def get_default_watchlist(self, user_id: str = "default") -> dict:
        """Return default watchlist metadata (id, name, item count)."""
        session = None
        try:
            session = _get_db_session()
            wl = self._repo.get_or_create_default_watchlist(session, user_id=user_id)
            return {
                "id": wl.id,
                "name": wl.name,
                "user_id": wl.user_id,
                "count": self._repo.count_items(session, wl.id, user_id=user_id),
                "created_at": wl.created_at,
            }
        except Exception as exc:
            logger.warning("WatchlistService.get_default_watchlist failed: %s", exc)
            return {"id": None, "name": "My Watchlist", "user_id": user_id, "count": 0, "created_at": None}
        finally:
            if session:
                session.close()

    def list_watchlist_items(self, user_id: str = "default") -> list[dict]:
        """Return items in the default watchlist with instrument metadata."""
        session = None
        try:
            session = _get_db_session()
            wl = self._repo.get_or_create_default_watchlist(session, user_id=user_id)
            items = self._repo.list_items(session, wl.id, user_id=user_id)
            return [self._item_to_dict(item) for item in items]
        except Exception as exc:
            logger.warning("WatchlistService.list_watchlist_items failed: %s", exc)
            return []
        finally:
            if session:
                session.close()

    def add_to_default_watchlist(
        self, symbol: str, exchange: Optional[str] = None, user_id: str = "default"
    ) -> dict:
        """
        Add a symbol to the default watchlist.
        
        Validates symbol exists in InstrumentRegistry before persisting.
        Does NOT subscribe to WebSocket. Subscription happens only on
        gateway.update_subscriptions() called by the API layer when needed.
        
        Returns dict with status: "added" | "duplicate" | "cap_exceeded" | "unknown_symbol"
        """
        # Resolve symbol
        instrument = instrument_registry.get_instrument(symbol, exchange=exchange or "NSE")
        if instrument is None:
            logger.warning("WatchlistService: unknown symbol '%s', rejected", symbol)
            return {"status": "unknown_symbol", "symbol": symbol, "message": "Symbol not found in instrument registry"}

        clean_symbol = instrument["symbol"]
        token = instrument.get("token")
        exch = instrument.get("exchange", exchange or "NSE")

        session = None
        try:
            session = _get_db_session()
            wl = self._repo.get_or_create_default_watchlist(session, user_id=user_id)
            item, status = self._repo.add_symbol(
                session, wl.id, clean_symbol, exchange=exch, token=token, user_id=user_id
            )
            return {
                "status": status,
                "symbol": clean_symbol,
                "exchange": exch,
                "token": token,
                "watchlist_id": wl.id,
            }
        except Exception as exc:
            logger.warning("WatchlistService.add_to_default_watchlist failed: %s", exc)
            return {"status": "error", "symbol": symbol, "message": str(exc)}
        finally:
            if session:
                session.close()

    def remove_from_default_watchlist(
        self, symbol: str, exchange: Optional[str] = None, user_id: str = "default"
    ) -> dict:
        """Remove a symbol from the default watchlist."""
        session = None
        try:
            session = _get_db_session()
            wl = self._repo.get_or_create_default_watchlist(session, user_id=user_id)
            removed = self._repo.remove_symbol(
                session, wl.id, symbol, exchange=exchange, user_id=user_id
            )
            return {
                "status": "removed" if removed else "not_found",
                "symbol": str(symbol).strip().upper().replace("-EQ", ""),
                "watchlist_id": wl.id,
            }
        except Exception as exc:
            logger.warning("WatchlistService.remove_from_default_watchlist failed: %s", exc)
            return {"status": "error", "symbol": symbol, "message": str(exc)}
        finally:
            if session:
                session.close()

    def get_market_watch_snapshot(self, user_id: str = "default") -> dict:
        """
        Return market watch snapshot from DB watchlist items.
        
        Shape:
          { symbols: [...], items: [...], source: "db" | "fallback" }
        
        Each item has:
          symbol, name, exchange, token, ltp, change, change_pct,
          volume, best_bid, best_ask, last_update, stale, source
        
        If DB unavailable or empty, falls back to the in-memory MarketWatch.
        """
        session = None
        try:
            session = _get_db_session()
            wl = self._repo.get_or_create_default_watchlist(session, user_id=user_id)
            db_items = self._repo.list_items(session, wl.id, user_id=user_id)

            if db_items:
                symbols = [item.symbol for item in db_items]
                snapshot_items = []
                for item in db_items:
                    row = self._build_snapshot_row(item.symbol, item.token, item.exch_seg)
                    row["source"] = "db"
                    snapshot_items.append(row)
                return {"symbols": symbols, "items": snapshot_items, "source": "db"}
        except Exception as exc:
            logger.warning("WatchlistService.get_market_watch_snapshot DB failed: %s", exc)
        finally:
            if session:
                session.close()

        # Fallback: use in-memory MarketWatch if available
        return self._fallback_snapshot()

    # ------------------------------------------------------------------
    # Internal Helpers
    # ------------------------------------------------------------------

    def _build_snapshot_row(self, symbol: str, token: Optional[str], exch_seg: Optional[str]) -> dict:
        """Build a market watch snapshot row for a symbol, attaching tick state if available."""
        instrument = instrument_registry.get_instrument(symbol) or {
            "symbol": symbol,
            "name": symbol,
            "exchange": exch_seg or "NSE",
            "token": token,
        }

        tick = None
        if self._market_watch is not None:
            tick = getattr(self._market_watch, "_latest_by_symbol", {}).get(symbol)

        ltp = tick.get("ltp") if tick else None
        previous_ltp = tick.get("previous_ltp") if tick else None
        change = None
        change_pct = None
        if ltp is not None and previous_ltp:
            change = ltp - previous_ltp
            change_pct = (change / previous_ltp) * 100.0

        last_update = tick.get("received_at") if tick else None

        return {
            "symbol": instrument.get("symbol", symbol),
            "name": instrument.get("name") or symbol,
            "exchange": instrument.get("exchange") or exch_seg or "NSE",
            "token": instrument.get("token") or token,
            "ltp": ltp,
            "change": change,
            "change_pct": change_pct,
            "volume": tick.get("volume") if tick else None,
            "best_bid": tick.get("best_bid") if tick else None,
            "best_ask": tick.get("best_ask") if tick else None,
            "last_update": last_update,
            "stale": last_update is None,
        }

    def _fallback_snapshot(self) -> dict:
        """Fallback to in-memory MarketWatch snapshot."""
        if self._market_watch is not None:
            try:
                return {
                    "symbols": self._market_watch.symbols,
                    "items": [
                        {**row, "source": "fallback"}
                        for row in self._market_watch.snapshot()
                    ],
                    "source": "fallback",
                }
            except Exception as exc:
                logger.warning("WatchlistService fallback snapshot failed: %s", exc)
        return {"symbols": [], "items": [], "source": "fallback"}

    def _item_to_dict(self, item) -> dict:
        return {
            "id": item.id,
            "symbol": item.symbol,
            "exchange": item.exch_seg or "NSE",
            "token": item.token,
            "created_at": item.created_at,
        }
