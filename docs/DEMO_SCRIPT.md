# MAET Terminal Demo Script

## Demo Goal

In two minutes, the viewer should understand that MAET Terminal is a full-stack trading research workstation: a Next.js terminal UI, FastAPI backend, broker market-data gateway, WebSocket/event pipeline, indicator engine, and offline strategy research layer.

The demo should also make the safety boundary clear: PAPER mode only, no real orders, no financial advice.

## 30-Second Pitch

MAET Terminal is my personal market analytics and execution terminal for Indian NSE markets. I built it to learn FastAPI, Next.js, WebSocket systems, broker API integration, event-driven backend design, C++/pybind11 interop, technical indicators, and deployment on Vercel/Render. It is intentionally PAPER/demo mode only, with live trading locked, so it can be shown safely as a research workstation rather than production trading software.

## 3-Minute Walkthrough

1. Open the live frontend: `https://indian-algo-trading-platform.vercel.app/`.
2. Point out the PAPER lock and explain that live trading is intentionally disabled.
3. Show the status strip: API, WS, broker, feed, tick, candle, mode, lock.
4. Show Market Watch and explain that only subscribed symbols are expected to update live.
5. Select a symbol such as `SBIN-EQ` or `RELIANCE-EQ`.
6. Open the chart workspace and explain the indicator engine: C++ core when available, Python fallback otherwise.
7. Show EMA/VWAP/Bollinger overlays and RSI/MACD panels if candle data is available.
8. Open the Strategy workspace and explain templates/backtesting as offline research only.
9. Run or explain a backtest only if candle data is available. Do not invent results.
10. Open Portfolio and explain PAPER portfolio state and session-scoped data.
11. Open System Health or Journal to show status/events/observability if available.
12. Open backend health: `https://maet-backend.onrender.com/health`.
13. Explain deployment: Vercel frontend, Render backend, known Render Free limitations.

## What To Say If Market Is Closed

Market closed means live ticks may not update. That is expected behavior, not a frontend failure. The terminal should still show backend/session/status information, WebSocket state, and safe unavailable states. Historical candles, indicators, and backtests can be shown only when data is already available or explicitly fetched.

Do not fake live ticks or prices during market-closed periods.

## What To Say If Render Is Sleeping

Render Free can cold start after inactivity. The first request may take 30-60 seconds. The frontend has a backend waking state for this case.

This is a hosting limitation, not an architecture failure. A production trading deployment would use a persistent VPS or cloud VM with stable process management, persistent storage, and monitoring.

## Interview Q&A

### Why FastAPI?

FastAPI gave me an async-friendly Python backend with clean REST and WebSocket support. It fits broker integration, background tasks, and typed API routes well.

### Why WebSocket?

Market terminals need streaming updates. WebSocket lets the backend push gateway status, ticks, and events to the frontend without polling every second.

### Why EventBus/TickBus?

Broker WebSocket callbacks run outside the normal asyncio flow. TickBus buffers normalized tick events safely, and EventBus distributes typed events to CandleStore, portfolio, observability, and frontend broadcasting.

### Why C++?

C++ is useful for deterministic, high-performance numerical calculations. I started with indicators because they are isolated, testable, and a good first C++ kernel.

### Why pybind11?

pybind11 lets Python call the C++ indicator core directly while keeping the FastAPI backend in Python. It supports a hybrid architecture: Python for orchestration, C++ for analytics.

### Why Python fallback?

The backend should still run on Render or any environment where native compilation is unavailable. The fallback keeps deployment reliable for demo/staging.

### Why PAPER mode?

This is a learning/demo project. PAPER mode keeps demos safe and prevents accidental real orders. LIVE trading is intentionally locked.

### Why Vercel + Render?

Vercel is straightforward for Next.js. Render is simple for a public FastAPI demo backend. Both are useful for learning deployment, though Render Free is not production-grade for trading.

### What is not production-ready?

It is not production trading software. Render Free can sleep, cache/storage can be ephemeral, auth is intentionally simple, and live order placement is disabled. A production system would need stronger persistence, observability, auth, secrets management, uptime guarantees, and formal risk controls.

### How did AI help?

AI helped with planning, implementation support, debugging, and documentation. I used it as a pair programmer while guiding the architecture, testing deployments, reviewing outputs, and learning the system.

### What did you personally learn?

I learned how frontend, backend, WebSocket, broker APIs, event pipelines, analytics engines, deployment, and security boundaries fit together in one system.

## Safe Demo Checklist

- [ ] No credentials visible.
- [ ] No browser tabs showing `.env`, Render env, broker account pages, tokens, or passwords.
- [ ] PAPER mode shown.
- [ ] Live trading disabled/locked.
- [ ] No real orders placed.
- [ ] No private account data shown.
- [ ] No fake prices, PnL, candles, or backtest results.
- [ ] Browser devtools closed unless needed for WebSocket diagnostics.
