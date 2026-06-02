'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Boxes,
  Database,
  Github,
  LineChart,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { LiquidBackground } from '@/components/effects/liquid-background'
import { AuroraField } from '@/components/effects/aurora-field'
import { MagneticCard } from '@/components/effects/magnetic-card'
import { ReflectionCard } from '@/components/effects/reflection-card'
import { GlassPanel } from '@/components/effects/glass-panel'
import { StatusBadge } from '@/components/ui-maet/status-badge'

const safetyBadges = ['LIVE LOCKED', 'PAPER MODE', 'READ ONLY', 'AI ADVISORY ONLY', 'BROKER MUTATION DISABLED']

const demoRows = [
  { symbol: 'NIFTY 50', name: 'Visual index demo', value: '+0.42%', tone: 'up' },
  { symbol: 'BANKNIFTY', name: 'Visual index demo', value: '-0.18%', tone: 'down' },
  { symbol: 'RELIANCE', name: 'Visual equity demo', value: '+0.31%', tone: 'up' },
  { symbol: 'SBIN', name: 'Backend offline state', value: '--', tone: 'muted' },
]

const features = [
  { title: 'Market Watch', body: 'Search and organize NSE/BSE instruments with honest offline states.', Icon: Search },
  { title: 'Charting', body: 'Candle and indicator workspace with TradingView and Angel One handoffs.', Icon: LineChart },
  { title: 'Paper OMS', body: 'Dry-run validation only. No live broker mutation route is exposed.', Icon: ShieldCheck },
  { title: 'Broker Read-only Sync', body: 'Protected portfolio context is treated as read-only snapshot data.', Icon: Database },
  { title: 'Reconciliation', body: 'Compare internal paper state with broker snapshots without mutations.', Icon: RefreshCw },
  { title: 'AI Advisory', body: 'Passive market explanation only. AI cannot place or authorize orders.', Icon: Bot },
  { title: 'Safety Center', body: 'Live execution lock, API health, broker status, and stream diagnostics.', Icon: LockKeyhole },
]

const architecture = [
  ['Frontend', 'Next.js app shell, mobile dock, desktop workspace'],
  ['FastAPI', 'Typed REST and market stream gateway'],
  ['OMS', 'Manual dry-run validation and audit trail'],
  ['Reconciliation', 'Paper records compared with broker snapshots'],
  ['Broker Read-only', 'Angel One context without order placement'],
  ['AI Advisory', 'Research notes with execution disabled'],
]

