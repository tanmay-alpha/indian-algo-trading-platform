# MAET Terminal

### Market Analytics & Execution Terminal for Indian NSE Markets

> Personal algorithmic trading research workstation.
> Built to learn FastAPI, Next.js, WebSocket, C++/pybind11, event-driven architecture, and cloud deployment.
> **PAPER mode only. No real orders. No financial advice.**

[Live Demo](https://indian-algo-trading-platform.vercel.app/) - [Backend Health](https://maet-backend.onrender.com/health)

## What This Is

MAET Terminal is a personal trading research workstation for Indian NSE markets. It connects a Next.js frontend, FastAPI backend, broker market-data gateway, event-driven backend pipeline, analytics engine, and research/backtesting surfaces into one terminal-style interface.

This is not a SaaS product, not production trading software, and not financial advice. It is a PAPER/demo/research project built to learn systems design, broker APIs, WebSocket lifecycle management, C++/Python interop, deployment, debugging, and security basics.

## Key Features

### Backend

- FastAPI backend on Render with REST + WebSocket APIs
- Angel One SmartAPI integration with EventBus/TickBus pipeline
- CandleStore, instrument master loader, portfolio engine, execution safety layer, and paper/live separation

### Analytics

- C++17 indicator core with pybind11 bridge and Python fallback
- SMA, EMA, RSI, MACD, ATR, VWAP, and Bollinger Bands
- Indicator API routes, strategy templates, and offline backtesting

### Frontend

- Next.js + TypeScript on Vercel with terminal-style UI
- Watchlist, market workspace, chart workspace, indicator overlays, and strategy/backtest UI
- System health/status panels plus market closed and backend waking states

### Safety

- PAPER default, LIVE locked, kill switch, and PreTradeRiskGate
- Response sanitizer and admin-token protection for sensitive routes
- No credentials in repo

## Screenshots

<!-- Add screenshots here -->

Screenshots should be captured from the live demo or local development environment. Do not include screenshots containing credentials, tokens, private account data, fake prices, fake PnL, or fake backtest results.
Suggested folder: `docs/screenshots/`

## Architecture & Safe Trading Flow

This platform is designed strictly for **PAPER/demo/research** purposes, not for live production trading. To ensure operational safety, the platform implements a decoupled, event-driven architecture with the following execution flow:

```text
Frontend (Next.js/Zustand)
  -> FastAPI REST/WebSocket API layer
  -> MarketDataGateway
  -> TickBus/EventBus
  -> CandleStore -> IndicatorEngine
  -> StrategyEngine (Emits SignalEvent only)
  -> SignalValidator (Converts to OrderIntent)
  -> RiskManager / PreTradeRiskGate
  -> OrderManager/OMS
  -> ExecutionRouter
  -> PaperBrokerAdapter (Default) / LiveBrokerAdapter (Locked & Disabled)
  -> OrderStateEvent / FillEvent / RejectEvent
  -> PortfolioEngine (Updates on event receipts only)
  -> Journal / Audit / Persistence
  -> WebSocketBroadcaster -> Frontend UI
```

### Key Execution Safety Principles:
1. **StrategyEngine emits SignalEvent only**: Strategy modules do not place orders or directly update portfolios. They only calculate indicator deviations and emit signals.
2. **SignalValidator**: Validates strategy signals and generates an official `OrderIntent`.
3. **RiskManager / PreTradeRiskGate**: Checks the system kill switch, max quantity, max notional limits, total portfolio exposure, and filters duplicate signal risks before passing orders downstream.
4. **OrderManager / OMS**: Controls order identifiers (`client_order_id`), prevents duplicate submissions (idempotency), tracks order states, maps to broker IDs, and records audit journals.
5. **ExecutionRouter & Adapters**: Routes execution intents to the `PaperBrokerAdapter` by default. The `LiveBrokerAdapter` is completely locked and disabled in code.
6. **PortfolioEngine Updates**: The portfolio is fully decoupled from active strategy engines and only updates its internal state (holdings, positions, PnL) upon receiving an asynchronous `OrderStateEvent`, `FillEvent`, or `RejectEvent`.
7. **No Direct Engine Access**: The frontend never connects directly to execution or backtesting engines; all communications are channeled through the FastAPI REST and WebSocket layers.

## Data Flow

### Live Market Data Flow

```text
Angel SmartAPI -> SmartWebSocketV2 -> MarketDataGateway -> TickBus
  -> EventBus -> CandleStore -> WebSocketBroadcaster -> Frontend UI
```

### Indicator Flow

```text
CandleStore -> IndicatorEngine -> C++ pybind11 (or Python fallback)
  -> FastAPI /indicators routes -> Chart overlays
```

### Strategy Backtest Flow

```text
Candles -> IndicatorEngine -> Strategy Templates -> BacktestEngine
  -> Metrics/Trades/Equity Curve -> REST API -> Strategy UI
```

### Execution Safety Flow

```text
SignalEvent -> SignalValidator -> OrderIntent -> PreTradeRiskGate -> OMS -> ExecutionRouter 
  -> PaperBrokerAdapter -> OrderStateEvent / FillEvent -> PortfolioEngine
```

Live order placement is strictly disabled/locked.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind, Zustand | Terminal UI, state, chart/strategy panels |
| Backend | Python, FastAPI, Uvicorn | REST APIs, WebSocket server, broker orchestration |
| Realtime | WebSocket | Market/event streaming |
| Broker | Angel One SmartAPI | Authenticated market-data session |
| Analytics | C++17, pybind11, Python fallback | Technical indicator calculations |
| Testing | pytest, C++ tests | Backend, router, and numerical validation |
| Deployment | Vercel, Render | Public demo hosting |
| Docs | Markdown | Architecture, demo, security, release notes |

## Backend Routes

| Route | Purpose | Public/Protected | Notes |
|---|---|---|---|
| `GET /live` | Liveness check | Public | Minimal uptime check |
| `GET /health` | Safe health snapshot | Public | Sanitized response |
| `GET /ready` | Readiness diagnostics | Public | Sanitized response |
| `GET /terminal/status` | Main terminal snapshot | Public | Sanitized response |
| `GET /ws/status` | WebSocket broadcaster status | Public | Client count and route info |
| `WS /ws/market_stream` | Market/event stream | Public | Frontend WebSocket path |
| `GET /instruments/search` | Instrument search | Public | Rate limited |
| `GET /instruments/master/status` | Instrument master status | Public | Cache/load summary |
| `GET /candles/{symbol}` | Cached candles | Public | CandleStore read |
| `POST /candles/{symbol}/fetch` | Fetch broker candles | Protected | Requires broker session |
| `GET /indicators/status` | Indicator engine status | Public | C++/Python status |
| `GET /indicators/{symbol}` | Candle-backed indicators | Public | JSON-safe nulls for NaN |
| `POST /indicators/calculate` | Offline indicator calculation | Public | Posted arrays only |
| `GET /strategies/status` | Strategy engine status | Public | Research-only |
| `GET /strategies/templates` | Strategy templates | Public | Live execution disabled |
| `POST /strategies/backtest` | Offline backtest | Protected | No broker calls |
| `POST /strategies/signal-preview` | Research signal preview | Protected | No execution routing |
| `GET /portfolio/summary` | Portfolio summary | Public | PAPER state summary |
| `GET /portfolio/positions` | Positions | Protected | Session-scoped details |
| `GET /observability/status` | Observability status | Public | Safe summary |
| `GET /metrics` | Prometheus-style metrics | Public | No credentials |

## Local Setup

```bash
git clone https://github.com/tanmay-alpha/indian-algo-trading-platform.git
cd indian-algo-trading-platform
cp .env.example .env
pip install -r requirements.txt
uvicorn backend.api_server:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Fill `.env` with your own values. Never commit `.env`.

## Environment Variables

Do not list real values in documentation or source control.

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_ID` / `ANGEL_CLIENT_CODE`
- `ANGEL_PASSWORD`
- `ANGEL_TOTP_SECRET`
- `TRADING_MODE`
- `LIVE_TRADING_ENABLED`
- `ENVIRONMENT`
- `ALLOWED_ORIGINS`
- `ADMIN_TOKEN`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

Frontend variables beginning with `NEXT_PUBLIC_` are visible in the browser. Do not put private secrets in `NEXT_PUBLIC_` variables.

## Deployment
### Frontend
The frontend is deployed on Vercel and uses `NEXT_PUBLIC_API_URL` plus `NEXT_PUBLIC_WS_URL`.

### Backend
The backend is deployed as a Render Web Service.
```bash
uvicorn backend.api_server:app --host 0.0.0.0 --port $PORT
```

Render Free has cold starts, sleeps with inactivity, ephemeral disk/cache, and is not production-grade for trading.

## C++ Indicator Engine

C++ exists to model the kind of high-performance analytics layer a trading terminal may eventually need. The C++17 core implements SMA, EMA, RSI, MACD, ATR, VWAP, and Bollinger Bands.

The optional `pybind11` bridge exposes the C++ engine to Python as `maet_cpp_indicators`. The backend can run with Python fallback when the compiled extension is unavailable, which keeps Render/demo deployment practical. Future C++ migration planning is in `docs/CPP_MIGRATION_PLAN.md`.

## Strategy Research

The strategy module includes EMA crossover, RSI mean reversion, MACD trend, VWAP pullback, and Bollinger breakout templates. Backtests run offline against posted candles or CandleStore data and produce research-only signals, trades, equity points, and metrics.

Strategy routes do not place real orders, do not connect signals to live execution, and do not guarantee profitability.

## Security Model

- PAPER mode is the default and LIVE mode is disabled/locked.
- Sensitive routes can require `X-Admin-Token` when `ADMIN_TOKEN` is set.
- Health/status responses use a sanitizer and selected endpoints have rate limits.
- Credential rotation is documented in `docs/CREDENTIAL_ROTATION.md`.
- `.gitignore` protects `.env` files and no secrets are stored in the repo.

## Project Status

| Phase | Status | Summary |
|---|---|---|
| Deployment readiness | Complete | Local setup, env templates, health/readiness routes |
| Render/Vercel deployment | Complete | Backend on Render, frontend on Vercel |
| WebSocket stabilization | Complete | `/ws/market_stream`, heartbeat, REST fallback, production URL hardening |
| C++ indicator engine | Complete | C++17 indicator core and tests |
| pybind11 bridge | Complete | Optional native module with Python fallback |
| Indicator API routes | Complete | Status, symbol indicators, offline calculation |
| Chart overlays | Complete | EMA, VWAP, Bollinger overlays; RSI/MACD panels |
| Strategy backend | Complete | Templates, signal preview, offline backtesting |
| Market discovery | Demo-ready | Instrument master, movers, screener over available data |
| UI credibility polish | Complete | Backend waking, market closed, stale/unavailable states |
| Cleanup audit | Complete | Code cleanup audit and C++ migration plan |
| Security hardening | Complete | Admin token dependency, sanitizer, security docs/tests |
| Final presentation package | Complete | README, demo script, resume, LinkedIn, release checklist |

## Known Limitations

- Render Free cold starts can take 30-60 seconds.
- WebSocket reliability depends on deployment/environment.
- SQLite/cache may be ephemeral on Render Free.
- This is not production trading software and real live order placement is disabled/locked.
- Some frontend panels are demo/research focused.
- The C++ extension may not compile on every host.
- Market data availability depends on broker session, subscription symbols, and market hours.

## What I Learned

- FastAPI backend design and WebSocket lifecycle management
- Event-driven architecture with TickBus/EventBus
- C++/Python interop through pybind11
- Frontend state management with Zustand
- Cloud deployment, production debugging, and security hygiene for public demos
- Using AI as a pair programmer while learning

## AI-Assisted Development Note

This project was built with heavy AI assistance as a learning project. I used AI for planning, implementation help, debugging, and documentation. I personally guided the architecture, tested deployments, reviewed outputs, and learned the system through iterative phases.

## License
MIT License — see [LICENSE](LICENSE)
