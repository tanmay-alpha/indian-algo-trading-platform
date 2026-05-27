'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  Database,
  TrendingUp,
  BarChart2,
  DollarSign,
  BookOpen,
  AlertTriangle,
  Clock,
  CheckCircle,
  WifiOff,
  Wallet,
} from 'lucide-react'
import { cn, fmtPrice } from '@/lib/utils'
import type { BrokerAccountSnapshot, BrokerSessionStatus } from '@/lib/types'
import {
  getBrokerAccountStatus,
  getBrokerAccountSnapshot,
  syncBrokerAccountReadOnly,
} from '@/lib/api'
import { useTerminalStore } from '@/store/terminal-store'

type BrokerTab = 'overview' | 'holdings' | 'positions' | 'orders' | 'trades'

export function BrokerAccountPanel() {
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const [sessionStatus, setSessionStatus] = useState<BrokerSessionStatus | null>(null)
  const [snapshot, setSnapshot] = useState<BrokerAccountSnapshot | null>(null)
  const [tab, setTab] = useState<BrokerTab>('overview')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await getBrokerAccountStatus()
      setSessionStatus(status)
      if (status.is_valid) {
        const snap = await getBrokerAccountSnapshot(adminToken)
        if (snap.ok) {
          setSnapshot(snap.data)
        } else if ('adminRequired' in snap) {
          setError('Admin token required to view broker account data')
        } else {
          setError('Failed to load broker account snapshot')
        }
      }
      setLastRefreshed(Date.now())
    } catch {
      setError('Network error loading broker data')
    } finally {
      setLoading(false)
    }
  }, [adminToken])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncBrokerAccountReadOnly(adminToken)
      if (result.ok) {
        setSnapshot(result.data)
        setLastRefreshed(Date.now())
      } else if ('adminRequired' in result) {
        setError('Admin token required to sync broker account')
      }
    } finally {
      setSyncing(false)
    }
  }

  const isUnavailable =
    !sessionStatus?.is_valid ||
    snapshot?.status === 'BROKER_SESSION_UNAVAILABLE'

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-panel/60">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-text-dim" />
          <span className="text-xs font-semibold text-text">Broker Account</span>
          {sessionStatus && (
            <span className={cn(
              'px-1.5 py-0.5 rounded-sm border text-[9px] font-mono font-semibold',
              sessionStatus.is_valid
                ? 'text-up border-up/30 bg-up/10'
                : 'text-text-faint border-border bg-panel'
            )}>
              {sessionStatus.is_valid ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-info/30 bg-info/10 text-info text-[10px] font-mono hover:bg-info/20 disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3 h-3', syncing && 'animate-spin')} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="h-6 w-6 flex items-center justify-center rounded-sm border border-border bg-bg text-text-dim hover:text-text disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Unavailable state */}
      {isUnavailable && (
        <div className="m-3 rounded-sm border border-border bg-panel/40 p-4 flex flex-col items-center gap-2 text-center">
          <WifiOff className="w-6 h-6 text-text-faint opacity-50" />
          <div className="text-xs font-mono text-text-faint">Broker session not available</div>
          <div className="text-[9px] text-text-faint opacity-70">
            Authenticate via the broker login flow to enable account monitoring
          </div>
          {sessionStatus?.last_error && (
            <div className="text-[9px] font-mono text-down mt-1">{sessionStatus.last_error}</div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !isUnavailable && (
        <div className="mx-3 mt-2 rounded-sm border border-down/30 bg-down/10 px-3 py-1.5 text-[10px] font-mono text-down flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* Tabs */}
      {!isUnavailable && snapshot && (
        <>
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border">
            {(['overview', 'holdings', 'positions', 'orders', 'trades'] as BrokerTab[]).map((t) => (
              <TabPill key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-3">
            {tab === 'overview' && <OverviewTab snapshot={snapshot} />}
            {tab === 'holdings' && <HoldingsTab snapshot={snapshot} />}
            {tab === 'positions' && <PositionsTab snapshot={snapshot} />}
            {tab === 'orders' && <OrdersTab snapshot={snapshot} />}
            {tab === 'trades' && <TradesTab snapshot={snapshot} />}
          </div>
        </>
      )}

      {/* Footer */}
      {lastRefreshed && (
        <div className="px-3 py-1 border-t border-border text-[9px] font-mono text-text-faint opacity-60 flex items-center justify-between">
          <span className="text-[8px] opacity-70">READ-ONLY · NO ORDER PLACEMENT</span>
          <span>
            <Clock className="inline w-2.5 h-2.5 mr-1" />
            {new Date(lastRefreshed).toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  )
}

// ---- Overview ----

function OverviewTab({ snapshot }: { snapshot: BrokerAccountSnapshot }) {
  const f = snapshot.funds
  const holdings_pnl = snapshot.holdings.reduce((s, h) => {
    const pnl = h.ltp != null && h.avg_price != null && h.quantity != null
      ? (h.ltp - h.avg_price) * h.quantity
      : null
    return pnl != null ? s + pnl : s
  }, 0)

  const positions_pnl = snapshot.positions.reduce((s, p) => {
    return p.unrealised_pnl != null ? s + p.unrealised_pnl : s
  }, 0)

  return (
    <div className="space-y-3">
      {/* Funds row */}
      <div className="grid grid-cols-2 gap-2">
        <FundCard label="Available Cash" value={f.available_cash} icon={<DollarSign className="w-3 h-3" />} />
        <FundCard label="Net Worth" value={f.net} icon={<TrendingUp className="w-3 h-3" />} />
        <FundCard label="Used Margin" value={f.used_margin} icon={<BarChart2 className="w-3 h-3" />} />
        <FundCard label="Collateral" value={f.collateral} icon={<Database className="w-3 h-3" />} />
      </div>

      {/* M2M row */}
      <div className="grid grid-cols-2 gap-2">
        <PnlCard label="Holdings P&L" value={holdings_pnl} />
        <PnlCard label="Positions Unr. P&L" value={positions_pnl} />
      </div>

      {/* Summary counts */}
      <div className="rounded-sm border border-border bg-panel/40 px-3 py-2 grid grid-cols-4 gap-3 text-center">
        <CountStat label="Holdings" value={snapshot.holdings.length} />
        <CountStat label="Positions" value={snapshot.positions.length} />
        <CountStat label="Orders" value={snapshot.orders.length} />
        <CountStat label="Trades" value={snapshot.trades.length} />
      </div>

      {/* Source + sync time */}
      <div className="text-[9px] font-mono text-text-faint opacity-60">
        Source: {snapshot.source} · Synced: {new Date(snapshot.synced_at).toLocaleString()}
      </div>
    </div>
  )
}

function FundCard({ label, value, icon }: { label: string; value: number | null; icon: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-panel/50 px-3 py-2 flex items-center gap-2">
      <div className="text-text-faint">{icon}</div>
      <div>
        <div className="text-[8px] uppercase tracking-wider text-text-faint">{label}</div>
        <div className="text-xs font-mono text-text font-semibold">
          {value != null ? `₹${fmtPrice(value)}` : '—'}
        </div>
      </div>
    </div>
  )
}

function PnlCard({ label, value }: { label: string; value: number }) {
  const pos = value >= 0
  return (
    <div className={cn(
      'rounded-sm border px-3 py-2',
      pos ? 'border-up/20 bg-up/5' : 'border-down/20 bg-down/5'
    )}>
      <div className="text-[8px] uppercase tracking-wider text-text-faint">{label}</div>
      <div className={cn('text-xs font-mono font-semibold', pos ? 'text-up' : 'text-down')}>
        {pos ? '+' : ''}₹{fmtPrice(value)}
      </div>
    </div>
  )
}

function CountStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm font-mono font-bold text-text">{value}</div>
      <div className="text-[8px] text-text-faint uppercase tracking-wider">{label}</div>
    </div>
  )
}

// ---- Holdings ----

function HoldingsTab({ snapshot }: { snapshot: BrokerAccountSnapshot }) {
  if (snapshot.holdings.length === 0) {
    return <Empty label="No holdings found" />
  }
  return (
    <table className="w-full text-[10px] font-mono">
      <thead>
        <tr className="text-[8px] uppercase tracking-wider text-text-faint border-b border-border">
          {['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L', 'Exchange'].map((h) => (
            <th key={h} className="text-left py-1 pr-2 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {snapshot.holdings.map((h, i) => {
          const pnl = h.ltp != null && h.avg_price != null && h.quantity != null
            ? (h.ltp - h.avg_price) * h.quantity
            : null
          return (
            <tr key={i} className="border-b border-border/40 hover:bg-panel/40">
              <td className="py-1 pr-2 text-text font-semibold">{h.symbol}</td>
              <td className="py-1 pr-2 text-text">{h.quantity ?? '—'}</td>
              <td className="py-1 pr-2 text-text">{h.avg_price != null ? fmtPrice(h.avg_price) : '—'}</td>
              <td className="py-1 pr-2 text-text">{h.ltp != null ? fmtPrice(h.ltp) : '—'}</td>
              <td className={cn('py-1 pr-2', pnl == null ? 'text-text-faint' : pnl >= 0 ? 'text-up' : 'text-down')}>
                {pnl != null ? `${pnl >= 0 ? '+' : ''}₹${fmtPrice(pnl)}` : '—'}
              </td>
              <td className="py-1 pr-2 text-text-faint">{h.exchange}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ---- Positions ----

function PositionsTab({ snapshot }: { snapshot: BrokerAccountSnapshot }) {
  if (snapshot.positions.length === 0) {
    return <Empty label="No open positions" />
  }
  return (
    <table className="w-full text-[10px] font-mono">
      <thead>
        <tr className="text-[8px] uppercase tracking-wider text-text-faint border-b border-border">
          {['Symbol', 'Net Qty', 'Avg Price', 'LTP', 'Unr. P&L', 'Realised P&L', 'Exchange'].map((h) => (
            <th key={h} className="text-left py-1 pr-2 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {snapshot.positions.map((p, i) => (
          <tr key={i} className="border-b border-border/40 hover:bg-panel/40">
            <td className="py-1 pr-2 text-text font-semibold">{p.symbol}</td>
            <td className={cn('py-1 pr-2', (p.net_qty ?? 0) > 0 ? 'text-up' : 'text-down')}>
              {p.net_qty ?? '—'}
            </td>
            <td className="py-1 pr-2 text-text">{p.avg_price != null ? fmtPrice(p.avg_price) : '—'}</td>
            <td className="py-1 pr-2 text-text">{p.ltp != null ? fmtPrice(p.ltp) : '—'}</td>
            <td className={cn('py-1 pr-2', p.unrealised_pnl == null ? 'text-text-faint' : p.unrealised_pnl >= 0 ? 'text-up' : 'text-down')}>
              {p.unrealised_pnl != null ? `${p.unrealised_pnl >= 0 ? '+' : ''}₹${fmtPrice(p.unrealised_pnl)}` : '—'}
            </td>
            <td className={cn('py-1 pr-2', p.realised_pnl == null ? 'text-text-faint' : p.realised_pnl >= 0 ? 'text-up' : 'text-down')}>
              {p.realised_pnl != null ? `${p.realised_pnl >= 0 ? '+' : ''}₹${fmtPrice(p.realised_pnl)}` : '—'}
            </td>
            <td className="py-1 pr-2 text-text-faint">{p.exchange}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---- Orders ----

function OrdersTab({ snapshot }: { snapshot: BrokerAccountSnapshot }) {
  if (snapshot.orders.length === 0) {
    return <Empty label="No orders in book" />
  }
  return (
    <table className="w-full text-[10px] font-mono">
      <thead>
        <tr className="text-[8px] uppercase tracking-wider text-text-faint border-b border-border">
          {['ID', 'Symbol', 'Side', 'Qty', 'Price', 'Status', 'Type', 'Time'].map((h) => (
            <th key={h} className="text-left py-1 pr-2 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {snapshot.orders.map((o, i) => (
          <tr key={i} className="border-b border-border/40 hover:bg-panel/40">
            <td className="py-1 pr-2 text-text-faint">{o.order_id_masked}</td>
            <td className="py-1 pr-2 text-text font-semibold">{o.symbol}</td>
            <td className={cn('py-1 pr-2 font-bold', o.side === 'BUY' ? 'text-up' : 'text-down')}>
              {o.side}
            </td>
            <td className="py-1 pr-2 text-text">{o.quantity ?? '—'}</td>
            <td className="py-1 pr-2 text-text">{o.price != null ? fmtPrice(o.price) : '—'}</td>
            <td className="py-1 pr-2 text-text-faint">{o.status}</td>
            <td className="py-1 pr-2 text-text-faint">{o.order_type}</td>
            <td className="py-1 pr-2 text-text-faint">{o.order_time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---- Trades ----

function TradesTab({ snapshot }: { snapshot: BrokerAccountSnapshot }) {
  if (snapshot.trades.length === 0) {
    return <Empty label="No trades today" />
  }
  return (
    <table className="w-full text-[10px] font-mono">
      <thead>
        <tr className="text-[8px] uppercase tracking-wider text-text-faint border-b border-border">
          {['ID', 'Symbol', 'Side', 'Qty', 'Price', 'Exchange', 'Time'].map((h) => (
            <th key={h} className="text-left py-1 pr-2 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {snapshot.trades.map((t, i) => (
          <tr key={i} className="border-b border-border/40 hover:bg-panel/40">
            <td className="py-1 pr-2 text-text-faint">{t.trade_id_masked}</td>
            <td className="py-1 pr-2 text-text font-semibold">{t.symbol}</td>
            <td className={cn('py-1 pr-2 font-bold', t.side === 'BUY' ? 'text-up' : 'text-down')}>
              {t.side}
            </td>
            <td className="py-1 pr-2 text-text">{t.quantity ?? '—'}</td>
            <td className="py-1 pr-2 text-text">{t.price != null ? fmtPrice(t.price) : '—'}</td>
            <td className="py-1 pr-2 text-text-faint">{t.exchange}</td>
            <td className="py-1 pr-2 text-text-faint">{t.trade_time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-5 px-2 rounded-sm text-[9px] font-mono capitalize font-medium transition-colors',
        active ? 'bg-info/15 text-info border border-info/30' : 'text-text-dim hover:text-text border border-transparent'
      )}
    >
      {label}
    </button>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <BookOpen className="w-5 h-5 text-text-faint opacity-40" />
      <div className="text-[10px] font-mono text-text-faint">{label}</div>
    </div>
  )
}
