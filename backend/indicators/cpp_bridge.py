from typing import Any

try:
    import maet_cpp_indicators as _cpp

    CPP_AVAILABLE = True
    CPP_IMPORT_ERROR: str | None = None
except Exception as exc:  # pragma: no cover - depends on local native build
    _cpp = None
    CPP_AVAILABLE = False
    CPP_IMPORT_ERROR = exc.__class__.__name__


def cpp_available() -> bool:
    return CPP_AVAILABLE and _cpp is not None


def cpp_import_error() -> str | None:
    return CPP_IMPORT_ERROR


def engine_info() -> dict[str, Any]:
    if not cpp_available():
        return {
            "engine": "cpp",
            "module": "maet_cpp_indicators",
            "version": "0.1.0",
            "available": False,
            "import_error": CPP_IMPORT_ERROR,
            "indicators": ["sma", "ema", "rsi", "macd", "atr", "vwap", "bollinger_bands"],
        }
    info = _require_cpp().engine_info()
    info["available"] = True
    return info


def sma(values: list[float], period: int) -> list[float]:
    return _require_cpp().sma(values, period)


def ema(values: list[float], period: int) -> list[float]:
    return _require_cpp().ema(values, period)


def rsi(close: list[float], period: int = 14) -> list[float]:
    return _require_cpp().rsi(close, period)


def macd(
    close: list[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> dict[str, list[float]]:
    return _require_cpp().macd(close, fast_period, slow_period, signal_period)


def atr(candles: list[dict[str, Any]], period: int = 14) -> list[float]:
    return _require_cpp().atr(candles, period)


def vwap(candles: list[dict[str, Any]]) -> list[float]:
    return _require_cpp().vwap(candles)


def bollinger_bands(
    close: list[float],
    period: int = 20,
    stddev_multiplier: float = 2.0,
) -> dict[str, list[float]]:
    return _require_cpp().bollinger_bands(close, period, stddev_multiplier)


def _require_cpp():
    if not cpp_available():
        raise RuntimeError("C++ indicator module unavailable")
    return _cpp
