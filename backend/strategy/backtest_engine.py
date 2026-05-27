import math
from typing import Any, Optional

from backend.indicators.engine import IndicatorEngine
from backend.strategy.models import (
    BacktestMetrics,
    BacktestResult,
    BacktestStatus,
    BacktestTrade,
    EquityPoint,
    SignalAction,
    StrategyConfig,
    StrategyName,
    StrategySignal,
)


class BacktestEngine:
    def __init__(self, indicator_engine: Optional[IndicatorEngine] = None):
        self._indicator_engine = indicator_engine or IndicatorEngine()

    def run_backtest(self, config: StrategyConfig, candles: list[dict]) -> BacktestResult:
        strategy_name = self._validate_strategy(config.strategy_name)
        normalized = self._normalize_candles(candles)
        if not normalized:
            return self._result(
                config=config,
                status=BacktestStatus.NO_CANDLES.value,
                candles_used=0,
                signals=[],
                trades=[],
                equity_curve=[],
                metrics=self._empty_metrics(),
                reason="NO_CANDLES",
            )

        signals = self.generate_signals(config, normalized, strategy_name=strategy_name)
        trades, equity_curve, metrics = self._simulate_trades(config, normalized, signals)
        return self._result(
            config=config,
            status=BacktestStatus.SUCCESS.value,
            candles_used=len(normalized),
            signals=signals,
            trades=trades,
            equity_curve=equity_curve,
            metrics=metrics,
        )

    def generate_signals(
        self,
        config: StrategyConfig,
        candles: list[dict],
        strategy_name: Optional[StrategyName] = None,
    ) -> list[StrategySignal]:
        strategy = strategy_name or self._validate_strategy(config.strategy_name)
        normalized = self._normalize_candles(candles)
        if not normalized:
            return []

        generators = {
            StrategyName.EMA_CROSSOVER: self._signals_ema_crossover,
            StrategyName.RSI_MEAN_REVERSION: self._signals_rsi_mean_reversion,
            StrategyName.MACD_TREND: self._signals_macd_trend,
            StrategyName.VWAP_PULLBACK: self._signals_vwap_pullback,
            StrategyName.BOLLINGER_BREAKOUT: self._signals_bollinger_breakout,
        }
        return generators[strategy](config, normalized)

    def _signals_ema_crossover(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        fast_period = self._int_param(config, "fast_period", 9)
        slow_period = self._int_param(config, "slow_period", 21)
        if fast_period >= slow_period:
            raise ValueError("fast_period must be less than slow_period")

        close = [candle["close"] for candle in candles]
        fast = self._indicator_engine.ema(close, fast_period)
        slow = self._indicator_engine.ema(close, slow_period)
        return self._cross_signals(
            config,
            candles,
            fast,
            slow,
            buy_reason="fast EMA crossed above slow EMA",
            exit_reason="fast EMA crossed below slow EMA",
            metadata_keys=("fast_ema", "slow_ema"),
        )

    def _signals_rsi_mean_reversion(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        rsi_period = self._int_param(config, "rsi_period", 14)
        oversold = self._float_param(config, "oversold", 30.0)
        overbought = self._float_param(config, "overbought", 70.0)
        if oversold >= overbought:
            raise ValueError("oversold must be below overbought")

        close = [candle["close"] for candle in candles]
        rsi_values = self._indicator_engine.rsi(close, rsi_period)
        signals: list[StrategySignal] = []
        in_position = False
        neutral = 50.0

        for index in range(1, len(candles)):
            prev_rsi = rsi_values[index - 1]
            current_rsi = rsi_values[index]
            if not self._valid(prev_rsi) or not self._valid(current_rsi):
                continue

            candle = candles[index]
            if not in_position and prev_rsi <= oversold < current_rsi:
                in_position = True
                signals.append(self._signal(
                    config,
                    candle,
                    SignalAction.BUY.value,
                    self._strength(current_rsi - oversold, max(overbought - oversold, 1.0)),
                    "RSI recovered from oversold",
                    {"rsi": current_rsi},
                ))
            elif in_position and (current_rsi >= overbought or (prev_rsi >= neutral and current_rsi < neutral)):
                in_position = False
                reason = "RSI reached overbought" if current_rsi >= overbought else "RSI lost neutral level"
                signals.append(self._signal(
                    config,
                    candle,
                    SignalAction.EXIT.value,
                    self._strength(abs(current_rsi - neutral), 50.0),
                    reason,
                    {"rsi": current_rsi},
                ))

        return signals

    def _signals_macd_trend(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        fast_period = self._int_param(config, "fast_period", 12)
        slow_period = self._int_param(config, "slow_period", 26)
        signal_period = self._int_param(config, "signal_period", 9)
        if fast_period >= slow_period:
            raise ValueError("fast_period must be less than slow_period")

        close = [candle["close"] for candle in candles]
        result = self._indicator_engine.macd(close, fast_period, slow_period, signal_period)
        return self._cross_signals(
            config,
            candles,
            result["macd"],
            result["signal"],
            buy_reason="MACD crossed above signal",
            exit_reason="MACD crossed below signal",
            metadata_keys=("macd", "signal"),
        )

    def _signals_vwap_pullback(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        threshold_pct = self._float_param(config, "threshold_pct", 0.25)
        if threshold_pct < 0:
            raise ValueError("threshold_pct must be non-negative")

        vwap_values = self._indicator_engine.vwap(self._indicator_candles(candles))
        signals: list[StrategySignal] = []
        in_position = False

        for index in range(1, len(candles)):
            prev_vwap = vwap_values[index - 1]
            current_vwap = vwap_values[index]
            if not self._valid(prev_vwap) or not self._valid(current_vwap):
                continue

            prev_close = candles[index - 1]["close"]
            close = candles[index]["close"]
            reclaim_level = current_vwap * (1 + threshold_pct / 100.0)
            if not in_position and prev_close < prev_vwap and close >= reclaim_level:
                in_position = True
                signals.append(self._signal(
                    config,
                    candles[index],
                    SignalAction.BUY.value,
                    self._strength(close - current_vwap, max(current_vwap, 1.0)),
                    "close reclaimed VWAP after pullback",
                    {"vwap": current_vwap},
                ))
            elif in_position and close < current_vwap:
                in_position = False
                signals.append(self._signal(
                    config,
                    candles[index],
                    SignalAction.EXIT.value,
                    self._strength(current_vwap - close, max(current_vwap, 1.0)),
                    "close fell below VWAP",
                    {"vwap": current_vwap},
                ))

        return signals

    def _signals_bollinger_breakout(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        period = self._int_param(config, "period", 20)
        stddev = self._float_param(config, "stddev", 2.0)
        if stddev <= 0:
            raise ValueError("stddev must be positive")

        close = [candle["close"] for candle in candles]
        bands = self._indicator_engine.bollinger_bands(close, period, stddev)
        upper = bands["upper"]
        middle = bands["middle"]
        signals: list[StrategySignal] = []
        in_position = False

        for index in range(1, len(candles)):
            if not self._valid(upper[index]) or not self._valid(middle[index]):
                continue

            prev_close = close[index - 1]
            current_close = close[index]
            if not in_position and prev_close <= upper[index - 1] and current_close > upper[index]:
                in_position = True
                signals.append(self._signal(
                    config,
                    candles[index],
                    SignalAction.BUY.value,
                    self._strength(current_close - upper[index], max(upper[index], 1.0)),
                    "close broke above upper Bollinger Band",
                    {"upper": upper[index], "middle": middle[index]},
                ))
            elif in_position and current_close < middle[index]:
                in_position = False
                signals.append(self._signal(
                    config,
                    candles[index],
                    SignalAction.EXIT.value,
                    self._strength(middle[index] - current_close, max(middle[index], 1.0)),
                    "close fell below Bollinger middle band",
                    {"upper": upper[index], "middle": middle[index]},
                ))

        return signals

    def _cross_signals(
        self,
        config: StrategyConfig,
        candles: list[dict],
        left: list[float],
        right: list[float],
        buy_reason: str,
        exit_reason: str,
        metadata_keys: tuple[str, str],
    ) -> list[StrategySignal]:
        signals: list[StrategySignal] = []
        in_position = False
        for index in range(1, len(candles)):
            prev_left, prev_right = left[index - 1], right[index - 1]
            current_left, current_right = left[index], right[index]
            if not all(self._valid(value) for value in (prev_left, prev_right, current_left, current_right)):
                continue

            crossed_up = prev_left <= prev_right and current_left > current_right
            crossed_down = prev_left >= prev_right and current_left < current_right
            metadata = {metadata_keys[0]: current_left, metadata_keys[1]: current_right}
            if crossed_up and not in_position:
                in_position = True
                signals.append(self._signal(
                    config,
                    candles[index],
                    SignalAction.BUY.value,
                    self._strength(current_left - current_right, max(abs(current_right), 1.0)),
                    buy_reason,
                    metadata,
                ))
            elif crossed_down and in_position:
                in_position = False
                signals.append(self._signal(
                    config,
                    candles[index],
                    SignalAction.EXIT.value,
                    self._strength(current_right - current_left, max(abs(current_right), 1.0)),
                    exit_reason,
                    metadata,
                ))
        return signals

    def _simulate_trades(
        self,
        config: StrategyConfig,
        candles: list[dict],
        signals: list[StrategySignal],
    ) -> tuple[list[BacktestTrade], list[EquityPoint], BacktestMetrics]:
        trades: list[BacktestTrade] = []
        equity_curve: list[EquityPoint] = []
        equity = float(config.initial_capital)
        peak_equity = equity
        quantity = int(config.quantity)
        fee_rate = float(config.fee_bps) / 10000.0
        slippage_rate = float(config.slippage_bps) / 10000.0
        position: Optional[dict[str, Any]] = None

        for signal in signals:
            if signal.price is None or not self._valid(signal.price):
                continue
            if signal.action == SignalAction.BUY.value and position is None:
                raw_price = float(signal.price)
                entry_price = raw_price * (1 + slippage_rate)
                entry_fee = entry_price * quantity * fee_rate
                required_capital = entry_price * quantity + entry_fee
                if required_capital > equity:
                    signal.metadata["skipped"] = "INSUFFICIENT_CAPITAL"
                    continue
                position = {
                    "entry_time": signal.timestamp,
                    "entry_raw_price": raw_price,
                    "entry_price": entry_price,
                    "entry_fee": entry_fee,
                    "entry_slippage": (entry_price - raw_price) * quantity,
                }
            elif signal.action in {SignalAction.EXIT.value, SignalAction.SELL.value} and position is not None:
                trade = self._close_position(
                    config,
                    position,
                    signal.timestamp,
                    float(signal.price),
                    signal.reason,
                    fee_rate,
                    slippage_rate,
                )
                trades.append(trade)
                equity += trade.net_pnl
                peak_equity = max(peak_equity, equity)
                equity_curve.append(self._equity_point(signal.timestamp, equity, peak_equity))
                position = None

        if position is not None and candles:
            final_candle = candles[-1]
            trade = self._close_position(
                config,
                position,
                final_candle["timestamp"],
                float(final_candle["close"]),
                "END_OF_TEST",
                fee_rate,
                slippage_rate,
            )
            trades.append(trade)
            equity += trade.net_pnl
            peak_equity = max(peak_equity, equity)
            equity_curve.append(self._equity_point(final_candle["timestamp"], equity, peak_equity))

        return trades, equity_curve, self._metrics(config.initial_capital, trades, equity_curve)

    def _close_position(
        self,
        config: StrategyConfig,
        position: dict[str, Any],
        exit_time: str,
        raw_exit_price: float,
        exit_reason: str,
        fee_rate: float,
        slippage_rate: float,
    ) -> BacktestTrade:
        quantity = int(config.quantity)
        exit_price = raw_exit_price * (1 - slippage_rate)
        exit_fee = exit_price * quantity * fee_rate
        fees = position["entry_fee"] + exit_fee
        exit_slippage = (raw_exit_price - exit_price) * quantity
        slippage = position["entry_slippage"] + exit_slippage
        gross_pnl = (exit_price - position["entry_price"]) * quantity
        net_pnl = gross_pnl - fees
        cost_basis = max(position["entry_price"] * quantity + position["entry_fee"], 1e-12)
        return BacktestTrade(
            entry_time=position["entry_time"],
            exit_time=exit_time,
            symbol=config.symbol.strip().upper(),
            side="LONG",
            quantity=quantity,
            entry_price=self._round_money(position["entry_price"]),
            exit_price=self._round_money(exit_price),
            gross_pnl=self._round_money(gross_pnl),
            fees=self._round_money(fees),
            slippage=self._round_money(slippage),
            net_pnl=self._round_money(net_pnl),
            return_pct=round((net_pnl / cost_basis) * 100.0, 4),
            exit_reason=exit_reason,
        )

    def _metrics(
        self,
        initial_capital: float,
        trades: list[BacktestTrade],
        equity_curve: list[EquityPoint],
    ) -> BacktestMetrics:
        if not trades:
            return self._empty_metrics()

        wins = [trade.net_pnl for trade in trades if trade.net_pnl > 0]
        losses = [trade.net_pnl for trade in trades if trade.net_pnl < 0]
        gross_pnl = sum(trade.gross_pnl for trade in trades)
        net_pnl = sum(trade.net_pnl for trade in trades)
        total_fees = sum(trade.fees for trade in trades)
        total_slippage = sum(trade.slippage for trade in trades)
        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        return BacktestMetrics(
            total_trades=len(trades),
            winning_trades=len(wins),
            losing_trades=len(losses),
            win_rate=round((len(wins) / len(trades)) * 100.0, 4),
            gross_pnl=self._round_money(gross_pnl),
            net_pnl=self._round_money(net_pnl),
            total_fees=self._round_money(total_fees),
            total_slippage=self._round_money(total_slippage),
            total_return_pct=round((net_pnl / initial_capital) * 100.0, 4),
            max_drawdown=max((point.drawdown for point in equity_curve), default=0.0),
            profit_factor=round(gross_profit / gross_loss, 4) if gross_loss > 0 else None,
            average_win=self._round_money(sum(wins) / len(wins)) if wins else None,
            average_loss=self._round_money(sum(losses) / len(losses)) if losses else None,
        )

    def _normalize_candles(self, candles: list[dict]) -> list[dict]:
        normalized = []
        for index, candle in enumerate(candles or []):
            if not isinstance(candle, dict):
                continue
            try:
                normalized.append({
                    "timestamp": str(candle.get("timestamp") or candle.get("time") or index),
                    "open": float(candle["open"]),
                    "high": float(candle["high"]),
                    "low": float(candle["low"]),
                    "close": float(candle["close"]),
                    "volume": float(candle.get("volume") or 0.0),
                })
            except (KeyError, TypeError, ValueError):
                continue
        return normalized

    def _indicator_candles(self, candles: list[dict]) -> list[dict[str, float]]:
        return [
            {
                "open": candle["open"],
                "high": candle["high"],
                "low": candle["low"],
                "close": candle["close"],
                "volume": candle["volume"],
            }
            for candle in candles
        ]

    def _signal(
        self,
        config: StrategyConfig,
        candle: dict,
        action: str,
        strength: float,
        reason: str,
        metadata: dict[str, Any],
    ) -> StrategySignal:
        return StrategySignal(
            timestamp=candle["timestamp"],
            symbol=config.symbol.strip().upper(),
            strategy_name=config.strategy_name,
            action=action,
            price=candle["close"],
            strength=self._clamp(strength),
            reason=reason,
            metadata={key: self._round_optional(value) for key, value in metadata.items()},
        )

    def _equity_point(self, timestamp: str, equity: float, peak_equity: float) -> EquityPoint:
        drawdown = ((peak_equity - equity) / peak_equity) * 100.0 if peak_equity > 0 else 0.0
        return EquityPoint(timestamp=timestamp, equity=self._round_money(equity), drawdown=round(drawdown, 4))

    def _result(
        self,
        config: StrategyConfig,
        status: str,
        candles_used: int,
        signals: list[StrategySignal],
        trades: list[BacktestTrade],
        equity_curve: list[EquityPoint],
        metrics: BacktestMetrics,
        reason: Optional[str] = None,
    ) -> BacktestResult:
        return BacktestResult(
            status=status,
            strategy_name=config.strategy_name,
            symbol=config.symbol.strip().upper(),
            timeframe=config.timeframe,
            engine=self._indicator_engine.selected_engine,
            candles_used=candles_used,
            signals=signals,
            trades=trades,
            equity_curve=equity_curve,
            metrics=metrics,
            reason=reason,
        )

    @staticmethod
    def _validate_strategy(strategy_name: str) -> StrategyName:
        normalized = strategy_name.lower().strip()
        if normalized in ("ema_cross", "ema_crossover"):
            return StrategyName.EMA_CROSSOVER
        if normalized in ("rsi_mean_reversion", "rsi"):
            return StrategyName.RSI_MEAN_REVERSION
        if normalized in ("macd_trend", "macd"):
            return StrategyName.MACD_TREND
        if normalized in ("vwap_pullback", "vwap"):
            return StrategyName.VWAP_PULLBACK
        if normalized in ("bollinger_breakout", "bollinger", "bb_breakout"):
            return StrategyName.BOLLINGER_BREAKOUT
        try:
            return StrategyName(strategy_name)
        except ValueError as exc:
            raise ValueError("Unsupported strategy") from exc

    @staticmethod
    def _int_param(config: StrategyConfig, name: str, default: int) -> int:
        value = int(config.params.get(name, default))
        if value <= 0:
            raise ValueError(f"{name} must be positive")
        return value

    @staticmethod
    def _float_param(config: StrategyConfig, name: str, default: float) -> float:
        return float(config.params.get(name, default))

    @staticmethod
    def _valid(value: Any) -> bool:
        return isinstance(value, (int, float)) and math.isfinite(float(value))

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    @classmethod
    def _strength(cls, distance: float, denominator: float) -> float:
        if denominator <= 0:
            return 0.5
        return cls._clamp(0.5 + min(abs(distance) / denominator, 0.5))

    @staticmethod
    def _round_money(value: float) -> float:
        return round(float(value), 4)

    @classmethod
    def _round_optional(cls, value: Any):
        if cls._valid(value):
            return round(float(value), 6)
        return None

    @staticmethod
    def _empty_metrics() -> BacktestMetrics:
        return BacktestMetrics(
            total_trades=0,
            winning_trades=0,
            losing_trades=0,
            win_rate=0.0,
            gross_pnl=0.0,
            net_pnl=0.0,
            total_fees=0.0,
            total_slippage=0.0,
            total_return_pct=0.0,
            max_drawdown=0.0,
            profit_factor=None,
            average_win=None,
            average_loss=None,
        )

