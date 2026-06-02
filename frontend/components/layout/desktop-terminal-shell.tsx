'use client'

import { Activity, BarChart2, Brain, Briefcase, List, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { DesktopSidebar } from './desktop-sidebar'
import { DesktopTopBar } from './desktop-top-bar'
import { HomeScreen } from '@/components/screens/home-screen'
import { WatchlistScreen } from '@/components/screens/watchlist-screen'
import { ChartScreen } from '@/components/screens/chart-screen'
import { PortfolioScreen } from '@/components/screens/portfolio-screen'
import { AiScreen } from '@/components/screens/ai-screen'
import { SystemScreen } from '@/components/screens/system-screen'
import { OrderTicket } from '@/components/terminal/order-ticket'
import { SafetyStatusCard } from '@/components/ui-maet/safety-status-card'
import { AppCard } from '@/components/ui-maet/app-card'
import { SectionHeader } from '@/components/ui-maet/section-header'

interface DesktopTerminalShellProps {
  activeTab: AppTab
  onNavigate: (tab: AppTab) => void
}

export function DesktopTerminalShell({ activeTab, onNavigate }: DesktopTerminalShellProps) {
  return (
    <div className="desktop-app flex h-dvh overflow-hidden bg-[#071018] text-text">
      <DesktopSidebar active={activeTab} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopTopBar activeTab={activeTab} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_32%),#071018] p-4 xl:p-5">
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
      <div className="grid min-h-[calc(100dvh-104px)] grid-cols-[300px_minmax(0,1fr)] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <DesktopPane title="Watchlist" icon={<List className="h-4 w-4" />}>
          <WatchlistScreen onNavigate={onNavigate} />
        </DesktopPane>
        <DesktopPane title="Chart and Indicators" icon={<BarChart2 className="h-4 w-4" />} primary>
          <ChartScreen />
        </DesktopPane>
        <div className="grid gap-4 lg:col-span-2 xl:col-span-1 xl:grid-rows-[auto_minmax(0,1fr)]">
          <DesktopPane title="Safety State" icon={<ShieldCheck className="h-4 w-4" />} compact>
            <SafetyStatusCard />
          </DesktopPane>
          <DesktopPane title="Dry-Run Order Ticket" icon={<ShieldCheck className="h-4 w-4" />}>
            <OrderTicket />
          </DesktopPane>
        </div>
      </div>
    )
  }

  if (activeTab === 'watchlist') {
    return (
      <div className="grid min-h-[calc(100dvh-104px)] grid-cols-[380px_minmax(0,1fr)] gap-4">
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
      <div className="grid min-h-[calc(100dvh-104px)] grid-cols-[minmax(0,1fr)_360px] gap-4">
        <DesktopPane title="Read-Only Portfolio" icon={<Briefcase className="h-4 w-4" />} primary>
          <PortfolioScreen />
        </DesktopPane>
        <DesktopPane title="System Safety" icon={<ShieldCheck className="h-4 w-4" />}>
          <SystemScreen />
        </DesktopPane>
      </div>
    )
  }

  if (activeTab === 'ai') {
    return (
      <div className="grid min-h-[calc(100dvh-104px)] grid-cols-[minmax(0,1fr)_360px] gap-4">
        <DesktopPane title="AI Advisory Only" icon={<Brain className="h-4 w-4" />} primary>
          <AiScreen />
        </DesktopPane>
        <DesktopPane title="Execution Lock" icon={<ShieldCheck className="h-4 w-4" />}>
          <SafetyStatusCard />
        </DesktopPane>
      </div>
    )
  }

  return (
    <div className="grid min-h-[calc(100dvh-104px)] grid-cols-[minmax(0,1fr)_360px] gap-4">
      <DesktopPane title="System Readiness" icon={<Activity className="h-4 w-4" />} primary>
        <SystemScreen />
      </DesktopPane>
      <DesktopPane title="Safety Policy" icon={<ShieldCheck className="h-4 w-4" />}>
        <SafetyStatusCard />
      </DesktopPane>
    </div>
  )
}

function DesktopHome({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  const modules: { tab: AppTab; title: string; body: string; Icon: React.FC<{ className?: string }> }[] = [
    { tab: 'watchlist', title: 'Watchlist', body: 'Search NSE/BSE symbols and open the chart workspace.', Icon: List },
    { tab: 'chart', title: 'Chart Workspace', body: 'Large chart area, indicators, external handoffs, and dry-run validation.', Icon: BarChart2 },
    { tab: 'portfolio', title: 'Portfolio', body: 'Read-only broker snapshot with reconciliation states.', Icon: Briefcase },
    { tab: 'ai', title: 'AI Advisory', body: 'Passive research notes only. AI cannot place orders.', Icon: Brain },
  ]

  return (
    <div className="grid min-h-[calc(100dvh-104px)] grid-cols-[minmax(0,1fr)_380px] gap-4">
      <div className="space-y-4">
        <AppCard className="p-6">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex rounded-full border border-info/20 bg-info/10 px-3 py-1 text-xs font-bold uppercase text-info">
              Safety-first market analytics
            </div>
            <h2 className="text-3xl font-extrabold leading-tight text-text">
              Premium paper trading workspace for Indian markets.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-dim">
              Use MAET to review watchlists, chart context, read-only broker snapshots, dry-run validation, and advisory notes without enabling live broker mutation.
            </p>
          </div>
        </AppCard>

        <div className="grid grid-cols-2 gap-4">
          {modules.map(({ tab, title, body, Icon }) => (
            <button
              key={tab}
              type="button"
              onClick={() => onNavigate(tab)}
              className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5 text-left transition-all hover:border-info/25 hover:bg-white/[0.07] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60"
            >
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-info/20 bg-info/10 text-info">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-extrabold text-text">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-dim">{body}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <SafetyStatusCard />
        <DesktopPane title="Mobile Overview" icon={<Activity className="h-4 w-4" />}>
          <HomeScreen onNavigate={onNavigate} />
        </DesktopPane>
      </div>
    </div>
  )
}

function DesktopPane({
  title,
  icon,
  children,
  primary = false,
  compact = false,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  primary?: boolean
  compact?: boolean
}) {
  return (
    <section className="desktop-pane flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0B1220]/88 shadow-card">
      <SectionHeader title={title} icon={icon} className="shrink-0 px-4 py-3" />
      <div className={primary ? 'min-h-0 flex-1' : compact ? 'min-h-0' : 'min-h-0 flex-1'}>
        {children}
      </div>
    </section>
  )
}
