'use client'

import Link from 'next/link'
import {
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  Database,
  Github,
  LineChart,
  Lock,
  Radio,
  ShieldCheck,
} from 'lucide-react'
import { AmbientGradient } from '@/components/effects/ambient-gradient'
import { AnimatedGrid } from '@/components/effects/animated-grid'
import { StatusPill } from '@/components/ui-maet/status-pill'

const featureSections = [
  {
    title: 'Market Watch',
    body: 'Search and monitor NSE/BSE instruments. Live values stay blank until backend data is available.',
    Icon: Radio,
  },
  {
    title: 'Charts',
    body: 'Chart-first workspace with indicator controls, external TradingView and Angel One handoffs, and honest empty states.',
    Icon: LineChart,
  },
  {
    title: 'Paper OMS',
    body: 'Manual tickets validate dry-run risk gates only. No broker order route is exposed.',
    Icon: ShieldCheck,
  },
  {
    title: 'Broker Sync',
    body: 'Broker data is treated as read-only account context and never as a mutation path.',
    Icon: Database,
  },
  {
    title: 'Reconciliation',
    body: 'Portfolio, position, and mismatch states are surfaced without inventing holdings or P&L.',
    Icon: Briefcase,
  },
  {
    title: 'AI Advisory',
    body: 'AI can summarize risk context, but execution_allowed remains false.',
    Icon: Bot,
  },
]

