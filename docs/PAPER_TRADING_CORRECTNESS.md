# Paper Trading Correctness

MAET Terminal remains a paper-mode and read-only broker system. Live execution is locked by build policy.

## Paper Fill Ledger

- Normal runtime constructs one `OrderStore` and injects it into `ExecutionRouter` and `PaperOrderManager`.
- Successful routed paper fills are written to the existing `order_fills` table.
- Paper fill ids are deterministic: `{request_id}:0` for single-fill paper orders.
- `order_fills.fill_id` is unique, so repeated processing of the same request cannot duplicate a fill row.
- Paper fills use `source = "paper"` and do not generate a real broker order id.
- OMS reads paper fills through `OrderStore.get_recent_fills()` and `OrderStore.get_order_audit()`.
- Portfolio rebuild reads `order_fills` first and replays only persisted fill rows. It does not invent fills or prices.

## Strategy Signal Status

Strategy signal status now reflects execution outcome rather than event publication:

- `GENERATED`: signal created and waiting for review.
- `APPROVED_PAPER`: signal approved or auto-paper submitted for paper routing.
- `PAPER_PENDING`: paper order accepted but not filled, for example a resting limit order.
- `PAPER_EXECUTED`: paper fill confirmed.
- `REJECTED`: validation, risk, market, or execution rejection.
- `PAPER_FAILED`: unexpected paper execution failure or cancellation path.
- `DISMISSED` / `ERROR`: terminal manual or system states.

`auto_paper_enabled = false` does not silently execute a generated signal. It leaves the signal in the review queue until explicit paper approval.

## Safety Boundary

Paper execution is not broker execution. These paths do not call Angel One `placeOrder`, `cancelOrder`, or `modifyOrder`, and they do not enable live trading.
