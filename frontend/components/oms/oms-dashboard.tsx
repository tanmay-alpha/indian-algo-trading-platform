'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  FileText,
  BarChart2,
  GitMerge,
} from 'lucide-react'
import { useTerminalStore } from '@/store/terminal-store'
import { cn, fmtPrice } from '@/lib/utils'
import type { OmsOrder, OmsFill, OmsEvent, OmsDataState } from '@/lib/types'

// Helpers

function fmt(v: string | null | undefined): string {
  return v ?? '-'
}

function fmtTs(v: string | null | undefined): string {
  if (!v) return '-'
  try {
    return new Date(v).toLocaleTimeString('en-IN', { hour12: false })
  } catch {
    return v
  }
}

function statusColor(status: string): string {
  const s = status?.toUpperCase()
  if (s === 'FILLED') return 'text-emerald-400'
  if (s === 'REJECTED' || s === 'CANCELLED') return 'text-rose-400'
  if (s === 'PARTIAL') return 'text-amber-400'
  if (s === 'OPEN' || s === 'PENDING') return 'text-sky-400'
  return 'text-text-dim'
}

// Sub-components

function OmsStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-border bg-panel/70 px-3 py-2">
      <div className="text-xs font-mono uppercase tracking-wider text-text-faint">{label}</div>
      <div className="mt-1 text-sm font-mono font-semibold text-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs font-mono text-text-faint truncate">{sub}</div>}
    </div>
  )
}

