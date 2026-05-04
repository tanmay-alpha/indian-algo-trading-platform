from backend.strategy.models import StrategyName


def get_strategy_templates() -> list[dict]:
    return [
        {
            "strategy_name": StrategyName.EMA_CROSSOVER.value,
            "display_name": "EMA Crossover",
            "description": "Long-only research template that buys when fast EMA crosses above slow EMA and exits when it crosses below.",
            "params_schema": {
                "fast_period": {"type": "integer", "default": 9, "minimum": 1},
                "slow_period": {"type": "integer", "default": 21, "minimum": 2},
            },
            "required_indicators": ["ema"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.RSI_MEAN_REVERSION.value,
            "display_name": "RSI Mean Reversion",
            "description": "Long-only research template that buys when RSI recovers from oversold and exits on overbought or neutral failure.",
            "params_schema": {
                "rsi_period": {"type": "integer", "default": 14, "minimum": 1},
                "oversold": {"type": "number", "default": 30},
                "overbought": {"type": "number", "default": 70},
            },
            "required_indicators": ["rsi"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.MACD_TREND.value,
            "display_name": "MACD Trend",
            "description": "Long-only research template that buys when MACD crosses above signal and exits when it crosses below.",
            "params_schema": {
                "fast_period": {"type": "integer", "default": 12, "minimum": 1},
                "slow_period": {"type": "integer", "default": 26, "minimum": 2},
                "signal_period": {"type": "integer", "default": 9, "minimum": 1},
            },
            "required_indicators": ["macd"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.VWAP_PULLBACK.value,
            "display_name": "VWAP Pullback",
            "description": "Long-only research template that buys when price reclaims VWAP after a pullback and exits when price loses VWAP.",
            "params_schema": {
                "threshold_pct": {"type": "number", "default": 0.25, "minimum": 0},
            },
            "required_indicators": ["vwap"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.BOLLINGER_BREAKOUT.value,
            "display_name": "Bollinger Breakout",
            "description": "Long-only research template that buys upper-band breakouts and exits below the middle band.",
            "params_schema": {
                "period": {"type": "integer", "default": 20, "minimum": 1},
                "stddev": {"type": "number", "default": 2.0, "exclusiveMinimum": 0},
            },
            "required_indicators": ["bollinger_bands"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
    ]

