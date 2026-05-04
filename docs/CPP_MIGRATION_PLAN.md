# MAET Terminal C++ Migration Plan

This plan documents future C++ migration candidates. It is not a rewrite plan. The current hybrid architecture should remain: Python owns orchestration, APIs, safety, and integrations; C++ owns high-performance deterministic analytics.

## Current C++ Usage

MAET currently uses C++ for the indicator milestone:

- `cpp/include/maet/*`
  - C++17 core types and indicator APIs.
- `cpp/src/indicators.cpp`
  - Deterministic implementations for SMA, EMA, RSI, MACD, ATR, VWAP, and Bollinger Bands.
- `cpp/bindings/pybind_module.cpp`
  - Optional pybind11 module named `maet_cpp_indicators`.
- `backend/indicators/cpp_bridge.py`
  - Optional Python import layer for the compiled module.
- `backend/indicators/python_fallback.py`
  - Pure Python fallback when the C++ extension is not compiled.
- `backend/indicators/engine.py`
  - Selects C++ when available, otherwise Python fallback.

The backend remains safe without the compiled C++ module. This is required for Render and other environments where native compilation may not be available.

## What Should Remain Python

These modules should remain Python because they are orchestration, integration, API, or deployment glue:

- FastAPI route modules
- `backend/api_server.py` app wiring
- environment/config handling
- `SessionManager`
- Angel One SmartAPI integration
- WebSocket server and client connection management
- EventBus/TickBus orchestration
- broker/session diagnostics
- response sanitization and security/rate limiting
- JSON APIs and frontend communication
- deployment scripts and runbooks

Python is the correct layer for safety gates, broker integration boundaries, and operational behavior.

## What Should Eventually Move To C++

Only deterministic numeric workloads should move:

- Strategy signal generation
  - EMA crossover, RSI mean reversion, MACD trend, VWAP pullback, Bollinger breakout.

- Backtesting trade simulation
  - long-only trade loop
  - fees/slippage accounting
  - equity curve
  - drawdown
  - metrics aggregation

- Screener engine
  - multi-symbol indicator evaluation
  - filter evaluation over candle batches
  - batch latest-value extraction

- Portfolio/risk numeric metrics
  - batch PnL calculations
  - drawdown/equity analytics
  - position aggregation math
  - risk sizing/simulation math

- Large candle batch analytics
  - multi-timeframe candle scans
  - rolling statistics
  - strategy feature generation

## Recommended Future Phases

### Phase C++ Backtest Engine

Create a C++ backtest core that accepts normalized OHLCV arrays, strategy parameters, and simulation parameters. It should return signals, trades, equity points, and metrics. Python should keep route validation and JSON response formatting.

### Phase C++ Strategy Signal Engine

Move strategy signal generation into C++ and keep Python templates as metadata. The C++ layer should expose functions like `ema_crossover_signals`, `macd_trend_signals`, and `bollinger_breakout_signals`.

### Phase C++ Screener Engine

Batch-evaluate multiple symbols against selected filters. Python should provide CandleStore data and return paginated JSON. The C++ layer should not subscribe to symbols or call broker APIs.

### Phase C++ Risk / Portfolio Math

Move only computational kernels: drawdown, PnL aggregation, exposure, simple risk simulations. Keep position lifecycle, event handling, broker reconciliation, and safety gates in Python.

## Why Not Rewrite Everything In C++

A full rewrite would increase risk without improving the parts that matter operationally.

- Python is better for:
  - FastAPI APIs
  - config/env handling
  - broker SDK integration
  - safety gates and auditability
  - JSON response construction
  - deployment on Render/VPS
  - fast iteration

- C++ is better for:
  - numerical loops
  - large candle batches
  - strategy simulation
  - high-throughput screening
  - deterministic analytics kernels

The correct architecture is hybrid: Python coordinates and protects the system; C++ accelerates bounded offline analytics. This keeps PAPER/LIVE safety and deployment behavior understandable while enabling high-performance quant features where they are actually useful.

## Safety Boundaries For Future C++ Work

- C++ modules must not call broker APIs.
- C++ modules must not place orders.
- C++ modules must not read credentials.
- C++ modules must accept explicit data inputs and return deterministic results.
- Python must continue to enforce execution safety, live-trading locks, and response sanitization.
- The backend must continue importing successfully when native C++ extensions are unavailable.
