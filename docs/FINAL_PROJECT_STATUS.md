# MAET Terminal v2.0 Final Project Status

## What Works

- FastAPI backend imports and tests pass.
- Next.js frontend production build passes.
- Render backend and Vercel frontend are configured for a public demo.
- Public health/status routes expose sanitized system state.
- WebSocket frontend logic connects to `/ws/market_stream` and treats gateway status as healthy.
- Instrument master loading, market watch, and subscribed-symbol handling are implemented.
- CandleStore-backed indicator routes are available.
- C++17 indicator core exists with optional pybind11 bridge and Python fallback.
- Strategy templates and offline backtesting routes are implemented.
- Portfolio summary and session-scoped portfolio state are available.
- Trading Safety Engine v1 with PreTradeRiskGate, SignalValidator, and persistent OMS.
- Startup OMS order recovery and broker reconciliation flow.
- Admin-protected OMS Dashboard (Order Blotter, Fill Ledger, Audit Trail).
- Observability/status routes and final security hardening are documented.

## What Is Demo-Only

- Render Free hosting.
- In-memory CandleStore and session-scoped state.
- Strategy backtesting and signal preview.
- Market discovery/screener UI.
- Portfolio display when not backed by persistent broker reconciliation.
- Observability dashboards without a durable external metrics stack.
- Local SQLite usage for OMS/Fill Ledger demonstration.

## What Is Intentionally Disabled

- Real live order placement.
- Automatic live strategy execution.
- Live deployment of strategy signals.
- Exposing credentials or session tokens to the frontend.
- Any claim of financial advice or guaranteed performance.

## What Is Not Production-Ready

- Render Free can sleep and has ephemeral disk. The local SQLite database (`data/trades.db`) resides on ephemeral storage, meaning order blotters, fill histories, and portfolio state will periodically reset when the instance restarts or recycles. A production system would require a managed persistent database like PostgreSQL/Supabase/Neon.
- WebSocket stability depends on deployment/network environment.
- Auth is simple admin-token protection, not user management.
- Persistence is not production-grade.
- Broker session lifecycle needs stronger operational controls for production.
- C++ extension availability may vary by host.
- No formal monitoring/alerting stack is deployed.

## What To Learn Next

- Stronger backend fundamentals without adding scope.
- Production deployment patterns: VPS, systemd, Nginx, TLS/WSS.
- Persistent database design with PostgreSQL.
- Frontend charting and data visualization.
- Testing strategies for realtime systems.
- Security fundamentals: auth, secrets, logging, rate limits.
- C++ performance profiling and Python/C++ boundary design.

## Suggested Future Phases After Taking A Break

These are optional future directions, not required for v2.0:

- C++ backtesting core
- Stronger Strategy Lab UI
- PostgreSQL persistence
- VPS deployment
- Deeper market discovery
- Better charting library
- Fundamentals/investor dashboard

The v2.0 showcase is complete enough to stop feature work and use the project for GitHub, resume, demo, and interview practice.
