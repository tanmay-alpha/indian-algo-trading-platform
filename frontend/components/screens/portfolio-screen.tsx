'use client'

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Database, Eye, EyeOff, LineChart, LockKeyhole, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { SmoothTabs } from '@/components/effects/smooth-tabs'
import { SkeletonWave } from '@/components/effects/skeleton-wave'
import { StatusOrb } from '@/components/effects/status-orb'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { useToast } from '@/components/ui-maet/toast'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'
import type { EquityCurvePoint, PortfolioHolding, PortfolioPosition, PortfolioSummary } from '@/lib/types'

type PortfolioTab = 'overview' | 'positions' | 'holdings' | 'curve'

const tabs: { id: PortfolioTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'positions', label: 'Positions' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'curve', label: 'Equity Curve' },
]

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
    void refreshPortfolio()
  }, [adminToken, refreshPortfolio])

  const reconciliationLabel = useMemo(() => {
    if (!adminToken) return 'Protected'
    if (!reconciliation || reconciliation.data_status === 'UNAVAILABLE') return 'No snapshot'
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
      if ('adminRequired' in result && result.adminRequired) setUnlockError('Invalid validation token.')
      else if ('backendUnavailable' in result && result.backendUnavailable) setUnlockError('Broker snapshot is not ready.')
      else setUnlockError(('error' in result && result.error) || 'Could not unlock read-only snapshot.')
      return
    }
    setTokenInput('')
    pushToast({ type: 'info', title: 'Portfolio unlocked', body: 'Read-only broker and portfolio views can now refresh.' })
    void refreshPortfolio()
  }

  return (
    <MobilePage className="flex h-full min-h-0 flex-col gap-3 pb-4 lg:pb-0">
      <div className="maet-glass-strong shrink-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-maet-text">Read-only portfolio context</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-maet-text-muted">
              Funds, holdings, positions, reconciliation, and snapshot status stay protected. No account data is invented.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone="warning">READ ONLY</StatusBadge>
            <button
              type="button"
              onClick={() => void refreshPortfolio()}
              disabled={!adminToken || loading}
              aria-label="Refresh read-only portfolio snapshot"
              className="grid h-10 w-10 place-items-center rounded-xl border border-maet-glass-border bg-maet-glass-bg text-maet-text-soft hover:bg-maet-glass-bg-strong hover:text-maet-text disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <SmoothTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {!adminToken && (
        <UnlockPanel
          tokenInput={tokenInput}
          showToken={showToken}
          isUnlocking={isUnlocking}
          unlockError={unlockError}
          onTokenChange={setTokenInput}
          onToggleToken={() => setShowToken((current) => !current)}
          onUnlock={() => void handleUnlock()}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          loading ? <OverviewSkeleton /> : <Overview summary={summary} reconciliationLabel={reconciliationLabel} locked={!adminToken} />
        )}
        {activeTab === 'positions' && (
          <Positions positions={positions} loading={loading} locked={!adminToken} />
        )}
        {activeTab === 'holdings' && (
          <Holdings holdings={holdings} loading={loading} locked={!adminToken} />
        )}
        {activeTab === 'curve' && (
          loading ? <TableSkeleton /> : <EquityCurve points={equityCurve} locked={!adminToken} />
        )}
      </div>
    </MobilePage>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="maet-glass p-4">
            <SkeletonWave className="h-10 w-10 rounded-xl" />
            <SkeletonWave className="mt-4 h-3 w-24" />
            <SkeletonWave className="mt-3 h-6 w-32" />
            <SkeletonWave className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <TableSkeleton />
    </div>
  )
}

