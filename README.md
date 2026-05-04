# MAET Terminal — Market Analytics & Execution Terminal

A PAPER-locked institutional-style trading terminal for Indian markets with FastAPI backend, Angel One SmartAPI integration, EventBus/TickBus, candle engine, portfolio engine, and Next.js frontend.

<!-- add screenshot here -->

## Architecture

```text
Vercel Frontend
  -> Render FastAPI Backend
    -> SessionManager / SmartAPI
      -> SmartWebSocketV2
        -> TickBus
          -> EventBus
            -> CandleStore
            -> ExecutionRouter
            -> PortfolioEngine
          -> WebSocket/REST
            -> Terminal UI
```

## Backend Routes

| Group | Endpoint | Purpose |
|---|---|---|
| Health | `GET /live` | Liveness check |
| Health | `GET /health` | Safe app/broker health |
| Health | `GET /ready` | Readiness diagnostics |
| Terminal | `GET /terminal/status` | Main terminal status snapshot |
| WebSocket | `GET /ws/status` | WebSocket diagnostics |
| WebSocket | `WS /ws/market_stream` | Terminal market/event stream |
| WebSocket | `WS /ws/terminal` | Compatibility WebSocket stream |
| Instruments | `GET /instruments/search` | Instrument search |
| Instruments | `GET /instruments/master/status` | Instrument master cache/load status |
| Candles | `GET /candles/{symbol}` | Cached/live candles |
| Candles | `POST /candles/{symbol}/fetch` | Broker candle fetch when session is available |
| Candles | `GET /candles/status` | Candle store status |
| Portfolio | `GET /portfolio/summary` | Portfolio summary |
| Portfolio | `GET /portfolio/positions` | Position list |
| Portfolio | `GET /portfolio/holdings` | Holdings snapshot |
| Portfolio | `GET /portfolio/equity-curve` | Equity curve points |
| Portfolio | `GET /portfolio/reconciliation/status` | Reconciliation status |

## Local Setup

```bash
git clone <repo-url>
cd indian-algo-trading-platform
```

Backend:

```bash
# If a backend/.env.example template is added later:
# cp backend/.env.example backend/.env
#
# Current repo intentionally does not include backend secrets.
# Create backend/.env privately using the variable names in docs/ENVIRONMENT.md.
# Do not commit backend/.env.
pip install -r requirements.txt
uvicorn backend.api_server:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Required backend environment variable names are documented in `docs/ENVIRONMENT.md`. Use `frontend/.env.example` for public frontend URL variable names.

## Deployment

- Frontend: Vercel
- Backend staging: Render

Render Free caveats:

- Sleeps after inactivity.
- SQLite/data cache is ephemeral.
- Not suitable for production live trading.

Production path:

- VPS/systemd/Nginx/WSS
- Persistent database
- Proper secrets manager
- Monitoring and incident response

## Security Model

- PAPER is the default mode.
- LIVE mode remains locked and gated.
- Kill switch and pre-trade risk gate are part of the execution path.
- No credentials are stored in the repository.
- Diagnostic responses pass through a sanitizer.
- Rate limiting is applied to selected public endpoints.
- No live order placement is enabled by default.

## Phase Completion

| Phase | Status | Summary |
|---|---|---|
| Phase 7 | Complete | Candles/EventBus/chart foundation |
| Phase 8 | Complete | Order intent and execution safety |
| Phase 9 | Complete | Portfolio reconciliation and PnL |
| Phase 9.5 | Complete | Frontend portfolio API wiring |
| Phase 10 | Complete | Vercel and Render staging deployment |
| Phase 10A/10B | Complete | WebSocket and REST fallback stabilization |
| Phase 11A | Complete | Angel One instrument master loader |
| Phase 11B | Complete | Security hardening pass |

## Future Roadmap

- C++ indicator core
- `pybind11` bridge
- Full strategy engine
- Backtesting engine
- Persistent database
- Authentication
- Observability
- VPS production deployment
