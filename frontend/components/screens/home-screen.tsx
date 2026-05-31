'use client'

import {
  List, BarChart2, Briefcase, Brain,
  ChevronRight, BookOpen, Activity
} from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { SafetyStatusCard } from '@/components/ui-maet/safety-status-card'
import { MobilePage } from '@/components/mobile/mobile-page'
import { PremiumCard } from '@/components/ui-maet/premium-card'
import { SectionTitle } from '@/components/ui-maet/section-title'

const QUICK_ACTIONS: {
  id: AppTab
  label: string
  sub: string
  Icon: React.FC<{ className?: string }>
  color: string
  bg: string
}[] = [
  {
    id: 'watchlist',
    label: 'Watchlist',
    sub: 'Track NSE/BSE instruments',
    Icon: List,
    color: 'text-[#22D3EE]',
    bg: 'bg-[#22D3EE]/10 border-[#22D3EE]/20',
  },
  {
    id: 'chart',
    label: 'Chart & Execution',
    sub: 'Interactive visual trading',
    Icon: BarChart2,
    color: 'text-[#16C784]',
    bg: 'bg-[#16C784]/10 border-[#16C784]/20',
  },
  {
    id: 'portfolio',
    label: 'Portfolio Snapshot',
    sub: 'Read-only holdings & positions',
    Icon: Briefcase,
    color: 'text-[#F59E0B]',
    bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20',
  },
  {
    id: 'ai',
    label: 'AI Advisory Desk',
    sub: 'Co-pilot research advisory',
    Icon: Brain,
    color: 'text-[#A855F7]',
    bg: 'bg-[#A855F7]/10 border-[#A855F7]/20',
  },
  {
    id: 'system',
    label: 'System Telemetry',
    sub: 'Observability logs & diagnostics',
    Icon: Activity,
    color: 'text-[#38BDF8]',
    bg: 'bg-[#38BDF8]/10 border-[#38BDF8]/20',
  },
]

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <MobilePage className="space-y-6 pb-4">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-xl font-extrabold text-text tracking-tight leading-tight">
          Welcome back, Operator
        </h1>
        <p className="text-xs text-text-dim mt-1 font-medium">
          Sandbox Trading &amp; Research Workspace
        </p>
      </div>

      {/* Safety Status Card */}
      <SafetyStatusCard />

      {/* Quick Actions */}
      <div>
        <SectionTitle title="Terminal Modules" />
        <div className="space-y-3">
          {QUICK_ACTIONS.map(({ id, label, sub, Icon, color, bg }) => (
            <PremiumCard
              key={id}
              onClick={() => onNavigate(id)}
              className="flex items-center gap-3.5 p-3.5"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-text tracking-wide">{label}</div>
                <div className="text-[11px] text-text-dim truncate mt-0.5 font-medium">{sub}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-faint shrink-0" />
            </PremiumCard>
          ))}
        </div>
      </div>

      {/* Product disclaimer */}
      <PremiumCard className="border-white/[0.05] bg-white/[0.01] p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-text-faint mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-bold text-text mb-1 uppercase tracking-wider">About MAET Terminal</div>
            <p className="text-2xs text-text-faint leading-relaxed font-medium">
              MAET is an analytics, compliance, and dry-run execution assistant. Live order placement is permanently locked. Dry-run operations validate parameters locally and simulate fills against read-only market models.
            </p>
          </div>
        </div>
      </PremiumCard>

      {/* Version note */}
      <div className="text-center text-[10px] text-text-faint font-semibold tracking-wider uppercase">
        MAET BUILD v0.1.0 · PAPER ONLY · LIVE LOCKED
      </div>
    </MobilePage>
  )
}
