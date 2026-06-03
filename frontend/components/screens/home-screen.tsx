'use client'

import { BarChart2, Brain, Briefcase, ListChecks, Plus, Radio, Search, ShieldCheck } from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { MobilePage } from '@/components/mobile/mobile-page'
import { WatchlistRow } from '@/components/ui-maet/watchlist-row'
import { useTerminalStore, selectActiveWatchlistSymbols } from '@/store/terminal-store'
import { useMarketSession } from '@/lib/use-market-session'

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
  const session = useMarketSession()
  const topSymbols = symbols.slice(0, 5)
  const marketDataUnavailable = apiStatus !== 'ONLINE'
  const feedLabel = apiStatus === 'ONLINE' || wsStatus === 'CONNECTED' ? 'Available' : 'Waiting'
  const sessionLabel = session === 'OPEN' ? 'Open' : session.replace(/_/g, ' ')

  return (
    <MobilePage className="space-y-4 pb-4">
      <section className="maet-glass-strong overflow-hidden p-4 shadow-card">
        <div className="maet-subtle-grid rounded-2xl border border-white/10 bg-maet-ink-950/42 p-4">
          <div className="max-w-2xl">
            <h1 className="font-heading text-3xl font-extrabold leading-tight text-maet-text sm:text-4xl">Start your market desk.</h1>
            <p className="mt-2 text-sm leading-6 text-maet-text-secondary sm:text-base">
              Search a symbol, open the chart workspace, and validate paper parameters without enabling broker execution.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('watchlist')}
              className="maet-btn maet-btn-primary h-11 px-4 text-sm"
            >
              <Search className="h-4 w-4" />
              Search symbols
            </button>
            <button
              type="button"
              onClick={() => onNavigate('chart')}
              className="glass-button h-11 px-4 text-sm"
            >
              <BarChart2 className="h-4 w-4" />
              Open chart workspace
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StateTile label="Market session" value={sessionLabel} state={session === 'OPEN' ? 'good' : 'waiting'} />
          <StateTile label="Data feed" value={feedLabel} state={feedLabel === 'Available' ? 'good' : 'waiting'} />
          <StateTile label="Safety" value="Live locked" state="locked" />
        </div>
      </section>

      <section className="maet-glass p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold text-maet-text">Market shortlist</h2>
            <p className="text-xs text-maet-text-muted">Pick a symbol from Watchlist to begin.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('watchlist')}
            className="glass-button h-9 px-3 text-xs"
          >
            <Search className="h-3.5 w-3.5" />
            Add Symbol
          </button>
        </div>

        {marketDataUnavailable && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-maet-amber/25 bg-maet-amber/10 px-3 py-2 text-xs font-semibold text-maet-amber">
            <Radio className="h-4 w-4" />
            Quotes may be waiting outside market or feed conditions. Symbol research remains available.
          </div>
        )}

        <div className="space-y-1.5">
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
                volume={row?.volume ?? null}
                offline={marketDataUnavailable || row?.ltp == null}
                selected={selectedSymbol === symbol}
                onOpen={() => {
                  setSelectedSymbol(symbol)
                  onNavigate('chart')
                }}
              />
            )
          })}
          {topSymbols.length === 0 && (
            <div className="maet-card p-6 text-center">
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

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <QuickAction label="Search NSE/BSE symbols" icon={<Search className="h-5 w-5" />} onClick={() => onNavigate('watchlist')} />
        <QuickAction label="Open chart workspace" icon={<BarChart2 className="h-5 w-5" />} onClick={() => onNavigate('chart')} />
        <QuickAction label="Validate paper order" icon={<ShieldCheck className="h-5 w-5" />} onClick={() => onNavigate('chart')} />
        <QuickAction label="Read-only portfolio" icon={<Briefcase className="h-5 w-5" />} onClick={() => onNavigate('portfolio')} />
        <QuickAction label="AI market notes" icon={<Brain className="h-5 w-5" />} onClick={() => onNavigate('ai')} />
        <QuickAction label="System status" icon={<ListChecks className="h-5 w-5" />} onClick={() => onNavigate('system')} />
      </section>

      <section className="maet-glass border-maet-amber/25 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-maet-amber/30 bg-maet-amber/10 text-maet-amber">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-bold text-maet-text">Paper research mode</h2>
            <p className="mt-1 text-sm leading-6 text-maet-text-muted">
              MAET is running in paper research mode. Live broker actions are disabled.
            </p>
          </div>
        </div>
      </section>
    </MobilePage>
  )
}

function StateTile({ label, value, state }: { label: string; value: string; state: 'good' | 'waiting' | 'locked' }) {
  const dotClass =
    state === 'good'
      ? 'bg-maet-green'
      : state === 'locked'
      ? 'bg-maet-amber'
      : 'bg-maet-blue-soft'
  return (
    <div className="rounded-2xl border border-maet-glass-border bg-maet-bg-deep/40 px-3 py-2 shadow-inner">
      <div className="text-xs text-maet-text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2 font-mono text-xs font-bold text-maet-text">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
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
