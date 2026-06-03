# Backend Correctness Notes

This note summarizes the backend correctness checks that matter for the MAET Terminal demo and paper-trading integrity pass.

## Paper Execution Path

The intended paper flow is:

```text
Strategy signal
-> SignalValidator
-> PreTradeRiskGate
-> ExecutionRouter
-> PaperOrderManager
-> OrderStore
-> order_fills
-> OMS visibility
-> Portfolio rebuild
-> Export/reconciliation context
```

Normal runtime should construct one `OrderStore` and pass it through the execution path. Paper fills should not be skipped because `PaperOrderManager` lacks access to the store.

## Paper Fill Ledger Behavior

Expected behavior:

- Successful routed paper orders persist to `order_fills`.
- Single-fill paper orders use deterministic fill ID `{request_id}:0`.
- Duplicate processing is idempotent through unique `fill_id`.
- Paper fills use `source = "paper"`.
- Paper fills do not create or fake broker order IDs.
- OMS can read fills through `OrderStore` audit/fill APIs.
- Portfolio rebuild reads the fill ledger first and skips rows with missing or invalid fill price.

Focused tests:

- `tests/test_paper_fill_correctness.py`
- `tests/test_partial_fill_ledger.py`
- `tests/test_portfolio_rebuild.py`
- `tests/test_oms_admin_api.py`

## Strategy Status Semantics

Strategy signals must not be labeled as executed merely because a signal was emitted or published.

Expected status semantics:

- Generated/review state before approval.
- Submitted/approved paper state when paper routing is requested.
- Pending state for accepted but unfilled paper orders.
- Executed/filled state only after confirmed paper fill.
- Rejected/failed state for invalid, risk-rejected, market-closed, or execution-failed paths.

Focused tests:

- `tests/test_strategy_runtime.py`
- `tests/test_strategy_scheduler.py`
- `tests/test_strategy_export.py`

## Read-Only Reconciliation Boundary

Broker reconciliation and account context remain read-only. Paper fills are local paper records and should not be represented as broker-confirmed trades unless explicitly modeled as such.

## Live Safety Boundary

The backend correctness phase must not alter these protections:

- `backend/core/live_build_policy.py` remains locked.
- `BrokerMutationGuard` remains protective.
- `KillSwitch` remains protective.
- `PreTradeRiskGate` remains protective.
- `ManualOrderLivePolicy` remains protective.
- SmartAPI mutation methods are not called in paper/demo tests.

Minimum safety validation:

```bash
python -B -c "from backend.core.live_build_policy import is_live_execution_build_enabled; print(is_live_execution_build_enabled())"
pytest tests/test_lockdown.py -q
```
