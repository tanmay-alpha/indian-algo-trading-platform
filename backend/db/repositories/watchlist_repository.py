# backend/db/repositories/watchlist_repository.py
"""
Watchlist Repository - persistent DB-backed watchlist CRUD.

Design notes:
- user_id="default" until Phase 20 auth is implemented.
- Cap: 100 items per watchlist.
- No duplicate symbols within the same watchlist.
- Symbols stored normalized (uppercase, no -EQ suffix).
- SQLite now, PostgreSQL-compatible later.
- No broker/network calls. No credentials.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func

from backend.db.models import Watchlist, WatchlistItem

logger = logging.getLogger(__name__)

WATCHLIST_ITEM_CAP = 100
DEFAULT_WATCHLIST_NAME = "My Watchlist"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _normalize_symbol(symbol: str) -> str:
    """Normalize symbol: uppercase, strip -EQ suffix."""
    s = str(symbol or "").strip().upper()
    if s.endswith("-EQ"):
        s = s[:-3]
    return s


def _normalize_exchange(exchange: Optional[str]) -> str:
    return str(exchange or "NSE").strip().upper()


class WatchlistRepository:
    # ------------------------------------------------------------------
    # Watchlist CRUD
    # ------------------------------------------------------------------

    def create_watchlist(self, session, name: str, user_id: str = "default") -> Watchlist:
        """Create a new named watchlist for a user."""
        wl = Watchlist(name=str(name).strip(), user_id=user_id, created_at=_utc_now())
        session.add(wl)
        session.commit()
        session.refresh(wl)
        logger.info("Created watchlist '%s' for user '%s' (id=%s)", name, user_id, wl.id)
        return wl

    def list_watchlists(self, session, user_id: str = "default") -> list[Watchlist]:
        """List all watchlists for a user."""
        return session.query(Watchlist).filter(Watchlist.user_id == user_id).order_by(Watchlist.id).all()

    def get_watchlist(self, session, watchlist_id: int, user_id: str = "default") -> Optional[Watchlist]:
        """Get a specific watchlist by ID, scoped to user."""
        return (
            session.query(Watchlist)
            .filter(Watchlist.id == watchlist_id, Watchlist.user_id == user_id)
            .first()
        )

    def get_or_create_default_watchlist(self, session, user_id: str = "default") -> Watchlist:
        """Get or create the default watchlist for a user."""
        wl = (
            session.query(Watchlist)
            .filter(Watchlist.user_id == user_id, Watchlist.name == DEFAULT_WATCHLIST_NAME)
            .first()
        )
        if wl is None:
            wl = self.create_watchlist(session, name=DEFAULT_WATCHLIST_NAME, user_id=user_id)
        return wl

    def rename_watchlist(
        self, session, watchlist_id: int, new_name: str, user_id: str = "default"
    ) -> Optional[Watchlist]:
        """Rename a watchlist. Returns None if not found."""
        wl = self.get_watchlist(session, watchlist_id, user_id)
        if wl is None:
            return None
        wl.name = str(new_name).strip()
        session.commit()
        session.refresh(wl)
        return wl

    def delete_watchlist(self, session, watchlist_id: int, user_id: str = "default") -> bool:
        """Delete a watchlist and cascade its items. Returns True if deleted."""
        wl = self.get_watchlist(session, watchlist_id, user_id)
        if wl is None:
            return False
        session.delete(wl)
        session.commit()
        return True

    # ------------------------------------------------------------------
    # Item CRUD
    # ------------------------------------------------------------------

    def add_symbol(
        self,
        session,
        watchlist_id: int,
        symbol: str,
        exchange: Optional[str] = None,
        token: Optional[str] = None,
        user_id: str = "default",
    ) -> tuple[Optional[WatchlistItem], str]:
        """
        Add a symbol to a watchlist.
        Returns (item, status) where status is:
          "added" | "duplicate" | "cap_exceeded" | "not_found"
        """
        wl = self.get_watchlist(session, watchlist_id, user_id)
        if wl is None:
            return None, "not_found"

        clean_symbol = _normalize_symbol(symbol)
        exch = _normalize_exchange(exchange)

        # Deduplicate
        existing = (
            session.query(WatchlistItem)
            .filter(
                WatchlistItem.watchlist_id == watchlist_id,
                WatchlistItem.symbol == clean_symbol,
            )
            .first()
        )
        if existing:
            return existing, "duplicate"

        # Cap enforcement
        count = self.count_items(session, watchlist_id, user_id)
        if count >= WATCHLIST_ITEM_CAP:
            return None, "cap_exceeded"

        item = WatchlistItem(
            watchlist_id=watchlist_id,
            symbol=clean_symbol,
            exch_seg=exch,
            token=str(token) if token else "",
            created_at=_utc_now(),
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        logger.info("Added symbol '%s' to watchlist %s", clean_symbol, watchlist_id)
        return item, "added"

    def remove_symbol(
        self,
        session,
        watchlist_id: int,
        symbol: str,
        exchange: Optional[str] = None,
        user_id: str = "default",
    ) -> bool:
        """Remove a symbol from a watchlist. Returns True if removed."""
        wl = self.get_watchlist(session, watchlist_id, user_id)
        if wl is None:
            return False

        clean_symbol = _normalize_symbol(symbol)
        item = (
            session.query(WatchlistItem)
            .filter(
                WatchlistItem.watchlist_id == watchlist_id,
                WatchlistItem.symbol == clean_symbol,
            )
            .first()
        )
        if item is None:
            return False
        session.delete(item)
        session.commit()
        logger.info("Removed symbol '%s' from watchlist %s", clean_symbol, watchlist_id)
        return True

    def list_items(self, session, watchlist_id: int, user_id: str = "default") -> list[WatchlistItem]:
        """List all items in a watchlist, scoped to user."""
        wl = self.get_watchlist(session, watchlist_id, user_id)
        if wl is None:
            return []
        return (
            session.query(WatchlistItem)
            .filter(WatchlistItem.watchlist_id == watchlist_id)
            .order_by(WatchlistItem.created_at)
            .all()
        )

    def count_items(self, session, watchlist_id: int, user_id: str = "default") -> int:
        """Count items in a watchlist."""
        return (
            session.query(func.count(WatchlistItem.id))
            .filter(WatchlistItem.watchlist_id == watchlist_id)
            .scalar()
        ) or 0
