# MAET C++ Indicator Core

This directory contains the offline C++17 numerical core for MAET Terminal indicators. It is intentionally independent from broker connectivity and can be tested separately from the Python backend.

## Purpose

The C++ core provides deterministic technical indicator calculations for the MAET indicator milestone. Python can call the native engine through an optional `pybind11` module, but the backend does not require that module to run.

## Indicators Implemented

- SMA
- EMA
- RSI
- MACD
- ATR
- VWAP
- Bollinger Bands

## Build With CMake

```bash
cd cpp
cmake -S . -B build
cmake --build build
```

Run tests after a CMake build:

```bash
./build/maet_indicator_tests
```

Windows multi-config generators may place the executable under a configuration folder:

```powershell
.\build\Debug\maet_indicator_tests.exe
.\build\Release\maet_indicator_tests.exe
```

Expected output:

```text
All C++ indicator tests passed
```

## Manual Test Fallback

If CMake is unavailable but `g++` is installed, compile the C++ tests manually from the repository root:

```powershell
g++ -std=c++17 -I cpp/include cpp/src/indicators.cpp cpp/tests/test_indicators.cpp -o build_manual_indicator_tests.exe
.\build_manual_indicator_tests.exe
```

Expected output:

```text
All C++ indicator tests passed
```

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

Build the bridge from the repository root:

```bash
pip install pybind11
python scripts/build_cpp_indicators.py
```

The helper runs:

```bash
cmake -S cpp -B cpp/build
cmake --build cpp/build --config Release
```

If `pybind11` is not available to CMake, the C++ static library and tests can still build. The Python extension is optional.

## Python Fallback

The backend does not require the compiled C++ module to run. `backend.indicators.IndicatorEngine` selects the C++ module when it is available and automatically falls back to `backend.indicators.python_fallback` when it is not.

This keeps Render staging and other environments without native compilation support safe and deployable.

## NaN Policy

Indicator outputs always preserve input length. Values that cannot be computed because of insufficient history are represented as `std::numeric_limits<double>::quiet_NaN()` in C++.

Invalid parameters, such as `period <= 0`, throw `std::invalid_argument`. Insufficient price or candle history does not throw.

FastAPI routes convert NaN and Infinity values to JSON `null` before returning responses.

## Safety

This module performs offline numerical calculations only. It does not connect to brokers, read credentials, subscribe to market data, place orders, or enable live trading.
