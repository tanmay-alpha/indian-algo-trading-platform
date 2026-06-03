# MAET Terminal Demo Script

Use this for a three-to-five minute internship or portfolio walkthrough. Keep the language practical: this is a paper-mode research terminal, not a real-money trading product.

## One-Sentence Product Pitch

MAET Terminal is a safety-first Indian market analytics and paper trading workspace for watchlists, chart diagnostics, dry-run validation, read-only broker context, OMS/reconciliation visibility, and AI advisory notes.

## Demo Guardrails

Before recording or presenting:

- Do not show `.env`, Render secrets, broker pages, credentials, tokens, or private account data.
- Do not place real orders.
- Do not claim financial advice or guaranteed profitability.
- Do not fake prices, candles, holdings, PnL, fills, backtest results, or AI predictions.
- If market data is unavailable, explain the honest unavailable/no-data state.

## Three-To-Five Minute Walkthrough

1. Open the live landing page: `https://indian-algo-trading-platform.vercel.app/`.
2. Explain the product in one sentence.
3. Point out that the public page is trading-focused: watchlist, chart workspace, dry-run validation, read-only portfolio context, OMS/reconciliation, and AI advisory notes.
4. Click **Open Terminal**.
5. Show the terminal safety strip:
   - LIVE LOCKED
   - PAPER MODE
   - READ ONLY
   - AI ADVISORY ONLY
   - BROKER MUTATION DISABLED
6. Open **Watchlist** and explain NSE/BSE symbol search and quote availability.
7. Select or search a symbol, then open **Chart**.
8. Explain chart honesty:
   - if candles are available, the chart and indicators render from real backend data;
   - if candles are unavailable, the UI shows a no-data state instead of invented candles.
9. Show the timeframe controls and the collapsed data details.
10. Point out TradingView and Angel One handoff links for external chart review.
11. Show **Dry-run validation** and explain:
   - it validates order parameters only;
   - live execution remains locked;
   - broker actions are disabled.
12. Open **Portfolio** and show the protected/read-only state. Explain that admin-protected broker context is not persisted in browser storage.
13. Open **AI Advisory** and show prompt chips. Explain that AI can summarize indicators or risk context but cannot approve, place, or route trades.
14. Open **System** and show backend health, readiness, market stream, runtime config, and safety boundary.
15. Mention validation:
   - frontend type-check, lint, and build;
   - backend import;
   - live-lock check prints `False`;
   - lockdown tests pass.

## What To Say If Market Is Closed

Market data may be stale or unavailable when the market is closed. That is expected. The terminal should still show safe status, read-only/protected portfolio states, and honest chart diagnostics. Do not invent live ticks for the demo.

## What To Say If Render Is Waking

Render Free can cold start after inactivity. The first request may take 30-60 seconds. The frontend is expected to show safe waking/offline/unavailable states while the backend starts.

Also mention that Render Free storage can be ephemeral. Durable production trading infrastructure would need a managed database, stronger auth, monitoring, and operational runbooks.

## Interview Q&A

### Why this project?

It demonstrates full-stack engineering around a serious domain: broker connectivity, WebSocket status, paper OMS correctness, frontend product design, testing, deployment, and safety boundaries.

### Why paper mode?

Paper mode allows the system to demonstrate order-state and portfolio concepts without risking real capital. Live execution is intentionally locked for the public demo.

### What is strongest technically?

The safety boundary: live build policy, broker mutation guard, pre-trade risk checks, persistent paper OMS/fill ledger, strategy status semantics, and explicit tests around lockdown and paper correctness.

### What is not production-ready?

It is not a production trading system. Live execution is disabled, public demo persistence is limited by hosting constraints, admin-token auth is intentionally simple, and market data depends on broker/backend availability.

### How does AI fit?

AI is restricted to explanation and research context. It cannot approve orders, place orders, or provide financial advice.

## Safe Demo Checklist

- [ ] Landing page loads.
- [ ] Terminal loads.
- [ ] Safety strip visible.
- [ ] No TODO or broken social links visible.
- [ ] GitHub appears only in the footer.
- [ ] LinkedIn appears only if a real URL is configured.
- [ ] No console errors in checked viewports.
- [ ] No horizontal overflow in checked viewports.
- [ ] Live lock check prints `False`.
- [ ] No real broker mutation calls are made.
