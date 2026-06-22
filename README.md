# MAET Terminal - Market Analytics & Execution Terminal

A safety-first Indian market analytics and paper trading workspace for watchlists, candle diagnostics, dry-run order validation, read-only broker context, OMS/reconciliation visibility, and AI advisory notes.

**Live demo:** https://indian-algo-trading-platform.vercel.app/
**Backend health:** https://maet-backend.onrender.com/health
**Repository:** https://github.com/tanmay-alpha/indian-algo-trading-platform

MAET Terminal is a research and demo project. It is not financial advice, not a production trading system, and not a real-money execution platform. Live execution is hard-locked in the current build, broker context is read-only, and AI is advisory only.

## Why This Project Matters

MAET demonstrates full-stack product engineering around a realistic trading workflow without enabling unsafe broker mutation. It combines a Next.js terminal UI, FastAPI backend, broker market-data integration patterns, WebSocket status streaming, persistent paper OMS state, indicator/backtest research, deployment hardening, and explicit safety boundaries.

The goal is to show engineering judgment: honest data states, tested paper-trading correctness, protected backend routes, and UI copy that separates research from execution.

## Core Features

- Indian market watchlists and instrument search for NSE/BSE symbols.
- Chart workspace with candle availability, timeframe controls, indicators, and honest no-data diagnostics.
- TradingView and Angel One chart handoff links for selected instruments.
- Dry-run order validation with live execution locked and broker actions disabled.
- Persistent paper OMS and fill ledger for paper order visibility.
- Read-only portfolio context with protected unlock flow.
- Broker/account reconciliation and system readiness surfaces.
- AI advisory notes for explanation and risk framing only.
- Live-lock and broker-mutation safety strip visible in the terminal.

## Safety Model

- Live execution is hard-locked by build policy.
- Orders are dry-run or paper validation only.
- Broker mutation is disabled; the UI must not route real orders.
- Broker account context is read-only and protected where needed.
- Admin tokens are held in memory only and are not stored in browser storage.
- AI cannot place, approve, or route trades.
- No fake market prices, candles, holdings, PnL, order history, fills, or predictions are shown as real.

Backend lock check:

```bash
python -B -c "from backend.core.live_build_policy import is_live_execution_build_enabled; print(is_live_execution_build_enabled())"
```

Expected output:

```text
False
```

## Trading Workflow

1. Open the landing page and enter the terminal.
2. Confirm the safety strip: live locked, paper mode, read only, AI advisory only, broker mutation disabled.
3. Search or select a symbol in Market Watch.
4. Open the chart workspace and inspect candle availability, indicators, and handoff links.
5. Use dry-run validation to check order parameters without broker mutation.
6. Review read-only portfolio/OMS/reconciliation context when available.
7. Use System to verify backend health, readiness, stream state, and safety status.
8. Use AI Advisory only for research explanation and risk context.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Zustand | Terminal UI, responsive product screens, state |
| Backend | Python, FastAPI, Uvicorn | REST APIs, WebSocket server, broker orchestration |
| Realtime | WebSocket | Market/status/event streaming |
| Broker integration | Angel One SmartAPI | Authenticated market-data and read-only broker context |
| Analytics | C++17, pybind11, Python fallback | Technical indicator calculations |
| Persistence | SQLite demo store, migration scaffolding | Paper OMS, fills, watchlists, strategy state |
| Testing | pytest, TypeScript, ESLint, Next build | Backend correctness and frontend stability |
| Deployment | Vercel, Render | Public demo hosting |

## Local Setup

Backend:

```bash
git clone https://github.com/tanmay-alpha/indian-algo-trading-platform.git
cd indian-algo-trading-platform
cp .env.example .env
pip install -r requirements.txt
uvicorn backend.api_server:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

- http://localhost:3000
- http://localhost:3000/terminal

Never commit `.env` or real credential values.

## Environment Variables

Do not put private secrets in `NEXT_PUBLIC_` variables; browser-visible variables are public.

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_ID` / `ANGEL_CLIENT_CODE`
- `ANGEL_PASSWORD`
- `ANGEL_TOTP_SECRET`
- `TRADING_MODE`
- `LIVE_TRADING_ENABLED`
- `ENVIRONMENT`
- `ALLOWED_ORIGINS`
- `ADMIN_TOKEN`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_API_URL` legacy alias
- `NEXT_PUBLIC_WS_URL`

## Validation

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

## Demo Flow

Use [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a three-to-five minute internship demo. The short version:

- Explain MAET in one sentence.
- Open the terminal and point out the safety strip.
- Show watchlist/search, chart/no-data honesty, handoff links, dry-run validation, read-only portfolio context, system readiness, and AI advisory-only notes.
- Mention validation commands and the live-lock check.

## Current Limitations

- Live execution is intentionally disabled.
- Broker read-only/protected flows require a configured admin token.
- Real market data depends on backend, broker session, and market availability.
- Render Free can cold start and uses ephemeral local storage in the public demo.
- SQLite demo persistence is not high-availability production storage.
- AI advisory is non-executing and does not provide financial advice.
- Auth is intentionally simple for a portfolio demo and is not enterprise RBAC/OAuth.

## Documentation

- [Demo script](docs/DEMO_SCRIPT.md)
- [Demo readiness status](docs/DEMO_READINESS_STATUS.md)
- [Paper trading correctness](docs/PAPER_TRADING_CORRECTNESS.md)
- [Safety model](docs/SAFETY_MODEL.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Environment](docs/ENVIRONMENT.md)
- [Frontend API contract](docs/FRONTEND_API_CONTRACT.md)

## Disclaimer

MAET Terminal is a paper-mode research/demo platform. It is not financial advice, not investment advice, and not a production trading platform. Do not use it for real-money trading without a separate audited live-readiness phase, stronger auth, persistent infrastructure, operational monitoring, and formal risk controls.

