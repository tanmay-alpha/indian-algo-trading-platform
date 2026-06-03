'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Activity, Database, KeyRound, LockKeyhole, Radio, Server, ShieldCheck, WifiOff } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { StatusOrb } from '@/components/effects/status-orb'
import { useTerminalStore } from '@/store/terminal-store'
import { CONNECTIVITY_TARGETS } from '@/lib/constants'
import { APIError, fetchReady } from '@/lib/api'
import { cn, fmtAge } from '@/lib/utils'
import { useNow } from '@/lib/use-now'

type ReadyDiagnostics = {
  status: string
  environment: string
  database: string
  broker: string
  liveTrading: string
  error: string | null
  checkedAt: number | null
}

export function SystemScreen() {
  const now = useNow()
  const [readyDiagnostics, setReadyDiagnostics] = useState<ReadyDiagnostics>({
    status: 'Checking',
    environment: 'Unknown',
    database: 'Unknown',
    broker: 'Unknown',
    liveTrading: 'Disabled',
    error: null,
    checkedAt: null,
  })

  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const brokerStatus = useTerminalStore((s) => s.brokerStatus)
  const terminalStatus = useTerminalStore((s) => s.terminalStatus)
  const manualOrderStatus = useTerminalStore((s) => s.manualOrderStatus)
  const reconciliationStatus = useTerminalStore((s) => s.reconciliationStatus)
  const omsStatus = useTerminalStore((s) => s.omsStatus)
  const lastStatusFetchAt = useTerminalStore((s) => s.lastStatusFetchAt)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const wsReconnectAttempts = useTerminalStore((s) => s.wsReconnectAttempts)
  const connectionError = useTerminalStore((s) => s.connectionError)
  const lastStatusError = useTerminalStore((s) => s.lastStatusError)

  const apiOnline = apiStatus === 'ONLINE'
  const wsOnline = wsStatus === 'CONNECTED'
  const candleSymbols = terminalStatus?.candles?.symbols?.length ?? 0
  const supportedTimeframes = terminalStatus?.candles?.supported_timeframes?.join(', ') || 'Unavailable'
  const reconciliationLabel = reconciliationStatus
    ? reconciliationStatus.data_status === 'UNAVAILABLE'
      ? 'Unavailable'
      : reconciliationStatus.summary.ok
      ? 'OK'
      : `${reconciliationStatus.summary.mismatch_count} mismatch`
    : 'Locked or not checked'
  const manualOrderLabel = manualOrderStatus?.validation_only ? 'Validation only' : 'Locked or not checked'
  const connectionIssue = safeDiagnosticMessage(connectionError || lastStatusError)
  const corsAuthState = readyDiagnostics.error ?? classifyConnectivityIssue(connectionIssue)

  useEffect(() => {
    let cancelled = false

    async function loadReadiness() {
      try {
        const ready = await fetchReady()
        if (cancelled) return
        setReadyDiagnostics({
          status: String(ready.status || 'Unknown'),
          environment: ready.app?.environment || 'Unknown',
          database: ready.database?.connected ? 'Connected' : ready.database ? 'Unavailable' : 'Unknown',
          broker: ready.broker?.logged_in
            ? 'Active'
            : ready.broker?.configured
            ? 'Configured read-only context'
            : 'Unavailable',
          liveTrading: ready.live_trading_enabled ? 'Enabled by backend setting' : 'Disabled',
          error: null,
          checkedAt: Date.now(),
        })
      } catch (error) {
        if (cancelled) return
        setReadyDiagnostics((current) => ({
          ...current,
          status: 'Unavailable',
          error: classifyApiError(error),
          checkedAt: Date.now(),
        }))
      }
    }

    void loadReadiness()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <MobilePage className="flex h-full min-h-0 flex-col gap-3 pb-4 lg:pb-0">
      <div className="maet-glass-strong shrink-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-maet-text">System Status Center</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-maet-text-muted">
              Backend, market stream, broker read-only sync, live lock, reconciliation, dry-run validation, and data quality.
            </p>
          </div>
          <StatusBadge tone={apiOnline ? 'success' : 'warning'} dot>
            {apiOnline ? 'Backend connected' : backendWakeState === 'WAKING' ? 'Backend waking' : 'Backend offline'}
          </StatusBadge>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-3 xl:grid-cols-3">
          <StatusCard
            icon={<Server className="h-5 w-5" />}
            title="FastAPI Backend"
            status={apiOnline ? 'Connected' : backendWakeState === 'WAKING' ? 'Waking' : 'Offline'}
            tone={apiOnline ? 'good' : backendWakeState === 'WAKING' ? 'warn' : 'bad'}
            rows={[
              ['API base', CONNECTIVITY_TARGETS.api || 'Not configured'],
              ['Health', apiOnline ? 'Connected via /health' : backendWakeState === 'WAKING' ? 'Waking' : 'Offline'],
              ['Readiness', readyDiagnostics.status],
              ['Last ping', lastStatusFetchAt ? fmtAge(now - lastStatusFetchAt) : 'No successful ping'],
              ['CORS/Auth', corsAuthState],
            ]}
          />

          <StatusCard
            icon={wsOnline ? <Radio className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            title="Market Stream"
            status={wsOnline ? 'Connected' : wsStatus}
            tone={wsOnline ? 'good' : 'warn'}
            rows={[
              ['WS URL', CONNECTIVITY_TARGETS.ws || 'Not configured'],
              ['Last tick', lastTickAt ? fmtAge(now - lastTickAt) : 'No tick received'],
              ['Reconnect count', String(wsReconnectAttempts)],
              ['State source', terminalStatus ? 'REST/WS status available' : 'Unavailable'],
            ]}
          />

          <StatusCard
            icon={<Activity className="h-5 w-5" />}
            title="Broker Read-only"
            status={brokerStatus?.logged_in ? 'Active' : brokerStatus?.configured ? 'Configured' : 'Offline'}
            tone={brokerStatus?.logged_in ? 'good' : brokerStatus?.configured ? 'warn' : 'muted'}
            rows={[
              ['Account API', 'Read-only'],
              ['Broker mutation', 'Disabled'],
              ['Feed token', brokerStatus?.feed_token_available ? 'Available' : 'Unavailable'],
              ['Token status', brokerStatus?.logged_in ? 'Obfuscated' : 'Not active'],
            ]}
          />

          <LiveLockCard manualOrderLabel={manualOrderLabel} reconciliationLabel={reconciliationLabel} />

          <StatusCard
            icon={<Database className="h-5 w-5" />}
            title="Reconciliation"
            status={reconciliationLabel}
            tone={reconciliationLabel === 'OK' ? 'good' : reconciliationLabel.includes('mismatch') ? 'warn' : 'muted'}
            rows={[
              ['Portfolio state', reconciliationStatus?.data_status ?? 'Unavailable'],
              ['Mismatch count', reconciliationStatus ? String(reconciliationStatus.summary.mismatch_count) : 'Locked or not checked'],
              ['OMS orders', omsStatus?.oms ? String(omsStatus.oms.total_orders) : 'Locked or not checked'],
              ['OMS fills', omsStatus?.oms ? String(omsStatus.oms.fill_count) : 'Locked or not checked'],
            ]}
          />

          <StatusCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Manual-order Dry-run"
            status={manualOrderLabel}
            tone={manualOrderStatus?.validation_only ? 'good' : 'muted'}
            rows={[
              ['validation_only', manualOrderStatus?.validation_only ? 'true' : 'Unknown'],
              ['dry_run', manualOrderStatus?.dry_run ? 'true' : 'Unknown'],
              ['creates_fill', manualOrderStatus?.creates_fill ? 'true' : 'false'],
              ['creates_broker_order', manualOrderStatus?.creates_broker_order ? 'true' : 'false'],
            ]}
          />

          <StatusCard
            icon={<KeyRound className="h-5 w-5" />}
            title="API Config"
            status={readyDiagnostics.environment}
            tone={readyDiagnostics.status.toLowerCase() === 'ready' ? 'good' : readyDiagnostics.error ? 'bad' : 'warn'}
            rows={[
              ['Environment', readyDiagnostics.environment],
              ['Database', readyDiagnostics.database],
              ['Broker', readyDiagnostics.broker],
              ['Live trading', readyDiagnostics.liveTrading],
              ['Checked', readyDiagnostics.checkedAt ? fmtAge(now - readyDiagnostics.checkedAt) : 'Pending'],
            ]}
          />

          <StatusCard
            icon={<Database className="h-5 w-5" />}
            title="Data Quality"
            status={candleSymbols > 0 ? 'Candle cache visible' : 'No candle cache'}
            tone={candleSymbols > 0 ? 'good' : 'muted'}
            rows={[
              ['Symbols cached', String(candleSymbols)],
              ['Timeframes', supportedTimeframes],
              ['Indicator engine', terminalStatus?.indicator_engine?.available ? terminalStatus.indicator_engine.selected_engine : 'Unavailable'],
              ['Trading mode', terminalStatus?.trading_mode ?? 'PAPER'],
            ]}
          />
        </div>

        {(connectionError || lastStatusError) && (
          <details className="maet-glass mt-3 p-4">
            <summary className="cursor-pointer font-heading text-sm font-bold text-maet-red">Connection diagnostics</summary>
            <p className="mt-3 break-words font-mono text-xs leading-5 text-maet-text-soft">{connectionIssue}</p>
          </details>
        )}
      </div>
    </MobilePage>
  )
}

type Tone = 'good' | 'warn' | 'bad' | 'muted'

function StatusCard({
  icon,
  title,
  status,
  tone,
  rows,
}: {
  icon: ReactNode
  title: string
  status: string
  tone: Tone
  rows: [string, string][]
}) {
  return (
    <div className="maet-glass p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', toneClass(tone).box)}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="font-heading text-base font-bold text-maet-text">{title}</div>
            <div className="mt-0.5 truncate text-sm text-maet-text-muted">{status}</div>
          </div>
        </div>
        <StatusOrb tone={tone === 'good' ? 'green' : tone === 'bad' ? 'red' : tone === 'warn' ? 'amber' : 'muted'} pulse={tone === 'good'} />
      </div>
      <div className="space-y-2 border-t border-white/10 pt-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[122px_minmax(0,1fr)] gap-3 text-sm">
            <span className="text-maet-text-muted">{label}</span>
            <span className="break-words font-mono text-maet-text-soft">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LiveLockCard({ manualOrderLabel, reconciliationLabel }: { manualOrderLabel: string; reconciliationLabel: string }) {
  return (
    <div className="maet-glass-strong border-maet-amber/40 p-4 xl:col-span-2">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-maet-amber/40 bg-maet-amber/10 text-maet-amber">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div>
          <div className="font-heading text-lg font-bold text-maet-text">Execution Safety</div>
          <p className="mt-1 text-sm text-maet-text-muted">Live order placement remains locked in this build.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <SafetyLine label="LIVE LOCKED" value="true" />
        <SafetyLine label="PAPER MODE" value="true" />
        <SafetyLine label="READ ONLY" value="broker context" />
        <SafetyLine label="AI ADVISORY ONLY" value="true" />
        <SafetyLine label="BROKER MUTATION DISABLED" value="true" />
        <SafetyLine label="DRY-RUN VALIDATION" value={manualOrderLabel} />
        <SafetyLine label="RECONCILIATION" value={reconciliationLabel} />
      </div>
    </div>
  )
}

function SafetyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-maet-amber/20 bg-maet-amber/10 px-3 py-2">
      <span className="text-xs font-bold text-maet-amber">{label}</span>
      <span className="font-mono text-xs font-bold text-maet-text">{value}</span>
    </div>
  )
}

function toneClass(tone: Tone) {
  return {
    good: { box: 'border-maet-green/30 bg-maet-green/10 text-maet-green' },
    warn: { box: 'border-maet-amber/30 bg-maet-amber/10 text-maet-amber' },
    bad: { box: 'border-maet-red/30 bg-maet-red/10 text-maet-red' },
    muted: { box: 'border-white/10 bg-maet-panel-soft text-maet-text-muted' },
  }[tone]
}

function classifyApiError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.status === 0) return 'Backend unreachable or CORS blocked'
    if (error.status === 401 || error.status === 403) return 'Auth failure detected'
    return `HTTP ${error.status}`
  }
  return 'Backend readiness check failed'
}

function classifyConnectivityIssue(message: string | null): string {
  if (!message) return 'No CORS/auth issue detected'
  const lower = message.toLowerCase()
  if (lower.includes('cors')) return 'CORS failure detected'
  if (lower.includes('401') || lower.includes('403') || lower.includes('auth')) return 'Auth failure detected'
  if (lower.includes('backend unreachable') || lower.includes('offline')) {
    return 'Backend unreachable or CORS blocked'
  }
  return message
}

function safeDiagnosticMessage(message: string | null): string | null {
  if (!message) return null
  const withoutStack = message.split('\n')[0] || 'Connection issue detected'
  return withoutStack.replace(/(token|secret|password|jwt|totp|refresh|auth)=([^&\s]+)/gi, '$1=REDACTED')
}
