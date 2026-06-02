'use client'

import { useState, useEffect } from 'react'
import { BarChart2, ShieldCheck, ExternalLink } from 'lucide-react'
import { useTerminalStore, indicatorKey } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import { getTradingViewChartUrl, getAngelOneChartUrl } from '@/lib/symbol-links'
import { OrderTicket } from '@/components/terminal/order-ticket'
import { MobilePage } from '@/components/mobile/mobile-page'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { ChartFrame } from '@/components/ui-maet/chart-frame'
import { MobileActionSheet } from '@/components/mobile/mobile-action-sheet'
import { mapLineSeries, mapMacdSeries } from '@/lib/indicator-series'
import { IndicatorChartShell } from '@/components/chart/indicator-chart-shell'
import { RsiPanel } from '@/components/chart/rsi-panel'
import { MacdPanel } from '@/components/chart/macd-panel'
import type { Timeframe } from '@/lib/types'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '1d']

export function ChartScreen() {
  const selectedSymbol         = useTerminalStore((s) => s.selectedSymbol)
  const selectedExchange       = useTerminalStore((s) => s.selectedExchange)
  const selectedInstrumentName = useTerminalStore((s) => s.selectedInstrumentName)
  const currentTick            = useTerminalStore((s) => s.currentTick)
  const marketWatch            = useTerminalStore((s) => s.marketWatch)

  const chartTimeframe        = useTerminalStore((s) => s.chartTimeframe)
  const setChartTimeframe     = useTerminalStore((s) => s.setChartTimeframe)
  const chartOverlays         = useTerminalStore((s) => s.chartOverlays)
  const indicatorSubpanels    = useTerminalStore((s) => s.indicatorSubpanels)
  const toggleChartOverlay    = useTerminalStore((s) => s.toggleChartOverlay)
  const toggleIndicatorSubpanel = useTerminalStore((s) => s.toggleIndicatorSubpanel)
  const indicatorResultsByKey = useTerminalStore((s) => s.indicatorResultsBySymbolTimeframe)
  const chartCandlesByKey     = useTerminalStore((s) => s.chartCandlesBySymbolTimeframe)
  const indicatorLoading      = useTerminalStore((s) => s.indicatorChartLoading)
  const chartSignalMarkers    = useTerminalStore((s) => s.chartSignalMarkers)
  const apiStatus             = useTerminalStore((s) => s.apiStatus)
  const backendWakeState      = useTerminalStore((s) => s.backendWakeState)
  const fetchChartIndicators  = useTerminalStore((s) => s.fetchChartIndicators)

  const [showOrderSheet, setShowOrderSheet] = useState(false)

  // Fetch candles on symbol / timeframe change
  useEffect(() => {
    if (selectedSymbol) {
      void fetchChartIndicators(selectedSymbol, chartTimeframe)
    }
  }, [selectedSymbol, chartTimeframe, fetchChartIndicators])

  const chartKey        = selectedSymbol ? indicatorKey(selectedSymbol, chartTimeframe) : null
  const indicatorResults = chartKey ? indicatorResultsByKey[chartKey] : undefined
  const candles         = chartKey ? chartCandlesByKey[chartKey] || [] : []
  const rsiPoints       = mapLineSeries(candles, indicatorResults?.results.rsi)
  const macdPoints      = mapMacdSeries(candles, indicatorResults?.results.macd)

  const row          = selectedSymbol ? marketWatch[selectedSymbol] : null
  const ltp          = row?.ltp ?? currentTick?.ltp ?? null
  const chgPct       = row?.change_pct ?? null
  const isUp         = (chgPct ?? 0) > 0
  const cleanSym     = selectedSymbol?.split(':').pop()?.split('-')[0] ?? selectedSymbol
  // Use store-level exchange/name (set on instrument select) or fall back to backend tick data.
  const displayExchange = selectedExchange ?? row?.exchange ?? 'NSE'
  const displayName     = selectedInstrumentName ?? row?.name ?? 'INDEX / STOCK'

  // Build external chart URLs from the existing symbol-links helpers
  const tvUrl = selectedSymbol
    ? getTradingViewChartUrl(selectedSymbol, displayExchange)
    : '#'
  const aoUrl = getAngelOneChartUrl(selectedSymbol ?? '', displayExchange)

  return (
    <MobilePage className="flex flex-col h-full pb-4 space-y-4">
      {/* Symbol header */}
      <div className="shrink-0">
        {selectedSymbol ? (
          <div className="flex items-center justify-between bg-white/[0.015] border border-white/[0.04] p-3 rounded-2xl">
            <div>
              <h2 className="text-base font-extrabold text-text tracking-wide leading-tight">
                {cleanSym}
              </h2>
              <div className="text-[10px] text-text-faint font-semibold uppercase tracking-wider mt-0.5">
                {displayExchange} · {displayName}
              </div>
            </div>
            {ltp != null ? (
              <div className="text-right">
                <div className={cn('text-lg font-bold font-mono tracking-tight leading-none', isUp ? 'text-[#16C784]' : 'text-[#EA3943]')}>
                  ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {chgPct != null && (
                  <div className={cn('text-[11px] font-bold font-mono mt-1', isUp ? 'text-[#16C784]' : 'text-[#EA3943]')}>
                    {isUp ? '+' : ''}{chgPct.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : (
              <div className="text-right">
                <div className="text-[11px] text-text-faint font-semibold tracking-wider uppercase">No Real-Time Tick</div>
                <div className="text-[10px] text-text-faint font-medium">Historical feeds only</div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl text-center">
            <span className="text-xs text-text-dim font-medium">Select a symbol from the Watchlist to view analysis</span>
          </div>
        )}
      </div>

      {/* ── External Chart Handoffs ── */}
      <div className="shrink-0">
        <SectionTitle title="View On" />
        <div className="flex gap-2 flex-wrap">
          {/* TradingView */}
          <a
            href={selectedSymbol ? tvUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={selectedSymbol ? `Open ${cleanSym} in TradingView` : 'Select a symbol to open TradingView'}
            aria-disabled={!selectedSymbol}
            tabIndex={selectedSymbol ? 0 : -1}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150',
              selectedSymbol
                ? 'bg-[#2962FF]/10 text-[#4F80FF] border-[#2962FF]/25 hover:bg-[#2962FF]/15 active:scale-[0.97]'
                : 'bg-white/[0.02] text-text-faint border-white/[0.04] pointer-events-none opacity-40 cursor-not-allowed'
            )}
          >
            {/* TradingView logo mark (TV "pill" shape) */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 5v8h2v-4l2 4h2l2-4v4h2V8h-2l-3 6-3-6H7z" />
            </svg>
            TradingView
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
          </a>

          {/* Angel One */}
          <a
            href={selectedSymbol ? aoUrl : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={selectedSymbol ? `Open ${cleanSym} in Angel One` : 'Select a symbol to open Angel One'}
            aria-disabled={!selectedSymbol}
            tabIndex={selectedSymbol ? 0 : -1}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-150',
              selectedSymbol
                ? 'bg-[#F05822]/10 text-[#F07040] border-[#F05822]/25 hover:bg-[#F05822]/15 active:scale-[0.97]'
                : 'bg-white/[0.02] text-text-faint border-white/[0.04] pointer-events-none opacity-40 cursor-not-allowed'
            )}
          >
            {/* Angel One flame-like icon */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="shrink-0"
            >
              <path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12zm0 18a4 4 0 0 1-4-4c0-2.5 1.5-4.5 4-8 2.5 3.5 4 5.5 4 8a4 4 0 0 1-4 4z" />
            </svg>
            Angel One
            <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
          </a>

          {/* Safety note */}
          {!selectedSymbol && (
            <span className="self-center text-[10px] text-text-faint font-medium ml-1">
              Select a symbol from Watchlist to open external charts.
            </span>
          )}
        </div>

        {/* Honesty label */}
        <p className="mt-2 text-xs text-text-faint font-medium leading-snug">
          External charts open in third-party platforms.{' '}
          <span className="text-[#F59E0B] font-semibold">MAET remains paper&nbsp;/&nbsp;read-only.</span>{' '}
          No orders are placed from MAET.
        </p>
      </div>

      {/* Timeframe selector */}
      <div className="shrink-0">
        <SectionTitle title="Timeframe" />
        <div className="flex gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setChartTimeframe(tf)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
                chartTimeframe === tf
                  ? 'bg-[#22D3EE]/10 text-[#22D3EE] border-[#22D3EE]/30'
                  : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
              )}
              type="button"
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <ChartFrame className="flex min-h-[300px] lg:min-h-[260px] xl:min-h-[300px] flex-grow flex-col relative">
        {selectedSymbol ? (
          <div className="flex flex-col flex-grow min-h-0">
            <div className="flex-grow min-h-0 relative">
              {candles.length === 0 && !indicatorLoading ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
                  <BarChart2 className="w-8 h-8 text-text-faint opacity-40" />
                  <div>
                    <div className="text-xs font-bold text-text-dim uppercase tracking-wider">No Candle Data</div>
                    <div className="text-[11px] text-text-faint mt-1 leading-normal max-w-[200px]">
                      {apiStatus === 'OFFLINE'
                        ? 'Backend offline — cannot fetch historical data.'
                        : `No ${chartTimeframe} candles found for ${cleanSym}. Market may be closed or data unavailable.`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => selectedSymbol && void fetchChartIndicators(selectedSymbol, chartTimeframe)}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-[#22D3EE]/10 text-[#22D3EE] border border-[#22D3EE]/20 font-semibold hover:bg-[#22D3EE]/15 transition-all"
                      type="button"
                    >
                      Retry Fetch
                    </button>
                    {/* Quick-access TV link in empty state */}
                    <a
                      href={tvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-[#2962FF]/10 text-[#4F80FF] border border-[#2962FF]/20 font-semibold hover:bg-[#2962FF]/15 transition-all flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      TradingView
                    </a>
                  </div>
                </div>
              ) : (
                <IndicatorChartShell
                  symbol={selectedSymbol}
                  timeframe={chartTimeframe}
                  candles={candles}
                  result={indicatorResults}
                  overlays={chartOverlays}
                  signalMarkers={chartSignalMarkers}
                  apiStatus={apiStatus}
                  backendWakeState={backendWakeState}
                  isFetching={indicatorLoading}
                  onFetchCandles={
                    selectedSymbol
                      ? () => {
                          void fetchChartIndicators(selectedSymbol, chartTimeframe)
                        }
                      : undefined
                  }
                />
              )}
            </div>
            {indicatorSubpanels.rsi && (
              <div className="shrink-0">
                <RsiPanel points={rsiPoints} />
              </div>
            )}
            {indicatorSubpanels.macd && (
              <div className="shrink-0">
                <MacdPanel points={macdPoints} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
            <BarChart2 className="w-10 h-10 text-text-faint mb-3 opacity-60" />
            <h3 className="text-xs font-bold text-text-dim uppercase tracking-wider">No Symbol Selected</h3>
            <p className="text-[11px] text-text-faint max-w-[200px] mt-1.5 leading-normal font-medium">
              Select a symbol from the Watchlist tab to view candles and technical indicators.
            </p>
          </div>
        )}
      </ChartFrame>

      {/* Technical Indicators */}
      <div className="shrink-0">
        <SectionTitle title="Technical Indicators" />
        <div className="flex flex-wrap gap-2">
          {/* EMA */}
          <button
            onClick={() => toggleChartOverlay('ema')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
              chartOverlays.ema
                ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
            )}
            type="button"
          >
            EMA
          </button>

          {/* VWAP */}
          <button
            onClick={() => toggleChartOverlay('vwap')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
              chartOverlays.vwap
                ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
            )}
            type="button"
          >
            VWAP
          </button>

          {/* Bollinger Bands */}
          <button
            onClick={() => toggleChartOverlay('bollinger_bands')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
              chartOverlays.bollinger_bands
                ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
            )}
            type="button"
          >
            Bollinger Bands
          </button>

          {/* RSI */}
          <button
            onClick={() => toggleIndicatorSubpanel('rsi')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
              indicatorSubpanels.rsi
                ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
            )}
            type="button"
          >
            RSI
          </button>

          {/* MACD */}
          <button
            onClick={() => toggleIndicatorSubpanel('macd')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150',
              indicatorSubpanels.macd
                ? 'bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]/30'
                : 'bg-white/[0.03] text-text-dim border-white/[0.06] hover:bg-white/[0.05]'
            )}
            type="button"
          >
            MACD
          </button>
        </div>
      </div>

      {/* Dry-run order action */}
      <div className="shrink-0 pt-2">
        <button
          onClick={() => selectedSymbol && setShowOrderSheet(true)}
          disabled={!selectedSymbol}
          className={cn(
            "w-full h-12 rounded-2xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 border transition-all duration-150",
            selectedSymbol
              ? "bg-[#F59E0B]/10 hover:bg-[#F59E0B]/15 border-[#F59E0B]/30 text-[#F59E0B] shadow-[0_4px_16px_rgba(245,158,11,0.05)] active:scale-[0.985]"
              : "bg-white/[0.02] border-white/[0.05] text-text-faint cursor-not-allowed opacity-50"
          )}
          type="button"
        >
          <ShieldCheck className="w-4 h-4" />
          {selectedSymbol ? `Validate Dry-Run Order · ${cleanSym}` : 'Validate Dry-Run Order'}
        </button>
      </div>

      {/* Action sheet containing OrderTicket */}
      <MobileActionSheet
        isOpen={showOrderSheet}
        onClose={() => setShowOrderSheet(false)}
        title={`Dry-Run Order Ticket: ${cleanSym}`}
      >
        <div className="h-[64dvh] min-h-[420px]">
          <OrderTicket />
        </div>
      </MobileActionSheet>
    </MobilePage>
  )
}
