'use client'

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Eye, EyeOff, LineChart, LockKeyhole, RefreshCw } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { Skeleton } from '@/components/ui-maet/skeleton'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { useToast } from '@/components/ui-maet/toast'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import type { EquityCurvePoint, PortfolioHolding, PortfolioPosition, PortfolioSummary } from '@/lib/types'

type PortfolioTab = 'overview' | 'positions' | 'holdings' | 'curve'

export function PortfolioScreen() {
  const { pushToast } = useToast()
  const [activeTab, setActiveTab] = useState<PortfolioTab>('overview')
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const setOmsAdminToken = useTerminalStore((s) => s.setOmsAdminToken)
  const clearOmsAdminToken = useTerminalStore((s) => s.clearOmsAdminToken)
  const fetchManualOrderTickets = useTerminalStore((s) => s.fetchManualOrderTickets)
  const refreshPortfolio = useTerminalStore((s) => s.refreshPortfolio)
  const summary = useTerminalStore((s) => s.portfolioSummary)
  const positions = useTerminalStore((s) => s.positions)
  const holdings = useTerminalStore((s) => s.holdings)
  const equityCurve = useTerminalStore((s) => s.equityCurve)
  const reconciliation = useTerminalStore((s) => s.reconciliationStatus)
  const loading = useTerminalStore((s) => s.portfolioLoading)

  useEffect(() => {
    if (adminToken) void refreshPortfolio()
  }, [adminToken, refreshPortfolio])

  const reconciliationLabel = useMemo(() => {
    if (!adminToken) return 'Offline'
    if (!reconciliation || reconciliation.data_status === 'UNAVAILABLE') return 'Offline'
    if ((reconciliation.summary?.mismatch_count ?? 0) > 0) return 'Mismatch'
    return 'Synced'
  }, [adminToken, reconciliation])

  const handleUnlock = async () => {
    if (!tokenInput.trim()) return
    setUnlockError(null)
    setIsUnlocking(true)
    setOmsAdminToken(tokenInput.trim())
    const result = await fetchManualOrderTickets()
    setIsUnlocking(false)
    if (!result.ok) {
      clearOmsAdminToken()
      if ('adminRequired' in result && result.adminRequired) setUnlockError('Invalid administrator token.')
      else if ('backendUnavailable' in result && result.backendUnavailable) setUnlockError('Portfolio backend is offline.')
      else setUnlockError(('error' in result && result.error) || 'Could not unlock read-only snapshot.')
      return
    }
    setTokenInput('')
    pushToast({ type: 'info', title: 'Portfolio unlocked', body: 'Read-only broker and portfolio endpoints can now refresh.' })
    void refreshPortfolio()
  }

  return (
    <MobilePage className="flex h-full flex-col space-y-4 pb-4">
      <div className="shrink-0 rounded-card border border-maet-amber/25 bg-maet-amber/10 px-3 py-2 text-xs font-semibold text-maet-amber">
        Broker data is read-only. No mutations possible.
      </div>

      <div className="shrink-0 rounded-card border border-maet-border bg-maet-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl font-bold text-maet-text">Portfolio</h1>
            <p className="mt-1 text-xs leading-5 text-maet-text-secondary">Positions, holdings, reconciliation, and equity curve from protected read-only endpoints.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshPortfolio()}
            disabled={!adminToken || loading}
            aria-label="Refresh read-only portfolio snapshot"
            className="grid h-10 w-10 place-items-center rounded-md border border-maet-border text-maet-text-secondary hover:bg-maet-elevated hover:text-maet-text disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="mt-4 no-scrollbar flex gap-2 overflow-x-auto">
          <TabButton label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <TabButton label="Positions" active={activeTab === 'positions'} onClick={() => setActiveTab('positions')} />
          <TabButton label="Holdings" active={activeTab === 'holdings'} onClick={() => setActiveTab('holdings')} />
          <TabButton label="Equity Curve" active={activeTab === 'curve'} onClick={() => setActiveTab('curve')} />
        </div>
      </div>

      {!adminToken && (
        <div className="shrink-0 rounded-card border border-maet-border bg-maet-overlay p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-maet-amber/30 bg-maet-amber/10 text-maet-amber">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <div className="font-heading text-base font-bold text-maet-text">Read-only unlock required</div>
              <p className="mt-1 text-xs leading-5 text-maet-text-secondary">Protected portfolio endpoints need an in-memory admin token.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleUnlock()
                }}
                placeholder="X-Admin-Token"
                className="maet-input pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken((current) => !current)}
                aria-label={showToken ? 'Hide admin token' : 'Show admin token'}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-maet-text-muted hover:bg-maet-elevated hover:text-maet-text"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={isUnlocking || !tokenInput.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-maet-blue px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {isUnlocking && <RefreshCw className="h-4 w-4 animate-spin" />}
              Unlock
            </button>
          </div>
          {unlockError && <div className="mt-3 rounded-md border border-maet-red/25 bg-maet-red/10 px-3 py-2 text-xs text-maet-red">{unlockError}</div>}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <Overview summary={summary} reconciliationLabel={reconciliationLabel} locked={!adminToken} />
        )}
        {activeTab === 'positions' && (
          <Positions positions={positions} loading={loading} locked={!adminToken} />
        )}
        {activeTab === 'holdings' && (
          <Holdings holdings={holdings} loading={loading} locked={!adminToken} />
        )}
        {activeTab === 'curve' && (
          <EquityCurve points={equityCurve} locked={!adminToken} />
        )}
      </div>
    </MobilePage>
  )
}

