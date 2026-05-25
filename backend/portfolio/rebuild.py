"""backend/portfolio/rebuild.py

Portfolio rebuild service — Phase 18H.

Replays persisted FILLED orders from the OMS (OrderStore SQLite) into the
in-memory PortfolioEngine / PositionTracker on backend startup.

SAFETY CONTRACT:
- Read-only from OrderStore; never writes to OMS.
- Never calls a broker API.
- Never invents or fakes a fill price; skips rows without avg_fill_price.
- Never touches .env or credentials.
- PAPER mode only; does not enable live trading.
- Idempotent: tracking a set of replayed request_ids prevents double-counting
  on repeated calls within the same process lifetime.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from loguru import logger

if TYPE_CHECKING:
    from backend.execution.order_store import OrderStore
    from backend.portfolio.portfolio_engine import PortfolioEngine


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class PortfolioRebuildSummary:
    """Result returned by rebuild_portfolio_from_fills."""
    total_fills_processed: int = 0
    skipped_rows: int = 0
    rebuilt_positions: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Core rebuild function
# ---------------------------------------------------------------------------

def rebuild_portfolio_from_fills(
    order_store: "OrderStore",
    portfolio_engine: "PortfolioEngine",
    *,
    _replayed_ids: set[str] | None = None,
) -> PortfolioRebuildSummary:
    """Replay persisted FILLED orders from *order_store* into *portfolio_engine*.

    Parameters
    ----------
    order_store:
        The persistent OMS store. Only ``get_filled_orders()`` is called.
    portfolio_engine:
        The in-memory portfolio engine whose ``PositionTracker`` will be updated.
    _replayed_ids:
        Optional external set for idempotency tracking across calls (mainly for
        testing).  When ``None`` a fresh set is used so that a second call on
        the same ``portfolio_engine`` instance will skip already-replayed fills
        (tracked via ``portfolio_engine.positions._fill_history`` event_ids).

    Returns
    -------
    PortfolioRebuildSummary
        Counts and any warnings about skipped rows.
    """
    # Lazy import to avoid circular imports at module load time.
    from backend.core.events import OrderStateEvent
    from backend.core.types import OrderStatus

    summary = PortfolioRebuildSummary()

    # ------------------------------------------------------------------
    # Build idempotency guard from already-replayed request_ids.
    # We use the order_id field that PositionTracker stores in _fill_history.
    # On the very first call the history is empty so nothing is pre-excluded.
    # ------------------------------------------------------------------
    if _replayed_ids is None:
        seen_request_ids: set[str] = {
            entry["order_id"]
            for entry in portfolio_engine.positions._fill_history
            if entry.get("order_id")
        }
    else:
        seen_request_ids = _replayed_ids

    # ------------------------------------------------------------------
    # Fetch fills from SQLite — read-only, no broker calls.
    # ------------------------------------------------------------------
    try:
        filled_rows = order_store.get_filled_orders()
    except Exception as exc:
        msg = f"Portfolio rebuild: failed to read filled orders: {exc.__class__.__name__}"
        logger.warning(msg)
        summary.warnings.append(msg)
        return summary

    # ------------------------------------------------------------------
    # Replay each fill in chronological order (get_filled_orders returns
    # oldest-first via ORDER BY id ASC).
    # ------------------------------------------------------------------
    for row in filled_rows:
        request_id = row.get("request_id") or ""
        symbol = (row.get("symbol") or "").upper()
        side = (row.get("side") or "").upper()
        quantity = int(row.get("quantity") or 0)
        broker_order_id = row.get("broker_order_id")

        # --- Idempotency: skip already-replayed fills ---
        if request_id and request_id in seen_request_ids:
            # Already in position tracker from a previous replay in this process.
            continue

        # --- Skip rows without a usable fill price ---
        # We do NOT invent a price; we skip and warn.
        raw_price = row.get("avg_fill_price") or row.get("fill_price")
        if raw_price is None:
            # avg_fill_price column not present yet — try order_events for a fill event
            raw_price = _try_get_fill_price_from_events(order_store, request_id)

        if not raw_price:
            msg = (
                f"Portfolio rebuild: skipping {request_id} ({symbol} {side} x{quantity}) "
                "— no avg_fill_price available."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        try:
            fill_price = float(raw_price)
        except (TypeError, ValueError):
            msg = (
                f"Portfolio rebuild: skipping {request_id} — "
                f"invalid avg_fill_price value: {raw_price!r}"
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        if fill_price <= 0:
            msg = (
                f"Portfolio rebuild: skipping {request_id} — "
                f"avg_fill_price is non-positive ({fill_price})."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        # --- Validate side and quantity ---
        if side not in ("BUY", "SELL"):
            msg = (
                f"Portfolio rebuild: skipping {request_id} — "
                f"unknown side {side!r}."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        if quantity <= 0:
            msg = (
                f"Portfolio rebuild: skipping {request_id} — "
                f"quantity is non-positive ({quantity})."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        # --- Synthesise an OrderStateEvent and feed it to PortfolioEngine ---
        event = OrderStateEvent(
            order_id=request_id,
            broker_order_id=broker_order_id,
            symbol=symbol,
            side=side,
            quantity=quantity,
            filled_quantity=quantity,
            avg_fill_price=fill_price,
            status=OrderStatus.FILLED.value,
            reject_reason=None,
            order_request_id=request_id,
        )

        # Call the synchronous part of on_fill directly to avoid the async
        # event publish overhead during startup rebuild.
        try:
            fees = portfolio_engine.fee_model.calculate(side, quantity, fill_price)
            portfolio_engine.positions.on_fill(event, fees)
        except Exception as exc:
            msg = (
                f"Portfolio rebuild: error replaying {request_id}: "
                f"{exc.__class__.__name__}: {exc}"
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        # Mark as seen so duplicate rows are skipped.
        if request_id:
            seen_request_ids.add(request_id)

        summary.total_fills_processed += 1
        if symbol not in summary.rebuilt_positions:
            summary.rebuilt_positions.append(symbol)

    return summary


# ---------------------------------------------------------------------------
# Private helper
# ---------------------------------------------------------------------------

def _try_get_fill_price_from_events(
    order_store: "OrderStore", request_id: str
) -> float | None:
    """Best-effort: look for a fill price in order_events for *request_id*.

    Returns the first non-None price found in FILLED/PAPER_FILLED events, or
    None if nothing useful is available.
    """
    if not request_id:
        return None
    try:
        events = order_store.get_order_events(request_id)
    except Exception:
        return None

    for ev in events:
        status = (ev.get("status") or "").upper()
        if status in ("FILLED", "PAPER_FILLED"):
            # order_events does not yet have a price column — return None
            # so caller properly skips with warning.
            pass
    return None