const safetyBadges = [
  'LIVE LOCKED',
  'PAPER MODE',
  'BROKER READ-ONLY',
  'AI ADVISORY ONLY',
  'BROKER MUTATION DISABLED',
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#071018] text-text">
      <section className="relative isolate min-h-[88dvh] border-b border-white/[0.08]">
        <AmbientGradient color="cyan" />
        <AnimatedGrid opacity={0.12} />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#0EA5E9] text-base font-extrabold text-[#071018] shadow-cyan">
              M
            </div>
            <div>
              <div className="text-base font-extrabold leading-tight">MAET Terminal</div>
              <div className="text-xs font-medium text-text-dim">Indian market analytics</div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {safetyBadges.map((badge) => (
              <StatusPill key={badge} variant={badgeTone(badge)}>
                {badge}
              </StatusPill>
            ))}
          </div>

          <Link
            href="/terminal"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#0EA5E9] px-4 text-sm font-extrabold text-[#071018] transition hover:bg-[#38BDF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/70"
          >
            Open Terminal
          </Link>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1fr)] lg:px-8 lg:pt-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-normal text-text sm:text-5xl lg:text-6xl">
              MAET Terminal
            </h1>
            <p className="mt-5 text-lg leading-8 text-text-2 sm:text-xl">
              Safety-first market analytics and paper trading terminal for Indian markets.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-text-dim">
              Review watchlists, charts, read-only broker snapshots, reconciliation state, and passive AI notes while live execution remains locked.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 md:hidden">
              {safetyBadges.map((badge) => (
                <StatusPill key={badge} variant={badgeTone(badge)}>
                  {badge}
                </StatusPill>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/terminal"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#0EA5E9] px-6 text-sm font-extrabold text-[#071018] transition hover:bg-[#38BDF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/70"
              >
                Open Terminal
              </Link>
              <a
                href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View MAET Terminal GitHub repository"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.05] px-6 text-sm font-bold text-text transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/70"
              >
                <Github className="h-4 w-4" />
                View GitHub
              </a>
            </div>

            <div className="mt-8 rounded-2xl border border-warn/20 bg-warn/10 px-4 py-3 text-sm font-semibold text-warn">
              Visual demo — not live market data. No live broker order placement is enabled.
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="bg-[#0B1220] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-extrabold text-text">Built around safety, clarity, and chart-first workflows.</h2>
            <p className="mt-3 text-base leading-7 text-text-dim">
              The interface separates research, paper validation, broker read-only context, and system health so each workflow is clear on mobile and laptop screens.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureSections.map(({ title, body, Icon }) => (
              <article key={title} className="rounded-3xl border border-white/[0.08] bg-white/[0.045] p-5">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl border border-info/20 bg-info/10 text-info">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-extrabold text-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-dim">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.08] bg-[#071018] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-extrabold text-text">Safety Center</h2>
            <p className="mt-3 text-base leading-7 text-text-dim">
              MAET keeps safety state visible instead of hiding it behind settings. The live build remains locked and broker mutation is disabled.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['live_execution_enabled', 'false'],
              ['broker_mutation_allowed', 'false'],
              ['order_flow', 'dry-run validation only'],
              ['broker_sync', 'read-only snapshot'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
                <div className="text-xs font-bold uppercase text-text-faint">{label}</div>
                <div className="mt-2 text-sm font-extrabold text-text">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function ProductPreview() {
  return (
    <div className="grid items-end gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[280px] rounded-[32px] border border-white/[0.14] bg-[#071018] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="rounded-[24px] border border-white/[0.08] bg-[#0B1220] p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-text">MAET</div>
              <div className="text-xs text-text-dim">Paper workspace</div>
            </div>
            <StatusPill variant="danger">LOCKED</StatusPill>
          </div>
          <div className="rounded-2xl border border-down/20 bg-down/5 p-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-text">
              <Lock className="h-4 w-4 text-down" />
              Live locked
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MiniState label="Mode" value="PAPER" />
              <MiniState label="Broker" value="READ ONLY" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {['Watchlist', 'Chart', 'Portfolio', 'AI Advisory'].map((item) => (
              <div key={item} className="flex min-h-11 items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3">
                <span className="text-xs font-bold text-text">{item}</span>
                <CheckCircle2 className="h-4 w-4 text-info" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden rounded-[28px] border border-white/[0.10] bg-[#0B1220] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.55)] md:block">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-extrabold text-text">Desktop workspace</div>
            <div className="text-xs text-text-dim">Watchlist, chart, and dry-run validation</div>
          </div>
          <StatusPill variant="warning">PAPER MODE</StatusPill>
        </div>
        <div className="grid min-h-[360px] grid-cols-[160px_minmax(0,1fr)_180px] gap-3">
          <div className="rounded-2xl border border-white/[0.07] bg-[#071018] p-3">
            <div className="mb-3 text-xs font-bold uppercase text-text-faint">Watchlist</div>
            {['NIFTY 50', 'BANKNIFTY', 'RELIANCE', 'SBIN'].map((symbol) => (
              <div key={symbol} className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.04] p-2">
                <div className="text-xs font-extrabold text-text">{symbol}</div>
                <div className="mt-1 text-xs text-text-dim">LTP —</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#071018] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-text">Chart</div>
                <div className="text-xs text-text-dim">No candle data until backend responds</div>
              </div>
              <BarChart3 className="h-5 w-5 text-info" />
            </div>
            <div className="grid h-[260px] place-items-center rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.025]">
              <div className="text-center">
                <LineChart className="mx-auto h-8 w-8 text-text-faint" />
                <div className="mt-3 text-sm font-bold text-text">No Candle Data</div>
                <div className="mt-1 text-xs text-text-dim">Backend data required</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#071018] p-3">
            <div className="text-xs font-bold uppercase text-text-faint">Dry-run ticket</div>
            <div className="mt-3 space-y-2">
              <MiniState label="validation_only" value="true" />
              <MiniState label="live_execution" value="false" />
              <MiniState label="broker_mutation" value="false" />
            </div>
            <div className="mt-4 grid h-10 place-items-center rounded-2xl border border-warn/25 bg-warn/10 text-xs font-extrabold text-warn">
              Validate Dry-Run Order
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function badgeTone(badge: string): 'success' | 'danger' | 'warning' | 'info' | 'default' {
  if (badge === 'LIVE LOCKED' || badge === 'BROKER MUTATION DISABLED') return 'danger'
  if (badge === 'PAPER MODE') return 'warning'
  return 'info'
}

function MiniState({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2">
      <div className="text-xs font-bold uppercase text-text-faint">{label}</div>
      <div className="mt-1 text-xs font-extrabold text-text">{value}</div>
    </div>
  )
}
