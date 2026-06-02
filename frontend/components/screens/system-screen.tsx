'use client'

import type { ReactNode } from 'react'
import { Activity, Database, Radio, Server, ShieldCheck, WifiOff } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { useTerminalStore } from '@/store/terminal-store'
import { API_URL, WS_URL } from '@/lib/constants'
import { cn, fmtAge } from '@/lib/utils'
import { useNow } from '@/lib/use-now'

export function SystemScreen() {
  const now = useNow()
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const brokerStatus = useTerminalStore((s) => s.brokerStatus)
  const terminalStatus = useTerminalStore((s) => s.terminalStatus)
  const lastStatusFetchAt = useTerminalStore((s) => s.lastStatusFetchAt)
  const lastTickAt = useTerminalStore((s) => s.lastTickAt)
  const wsReconnectAttempts = useTerminalStore((s) => s.wsReconnectAttempts)
  const connectionError = useTerminalStore((s) => s.connectionError)
  const lastStatusError = useTerminalStore((s) => s.lastStatusError)

  const apiOnline = apiStatus === 'ONLINE'
  const wsOnline = wsStatus === 'CONNECTED'
  const candleSymbols = terminalStatus?.candles?.symbols?.length ?? 0
  const supportedTimeframes = terminalStatus?.candles?.supported_timeframes?.join(', ') || 'Unavailable'

  return (
    <MobilePage className="flex h-full flex-col space-y-4 pb-4">
      <div className="shrink-0 rounded-card border border-maet-border bg-maet-surface p-4">
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
            ['Target', API_URL || 'Not configured'],
            ['Last ping', lastStatusFetchAt ? fmtAge(now - lastStatusFetchAt) : 'No successful ping'],
            ['Response time', apiOnline ? 'Available from browser fetch' : 'Offline'],
          ]}
        />

        <TelemetryCard
          icon={wsOnline ? <Radio className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
          title="Market Stream"
          status={wsOnline ? 'Connected' : wsStatus}
          tone={wsOnline ? 'good' : 'warn'}
          rows={[
            ['Target', WS_URL || 'Not configured'],
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
            ['Session age', brokerStatus?.logged_in ? 'Token present, age hidden' : 'Unavailable'],
            ['Feed token', brokerStatus?.feed_token_available ? 'Available' : 'Unavailable'],
            ['Token status', brokerStatus?.logged_in ? 'Obfuscated' : 'Not active'],
          ]}
        />

        <div className="rounded-card border border-maet-red/40 bg-maet-red/10 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-maet-red/40 bg-maet-red/12 text-maet-red">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-heading text-base font-bold text-maet-text">Execution Safety</div>
              <div className="mt-2 rounded-md border border-maet-red/40 bg-maet-base px-3 py-2 font-mono text-xs font-bold text-maet-red">
                BUILD_LIVE_EXECUTION_ALLOWED = false
              </div>
              <p className="mt-2 text-xs leading-5 text-maet-text-secondary">Live order placement is permanently locked in this build.</p>
            </div>
          </div>
        </div>

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
          <div className="rounded-card border border-maet-red/30 bg-maet-red/10 p-3">
            <div className="font-heading text-sm font-bold text-maet-red">Current connection issue</div>
            <p className="mt-2 break-words font-mono text-xs leading-5 text-maet-text-secondary">{connectionError || lastStatusError}</p>
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
    <div className="rounded-card border border-maet-border bg-maet-surface p-4">
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

function toneClass(tone: Tone) {
  return {
    good: { box: 'border-maet-green/30 bg-maet-green/10 text-maet-green' },
    warn: { box: 'border-maet-amber/30 bg-maet-amber/10 text-maet-amber' },
    bad: { box: 'border-maet-red/30 bg-maet-red/10 text-maet-red' },
    muted: { box: 'border-maet-border bg-maet-elevated text-maet-text-muted' },
  }[tone]
}
