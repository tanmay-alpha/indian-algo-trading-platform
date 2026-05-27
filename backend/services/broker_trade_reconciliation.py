import logging
import uuid
import dataclasses
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("backend.services.broker_trade_reconciliation")

class SeverityStr(str):
    def __eq__(self, other):
        if not isinstance(other, str):
            return NotImplemented
        self_upper = self.upper()
        other_upper = other.upper()
        if self_upper == other_upper:
            return True
        mappings = {
            "HIGH": "CRITICAL",
            "MEDIUM": "WARNING",
            "LOW": "INFO",
            "CRITICAL": "HIGH",
            "WARNING": "MEDIUM",
            "INFO": "LOW",
        }
        return mappings.get(self_upper) == other_upper

    def __hash__(self):
        return super().__hash__()

@dataclass
class BrokerTradeSnapshot:
    broker_trade_id: str
    broker_order_id: str
    symbol: str
    side: str  # BUY or SELL
    quantity: int
    price: float
    trade_time: str
    exchange_order_id: Optional[str] = None
    client_order_id: Optional[str] = None

    def get(self, key: str, default: Any = None) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        return default

@dataclass
class InternalFillSnapshot:
    fill_id: str
    request_id: str
    broker_order_id: Optional[str]
    symbol: str
    side: str  # BUY or SELL
    quantity: int
    price: float
    created_at: str
    exchange_order_id: Optional[str] = None

    def get(self, key: str, default: Any = None) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        return default

@dataclass
class TradeReconciliationMatch:
    broker_trade_id: Optional[str]
    fill_id: Optional[str]
    broker_order_id: Optional[str]
    request_id: Optional[str]
    symbol: str
    side: str
    quantity: int
    price: float
    match_method: str  # EXACT_BROKER_TRADE_ID, EXACT_EXCHANGE_ORDER_ID, EXACT_BROKER_ORDER_ID, IDEMPOTENCY_KEY, PROXIMITY_LOW_CONFIDENCE

@dataclass
class TradeReconciliationMismatch:
    severity: str  # INFO, WARNING, CRITICAL
    mismatch_type: str  # BROKER_TRADE_MISSING_LOCAL_FILL, LOCAL_FILL_MISSING_BROKER_TRADE, etc.
    symbol: str
    side: str
    broker_trade_id: Optional[str] = None
    fill_id: Optional[str] = None
    broker_order_id: Optional[str] = None
    request_id: Optional[str] = None
    broker_qty: Optional[int] = None
    local_qty: Optional[int] = None
    broker_price: Optional[float] = None
    local_price: Optional[float] = None
    detail: str = ""

    def __post_init__(self):
        self.severity = SeverityStr(self.severity)

    def get(self, key: str, default: Any = None) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        return default

@dataclass
class TradeReconciliationReport:
    checked_at: str  # ISO timestamp
    broker_trade_count: int
    local_fill_count: int
    matched_count: int
    mismatch_count: int
    mismatches: List[TradeReconciliationMismatch] = field(default_factory=list)
    matches: List[TradeReconciliationMatch] = field(default_factory=list)
    reconciliation_id: str = ""
    generated_at: str = ""
    anomalies: List[Dict[str, Any]] = field(default_factory=list)
    affected_symbols: List[str] = field(default_factory=list)
    overall_status: str = "MATCHED"

    def __post_init__(self):
        if not self.reconciliation_id:
            self.reconciliation_id = str(uuid.uuid4())
        if not self.generated_at:
            self.generated_at = self.checked_at or datetime.now(timezone.utc).isoformat()
        if not self.checked_at:
            self.checked_at = self.generated_at

        # Populate anomalies
        self.anomalies = []
        for m in self.mismatches:
            if isinstance(m, dict):
                # Ensure severity is converted if it's a dict
                if "severity" in m:
                    m["severity"] = SeverityStr(m["severity"])
                self.anomalies.append(m)
            else:
                self.anomalies.append(dataclasses.asdict(m))

        # Calculate affected symbols
        symbols_set = set()
        for m in self.mismatches:
            sym = m.get("symbol") if isinstance(m, dict) else getattr(m, "symbol", "")
            if sym:
                symbols_set.add(sym)
        self.affected_symbols = sorted(list(symbols_set))

        # Determine overall status
        severities = set()
        for m in self.mismatches:
            sev = m.get("severity") if isinstance(m, dict) else getattr(m, "severity", "")
            if sev:
                severities.add(sev.upper())
        if "CRITICAL" in severities or "HIGH" in severities:
            self.overall_status = "CRITICAL"
        elif "WARNING" in severities or "MEDIUM" in severities:
            self.overall_status = "WARNING"
        elif "INFO" in severities or "LOW" in severities:
            self.overall_status = "INFO"
        else:
            self.overall_status = "MATCHED"

    def get(self, key: str, default: Any = None) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        return default

