# MAET Terminal Code Cleanup Audit

Date: 2026-05-05

Scope: conservative cleanup and complexity audit for the current FastAPI, Next.js, C++ indicator, portfolio, strategy, and market discovery codebase. No live trading, broker/session behavior, or execution safety behavior was changed.

## Summary

The codebase is functional and test-covered, but several areas are now large because multiple phases were implemented quickly. The safest immediate cleanup is centralizing small helpers and documenting larger extraction work. One safe backend refactor was completed in this phase: strict JSON-safe numeric cleanup for NaN/Infinity responses now lives in `backend/core/json_utils.py` and is reused by indicator and strategy routers.

## Duplicate Code

### Backend

- `backend/routers/indicators.py` and `backend/routers/strategies.py` both had identical recursive `_json_safe()` helpers for converting non-finite floats to `None`.
  - Action taken: replaced both local helpers with `backend.core.json_utils.json_safe()`.
  - Behavior preserved: response shape stays the same; only NaN/Infinity conversion remains centralized.

- Candle normalization exists in multiple backend contexts:
  - `backend/routers/indicators.py::_candle_for_indicator`
  - `backend/strategy/backtest_engine.py::_normalize_candles`
  - `backend/discovery/screener_engine.py` prepares candle arrays for indicator calculations.
  - Recommendation: later add a shared `backend/candles/normalization.py` helper with strict and permissive modes. Do not do this until route tests cover all accepted candle shapes.

- Status dictionary construction appears in several places:
  - `/health`, `/ready`, `/terminal/status`, `/ws/status` in `backend/api_server.py`
  - strategy, indicator, discovery status routes
  - Recommendation: later extract non-sensitive status builders into `backend/core/status.py`. Keep `sanitize_response()` at the route boundary.

### Frontend

- Status severity and labels were previously repeated across status bar, operator strip, index strip, watchlist, and data-quality badge code.
  - Current state: `frontend/lib/utils.ts` now owns `uiStatusMeta()`, `qualityClass()`, `getNseMarketSession()`, and `marketSessionLabel()`.
  - Remaining duplication: `status-bar.tsx`, `operator-status-strip.tsx`, `index-ticker.tsx`, and `watchlist-panel.tsx` still each derive subsystem-specific labels. This is acceptable short-term because each uses slightly different data sources.
  - Recommendation: later extract `frontend/lib/status-model.ts` for API/WS/broker/feed/tick/candle display derivation.

- API unavailable fallbacks are repeated in `frontend/lib/api.ts`.
  - Examples: indicator, strategy, discovery, portfolio fallback objects.
  - Recommendation: keep explicit fallback objects because they are typed and prevent fake data. Only extract if the file grows further.

- Indicator and strategy chart series mapping is split across:
  - `frontend/lib/indicator-series.ts`
  - `frontend/lib/strategy-series.ts`
  - This is appropriate: indicators and signals have different semantics.

## Possibly Legacy Files

- `backend/engine/strategy_engine.py`
  - This older VWAP mean-reversion engine is still imported by `backend/api_server.py` and instantiated as `strategy = StrategyEngine()`.
  - It appears older than the Phase 13 strategy/backtest package.
  - Do not delete yet. It may still feed legacy tick-stream strategy signals.
  - Future cleanup: verify whether live tick processing still calls it. If not, deprecate behind tests and remove in a dedicated cleanup phase.

- `/ws/terminal`
  - The backend still exposes `/ws/terminal` as an alias for `/ws/market_stream`.
  - This is intentionally retained. Removing it can break old frontend deployments or manual tooling.
  - Future cleanup: remove only after deployment logs confirm no clients use it.

- `backend/verify_angel.py` and `backend/test_integration.py`
  - These are manual/integration utilities rather than pytest tests.
  - They may touch broker integrations if run manually.
  - Do not delete in this phase. Later move them under `scripts/` or `tools/` with clear safety warnings.

- Generated folders observed locally:
  - `.pytest_cache/`, `logs/`, `backend/**/__pycache__/`, `tests/__pycache__/`, `frontend/.next/`, `frontend/node_modules/`.
  - These are ignored by `.gitignore` and not tracked. No deletion was needed for the code change.

- Static frontend files:
  - No obsolete root `frontend/index.html` was found.

## Possibly Unused Dependencies

No dependencies were removed. Current notes:

- `logzero`: keep. It is required indirectly by SmartAPI in deployment contexts.
- `websocket-client`: keep. Angel `SmartWebSocketV2` commonly depends on it.
- `websockets`: keep. Useful for Uvicorn/FastAPI WebSocket deployment stacks.
- `ntplib`: keep. Used by `backend/core/session_manager.py` and session manager tests.
- `aiosqlite`: keep. Used by `backend/data/trade_journal.py`.
- `pybind11`: keep. Required for the optional C++ indicator bridge.
- `httpx`: keep. Used by instrument loader and async route tests.
- `slowapi`: keep. Used by backend rate limiting.
- `loguru`: keep. Used by gateway, execution, candles, and session modules.
- `numpy`: used by legacy `backend/engine/strategy_engine.py`.
- `pandas`: not found in current source imports. Do not remove yet because it may be retained for near-term analytics/import work; remove only after a dependency-specific test pass and deployment check.

