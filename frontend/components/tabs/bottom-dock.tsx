'use client'

import {
  Bell,
  Briefcase,
  Heart,
  History,
  Radio,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTerminalStore } from '@/store/terminal-store'
import { DOCK_TABS } from '@/lib/constants'
import type { DockTabId } from '@/lib/types'
import { cn, fmtPrice, fmtTime } from '@/lib/utils'
import { EmptyState } from '@/components/terminal/empty-state'

const ICONS: Record<DockTabId, ReactNode> = {
  orders: <ShoppingCart className="w-3.5 h-3.5" />,
  positions: <TrendingUp className="w-3.5 h-3.5" />,
  holdings: <WalletCards className="w-3.5 h-3.5" />,
  trades: <History className="w-3.5 h-3.5" />,
  pnl: <Briefcase className="w-3.5 h-3.5" />,
  signals: <Radio className="w-3.5 h-3.5" />,
  events: <Bell className="w-3.5 h-3.5" />,
  'system-health': <Heart className="w-3.5 h-3.5" />,
}

export function BottomDock() {
  const tab = useTerminalStore((s) => s.bottomDockTab)
  const setTab = useTerminalStore((s) => s.setBottomDockTab)

  return (
    <section className="h-dock shrink-0 border-t border-border bg-bg-2 flex flex-col">
      <div className="h-8 flex items-center border-b border-border overflow-x-auto">
        {DOCK_TABS.map((dockTab) => (
          <button
            key={dockTab.id}
            onClick={() => setTab(dockTab.id)}
            className={cn(
              'h-8 px-3 flex items-center gap-1.5 border-r border-border border-b-2 text-2xs font-mono uppercase tracking-wider transition-colors',
              tab === dockTab.id
                ? 'text-info bg-info/[0.07] border-b-info'
                : 'text-text-dim border-b-transparent hover:text-text hover:bg-white/[0.03]'
            )}
          >
            {ICONS[dockTab.id]}
            {dockTab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'orders' && <NoRows title="NO ORDERS" hint="Order placement is disabled in this build." />}
        {tab === 'positions' && <NoRows title="NO POSITIONS" hint="Positions will appear only after paper execution is wired." />}
        {tab === 'holdings' && <NoRows title="NO HOLDINGS" hint="Holdings endpoint is not connected yet." />}
        {tab === 'trades' && <NoRows title="NO TRADES" hint="Trade history is empty." />}
        {tab === 'pnl' && <PnLContent />}
        {tab === 'signals' && <SignalsContent />}
        {tab === 'events' && <EventsContent />}
        {tab === 'system-health' && <HealthContent />}
      </div>
    </section>
  )
}

function NoRows({ title, hint }: { title: string; hint: string }) {
  return <EmptyState title={title} hint={hint} compact />
}

function PnLContent() {
  const portfolio = useTerminalStore((s) => s.portfolio)
  if (!portfolio) {
    return <NoRows title="PNL UNAVAILABLE" hint="No backend PnL snapshot has been received." />
  }
  const rows = [
    ['Unrealised', fmtPrice(portfolio.unrealized_pnl)],
    ['Realised', fmtPrice(portfolio.realized_pnl)],
    ['Capital', fmtPrice(portfolio.current_capital)],
    ['Trades', String(portfolio.total_trades)],
  ]
  return <KeyValueGrid rows={rows} />
}

function SignalsContent() {
  const signals = useTerminalStore((s) => s.signals)
  if (signals.length === 0) {
    return <NoRows title="NO SIGNALS" hint="Strategy signals from the event stream will appear here." />
  }
  return (
    <div className="p-2 space-y-1 font-mono">
      {signals.slice(0, 20).map((signal, index) => (
        <div key={`${signal.symbol}-${signal.ts ?? index}`} className="h-7 px-2 flex items-center gap-3 border border-border bg-panel/70">
          <span className="w-24 text-xs text-text">{signal.symbol}</span>
          <span className={cn('w-14 text-2xs', signal.action === 'BUY' ? 'text-up' : signal.action === 'SELL' ? 'text-down' : 'text-text-dim')}>
            {signal.action}
          </span>
          <span className="flex-1 text-2xs text-text-dim truncate">{signal.reason ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

function EventsContent() {
  const events = useTerminalStore((s) => s.events)
  if (events.length === 0) {
    return <NoRows title="NO EVENTS" hint="System events and unknown WebSocket envelopes will appear here." />
  }
  return (
    <div className="p-2 space-y-1 font-mono text-2xs">
      {events.slice(0, 40).map((event) => (
        <div key={event.id} className="px-2 py-1 flex items-start gap-2 border border-border/60 bg-panel/60">
          <span className="w-20 shrink-0 text-text-faint">{fmtTime(event.ts)}</span>
          <span className="w-20 shrink-0 text-info">{event.component ?? event.event_type}</span>
          <span className={cn('w-16 shrink-0 uppercase', severityClass(event.severity))}>{event.severity}</span>
          <span className="flex-1 text-text-2">{event.message}</span>
        </div>
      ))}
    </div>
  )
}

function HealthContent() {
  const status = useTerminalStore((s) => s.terminalStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const rows = [
    ['Broker', broker?.logged_in ? 'ONLINE' : broker ? 'OFFLINE' : '—'],
    ['Feed', broker?.feed_token_available ? 'AVAILABLE' : broker ? 'UNAVAILABLE' : '—'],
    ['EventBus', String(status?.event_bus?.total ?? '—')],
    ['TickBus Drop', status?.tick_bus?.drop_rate_pct == null ? '—' : `${status.tick_bus.drop_rate_pct.toFixed(2)}%`],
  ]
  return <KeyValueGrid rows={rows} />
}

function KeyValueGrid({ rows }: { rows: string[][] }) {
  return (
    <div className="p-3 grid grid-cols-4 gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="border border-border bg-panel/70 rounded-sm p-2">
          <div className="text-[9px] font-mono uppercase tracking-wider text-text-faint">{label}</div>
          <div className="mt-1 text-xs font-mono text-text">{value}</div>
        </div>
      ))}
    </div>
  )
}

function severityClass(severity: string) {
  if (severity === 'success') return 'text-up'
  if (severity === 'warning') return 'text-warn'
  if (severity === 'error') return 'text-down'
  return 'text-info'
}
