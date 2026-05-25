import asyncio
from typing import Optional

from loguru import logger

from backend.core.types import OrderStatus
from backend.execution.order_store import OrderStore


class OrderPoller:
    def __init__(
        self,
        session_manager,
        order_state_machine,
        event_bus=None,
        order_store: Optional[OrderStore] = None,
        poll_interval_seconds: int = 10,
    ):
        self.session_manager = session_manager
        self.order_state_machine = order_state_machine
        self.event_bus = event_bus
        self.order_store = order_store  # May be None for legacy callers without Phase 18C OMS
        self.poll_interval_seconds = poll_interval_seconds
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        if not self._task:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def _poll_loop(self):
        while True:
            await self.poll_once()
            await asyncio.sleep(self.poll_interval_seconds)

    async def poll_once(self) -> None:
        if not self.session_manager or not getattr(self.session_manager, "is_valid", False):
            return
        smart_api = getattr(self.session_manager, "smart_api", None)
        if not smart_api:
            return
        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, smart_api.orderBook)
        except Exception as exc:
            logger.warning(f"Order book poll failed: {exc.__class__.__name__}")
            return
        for row in self._rows(response):
            self._apply_broker_row(row)

    def _rows(self, response) -> list:
        if isinstance(response, dict):
            data = response.get("data", [])
            return data if isinstance(data, list) else []
        return response if isinstance(response, list) else []

    def _apply_broker_row(self, row: dict) -> None:
        broker_order_id = str(
            row.get("orderid") or row.get("order_id") or row.get("uniqueorderid") or ""
        )
        status = self._map_status(
            str(row.get("status") or row.get("orderstatus") or "").upper()
        )
        if not broker_order_id or not status:
            return

        filled_quantity = int(
            row.get("filledshares") or row.get("filled_quantity") or 0
        )
        avg_fill_price = self._float_or_none(
            row.get("averageprice") or row.get("avg_fill_price")
        )
        reject_reason = row.get("text") if status == OrderStatus.REJECTED.value else None

        for order in self.order_state_machine.pending_orders() + self.order_state_machine.open_orders():
            if order.broker_order_id != broker_order_id:
                continue
            try:
                self.order_state_machine.transition(
                    order.order_id,
                    status,
                    filled_quantity=filled_quantity or order.filled_quantity,
                    avg_fill_price=avg_fill_price or order.avg_fill_price,
                    reject_reason=reject_reason,
                )
                # Phase 18E fix: persist the broker-derived status update to OrderStore.
                # Uses order.intent_id as the request_id link (set during create_order).
                self._persist_to_store(
                    request_id=order.intent_id,
                    broker_order_id=broker_order_id,
                    db_status=status,
                    reject_reason=reject_reason,
                )
            except ValueError:
                logger.warning("Broker order state transition mismatch")

    def _persist_to_store(
        self,
        request_id: Optional[str],
        broker_order_id: str,
        db_status: str,
        reject_reason: Optional[str] = None,
    ) -> None:
        """Write broker-derived order status update to the persistent OrderStore.

        Intentionally defensive — if request_id is absent or store is unavailable
        we log a warning but do not raise, to avoid blocking the poll loop.
        """
        if not self.order_store or not request_id:
            return
        try:
            self.order_store.update_order_status(
                request_id,
                db_status,
                reason=reject_reason,
                broker_order_id=broker_order_id,
            )
            self.order_store.add_order_event(
                request_id,
                f"BROKER_POLL:{db_status}",
                db_status,
                reason=reject_reason,
                broker_order_id=broker_order_id,
            )
        except Exception as exc:
            logger.warning(f"OrderPoller: failed to persist update for {request_id}: {exc.__class__.__name__}")

    def _map_status(self, status: str) -> Optional[str]:
        if status == "COMPLETE":
            return OrderStatus.FILLED.value
        if status == "REJECTED":
            return OrderStatus.REJECTED.value
        if status == "CANCELLED":
            return OrderStatus.CANCELLED.value
        if status in {"OPEN", "TRIGGER PENDING"}:
            return OrderStatus.OPEN.value
        if status == "PENDING":
            return OrderStatus.PENDING.value
        return None

    def _float_or_none(self, value) -> Optional[float]:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
