from datetime import datetime, timezone
from typing import Optional

from backend.gateway.instrument_registry import get_instrument, list_market_watch, validate_symbols


# Indices that must always be subscribed. These are the "non-negotiable" feeds
# the terminal relies on for the index strip, strategy context, and dashboard.
# They cannot be removed by user-side calls to /market-watch.
PROTECTED_INDEX_SYMBOLS = ("NIFTY", "BANKNIFTY", "MIDCPNIFTY", "SENSEX")


class MarketWatch:
    def __init__(self, default_symbols: Optional[list[str]] = None, stale_after_seconds: int = 10):
        self.stale_after_seconds = stale_after_seconds
        self._symbols = self._with_protected(self._default_symbols(default_symbols))
        self._latest_by_symbol: dict[str, dict] = {}

    @staticmethod
    def _is_protected(symbol: str) -> bool:
        return str(symbol or "").strip().upper() in PROTECTED_INDEX_SYMBOLS

    @classmethod
    def _with_protected(cls, symbols: list[str]) -> list[str]:
        """Ensure the protected index symbols are always present, deduped, and first."""
        seen: set[str] = set()
        merged: list[str] = []
        # protected first (stable order)
        for sym in PROTECTED_INDEX_SYMBOLS:
            if sym not in seen:
                seen.add(sym)
                merged.append(sym)
        for sym in symbols:
            norm = str(sym).strip().upper()
            if norm and norm not in seen:
                seen.add(norm)
                merged.append(norm)
        return merged

    @property
    def latest_ticks(self) -> dict[str, dict]:
        return self._latest_by_symbol

    @property
    def symbols(self) -> list[str]:
        return list(self._symbols)

    @property
    def protected_symbols(self) -> list[str]:
        return [s for s in self._symbols if self._is_protected(s)]

    def set_symbols(self, symbols: list[str]) -> tuple[list[str], list[str]]:
        """Set the symbol set, but re-attach the protected index symbols even if the
        caller tried to drop them. Returns the effective (valid) set and any invalid
        symbols the caller asked for.
        """
        valid, invalid = validate_symbols(symbols)
        # Re-attach protected symbols that the caller may have omitted.
        merged = self._with_protected(valid)
        if not merged:
            return valid, invalid
        self._symbols = merged
        return merged, invalid

    def update_tick(self, event: dict) -> None:
        symbol = event.get("symbol")
        if not symbol:
            return
        self._latest_by_symbol[str(symbol).upper()] = event.copy()

    def snapshot(self) -> list[dict]:
        return [self._snapshot_row(symbol) for symbol in self._symbols]

    def _default_symbols(self, configured: Optional[list[str]]) -> list[str]:
        if configured:
            valid, _invalid = validate_symbols(configured)
            if valid:
                return valid
        return [item["symbol"] for item in list_market_watch(limit=3)]

    def _snapshot_row(self, symbol: str) -> dict:
        instrument = get_instrument(symbol) or {
            "symbol": symbol,
            "name": symbol,
            "exchange": "NSE",
            "token": None,
        }
        tick = self._latest_by_symbol.get(symbol)
        ltp = tick.get("ltp") if tick else None
        previous_ltp = tick.get("previous_ltp") if tick else None
        change = None
        change_pct = None
        if ltp is not None and previous_ltp:
            change = ltp - previous_ltp
            change_pct = (change / previous_ltp) * 100.0

        last_update = tick.get("received_at") if tick else None
        return {
            "symbol": instrument.get("symbol"),
            "name": instrument.get("name"),
            "exchange": instrument.get("exchange"),
            "token": instrument.get("token"),
            "ltp": ltp,
            "change": change,
            "change_pct": change_pct,
            "volume": tick.get("volume") if tick else None,
            "best_bid": tick.get("best_bid") if tick else None,
            "best_ask": tick.get("best_ask") if tick else None,
            "last_update": last_update,
            "stale": self._is_stale(last_update),
        }

    def _is_stale(self, last_update: Optional[str]) -> bool:
        if not last_update:
            return True
        try:
            parsed = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
        except ValueError:
            return True
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - parsed).total_seconds() > self.stale_after_seconds
