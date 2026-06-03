'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle, RefreshCw, Clock, Bell, AlertTriangle, History } from 'lucide-react'
import { cn, fmtPrice } from '@/lib/utils'
import type { PendingSignal, SignalHistoryItem } from '@/lib/types'
import { getPendingSignals, getSignalHistory, approveSignalForPaper, dismissSignal } from '@/lib/api'
import { useTerminalStore } from '@/store/terminal-store'

const SIDE_COLOR: Record<string, string> = {
  BUY: 'text-up',
  SELL: 'text-down',
}

const STATUS_COLOR: Record<string, string> = {
  GENERATED: 'text-info border-info/30 bg-info/10',
  VALIDATED: 'text-warn border-warn/30 bg-warn/10',
  APPROVED_PAPER: 'text-up border-up/30 bg-up/10',
  PAPER_EXECUTED: 'text-up border-up/30 bg-up/10',
  DISMISSED: 'text-text-faint border-border bg-panel',
  REJECTED: 'text-down border-down/30 bg-down/10',
  ERROR: 'text-down border-down/30 bg-down/10',
}

type Tab = 'pending' | 'history'

export function SignalApprovalQueue() {
  const adminToken = useTerminalStore((s) => s.omsAdminToken)
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<PendingSignal[]>([])
  const [history, setHistory] = useState<SignalHistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<number, string | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'pending') {
        const result = await getPendingSignals(adminToken)
        if (result.ok) {
          setPending(result.data.signals)
        } else if ('adminRequired' in result) {
          setError('Admin token required to view pending signals')
        } else {
          setError('Failed to load pending signals')
        }
      } else {
        const result = await getSignalHistory(adminToken, undefined, 100)
        if (result.ok) {
          setHistory(result.data.signals)
        } else if ('adminRequired' in result) {
          setError('Admin token required to view signal history')
        } else {
          setError('Failed to load signal history')
        }
      }
      setLastRefreshed(Date.now())
    } catch {
      setError('Network error loading signals')
    } finally {
      setLoading(false)
    }
  }, [tab, adminToken])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 15_000)
    return () => clearInterval(interval)
  }, [load])

  const handleApprove = async (signal: PendingSignal) => {
    setActionLoading((prev) => ({ ...prev, [signal.id]: 'approve' }))
    try {
      await approveSignalForPaper(signal.id, adminToken)
      await load()
    } finally {
      setActionLoading((prev) => ({ ...prev, [signal.id]: null }))
    }
  }

  const handleDismiss = async (signal: PendingSignal, reason?: string) => {
    setActionLoading((prev) => ({ ...prev, [signal.id]: 'dismiss' }))
    try {
      await dismissSignal(signal.id, adminToken, reason)
      await load()
    } finally {
      setActionLoading((prev) => ({ ...prev, [signal.id]: null }))
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-panel/60">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-text-dim" />
          <span className="text-xs font-semibold text-text">Signal Approval Queue</span>
          {pending.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-warn/20 text-warn text-xs font-mono font-bold">
              {pending.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TabPill label="Pending" active={tab === 'pending'} onClick={() => setTab('pending')} />
          <TabPill label="History" active={tab === 'history'} onClick={() => setTab('history')} />
          <button
            onClick={load}
            disabled={loading}
            className="h-6 w-6 flex items-center justify-center rounded-sm border border-border bg-bg text-text-dim hover:text-text disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mt-2 rounded-sm border border-down/30 bg-down/10 px-3 py-1.5 text-xs font-mono text-down flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-1.5">
        {tab === 'pending' ? (
          pending.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-6 h-6" />}
              title="No pending signals"
              hint="Generated signals awaiting manual approval will appear here"
            />
          ) : (
            pending.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                showActions
                actionState={actionLoading[signal.id] ?? null}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
              />
            ))
          )
        ) : (
          history.length === 0 ? (
            <EmptyState
              icon={<History className="w-6 h-6" />}
              title="No signal history"
              hint="All processed signals will appear here"
            />
          ) : (
            history.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                showActions={false}
                actionState={null}
                onApprove={handleApprove}
                onDismiss={handleDismiss}
              />
            ))
          )
        )}
      </div>

      {/* Footer */}
      {lastRefreshed && (
        <div className="px-3 py-1.5 border-t border-border text-xs font-mono text-text-faint opacity-60 text-right">
          <Clock className="inline w-2.5 h-2.5 mr-1" />
          {new Date(lastRefreshed).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}

function SignalRow({
  signal,
  showActions,
  actionState,
  onApprove,
  onDismiss,
}: {
  signal: PendingSignal
  showActions: boolean
  actionState: string | null
  onApprove: (s: PendingSignal) => void
  onDismiss: (s: PendingSignal, reason?: string) => void
}) {
  const side = signal.side?.toUpperCase()
  const confidence = signal.confidence != null ? `${(signal.confidence * 100).toFixed(0)}%` : '—'
  const price = signal.price != null ? fmtPrice(signal.price) : '—'
  const time = signal.created_at ? new Date(signal.created_at).toLocaleTimeString() : '—'

  return (
    <div className={cn(
      'rounded-sm border bg-panel/40 p-2.5 transition-colors',
      showActions && signal.status === 'GENERATED' ? 'border-warn/20' : 'border-border'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-xs font-mono font-bold', SIDE_COLOR[side] ?? 'text-text')}>
            {side ?? 'N/A'}
          </span>
          <span className="text-xs font-semibold text-text truncate">{signal.symbol}</span>
          <span className={cn('px-1.5 py-0.5 rounded-sm border text-xs font-mono font-semibold', STATUS_COLOR[signal.status] ?? STATUS_COLOR.GENERATED)}>
            {signal.status}
          </span>
        </div>
        <div className="text-xs font-mono text-text-faint shrink-0">{time}</div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-1.5">
        <MiniVal label="Price" value={price} />
        <MiniVal label="Confidence" value={confidence} />
        <MiniVal label="Timeframe" value={signal.timeframe ?? '—'} />
      </div>

      {signal.reason && (
        <div className="mt-1 text-xs font-mono text-text-faint truncate" title={signal.reason}>
          {signal.reason}
        </div>
      )}
      {signal.dismiss_reason && (
        <div className="mt-0.5 text-xs font-mono text-down/80 truncate">
          Dismissed: {signal.dismiss_reason}
        </div>
      )}

      {showActions && (signal.status === 'GENERATED' || signal.status === 'VALIDATED') && (
        <div className="flex items-center gap-1 mt-2">
          <button
            onClick={() => onApprove(signal)}
            disabled={actionState !== null}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-up/30 bg-up/10 text-up text-xs font-mono font-semibold hover:bg-up/20 disabled:opacity-40 transition-colors"
          >
            {actionState === 'approve' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            Approve Paper
          </button>
          <button
            onClick={() => onDismiss(signal, 'Manual dismiss')}
            disabled={actionState !== null}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-down/30 bg-down/10 text-down text-xs font-mono font-semibold hover:bg-down/20 disabled:opacity-40 transition-colors"
          >
            {actionState === 'dismiss' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

function TabPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-6 px-2.5 rounded-sm text-xs font-mono font-medium transition-colors',
        active ? 'bg-info/15 text-info border border-info/30' : 'text-text-dim hover:text-text border border-transparent'
      )}
    >
      {label}
    </button>
  )
}

function MiniVal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-text-faint">{label}</div>
      <div className="text-xs font-mono text-text">{value}</div>
    </div>
  )
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <div className="text-text-faint opacity-50">{icon}</div>
      <div className="text-xs font-mono text-text-faint">{title}</div>
      <div className="text-xs text-text-faint opacity-70 max-w-xs">{hint}</div>
    </div>
  )
}
