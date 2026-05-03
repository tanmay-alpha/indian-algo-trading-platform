'use client'

import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { formatPrice, cn } from '@/lib/utils'

export function ChartWorkspace() {
  const { currentTick, isConnected } = useTerminalStore()

  const signal = currentTick?.signal || 'NEUTRAL'
  const price = currentTick?.price || 0
  const vwap = currentTick?.vwap || 0
  const priceVsVwap = vwap > 0 ? ((price - vwap) / vwap) * 100 : 0

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Chart Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border glass">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">
            {currentTick?.symbol || 'Chart'}
          </span>
          {currentTick && (
            <span className="font-mono text-lg font-semibold">
              {formatPrice(price)}
            </span>
          )}
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          {currentTick && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-dim">VWAP</span>
                <span className="font-mono text-accent">{formatPrice(vwap)}</span>
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 text-xs font-mono',
                  priceVsVwap > 0 ? 'text-success' : priceVsVwap < 0 ? 'text-danger' : 'text-text-dim'
                )}
              >
                {priceVsVwap > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{priceVsVwap >= 0 ? '+' : ''}{priceVsVwap.toFixed(2)}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart Placeholder Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          {/* Animated Grid Background */}
          <div className="relative mb-8">
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 gap-px opacity-10">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="bg-accent/50 rounded-sm" />
              ))}
            </div>
            <div className="relative p-8">
              <Activity className="w-16 h-16 text-accent/30 mx-auto" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-text-main mb-2">
            TradingView Integration Coming Soon
          </h3>
          <p className="text-sm text-text-dim mb-6">
            Advanced charting with real-time candlestick data, technical indicators, and drawing tools will be integrated here.
          </p>

          {/* Live Price Display */}
          {isConnected && currentTick && (
            <div className="inline-flex flex-col items-center gap-3 p-6 rounded-lg bg-panel border border-border">
              <div className="text-xs text-text-dim uppercase tracking-wider">Live Price</div>
              <div className="font-mono text-4xl font-bold text-text-main">
                {formatPrice(price)}
              </div>
              <div
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-semibold uppercase border',
                  signal === 'BUY' && 'bg-success/10 text-success border-success/20',
                  signal === 'SELL' && 'bg-danger/10 text-danger border-danger/20',
                  signal === 'NEUTRAL' && 'bg-white/5 text-text-dim border-white/10'
                )}
              >
                Signal: {signal}
              </div>
            </div>
          )}

          {!isConnected && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded bg-danger/10 text-danger text-sm border border-danger/20">
              <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              Waiting for market data connection...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
