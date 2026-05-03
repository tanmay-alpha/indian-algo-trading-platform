import asyncio
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Optional

from SmartApi.smartWebSocketV2 import SmartWebSocketV2

from backend.core.config import settings
from backend.gateway.instrument_registry import resolve_symbols, reverse_token_map
from backend.gateway.tick_bus import TickBus

try:
    from backend.core.events import GatewayStatusEvent
except Exception:
    GatewayStatusEvent = None

logger = logging.getLogger(__name__)


class MarketDataGateway:
    def __init__(self, session_manager, tick_bus: TickBus, loop):
        """
        Store references only.
        Do not connect.
        Do not login.
        Do not subscribe.
        """
        self.session_manager = session_manager
        self.tick_bus = tick_bus
        self.loop = loop

        self.connection_state = "DISCONNECTED"
        self.tick_count = 0
        self.dropped_tick_count = 0
        self.last_tick_time: Optional[datetime] = None
        self.subscribed_symbols: list[str] = []
        self.last_error: Optional[str] = None

        self._subscription_payload: Optional[list[dict]] = None
        self._symbol_token_map: dict[str, str] = {}
        self._token_symbol_map: dict[str, str] = {}
        self._sws = None
        self._thread: Optional[threading.Thread] = None
        self.latest_data: dict[str, dict] = {}
        self._event_bus = None

    def set_event_bus(self, event_bus) -> None:
        self._event_bus = event_bus

    async def start(self, symbols: list[str]) -> bool:
        """
        Validate session_manager.is_valid.
        Resolve symbols to tokens.
        Build and store subscription payload.
        Create SmartWebSocketV2.
        Register callbacks.
        Launch sws.connect() in daemon OS thread.
        Set state to CONNECTING.
        Return True if thread launch succeeds, False otherwise.
        """
        if not self.session_manager.is_valid:
            self.connection_state = "DISCONNECTED"
            self.last_error = "Broker session is not valid"
            return False

        symbol_token_map, missing = resolve_symbols(symbols)
        if missing:
            logger.warning("MDG: Some symbols are missing instrument tokens")

        if not symbol_token_map:
            self.connection_state = "DISCONNECTED"
            self.last_error = "No symbols resolved to instrument tokens"
            return False

        self._symbol_token_map = symbol_token_map
        self._token_symbol_map = reverse_token_map(symbol_token_map)
        self.subscribed_symbols = list(symbol_token_map.keys())
        self._subscription_payload = [{
            "exchangeType": 1,
            "tokens": list(symbol_token_map.values()),
        }]

        try:
            self._sws = SmartWebSocketV2(
                self.session_manager.auth_token,
                settings.angel_api_key,
                settings.angel_client_code,
                self.session_manager.feed_token,
            )
            self._sws.on_open = self._on_open
            self._sws.on_data = self._on_data
            self._sws.on_error = self._on_error
            self._sws.on_close = self._on_close

            self.connection_state = "CONNECTING"
            self._thread = threading.Thread(target=self._sws.connect, daemon=True)
            self._thread.start()
            return True
        except Exception as exc:
            self.connection_state = "DEAD"
            self.last_error = exc.__class__.__name__
            logger.error(f"MDG: WebSocket startup failed: {exc.__class__.__name__}")
            return False

    async def update_subscriptions(self, symbols: list[str]) -> bool:
        symbol_token_map, missing = resolve_symbols(symbols)
        if missing:
            logger.warning("MDG: Some requested subscription symbols are missing instrument tokens")
        if not symbol_token_map:
            self.last_error = "No symbols resolved to instrument tokens"
            return False

        self._symbol_token_map = symbol_token_map
        self._token_symbol_map = reverse_token_map(symbol_token_map)
        self.subscribed_symbols = list(symbol_token_map.keys())
        self._subscription_payload = [{
            "exchangeType": 1,
            "tokens": list(symbol_token_map.values()),
        }]

        if self.connection_state == "CONNECTED" and self._sws:
            self._sws.subscribe(
                correlation_id="stream0001",
                mode=3,
                token_list=self._subscription_payload,
            )
        return True

    def _on_open(self, wsapp):
        """
        Set state CONNECTED.
        Always call subscribe using stored self._subscription_payload.
        This is required so reconnects re-subscribe automatically.
        Push gateway_status event to TickBus using asyncio.run_coroutine_threadsafe().
        """
        self.connection_state = "CONNECTED"
        self.last_error = None

        subscriber = self._sws or wsapp
        if subscriber and self._subscription_payload:
            subscriber.subscribe(
                correlation_id="stream0001",
                mode=3,
                token_list=self._subscription_payload,
            )

        self._publish_event({
            "event_type": "gateway_status",
            "connection_state": self.connection_state,
            "subscribed_symbols": list(self.subscribed_symbols),
            "received_at": self._utc_now_iso(),
        })
        self._publish_gateway_status("CONNECTED", "SmartWebSocketV2 connection opened")

    def _on_data(self, wsapp, message):
        """
        HOT PATH.
        Normalize SmartAPI tick into internal tick dict.
        Convert price fields from paise to INR.
        """
        ticks = self._extract_ticks(message)
        for raw_tick in ticks:
            event = self._normalize_tick(raw_tick)
            if not event:
                continue

            self.tick_count += 1
            self.last_tick_time = datetime.now(timezone.utc)
            self.latest_data[event["token"]] = event
            self._publish_event(event, track_drop=True)

    def _on_error(self, wsapp, error):
        """
        Set state RECONNECTING.
        Log only error type, not full message.
        Push gateway_error event to TickBus.
        """
        self.connection_state = "RECONNECTING"
        self.last_error = error.__class__.__name__
        logger.error(f"MDG: WebSocket error: {self.last_error}")
        self._publish_event({
            "event_type": "gateway_error",
            "connection_state": self.connection_state,
            "error_type": self.last_error,
            "received_at": self._utc_now_iso(),
        })
        self._publish_gateway_status("ERROR", "SmartWebSocketV2 connection error")

    def _on_close(self, wsapp, close_status_code=None, close_msg=None):
        """
        Set state RECONNECTING.
        Log safe message only.
        Push gateway_status event.
        """
        self.connection_state = "RECONNECTING"
        logger.warning("MDG: WebSocket connection closed")
        self._publish_event({
            "event_type": "gateway_status",
            "connection_state": self.connection_state,
            "received_at": self._utc_now_iso(),
        })
        self._publish_gateway_status("DISCONNECTED", "SmartWebSocketV2 connection closed")

    def status(self) -> dict:
        """
        Return safe health.
        """
        now = datetime.now(timezone.utc)
        last_tick_age = None
        if self.last_tick_time:
            last_tick_age = (now - self.last_tick_time).total_seconds()

        return {
            "connection_state": self.connection_state,
            "tick_count": self.tick_count,
            "dropped_tick_count": self.dropped_tick_count,
            "drop_rate_pct": self.tick_bus.drop_rate * 100.0,
            "last_tick_time": self.last_tick_time.isoformat() if self.last_tick_time else None,
            "last_tick_age_seconds": last_tick_age,
            "subscribed_symbols": list(self.subscribed_symbols),
            "last_error": self.last_error,
            "tick_bus": self.tick_bus.stats(),
        }

    def _publish_event(self, event: dict, track_drop: bool = False) -> None:
        future = asyncio.run_coroutine_threadsafe(
            self.tick_bus.put_nowait_safe(event),
            self.loop,
        )
        if track_drop:
            future.add_done_callback(self._track_drop_result)

    def _publish_gateway_status(self, status: str, detail: str) -> None:
        if not self._event_bus or GatewayStatusEvent is None:
            return
        try:
            event = GatewayStatusEvent(
                status=status,
                detail=detail,
                connection_state=self.connection_state,
                tick_count=self.tick_count,
                dropped_tick_count=self.dropped_tick_count,
                drop_rate_pct=self.tick_bus.drop_rate * 100.0,
                subscribed_symbols=list(self.subscribed_symbols),
            )
            asyncio.run_coroutine_threadsafe(self._event_bus.publish(event), self.loop)
        except Exception:
            logger.warning("MDG: Gateway status event publish failed")

    def _track_drop_result(self, future) -> None:
        try:
            queued = future.result()
        except Exception:
            queued = False
        if not queued:
            self.dropped_tick_count += 1

    def _extract_ticks(self, message: Any) -> list[dict]:
        if isinstance(message, dict):
            data = message.get("data")
            if isinstance(data, list):
                return [tick for tick in data if isinstance(tick, dict)]
            if isinstance(data, dict):
                return [data]
            return [message]
        if isinstance(message, list):
            return [tick for tick in message if isinstance(tick, dict)]
        return []

    def _normalize_tick(self, tick: dict) -> Optional[dict]:
        token = self._to_str(tick.get("token") or tick.get("symboltoken"))
        if not token:
            return None

        best_buy = self._first_depth_entry(tick.get("best_5_buy_data"))
        best_sell = self._first_depth_entry(tick.get("best_5_sell_data"))
        best_bid = self._paise_to_inr(best_buy.get("price") if best_buy else tick.get("best_bid_price"))
        best_ask = self._paise_to_inr(best_sell.get("price") if best_sell else tick.get("best_ask_price"))
        bid_qty = self._to_int(best_buy.get("quantity") if best_buy else tick.get("best_bid_quantity"))
        ask_qty = self._to_int(best_sell.get("quantity") if best_sell else tick.get("best_ask_quantity"))
        spread = None
        if best_bid is not None and best_ask is not None:
            spread = best_ask - best_bid

        received_at = self._utc_now_iso()
        return {
            "event_type": "tick",
            "symbol": self._token_symbol_map.get(token),
            "token": token,
            "ltp": self._paise_to_inr(tick.get("last_traded_price")),
            "best_bid": best_bid,
            "best_ask": best_ask,
            "bid_qty": bid_qty,
            "ask_qty": ask_qty,
            "spread": spread,
            "vwap": self._paise_to_inr(tick.get("average_trade_price") or tick.get("avg_traded_price")),
            "volume": self._to_int(tick.get("volume_trade_for_the_day") or tick.get("vol_traded_today")),
            "ltq": self._to_int(tick.get("last_traded_quantity")),
            "exchange_timestamp": tick.get("exchange_timestamp"),
            "received_at": received_at,
        }

    def _first_depth_entry(self, value: Any) -> Optional[dict]:
        if isinstance(value, list) and value and isinstance(value[0], dict):
            return value[0]
        return None

    def _paise_to_inr(self, value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value) / 100.0
        except (TypeError, ValueError):
            return None

    def _to_int(self, value: Any) -> Optional[int]:
        try:
            if value is None:
                return None
            return int(value)
        except (TypeError, ValueError):
            return None

    def _to_str(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        return str(value)

    def _utc_now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()
