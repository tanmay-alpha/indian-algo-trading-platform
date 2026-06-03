'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  ChartCandlestick,
  CheckCircle2,
  Database,
  Github,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { AnimatedBorder } from '@/components/effects/animated-border'
import { PremiumBackground } from '@/components/effects/premium-background'
import { PremiumCard } from '@/components/effects/premium-card'
import { SpotlightCard } from '@/components/effects/spotlight-card'
import { StatusOrb } from '@/components/effects/status-orb'

const safetyBadges = ['LIVE LOCKED', 'PAPER MODE', 'READ ONLY', 'AI ADVISORY ONLY', 'BROKER MUTATION DISABLED']

const previewRows = [
  { symbol: 'RELIANCE', name: 'Visual equity row', value: 'demo', tone: 'muted' },
  { symbol: 'SBIN', name: 'Visual equity row', value: 'demo', tone: 'muted' },
  { symbol: 'NIFTY 50', name: 'Visual index row', value: 'demo', tone: 'muted' },
  { symbol: 'BANKNIFTY', name: 'Visual index row', value: 'demo', tone: 'muted' },
]

const featureStory = [
  {
    title: 'Market Watch',
    body: 'Compact watchlists, symbol search, exchange badges, and honest unavailable states.',
    Icon: Search,
  },
  {
    title: 'Chart Workspace',
    body: 'Chart-first terminal layout with candle diagnostics, indicators, and external chart handoffs.',
    Icon: ChartCandlestick,
  },
  {
    title: 'Paper OMS',
    body: 'Dry-run validation and local paper audit trails without broker mutation.',
    Icon: ShieldCheck,
  },
  {
    title: 'Broker Read-only Sync',
    body: 'Protected portfolio context stays read-only and token-gated in memory.',
    Icon: Database,
  },
  {
    title: 'Reconciliation',
    body: 'Internal paper records can be compared with broker snapshots without placing orders.',
    Icon: RefreshCw,
  },
  {
    title: 'AI Advisory',
    body: 'Research explanations only. AI cannot authorize or route execution.',
    Icon: Bot,
  },
]

const safetyRows = [
  ['live_execution_enabled', 'false'],
  ['broker_mutation_allowed', 'false'],
  ['manual_order_flow', 'dry-run validation'],
  ['broker_context', 'read-only'],
  ['ai_execution_allowed', 'false'],
]

