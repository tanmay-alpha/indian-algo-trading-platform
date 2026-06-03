# Demo Readiness Status

Last updated: 2026-06-04

## Current Position

MAET Terminal is demo-ready as a paper-mode research workspace, subject to normal public-demo constraints around broker/backend availability and Render Free cold starts.

Latest checked base commit before this final packaging pass:

```text
077dc07e68b0ac6d5888a9c9ad8aa951a8215527 frontend refine trading UX details and responsive polish
```

The final pushed commit for this pass is recorded in the Codex final report.

Live frontend:

```text
https://indian-algo-trading-platform.vercel.app/
https://indian-algo-trading-platform.vercel.app/terminal
```

Backend health:

```text
https://maet-backend.onrender.com/health
```

## What Works

- Public landing page presents MAET Terminal as a trading research product.
- GitHub is kept in the footer; LinkedIn is hidden unless a real URL is configured.
- Terminal safety strip states live lock, paper mode, read-only context, AI advisory only, and broker mutation disabled.
- Watchlist/search can select NSE/BSE instruments when backend data is available.
- Chart workspace has honest candle/no-data states and external chart handoff links.
- Dry-run validation language is paper-only and does not imply live order placement.
- Portfolio screen is protected/read-only and does not show invented holdings or PnL.
- AI Advisory can frame research questions but cannot place or approve trades.
- System screen reports health/readiness/connection/safety status.
- Paper fills and strategy status semantics are documented and covered by focused tests.

## Safety Guarantees

- Live execution remains locked by build policy.
- Broker mutation is disabled in the public/demo workflow.
- Manual order UI is dry-run validation only.
- Broker account context is read-only/protected.
- AI advisory is non-executing.
- Admin tokens are not stored in browser storage.
- No fake market prices, candles, holdings, PnL, fills, order history, or predictions should be shown as real.

## Validation Commands

Frontend:

```bash
cd frontend
npm run type-check
npm run lint
npm run build
```

Backend:

```bash
python -B -c "import backend.api_server; print('api import ok')"
python -B -c "from backend.core.live_build_policy import is_live_execution_build_enabled; print(is_live_execution_build_enabled())"
pytest tests/test_lockdown.py -q
pytest -q -ra
```

Expected safety output:

```text
False
```

## Known Limitations

- Live execution is intentionally disabled.
- Broker read-only/protected flows require a configured admin token.
- Real market data depends on backend availability, broker session state, and market hours.
- Render Free can cold start and may reset local SQLite demo storage.
- SQLite demo persistence is not high-availability production storage.
- AI advisory is non-executing and not financial advice.
- Admin-token auth is demo-grade and not enterprise RBAC/OAuth.

## What Not To Claim

- Do not claim this is a complete production trading platform.
- Do not claim it can place real orders in the current build.
- Do not claim AI can generate or approve trades.
- Do not claim guaranteed returns, predictive accuracy, or financial advice.
- Do not claim public demo persistence is durable like a managed database.

## Demo Recommendation

Show the product loop in this order:

1. Landing page.
2. Terminal safety strip.
3. Watchlist/search.
4. Chart and no-data/candle honesty.
5. TradingView/Angel One handoff.
6. Dry-run validation.
7. Read-only/protected portfolio.
8. AI advisory-only prompts.
9. System readiness.
10. Validation and live-lock check.