function UnlockPanel({
  tokenInput,
  showToken,
  isUnlocking,
  unlockError,
  onTokenChange,
  onToggleToken,
  onUnlock,
}: {
  tokenInput: string
  showToken: boolean
  isUnlocking: boolean
  unlockError: string | null
  onTokenChange: (value: string) => void
  onToggleToken: () => void
  onUnlock: () => void
}) {
  return (
    <div className="maet-glass shrink-0 p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-maet-amber/30 bg-maet-amber/10 text-maet-amber">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div>
          <div className="font-heading text-base font-bold text-maet-text">Protected read-only broker context</div>
          <p className="mt-1 text-sm leading-6 text-maet-text-muted">Connect an admin session to view protected read-only broker context. Nothing is stored in browser storage.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={tokenInput}
            onChange={(event) => onTokenChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onUnlock()
            }}
            placeholder="Validation token"
            className="maet-input pr-10 font-mono"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onToggleToken}
            aria-label={showToken ? 'Hide validation token' : 'Show validation token'}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-maet-text-muted hover:bg-maet-panel-soft hover:text-maet-text"
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          type="button"
          onClick={onUnlock}
          disabled={isUnlocking || !tokenInput.trim()}
          className="maet-btn maet-btn-primary h-11 px-4 text-sm disabled:opacity-40"
        >
          {isUnlocking && <RefreshCw className="h-4 w-4 animate-spin" />}
          Unlock
        </button>
      </div>
      {unlockError && <div className="mt-3 rounded-lg border border-maet-red/25 bg-maet-red/10 px-3 py-2 text-sm text-maet-red">{unlockError}</div>}
    </div>
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard icon={<WalletCards className="h-5 w-5" />} label="Funds" value={locked ? 'Protected' : formatCurrency(summary?.equity)} caption="Read-only snapshot" />
        <SnapshotCard icon={<Briefcase className="h-5 w-5" />} label="Open Notional" value={locked ? 'Protected' : formatCurrency(summary?.total_open_notional)} caption="From read-only service only" />
        <SnapshotCard icon={<LineChart className="h-5 w-5" />} label="Unrealized PnL" value={locked ? 'Protected' : formatCurrency(pnl)} caption="Shown only when a read-only value exists" tone={pnl == null ? 'muted' : pnl >= 0 ? 'up' : 'down'} />
        <SnapshotCard icon={<Database className="h-5 w-5" />} label="Snapshot status" value={locked ? 'Protected' : summary?.data_status ?? 'No snapshot'} caption="No invented balances" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="maet-glass p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-heading text-lg font-bold text-maet-text">Reconciliation</div>
            <StatusBadge tone={reconciliationLabel === 'Synced' ? 'success' : reconciliationLabel === 'Mismatch' ? 'warning' : 'muted'}>{reconciliationLabel}</StatusBadge>
          </div>
          <p className="text-sm leading-6 text-maet-text-muted">
            {locked
              ? 'Connect an admin session to view protected read-only broker context.'
              : 'Reconciliation compares paper records with broker snapshot data without changing broker account state.'}
          </p>
        </div>

        <div className="maet-glass border-maet-amber/25 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-maet-amber" />
            <div className="font-heading text-base font-bold text-maet-text">Safety boundary</div>
          </div>
          <div className="space-y-2">
            <SafetyRow label="Read-only context" value="Protected view" />
            <SafetyRow label="Live execution" value="Locked" />
            <SafetyRow label="Broker actions" value="Disabled" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Positions({ positions, loading, locked }: { positions: PortfolioPosition[]; loading: boolean; locked: boolean }) {
  if (loading) return <TableSkeleton />
  if (locked || positions.length === 0) {
    return <EmptyPanel icon={<Briefcase className="h-6 w-6" />} title="No positions shown" body={locked ? 'Connect an admin session to view protected read-only broker context.' : 'Broker snapshot is not ready. No account data is shown.'} />
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
        pos.avg_price && pos.ltp ? `${(((pos.ltp - pos.avg_price) / pos.avg_price) * 100).toFixed(2)}%` : '--',
      ])}
    />
  )
}

function Holdings({ holdings, loading, locked }: { holdings: PortfolioHolding[]; loading: boolean; locked: boolean }) {
  if (loading) return <TableSkeleton />
  if (locked || holdings.length === 0) {
    return <EmptyPanel icon={<Briefcase className="h-6 w-6" />} title="No holdings shown" body={locked ? 'Connect an admin session to view protected read-only broker context.' : 'Broker snapshot is not ready. No account data is shown.'} />
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
    return <EmptyPanel icon={<LineChart className="h-6 w-6" />} title="No equity curve shown" body={locked ? 'Connect an admin session to view protected read-only broker context.' : 'Broker snapshot is not ready. No account data is shown.'} />
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
    <div className="maet-glass bg-maet-ink-950/52 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full" role="img" aria-label="Portfolio equity curve">
        <path d={fillPath} fill="rgba(47,128,255,0.20)" />
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth="3" />
      </svg>
    </div>
  )
}

function SnapshotCard({ icon, label, value, caption, tone = 'muted' }: { icon: React.ReactNode; label: string; value: string; caption: string; tone?: 'up' | 'down' | 'muted' }) {
  return (
    <div className="maet-glass p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-maet-glass-bg text-maet-cyan">{icon}</div>
        <StatusOrb tone={tone === 'up' ? 'green' : tone === 'down' ? 'red' : 'muted'} />
      </div>
      <div className="mt-4 text-sm font-bold text-maet-text-muted">{label}</div>
      <div className={cn('maet-number mt-2 font-mono text-xl font-extrabold', tone === 'up' ? 'text-maet-green' : tone === 'down' ? 'text-maet-red' : 'text-maet-text')}>
        {value}
      </div>
      <div className="mt-1 text-sm text-maet-text-muted">{caption}</div>
    </div>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="maet-glass overflow-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-maet-ink-950/48 text-maet-text-muted">
          <tr>
            {headers.map((header) => <th key={header} className="px-3 py-3 font-mono font-bold">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="h-12 border-t border-white/10">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-3 py-2 font-mono text-maet-text-soft">{cell}</td>
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
        <div key={index} className="maet-glass grid h-12 grid-cols-[1fr_80px_90px] items-center gap-3 px-3">
          <SkeletonWave className="h-3 w-28" />
          <SkeletonWave className="h-3 w-16" />
          <SkeletonWave className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

function EmptyPanel({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="maet-glass grid min-h-[300px] place-items-center p-6 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-maet-glass-border bg-maet-glass-bg text-maet-text-muted">{icon}</div>
        <div className="mt-4 font-heading text-lg font-bold text-maet-text">{title}</div>
        <p className="mt-2 max-w-sm text-sm leading-6 text-maet-text-muted">{body}</p>
      </div>
    </div>
  )
}

function SafetyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-maet-amber/20 bg-maet-amber/10 px-3 py-2">
      <span className="text-xs font-bold text-maet-amber">{label}</span>
      <span className="font-mono text-xs font-bold text-maet-text">{value}</span>
    </div>
  )
}

function cleanSymbol(symbol: string) {
  return symbol.split(':').pop()?.replace(/-EQ$/, '') ?? symbol
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '--'
  return `Rs ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
