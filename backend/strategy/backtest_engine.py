import math
from datetime import datetime, timezone, timedelta
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
            StrategyName.OPENING_RANGE_BREAKOUT: self._signals_opening_range_breakout,
            StrategyName.CPR_BREAKOUT: self._signals_cpr_breakout,
            StrategyName.VWAP_MEAN_REVERSION: self._signals_vwap_mean_reversion,
            StrategyName.SUPERTREND_TREND: self._signals_supertrend_trend,
            StrategyName.MOVING_AVERAGE_CROSSOVER: self._signals_moving_average_crossover,
            StrategyName.RSI_REVERSAL: self._signals_rsi_reversal,
            StrategyName.GAP_CONTINUATION: self._signals_gap_continuation,
            StrategyName.PREVIOUS_DAY_BREAKOUT: self._signals_previous_day_breakout,
            StrategyName.VOLUME_BREAKOUT: self._signals_volume_breakout,
            StrategyName.INDEX_TREND_FILTER: self._signals_index_trend_filter,
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

    def _indicator_candles(self, candles: list[dict]) -> list[dict]:
        return [
            {
                "open": candle["open"],
                "high": candle["high"],
                "low": candle["low"],
                "close": candle["close"],
                "volume": candle["volume"],
                "time": candle["timestamp"],
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
        invalidation_level: Optional[float] = None,
        suggested_stop_loss: Optional[float] = None,
        suggested_target: Optional[float] = None,
    ) -> StrategySignal:
        full_metadata = dict(metadata)
        if invalidation_level is not None:
            full_metadata["invalidation_level"] = invalidation_level
        if suggested_stop_loss is not None:
            full_metadata["suggested_stop_loss"] = suggested_stop_loss
        if suggested_target is not None:
            full_metadata["suggested_target"] = suggested_target

        return StrategySignal(
            timestamp=candle["timestamp"],
            symbol=config.symbol.strip().upper(),
            strategy_name=config.strategy_name,
            action=action,
            price=candle["close"],
            strength=self._clamp(strength),
            confidence=self._clamp(strength),
            reason=reason,
            metadata={key: self._round_optional(value) for key, value in full_metadata.items()},
            invalidation_level=self._round_optional(invalidation_level),
            suggested_stop_loss=self._round_optional(suggested_stop_loss),
            suggested_target=self._round_optional(suggested_target),
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

    @staticmethod
    def _parse_candle_time(timestamp: Any) -> datetime:
        from datetime import datetime, timezone, timedelta
        if isinstance(timestamp, (int, float)):
            ts = float(timestamp)
            if ts > 5000000000:
                ts /= 1000.0
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            return dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
        elif isinstance(timestamp, str):
            if timestamp.isdigit():
                ts = float(timestamp)
                if ts > 5000000000:
                    ts /= 1000.0
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                return dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
            try:
                clean_ts = timestamp.replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_ts)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
            except Exception:
                return datetime.fromtimestamp(0, tz=timezone(timedelta(hours=5, minutes=30)))
        return datetime.fromtimestamp(0, tz=timezone(timedelta(hours=5, minutes=30)))

    def _signals_opening_range_breakout(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        orb_minutes = self._int_param(config, "orb_minutes", 15)
        target_multiplier = self._float_param(config, "target_multiplier", 1.5)
        stop_loss_multiplier = self._float_param(config, "stop_loss_multiplier", 1.0)

        signals: list[StrategySignal] = []
        candles_with_time = [(c, self._parse_candle_time(c["timestamp"])) for c in candles]
        
        # Group by day
        days = {}
        for c, dt in candles_with_time:
            d = dt.date()
            if d not in days:
                days[d] = []
            days[d].append((c, dt))
            
        in_position = False
        
        for d, day_candles in days.items():
            if not day_candles:
                continue
            first_c, day_start = day_candles[0]
            orb_end = day_start + timedelta(minutes=orb_minutes)
            
            # Find ORB high and low
            orb_candles = [c for c, dt in day_candles if dt < orb_end]
            if not orb_candles:
                orb_candles = [first_c]
                
            orb_high = max(c["high"] for c in orb_candles)
            orb_low = min(c["low"] for c in orb_candles)
            
            for index, (c, dt) in enumerate(day_candles):
                close = c["close"]
                
                # Check if this candle is part of opening range
                if dt < orb_end:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.0,
                        "Within opening range duration",
                        {"orb_high": orb_high, "orb_low": orb_low}
                    ))
                    continue
                
                prev_c, _ = day_candles[index - 1]
                prev_close = prev_c["close"]
                range_size = orb_high - orb_low
                if range_size <= 0:
                    range_size = close * 0.01
                    
                if not in_position and prev_close <= orb_high < close:
                    in_position = True
                    target = close + target_multiplier * range_size
                    sl = close - stop_loss_multiplier * range_size
                    signals.append(self._signal(
                        config, c, SignalAction.BUY.value,
                        self._strength(close - orb_high, range_size),
                        f"Opening Range Breakout UP of {orb_high:.2f}",
                        {"orb_high": orb_high, "orb_low": orb_low},
                        invalidation_level=orb_high,
                        suggested_stop_loss=sl,
                        suggested_target=target,
                    ))
                elif in_position and prev_close >= orb_low > close:
                    in_position = False
                    target = close - target_multiplier * range_size
                    sl = close + stop_loss_multiplier * range_size
                    signals.append(self._signal(
                        config, c, SignalAction.SELL.value,
                        self._strength(orb_low - close, range_size),
                        f"Opening Range Breakout DOWN of {orb_low:.2f}",
                        {"orb_high": orb_high, "orb_low": orb_low},
                        invalidation_level=orb_low,
                        suggested_stop_loss=sl,
                        suggested_target=target,
                    ))
                else:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold position / No ORB trigger",
                        {"orb_high": orb_high, "orb_low": orb_low}
                    ))
        return signals

    def _signals_cpr_breakout(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        target_multiplier = self._float_param(config, "target_multiplier", 1.5)
        signals: list[StrategySignal] = []
        candles_with_time = [(c, self._parse_candle_time(c["timestamp"])) for c in candles]
        
        # Group by day
        days = {}
        for c, dt in candles_with_time:
            d = dt.date()
            if d not in days:
                days[d] = []
            days[d].append((c, dt))
            
        sorted_dates = sorted(days.keys())
        day_metrics = {}
        
        # Calculate daily metrics for CPR (Pivot, BC, TC)
        for d in sorted_dates:
            dc = days[d]
            high = max(c["high"] for c, _ in dc)
            low = min(c["low"] for c, _ in dc)
            close = dc[-1][0]["close"]
            day_metrics[d] = {"high": high, "low": low, "close": close}
            
        in_position = False
        
        for i, d in enumerate(sorted_dates):
            day_candles = days[d]
            if i == 0:
                # First day: no previous day data
                for c, _ in day_candles:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.0,
                        "Insufficient data (No previous day for CPR calculation)",
                        {}
                    ))
                continue
                
            prev_d = sorted_dates[i - 1]
            prev_m = day_metrics[prev_d]
            p = (prev_m["high"] + prev_m["low"] + prev_m["close"]) / 3.0
            bc = (prev_m["high"] + prev_m["low"]) / 2.0
            tc = (p - bc) + p
            cpr_high = max(tc, bc)
            cpr_low = min(tc, bc)
            
            for index, (c, dt) in enumerate(day_candles):
                close = c["close"]
                if index == 0:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold (First candle of day for CPR calculation)",
                        {"cpr_high": cpr_high, "cpr_low": cpr_low, "pivot": p}
                    ))
                    continue
                    
                prev_c, _ = day_candles[index - 1]
                prev_close = prev_c["close"]
                range_size = cpr_high - cpr_low
                if range_size <= 0:
                    range_size = close * 0.01
                    
                if not in_position and prev_close <= cpr_high < close:
                    in_position = True
                    target = close + target_multiplier * range_size
                    sl = cpr_low
                    signals.append(self._signal(
                        config, c, SignalAction.BUY.value,
                        self._strength(close - cpr_high, range_size),
                        f"CPR Breakout UP of {cpr_high:.2f}",
                        {"cpr_high": cpr_high, "cpr_low": cpr_low, "pivot": p},
                        invalidation_level=cpr_high,
                        suggested_stop_loss=sl,
                        suggested_target=target,
                    ))
                elif in_position and prev_close >= cpr_low > close:
                    in_position = False
                    target = close - target_multiplier * range_size
                    sl = cpr_high
                    signals.append(self._signal(
                        config, c, SignalAction.SELL.value,
                        self._strength(cpr_low - close, range_size),
                        f"CPR Breakout DOWN of {cpr_low:.2f}",
                        {"cpr_high": cpr_high, "cpr_low": cpr_low, "pivot": p},
                        invalidation_level=cpr_low,
                        suggested_stop_loss=sl,
                        suggested_target=target,
                    ))
                else:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold position / Within CPR trend",
                        {"cpr_high": cpr_high, "cpr_low": cpr_low, "pivot": p}
                    ))
        return signals

    def _signals_vwap_mean_reversion(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        deviation_pct = self._float_param(config, "deviation_pct", 1.0)
        signals: list[StrategySignal] = []
        
        vwap_vals = self._indicator_engine.vwap(self._indicator_candles(candles))
        
        in_position = False
        for i, c in enumerate(candles):
            close = c["close"]
            vwap = vwap_vals[i] if i < len(vwap_vals) else math.nan
            
            if math.isnan(vwap):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.0,
                    "Insufficient data for VWAP calculation",
                    {}
                ))
                continue
                
            deviation = (close - vwap) / vwap * 100.0
            
            if not in_position and deviation <= -deviation_pct:
                in_position = True
                sl = close * (1.0 - deviation_pct / 100.0)
                signals.append(self._signal(
                    config, c, SignalAction.BUY.value,
                    self._strength(-deviation, deviation_pct),
                    f"VWAP oversold mean reversion: deviation {deviation:.2f}%",
                    {"vwap": vwap, "deviation": deviation},
                    invalidation_level=close * 0.98,
                    suggested_stop_loss=sl,
                    suggested_target=vwap,
                ))
            elif in_position and deviation >= deviation_pct:
                in_position = False
                sl = close * (1.0 + deviation_pct / 100.0)
                signals.append(self._signal(
                    config, c, SignalAction.SELL.value,
                    self._strength(deviation, deviation_pct),
                    f"VWAP overbought mean reversion: deviation {deviation:.2f}%",
                    {"vwap": vwap, "deviation": deviation},
                    invalidation_level=close * 1.02,
                    suggested_stop_loss=sl,
                    suggested_target=vwap,
                ))
            else:
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    "Hold position / deviation normal",
                    {"vwap": vwap, "deviation": deviation}
                ))
        return signals

    def _signals_supertrend_trend(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        period = self._int_param(config, "period", 10)
        multiplier = self._float_param(config, "multiplier", 3.0)
        
        signals: list[StrategySignal] = []
        
        atr_vals = self._indicator_engine.atr(self._indicator_candles(candles), period)
        
        upper_bands = [0.0] * len(candles)
        lower_bands = [0.0] * len(candles)
        supertrend = [0.0] * len(candles)
        trend = [1] * len(candles)
        
        for i, c in enumerate(candles):
            close = c["close"]
            high = c["high"]
            low = c["low"]
            atr = atr_vals[i] if i < len(atr_vals) else math.nan
            
            if math.isnan(atr):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.0,
                    "Insufficient data for ATR (Supertrend calculation)",
                    {}
                ))
                continue
                
            hl2 = (high + low) / 2.0
            basic_upper = hl2 + multiplier * atr
            basic_lower = hl2 - multiplier * atr
            
            if i == 0 or math.isnan(atr_vals[i-1]):
                upper_bands[i] = basic_upper
                lower_bands[i] = basic_lower
                supertrend[i] = basic_upper
                trend[i] = -1 if close < supertrend[i] else 1
            else:
                prev_close = candles[i-1]["close"]
                prev_upper = upper_bands[i-1]
                prev_lower = lower_bands[i-1]
                prev_supertrend = supertrend[i-1]
                
                if basic_upper < prev_upper or prev_close > prev_upper:
                    upper_bands[i] = basic_upper
                else:
                    upper_bands[i] = prev_upper
                    
                if basic_lower > prev_lower or prev_close < prev_lower:
                    lower_bands[i] = basic_lower
                else:
                    lower_bands[i] = prev_lower
                    
                if prev_supertrend == prev_upper:
                    if close > upper_bands[i]:
                        trend[i] = 1
                        supertrend[i] = lower_bands[i]
                    else:
                        trend[i] = -1
                        supertrend[i] = upper_bands[i]
                else:
                    if close < lower_bands[i]:
                        trend[i] = -1
                        supertrend[i] = upper_bands[i]
                    else:
                        trend[i] = 1
                        supertrend[i] = lower_bands[i]
            
            if i == 0 or math.isnan(atr_vals[i-1]):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    "Hold (Supertrend initializing)",
                    {"supertrend": supertrend[i], "trend": trend[i]}
                ))
                continue
                
            prev_trend = trend[i-1]
            curr_trend = trend[i]
            
            if prev_trend == -1 and curr_trend == 1:
                target = close + 2.0 * atr
                sl = supertrend[i]
                signals.append(self._signal(
                    config, c, SignalAction.BUY.value, 0.8,
                    f"Supertrend bullish crossover: close above {supertrend[i]:.2f}",
                    {"supertrend": supertrend[i], "trend": curr_trend},
                    invalidation_level=supertrend[i],
                    suggested_stop_loss=sl,
                    suggested_target=target,
                ))
            elif prev_trend == 1 and curr_trend == -1:
                target = close - 2.0 * atr
                sl = supertrend[i]
                signals.append(self._signal(
                    config, c, SignalAction.SELL.value, 0.8,
                    f"Supertrend bearish crossover: close below {supertrend[i]:.2f}",
                    {"supertrend": supertrend[i], "trend": curr_trend},
                    invalidation_level=supertrend[i],
                    suggested_stop_loss=sl,
                    suggested_target=target,
                ))
            else:
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    f"Supertrend following: trend {'bullish' if curr_trend == 1 else 'bearish'}",
                    {"supertrend": supertrend[i], "trend": curr_trend}
                ))
        return signals

    def _signals_moving_average_crossover(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        fast_period = self._int_param(config, "fast_period", 9)
        slow_period = self._int_param(config, "slow_period", 21)
        ma_type = config.params.get("ma_type", "EMA") if config.params else "EMA"
        
        if fast_period >= slow_period:
            raise ValueError("fast_period must be less than slow_period")
            
        signals: list[StrategySignal] = []
        closes = [c["close"] for c in candles]
        
        if ma_type == "SMA":
            fast_ma = self._indicator_engine.sma(closes, fast_period)
            slow_ma = self._indicator_engine.sma(closes, slow_period)
        else:
            fast_ma = self._indicator_engine.ema(closes, fast_period)
            slow_ma = self._indicator_engine.ema(closes, slow_period)
            
        in_position = False
        
        for i, c in enumerate(candles):
            close = c["close"]
            f_val = fast_ma[i]
            s_val = slow_ma[i]
            
            if math.isnan(f_val) or math.isnan(s_val):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.0,
                    f"Insufficient data for MA Crossover ({ma_type})",
                    {}
                ))
                continue
                
            prev_f = fast_ma[i-1]
            prev_s = slow_ma[i-1]
            
            if not in_position and prev_f <= prev_s and f_val > s_val:
                in_position = True
                signals.append(self._signal(
                    config, c, SignalAction.BUY.value,
                    self._strength(f_val - s_val, s_val * 0.01),
                    f"MA Crossover bullish: {ma_type} {fast_period} crossed above {slow_period}",
                    {"fast_ma": f_val, "slow_ma": s_val},
                    invalidation_level=s_val,
                    suggested_stop_loss=s_val,
                    suggested_target=close + 2.0 * (close - s_val),
                ))
            elif in_position and prev_f >= prev_s and f_val < s_val:
                in_position = False
                signals.append(self._signal(
                    config, c, SignalAction.SELL.value,
                    self._strength(s_val - f_val, s_val * 0.01),
                    f"MA Crossover bearish: {ma_type} {fast_period} crossed below {slow_period}",
                    {"fast_ma": f_val, "slow_ma": s_val},
                    invalidation_level=s_val,
                    suggested_stop_loss=s_val,
                    suggested_target=close - 2.0 * (s_val - close),
                ))
            else:
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    f"MA Crossover follow trend",
                    {"fast_ma": f_val, "slow_ma": s_val}
                ))
        return signals

    def _signals_rsi_reversal(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        rsi_period = self._int_param(config, "rsi_period", 14)
        oversold = self._float_param(config, "oversold", 30.0)
        overbought = self._float_param(config, "overbought", 70.0)
        
        signals: list[StrategySignal] = []
        closes = [c["close"] for c in candles]
        
        rsi_vals = self._indicator_engine.rsi(closes, rsi_period)
        in_position = False
        
        for i, c in enumerate(candles):
            close = c["close"]
            rsi = rsi_vals[i]
            
            if math.isnan(rsi):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.0,
                    "Insufficient data for RSI calculation",
                    {}
                ))
                continue
                
            prev_rsi = rsi_vals[i-1]
            
            if not in_position and prev_rsi <= oversold and rsi > oversold:
                in_position = True
                signals.append(self._signal(
                    config, c, SignalAction.BUY.value,
                    self._strength(rsi - oversold, 10.0),
                    f"RSI oversold reversal: RSI crossed above {oversold:.1f}",
                    {"rsi": rsi},
                    invalidation_level=close * 0.99,
                    suggested_stop_loss=close * 0.98,
                    suggested_target=close * 1.04,
                ))
            elif in_position and prev_rsi >= overbought and rsi < overbought:
                in_position = False
                signals.append(self._signal(
                    config, c, SignalAction.SELL.value,
                    self._strength(overbought - rsi, 10.0),
                    f"RSI overbought reversal: RSI crossed below {overbought:.1f}",
                    {"rsi": rsi},
                    invalidation_level=close * 1.01,
                    suggested_stop_loss=close * 1.02,
                    suggested_target=close * 0.96,
                ))
            else:
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    f"RSI neutral ({rsi:.2f})",
                    {"rsi": rsi}
                ))
        return signals

    def _signals_gap_continuation(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        gap_threshold_pct = self._float_param(config, "gap_threshold_pct", 0.5)
        signals: list[StrategySignal] = []
        candles_with_time = [(c, self._parse_candle_time(c["timestamp"])) for c in candles]
        
        days = {}
        for c, dt in candles_with_time:
            d = dt.date()
            if d not in days:
                days[d] = []
            days[d].append((c, dt))
            
        sorted_dates = sorted(days.keys())
        day_metrics = {}
        
        for d in sorted_dates:
            dc = days[d]
            day_metrics[d] = {
                "close": dc[-1][0]["close"]
            }
            
        for i, d in enumerate(sorted_dates):
            day_candles = days[d]
            if i == 0:
                for c, _ in day_candles:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.0,
                        "Insufficient data (No previous day close for Gap calculation)",
                        {}
                    ))
                continue
                
            prev_d = sorted_dates[i-1]
            prev_close = day_metrics[prev_d]["close"]
            
            for index, (c, dt) in enumerate(day_candles):
                close = c["close"]
                open_p = c["open"]
                
                if index == 0:
                    gap_pct = (open_p - prev_close) / prev_close * 100.0
                    
                    if gap_pct >= gap_threshold_pct:
                        signals.append(self._signal(
                            config, c, SignalAction.BUY.value,
                            self._strength(gap_pct, gap_threshold_pct),
                            f"Gap Up Continuation: gapped up by {gap_pct:.2f}%",
                            {"gap_pct": gap_pct, "prev_close": prev_close},
                            invalidation_level=prev_close,
                            suggested_stop_loss=prev_close,
                            suggested_target=open_p * (1.0 + 2.0 * gap_threshold_pct / 100.0),
                        ))
                    elif gap_pct <= -gap_threshold_pct:
                        signals.append(self._signal(
                            config, c, SignalAction.SELL.value,
                            self._strength(-gap_pct, gap_threshold_pct),
                            f"Gap Down Continuation: gapped down by {gap_pct:.2f}%",
                            {"gap_pct": gap_pct, "prev_close": prev_close},
                            invalidation_level=prev_close,
                            suggested_stop_loss=prev_close,
                            suggested_target=open_p * (1.0 - 2.0 * gap_threshold_pct / 100.0),
                        ))
                    else:
                        signals.append(self._signal(
                            config, c, SignalAction.HOLD.value, 0.5,
                            f"Gap within threshold limits: {gap_pct:.2f}%",
                            {"gap_pct": gap_pct, "prev_close": prev_close}
                        ))
                else:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold (Intraday candle, not gap trigger)",
                        {"prev_close": prev_close}
                    ))
        return signals

    def _signals_previous_day_breakout(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        breakout_pct = self._float_param(config, "breakout_pct", 0.1)
        signals: list[StrategySignal] = []
        candles_with_time = [(c, self._parse_candle_time(c["timestamp"])) for c in candles]
        
        days = {}
        for c, dt in candles_with_time:
            d = dt.date()
            if d not in days:
                days[d] = []
            days[d].append((c, dt))
            
        sorted_dates = sorted(days.keys())
        day_metrics = {}
        
        for d in sorted_dates:
            dc = days[d]
            day_metrics[d] = {
                "high": max(c["high"] for c, _ in dc),
                "low": min(c["low"] for c, _ in dc),
                "close": dc[-1][0]["close"]
            }
            
        in_position = False
        
        for i, d in enumerate(sorted_dates):
            day_candles = days[d]
            if i == 0:
                for c, _ in day_candles:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.0,
                        "Insufficient data (No previous day for breakout level)",
                        {}
                    ))
                continue
                
            prev_d = sorted_dates[i-1]
            prev_m = day_metrics[prev_d]
            pdh = prev_m["high"]
            pdl = prev_m["low"]
            pdc = prev_m["close"]
            
            for index, (c, dt) in enumerate(day_candles):
                close = c["close"]
                if index == 0:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold (First candle of day)",
                        {"prev_day_high": pdh, "prev_day_low": pdl}
                    ))
                    continue
                    
                prev_c, _ = day_candles[index - 1]
                prev_close = prev_c["close"]
                
                trigger_high = pdh * (1.0 + breakout_pct / 100.0)
                trigger_low = pdl * (1.0 - breakout_pct / 100.0)
                
                if not in_position and prev_close <= trigger_high < close:
                    in_position = True
                    signals.append(self._signal(
                        config, c, SignalAction.BUY.value,
                        self._strength(close - trigger_high, pdh - pdl),
                        f"Previous Day High Breakout: close above {trigger_high:.2f}",
                        {"prev_day_high": pdh, "prev_day_low": pdl},
                        invalidation_level=pdh,
                        suggested_stop_loss=pdc,
                        suggested_target=close + (pdh - pdl),
                    ))
                elif in_position and prev_close >= trigger_low > close:
                    in_position = False
                    signals.append(self._signal(
                        config, c, SignalAction.SELL.value,
                        self._strength(trigger_low - close, pdh - pdl),
                        f"Previous Day Low Breakout: close below {trigger_low:.2f}",
                        {"prev_day_high": pdh, "prev_day_low": pdl},
                        invalidation_level=pdl,
                        suggested_stop_loss=pdc,
                        suggested_target=close - (pdh - pdl),
                    ))
                else:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold / Trend following",
                        {"prev_day_high": pdh, "prev_day_low": pdl}
                    ))
        return signals

    def _signals_volume_breakout(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        volume_period = self._int_param(config, "volume_period", 20)
        volume_multiplier = self._float_param(config, "volume_multiplier", 2.0)
        lookback_period = self._int_param(config, "lookback_period", 20)
        
        signals: list[StrategySignal] = []
        volumes = [c["volume"] for c in candles]
        closes = [c["close"] for c in candles]
        
        in_position = False
        
        for i, c in enumerate(candles):
            close = c["close"]
            volume = c["volume"]
            
            if i < max(volume_period, lookback_period):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.0,
                    "Insufficient data for Volume Breakout calculation",
                    {}
                ))
                continue
                
            prev_vols = volumes[i - volume_period : i]
            avg_vol = sum(prev_vols) / volume_period
            
            prev_closes = closes[i - lookback_period : i]
            highest_close = max(prev_closes)
            lowest_close = min(prev_closes)
            
            if volume > avg_vol * volume_multiplier:
                if not in_position and close > highest_close:
                    in_position = True
                    target = close + 2.0 * (close - lowest_close)
                    signals.append(self._signal(
                        config, c, SignalAction.BUY.value,
                        self._strength(volume, avg_vol * volume_multiplier),
                        f"Volume Breakout Bullish: volume {volume:.0f} > {avg_vol * volume_multiplier:.0f}",
                        {"avg_volume": avg_vol, "highest_close": highest_close},
                        invalidation_level=highest_close,
                        suggested_stop_loss=lowest_close,
                        suggested_target=target,
                    ))
                elif in_position and close < lowest_close:
                    in_position = False
                    target = close - 2.0 * (highest_close - close)
                    signals.append(self._signal(
                        config, c, SignalAction.SELL.value,
                        self._strength(volume, avg_vol * volume_multiplier),
                        f"Volume Breakout Bearish: volume {volume:.0f} > {avg_vol * volume_multiplier:.0f}",
                        {"avg_volume": avg_vol, "lowest_close": lowest_close},
                        invalidation_level=lowest_close,
                        suggested_stop_loss=highest_close,
                        suggested_target=target,
                    ))
                else:
                    signals.append(self._signal(
                        config, c, SignalAction.HOLD.value, 0.5,
                        "Hold (High volume but no price breakout)",
                        {"avg_volume": avg_vol}
                    ))
            else:
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    "Hold (Volume below breakout threshold)",
                    {"avg_volume": avg_vol}
                ))
        return signals

    def _signals_index_trend_filter(self, config: StrategyConfig, candles: list[dict]) -> list[StrategySignal]:
        fast_period = self._int_param(config, "fast_period", 9)
        slow_period = self._int_param(config, "slow_period", 21)
        filter_period = self._int_param(config, "filter_period", 200)
        
        if fast_period >= slow_period:
            raise ValueError("fast_period must be less than slow_period")
            
        signals: list[StrategySignal] = []
        closes = [c["close"] for c in candles]
        
        fast_ma = self._indicator_engine.ema(closes, fast_period)
        slow_ma = self._indicator_engine.ema(closes, slow_period)
        filter_ma = self._indicator_engine.ema(closes, filter_period)
        
        in_position = False
        
        for i, c in enumerate(candles):
            close = c["close"]
            f_val = fast_ma[i]
            s_val = slow_ma[i]
            filt_val = filter_ma[i]
            
            if math.isnan(f_val) or math.isnan(s_val) or math.isnan(filt_val):
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.0,
                    "Insufficient data for Index Trend Filter calculation",
                    {}
                ))
                continue
                
            prev_f = fast_ma[i-1]
            prev_s = slow_ma[i-1]
            
            if not in_position and prev_f <= prev_s and f_val > s_val and close > filt_val:
                in_position = True
                signals.append(self._signal(
                    config, c, SignalAction.BUY.value,
                    self._strength(close - filt_val, filt_val * 0.01),
                    f"Index Trend Filter Bullish: MA crossover confirmed above EMA {filter_period}",
                    {"fast_ma": f_val, "slow_ma": s_val, "filter_ma": filt_val},
                    invalidation_level=filt_val,
                    suggested_stop_loss=filt_val,
                    suggested_target=close + 2.0 * (close - s_val),
                ))
            elif in_position and prev_f >= prev_s and f_val < s_val:
                in_position = False
                signals.append(self._signal(
                    config, c, SignalAction.SELL.value,
                    self._strength(s_val - f_val, s_val * 0.01),
                    f"Index Trend Filter Bearish exit: MA crossover below",
                    {"fast_ma": f_val, "slow_ma": s_val, "filter_ma": filt_val},
                    invalidation_level=filt_val,
                    suggested_stop_loss=filt_val,
                    suggested_target=close - 2.0 * (s_val - close),
                ))
            else:
                signals.append(self._signal(
                    config, c, SignalAction.HOLD.value, 0.5,
                    "Hold / Index Trend filter following",
                    {"fast_ma": f_val, "slow_ma": s_val, "filter_ma": filt_val}
                ))
        return signals

