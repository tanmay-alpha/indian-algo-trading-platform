# MAET C++ Indicator Core

This directory contains the offline C++ numerical core for MAET Terminal indicators. It is intentionally independent from the Python backend and does not require broker connectivity.

## Purpose

The C++ core is the foundation for future high-performance calculations. Phase 12B adds an optional `pybind11` bridge so Python can call the native engine when the extension is built.

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

## pybind11 Bridge

The optional Python extension module is named `maet_cpp_indicators`. It exposes:

- `sma`
- `ema`
- `rsi`
- `macd`
- `atr`
- `vwap`
- `bollinger_bands`
- `engine_info`

Build helper:

```bash
pip install pybind11
python scripts/build_cpp_indicators.py
```

The backend does not require this extension at import time. `backend.indicators.IndicatorEngine` selects the C++ module when available and otherwise uses the pure Python fallback implementation.

## Future FastAPI Integration

Phase 12C can add safe FastAPI indicator routes that read candle arrays from existing stores and calculate indicators through `IndicatorEngine`. This should remain offline numerical computation only.

## Safety

This module performs offline numerical calculations only. It does not connect to brokers, read credentials, subscribe to market data, or place orders.
