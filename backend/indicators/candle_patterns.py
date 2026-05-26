# backend/indicators/candle_patterns.py

from typing import Any, Dict, List


def detect_patterns(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Detect standard candlestick patterns: Doji, Hammer, Shooting Star,
    Bullish Engulfing, and Bearish Engulfing from list of OHLC candles.
    """
    markers = []
    if not candles:
        return markers

    for i in range(len(candles)):
        candle = candles[i]
        try:
            o = float(candle.get("open", 0))
            h = float(candle.get("high", 0))
            l = float(candle.get("low", 0))
            c = float(candle.get("close", 0))
            t = candle.get("time")
        except (ValueError, TypeError):
            continue

        body = abs(c - o)
        rng = h - l
        if rng <= 0:
            continue

        # 1. Doji: body is extremely small compared to range
        if body <= rng * 0.1:
            markers.append({
                "time": t,
                "pattern": "Doji",
                "direction": "neutral",
                "confidence": 1.0,
                "candle_index": i,
                "description": f"Doji identified (body: {body:.2f}, range: {rng:.2f})"
            })
            continue

        # 2. Hammer
        lower_shadow = min(o, c) - l
        upper_shadow = h - max(o, c)
        if body <= rng * 0.3 and lower_shadow >= 2 * body and upper_shadow <= 0.25 * body:
            markers.append({
                "time": t,
                "pattern": "Hammer",
                "direction": "bullish",
                "confidence": 1.0,
                "candle_index": i,
                "description": f"Hammer identified (lower shadow: {lower_shadow:.2f}, body: {body:.2f})"
            })
            continue

        # 3. Shooting Star
        if body <= rng * 0.3 and upper_shadow >= 2 * body and lower_shadow <= 0.25 * body:
            markers.append({
                "time": t,
                "pattern": "Shooting Star",
                "direction": "bearish",
                "confidence": 1.0,
                "candle_index": i,
                "description": f"Shooting Star identified (upper shadow: {upper_shadow:.2f}, body: {body:.2f})"
            })
            continue

        # 2-candle patterns
        if i > 0:
            prev_candle = candles[i - 1]
            try:
                o_prev = float(prev_candle.get("open", 0))
                h_prev = float(prev_candle.get("high", 0))
                l_prev = float(prev_candle.get("low", 0))
                c_prev = float(prev_candle.get("close", 0))
            except (ValueError, TypeError):
                continue

            # 4. Bullish Engulfing: previous bearish, current bullish, engulfing body
            if c_prev < o_prev and c > o:
                if o <= c_prev and c >= o_prev:
                    markers.append({
                        "time": t,
                        "pattern": "Bullish Engulfing",
                        "direction": "bullish",
                        "confidence": 1.0,
                        "candle_index": i,
                        "description": "Bullish Engulfing: current green body engulfs previous red body"
                    })
                    continue

            # 5. Bearish Engulfing: previous bullish, current bearish, engulfing body
            if c_prev > o_prev and c < o:
                if o >= c_prev and c <= o_prev:
                    markers.append({
                        "time": t,
                        "pattern": "Bearish Engulfing",
                        "direction": "bearish",
                        "confidence": 1.0,
                        "candle_index": i,
                        "description": "Bearish Engulfing: current red body engulfs previous green body"
                    })
                    continue

    return markers
