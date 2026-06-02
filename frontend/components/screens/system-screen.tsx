'use client'

import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Radio,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { PremiumCard } from '@/components/ui-maet/premium-card'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { useTerminalStore } from '@/store/terminal-store'
import { API_URL, WS_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function SystemScreen() {
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const backendWakeState = useTerminalStore((s) => s.backendWakeState)
  const backendOffline = useTerminalStore((s) => s.backendOffline)
  const brokerStatus = useTerminalStore((s) => s.brokerStatus)
  const terminalStatus = useTerminalStore((s) => s.terminalStatus)
  const reconciliation = useTerminalStore((s) => s.reconciliationStatus)
  const connectionError = useTerminalStore((s) => s.connectionError)
  const lastStatusError = useTerminalStore((s) => s.lastStatusError)
  const portfolioSummary = useTerminalStore((s) => s.portfolioSummary)

  const apiOnline = apiStatus === 'ONLINE' && !backendOffline
  const wsOnline = wsStatus === 'CONNECTED'
  const brokerReadOnly = brokerStatus?.configured ? 'CONFIGURED' : 'NOT CONFIGURED'
  const mismatchCount = reconciliation?.summary?.mismatch_count ?? 0

  return (
    <MobilePage className="flex flex-col h-full pb-4 space-y-4">
      <PremiumCard className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-info/10 border border-info/25 flex items-center justify-center text-info shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-text leading-tight">System Readiness</h2>
            <p className="text-xs text-text-dim leading-relaxed mt-1">
              Operational health, live-lock policy, broker sync, and reconciliation shown as readable mobile states.
            </p>
          </div>
        </div>
      </PremiumCard>

      <div className="grid grid-cols-2 gap-3 shrink-0">
        <StatusCard
          title="Backend"
          value={apiOnline ? 'ONLINE' : backendWakeState === 'WAKING' ? 'WAKING' : 'OFFLINE'}
          tone={apiOnline ? 'good' : backendWakeState === 'WAKING' ? 'warn' : 'bad'}
          icon={apiOnline ? <CheckCircle2 className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        />
        <StatusCard
          title="Market Stream"
          value={wsOnline ? 'CONNECTED' : wsStatus}
          tone={wsOnline ? 'good' : 'warn'}
          icon={<Radio className="w-4 h-4" />}
        />
        <StatusCard
          title="Mode"
          value={terminalStatus?.trading_mode ?? 'PAPER'}
          tone="warn"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatusCard
          title="Live Lock"
          value="LOCKED"
          tone="bad"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-0.5">
        <div>
          <SectionTitle title="Readiness" />
          <div className="space-y-3">
            <DetailCard
              icon={<Database className="w-4 h-4" />}
              title="API Target"
              status={apiOnline ? 'Reachable' : 'Backend not connected'}
              tone={apiOnline ? 'good' : 'bad'}
              rows={[
                ['REST', API_URL || 'Not configured'],
                ['WebSocket', WS_URL || 'Not configured'],
              ]}
            />

            <DetailCard
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Execution Safety"
              status="Live execution is locked"
              tone="bad"
              rows={[
                ['live_execution_enabled', 'false'],
                ['broker_mutation_allowed', 'false'],
                ['order_flow', 'dry-run validation only'],
              ]}
            />

            <DetailCard
              icon={<Radio className="w-4 h-4" />}
              title="Broker Sync"
              status={brokerReadOnly}
              tone={brokerStatus?.configured ? 'warn' : 'neutral'}
              rows={[
                ['mode', 'read-only broker snapshot'],
                ['logged_in', String(Boolean(brokerStatus?.logged_in))],
                ['feed_token', String(Boolean(brokerStatus?.feed_token_available))],
              ]}
            />

            <DetailCard
              icon={<RefreshCw className="w-4 h-4" />}
              title="Reconciliation"
              status={mismatchCount > 0 ? `${mismatchCount} mismatch${mismatchCount === 1 ? '' : 'es'}` : 'No mismatches loaded'}
              tone={mismatchCount > 0 ? 'warn' : 'neutral'}
              rows={[
                ['portfolio_data', portfolioSummary?.data_status ?? 'UNAVAILABLE'],
                ['source_of_truth', portfolioSummary?.source_of_truth ?? 'Not available'],
              ]}
            />
          </div>
        </div>

        {(connectionError || lastStatusError) && (
          <div>
            <SectionTitle title="Diagnostics" />
            <div className="rounded-2xl border border-[#EA3943]/20 bg-[#EA3943]/5 p-3.5 text-xs text-text-dim leading-relaxed">
              <div className="flex items-center gap-2 text-[#EA3943] font-bold uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4" />
                Current Connection Issue
              </div>
              <p className="font-mono break-words">
                {connectionError || lastStatusError}
              </p>
            </div>
          </div>
        )}
      </div>
    </MobilePage>
  )
}

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

function StatusCard({
  title,
  value,
  tone,
  icon,
}: {
  title: string
  value: string
  tone: Tone
  icon: ReactNode
}) {
  return (
    <PremiumCard className="p-3.5 min-h-[96px]">
      <div className={cn('w-8 h-8 rounded-xl border flex items-center justify-center mb-3', toneClasses(tone).soft)}>
        {icon}
      </div>
      <div className="text-[10px] text-text-dim uppercase tracking-wider font-bold">{title}</div>
      <div className={cn('text-xs font-mono font-extrabold mt-1 truncate', toneClasses(tone).text)}>{value}</div>
    </PremiumCard>
  )
}

function DetailCard({
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
    <PremiumCard className="p-3.5">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-8 h-8 rounded-xl border flex items-center justify-center shrink-0', toneClasses(tone).soft)}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-text truncate">{title}</div>
            <div className={cn('text-[10px] font-mono font-bold mt-0.5', toneClasses(tone).text)}>{status}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 text-[10px] font-mono">
            <span className="text-text-faint uppercase tracking-wider">{label}</span>
            <span className="text-text-dim text-right break-all">{value}</span>
          </div>
        ))}
      </div>
    </PremiumCard>
  )
}

function toneClasses(tone: Tone) {
  return {
    good: {
      soft: 'bg-[#16C784]/10 border-[#16C784]/20 text-[#16C784]',
      text: 'text-[#16C784]',
    },
    warn: {
      soft: 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]',
      text: 'text-[#F59E0B]',
    },
    bad: {
      soft: 'bg-[#EA3943]/10 border-[#EA3943]/20 text-[#EA3943]',
      text: 'text-[#EA3943]',
    },
    neutral: {
      soft: 'bg-white/[0.04] border-white/[0.08] text-text-dim',
      text: 'text-text-dim',
    },
  }[tone]
}
