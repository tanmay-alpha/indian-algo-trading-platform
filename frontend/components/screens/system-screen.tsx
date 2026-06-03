'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Activity, Database, Radio, Server, ShieldCheck, WifiOff } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { StatusBadge } from '@/components/ui-maet/status-badge'
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
  const manualOrderLabel = manualOrderStatus?.validation_only
    ? 'Validation only'
    : 'Locked or not checked'
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
          database: ready.database?.connected
            ? 'Connected'
            : ready.database
            ? 'Unavailable'
            : 'Unknown',
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
    <MobilePage className="flex h-full flex-col space-y-4 pb-4">
      <div className="reflection-card shrink-0 p-4">
        <h1 className="font-heading text-xl font-bold text-maet-text">System Health</h1>
        <p className="mt-1 text-xs leading-5 text-maet-text-secondary">Operational telemetry for the MAET frontend, backend, broker session, and market stream.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto space-y-3">
        <TelemetryCard
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

        <TelemetryCard
          icon={wsOnline ? <Radio className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
          title="Market Stream"
          status={wsOnline ? 'Connected' : wsStatus}
          tone={wsOnline ? 'good' : 'warn'}
          rows={[
            ['WS URL', CONNECTIVITY_TARGETS.ws || 'Not configured'],
            ['Last tick', lastTickAt ? fmtAge(now - lastTickAt) : 'No tick received'],
            ['Reconnect count', String(wsReconnectAttempts)],
          ]}
        />

        <TelemetryCard
          icon={<Activity className="h-5 w-5" />}
          title="Angel One Session"
          status={brokerStatus?.logged_in ? 'Active' : brokerStatus?.configured ? 'Configured' : 'Offline'}
          tone={brokerStatus?.logged_in ? 'good' : brokerStatus?.configured ? 'warn' : 'muted'}
          rows={[
            ['Account API', 'Read-only'],
            ['Broker mutation', 'Disabled'],
            ['Session age', brokerStatus?.logged_in ? 'Token present, age hidden' : 'Unavailable'],
            ['Feed token', brokerStatus?.feed_token_available ? 'Available' : 'Unavailable'],
            ['Token status', brokerStatus?.logged_in ? 'Obfuscated' : 'Not active'],
          ]}
        />

        <div className="reflection-card border-maet-red/40 bg-maet-red/10 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-maet-red/40 bg-maet-red/12 text-maet-red">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-heading text-base font-bold text-maet-text">Execution Safety</div>
              <div className="mt-2 rounded-md border border-maet-red/40 bg-maet-base px-3 py-2 font-mono text-xs font-bold text-maet-red">
                BUILD_LIVE_EXECUTION_ALLOWED = false
              </div>
              <div className="mt-3 grid gap-2 font-mono text-xs">
                <SafetyLine label="LIVE LOCKED" value="true" />
                <SafetyLine label="PAPER MODE" value="true" />
                <SafetyLine label="READ ONLY" value="broker context" />
                <SafetyLine label="AI ADVISORY ONLY" value="true" />
                <SafetyLine label="BROKER MUTATION DISABLED" value="true" />
                <SafetyLine label="DRY-RUN VALIDATION" value={manualOrderLabel} />
                <SafetyLine label="RECONCILIATION" value={reconciliationLabel} />
              </div>
              <p className="mt-2 text-xs leading-5 text-maet-text-secondary">Live order placement is permanently locked in this build.</p>
            </div>
          </div>
        </div>

        <TelemetryCard
          icon={<Database className="h-5 w-5" />}
          title="Readiness"
          status={readyDiagnostics.status}
          tone={readyDiagnostics.status.toLowerCase() === 'ready' ? 'good' : readyDiagnostics.error ? 'bad' : 'warn'}
          rows={[
            ['Environment', readyDiagnostics.environment],
            ['Database', readyDiagnostics.database],
            ['Broker', readyDiagnostics.broker],
            ['Live trading', readyDiagnostics.liveTrading],
            ['Checked', readyDiagnostics.checkedAt ? fmtAge(now - readyDiagnostics.checkedAt) : 'Pending'],
          ]}
        />

        <TelemetryCard
          icon={<Database className="h-5 w-5" />}
          title="CandleStore"
          status={candleSymbols > 0 ? 'Cached' : 'Offline'}
          tone={candleSymbols > 0 ? 'good' : 'muted'}
          rows={[
            ['Symbols cached', String(candleSymbols)],
            ['Timeframes', supportedTimeframes],
            ['Cache age', terminalStatus?.candles ? 'Available from backend status' : 'Unavailable'],
          ]}
        />

        {(connectionError || lastStatusError) && (
          <div className="reflection-card border-maet-red/30 bg-maet-red/10 p-3">
            <div className="font-heading text-sm font-bold text-maet-red">Current connection issue</div>
            <p className="mt-2 break-words font-mono text-xs leading-5 text-maet-text-secondary">{connectionIssue}</p>
          </div>
        )}
      </div>
    </MobilePage>
  )
}

type Tone = 'good' | 'warn' | 'bad' | 'muted'

function TelemetryCard({
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
    <div className="reflection-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-md border', toneClass(tone).box)}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="font-heading text-base font-bold text-maet-text">{title}</div>
            <div className="mt-0.5 text-xs text-maet-text-muted">{status}</div>
          </div>
        </div>
        <StatusBadge tone={tone === 'good' ? 'success' : tone === 'bad' ? 'danger' : tone === 'warn' ? 'warning' : 'muted'} dot={tone !== 'muted'}>
          {status}
        </StatusBadge>
      </div>
      <div className="space-y-2 border-t border-maet-border pt-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-xs">
            <span className="text-maet-text-muted">{label}</span>
            <span className="break-words font-mono text-maet-text-secondary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SafetyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-maet-red/20 bg-maet-bg-deep/36 px-3 py-2">
      <span className="text-maet-red">{label}</span>
      <span className="text-maet-text">{value}</span>
    </div>
  )
}

function toneClass(tone: Tone) {
  return {
    good: { box: 'border-maet-green/30 bg-maet-green/10 text-maet-green' },
    warn: { box: 'border-maet-amber/30 bg-maet-amber/10 text-maet-amber' },
    bad: { box: 'border-maet-red/30 bg-maet-red/10 text-maet-red' },
    muted: { box: 'border-maet-border bg-maet-elevated text-maet-text-muted' },
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
