import asyncio
from typing import Optional

from loguru import logger

from backend.core.types import OrderStatus


class OrderPoller:
    def __init__(self, session_manager, order_state_machine, event_bus=None, poll_interval_seconds: int = 10):
        self.session_manager = session_manager
        self.order_state_machine = order_state_machine
        self.event_bus = event_bus
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

    def _rows(self, response) -> list[dict]:
        if isinstance(response, dict):
            data = response.get("data", [])
            return data if isinstance(data, list) else []
        return response if isinstance(response, list) else []

    def _apply_broker_row(self, row: dict) -> None:
        broker_order_id = str(row.get("orderid") or row.get("order_id") or row.get("uniqueorderid") or "")
        status = self._map_status(str(row.get("status") or row.get("orderstatus") or "").upper())
        if not broker_order_id or not status:
            return
        for order in self.order_state_machine.pending_orders() + self.order_state_machine.open_orders():
            if order.broker_order_id == broker_order_id:
                try:
                    self.order_state_machine.transition(
                        order.order_id,
                        status,
                        filled_quantity=int(row.get("filledshares") or row.get("filled_quantity") or order.filled_quantity),
                        avg_fill_price=self._float_or_none(row.get("averageprice") or row.get("avg_fill_price")) or order.avg_fill_price,
                        reject_reason=row.get("text") if status == OrderStatus.REJECTED.value else None,
                    )
                except ValueError:
                    logger.warning("Broker order state transition mismatch")

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
