# MAET C++ Indicator Core

This directory contains the offline C++ numerical core for MAET Terminal indicators. It is intentionally independent from the Python backend and does not require broker connectivity.

## Purpose

The C++ core is the foundation for future high-performance calculations that can later be exposed to Python through `pybind11`.

## Indicators Implemented

- SMA
- EMA
- RSI
- MACD
- ATR
- VWAP
- Bollinger Bands

## Build

```bash
cd cpp
cmake -S . -B build
cmake --build build
```

## Test

Linux/macOS or single-config generators:

```bash
./build/maet_indicator_tests
```

Windows multi-config generators:

```powershell
.\build\Debug\maet_indicator_tests.exe
```

If CMake emits a Release configuration, use:

```powershell
.\build\Release\maet_indicator_tests.exe
```

## NaN Policy

Indicator outputs always preserve input length. Values that cannot be computed because of insufficient history are represented as `std::numeric_limits<double>::quiet_NaN()`.

Invalid parameters, such as `period <= 0`, throw `std::invalid_argument`. Insufficient candle or price history does not throw.

## Future Python Integration

The next phase can add a `pybind11` bridge that exposes these functions to the FastAPI backend while keeping this core deterministic and separately testable.

## Safety

This module performs offline numerical calculations only. It does not connect to brokers, read credentials, subscribe to market data, or place orders.
