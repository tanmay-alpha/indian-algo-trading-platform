'use client'

import { useState } from 'react'
import {
  ShoppingCart,
  BarChart2,
  Briefcase,
  History,
  TrendingUp,
  Radio,
  Bell,
  Heart,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { formatTime, cn } from '@/lib/utils'
import { DOCK_TABS } from '@/lib/constants'

const TAB_ICONS: Record<string, React.ReactNode> = {
  orders: <ShoppingCart className="w-3.5 h-3.5" />,
  positions: <BarChart2 className="w-3.5 h-3.5" />,
  holdings: <Briefcase className="w-3.5 h-3.5" />,
  trades: <History className="w-3.5 h-3.5" />,
  pnl: <TrendingUp className="w-3.5 h-3.5" />,
  signals: <Radio className="w-3.5 h-3.5" />,
  events: <Bell className="w-3.5 h-3.5" />,
  health: <Heart className="w-3.5 h-3.5" />,
}

export function DockTabs() {
  const [activeTab, setActiveTab] = useState('orders')
  const { logs, portfolio, gatewayStatus } = useTerminalStore()

  return (
    <div className="h-48 flex flex-col glass border-t border-border">
      {/* Tab Headers */}
      <div className="flex items-center border-b border-border overflow-x-auto">
        {DOCK_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium shrink-0 transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-accent border-accent bg-accent/5'
                : 'text-text-dim border-transparent hover:text-text-main hover:bg-white/5'
            )}
          >
            {TAB_ICONS[tab.id]}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'orders' && <OrdersTabContent />}
        {activeTab === 'positions' && <PositionsTabContent />}
        {activeTab === 'holdings' && <PlaceholderContent title="Holdings" />}
        {activeTab === 'trades' && <PlaceholderContent title="Trade History" />}
        {activeTab === 'pnl' && <PnLTabContent portfolio={portfolio} />}
        {activeTab === 'signals' && <PlaceholderContent title="Trading Signals" />}
        {activeTab === 'events' && <EventsTabContent logs={logs} />}
        {activeTab === 'health' && <HealthTabContent status={gatewayStatus} />}
      </div>
    </div>
  )
}

function OrdersTabContent() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-text-dim">
        No orders placed. Order execution is disabled.
      </p>
    </div>
  )
}

function PositionsTabContent() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-text-dim">No open positions.</p>
    </div>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-xs text-text-dim">{title} data will appear here.</p>
    </div>
  )
}

function PnLTabContent({ portfolio }: { portfolio: ReturnType<typeof useTerminalStore>['portfolio'] }) {
  if (!portfolio) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-text-dim">Waiting for portfolio data...</p>
      </div>
    )
  }

  const items = [
    { label: 'Unrealized PnL', value: portfolio.unrealized_pnl, colored: true },
    { label: 'Realized PnL', value: portfolio.realized_pnl, colored: true },
    { label: 'Current Capital', value: portfolio.current_capital, colored: false },
    { label: 'Total Trades', value: portfolio.total_trades, colored: false, isNumber: true },
    { label: 'Win Rate', value: portfolio.win_rate * 100, colored: false, isPercent: true },
    { label: 'Max Drawdown', value: portfolio.max_drawdown, colored: true },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="p-2 rounded bg-white/[0.02] border border-border/50">
          <div className="text-[9px] text-text-dim uppercase mb-1">{item.label}</div>
          <div
            className={cn(
              'font-mono text-sm font-medium',
              item.colored && item.value > 0 && 'text-success',
              item.colored && item.value < 0 && 'text-danger'
            )}
          >
            {item.isNumber
              ? item.value
              : item.isPercent
              ? `${item.value.toFixed(1)}%`
              : item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      ))}
    </div>
  )
}

function EventsTabContent({ logs }: { logs: ReturnType<typeof useTerminalStore>['logs'] }) {
  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-text-dim">No events logged yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 font-mono text-[10px]">
      {logs.slice(0, 15).map((log, index) => (
        <div
          key={index}
          className={cn(
            'flex items-start gap-2',
            log.type === 'success' && 'text-success',
            log.type === 'error' && 'text-danger',
            log.type === 'warning' && 'text-warning',
            log.type === 'info' && 'text-accent'
          )}
        >
          <span className="text-text-dim shrink-0">[{formatTime(log.timestamp)}]</span>
          <span>{log.message}</span>
        </div>
      ))}
    </div>
  )
}

function HealthTabContent({ status }: { status: ReturnType<typeof useTerminalStore>['gatewayStatus'] }) {
  const items = status
    ? [
        { label: 'Configured', value: status.configured },
        { label: 'Logged In', value: status.logged_in },
        { label: 'Feed Token', value: status.feed_token_available },
        { label: 'WebSocket', value: status.websocket_started },
      ]
    : []

  return (
    <div className="grid grid-cols-4 gap-3">
      {items.length > 0 ? (
        items.map((item) => (
          <div key={item.label} className="p-2 rounded bg-white/[0.02] border border-border/50">
            <div className="text-[9px] text-text-dim uppercase mb-1">{item.label}</div>
            <div
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                item.value ? 'text-success' : 'text-danger'
              )}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  item.value ? 'bg-success' : 'bg-danger'
                )}
              />
              {item.value ? 'OK' : 'FAIL'}
            </div>
          </div>
        ))
      ) : (
        <div className="col-span-4 text-center text-xs text-text-dim py-4">
          Waiting for gateway status...
        </div>
      )}
      {status?.last_error && (
        <div className="col-span-4 p-2 rounded bg-danger/10 border border-danger/20 text-danger text-[10px]">
          Error: {status.last_error}
        </div>
      )}
    </div>
  )
}
