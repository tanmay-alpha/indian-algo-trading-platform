from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Any, List

from loguru import logger

from backend.core.events import SystemHealthEvent
from backend.execution.order_store import is_terminal_order_status


@dataclass
class BrokerOrderSnapshot:
    broker_order_id: str
    symbol: str
    side: str
    quantity: int
    filled_quantity: int
    status: str
    client_order_id: Optional[str] = None
    request_id: Optional[str] = None
    average_price: Optional[float] = None
    updated_at: Optional[str] = None
    raw_status: Optional[str] = None

    def __post_init__(self):
        if self.raw_status is None:
            self.raw_status = self.status
        self.status = normalize_broker_order_status(self.raw_status)


@dataclass
class LocalOrderSnapshot:
    request_id: str
    client_order_id: str
    idempotency_key: str
    broker_order_id: Optional[str]
    symbol: str
    side: str
    quantity: int
    status: str
    updated_at: Optional[str] = None


@dataclass
class OrderReconciliationMismatch:
    severity: str  # HIGH, MEDIUM, LOW
    mismatch_type: str
    request_id: Optional[str]
    broker_order_id: Optional[str]
    local_status: Optional[str]
    broker_status: Optional[str]
    detail: str


@dataclass
class OrderReconciliationReport:
    checked_at: datetime
    local_active_count: int
    broker_order_count: int
    matched_count: int
    mismatch_count: int
    missing_on_broker_count: int
    missing_locally_count: int
    mismatches: list[OrderReconciliationMismatch] = field(default_factory=list)


def normalize_broker_order_status(raw_status: str) -> str:
    if not raw_status:
        return "UNKNOWN"
    status_lower = raw_status.strip().lower()
    if status_lower in ("complete", "completed", "filled", "fully_filled", "fully filled"):
        return "FILLED"
    elif status_lower in ("rejected", "reject", "rejected_order"):
        return "REJECTED"
    elif status_lower in ("cancelled", "canceled", "cancelled_order"):
        return "CANCELLED"
    elif status_lower in (
        "open", "pending", "trigger pending", "trigger_pending",
        "validation pending", "validation_pending",
        "accepted", "accept", "partial", "partially filled", "partially_filled",
        "put_order_req_received", "put order req received"
    ):
        if status_lower in (
            "open", "trigger pending", "trigger_pending", "accepted", "accept",
            "partial", "partially filled", "partially_filled"
        ):
            return "OPEN"
        return "PENDING"
    else:
        return "UNKNOWN"


