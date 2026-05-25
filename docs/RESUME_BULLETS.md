# Resume Bullets - MAET Terminal

## Short Project Title

MAET Terminal - Full-Stack Trading Analytics Workstation

## One-Line Description

1. Built an AI-assisted paper-mode trading terminal with event-driven FastAPI backend, WebSocket market data, persistent OMS, idempotent order flow, fill ledger, reconciliation engine, C++/Python indicators, and a Next.js OMS dashboard.
2. Developed an event-driven market research workstation with broker data ingestion, technical indicators, offline backtesting, and deployment on Vercel/Render.
3. Created a demo trading terminal to learn backend systems, realtime frontend state, C++/Python interop, safe execution practices, and cloud deployment.

## Resume Bullet Options

- Built AI-assisted paper-mode trading terminal with event-driven FastAPI backend, WebSocket market data, persistent OMS, idempotent order flow, fill ledger, reconciliation engine, C++/Python indicators, and Next.js OMS dashboard.
- Implemented an event-driven backend pipeline using TickBus and EventBus to process broker gateway status, market ticks, candles, portfolio events, and frontend broadcasts.
- Developed a C++17 technical indicator core with pybind11 bindings and a Python fallback engine for SMA, EMA, RSI, MACD, ATR, VWAP, and Bollinger Bands.
- Designed paper execution safety boundaries with PAPER default mode, persistent OMS, idempotent order tracking, PreTradeRiskGate, sanitizer, and admin-token protection for sensitive routes.
- Created offline strategy research APIs with templates for EMA crossover, RSI mean reversion, MACD trend, VWAP pullback, and Bollinger breakout backtests.
- Deployed a public demo using Vercel for the Next.js frontend and Render for the FastAPI backend, including REST/WebSocket URL hardening and cold-start states.

## Best 3 Bullets To Use

- Built AI-assisted paper-mode trading terminal with event-driven FastAPI backend, WebSocket market data, persistent OMS, idempotent order flow, fill ledger, reconciliation engine, C++/Python indicators, and Next.js OMS dashboard.
- Developed a C++17 technical indicator core with pybind11 bindings and Python fallback for SMA, EMA, RSI, MACD, ATR, VWAP, and Bollinger Bands, exposed through FastAPI routes.
- Implemented an event-driven backend pipeline using TickBus/EventBus for broker market data, CandleStore updates, portfolio state, WebSocket broadcasting, and offline strategy backtesting.

## GitHub Project Description

MAET Terminal is a personal PAPER-mode market analytics and execution terminal for Indian NSE markets. It combines a FastAPI backend, Next.js frontend, Angel One SmartAPI integration, WebSocket event pipeline, C++/pybind11 indicator engine, Python fallback, offline strategy backtesting, and Vercel/Render deployment. It is a learning/demo project, not production trading software or financial advice.

## Interview Explanation

### 30-Second Version

MAET Terminal is a full-stack trading research workstation I built for Indian NSE markets. It uses a FastAPI backend, Next.js frontend, WebSocket streaming, an event-driven TickBus/EventBus pipeline, a C++/pybind11 indicator engine with Python fallback, and offline strategy backtesting. It is PAPER mode only, with live trading locked, so it is safe for demos and learning.

### 60-Second Version

MAET Terminal connects a Next.js terminal UI to a FastAPI backend that manages broker market-data integration, WebSocket status, an internal TickBus/EventBus pipeline, CandleStore, portfolio state, indicators, and strategy research APIs. I added a C++17 indicator core and exposed it through pybind11, but kept a Python fallback so the backend can run even without native compilation. The frontend visualizes watchlists, status, charts, indicators, strategy backtests, and health panels. The goal was to learn how real systems fit together while keeping the project safe: PAPER mode only, no real orders, and live trading locked.

### Technical Version

The backend isolates broker connectivity in the SessionManager and MarketDataGateway. SmartWebSocketV2 callbacks are normalized into internal tick events, pushed through TickBus, then published through EventBus to CandleStore, PortfolioEngine, observability, and WebSocket broadcasting. Indicator routes call a Python IndicatorEngine that selects an optional pybind11 C++ module or a Python fallback. Strategy routes run offline backtests using cached or posted candles and do not connect to execution. The frontend uses Zustand to combine REST fallback and WebSocket state into a terminal UI deployed on Vercel.

### Honest AI-Assisted Version

This was an AI-assisted learning project. I used AI heavily for implementation help, debugging, architecture iteration, and documentation, but I personally guided the scope, tested the system, reviewed outputs, deployed it, and learned the pieces through each phase. The result is a strong demo and learning artifact, not a claim of production trading readiness.
