# Safety Model

MAET Terminal is designed for paper-mode research and public demo use. The safety model intentionally separates market research, paper validation, read-only broker context, and live broker mutation.

## Non-Negotiable Boundaries

- Live execution is locked in the build.
- Broker mutation is disabled unless a separate audited live-readiness phase is implemented.
- AI is advisory only.
- Broker account context is read-only/protected.
- Dry-run validation is not order placement.
- No UI or backend path should present fake market or portfolio data as real.

## Live Execution Lock

The backend build policy must return `False`:

```bash
python -B -c "from backend.core.live_build_policy import is_live_execution_build_enabled; print(is_live_execution_build_enabled())"
```

Expected:

```text
False
```

This lock is verified by `tests/test_lockdown.py`.

## Broker Mutation Guardrails

The public/demo workflow must not call broker mutation methods:

- `placeOrder`
- `cancelOrder`
- `modifyOrder`

Broker account routes are for read-only holdings, positions, funds, tradebook/orderbook context, reconciliation, and status. Protected routes require an admin token where configured.

## Paper OMS And Fill Ledger

Paper execution is modeled separately from broker execution:

- Paper fills use the existing `order_fills` ledger.
- Paper fill IDs are deterministic and idempotent.
- Paper fills use `source = "paper"`.
- Paper fills do not generate real broker order IDs.
- Portfolio rebuild reads persisted fill ledger rows and does not invent prices.

## Strategy Status Honesty

Strategy event publication is not execution. Status should stay generated, queued, submitted, rejected, pending, failed, or executed based on actual outcome.

Important rule:

```text
PAPER_EXECUTED means a paper fill was confirmed, not merely that a signal was published.
```

## Frontend Safety Language

Use human product language:

- Live execution locked
- Paper mode
- Dry-run validation only
- Broker actions disabled
- Read-only broker context
- Protected portfolio view
- AI advisory only

Avoid raw user-facing booleans outside diagnostics, such as `live_execution_enabled=false` or `broker_mutation_allowed=false`.

## Secret Handling

- Do not commit `.env` or `.env.*`.
- Do not expose `DATABASE_URL`, `ADMIN_TOKEN`, broker credentials, JWTs, TOTP secrets, feed tokens, refresh tokens, or session data.
- Do not place private values in `NEXT_PUBLIC_` variables.
- Do not store admin tokens in `localStorage` or `sessionStorage`.

## Public Demo Disclaimer

MAET Terminal is not financial advice and is not a production trading system. It is a paper-mode research/demo platform built to show product engineering, backend safety, and trading-system correctness without enabling real-money execution.
