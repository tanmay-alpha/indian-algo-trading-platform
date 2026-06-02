'use client'

import { BarChart2, Plus, Radio, Search, WifiOff } from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { MobilePage } from '@/components/mobile/mobile-page'
import { WatchlistRow } from '@/components/ui-maet/watchlist-row'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { useTerminalStore, selectActiveWatchlistSymbols } from '@/store/terminal-store'
import { getNseMarketSession } from '@/lib/utils'

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const setSelectedSymbol = useTerminalStore((s) => s.setSelectedSymbol)
  const marketWatch = useTerminalStore((s) => s.marketWatch)
  const symbols = useTerminalStore(selectActiveWatchlistSymbols)
  const session = getNseMarketSession()
  const topSymbols = symbols.slice(0, 5)
  const backendOffline = apiStatus !== 'ONLINE'

  return (
    <MobilePage className="space-y-5 pb-4">
      <section className="reflection-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold leading-tight text-maet-text">Market desk</h1>
            <p className="mt-1 text-sm leading-6 text-maet-text-secondary">
              Start with a symbol, review the chart, then validate paper parameters.
            </p>
          </div>
          <StatusBadge tone={session === 'OPEN' ? 'success' : 'warning'} dot>
            {session === 'OPEN' ? 'Market open' : session.replace(/_/g, ' ')}
          </StatusBadge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StateTile label="Backend" value={apiStatus === 'ONLINE' ? 'Online' : 'Offline'} good={apiStatus === 'ONLINE'} />
          <StateTile label="Stream" value={wsStatus === 'CONNECTED' ? 'Connected' : wsStatus} good={wsStatus === 'CONNECTED'} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-maet-text">Mini watchlist</h2>
          <button
            type="button"
            onClick={() => onNavigate('watchlist')}
            className="glass-button h-9 px-3 text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            Add Symbol
          </button>
        </div>

        {backendOffline && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-maet-amber/25 bg-maet-amber/10 px-3 py-2 text-xs font-semibold text-maet-amber">
            <WifiOff className="h-4 w-4" />
            Backend offline - symbol names only until quotes arrive.
          </div>
        )}

        <div className="space-y-2">
          {topSymbols.map((symbol) => {
            const row = marketWatch[symbol]
            const clean = symbol.split(':').pop()?.replace(/-EQ$/, '') ?? symbol
            return (
              <WatchlistRow
                key={symbol}
                symbol={symbol}
                name={row?.name ?? clean}
                exchange={row?.exchange ?? 'NSE'}
                price={row?.ltp ?? null}
                changePct={row?.change_pct ?? null}
                offline={backendOffline || row?.ltp == null}
                selected={selectedSymbol === symbol}
                onOpen={() => {
                  setSelectedSymbol(symbol)
                  onNavigate('chart')
                }}
              />
            )
          })}
          {topSymbols.length === 0 && (
            <div className="reflection-card p-6 text-center">
              <Search className="mx-auto h-6 w-6 text-maet-text-muted" />
              <div className="mt-3 text-sm font-bold text-maet-text">Add symbols to your watchlist</div>
              <button
                type="button"
                onClick={() => onNavigate('watchlist')}
                className="maet-btn maet-btn-primary mt-4 h-10 px-4 text-xs"
              >
                <Plus className="h-4 w-4" />
                Add Symbol
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <QuickAction label="Open Chart" icon={<BarChart2 className="h-5 w-5" />} onClick={() => onNavigate('chart')} />
        <QuickAction label="System" icon={<Radio className="h-5 w-5" />} onClick={() => onNavigate('system')} />
      </section>
    </MobilePage>
  )
}

function StateTile({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="rounded-2xl border border-maet-glass-border bg-maet-bg-deep/38 px-3 py-2 shadow-inner">
      <div className="text-xs text-maet-text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2 font-mono text-xs font-bold text-maet-text">
        <span className={good ? 'h-1.5 w-1.5 rounded-full bg-maet-green' : 'h-1.5 w-1.5 rounded-full bg-maet-red'} />
        {value}
      </div>
    </div>
  )
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="reflection-card flex min-h-12 items-center justify-center gap-2 text-sm font-bold text-maet-text-secondary hover-glass"
    >
      <span className="text-maet-blue">{icon}</span>
      {label}
    </button>
  )
}