## Large Files / Split Later

Largest files observed:

- `frontend/store/terminal-store.ts` (~930 lines)
  - Contains workspace, market data, portfolio, indicators, strategy lab, chart, and connection state.
  - Future split: `connection-slice`, `portfolio-slice`, `indicator-slice`, `strategy-slice`, `market-watch-slice`.

- `frontend/lib/types.ts` (~582 lines)
  - Many backend response models live in one file.
  - Future split: `portfolio-types.ts`, `indicator-types.ts`, `strategy-types.ts`, `discovery-types.ts`.

- `backend/api_server.py` (~546 lines)
  - App setup, global components, status routes, WebSocket routes, startup logic, and legacy terminal routes are together.
  - Future split: `backend/app_factory.py`, `backend/runtime.py`, and route modules for terminal/status/ws.

- `frontend/lib/api.ts` (~526 lines)
  - Typed API helpers and all fallback objects live together.
  - Future split by domain after the API surface stabilizes.

- `backend/strategy/backtest_engine.py` (~500 lines)
  - Strategy signal generation, candle normalization, trade simulation, metrics, and result construction are all in one class.
  - Future split: signal generators, simulation, metrics. Best long-term candidate for C++ migration.

- `frontend/components/workspaces/workspace-content.tsx` (~483 lines)
  - Multiple workspaces and chart panel implementation are co-located.
  - Future split: separate workspace components for portfolio, risk, charts, journal.

- `frontend/components/workspaces/markets-workspace.tsx` (~470 lines)
  - Sector browser, instruments table, movers, screener form, index strip all in one file.
  - Future split: `sector-list`, `instrument-table`, `movers-table`, `screener-panel`, `market-board-summary`.

## C++ Migration Candidates

Do not migrate in this phase. Future C++ candidates:

- `backend/strategy/backtest_engine.py`
  - Strategy signal loops, trade simulation, and metrics are deterministic numeric workloads.

- `backend/discovery/screener_engine.py`
  - Multi-symbol screening can become expensive as symbol and candle counts grow.

- `backend/portfolio/equity_curve.py`
  - Drawdown/equity time-series math is simple but batch analytics may benefit from C++ later.

- `backend/portfolio/position_tracker.py`
  - Only the numerical PnL/accounting math should move later, not event handling or API objects.

- `backend/risk/risk_manager.py`
  - Numeric simulation and sizing logic can move later if it becomes performance-sensitive.

## Time Complexity Notes

### Indicator Calculations

- C++ indicator calculations are designed to be O(n) over the input series.
- Python fallback is acceptable for Render/demo and moderate arrays, but should not be the primary large-batch engine.
- Existing API limits (`MAX_INPUT_LENGTH = 5000`) protect indicator calculation endpoints from unbounded input.

### Backtesting Engine

- Current strategy backtests are effectively O(n) per strategy plus indicator cost.
- Each strategy calculates only the indicators it needs once per run.
- `run_backtest()` normalizes candles and then `generate_signals()` normalizes again when called with normalized candles. This duplicate O(n) pass is small but avoidable.
  - Not changed in this phase because changing the internal contract can affect signal-preview and tests.
  - Future safe fix: add a private `already_normalized` flag or split public normalization from private signal generation.

### Screener Engine

- Screener complexity is roughly O(symbols * candles * requested_indicators).
- It evaluates only symbols with CandleStore data and does not subscribe to the NSE universe.
- Obvious future improvement: cache indicator results per `(symbol, timeframe, filter_set)` during one screener request.
- Best long-term migration candidate: C++ screener batch evaluation with Python orchestration.

### Portfolio Calculations

- Position updates are incremental on filled order events.
- Portfolio summary should remain incremental where possible and avoid full recomputation on every tick unless holdings/positions are small.
- C++ migration should target PnL/drawdown math only, not broker reconciliation or API state.

### Frontend Rendering

- Large arrays are mostly sliced or paginated in UI tables.
- `terminal-store.ts` centralizes many updates, so future slice refactoring will reduce rerender coupling.
- Avoid adding memoization until a real render bottleneck is measured. Current highest-value work is splitting large components.

## Safe Refactors Completed In This Phase

- Added `backend/core/json_utils.py`.
- Updated indicator and strategy routers to use centralized `json_safe()`.
- Added `frontend/lib/utils.ts::marketNoDataLabel()` and reused it in index/watchlist/markets displays.
- Left response shapes and route behavior unchanged.

## Explicit Non-Changes

- Did not delete `/ws/terminal`.
- Did not remove any dependency.
- Did not delete generated folders or source files.
- Did not change broker/session behavior.
- Did not change execution safety behavior.
- Did not convert backend modules to C++.
- Did not change frontend UX beyond preserving existing Phase 14.5 behavior.
