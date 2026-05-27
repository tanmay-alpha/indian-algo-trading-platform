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
        {
            "strategy_name": StrategyName.OPENING_RANGE_BREAKOUT.value,
            "display_name": "Opening Range Breakout",
            "description": "Advisory template that signals on breakout of the day's first N-minute high or low range.",
            "params_schema": {
                "orb_minutes": {"type": "integer", "default": 15, "minimum": 5},
                "target_multiplier": {"type": "number", "default": 1.5},
                "stop_loss_multiplier": {"type": "number", "default": 1.0},
            },
            "required_indicators": [],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.CPR_BREAKOUT.value,
            "display_name": "CPR Breakout",
            "description": "Advisory template that signals when price breaks out of the Central Pivot Range (CPR) boundaries.",
            "params_schema": {},
            "required_indicators": [],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.VWAP_MEAN_REVERSION.value,
            "display_name": "VWAP Mean Reversion",
            "description": "Advisory template that signals long when price deviates significantly below VWAP, targetting mean reversion.",
            "params_schema": {
                "deviation_pct": {"type": "number", "default": 1.0, "minimum": 0.1},
            },
            "required_indicators": ["vwap"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.SUPERTREND_TREND.value,
            "display_name": "Supertrend Trend Following",
            "description": "Advisory trend following template using ATR-based Supertrend calculation.",
            "params_schema": {
                "period": {"type": "integer", "default": 10, "minimum": 1},
                "multiplier": {"type": "number", "default": 3.0, "minimum": 0.1},
            },
            "required_indicators": ["atr"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.MOVING_AVERAGE_CROSSOVER.value,
            "display_name": "Moving Average Crossover",
            "description": "Advisory template based on fast and slow SMA/EMA crossovers.",
            "params_schema": {
                "fast_period": {"type": "integer", "default": 9, "minimum": 1},
                "slow_period": {"type": "integer", "default": 21, "minimum": 2},
                "ma_type": {"type": "string", "default": "EMA"},
            },
            "required_indicators": ["ema", "sma"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.RSI_REVERSAL.value,
            "display_name": "RSI Reversal",
            "description": "Advisory template signaling reversals when RSI crosses back from oversold or overbought zones.",
            "params_schema": {
                "rsi_period": {"type": "integer", "default": 14, "minimum": 1},
                "oversold": {"type": "number", "default": 30.0},
                "overbought": {"type": "number", "default": 70.0},
            },
            "required_indicators": ["rsi"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.GAP_CONTINUATION.value,
            "display_name": "Gap Continuation",
            "description": "Advisory template that signals continuation of overnight gaps at market open.",
            "params_schema": {
                "gap_threshold_pct": {"type": "number", "default": 0.5, "minimum": 0.1},
            },
            "required_indicators": [],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.PREVIOUS_DAY_BREAKOUT.value,
            "display_name": "Previous Day Breakout",
            "description": "Advisory template signaling breakout above the previous day's high or below its low.",
            "params_schema": {
                "breakout_pct": {"type": "number", "default": 0.1, "minimum": 0.0},
            },
            "required_indicators": [],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.VOLUME_BREAKOUT.value,
            "display_name": "Volume Breakout",
            "description": "Advisory template signaling price breakout when accompanied by high relative volume.",
            "params_schema": {
                "volume_period": {"type": "integer", "default": 20, "minimum": 1},
                "volume_multiplier": {"type": "number", "default": 2.0, "minimum": 1.0},
                "lookback_period": {"type": "integer", "default": 20, "minimum": 1},
            },
            "required_indicators": [],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },
        {
            "strategy_name": StrategyName.INDEX_TREND_FILTER.value,
            "display_name": "Index Trend Filter",
            "description": "Advisory crossover template filtered by long-term trend filter index.",
            "params_schema": {
                "fast_period": {"type": "integer", "default": 9, "minimum": 1},
                "slow_period": {"type": "integer", "default": 21, "minimum": 2},
                "filter_period": {"type": "integer", "default": 200, "minimum": 10},
            },
            "required_indicators": ["ema"],
            "supports_backtest": True,
            "live_execution_enabled": False,
        },

    ]

