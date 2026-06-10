import math
from typing import Any

from backend.indicators.types import CandleInput

INDICATORS = ["sma", "ema", "rsi", "macd", "atr", "vwap", "bollinger_bands"]


def engine_info() -> dict:
    return {
        "engine": "python",
        "module": "backend.indicators.python_fallback",
        "version": "0.1.0",
        "indicators": INDICATORS.copy(),
    }


def sma(values: list[float], period: int) -> list[float]:
    _validate_period(period, "SMA")
    if not values:
        return []
    output = _nan_list(len(values))
    rolling_sum = 0.0
    nan_count = 0
    for i, value in enumerate(values):
        if math.isnan(value):
            nan_count += 1
        else:
            rolling_sum += value
        if i >= period:
            outgoing = values[i - period]
            if math.isnan(outgoing):
                nan_count -= 1
            else:
                rolling_sum -= outgoing
        if i + 1 >= period and nan_count == 0:
            output[i] = rolling_sum / period
    return output


def ema(values: list[float], period: int) -> list[float]:
    _validate_period(period, "EMA")
    if not values:
        return []
    output = _nan_list(len(values))
    rolling_sum = 0.0
    nan_count = 0
    seeded = False
    previous_ema = math.nan
    multiplier = 2.0 / (period + 1.0)
    for i, value in enumerate(values):
        if math.isnan(value):
            nan_count += 1
            seeded = False
        else:
            rolling_sum += value
        if i >= period:
            outgoing = values[i - period]
            if math.isnan(outgoing):
                nan_count -= 1
            else:
                rolling_sum -= outgoing
        if not seeded:
            if i + 1 >= period and nan_count == 0:
                previous_ema = rolling_sum / period
                output[i] = previous_ema
                seeded = True
            continue
        if not math.isnan(value):
            previous_ema = ((value - previous_ema) * multiplier) + previous_ema
            output[i] = previous_ema
    return output


def rsi(close: list[float], period: int = 14) -> list[float]:
    _validate_period(period, "RSI")
    if not close:
        return []
    output = _nan_list(len(close))
    if len(close) <= period:
        return output

    gain_sum = 0.0
    loss_sum = 0.0
    for i in range(1, period + 1):
        prev, cur = close[i - 1], close[i]
        if math.isnan(prev) or math.isnan(cur):
            continue
        change = cur - prev
        if change > 0:
            gain_sum += change
        else:
            loss_sum += -change

    avg_gain = gain_sum / period
    avg_loss = loss_sum / period
    output[period] = _rsi_from_averages(avg_gain, avg_loss)

    for i in range(period + 1, len(close)):
        prev, cur = close[i - 1], close[i]
        if math.isnan(prev) or math.isnan(cur):
            output[i] = math.nan
            continue
        change = cur - prev
        gain = change if change > 0 else 0.0
        loss = -change if change < 0 else 0.0
        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period
        output[i] = _rsi_from_averages(avg_gain, avg_loss)
    return output


