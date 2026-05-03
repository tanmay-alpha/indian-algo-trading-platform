from datetime import datetime, timezone
from typing import Optional


class HoldingsTracker:
    def __init__(self):
        self._holdings: dict[str, dict] = {}
        self._last_update: Optional[datetime] = None
        self._data_status = "UNAVAILABLE"

    def update_from_broker(self, holdings: list[dict]) -> list[str]:
        warnings: list[str] = []
        if holdings is None:
            self._data_status = "UNAVAILABLE"
            return ["broker_holdings_unavailable"]
        normalized: dict[str, dict] = {}
        for item in holdings:
            symbol = str(item.get("symbol") or item.get("tradingsymbol") or "").upper()
            if not symbol:
                warnings.append("holding_missing_symbol")
                continue
            quantity = self._number(item.get("quantity") or item.get("qty") or item.get("holdingqty") or 0)
            avg_price = self._number(item.get("avg_price") or item.get("averageprice") or item.get("average_price") or 0)
            ltp = self._number(item.get("ltp") or item.get("last_price") or item.get("close") or 0)
            normalized[symbol] = {
                "symbol": symbol,
                "quantity": int(quantity),
                "avg_price": round(avg_price, 2),
                "ltp": round(ltp, 2) if ltp else None,
                "market_value": round((ltp or avg_price) * quantity, 2),
                "source": "BROKER",
            }
        self._holdings = normalized
        self._last_update = datetime.now(timezone.utc)
        self._data_status = "AVAILABLE"
        return warnings

    def get_holding(self, symbol: str) -> dict | None:
        return self._holdings.get(symbol.upper())

    def get_all_holdings(self) -> list[dict]:
        return list(self._holdings.values())

    def get_summary(self) -> dict:
        return {
            "holdings_count": len(self._holdings),
            "total_holding_value": round(sum(item["market_value"] for item in self._holdings.values()), 2),
            "data_status": self._data_status,
            "last_update": self._last_update.isoformat() if self._last_update else None,
        }

    def _number(self, value) -> float:
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0
