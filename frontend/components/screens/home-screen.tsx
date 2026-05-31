'use client'

import {
  List, BarChart2, Briefcase, Brain,
  ShieldCheck, Activity, ChevronRight, BookOpen
} from 'lucide-react'
import type { AppTab } from '@/components/mobile/mobile-bottom-nav'
import { SafetyStatusCard } from '@/components/maet/safety-status-card'
import { MobilePage } from '@/components/mobile/mobile-page'

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
    color: 'text-info',
    bg: 'bg-info/10 border-info/20',
  },
  {
    id: 'chart',
    label: 'Chart',
    sub: 'View candles & indicators',
    Icon: BarChart2,
    color: 'text-up',
    bg: 'bg-up/10 border-up/20',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    sub: 'Read-only broker snapshot',
    Icon: Briefcase,
    color: 'text-warn',
    bg: 'bg-warn/10 border-warn/20',
  },
  {
    id: 'ai',
    label: 'AI Advisory',
    sub: 'Research assistant, advisory only',
    Icon: Brain,
    color: 'text-violet',
    bg: 'bg-violet/10 border-violet/20',
  },
]

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <MobilePage className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-text leading-tight">
          Good {getGreeting()}, Operator
        </h1>
        <p className="text-sm text-text-dim mt-0.5">
          MAET — Research & paper trading terminal
        </p>
      </div>

      {/* Safety Status Card */}
      <SafetyStatusCard />

      {/* Quick Actions */}
      <div>
        <div className="section-label mb-3">Quick Access</div>
        <div className="space-y-2">
          {QUICK_ACTIONS.map(({ id, label, sub, Icon, color, bg }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/60 bg-bg-card hover:bg-bg-card-hover active:scale-[0.985] transition-all text-left"
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text">{label}</div>
                <div className="text-xs text-text-dim truncate">{sub}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-faint shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Product disclaimer */}
      <div className="rounded-2xl border border-border/50 bg-bg-card p-4">
        <div className="flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-text-faint mt-0.5 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-text-2 mb-1">About this terminal</div>
            <p className="text-xs text-text-faint leading-relaxed">
              MAET is a research &amp; paper trading terminal for Indian NSE/BSE markets.
              Live trading is permanently locked by backend build policy.
              All order actions are dry-run validation only — no real broker orders are placed.
              AI outputs are strictly advisory.
            </p>
          </div>
        </div>
      </div>

      {/* Version note */}
      <div className="text-center text-[11px] text-text-faint font-mono pb-4">
        MAET Terminal v0.1.0 · PAPER MODE · LIVE EXECUTION LOCKED
      </div>
    </MobilePage>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
