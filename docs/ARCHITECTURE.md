# MAET Terminal Architecture

MAET Terminal is a staged broker-terminal and algorithmic trading platform for Indian markets. The current system uses a Python FastAPI backend, Angel One SmartAPI integration, a typed internal event backbone, and a Next.js terminal frontend.

## Architecture Overview

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

The frontend is deployed separately from the backend. The backend owns broker connectivity, session lifecycle, market data ingestion, event routing, candles, execution safety, and portfolio state.

## Event Pipeline

```text
SmartAPI
  -> SmartWebSocketV2
    -> normalized tick dict
      -> TickBus
        -> TickEvent
          -> EventBus
            -> CandleStore
            -> PortfolioEngine
            -> WebSocket bridge
              -> Terminal UI
```

Raw broker tick payloads are normalized inside the gateway before reaching downstream modules.

## Module Dependency List

- `backend/core/config.py`: centralized environment-backed settings.
- `backend/core/session_manager.py`: safe async SmartAPI session lifecycle.
- `backend/core/session_watchdog.py`: background session refresh loop.
- `backend/core/events.py`: typed serializable event models.
- `backend/core/event_bus.py`: async pub/sub event router.
- `backend/core/security.py`: response sanitizer.
- `backend/gateway/instrument_loader.py`: Angel One public instrument master cache loader.
- `backend/gateway/instrument_registry.py`: instrument search/token registry with fallback symbols.
- `backend/gateway/market_gateway.py`: SmartWebSocketV2 gateway and tick normalization.
- `backend/gateway/tick_bus.py`: asyncio queue bridge from WebSocket thread.
- `backend/candles/candle_store.py`: in-memory OHLCV candle store.
- `backend/candles/candle_fetcher.py`: SmartAPI historical candle fetcher.
- `backend/execution/*`: order intent, risk gate, routing, paper/live managers, state machine, poller, fees, kill switch.
- `backend/portfolio/*`: position tracker, holdings tracker, equity curve, reconciliation, portfolio engine.
- `backend/routers/*`: API routers for candles and portfolio.
- `frontend/*`: Next.js trading terminal UI, WebSocket client, REST fallback, market/watchlist/portfolio surfaces.

## Phase Completion Summary

| Phase | Summary |
|---|---|
| Phase 7 | EventBus wiring, candle engine, and chart foundation |
| Phase 8 | Order intent model, execution safety layer, kill switch, risk gate, paper/live parity |
| Phase 9 | Portfolio reconciliation, holdings, PnL, equity curve |
| Phase 9.5 | Frontend portfolio API wiring and cleanup |
| Phase 10 | Vercel frontend and Render backend staging deployment hardening |
| Phase 10A/10B | WebSocket route stabilization, heartbeat, exponential reconnect, REST fallback |
| Phase 11A | Angel One public instrument master loader with fallback registry |
| Phase 11B | Security audit, sanitizer, rate limiting, credential rotation docs |
| Phase 11C | Presentation-ready README, architecture docs, demo-mode banner |

## Market Data Flow

```text
SmartAPI
  -> SmartWebSocketV2
  -> TickBus
  -> EventBus
  -> CandleStore
  -> PortfolioEngine
  -> WebSocket/REST
  -> Frontend
```

Market closed periods are expected to produce no live ticks. The WebSocket heartbeat and REST status fallback keep terminal status visible even without tick traffic.

## Execution Safety Flow

```text
OrderIntent
  -> PreTradeRiskGate
  -> ExecutionRouter
  -> PaperOrderManager / LiveOrderManager
  -> OrderStateMachine
  -> OrderStateEvent
  -> TradeJournal
```

PAPER mode is the default. LIVE execution is gated and disabled by default. Live broker placement must pass explicit safety checks before any broker call can be made.

## Portfolio Flow

```text
Filled OrderStateEvent
  -> PositionTracker
  -> PortfolioEngine
  -> PortfolioEvent
  -> API/WS
  -> Frontend
```

PAPER mode treats internal fills and the trade journal as source of truth. LIVE mode is designed to reconcile with broker positions and holdings.

## Deployment Architecture

```text
Vercel
  -> Next.js frontend
  -> NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL

Render
  -> FastAPI backend
  -> Angel One SmartAPI
  -> WebSocket market stream
```

Render is currently a staging target. Production should move to a persistent VPS/cloud VM with systemd, Nginx, HTTPS/WSS, a persistent database, and a secrets manager.

## Technology Decisions and Rationale

- **FastAPI backend**: async-friendly Python service with clear REST/WebSocket support and enough flexibility for broker integrations.
- **Next.js frontend**: deployable on Vercel with a typed React terminal interface and public runtime configuration through `NEXT_PUBLIC_*` variables.
- **Angel One SmartAPI isolated in backend**: broker credentials and session tokens never enter the browser.
- **SessionManager**: keeps broker login out of import time and stores only safe status in health responses.
- **SmartWebSocketV2 gateway thread + TickBus**: keeps blocking broker WebSocket callbacks away from the asyncio event loop.
- **EventBus**: provides a typed internal backbone for strategy, risk, execution, portfolio, candles, and future C++ bridge integration.
- **CandleStore in memory for now**: enough for live terminal behavior while avoiding fake OHLCV data. Persistent candle storage is a later production step.
- **ExecutionRouter + PreTradeRiskGate**: separates order intent, risk approval, routing, and order state changes so live trading can remain locked.
- **PortfolioEngine**: keeps PAPER portfolio state internal and prepares reconciliation paths for future broker-backed LIVE mode.
- **Render for staging**: quick public backend hosting, with known limitations around sleep and ephemeral storage.
- **VPS/systemd/Nginx later**: required for durable broker sessions, stable WebSocket operation, persistent storage, and production observability.

## Current Limitations

- Render Free sleeps after inactivity.
- SQLite and instrument cache data are ephemeral on Render Free.
- No production authentication yet.
- Market closed means no live ticks.
- The current frontend is a terminal shell, not a full TradingView replacement.
- Live order execution remains disabled by default.

## Roadmap

- C++ indicator core
- `pybind11` bridge
- Full strategy engine
- Backtesting
- Persistent database
- Authentication
- Observability
- VPS production deployment