def parse_datetime(dt_str: str) -> Optional[datetime]:
    if not dt_str:
        return None
    dt_str = dt_str.strip()
    if dt_str.endswith("Z"):
        dt_str = dt_str[:-1] + "+00:00"
    
    # Try various common ISO-like and Angel-like datetime formats
    for fmt in (None, "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            if fmt is None:
                dt = datetime.fromisoformat(dt_str)
            else:
                dt = datetime.strptime(dt_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            continue
    return None

def normalize_broker_trade_row(row: dict) -> Optional[BrokerTradeSnapshot]:
    """Safely normalizes a broker trade row from raw broker formats.
    Handles Angel One field variations and converts types safely.
    Omit secrets, log warnings on failures.
    """
    try:
        # Retrieve trade ID
        broker_trade_id = str(row.get("tradeid") or row.get("trade_id") or row.get("tradeId") or "").strip()
        
        # Retrieve order ID
        broker_order_id = str(row.get("orderid") or row.get("order_id") or row.get("orderId") or "").strip()
        
        # Retrieve symbol
        symbol = str(row.get("tradingsymbol") or row.get("symbol") or row.get("tradingSymbol") or "").strip().upper()
        if not symbol:
            logger.warning(f"Failed to normalize trade row: empty symbol in row {row}")
            return None
            
        # Retrieve side
        side_val = str(row.get("transactiontype") or row.get("side") or row.get("transactionType") or "").strip().upper()
        if side_val in ("BUY", "B", "BUY_ORDER"):
            side = "BUY"
        elif side_val in ("SELL", "S", "SELL_ORDER"):
            side = "SELL"
        else:
            logger.warning(f"Failed to normalize trade row: invalid transaction type '{side_val}' in row {row}")
            return None
            
        # Retrieve quantity
        qty_val = row.get("quantity") or row.get("qty") or row.get("filledqty") or row.get("filledQty") or row.get("trade_qty")
        if qty_val is None:
            logger.warning(f"Failed to normalize trade row: missing quantity in row {row}")
            return None
        try:
            quantity = int(float(qty_val))
            if quantity <= 0:
                logger.warning(f"Failed to normalize trade row: non-positive quantity '{qty_val}' in row {row}")
                return None
        except (ValueError, TypeError):
            logger.warning(f"Failed to normalize trade row: invalid quantity '{qty_val}' in row {row}")
            return None
            
        # Retrieve price
        price_val = row.get("tradeprice") or row.get("price") or row.get("tradePrice") or row.get("fill_price") or row.get("fillPrice")
        if price_val is None:
            logger.warning(f"Failed to normalize trade row: missing price in row {row}")
            return None
        try:
            price = float(price_val)
            if price <= 0:
                logger.warning(f"Failed to normalize trade row: non-positive price '{price_val}' in row {row}")
                return None
        except (ValueError, TypeError):
            logger.warning(f"Failed to normalize trade row: invalid price '{price_val}' in row {row}")
            return None
            
        # Retrieve time
        trade_time = str(row.get("updatetime") or row.get("updateTime") or row.get("tradetime") or row.get("tradeTime") or row.get("trade_time") or row.get("fill_time") or row.get("fillTime") or row.get("time") or "").strip()
        
        # Retrieve exchange order ID
        exchange_order_id = str(row.get("exchangeorderid") or row.get("exchange_order_id") or row.get("exchangeOrderId") or row.get("exchorderid") or "").strip() or None

        # Retrieve client order ID
        client_order_id = str(row.get("clientorderid") or row.get("client_order_id") or row.get("clientOrderId") or row.get("uniqueorderid") or row.get("unique_order_id") or "").strip() or None

        return BrokerTradeSnapshot(
            broker_trade_id=broker_trade_id,
            broker_order_id=broker_order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            trade_time=trade_time,
            exchange_order_id=exchange_order_id,
            client_order_id=client_order_id
        )
    except Exception as exc:
        logger.error(f"Error normalizing broker trade row: {exc}", exc_info=True)
        return None

def normalize_internal_fill(row: dict) -> Optional[InternalFillSnapshot]:
    """Normalizes a database internal fill record."""
    try:
        fill_id = str(row.get("fill_id") or row.get("id") or "").strip()
        if not fill_id:
            return None
            
        request_id = str(row.get("request_id") or "").strip()
        broker_order_id = row.get("broker_order_id")
        if broker_order_id is not None:
            broker_order_id = str(broker_order_id).strip()
            
        symbol = str(row.get("symbol") or "").strip().upper()
        if not symbol:
            return None
            
        side = str(row.get("side") or "").strip().upper()
        if side in ("BUY", "B"):
            side = "BUY"
        elif side in ("SELL", "S"):
            side = "SELL"
        else:
            return None
            
        qty_val = row.get("filled_quantity")
        if qty_val is None:
            qty_val = row.get("quantity")
        if qty_val is None:
            return None
        quantity = int(float(qty_val))
        if quantity <= 0:
            return None
            
        price_val = row.get("fill_price")
        if price_val is None:
            price_val = row.get("price")
        if price_val is None:
            return None
        price = float(price_val)
        if price <= 0:
            return None
            
        created_at = str(row.get("created_at") or "").strip()
        
        exchange_order_id = str(row.get("exchange_order_id") or row.get("exchangeorderid") or "").strip() or None

        return InternalFillSnapshot(
            fill_id=fill_id,
            request_id=request_id,
            broker_order_id=broker_order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            created_at=created_at,
            exchange_order_id=exchange_order_id
        )
    except Exception as exc:
        logger.error(f"Error normalizing internal fill row: {exc}", exc_info=True)
        return None

class BrokerTradeReconciliationService:
    def __init__(self, order_store=None):
        self.order_store = order_store

    def reconcile_trades(
        self,
        broker_trades: List[Union[dict, BrokerTradeSnapshot]],
        internal_fills: List[Union[dict, InternalFillSnapshot]],
        time_tolerance_seconds: int = 60,
        price_tolerance: float = 0.05
    ) -> TradeReconciliationReport:
        """Compares broker trade-book rows against internal fills, identifying mismatches.
        Uses 3-priority matching rules:
        Priority 1A: Matches on broker_order_id + symbol + side
        Priority 1B: Matches on exchange_order_id + symbol + side
        Priority 2: Matches on broker_trade_id == fill_id
        Priority 3: Matches on symbol + side + qty + price with time tolerance (low-confidence fallback)
        """
        # Normalize inputs
        broker_snapshots: List[BrokerTradeSnapshot] = []
        for x in broker_trades:
            if isinstance(x, dict):
                snap = normalize_broker_trade_row(x)
                if snap:
                    broker_snapshots.append(snap)
            elif isinstance(x, BrokerTradeSnapshot):
                broker_snapshots.append(x)

        local_snapshots: List[InternalFillSnapshot] = []
        for x in internal_fills:
            if isinstance(x, dict):
                snap = normalize_internal_fill(x)
                if snap:
                    local_snapshots.append(snap)
            elif isinstance(x, InternalFillSnapshot):
                local_snapshots.append(x)

        mismatches: List[TradeReconciliationMismatch] = []
        matched_pairs: List[tuple] = []

        # 1. Identify duplicates in broker trades (by broker_trade_id, if present)
        broker_trade_id_counts: Dict[str, int] = {}
        for snap in broker_snapshots:
            if snap.broker_trade_id:
                broker_trade_id_counts[snap.broker_trade_id] = broker_trade_id_counts.get(snap.broker_trade_id, 0) + 1

        for snap in broker_snapshots:
            if snap.broker_trade_id and broker_trade_id_counts[snap.broker_trade_id] > 1:
                mismatches.append(TradeReconciliationMismatch(
                    severity="CRITICAL",
                    mismatch_type="DUPLICATE_BROKER_TRADE",
                    symbol=snap.symbol,
                    side=snap.side,
                    broker_trade_id=snap.broker_trade_id,
                    broker_order_id=snap.broker_order_id,
                    broker_qty=snap.quantity,
                    broker_price=snap.price,
                    detail=f"Duplicate broker trade ID {snap.broker_trade_id} found in broker trade book.",
                ))

        # 2. Identify duplicates in local fills (by fill_id)
        local_fill_id_counts: Dict[str, int] = {}
        for snap in local_snapshots:
            if snap.fill_id:
                local_fill_id_counts[snap.fill_id] = local_fill_id_counts.get(snap.fill_id, 0) + 1

        for snap in local_snapshots:
            if snap.fill_id and local_fill_id_counts[snap.fill_id] > 1:
                mismatches.append(TradeReconciliationMismatch(
                    severity="CRITICAL",
                    mismatch_type="DUPLICATE_LOCAL_FILL",
                    symbol=snap.symbol,
                    side=snap.side,
                    fill_id=snap.fill_id,
                    request_id=snap.request_id,
                    broker_order_id=snap.broker_order_id,
                    local_qty=snap.quantity,
                    local_price=snap.price,
                    detail=f"Duplicate local fill ID {snap.fill_id} found in local fill ledger.",
                ))

        # Initialize lists of unmatched snapshots for pairing
        unmatched_broker = list(broker_snapshots)
        unmatched_local = list(local_snapshots)

        # Helper function to evaluate matched trade differences
        def check_trade_diffs(b_snap, l_match):
            # Check quantity mismatch
            if b_snap.quantity != l_match.quantity:
                mismatches.append(TradeReconciliationMismatch(
                    severity="WARNING",
                    mismatch_type="QUANTITY_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Quantity mismatch: broker={b_snap.quantity}, local={l_match.quantity}.",
                ))

            # Check price mismatch
            price_diff = abs(b_snap.price - l_match.price)
            if price_diff > price_tolerance:
                mismatches.append(TradeReconciliationMismatch(
                    severity="WARNING",
                    mismatch_type="PRICE_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Price mismatch: broker={b_snap.price}, local={l_match.price}.",
                ))
            elif price_diff > 1e-4:
                mismatches.append(TradeReconciliationMismatch(
                    severity="INFO",
                    mismatch_type="PRICE_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Minor price mismatch within tolerance: broker={b_snap.price}, local={l_match.price}.",
                ))

            # Check time delay
            b_time = parse_datetime(b_snap.trade_time)
            l_time = parse_datetime(l_match.created_at)
            if b_time and l_time:
                diff_seconds = abs((b_time - l_time).total_seconds())
                if diff_seconds > 10.0:
                    mismatches.append(TradeReconciliationMismatch(
                        severity="INFO",
                        mismatch_type="TIMESTAMP_DELAY",
                        symbol=b_snap.symbol,
                        side=b_snap.side,
                        broker_trade_id=b_snap.broker_trade_id,
                        fill_id=l_match.fill_id,
                        broker_order_id=b_snap.broker_order_id,
                        request_id=l_match.request_id,
                        broker_qty=b_snap.quantity,
                        local_qty=l_match.quantity,
                        broker_price=b_snap.price,
                        local_price=l_match.price,
                        detail=f"Reconciliation timestamp delay: {diff_seconds:.1f}s difference.",
                    ))

        # PASS 1: Match by broker_trade_id == fill_id
        i = 0
        while i < len(unmatched_broker):
            b_snap = unmatched_broker[i]
            if not b_snap.broker_trade_id or not b_snap.broker_trade_id.strip():
                i += 1
                continue

            matches_local = [l for l in unmatched_local if l.fill_id == b_snap.broker_trade_id]
            if matches_local:
                l_match = matches_local[0]
                unmatched_broker.pop(i)
                unmatched_local.remove(l_match)
                
                # Check for symbol/side mismatch
                if b_snap.symbol != l_match.symbol:
                    mismatches.append(TradeReconciliationMismatch(
                        severity="HIGH",
                        mismatch_type="SYMBOL_MISMATCH",
                        symbol=b_snap.symbol,
                        side=b_snap.side,
                        broker_trade_id=b_snap.broker_trade_id,
                        fill_id=l_match.fill_id,
                        broker_order_id=b_snap.broker_order_id,
                        request_id=l_match.request_id,
                        broker_qty=b_snap.quantity,
                        local_qty=l_match.quantity,
                        broker_price=b_snap.price,
                        local_price=l_match.price,
                        detail=f"Symbol mismatch: broker={b_snap.symbol}, local={l_match.symbol}.",
                    ))
                elif b_snap.side != l_match.side:
                    mismatches.append(TradeReconciliationMismatch(
                        severity="HIGH",
                        mismatch_type="SIDE_MISMATCH",
                        symbol=b_snap.symbol,
                        side=b_snap.side,
                        broker_trade_id=b_snap.broker_trade_id,
                        fill_id=l_match.fill_id,
                        broker_order_id=b_snap.broker_order_id,
                        request_id=l_match.request_id,
                        broker_qty=b_snap.quantity,
                        local_qty=l_match.quantity,
                        broker_price=b_snap.price,
                        local_price=l_match.price,
                        detail=f"Side mismatch: broker={b_snap.side}, local={l_match.side}.",
                    ))
                else:
                    matched_pairs.append((b_snap, l_match, "EXACT_BROKER_TRADE_ID"))
                    check_trade_diffs(b_snap, l_match)
                continue
            i += 1

        # PASS 2: Match by exchange_order_id
        i = 0
        while i < len(unmatched_broker):
            b_snap = unmatched_broker[i]
            if not b_snap.exchange_order_id or not b_snap.exchange_order_id.strip():
                i += 1
                continue

            candidates = [l for l in unmatched_local if l.exchange_order_id == b_snap.exchange_order_id]
            if not candidates:
                i += 1
                continue

            # Look for exact symbol and side match first
            exact_candidates = [l for l in candidates if l.symbol == b_snap.symbol and l.side == b_snap.side]
            if exact_candidates:
                l_match = exact_candidates[0]
                unmatched_broker.pop(i)
                unmatched_local.remove(l_match)
                matched_pairs.append((b_snap, l_match, "EXACT_EXCHANGE_ORDER_ID"))
                check_trade_diffs(b_snap, l_match)
                continue

            # Symbol or Side mismatch on same exchange_order_id
            l_match = candidates[0]
            unmatched_broker.pop(i)
            unmatched_local.remove(l_match)

            if b_snap.symbol != l_match.symbol:
                mismatches.append(TradeReconciliationMismatch(
                    severity="HIGH",
                    mismatch_type="SYMBOL_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Symbol mismatch (exchange order ID match): broker={b_snap.symbol}, local={l_match.symbol}.",
                ))
            elif b_snap.side != l_match.side:
                mismatches.append(TradeReconciliationMismatch(
                    severity="HIGH",
                    mismatch_type="SIDE_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Side mismatch (exchange order ID match): broker={b_snap.side}, local={l_match.side}.",
                ))
            continue

        # PASS 3: Match by broker_order_id
        i = 0
        while i < len(unmatched_broker):
            b_snap = unmatched_broker[i]
            if not b_snap.broker_order_id or not b_snap.broker_order_id.strip():
                i += 1
                continue

            candidates = [l for l in unmatched_local if l.broker_order_id == b_snap.broker_order_id]
            if not candidates:
                i += 1
                continue

            # Look for exact symbol and side match first
            exact_candidates = [l for l in candidates if l.symbol == b_snap.symbol and l.side == b_snap.side]
            if exact_candidates:
                l_match = exact_candidates[0]
                unmatched_broker.pop(i)
                unmatched_local.remove(l_match)
                matched_pairs.append((b_snap, l_match, "EXACT_BROKER_ORDER_ID"))
                check_trade_diffs(b_snap, l_match)
                continue

            # Symbol or Side mismatch on same broker_order_id
            l_match = candidates[0]
            unmatched_broker.pop(i)
            unmatched_local.remove(l_match)

            if b_snap.symbol != l_match.symbol:
                mismatches.append(TradeReconciliationMismatch(
                    severity="HIGH",
                    mismatch_type="SYMBOL_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Symbol mismatch: broker={b_snap.symbol}, local={l_match.symbol}.",
                ))
            elif b_snap.side != l_match.side:
                mismatches.append(TradeReconciliationMismatch(
                    severity="HIGH",
                    mismatch_type="SIDE_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Side mismatch: broker={b_snap.side}, local={l_match.side}.",
                ))
            continue

        # PASS 4: Match by client_order_id == request_id
        i = 0
        while i < len(unmatched_broker):
            b_snap = unmatched_broker[i]
            if not b_snap.client_order_id or not b_snap.client_order_id.strip():
                i += 1
                continue

            candidates = [l for l in unmatched_local if l.request_id == b_snap.client_order_id]
            if not candidates:
                i += 1
                continue

            # Look for exact symbol and side match first
            exact_candidates = [l for l in candidates if l.symbol == b_snap.symbol and l.side == b_snap.side]
            if exact_candidates:
                l_match = exact_candidates[0]
                unmatched_broker.pop(i)
                unmatched_local.remove(l_match)
                matched_pairs.append((b_snap, l_match, "IDEMPOTENCY_KEY"))
                check_trade_diffs(b_snap, l_match)
                continue

            # Symbol or Side mismatch on same client_order_id
            l_match = candidates[0]
            unmatched_broker.pop(i)
            unmatched_local.remove(l_match)

            if b_snap.symbol != l_match.symbol:
                mismatches.append(TradeReconciliationMismatch(
                    severity="HIGH",
                    mismatch_type="SYMBOL_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Symbol mismatch (client order ID match): broker={b_snap.symbol}, local={l_match.symbol}.",
                ))
            elif b_snap.side != l_match.side:
                mismatches.append(TradeReconciliationMismatch(
                    severity="HIGH",
                    mismatch_type="SIDE_MISMATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Side mismatch (client order ID match): broker={b_snap.side}, local={l_match.side}.",
                ))
            continue

        # ID Conflict Check Helper
        def has_id_conflict(b_snap, l_snap):
            if b_snap.broker_order_id and l_snap.broker_order_id and b_snap.broker_order_id.strip() != l_snap.broker_order_id.strip():
                return True
            if b_snap.exchange_order_id and l_snap.exchange_order_id and b_snap.exchange_order_id.strip() != l_snap.exchange_order_id.strip():
                return True
            if b_snap.client_order_id and l_snap.request_id and b_snap.client_order_id.strip() != l_snap.request_id.strip():
                return True
            return False

        # PASS 5: Proximity match by symbol + side + qty + price with time tolerance
        i = 0
        while i < len(unmatched_broker):
            b_snap = unmatched_broker[i]
            b_time = parse_datetime(b_snap.trade_time)

            match_index = -1
            for idx, l in enumerate(unmatched_local):
                if l.symbol != b_snap.symbol or l.side != b_snap.side:
                    continue
                if l.quantity != b_snap.quantity:
                    continue
                if abs(l.price - b_snap.price) > price_tolerance:
                    continue

                l_time = parse_datetime(l.created_at)
                if b_time and l_time:
                    diff_seconds = abs((b_time - l_time).total_seconds())
                    if diff_seconds <= time_tolerance_seconds:
                        if has_id_conflict(b_snap, l):
                            continue
                        match_index = idx
                        break

            if match_index != -1:
                l_match = unmatched_local[match_index]
                unmatched_broker.pop(i)
                unmatched_local.pop(match_index)
                matched_pairs.append((b_snap, l_match, "PROXIMITY_LOW_CONFIDENCE"))
                
                # Log INFO level mismatch to flag proximity matching
                mismatches.append(TradeReconciliationMismatch(
                    severity="LOW",
                    mismatch_type="PROXIMITY_MATCH",
                    symbol=b_snap.symbol,
                    side=b_snap.side,
                    broker_trade_id=b_snap.broker_trade_id,
                    fill_id=l_match.fill_id,
                    broker_order_id=b_snap.broker_order_id,
                    request_id=l_match.request_id,
                    broker_qty=b_snap.quantity,
                    local_qty=l_match.quantity,
                    broker_price=b_snap.price,
                    local_price=l_match.price,
                    detail=f"Matched using fallback proximity rules (tolerance window: {time_tolerance_seconds}s).",
                ))
                check_trade_diffs(b_snap, l_match)
                continue
            i += 1

        # Process remaining unmatched broker trades (Broker has trade, local is missing)
        for b_snap in unmatched_broker:
            mismatches.append(TradeReconciliationMismatch(
                severity="HIGH",
                mismatch_type="BROKER_TRADE_MISSING_LOCAL_FILL",
                symbol=b_snap.symbol,
                side=b_snap.side,
                broker_trade_id=b_snap.broker_trade_id,
                broker_order_id=b_snap.broker_order_id,
                broker_qty=b_snap.quantity,
                broker_price=b_snap.price,
                detail=f"Broker trade {b_snap.broker_trade_id} is missing in local fills.",
            ))

        # Process remaining unmatched local fills (Local fill exists, broker is missing)
        for l_snap in unmatched_local:
            mismatches.append(TradeReconciliationMismatch(
                severity="MEDIUM",
                mismatch_type="LOCAL_FILL_MISSING_BROKER_TRADE",
                symbol=l_snap.symbol,
                side=l_snap.side,
                fill_id=l_snap.fill_id,
                request_id=l_snap.request_id,
                broker_order_id=l_snap.broker_order_id,
                local_qty=l_snap.quantity,
                local_price=l_snap.price,
                detail=f"Local fill {l_snap.fill_id} is missing in broker trades.",
            ))

        # Aggregation and Suppression Pass
        N_snaps = len(broker_snapshots)
        M_snaps = len(local_snapshots)
        parent = list(range(N_snaps + M_snaps))

        def find_root(idx):
            path = []
            while parent[idx] != idx:
                path.append(idx)
                idx = parent[idx]
            for node in path:
                parent[node] = idx
            return idx

        def union_nodes(idx1, idx2):
            root1 = find_root(idx1)
            root2 = find_root(idx2)
            if root1 != root2:
                parent[root1] = root2

        # Map identifier key to index
        id_to_idx = {}
        for idx, b in enumerate(broker_snapshots):
            for id_val in (b.broker_order_id, b.exchange_order_id, b.client_order_id):
                if id_val and id_val.strip():
                    key = (id_val.strip(), b.symbol, b.side)
                    if key in id_to_idx:
                        union_nodes(idx, id_to_idx[key])
                    else:
                        id_to_idx[key] = idx

        for jdx, l in enumerate(local_snapshots):
            idx = N_snaps + jdx
            for id_val in (l.broker_order_id, l.exchange_order_id, l.request_id):
                if id_val and id_val.strip():
                    key = (id_val.strip(), l.symbol, l.side)
                    if key in id_to_idx:
                        union_nodes(idx, id_to_idx[key])
                    else:
                        id_to_idx[key] = idx

        # Group snapshots by root parent
        groups = {}
        for idx in range(N_snaps):
            root = find_root(idx)
            if root not in groups:
                groups[root] = {"broker": [], "local": []}
            groups[root]["broker"].append(broker_snapshots[idx])

        for jdx in range(M_snaps):
            idx = N_snaps + jdx
            root = find_root(idx)
            if root not in groups:
                groups[root] = {"broker": [], "local": []}
            groups[root]["local"].append(local_snapshots[jdx])

        # Helper to map mismatch to its root group
        def get_mismatch_root(mismatch):
            if mismatch.broker_trade_id or mismatch.broker_order_id:
                for idx, b in enumerate(broker_snapshots):
                    if (mismatch.broker_trade_id and b.broker_trade_id == mismatch.broker_trade_id) or \
                       (mismatch.broker_order_id and b.broker_order_id == mismatch.broker_order_id):
                        return find_root(idx)
            if mismatch.fill_id or mismatch.request_id:
                for jdx, l in enumerate(local_snapshots):
                    if (mismatch.fill_id and l.fill_id == mismatch.fill_id) or \
                       (mismatch.request_id and l.request_id == mismatch.request_id):
                        return find_root(N_snaps + jdx)
            return None

        suppress_types = {"QUANTITY_MISMATCH", "BROKER_TRADE_MISSING_LOCAL_FILL", "LOCAL_FILL_MISSING_BROKER_TRADE"}
        final_mismatches = []

        # Categorize mismatches by group
        group_mismatches = {}
        non_group_mismatches = []
        for m in mismatches:
            root = get_mismatch_root(m)
            if root is not None:
                if root not in group_mismatches:
                    group_mismatches[root] = []
                group_mismatches[root].append(m)
            else:
                non_group_mismatches.append(m)

        for root, group_data in groups.items():
            group_broker = group_data["broker"]
            group_local = group_data["local"]
            m_list = group_mismatches.get(root, [])

            if not group_broker or not group_local:
                # One-sided group: no matching trades/fills to aggregate. Keep original mismatches.
                final_mismatches.extend(m_list)
                continue

            total_broker_qty = sum(b.quantity for b in group_broker)
            total_local_qty = sum(l.quantity for l in group_local)

            if total_broker_qty == total_local_qty:
                # Suppress quantity/missing fill mismatches
                for m in m_list:
                    if m.mismatch_type not in suppress_types:
                        final_mismatches.append(m)
            else:
                # Suppress individual quantity/missing fill mismatches
                for m in m_list:
                    if m.mismatch_type not in suppress_types:
                        final_mismatches.append(m)
                
                # Add a single aggregated order-level quantity mismatch
                rep_symbol = group_broker[0].symbol if group_broker else (group_local[0].symbol if group_local else "")
                rep_side = group_broker[0].side if group_broker else (group_local[0].side if group_local else "")
                
                rep_broker_order_id = next((b.broker_order_id for b in group_broker if b.broker_order_id), None)
                if not rep_broker_order_id:
                    rep_broker_order_id = next((l.broker_order_id for l in group_local if l.broker_order_id), None)
                    
                rep_request_id = next((l.request_id for l in group_local if l.request_id), None)
                if not rep_request_id:
                    rep_request_id = next((b.client_order_id for b in group_broker if b.client_order_id), None)

                rep_broker_trade_id = next((b.broker_trade_id for b in group_broker if b.broker_trade_id), None)
                rep_fill_id = next((l.fill_id for l in group_local if l.fill_id), None)
                
                final_mismatches.append(TradeReconciliationMismatch(
                    severity="MEDIUM",
                    mismatch_type="QUANTITY_MISMATCH",
                    symbol=rep_symbol,
                    side=rep_side,
                    broker_trade_id=rep_broker_trade_id,
                    fill_id=rep_fill_id,
                    broker_order_id=rep_broker_order_id,
                    request_id=rep_request_id,
                    broker_qty=total_broker_qty,
                    local_qty=total_local_qty,
                    detail=f"Order-level quantity mismatch: broker total={total_broker_qty}, local total={total_local_qty}."
                ))

        # Append mismatches that don't belong to any group
        final_mismatches.extend(non_group_mismatches)

        # Build final matches_list
        matches_list = []
        for b_snap, l_match, method in matched_pairs:
            matches_list.append(TradeReconciliationMatch(
                broker_trade_id=b_snap.broker_trade_id,
                fill_id=l_match.fill_id,
                broker_order_id=b_snap.broker_order_id,
                request_id=l_match.request_id,
                symbol=b_snap.symbol,
                side=b_snap.side,
                quantity=b_snap.quantity,
                price=b_snap.price,
                match_method=method
            ))

        return TradeReconciliationReport(
            checked_at=datetime.now(timezone.utc).isoformat(),
            broker_trade_count=len(broker_snapshots),
            local_fill_count=len(local_snapshots),
            matched_count=len(matches_list),
            mismatch_count=len([m for m in final_mismatches if m.severity != "INFO" and m.severity != "LOW"]),
            mismatches=final_mismatches,
            matches=matches_list
        )

    def reconcile_from_broker(
        self,
        broker_sync_service,
        order_store=None,
        time_tolerance_seconds: int = 60,
        price_tolerance: float = 0.05
    ) -> TradeReconciliationReport:
        """Retrieves trades from broker and fills from order_store, then reconciles them."""
        if order_store is None:
            order_store = self.order_store

        if order_store is None:
            raise ValueError("Order store must be provided")

        if broker_sync_service is None or not getattr(broker_sync_service, "_sm", None):
            raise ValueError("BROKER_SESSION_UNAVAILABLE")

        smart = broker_sync_service._get_smart_api()
        if smart is None:
            raise ValueError("BROKER_SESSION_UNAVAILABLE")

        try:
            resp = smart.tradeBook()
            if not resp or not resp.get("status") or "data" not in resp:
                raise RuntimeError("Failed to fetch trade book from broker API")
            broker_trades = resp.get("data") or []
        except Exception as exc:
            logger.error(f"Failed to fetch trade book from broker: {exc}")
            raise RuntimeError(f"Broker API error: {exc}")

        # Fetch internal fills
        internal_fills = order_store.get_all_fills_chronological()

        return self.reconcile_trades(broker_trades, internal_fills, time_tolerance_seconds, price_tolerance)
