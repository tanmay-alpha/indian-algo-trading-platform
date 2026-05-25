"""backend/portfolio/rebuild.py

Portfolio rebuild service — Phase 18H/18I.

On startup, replays persisted fill events from the OMS (OrderStore SQLite) into
the in-memory PortfolioEngine / PositionTracker.

Phase 18I upgrade:
- Primary source is now ``order_fills`` ledger (get_all_fills_chronological).
  Each row = one discrete fill event, supporting partial fills correctly.
- Fallback for older DBs: if order_fills is empty, falls back to the Phase 18H
  path (get_filled_orders — one row per FILLED order, qty=total).

SAFETY CONTRACT:
- Read-only from OrderStore; never writes to OMS.
- Never calls a broker API.
- Never invents or fakes a fill price; skips rows without fill_price.
- Never touches .env or credentials.
- PAPER mode only; does not enable live trading.
- Idempotent: fills already applied to portfolio are skipped (tracked by fill_id
  via PositionTracker._fill_history event_ids, or by request_id for legacy path).
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
    source: str = "unknown"  # "fill_ledger" or "filled_orders_fallback"


# ---------------------------------------------------------------------------
# Core rebuild function
# ---------------------------------------------------------------------------

def rebuild_portfolio_from_fills(
    order_store: "OrderStore",
    portfolio_engine: "PortfolioEngine",
    *,
    _replayed_ids: set[str] | None = None,
) -> PortfolioRebuildSummary:
    """Replay persisted fill events from *order_store* into *portfolio_engine*.

    Phase 18I: tries order_fills ledger first (supports partial fills).
    Falls back to order_requests FILLED rows if the ledger is empty.

    Parameters
    ----------
    order_store:
        The persistent OMS store. Calls ``get_all_fills_chronological()`` and,
        on fallback, ``get_filled_orders()``.
    portfolio_engine:
        The in-memory portfolio engine whose ``PositionTracker`` will be updated.
    _replayed_ids:
        Optional external set of already-replayed fill_ids for idempotency
        (used by tests). When ``None``, the existing PositionTracker history
        is consulted automatically.

    Returns
    -------
    PortfolioRebuildSummary
        Counts and any warnings about skipped rows.
    """
    from backend.core.events import OrderStateEvent
    from backend.core.types import OrderStatus

    summary = PortfolioRebuildSummary()

    # ------------------------------------------------------------------
    # Try fill ledger first (Phase 18I primary path)
    # ------------------------------------------------------------------
    fill_rows = _load_fill_ledger(order_store, summary)
    if fill_rows is not None:
        # fill_rows may be an empty list (new DB with no fills yet) or
        # a non-empty list of fill-ledger rows.
        if fill_rows:
            summary.source = "fill_ledger"
            _replay_fill_rows(
                fill_rows=fill_rows,
                portfolio_engine=portfolio_engine,
                order_store=order_store,
                summary=summary,
                _replayed_ids=_replayed_ids,
                id_field="fill_id",
            )
        else:
            # Fill ledger exists but is empty — fall back to order_requests
            _run_fallback_rebuild(
                order_store, portfolio_engine, summary, _replayed_ids
            )
    else:
        # get_all_fills_chronological raised (method not present on older store)
        _run_fallback_rebuild(
            order_store, portfolio_engine, summary, _replayed_ids
        )

    return summary


# ---------------------------------------------------------------------------
# Fill-ledger replay path (Phase 18I)
# ---------------------------------------------------------------------------

def _load_fill_ledger(
    order_store: "OrderStore",
    summary: PortfolioRebuildSummary,
) -> list | None:
    """Call get_all_fills_chronological. Return None on AttributeError/Exception."""
    try:
        return order_store.get_all_fills_chronological()
    except AttributeError:
        return None  # method not yet available — use fallback
    except Exception as exc:
        msg = f"Portfolio rebuild: fill ledger read failed: {exc.__class__.__name__}"
        logger.warning(msg)
        summary.warnings.append(msg)
        return None


def _replay_fill_rows(
    fill_rows: list,
    portfolio_engine: "PortfolioEngine",
    order_store: "OrderStore",
    summary: PortfolioRebuildSummary,
    _replayed_ids: set[str] | None,
    id_field: str = "fill_id",
) -> None:
    """Replay a list of fill rows (order_fills schema) into portfolio_engine."""
    from backend.core.events import OrderStateEvent
    from backend.core.types import OrderStatus

    # Build set of already-seen IDs from PositionTracker or external param.
    if _replayed_ids is None:
        seen_ids: set[str] = {
            entry.get("event_id", "")
            for entry in portfolio_engine.positions._fill_history
        }
    else:
        seen_ids = _replayed_ids

    for row in fill_rows:
        fill_id = row.get(id_field) or row.get("fill_id") or ""
        request_id = row.get("request_id") or ""
        symbol = (row.get("symbol") or "").upper()
        side = (row.get("side") or "").upper()
        broker_order_id = row.get("broker_order_id")

        # --- Idempotency ---
        if fill_id and fill_id in seen_ids:
            continue

        # --- Quantity ---
        try:
            qty = int(row.get("filled_quantity") or row.get("quantity") or 0)
        except (TypeError, ValueError):
            qty = 0
        if qty <= 0:
            msg = (
                f"Portfolio rebuild: skipping fill {fill_id!r} — "
                f"invalid filled_quantity."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        # --- Fill price ---
        raw_price = row.get("fill_price") or row.get("avg_fill_price")
        if raw_price is None:
            msg = (
                f"Portfolio rebuild: skipping fill {fill_id!r} ({symbol} {side} x{qty}) "
                "— no fill_price available."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue
        try:
            fill_price = float(raw_price)
        except (TypeError, ValueError):
            msg = (
                f"Portfolio rebuild: skipping fill {fill_id!r} — "
                f"invalid fill_price value: {raw_price!r}"
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue
        if fill_price <= 0:
            msg = (
                f"Portfolio rebuild: skipping fill {fill_id!r} — "
                f"fill_price non-positive ({fill_price})."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        # --- Side validation ---
        if side not in ("BUY", "SELL"):
            msg = (
                f"Portfolio rebuild: skipping fill {fill_id!r} — unknown side {side!r}."
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        # --- Synthesise an OrderStateEvent (FILLED) for PositionTracker ---
        # Use fill_id as the event_id so PositionTracker._fill_history can
        # deduplicate on repeated calls.
        event = OrderStateEvent(
            order_id=request_id or fill_id,
            broker_order_id=broker_order_id,
            symbol=symbol,
            side=side,
            quantity=qty,
            filled_quantity=qty,
            avg_fill_price=fill_price,
            status=OrderStatus.FILLED.value,
            reject_reason=None,
            order_request_id=request_id,
        )
        # Override event_id with fill_id so _fill_history stores a stable key.
        event.event_id = fill_id or event.event_id

        try:
            fees_dict = portfolio_engine.fee_model.calculate(side, qty, fill_price)
            portfolio_engine.positions.on_fill(event, fees_dict)
        except Exception as exc:
            msg = (
                f"Portfolio rebuild: error replaying fill {fill_id!r}: "
                f"{exc.__class__.__name__}: {exc}"
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        if fill_id:
            seen_ids.add(fill_id)

        summary.total_fills_processed += 1
        if symbol not in summary.rebuilt_positions:
            summary.rebuilt_positions.append(symbol)


# ---------------------------------------------------------------------------
# Fallback rebuild path (Phase 18H — order_requests FILLED rows)
# ---------------------------------------------------------------------------

def _run_fallback_rebuild(
    order_store: "OrderStore",
    portfolio_engine: "PortfolioEngine",
    summary: PortfolioRebuildSummary,
    _replayed_ids: set[str] | None,
) -> None:
    """Replay FILLED rows from order_requests (one row = full order quantity)."""
    from backend.core.events import OrderStateEvent
    from backend.core.types import OrderStatus

    summary.source = "filled_orders_fallback"

    if _replayed_ids is None:
        seen_ids: set[str] = {
            entry["order_id"]
            for entry in portfolio_engine.positions._fill_history
            if entry.get("order_id")
        }
    else:
        seen_ids = _replayed_ids

    try:
        filled_rows = order_store.get_filled_orders()
    except Exception as exc:
        msg = f"Portfolio rebuild: failed to read filled orders: {exc.__class__.__name__}"
        logger.warning(msg)
        summary.warnings.append(msg)
        return

    for row in filled_rows:
        request_id = row.get("request_id") or ""
        symbol = (row.get("symbol") or "").upper()
        side = (row.get("side") or "").upper()
        quantity = int(row.get("quantity") or 0)
        broker_order_id = row.get("broker_order_id")

        if request_id and request_id in seen_ids:
            continue

        raw_price = row.get("avg_fill_price") or row.get("fill_price")
        if raw_price is None:
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
            summary.skipped_rows += 1
            continue
        if fill_price <= 0 or side not in ("BUY", "SELL") or quantity <= 0:
            summary.skipped_rows += 1
            continue

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
        try:
            fees_dict = portfolio_engine.fee_model.calculate(side, quantity, fill_price)
            portfolio_engine.positions.on_fill(event, fees_dict)
        except Exception as exc:
            msg = (
                f"Portfolio rebuild: error replaying {request_id}: "
                f"{exc.__class__.__name__}: {exc}"
            )
            logger.warning(msg)
            summary.warnings.append(msg)
            summary.skipped_rows += 1
            continue

        if request_id:
            seen_ids.add(request_id)
        summary.total_fills_processed += 1
        if symbol not in summary.rebuilt_positions:
            summary.rebuilt_positions.append(symbol)


# ---------------------------------------------------------------------------
# Private helper
# ---------------------------------------------------------------------------

def _try_get_fill_price_from_events(
    order_store: "OrderStore", request_id: str
) -> float | None:
    """Best-effort: look for fill price in order_events for *request_id*.

    Returns None if nothing useful found (order_events has no price column yet).
    """
    if not request_id:
        return None
    try:
        events = order_store.get_order_events(request_id)
    except Exception:
        return None

    # order_events does not carry a price column yet — always returns None.
    # Retained as extension point for future enrichment.
    for ev in events:
        status = (ev.get("status") or "").upper()
        if status in ("FILLED", "PAPER_FILLED"):
            pass
    return None
