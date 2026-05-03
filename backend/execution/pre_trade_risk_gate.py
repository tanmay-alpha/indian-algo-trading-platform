from datetime import datetime, timezone
from typing import Optional

from backend.core.config import settings as default_settings
from backend.core.types import OrderSide, OrderType
from backend.execution.models import OrderIntent, RiskDecision


class PreTradeRiskGate:
    def __init__(
        self,
        kill_switch,
        market_watch=None,
        portfolio_manager=None,
        settings=default_settings,
        freshness_seconds: int = 10,
    ):
        self.kill_switch = kill_switch
        self.market_watch = market_watch
        self.portfolio_manager = portfolio_manager
        self.settings = settings
        self.freshness_seconds = freshness_seconds

    async def evaluate(self, intent: OrderIntent, latest_market: Optional[dict] = None) -> RiskDecision:
        failed: list[str] = []
        latest_market = latest_market or self._latest_from_watch(intent.symbol)
        market_price = self._market_price(intent, latest_market)
        estimated_notional = market_price * intent.quantity if market_price else None
        market_fresh = self._is_market_fresh(latest_market)

        if self.kill_switch and self.kill_switch.is_active:
            failed.append("kill_switch_active")
        if intent.quantity <= 0:
            failed.append("invalid_quantity")
        if intent.quantity > self.settings.max_order_qty:
            failed.append("max_order_qty")
        if estimated_notional is not None and estimated_notional > self.settings.max_order_notional:
            failed.append("max_order_notional")
        if intent.order_type not in {OrderType.MARKET.value, OrderType.LIMIT.value}:
            failed.append("unsupported_order_type")
        if intent.side not in {OrderSide.BUY.value, OrderSide.SELL.value}:
            failed.append("unsupported_side")
        if not intent.symbol:
            failed.append("missing_symbol")
        if intent.order_type == OrderType.MARKET.value and not latest_market:
            failed.append("market_data_unavailable")
        if intent.order_type == OrderType.MARKET.value and latest_market and not market_fresh:
            failed.append("stale_market_data")
        if intent.order_type == OrderType.LIMIT.value and (intent.price is None or intent.price <= 0):
            failed.append("invalid_limit_price")
        daily_pnl = self._daily_pnl()
        if daily_pnl is not None and daily_pnl <= self.settings.max_daily_loss:
            failed.append("max_daily_loss")

        return RiskDecision(
            order_intent_id=intent.intent_id,
            approved=not failed,
            rejected_reason=";".join(failed) if failed else None,
            failed_checks=failed,
            max_order_qty=self.settings.max_order_qty,
            max_order_notional=self.settings.max_order_notional,
            estimated_notional=estimated_notional,
            market_data_fresh=market_fresh,
            kill_switch_active=bool(self.kill_switch and self.kill_switch.is_active),
        )

    def _latest_from_watch(self, symbol: str) -> Optional[dict]:
        if not self.market_watch:
            return None
        for attr in ("get_latest", "latest_tick", "get_tick"):
            fn = getattr(self.market_watch, attr, None)
            if callable(fn):
                return fn(symbol)
        ticks = getattr(self.market_watch, "latest_ticks", None) or getattr(self.market_watch, "_latest_ticks", None)
        return ticks.get(symbol) if isinstance(ticks, dict) else None

    def _market_price(self, intent: OrderIntent, latest_market: Optional[dict]) -> Optional[float]:
        if intent.order_type == OrderType.LIMIT.value:
            return intent.price
        if not latest_market:
            return None
        value = latest_market.get("ltp") or latest_market.get("price")
        return float(value) if value is not None and float(value) > 0 else None

    def _is_market_fresh(self, latest_market: Optional[dict]) -> bool:
        if not latest_market:
            return False
        ts = latest_market.get("received_at") or latest_market.get("last_update") or latest_market.get("timestamp")
        if isinstance(ts, datetime):
            dt = ts
        elif isinstance(ts, str) and ts:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                return False
        else:
            return False
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds() <= self.freshness_seconds

    def _daily_pnl(self) -> Optional[float]:
        if not self.portfolio_manager:
            return None
        for attr in ("current_daily_pnl", "daily_pnl", "realized_pnl"):
            value = getattr(self.portfolio_manager, attr, None)
            if isinstance(value, (int, float)):
                return float(value)
        return None
