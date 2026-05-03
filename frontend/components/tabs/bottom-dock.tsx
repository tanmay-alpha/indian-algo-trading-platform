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
    <section className="h-dock shrink-0 border-t border-border bg-bg-2 flex flex-col shadow-panel">
      <div className="h-9 flex items-center border-b border-border overflow-x-auto bg-panel/30">
        {DOCK_TABS.map((dockTab) => (
          <button
            key={dockTab.id}
            onClick={() => setTab(dockTab.id)}
            className={cn(
              'h-9 px-3 flex items-center gap-1.5 border-r border-border border-b-2 text-2xs font-medium transition-colors',
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
        {tab === 'orders' && <TableEmpty title="No orders yet" hint="Order execution is disabled in this build." columns={['Time', 'Symbol', 'Side', 'Qty', 'Status']} />}
        {tab === 'positions' && <TableEmpty title="No positions connected" hint="Paper portfolio and broker reconciliation will appear here." columns={['Symbol', 'Qty', 'Avg', 'LTP', 'PnL']} />}
        {tab === 'holdings' && <TableEmpty title="No holdings connected" hint="Holdings endpoint is not connected yet." columns={['Symbol', 'Qty', 'Avg', 'LTP', 'PnL']} />}
        {tab === 'trades' && <TableEmpty title="No trades" hint="Trade history is empty." columns={['Time', 'Symbol', 'Side', 'Qty', 'Price']} />}
        {tab === 'pnl' && <PnLContent />}
        {tab === 'signals' && <SignalsContent />}
        {tab === 'events' && <EventsContent />}
        {tab === 'system-health' && <HealthContent />}
      </div>
    </section>
  )
}

function TableEmpty({
  title,
  hint,
  columns,
}: {
  title: string
  hint: string
  columns: string[]
}) {
  return (
    <div className="h-full flex flex-col">
      <div className="h-7 grid grid-cols-5 gap-2 px-3 items-center border-b border-border bg-bg text-[9px] font-mono uppercase tracking-wider text-text-faint">
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="flex-1 grid place-items-center">
        <EmptyState title={title} hint={hint} compact />
      </div>
    </div>
  )
}

function NoRows({ title, hint }: { title: string; hint: string }) {
  return <EmptyState title={title} hint={hint} compact />
}

function PnLContent() {
  const portfolio = useTerminalStore((s) => s.portfolio)
  if (!portfolio) {
    return <NoRows title="No PnL data connected" hint="PnL requires portfolio and event integration." />
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
          <span className="flex-1 text-2xs text-text-dim truncate">{signal.reason ?? '\u2014'}</span>
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
    <div className="h-full flex flex-col font-mono text-2xs">
      <div className="h-7 grid grid-cols-[86px_84px_84px_1fr_70px] gap-2 px-3 items-center border-b border-border bg-bg uppercase tracking-wider text-text-faint">
        <span>Time</span>
        <span>Type</span>
        <span>Component</span>
        <span>Message</span>
        <span>State</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {events.slice(0, 40).map((event) => (
        <div key={event.id} className="min-h-7 px-2 py-1 grid grid-cols-[78px_76px_84px_1fr_64px] gap-2 items-start border border-border/60 bg-panel/60 rounded-sm">
          <span className="text-text-faint">{fmtTime(event.ts)}</span>
          <span className="text-info">{event.event_type}</span>
          <span className="text-text-dim">{event.component ?? 'UI'}</span>
          <span className="text-text-2">{event.message}</span>
          <span className={cn('uppercase', severityClass(event.severity))}>{event.severity}</span>
        </div>
      ))}
      </div>
    </div>
  )
}

function HealthContent() {
  const status = useTerminalStore((s) => s.terminalStatus)
  const broker = useTerminalStore((s) => s.brokerStatus)
  const wsConnected = useTerminalStore((s) => s.wsConnected)
  const rows = [
    ['API', status ? 'ONLINE' : '\u2014'],
    ['WebSocket', wsConnected ? 'ONLINE' : 'OFFLINE'],
    ['Broker', broker?.logged_in ? 'ONLINE' : broker ? 'OFFLINE' : '\u2014'],
    ['Feed', broker?.feed_token_available ? 'AVAILABLE' : broker ? 'WAITING' : '\u2014'],
    ['EventBus', String(status?.event_bus?.total ?? '\u2014')],
    ['TickBus Drop', status?.tick_bus?.drop_rate_pct == null ? '\u2014' : `${status.tick_bus.drop_rate_pct.toFixed(2)}%`],
    ['Candle Engine', status?.candles ? 'READY' : '\u2014'],
    ['Frontend', 'READY'],
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