def macd(
    close: list[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> dict:
    _validate_period(fast_period, "MACD fast")
    _validate_period(slow_period, "MACD slow")
    _validate_period(signal_period, "MACD signal")
    if fast_period >= slow_period:
        raise ValueError("MACD fast period must be < slow period")
    if not close:
        return {"macd": [], "signal": [], "histogram": []}

    fast = ema(close, fast_period)
    slow = ema(close, slow_period)
    macd_line = _nan_list(len(close))
    for i, (fast_value, slow_value) in enumerate(zip(fast, slow)):
        if not math.isnan(fast_value) and not math.isnan(slow_value):
            macd_line[i] = fast_value - slow_value
    signal_line = ema(macd_line, signal_period)
    histogram = _nan_list(len(close))
    for i, (macd_value, signal_value) in enumerate(zip(macd_line, signal_line)):
        if not math.isnan(macd_value) and not math.isnan(signal_value):
            histogram[i] = macd_value - signal_value
    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def atr(candles: list[CandleInput], period: int = 14) -> list[float]:
    _validate_period(period, "ATR")
    if not candles:
        return []
    true_ranges = []
    for i, candle in enumerate(candles):
        high = float(candle["high"])
        low = float(candle["low"])
        high_low = high - low
        if i == 0:
            true_ranges.append(high_low)
            continue
        previous_close = float(candles[i - 1]["close"])
        true_ranges.append(max(high_low, abs(high - previous_close), abs(low - previous_close)))

    output = _nan_list(len(candles))
    if len(candles) < period:
        return output
    previous_atr = sum(true_ranges[:period]) / period
    output[period - 1] = previous_atr
    for i in range(period, len(candles)):
        previous_atr = ((previous_atr * (period - 1)) + true_ranges[i]) / period
        output[i] = previous_atr
    return output


def vwap(candles: list[CandleInput]) -> list[float]:
    from datetime import datetime
    if not candles:
        return []
    output = _nan_list(len(candles))
    cumulative_price_volume = 0.0
    cumulative_volume = 0.0
    last_day = None
    for i, candle in enumerate(candles):
        high = float(candle["high"])
        low = float(candle["low"])
        close = float(candle["close"])
        volume = float(candle["volume"])
        
        current_day = None
        if "time" in candle:
            t = candle["time"]
            if isinstance(t, str):
                try:
                    if t.isdigit():
                        ts = float(t)
                        if ts > 5000000000:
                            ts /= 1000.0
                        current_day = int((ts + 19800) // 86400)
                    else:
                        dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
                        current_day = dt.date().isoformat()
                except Exception:
                    pass
            elif isinstance(t, (int, float)):
                ts = float(t)
                if ts > 5000000000:
                    ts /= 1000.0
                current_day = int((ts + 19800) // 86400)
            
        if current_day is not None and last_day is not None and current_day != last_day:
            cumulative_price_volume = 0.0
            cumulative_volume = 0.0
            
        if current_day is not None:
            last_day = current_day

        typical_price = (high + low + close) / 3.0
        cumulative_price_volume += typical_price * volume
        cumulative_volume += volume
        if cumulative_volume != 0:
            output[i] = cumulative_price_volume / cumulative_volume
    return output


def bollinger_bands(
    close: list[float],
    period: int = 20,
    stddev_multiplier: float = 2.0,
) -> dict:
    _validate_period(period, "Bollinger Bands")
    if stddev_multiplier <= 0:
        raise ValueError("Bollinger Bands stddev multiplier must be > 0")
    if not close:
        return {"middle": [], "upper": [], "lower": []}

    middle = sma(close, period)
    upper = _nan_list(len(close))
    lower = _nan_list(len(close))
    for i in range(period - 1, len(close)):
        if math.isnan(middle[i]):
            continue
        window = close[i + 1 - period : i + 1]
        if any(math.isnan(value) for value in window):
            continue
        variance = sum((value - middle[i]) ** 2 for value in window) / period
        stddev = math.sqrt(variance)
        upper[i] = middle[i] + stddev_multiplier * stddev
        lower[i] = middle[i] - stddev_multiplier * stddev
    return {"middle": middle, "upper": upper, "lower": lower}


def _validate_period(period: int, name: str) -> None:
    if period <= 0:
        raise ValueError(f"{name} period must be > 0")


def _nan_list(size: int) -> list[float]:
    return [math.nan] * size


def _rsi_from_averages(avg_gain: float, avg_loss: float) -> float:
    if avg_loss == 0 and avg_gain > 0:
        return 100.0
    if avg_gain == 0 and avg_loss > 0:
        return 0.0
    if avg_gain == 0 and avg_loss == 0:
        return 50.0
    relative_strength = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + relative_strength))


def ensure_candles(candles: list[dict[str, Any]]) -> list[CandleInput]:
    required = {"open", "high", "low", "close", "volume"}
    normalized: list[CandleInput] = []
    for candle in candles:
        missing = required.difference(candle)
        if missing:
            raise ValueError(f"candle missing required keys: {sorted(missing)}")
        normalized.append({
            "open": float(candle["open"]),
            "high": float(candle["high"]),
            "low": float(candle["low"]),
            "close": float(candle["close"]),
            "volume": float(candle["volume"]),
        })
    return normalized
