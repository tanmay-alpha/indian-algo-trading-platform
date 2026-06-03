'use client'

import { Activity, BarChart2, Brain, Briefcase, List, Search, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { DesktopSidebar } from './desktop-sidebar'
import { DesktopTopBar } from './desktop-top-bar'
import { WatchlistScreen } from '@/components/screens/watchlist-screen'
import { ChartScreen } from '@/components/screens/chart-screen'
import { PortfolioScreen } from '@/components/screens/portfolio-screen'
import { AiScreen } from '@/components/screens/ai-screen'
import { SystemScreen } from '@/components/screens/system-screen'
import { ChartRightPanel, OrderTicket } from '@/components/screens/order-ticket'
import { AppCard } from '@/components/ui-maet/app-card'
import { SectionHeader } from '@/components/ui-maet/section-header'
import { ReflectionCard } from '@/components/effects/reflection-card'
import { useTerminalStore } from '@/store/terminal-store'

interface DesktopTerminalShellProps {
  activeTab: AppTab
  onNavigate: (tab: AppTab) => void
}

export function DesktopTerminalShell({ activeTab, onNavigate }: DesktopTerminalShellProps) {
  return (
    <div className="desktop-app flex h-full overflow-hidden bg-transparent text-maet-text">
      <DesktopSidebar active={activeTab} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopTopBar activeTab={activeTab} />
        <main className="min-h-0 flex-1 overflow-y-auto p-3 xl:p-4">
          <DesktopWorkspace activeTab={activeTab} onNavigate={onNavigate} />
        </main>
      </div>
    </div>
  )
}

function DesktopWorkspace({ activeTab, onNavigate }: DesktopTerminalShellProps) {
  if (activeTab === 'home') {
    return <DesktopHome onNavigate={onNavigate} />
  }

  if (activeTab === 'chart') {
    return (
      <div className="grid min-h-[calc(100dvh-104px)] gap-3 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px] 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <DesktopPane title="Market Watch" icon={<List className="h-4 w-4" />} compact>
          <WatchlistScreen onNavigate={onNavigate} />
        </DesktopPane>
        <section className="min-h-0">
          <ChartScreen />
        </section>
        <DesktopPane title="Safety And Validation" icon={<ShieldCheck className="h-4 w-4" />} compact className="lg:col-span-2 xl:col-span-1">
          <ChartRightPanel />
        </DesktopPane>
      </div>
    )
  }

  if (activeTab === 'watchlist') {
    return (
      <div className="grid min-h-[calc(100dvh-112px)] grid-cols-[380px_minmax(0,1fr)] gap-4">
        <DesktopPane title="Watchlist" icon={<List className="h-4 w-4" />}>
          <WatchlistScreen onNavigate={onNavigate} />
        </DesktopPane>
        <DesktopPane title="Chart Preview" icon={<BarChart2 className="h-4 w-4" />} primary>
          <ChartScreen />
        </DesktopPane>
      </div>
    )
  }

  if (activeTab === 'portfolio') {
    return (
      <div className="grid min-h-[calc(100dvh-112px)] grid-cols-[minmax(0,1fr)_360px] gap-4">
        <DesktopPane title="Read-Only Portfolio" icon={<Briefcase className="h-4 w-4" />} primary>
          <PortfolioScreen />
        </DesktopPane>
        <DesktopPane title="System Telemetry" icon={<ShieldCheck className="h-4 w-4" />}>
          <SystemScreen />
        </DesktopPane>
      </div>
    )
  }

  if (activeTab === 'ai') {
    return (
      <div className="grid min-h-[calc(100dvh-112px)] grid-cols-[minmax(0,1fr)_360px] gap-4">
        <DesktopPane title="AI Advisory Only" icon={<Brain className="h-4 w-4" />} primary>
          <AiScreen />
        </DesktopPane>
        <DesktopPane title="System Status" icon={<ShieldCheck className="h-4 w-4" />}>
          <SystemScreen />
        </DesktopPane>
      </div>
    )
  }

  return (
    <div className="grid min-h-[calc(100dvh-112px)] grid-cols-[minmax(0,1fr)_360px] gap-4">
      <DesktopPane title="System Readiness" icon={<Activity className="h-4 w-4" />} primary>
        <SystemScreen />
      </DesktopPane>
      <DesktopPane title="Dry-Run Validation" icon={<ShieldCheck className="h-4 w-4" />}>
        <OrderTicket compact />
      </DesktopPane>
    </div>
  )
}

function DesktopHome({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const wsStatus = useTerminalStore((s) => s.wsStatus)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const modules: { tab: AppTab; title: string; body: string; Icon: React.FC<{ className?: string }> }[] = [
    { tab: 'watchlist', title: 'Watchlist', body: 'Search NSE/BSE symbols and open the chart workspace.', Icon: List },
    { tab: 'chart', title: 'Chart Workspace', body: 'Large chart area, indicators, external handoffs, and dry-run validation.', Icon: BarChart2 },
    { tab: 'portfolio', title: 'Portfolio', body: 'Read-only broker snapshot with reconciliation states.', Icon: Briefcase },
    { tab: 'ai', title: 'AI Advisory', body: 'Passive research notes only. AI cannot place orders.', Icon: Brain },
  ]

  return (
    <div className="grid min-h-[calc(100dvh-112px)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <AppCard className="p-6 hover-glass">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="max-w-3xl">
              <h2 className="font-heading text-3xl font-bold leading-tight text-maet-text xl-heading">
                Start from a symbol.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-maet-text-secondary">
                Search or pick a watchlist row, open the chart, then validate a dry-run ticket if the parameters need a risk-gate check.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('watchlist')}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-maet-blue px-4 text-sm font-bold text-white hover:bg-[#6fb2ff]"
              >
                <Search className="h-4 w-4" />
                Search instruments
              </button>
            </div>
            <div className="rounded-card border border-maet-border bg-maet-base p-4">
              <div className="font-mono text-xs text-maet-text-muted">Market session panel</div>
              <div className="mt-3 grid gap-2">
                <StatusLine label="Market data" value={apiStatus === 'ONLINE' ? 'Online' : 'Unavailable'} good={apiStatus === 'ONLINE'} />
                <StatusLine label="Market stream" value={wsStatus === 'CONNECTED' ? 'Connected' : wsStatus} good={wsStatus === 'CONNECTED'} />
                <StatusLine label="Selected symbol" value={selectedSymbol ?? 'None selected'} />
              </div>
            </div>
          </div>
        </AppCard>

        <div className="grid grid-cols-2 gap-4">
          {modules.map(({ tab, title, body, Icon }) => (
            <button
              key={tab}
              type="button"
              onClick={() => onNavigate(tab)}
              className="reflection-card p-5 text-left transition-all hover-glass active:scale-[0.985]"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-md border border-maet-blue/25 bg-maet-blue/10 text-maet-blue">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-lg font-bold text-maet-text">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-maet-text-secondary">{body}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        <DesktopPane title="Trading Guardrails" icon={<ShieldCheck className="h-4 w-4" />}>
          <HomeGuardrails apiStatus={apiStatus} wsStatus={wsStatus} selectedSymbol={selectedSymbol} onNavigate={onNavigate} />
        </DesktopPane>
      </div>
    </div>
  )
}

function HomeGuardrails({
  apiStatus,
  wsStatus,
  selectedSymbol,
  onNavigate,
}: {
  apiStatus: string
  wsStatus: string
  selectedSymbol: string | null
  onNavigate: (tab: AppTab) => void
}) {
  return (
    <div className="grid gap-3 p-3">
      <div className="rounded-xl border border-maet-amber/25 bg-maet-amber/10 p-3">
        <div className="font-heading text-sm font-bold text-maet-text">Safe research mode</div>
        <p className="mt-2 text-sm leading-6 text-maet-text-muted">
          Paper validation only. Live execution is locked and broker context stays read-only.
        </p>
      </div>
      <StatusLine label="Market data" value={apiStatus === 'ONLINE' ? 'Online' : 'Unavailable'} good={apiStatus === 'ONLINE'} />
      <StatusLine label="Stream" value={wsStatus === 'CONNECTED' ? 'Connected' : wsStatus} good={wsStatus === 'CONNECTED'} />
      <StatusLine label="Selected" value={selectedSymbol ?? 'None selected'} />
      <button
        type="button"
        onClick={() => onNavigate('chart')}
        className="maet-btn maet-btn-primary h-10 text-xs"
      >
        <BarChart2 className="h-4 w-4" />
        Open chart workspace
      </button>
    </div>
  )
}

function DesktopPane({
  title,
  icon,
  children,
  primary = false,
  compact = false,
  className = '',
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  primary?: boolean
  compact?: boolean
  className?: string
}) {
  return (
    <ReflectionCard as="section" className={`desktop-pane flex min-h-0 flex-col overflow-hidden shadow-card ${className}`}>
      <SectionHeader title={title} icon={icon} className="shrink-0 px-4 py-3" />
      <div className={primary || compact ? 'min-h-0 flex-1' : 'min-h-0 flex-1'}>
        {children}
      </div>
    </ReflectionCard>
  )
}

function StatusLine({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-maet-border bg-maet-surface px-3 py-2">
      <span className="text-xs text-maet-text-muted">{label}</span>
      <span className="flex items-center gap-2 font-mono text-xs font-bold text-maet-text">
        {good != null && <span className={good ? 'h-1.5 w-1.5 rounded-full bg-maet-green' : 'h-1.5 w-1.5 rounded-full bg-maet-red'} />}
        {value}
      </span>
    </div>
  )
}