function Overview({
  summary,
  reconciliationLabel,
  locked,
}: {
  summary: PortfolioSummary | null
  reconciliationLabel: string
  locked: boolean
}) {
  const pnl = summary?.unrealized_pnl ?? null
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Invested" value={locked ? 'Offline' : formatCurrency(summary?.total_open_notional)} caption="Read-only broker snapshot" />
        <StatCard label="Current Value" value={locked ? 'Offline' : formatCurrency(summary?.equity)} caption="Read-only broker snapshot" />
        <StatCard label="Unrealized P&L" value={locked ? 'Offline' : formatCurrency(pnl)} caption="Paper mode - indicative" tone={pnl == null ? 'muted' : pnl >= 0 ? 'up' : 'down'} />
      </div>
      <div className="rounded-card border border-maet-border bg-maet-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="font-heading text-base font-bold text-maet-text">Reconciliation</div>
          <StatusBadge tone={reconciliationLabel === 'Synced' ? 'success' : reconciliationLabel === 'Mismatch' ? 'warning' : 'muted'}>{reconciliationLabel}</StatusBadge>
        </div>
        <p className="text-sm leading-6 text-maet-text-secondary">
          {locked
            ? 'Unlock the protected read-only endpoints to fetch positions, holdings, and reconciliation state.'
            : 'Reconciliation compares internal paper state with broker snapshot data without changing broker account state.'}
        </p>
      </div>
    </div>
  )
}

function Positions({ positions, loading, locked }: { positions: PortfolioPosition[]; loading: boolean; locked: boolean }) {
  if (loading) return <TableSkeleton />
  if (locked || positions.length === 0) {
    return <EmptyPanel icon={<Briefcase className="h-6 w-6" />} title="No open positions in paper mode" body={locked ? 'Read-only portfolio endpoint is locked.' : 'No position rows returned by backend.'} />
  }
  return (
    <DataTable
      headers={['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L', 'Change%']}
      rows={positions.map((pos) => [
        cleanSymbol(pos.symbol),
        String(pos.quantity),
        formatCurrency(pos.avg_price),
        formatCurrency(pos.ltp),
        formatCurrency(pos.unrealized_pnl),
        pos.avg_price && pos.ltp ? `${(((pos.ltp - pos.avg_price) / pos.avg_price) * 100).toFixed(2)}%` : 'Offline',
      ])}
    />
  )
}

function Holdings({ holdings, loading, locked }: { holdings: PortfolioHolding[]; loading: boolean; locked: boolean }) {
  if (loading) return <TableSkeleton />
  if (locked || holdings.length === 0) {
    return <EmptyPanel icon={<Briefcase className="h-6 w-6" />} title="No holdings synced" body={locked ? 'Read-only holdings endpoint is locked.' : 'No holdings rows returned by backend.'} />
  }
  return (
    <DataTable
      headers={['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L', 'Status']}
      rows={holdings.map((hold) => [
        cleanSymbol(hold.symbol),
        String(hold.quantity),
        formatCurrency(hold.average_price),
        formatCurrency(hold.ltp),
        formatCurrency(hold.pnl),
        hold.data_status,
      ])}
    />
  )
}

function EquityCurve({ points, locked }: { points: EquityCurvePoint[]; locked: boolean }) {
  if (locked || points.length === 0) {
    return <EmptyPanel icon={<LineChart className="h-6 w-6" />} title="Equity curve unavailable" body={locked ? 'Unlock read-only portfolio endpoints to load equity curve.' : 'Backend returned no equity curve points.'} />
  }

  const width = 640
  const height = 260
  const values = points.map((point) => point.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  const path = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width
    const y = height - ((point.equity - min) / span) * (height - 32) - 16
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`

  return (
    <div className="rounded-card border border-maet-border bg-maet-void p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full" role="img" aria-label="Portfolio equity curve">
        <path d={fillPath} fill="rgba(77,156,248,0.20)" />
        <path d={path} fill="none" stroke="#4d9cf8" strokeWidth="3" />
      </svg>
    </div>
  )
}

function StatCard({ label, value, caption, tone = 'muted' }: { label: string; value: string; caption: string; tone?: 'up' | 'down' | 'muted' }) {
  return (
    <div className="rounded-card border border-maet-border bg-maet-surface p-4">
      <div className="text-xs font-bold text-maet-text-muted">{label}</div>
      <div className={cn('mt-2 font-mono text-xl font-extrabold', tone === 'up' ? 'text-maet-green' : tone === 'down' ? 'text-maet-red' : 'text-maet-text')}>
        {value}
      </div>
      <div className="mt-1 text-xs text-maet-text-muted">{caption}</div>
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-auto rounded-card border border-maet-border bg-maet-surface">
      <table className="min-w-[620px] w-full text-left text-xs">
        <thead className="bg-maet-elevated text-maet-text-muted">
          <tr>
            {headers.map((header) => <th key={header} className="px-3 py-3 font-mono font-bold">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="h-12 border-t border-maet-border">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-3 py-2 font-mono text-maet-text-secondary">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid h-12 grid-cols-[1fr_80px_90px] items-center gap-3 rounded-card border border-maet-border bg-maet-surface px-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

function EmptyPanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="grid min-h-[260px] place-items-center rounded-card border border-maet-border bg-maet-surface p-6 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-maet-border bg-maet-elevated text-maet-text-muted">{icon}</div>
        <div className="mt-4 font-heading text-base font-bold text-maet-text">{title}</div>
        <p className="mt-2 max-w-sm text-sm leading-6 text-maet-text-secondary">{body}</p>
      </div>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('filter-chip', active && 'active')}>
      {label}
    </button>
  )
}

function cleanSymbol(symbol: string) {
  return symbol.split(':').pop()?.replace(/-EQ$/, '') ?? symbol
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'Offline'
  return `Rs ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