export default function LandingPage() {
  return (
    <main className="relative min-h-[calc(100dvh-var(--safety-strip-h))] overflow-hidden bg-maet-bg-deep text-maet-text">
      <LiquidBackground intensity="strong" />
      <AuroraField intensity="strong" tone="cyan" />

      <section className="relative isolate border-b border-maet-glass-border">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-maet-glass-border bg-maet-glass-2 font-heading text-lg font-extrabold text-white shadow-cyan backdrop-blur-xl">
              M
            </div>
            <div>
              <div className="font-heading text-lg font-bold leading-tight">MAET</div>
              <div className="font-mono text-xs text-maet-text-muted">Terminal</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View MAET repository on GitHub"
              className="glass-button hidden h-11 px-4 text-sm sm:inline-flex"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Link href="/terminal" className="maet-btn maet-btn-primary h-11 px-4 text-sm">
              Open Terminal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-5 sm:px-6 lg:min-h-[660px] lg:grid-cols-[0.82fr_1fr] lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-maet-glass-border bg-maet-glass-1 px-3 py-1.5 font-mono text-xs font-bold text-maet-cyan backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" />
              Safety-first Indian market terminal
            </div>
            <h1 className="mt-6 font-heading text-5xl font-extrabold leading-none text-maet-text sm:text-[66px]">
              MAET Terminal
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-maet-text-soft sm:text-xl">
              Safety-first market analytics and paper trading terminal for Indian markets.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-maet-text-muted">
              Watchlists, charting, dry-run validation, broker read-only context, reconciliation, and AI advisory in a glass workspace that keeps live execution locked.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {safetyBadges.map((badge) => (
                <StatusBadge
                  key={badge}
                  tone={badge.includes('LIVE') || badge.includes('MUTATION') ? 'danger' : badge.includes('AI') ? 'ai' : badge.includes('PAPER') ? 'paper' : 'muted'}
                >
                  {badge}
                </StatusBadge>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/terminal" className="maet-btn maet-btn-primary h-12 px-5 text-sm">
                Open Terminal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-button h-12 px-5 text-sm"
              >
                <Github className="h-4 w-4" />
                View GitHub
              </a>
            </div>
          </div>

          <MagneticCard strength={5}>
            <ProductPreview />
          </MagneticCard>
        </div>
      </section>

      <section className="relative border-b border-maet-glass-border px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-2xl font-bold text-maet-text">Visual demo strip</h2>
              <p className="mt-1 text-sm text-maet-text-muted">Visual demo - not live market data.</p>
            </div>
            <StatusBadge tone="muted">No broker data shown</StatusBadge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {demoRows.map((row) => (
              <ReflectionCard key={row.symbol} className="p-4 hover-glass">
                <div className="font-mono text-sm font-extrabold text-maet-text">{row.symbol}</div>
                <div className="mt-1 text-xs text-maet-text-muted">{row.name}</div>
                <div className={row.tone === 'up' ? 'tabular-market-number mt-4 font-mono text-2xl font-extrabold text-maet-green' : row.tone === 'down' ? 'tabular-market-number mt-4 font-mono text-2xl font-extrabold text-maet-red' : 'tabular-market-number mt-4 font-mono text-2xl font-extrabold text-maet-text-muted'}>
                  {row.value}
                </div>
              </ReflectionCard>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-bold text-maet-text">Premium fintech workspace, safety first.</h2>
            <p className="mt-3 text-sm leading-7 text-maet-text-muted">
              The product surface is designed for repeated market review, not marketing theatre. Every action-like control stays paper or read-only.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {features.map(({ title, body, Icon }) => (
              <ReflectionCard key={title} as="article" className="p-5 hover-glass">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl border border-maet-glass-border-strong bg-maet-blue/12 text-maet-cyan">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-lg font-bold text-maet-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-maet-text-muted">{body}</p>
              </ReflectionCard>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-maet-glass-border px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-maet-glass-border bg-maet-glass-2 text-maet-cyan">
              <Boxes className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-maet-text">Architecture</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-maet-text-muted">
              The stack keeps market display, broker read-only sync, paper OMS, reconciliation, and advisory flows separated by explicit boundaries.
            </p>
          </div>

          <GlassPanel className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {architecture.map(([label, body]) => (
                <div key={label} className="rounded-2xl border border-maet-glass-border bg-maet-bg-deep/36 p-4">
                  <div className="font-heading text-base font-bold text-maet-text">{label}</div>
                  <div className="mt-2 text-sm leading-6 text-maet-text-muted">{body}</div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-maet-red/40 bg-maet-red/12 text-maet-red">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-maet-text">Live execution is locked.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-maet-text-muted">
              Manual orders are dry-run validation only. Broker data is read-only. AI can explain context, but it cannot authorize or place orders.
            </p>
          </div>

          <GlassPanel className="overflow-hidden" strength="strong">
            {[
              ['live_execution_enabled', 'false'],
              ['broker_mutation_allowed', 'false'],
              ['manual_order_flow', 'Validate Dry-Run Order'],
              ['ai_execution_allowed', 'false'],
              ['admin_token_storage', 'memory only'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-maet-glass-border px-4 py-3 last:border-b-0">
                <span className="font-mono text-xs text-maet-text-muted">{label}</span>
                <span className="text-right font-mono text-xs font-bold text-maet-text">{value}</span>
              </div>
            ))}
          </GlassPanel>
        </div>
      </section>

      <footer className="border-t border-maet-glass-border px-4 py-6 text-center text-xs text-maet-text-muted sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="font-mono">Paper mode disclaimer: MAET is validation-only and read-only for broker context.</span>
          <a
            href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-2 font-mono font-bold text-maet-cyan"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </footer>
    </main>
  )
}

function ProductPreview() {
  return (
    <div className="relative">
      <div className="glass-glow-border">
        <ReflectionCard className="p-3 shadow-glass">
          <div className="flex items-center justify-between border-b border-maet-glass-border px-2 pb-3">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-2xl border border-maet-glass-border bg-maet-blue/80 font-heading text-sm font-bold text-white">M</div>
              <div>
                <div className="font-heading text-sm font-bold">Terminal workspace</div>
                <div className="font-mono text-xs text-maet-text-muted">Visual demo - not live market data</div>
              </div>
            </div>
            <StatusBadge tone="paper">Paper research</StatusBadge>
          </div>

          <div className="grid min-h-[450px] gap-3 pt-3 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
            <GlassPanel className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-heading text-sm font-bold">Watchlist</div>
                <Search className="h-4 w-4 text-maet-cyan" />
              </div>
              <div className="space-y-2">
                {demoRows.map((row) => (
                  <div key={row.symbol} className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-maet-glass-border bg-maet-bg-deep/42 px-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-bold text-maet-text">{row.symbol}</div>
                      <div className="truncate text-xs text-maet-text-muted">{row.name}</div>
                    </div>
                    <div className={row.tone === 'up' ? 'tabular-market-number font-mono text-xs font-bold text-maet-green' : row.tone === 'down' ? 'tabular-market-number font-mono text-xs font-bold text-maet-red' : 'tabular-market-number font-mono text-xs font-bold text-maet-text-muted'}>
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="overflow-hidden p-3" glow>
              <div className="mb-3 flex min-h-10 items-center justify-between gap-3 border-b border-maet-glass-border pb-3">
                <div>
                  <div className="font-mono text-sm font-bold">RELIANCE</div>
                  <div className="text-xs text-maet-text-muted">Demo chart shell</div>
                </div>
                <div className="flex gap-1">
                  {['1m', '5m', '15m', '1h', 'D'].map((item) => (
                    <span key={item} className={item === '5m' ? 'rounded-full border border-maet-cyan/40 bg-maet-cyan/15 px-2 py-1 font-mono text-xs text-maet-cyan' : 'rounded-full border border-maet-glass-border px-2 py-1 font-mono text-xs text-maet-text-muted'}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative h-[318px] overflow-hidden rounded-2xl border border-maet-glass-border bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.10)_1px,transparent_1px)] bg-[size:56px_44px]">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 318" role="img" aria-label="Visual demo chart, not live market data">
                  <defs>
                    <linearGradient id="landingLine" x1="0" x2="1" y1="0" y2="0">
                      <stop stopColor="#22d3ee" />
                      <stop offset="1" stopColor="#16c784" />
                    </linearGradient>
                  </defs>
                  <path d="M18 232 C80 182 104 244 154 166 C208 82 244 172 310 128 C378 82 412 116 488 62 C512 46 530 60 540 78" fill="none" stroke="url(#landingLine)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M18 252 C92 224 138 248 196 214 C248 184 302 198 358 156 C422 108 482 148 540 132" fill="none" stroke="#38bdf8" strokeWidth="2" opacity="0.45" strokeLinecap="round" />
                </svg>
                <div className="absolute bottom-4 left-4 rounded-2xl border border-maet-glass-border bg-maet-bg-deep/72 px-3 py-2 backdrop-blur-xl">
                  <div className="font-mono text-xs text-maet-text-muted">Data honesty</div>
                  <div className="font-mono text-xs font-bold text-maet-amber">Visual demo only</div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="p-3">
              <div className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-maet-amber" />
                <div>
                  <div className="font-heading text-sm font-bold">Dry-run validation</div>
                  <div className="font-mono text-xs text-maet-text-muted">No execution route</div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <PreviewField label="Symbol" value="RELIANCE" />
                <PreviewField label="Mode" value="validation_only=true" />
                <PreviewField label="Live execution" value="false" />
                <button className="maet-btn maet-btn-primary h-10 w-full font-mono text-xs" type="button">
                  Validate Dry-Run
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-maet-violet/30 bg-maet-violet/12 p-3 text-xs leading-5 text-maet-text-soft">
                <Bot className="mr-2 inline h-4 w-4 text-maet-violet" />
                AI advisory cannot authorize broker orders.
              </div>
            </GlassPanel>
          </div>
        </ReflectionCard>
      </div>

    </div>
  )
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-xs text-maet-text-muted">{label}</div>
      <div className="h-10 rounded-xl border border-maet-glass-border bg-maet-bg-deep/48 px-3 py-2 font-mono text-xs font-bold text-maet-text">{value}</div>
    </div>
  )
}
