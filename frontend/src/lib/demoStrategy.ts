import type { BacktestResult, StrategyConfig } from '@/lib/types'

export const DEMO_STRATEGY_TEMPLATES = [
  { strategyName: 'ema_crossover', label: 'EMA crossover', params: { fast_period: 9, slow_period: 21 } },
  { strategyName: 'rsi_mean_reversion', label: 'RSI mean-reversion', params: { rsi_period: 14, lower: 30, upper: 70 } },
  { strategyName: 'vwap_pullback', label: 'VWAP pullback', params: { band_bps: 35 } },
  { strategyName: 'macd_trend', label: 'MACD trend', params: { fast: 12, slow: 26, signal: 9 } },
  { strategyName: 'bb_breakout', label: 'BB breakout', params: { period: 20, stddev: 2 } },
] as const

export const DEMO_RELIANCE_CANDLES_5D = [
  { date: '2026-06-03', open: 2811.0, high: 2848.4, low: 2798.2, close: 2839.6, ema9: 2824.4, vwap: 2828.1 },
  { date: '2026-06-04', open: 2840.3, high: 2861.8, low: 2827.6, close: 2854.2, ema9: 2830.3, vwap: 2838.5 },
  { date: '2026-06-05', open: 2852.8, high: 2860.1, low: 2824.7, close: 2831.9, ema9: 2830.6, vwap: 2839.8 },
  { date: '2026-06-08', open: 2832.6, high: 2849.9, low: 2816.4, close: 2845.7, ema9: 2833.6, vwap: 2837.2 },
  { date: '2026-06-09', open: 2846.1, high: 2872.3, low: 2839.8, close: 2864.5, ema9: 2839.8, vwap: 2844.6 },
] as const

export function defaultStrategyConfig(symbol = 'RELIANCE', strategyName: string = DEMO_STRATEGY_TEMPLATES[0].strategyName): StrategyConfig {
  const template = DEMO_STRATEGY_TEMPLATES.find((item) => item.strategyName === strategyName) ?? DEMO_STRATEGY_TEMPLATES[0]
  return {
    strategy_name: template.strategyName,
    symbol,
    timeframe: '5m',
    params: template.params,
    initial_capital: 100000,
    quantity: 10,
    fee_bps: 3,
    slippage_bps: 2,
  }
}

export function generateDemoBacktestResult(config: StrategyConfig): BacktestResult {
  const closes = DEMO_RELIANCE_CANDLES_5D.map((candle) => candle.close)
  const equityCurve = closes.map((close, index) => {
    const base = config.initial_capital || 100000
    const change = (close - closes[0]) * (config.quantity || 10)
    return {
      timestamp: `${DEMO_RELIANCE_CANDLES_5D[index].date}T15:30:00+05:30`,
      equity: Math.round((base + change) * 100) / 100,
      drawdown: index === 2 ? -0.72 : index === 3 ? -0.28 : 0,
    }
  })
  const netPnl = equityCurve[equityCurve.length - 1].equity - equityCurve[0].equity

  return {
    status: 'DEMO',
    strategy_name: config.strategy_name,
    symbol: config.symbol,
    timeframe: config.timeframe,
    engine: 'demo-replay',
    candles_used: DEMO_RELIANCE_CANDLES_5D.length,
    signals: [
      {
        timestamp: `${DEMO_RELIANCE_CANDLES_5D[1].date}T10:05:00+05:30`,
        symbol: config.symbol,
        strategy_name: config.strategy_name,
        action: 'BUY',
        price: DEMO_RELIANCE_CANDLES_5D[1].close,
        strength: 0.72,
        reason: 'Fast trend confirmed above VWAP',
      },
      {
        timestamp: `${DEMO_RELIANCE_CANDLES_5D[4].date}T14:45:00+05:30`,
        symbol: config.symbol,
        strategy_name: config.strategy_name,
        action: 'EXIT',
        price: DEMO_RELIANCE_CANDLES_5D[4].close,
        strength: 0.64,
        reason: 'Target band reached',
      },
    ],
    trades: [
      {
        entry_time: `${DEMO_RELIANCE_CANDLES_5D[1].date}T10:05:00+05:30`,
        exit_time: `${DEMO_RELIANCE_CANDLES_5D[4].date}T14:45:00+05:30`,
        symbol: config.symbol,
        side: 'LONG',
        quantity: config.quantity || 10,
        entry_price: DEMO_RELIANCE_CANDLES_5D[1].close,
        exit_price: DEMO_RELIANCE_CANDLES_5D[4].close,
        gross_pnl: 103,
        fees: 17.14,
        slippage: 11.42,
        net_pnl: Math.round(netPnl * 100) / 100,
        return_pct: 1.04,
        exit_reason: 'target_band',
      },
    ],
    equity_curve: equityCurve,
    metrics: {
      total_trades: 4,
      winning_trades: 3,
      losing_trades: 1,
      win_rate: 75,
      gross_pnl: 612.3,
      net_pnl: Math.round(netPnl * 100) / 100,
      total_fees: 72.4,
      total_slippage: 48.2,
      total_return_pct: 1.04,
      max_drawdown: -0.72,
      profit_factor: 2.18,
      average_win: 188.4,
      average_loss: -72.8,
    },
    reason: 'Demo mode: backend unavailable or cold-starting',
  }
}