export default function LandingPage() {
  return (
    <main className="maet-page-bg relative min-h-[calc(100dvh-var(--safety-strip-h))] overflow-hidden text-maet-text">
      <PremiumBackground />

      <header className="relative z-10 border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-maet-glass-border bg-gradient-to-br from-maet-cyan to-maet-blue font-heading text-lg font-extrabold text-[#00111f] shadow-cyan">
              M
            </div>
            <div>
              <div className="font-heading text-lg font-bold leading-tight">MAET Terminal</div>
              <div className="text-xs font-semibold text-maet-text-muted">Indian market research workspace</div>
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
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 lg:min-h-[690px] lg:grid-cols-[0.76fr_1.24fr] lg:px-8">
        <div className="max-w-2xl">
          <h1 className="font-heading text-5xl font-extrabold leading-none text-maet-text sm:text-7xl lg:text-[84px]">
            MAET Terminal
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-maet-text-soft sm:text-xl">
            A safety-first market analytics and paper trading workspace for Indian equities.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-7 text-maet-text-muted">
            Built for watchlists, real candle diagnostics, dry-run validation, broker read-only context, reconciliation, and advisory research without live execution.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {safetyBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex min-h-8 items-center gap-2 rounded-full border border-maet-glass-border bg-maet-glass-bg px-3 text-xs font-extrabold text-maet-text-soft shadow-inner"
              >
                <StatusOrb tone={badge.includes('LIVE') || badge.includes('MUTATION') ? 'amber' : badge.includes('AI') ? 'violet' : badge.includes('PAPER') ? 'cyan' : 'muted'} />
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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

        <ProductPreview />
      </section>

      <section className="relative z-10 border-y border-white/10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <h2 className="font-heading text-3xl font-bold text-maet-text">A terminal, not a generic dashboard.</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-maet-text-muted">
                Every surface is shaped around a real workflow: find a symbol, inspect chart data, validate a paper order, review OMS state, and keep execution safety visible.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {['Chart-first desktop', 'Mobile task flow', 'Safety as product chrome'].map((item) => (
                <PremiumCard key={item} className="p-4">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-maet-cyan" />
                  <div className="font-heading text-base font-bold text-maet-text">{item}</div>
                </PremiumCard>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureStory.map(({ title, body, Icon }) => (
              <SpotlightCard key={title} className="p-5">
                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border border-maet-glass-border bg-maet-blue/10 text-maet-cyan">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-lg font-bold text-maet-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-maet-text-muted">{body}</p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-maet-amber/40 bg-maet-amber/10 text-maet-amber">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-maet-text">Live execution stays locked.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-maet-text-muted">
              MAET presents broker context as read-only, keeps admin tokens in memory, and treats manual orders as validation tickets only. AI remains advisory and cannot place or approve orders.
            </p>
          </div>

          <AnimatedBorder>
            <PremiumCard strong className="overflow-hidden">
              {safetyRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-white/10 px-4 py-3 last:border-b-0">
                  <span className="text-sm font-semibold text-maet-text-muted">{label}</span>
                  <span className="text-right font-mono text-sm font-bold text-maet-text">{value}</span>
                </div>
              ))}
            </PremiumCard>
          </AnimatedBorder>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-xl border border-maet-glass-border bg-maet-panel-soft p-5 shadow-card sm:flex-row sm:items-center">
          <div>
            <h2 className="font-heading text-2xl font-bold text-maet-text">Open the terminal workspace.</h2>
            <p className="mt-2 text-sm text-maet-text-muted">Visual demo - not live market data. Production behavior depends on connected backend data.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
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
              GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

function ProductPreview() {
  return (
    <div className="relative perspective-[1600px]">
      <AnimatedBorder className="motion-safe:lg:[transform:rotateX(4deg)_rotateY(-7deg)]">
        <PremiumCard strong className="p-3 shadow-float">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-2 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-maet-glass-border bg-gradient-to-br from-maet-cyan to-maet-blue font-heading text-base font-extrabold text-[#00111f]">
                M
              </div>
              <div>
                <div className="font-heading text-base font-bold">Broker-grade workspace</div>
                <div className="text-sm text-maet-text-muted">Visual demo - not live market data.</div>
              </div>
            </div>
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-maet-amber/30 bg-maet-amber/10 px-3 text-xs font-extrabold text-maet-amber">
              <StatusOrb tone="amber" pulse />
              LIVE LOCKED
            </span>
          </div>

          <div className="grid min-h-[470px] gap-3 pt-3 lg:grid-cols-[230px_minmax(0,1fr)_250px]">
            <div className="maet-glass flex min-h-0 flex-col p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-heading text-sm font-bold">Market Watch</div>
                  <div className="text-xs text-maet-text-muted">Compact rows</div>
                </div>
                <Search className="h-4 w-4 text-maet-cyan" />
              </div>
              <div className="space-y-1.5">
                {previewRows.map((row, index) => (
                  <div
                    key={row.symbol}
                    className={`grid h-[56px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 ${
                      index === 0
                        ? 'border-maet-cyan/40 bg-maet-cyan/10'
                        : 'border-maet-glass-border bg-maet-ink-950/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-extrabold text-maet-text">{row.symbol}</div>
                      <div className="truncate text-xs text-maet-text-muted">{row.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-maet-text-muted">--</div>
                      <div className="text-xs font-bold text-maet-text-faint">{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="maet-glass-strong flex min-h-0 flex-col overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <div className="font-mono text-lg font-extrabold text-maet-text">RELIANCE</div>
                  <div className="text-xs text-maet-text-muted">Demo chart shell / NSE</div>
                </div>
                <div className="flex gap-1.5">
                  {['1m', '5m', '15m', '1h', 'D'].map((item) => (
                    <span
                      key={item}
                      className={item === '5m' ? 'rounded-full border border-maet-cyan/40 bg-maet-cyan/20 px-2.5 py-1 font-mono text-xs text-maet-cyan' : 'rounded-full border border-white/10 px-2.5 py-1 font-mono text-xs text-maet-text-muted'}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="maet-subtle-grid relative min-h-0 flex-1 overflow-hidden bg-maet-ink-950/40">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 640 360" role="img" aria-label="Visual demo chart, not live market data">
                  <defs>
                    <linearGradient id="landingChartLine" x1="0" x2="1" y1="0" y2="0">
                      <stop stopColor="#22d3ee" />
                      <stop offset="0.56" stopColor="#2f80ff" />
                      <stop offset="1" stopColor="#16c784" />
                    </linearGradient>
                    <linearGradient id="landingArea" x1="0" x2="0" y1="0" y2="1">
                      <stop stopColor="rgba(34,211,238,0.22)" />
                      <stop offset="1" stopColor="rgba(34,211,238,0)" />
                    </linearGradient>
                  </defs>
                  <path d="M38 260 C112 202 142 278 204 180 C268 78 314 194 384 136 C456 80 500 118 586 58 L586 322 L38 322 Z" fill="url(#landingArea)" opacity="0.88" />
                  <path d="M38 260 C112 202 142 278 204 180 C268 78 314 194 384 136 C456 80 500 118 586 58" fill="none" stroke="url(#landingChartLine)" strokeLinecap="round" strokeWidth="5" />
                  <path d="M52 302 H592" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
                </svg>
                <div className="absolute bottom-4 left-4 rounded-xl border border-maet-amber/30 bg-maet-amber/10 px-3 py-2 backdrop-blur-xl">
                  <div className="text-xs font-bold text-maet-amber">Visual demo</div>
                  <div className="text-xs text-maet-text-muted">No synthetic candles</div>
                </div>
              </div>
            </div>

            <div className="maet-glass flex min-h-0 flex-col p-3">
              <div className="mb-3 flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-maet-amber/30 bg-maet-amber/10 text-maet-amber">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-heading text-sm font-bold">Dry-run validation</div>
                  <div className="text-xs text-maet-text-muted">No execution route</div>
                </div>
              </div>
              <div className="space-y-2">
                <PreviewLine label="Symbol" value="RELIANCE" />
                <PreviewLine label="Mode" value="paper" />
                <PreviewLine label="Broker mutation" value="disabled" />
                <PreviewLine label="AI action" value="advisory only" />
              </div>
              <div className="mt-auto rounded-xl border border-maet-violet/30 bg-maet-violet/10 p-3 text-sm leading-6 text-maet-text-soft">
                AI can explain context, but cannot authorize or place orders.
              </div>
            </div>
          </div>
        </PremiumCard>
      </AnimatedBorder>
    </div>
  )
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-white/10 bg-maet-ink-950/40 px-3 py-2">
      <span className="text-xs font-semibold text-maet-text-muted">{label}</span>
      <span className="font-mono text-xs font-bold text-maet-text">{value}</span>
    </div>
  )
}