function BlotterTable({
  columns,
  rows,
  emptyMsg,
  rowKeys,
  selectedKey,
  onRowClick,
}: {
  columns: string[]
  rows: string[][]
  emptyMsg: string
  rowKeys?: string[]
  selectedKey?: string | null
  onRowClick?: (rowKey: string) => void
}) {
  const colStyle = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div
        className="grid gap-2 px-3 py-1.5 border-b border-border bg-bg text-xs font-mono uppercase tracking-wider text-text-faint sticky top-0"
        style={colStyle}
      >
        {columns.map((c) => <span key={c} className="truncate">{c}</span>)}
      </div>
      {rows.length === 0 ? (
        <div className="flex-1 grid place-items-center py-8 text-text-faint text-xs font-mono">{emptyMsg}</div>
      ) : (
        <div className="flex-1 overflow-auto">
          {rows.map((row, i) => {
            const rowKey = rowKeys?.[i] ?? String(i)
            const interactive = Boolean(onRowClick)

            return (
              <div
                key={rowKey}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={() => onRowClick?.(rowKey)}
                onKeyDown={(event) => {
                  if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) return
                  event.preventDefault()
                  onRowClick(rowKey)
                }}
                className={cn(
                  'grid gap-2 px-3 py-1.5 border-b border-border/50 text-xs font-mono text-text-2 hover:bg-panel/40 transition-colors',
                  interactive && 'cursor-pointer',
                  selectedKey === rowKey && 'bg-info/10 text-text'
                )}
                style={colStyle}
              >
                {row.map((cell, j) => <span key={j} className="truncate" title={cell}>{cell}</span>)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AdminTokenGate({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [val, setVal] = useState('')
  const [show, setShow] = useState(false)

  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="w-full max-w-sm rounded border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
        <div className="flex items-center gap-2 text-amber-400">
          <Shield className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold">Developer admin unlock</span>
        </div>
        <p className="text-xs text-text-faint font-mono">
          Required to view protected local/demo portfolio endpoints and OMS status blotters. Do not enter production secrets in public deployments.
          The token is held in volatile memory only; it is never stored or persisted.
          <br /><br />
          Note: This dashboard is strictly READ-ONLY. Live trading remains locked.
        </p>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) onSubmit(val.trim()) }}
            placeholder="Validation token"
            autoComplete="off"
            className="w-full h-8 rounded border border-border bg-bg px-3 pr-9 text-xs font-mono text-text focus:outline-none focus:border-info/50"
          />
          <button
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-dim hover:text-text"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={() => { if (val.trim()) onSubmit(val.trim()) }}
          className="w-full h-8 rounded bg-info/20 border border-info/30 text-info text-xs font-mono hover:bg-info/30 transition-colors"
        >
          Unlock OMS Dashboard
        </button>
      </div>
    </div>
  )
}

function BackendUnavailableState() {
  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="text-center space-y-2">
        <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <div className="text-xs font-mono text-text-faint">Backend unreachable - OMS data unavailable.</div>
      </div>
    </div>
  )
}

// Tab panels

function SummaryTab() {
  const status = useTerminalStore((s) => s.omsStatus)
  const health = useTerminalStore((s) => s.omsHealth)

  const oms = status?.oms
  const rebuild = status?.portfolio_rebuild

  return (
    <div className="p-3 space-y-3 overflow-auto">
      {/* Ephemeral storage warnings */}
      <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex gap-2 text-amber-400/95">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div className="text-xs font-mono leading-normal">
          <span className="font-semibold uppercase text-amber-300">Deployment Notice:</span> This demo runs on Render Free. 
          The SQLite database resides on ephemeral storage. 
          Order blotters, partial fill ledgers, and reconciled state will reset when the backend restarts or sleeps. 
          A production system would require a persistent SQL database like PostgreSQL.
        </div>
      </div>

      {/* Health row */}
      <div className="flex items-center gap-2 rounded border border-border bg-panel/60 px-3 py-2">
        {health?.oms_initialized ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}
        <span className="text-xs font-mono text-text">
          Trading Safety Engine {health?.oms_initialized ? 'Online' : 'Offline'}
        </span>
        <span className="ml-auto text-xs font-mono text-text-faint">
          {status?.trading_mode ?? '-'} mode / {status?.in_memory_active_orders ?? 0} active in-memory
        </span>
      </div>

      {/* OMS counters */}
      <div className="grid grid-cols-4 gap-2">
        <OmsStatCard label="Total Orders" value={String(oms?.total_orders ?? 0)} />
        <OmsStatCard label="Active" value={String(oms?.active_orders ?? 0)} />
        <OmsStatCard label="Filled" value={String(oms?.filled_orders ?? 0)} />
        <OmsStatCard label="Rejected" value={String(oms?.rejected_orders ?? 0)} />
        <OmsStatCard label="Total Fills" value={String(oms?.fill_count ?? 0)} />
        <OmsStatCard label="Partial Fills" value={String(oms?.partial_fill_count ?? 0)} />
        <OmsStatCard label="Last Order" value={fmtTs(oms?.latest_order_at)} />
        <OmsStatCard label="Last Fill" value={fmtTs(oms?.latest_fill_at)} />
      </div>

      {/* Portfolio rebuild */}
      {rebuild && (
        <div className="rounded border border-border bg-panel/60 p-3 space-y-2">
          <div className="text-xs font-semibold text-text">Portfolio Rebuild Summary</div>
          <div className="grid grid-cols-3 gap-2">
            <OmsStatCard label="Fills Processed" value={String(rebuild.fills_processed)} />
            <OmsStatCard label="Rebuilt Positions" value={String(rebuild.rebuilt_positions?.length ?? 0)} />
            <OmsStatCard label="Warnings" value={String(rebuild.warnings_count)} />
          </div>
          <div className="text-xs font-mono text-text-faint">
            Source: {rebuild.source} / Last: {fmtTs(rebuild.last_rebuild_at)}
          </div>
          {(rebuild.rebuilt_positions?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {rebuild.rebuilt_positions.map((sym) => (
                <span key={sym} className="rounded px-1.5 py-0.5 bg-info/10 border border-info/20 text-xs font-mono text-info">
                  {sym}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrdersTab() {
  const orders = useTerminalStore((s) => s.recentOmsOrders)
  const fetchAudit = useTerminalStore((s) => s.fetchOrderAudit)
  const audit = useTerminalStore((s) => s.selectedOmsOrderAudit)
  const clearAudit = useTerminalStore((s) => s.clearOrderAudit)

  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = useCallback((reqId: string) => {
    if (selected === reqId) {
      setSelected(null)
      clearAudit()
    } else {
      setSelected(reqId)
      void fetchAudit(reqId)
    }
  }, [selected, fetchAudit, clearAudit])

  const cols = ['Request ID', 'Symbol', 'Side', 'Qty', 'Type', 'Status', 'Avg Fill', 'Mode', 'Created']

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn('transition-all', selected ? 'h-1/2' : 'flex-1')}>
        <BlotterTable
          columns={cols}
          emptyMsg="No orders recorded in OMS."
          rowKeys={orders.map((o: OmsOrder) => o.request_id)}
          selectedKey={selected}
          onRowClick={handleSelect}
          rows={orders.map((o: OmsOrder) => [
            o.request_id.slice(0, 12) + '...',
            o.symbol,
            o.side,
            String(o.quantity),
            o.order_type,
            o.status,
            o.avg_fill_price != null ? fmtPrice(o.avg_fill_price) : '-',
            o.mode,
            fmtTs(o.created_at),
          ])}
        />
      </div>
      {/* Inline audit panel */}
      {selected && audit && (
        <div className="h-1/2 border-t border-border overflow-auto p-3 space-y-2 bg-bg/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-info">Audit: {selected}</span>
            <button onClick={() => { setSelected(null); clearAudit() }} className="text-xs text-text-dim hover:text-text font-mono">Close</button>
          </div>
          <div className="space-y-1">
            {audit.events.map((ev, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 text-xs font-mono border-b border-border/40 py-0.5">
                <span className="text-text-faint">{fmtTs(ev.created_at)}</span>
                <span className="text-text">{ev.event_type}</span>
                <span className={statusColor(ev.status ?? '')}>{ev.status ?? '-'}</span>
                <span className="text-text-faint truncate">{ev.reason ?? '-'}</span>
              </div>
            ))}
            {audit.events.length === 0 && <span className="text-xs text-text-faint font-mono">No events.</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function FillsTab() {
  const fills = useTerminalStore((s) => s.recentOmsFills)
  const cols = ['Fill ID', 'Symbol', 'Side', 'Qty', 'Price', 'Fees', 'Source', 'Time']

  return (
    <BlotterTable
      columns={cols}
      emptyMsg="No fills recorded."
      rows={fills.map((f: OmsFill) => [
        f.fill_id.slice(0, 10) + '...',
        f.symbol,
        f.side,
        String(f.filled_quantity),
        fmtPrice(f.fill_price),
        f.fees != null ? fmtPrice(f.fees) : '-',
        fmt(f.source),
        fmtTs(f.created_at),
      ])}
    />
  )
}

function AuditTrailTab() {
  const events = useTerminalStore((s) => s.recentOmsEvents)
  const cols = ['Time', 'Request ID', 'Event Type', 'Status', 'Reason']

  return (
    <BlotterTable
      columns={cols}
      emptyMsg="No audit events recorded."
      rows={events.map((e: OmsEvent) => [
        fmtTs(e.created_at),
        e.request_id.slice(0, 12) + '...',
        e.event_type,
        e.status ?? '-',
        (e.reason ?? '-').slice(0, 40),
      ])}
    />
  )
}

function ReconciliationTab() {
  const recon = useTerminalStore((s) => s.omsReconciliationStatus)

  if (!recon) {
    return (
      <div className="flex-1 grid place-items-center py-8 text-text-faint text-xs font-mono">
        No reconciliation data available.
      </div>
    )
  }

  const statusOk = recon.status === 'ok'

  return (
    <div className="p-3 space-y-3 overflow-auto">
      <div className={cn(
        'flex items-center gap-2 rounded border px-3 py-2',
        statusOk
          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
          : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
      )}>
        {statusOk
          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
        <span className="text-xs font-mono">
          Status: {recon.status.toUpperCase()}
        </span>
        {recon.message && (
          <span className="ml-2 text-xs font-mono text-text-faint">{recon.message}</span>
        )}
        <span className="ml-auto text-xs font-mono text-text-faint">
          Last run: {fmtTs(recon.last_run_at)}
        </span>
      </div>

      {recon.report && Object.keys(recon.report).length > 0 && (
        <div className="rounded border border-border bg-panel/60 p-3">
          <div className="text-xs font-mono text-text-faint mb-2 uppercase tracking-wider">Reconciliation Report</div>
          <pre className="text-xs font-mono text-text-2 whitespace-pre-wrap break-all">
            {JSON.stringify(recon.report, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// Main component

type OmsTab = 'summary' | 'orders' | 'fills' | 'audit' | 'reconciliation'

const OMS_TABS: { id: OmsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Summary', icon: <Activity className="w-3 h-3" /> },
  { id: 'orders', label: 'Order Blotter', icon: <BarChart2 className="w-3 h-3" /> },
  { id: 'fills', label: 'Fill Ledger', icon: <FileText className="w-3 h-3" /> },
  { id: 'audit', label: 'Audit Trail', icon: <Clock className="w-3 h-3" /> },
  { id: 'reconciliation', label: 'Reconciliation', icon: <GitMerge className="w-3 h-3" /> },
]

export function OmsDashboard() {
  const [activeTab, setActiveTab] = useState<OmsTab>('summary')

  const dataState = useTerminalStore((s) => s.omsDataState)
  const loading = useTerminalStore((s) => s.omsLoading)
  const lastUpdated = useTerminalStore((s) => s.omsLastUpdatedAt)
  const adminRequired = useTerminalStore((s) => s.omsAdminRequired)
  const setOmsAdminToken = useTerminalStore((s) => s.setOmsAdminToken)
  const clearOmsAdminToken = useTerminalStore((s) => s.clearOmsAdminToken)
  const refreshOmsDashboard = useTerminalStore((s) => s.refreshOmsDashboard)

  // Bootstrap: check health and refresh dashboard on mount
  useEffect(() => {
    void refreshOmsDashboard()
  }, [refreshOmsDashboard])

  const handleTokenSubmit = useCallback((token: string) => {
    setOmsAdminToken(token)
    void refreshOmsDashboard()
  }, [setOmsAdminToken, refreshOmsDashboard])

  const handleRefresh = useCallback(() => {
    void refreshOmsDashboard()
  }, [refreshOmsDashboard])

  const resolvedState: OmsDataState = adminRequired ? 'ADMIN_REQUIRED' : dataState

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header bar */}
      <div className="h-10 px-4 flex items-center gap-3 border-b border-border bg-bg-2 shrink-0">
        <Shield className="w-3.5 h-3.5 text-info shrink-0" />
        <span className="text-xs font-mono uppercase tracking-wider text-text">OMS Blotter</span>
        <span className="text-xs font-mono text-text-faint">READ-ONLY / ADMIN PROTECTED / NO TRADING ACTIONS</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Data state badge */}
          <DataStateBadge state={resolvedState} />

          {/* Last updated */}
          {lastUpdated && (
            <span className="text-xs font-mono text-text-faint">
              {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour12: false })}
            </span>
          )}

          {/* Clear token */}
          {resolvedState === 'ONLINE' && (
            <button
              onClick={clearOmsAdminToken}
              className="h-6 px-2 rounded border border-border text-xs font-mono text-text-dim hover:text-rose-400 hover:border-rose-400/30 transition-colors"
            >
              Lock
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading || resolvedState === 'ADMIN_REQUIRED'}
            className="h-6 w-6 grid place-items-center rounded border border-border text-text-dim hover:text-text disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Gate states */}
      {resolvedState === 'ADMIN_REQUIRED' && (
        <AdminTokenGate onSubmit={handleTokenSubmit} />
      )}
      {resolvedState === 'BACKEND_UNAVAILABLE' && <BackendUnavailableState />}

      {/* Main content (only shown when ONLINE or LOADING with data) */}
      {(resolvedState === 'ONLINE' || resolvedState === 'LOADING') && (
        <>
          {/* Tab strip */}
          <div className="h-9 px-3 flex items-end gap-0.5 border-b border-border bg-bg-2 shrink-0">
            {OMS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'h-8 px-3 flex items-center gap-1.5 rounded-t text-xs font-mono border-x border-t border-transparent transition-colors',
                  activeTab === tab.id
                    ? 'bg-panel border-border text-info'
                    : 'text-text-dim hover:text-text'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {activeTab === 'summary' && <SummaryTab />}
            {activeTab === 'orders' && <OrdersTab />}
            {activeTab === 'fills' && <FillsTab />}
            {activeTab === 'audit' && <AuditTrailTab />}
            {activeTab === 'reconciliation' && <ReconciliationTab />}
          </div>
        </>
      )}
    </div>
  )
}

function DataStateBadge({ state }: { state: OmsDataState }) {
  const map: Record<OmsDataState, { label: string; cls: string }> = {
    LOADING: { label: 'LOADING', cls: 'text-text-dim border-border' },
    ONLINE: { label: 'LIVE', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' },
    ADMIN_REQUIRED: { label: 'LOCKED', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/5' },
    BACKEND_UNAVAILABLE: { label: 'Connecting...', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/5' },
    ERROR: { label: 'ERROR', cls: 'text-rose-400 border-rose-500/30' },
  }
  const { label, cls } = map[state] ?? map.ERROR
  return (
    <span className={cn('rounded border px-2 py-0.5 text-xs font-mono uppercase', cls)}>
      {label}
    </span>
  )
}