class OrderReconciliationEngine:
    def __init__(self, order_store, order_state_machine=None, event_bus=None):
        self.order_store = order_store
        self.order_state_machine = order_state_machine
        self.event_bus = event_bus

    def reconcile(self, local_orders: list = None, broker_orders: list = None) -> OrderReconciliationReport:
        checked_at = datetime.now(timezone.utc)

        # 1. Load local active orders from OrderStore if local_orders not provided
        if local_orders is None:
            local_orders = self.order_store.get_active_requests()

        local_snapshots = []
        for o in (local_orders or []):
            if isinstance(o, dict):
                local_snapshots.append(LocalOrderSnapshot(
                    request_id=o.get("request_id", ""),
                    client_order_id=o.get("client_order_id", "") or o.get("request_id", ""),
                    idempotency_key=o.get("idempotency_key", ""),
                    broker_order_id=o.get("broker_order_id"),
                    symbol=o.get("symbol", ""),
                    side=o.get("side", ""),
                    quantity=int(o.get("quantity") or 0),
                    status=o.get("status", ""),
                    updated_at=o.get("updated_at"),
                ))
            elif isinstance(o, LocalOrderSnapshot):
                local_snapshots.append(o)
            else:
                local_snapshots.append(LocalOrderSnapshot(
                    request_id=getattr(o, "request_id", ""),
                    client_order_id=getattr(o, "client_order_id", None) or getattr(o, "request_id", ""),
                    idempotency_key=getattr(o, "idempotency_key", ""),
                    broker_order_id=getattr(o, "broker_order_id", None),
                    symbol=getattr(o, "symbol", ""),
                    side=getattr(o, "side", ""),
                    quantity=int(getattr(o, "quantity", 0)),
                    status=getattr(o, "status", ""),
                    updated_at=getattr(o, "updated_at", None),
                ))

        broker_snapshots = []
        for b in (broker_orders or []):
            if isinstance(b, dict):
                # Fallback mapping for Angel One Smart API response fields
                broker_order_id = b.get("broker_order_id") or b.get("orderid") or ""
                client_order_id = b.get("client_order_id") or b.get("uniqueorderid") or b.get("request_id")
                request_id = b.get("request_id") or b.get("uniqueorderid") or b.get("client_order_id")
                symbol = b.get("symbol") or b.get("tradingsymbol") or ""
                side = b.get("side") or b.get("transactiontype") or ""
                filled_quantity = int(b.get("filled_quantity") or b.get("filledshares") or 0)
                quantity = int(b.get("quantity") or b.get("qty") or filled_quantity or 0)
                status = b.get("status") or ""
                average_price = b.get("average_price") or b.get("avg_price") or b.get("averageprice")
                updated_at = b.get("updated_at") or b.get("updatetime")
                raw_status = b.get("raw_status") or status

                broker_snapshots.append(BrokerOrderSnapshot(
                    broker_order_id=broker_order_id,
                    client_order_id=client_order_id,
                    request_id=request_id,
                    symbol=symbol,
                    side=side,
                    quantity=quantity,
                    filled_quantity=filled_quantity,
                    status=status,
                    average_price=average_price,
                    updated_at=updated_at,
                    raw_status=raw_status,
                ))
            elif isinstance(b, BrokerOrderSnapshot):
                broker_snapshots.append(b)
            else:
                broker_snapshots.append(BrokerOrderSnapshot(
                    broker_order_id=getattr(b, "broker_order_id", ""),
                    client_order_id=getattr(b, "client_order_id", None) or getattr(b, "request_id", None),
                    request_id=getattr(b, "request_id", None) or getattr(b, "client_order_id", None),
                    symbol=getattr(b, "symbol", ""),
                    side=getattr(b, "side", ""),
                    quantity=int(getattr(b, "quantity", 0)),
                    filled_quantity=int(getattr(b, "filled_quantity", 0)),
                    status=getattr(b, "status", ""),
                    average_price=getattr(b, "average_price", None) or getattr(b, "avg_price", None),
                    updated_at=getattr(b, "updated_at", None),
                    raw_status=getattr(b, "raw_status", None),
                ))

        broker_by_id = {b.broker_order_id: b for b in broker_snapshots if b.broker_order_id}
        broker_by_client_id = {b.client_order_id: b for b in broker_snapshots if b.client_order_id}
        broker_by_request_id = {b.request_id: b for b in broker_snapshots if b.request_id}

        matched_broker_ids = set()
        matched_count = 0
        mismatches = []
        missing_on_broker_count = 0

        for local in local_snapshots:
            matched_broker = None
            if local.broker_order_id and local.broker_order_id in broker_by_id:
                matched_broker = broker_by_id[local.broker_order_id]
            elif local.client_order_id and local.client_order_id in broker_by_client_id:
                matched_broker = broker_by_client_id[local.client_order_id]
            elif local.request_id and local.request_id in broker_by_request_id:
                matched_broker = broker_by_request_id[local.request_id]

            if not local.broker_order_id and local.status not in ("RISK_REJECTED", "DUPLICATE_REJECTED"):
                mismatches.append(OrderReconciliationMismatch(
                    severity="MEDIUM",
                    mismatch_type="MISSING_BROKER_ORDER_ID",
                    request_id=local.request_id,
                    broker_order_id=None,
                    local_status=local.status,
                    broker_status=None,
                    detail=f"Local active order {local.request_id} is missing a broker_order_id.",
                ))

            if matched_broker:
                matched_broker_ids.add(matched_broker.broker_order_id)
                matched_count += 1

                # 1. Status comparison
                if local.status != matched_broker.status:
                    is_local_terminal = is_terminal_order_status(local.status)
                    is_broker_terminal = is_terminal_order_status(matched_broker.status)

                    if is_broker_terminal and not is_local_terminal:
                        severity = "HIGH"
                        mismatch_type = "BROKER_TERMINAL_NOT_PERSISTED"
                        detail = f"Broker says order is terminal ({matched_broker.status}) but locally it is active ({local.status})."
                    elif is_local_terminal and not is_broker_terminal:
                        severity = "HIGH"
                        mismatch_type = "LOCAL_TERMINAL_BUT_BROKER_ACTIVE"
                        detail = f"Locally order is terminal ({local.status}) but broker says active ({matched_broker.status})."
                    else:
                        severity = "HIGH" if (is_local_terminal or is_broker_terminal) else "MEDIUM"
                        mismatch_type = "STATUS_MISMATCH"
                        detail = f"Status mismatch: local={local.status}, broker={matched_broker.status}."

                    mismatches.append(OrderReconciliationMismatch(
                        severity=severity,
                        mismatch_type=mismatch_type,
                        request_id=local.request_id,
                        broker_order_id=matched_broker.broker_order_id,
                        local_status=local.status,
                        broker_status=matched_broker.status,
                        detail=detail,
                    ))

                # 2. Quantity check
                if local.quantity != matched_broker.quantity:
                    mismatches.append(OrderReconciliationMismatch(
                        severity="MEDIUM",
                        mismatch_type="QUANTITY_MISMATCH",
                        request_id=local.request_id,
                        broker_order_id=matched_broker.broker_order_id,
                        local_status=local.status,
                        broker_status=matched_broker.status,
                        detail=f"Quantity mismatch: local={local.quantity}, broker={matched_broker.quantity}.",
                    ))
            else:
                if local.status not in ("RISK_REJECTED", "DUPLICATE_REJECTED"):
                    missing_on_broker_count += 1
                    mismatches.append(OrderReconciliationMismatch(
                        severity="MEDIUM",
                        mismatch_type="MISSING_ON_BROKER",
                        request_id=local.request_id,
                        broker_order_id=local.broker_order_id,
                        local_status=local.status,
                        broker_status=None,
                        detail=f"Local active order {local.request_id} is missing on the broker.",
                    ))

        # 3. Detect broker active order missing locally
        missing_locally_count = 0
        for broker in broker_snapshots:
            if broker.broker_order_id not in matched_broker_ids:
                is_broker_terminal = is_terminal_order_status(broker.status)
                if not is_broker_terminal:
                    missing_locally_count += 1
                    mismatches.append(OrderReconciliationMismatch(
                        severity="HIGH",
                        mismatch_type="MISSING_LOCALLY",
                        request_id=broker.request_id,
                        broker_order_id=broker.broker_order_id,
                        local_status=None,
                        broker_status=broker.status,
                        detail=f"Active broker order {broker.broker_order_id} is missing locally.",
                    ))

        return OrderReconciliationReport(
            checked_at=checked_at,
            local_active_count=len(local_snapshots),
            broker_order_count=len(broker_snapshots),
            matched_count=matched_count,
            mismatch_count=len(mismatches),
            missing_on_broker_count=missing_on_broker_count,
            missing_locally_count=missing_locally_count,
            mismatches=mismatches,
        )

    async def apply_broker_report(self, report: OrderReconciliationReport, broker_orders: list = None) -> int:
        db_updates_count = 0

        broker_snapshots = []
        for b in (broker_orders or []):
            if isinstance(b, dict):
                # Fallback mapping for Angel One Smart API response fields
                broker_order_id = b.get("broker_order_id") or b.get("orderid") or ""
                client_order_id = b.get("client_order_id") or b.get("uniqueorderid") or b.get("request_id")
                request_id = b.get("request_id") or b.get("uniqueorderid") or b.get("client_order_id")
                symbol = b.get("symbol") or b.get("tradingsymbol") or ""
                side = b.get("side") or b.get("transactiontype") or ""
                filled_quantity = int(b.get("filled_quantity") or b.get("filledshares") or 0)
                quantity = int(b.get("quantity") or b.get("qty") or filled_quantity or 0)
                status = b.get("status") or ""
                average_price = b.get("average_price") or b.get("avg_price") or b.get("averageprice")
                updated_at = b.get("updated_at") or b.get("updatetime")
                raw_status = b.get("raw_status") or status

                broker_snapshots.append(BrokerOrderSnapshot(
                    broker_order_id=broker_order_id,
                    client_order_id=client_order_id,
                    request_id=request_id,
                    symbol=symbol,
                    side=side,
                    quantity=quantity,
                    filled_quantity=filled_quantity,
                    status=status,
                    average_price=average_price,
                    updated_at=updated_at,
                    raw_status=raw_status,
                ))
            elif isinstance(b, BrokerOrderSnapshot):
                broker_snapshots.append(b)

        broker_by_id = {b.broker_order_id: b for b in broker_snapshots if b.broker_order_id}
        broker_by_client_id = {b.client_order_id: b for b in broker_snapshots if b.client_order_id}
        broker_by_request_id = {b.request_id: b for b in broker_snapshots if b.request_id}

        for mismatch in report.mismatches:
            # Publish system health events for HIGH mismatches
            if mismatch.severity == "HIGH" and self.event_bus:
                try:
                    event = SystemHealthEvent(
                        component="order_reconciliation",
                        status="ERROR",
                        detail=mismatch.detail,
                        metrics={
                            "request_id": mismatch.request_id,
                            "broker_order_id": mismatch.broker_order_id,
                            "local_status": mismatch.local_status,
                            "broker_status": mismatch.broker_status,
                            "mismatch_type": mismatch.mismatch_type,
                        }
                    )
                    await self.event_bus.publish(event)
                except Exception as e:
                    logger.error(f"Failed to publish reconciliation SystemHealthEvent: {e}")

            if mismatch.local_status == "RISK_REJECTED":
                continue

            # Update status for BROKER_TERMINAL_NOT_PERSISTED / STATUS_MISMATCH
            if mismatch.mismatch_type in ("BROKER_TERMINAL_NOT_PERSISTED", "STATUS_MISMATCH"):
                broker_status = mismatch.broker_status
                if broker_status and is_terminal_order_status(broker_status) and broker_status != "UNKNOWN":
                    request_id = mismatch.request_id
                    if request_id:
                        self.order_store.update_order_status(
                            request_id=request_id,
                            status=broker_status,
                            reason="broker_reconciliation_sync",
                            broker_order_id=mismatch.broker_order_id,
                        )
                        self.order_store.add_order_event(
                            request_id=request_id,
                            event_type="RECONCILIATION_SYNC",
                            status=broker_status,
                            reason="broker_reconciliation_sync",
                            broker_order_id=mismatch.broker_order_id,
                        )
                        
                        # Sync to in-memory state machine
                        if self.order_state_machine and request_id in self.order_state_machine._orders:
                            try:
                                matched_broker = (
                                    broker_by_id.get(mismatch.broker_order_id)
                                    or broker_by_request_id.get(request_id)
                                    or broker_by_client_id.get(request_id)
                                )
                                filled_qty = 0
                                if matched_broker:
                                    filled_qty = matched_broker.filled_quantity or matched_broker.quantity

                                self.order_state_machine.transition(
                                    request_id,
                                    broker_status,
                                    reject_reason="broker_reconciliation_sync",
                                    broker_order_id=mismatch.broker_order_id,
                                    filled_quantity=filled_qty
                                )
                            except Exception as e:
                                logger.warning(f"Failed to transition state machine for {request_id}: {e}. Fallback to direct update.")
                                current = self.order_state_machine._orders[request_id]
                                from dataclasses import replace
                                self.order_state_machine._orders[request_id] = replace(
                                    current,
                                    status=broker_status,
                                    reject_reason="broker_reconciliation_sync",
                                    broker_order_id=mismatch.broker_order_id or current.broker_order_id,
                                    filled_quantity=filled_qty,
                                    updated_at=datetime.now(timezone.utc)
                                )
                        
                        db_updates_count += 1

            # Persist broker_order_id if missing and match is safe
            elif mismatch.mismatch_type == "MISSING_BROKER_ORDER_ID":
                request_id = mismatch.request_id
                matched_broker = broker_by_request_id.get(request_id) or broker_by_client_id.get(request_id)
                if matched_broker and matched_broker.broker_order_id:
                    self.order_store.update_broker_order_id(request_id, matched_broker.broker_order_id)
                    self.order_store.add_order_event(
                        request_id=request_id,
                        event_type="RECONCILIATION_SYNC",
                        status=mismatch.local_status or "OPEN",
                        reason="broker_order_id_sync",
                        broker_order_id=matched_broker.broker_order_id,
                    )
                    
                    if self.order_state_machine and request_id in self.order_state_machine._orders:
                        current = self.order_state_machine._orders[request_id]
                        from dataclasses import replace
                        self.order_state_machine._orders[request_id] = replace(
                            current,
                            broker_order_id=matched_broker.broker_order_id,
                            updated_at=datetime.now(timezone.utc)
                        )
                    
                    db_updates_count += 1

        return db_updates_count
