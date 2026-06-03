'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Brain,
  Briefcase,
  ChartCandlestick,
  CheckCircle2,
  Github,
  ListChecks,
  LockKeyhole,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { AnimatedBorder } from '@/components/effects/animated-border'
import { PremiumBackground } from '@/components/effects/premium-background'
import { PremiumCard } from '@/components/effects/premium-card'
import { SpotlightCard } from '@/components/effects/spotlight-card'
import { StatusOrb } from '@/components/effects/status-orb'

const GITHUB_URL = 'https://github.com/tanmay-alpha/indian-algo-trading-platform'

const productBadges = [
  'Paper Mode',
  'Read-only Broker Context',
  'AI Advisory Only',
]

const watchRows = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', state: 'Waiting' },
  { symbol: 'SBIN', name: 'State Bank of India', state: 'Waiting' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', state: 'Waiting' },
  { symbol: 'INFY', name: 'Infosys', state: 'Waiting' },
]

const previewSteps = ['Watchlist', 'Chart', 'Dry-run', 'Portfolio']

const workflowSteps = [
  {
    title: 'Pick a symbol',
    body: 'Search NSE/BSE instruments and build a focused market list.',
    Icon: Search,
  },
  {
    title: 'Inspect chart context',
    body: 'Review candle availability, timeframe context, and research indicators.',
    Icon: ChartCandlestick,
  },
  {
    title: 'Validate a paper order',
    body: 'Run dry-run checks before any real-money workflow exists.',
    Icon: ShieldCheck,
  },
  {
    title: 'Review read-only context',
    body: 'Inspect protected portfolio and reconciliation state without broker mutation.',
    Icon: Briefcase,
  },
]

const featureCards = [
  {
    title: 'Watchlists for NSE/BSE',
    body: 'Organize Indian equity symbols and move quickly from list to chart.',
    Icon: Search,
  },
  {
    title: 'Candle Diagnostics',
    body: 'Inspect timeframes, indicator context, and honest candle availability.',
    Icon: ChartCandlestick,
  },
  {
    title: 'Dry-run Risk Check',
    body: 'Validate paper order parameters with clear guardrails and no broker order placement.',
    Icon: ShieldCheck,
  },
  {
    title: 'Read-only Portfolio Context',
    body: 'Review broker-side holdings and positions without allowing broker account changes.',
    Icon: WalletCards,
  },
  {
    title: 'OMS & Reconciliation',
    body: 'Review paper tickets, order-state history, and reconciliation context.',
    Icon: ListChecks,
  },
  {
    title: 'AI Market Notes',
    body: 'Explain candles, indicators, and risk context without predictions or trade approval.',
    Icon: Brain,
  },
]

const safetyItems = [
  'Live execution is locked in this build',
  'Order forms validate paper parameters only',
  'Broker context is read-only',
  'AI explains context; it cannot place or approve trades',
  'No financial advice',
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
              <div className="text-xs font-semibold text-maet-text-muted">Indian equity paper workspace</div>
            </div>
          </div>
          <Link href="/terminal" className="glass-button hidden h-10 min-h-10 px-3 text-xs sm:inline-flex">
            Terminal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 lg:px-8 xl:min-h-[690px] xl:grid-cols-[0.72fr_1.28fr]">
        <div className="max-w-2xl">
          <h1 className="font-heading text-4xl font-extrabold leading-[1.02] text-maet-text sm:text-6xl lg:text-[72px]">
            A focused market workspace for Indian equities.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-maet-text-soft sm:text-xl">
            MAET Terminal brings watchlists, candle diagnostics, dry-run validation, read-only portfolio context, and AI market notes into one safety-first workspace.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-7 text-maet-text-muted">
            Paper mode only. Live execution is locked.
          </p>

          <div className="mt-7 flex flex-wrap gap-2">
            {productBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex min-h-8 items-center gap-2 rounded-full border border-maet-glass-border bg-maet-glass-bg px-3 text-xs font-extrabold text-maet-text-soft shadow-inner"
              >
                <StatusOrb tone={badge.includes('AI') ? 'violet' : badge.includes('Paper') ? 'cyan' : 'muted'} />
                {badge}
              </span>
            ))}
          </div>

          <Link href="/terminal" className="maet-btn maet-btn-primary mt-9 h-12 px-5 text-sm">
            Open Terminal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ProductPreview />
      </section>

      <section className="relative z-10 border-y border-white/10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl font-bold text-maet-text">A cleaner research loop.</h2>
            <p className="mt-3 text-sm leading-7 text-maet-text-muted">
              Move from symbol discovery to chart context, paper validation, and protected portfolio review without turning the product into a system-status page.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map(({ title, body, Icon }, index) => (
              <SpotlightCard key={title} className="p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-maet-cyan/25 bg-maet-cyan/10 text-maet-cyan">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-extrabold text-maet-text-faint">0{index + 1}</span>
                </div>
                <h3 className="font-heading text-lg font-bold text-maet-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-maet-text-muted">{body}</p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl font-bold text-maet-text">Trading-focused tools, not developer panels.</h2>
            <p className="mt-3 text-sm leading-7 text-maet-text-muted">
              Six focused surfaces keep the workflow understandable: symbol lists, chart context, paper validation, read-only portfolio review, reconciliation, and AI notes.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map(({ title, body, Icon }) => (
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

      <section className="relative z-10 border-t border-white/10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-maet-amber/40 bg-maet-amber/10 text-maet-amber">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-3xl font-bold text-maet-text">Safety is built into the workflow.</h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-maet-text-muted">
              The platform keeps research and validation separate from real-money execution without making safety copy dominate every screen.
            </p>
          </div>

          <AnimatedBorder>
            <PremiumCard strong className="p-4 shadow-card">
              <div className="grid gap-3 sm:grid-cols-2">
                {safetyItems.map((item) => (
                  <div key={item} className="flex min-h-14 items-center gap-3 rounded-lg border border-maet-amber/20 bg-maet-amber/10 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-maet-amber" />
                    <span className="text-sm font-semibold leading-5 text-maet-text-soft">{item}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          </AnimatedBorder>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-heading text-base font-bold text-maet-text">MAET Terminal</div>
            <p className="mt-1 text-sm text-maet-text-muted">Paper-mode research workspace. No financial advice.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-button h-10 px-3 text-xs"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function ProductPreview() {
  return (
    <div className="relative perspective-[1600px]">
      <AnimatedBorder className="motion-safe:xl:[transform:rotateX(4deg)_rotateY(-7deg)]">
        <PremiumCard strong className="p-3 shadow-float">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-2 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-maet-glass-border bg-gradient-to-br from-maet-cyan to-maet-blue font-heading text-base font-extrabold text-[#00111f]">
                M
              </div>
              <div>
                <div className="font-heading text-base font-bold">Trading workspace preview</div>
                <div className="text-sm text-maet-text-muted">Visual demo - not live market data.</div>
              </div>
            </div>
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-maet-amber/30 bg-maet-amber/10 px-3 text-xs font-extrabold text-maet-amber">
              <StatusOrb tone="amber" pulse />
              Live execution locked
            </span>
          </div>

          <div className="grid gap-2 border-b border-white/10 px-2 py-3 sm:grid-cols-4">
            {previewSteps.map((step, index) => (
              <div key={step} className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-maet-ink-950/38 px-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-maet-cyan/30 bg-maet-cyan/10 font-mono text-[10px] font-extrabold text-maet-cyan">
                  {index + 1}
                </span>
                <span className="truncate text-xs font-bold text-maet-text-soft">{step}</span>
              </div>
            ))}
          </div>

          <div className="grid min-h-[440px] gap-3 pt-3 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
            <div className="maet-glass flex min-h-0 flex-col p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-heading text-sm font-bold">Watchlist</div>
                  <div className="text-xs text-maet-text-muted">NSE/BSE symbols</div>
                </div>
                <Search className="h-4 w-4 text-maet-cyan" />
              </div>
              <div className="space-y-1.5">
                {watchRows.map((row, index) => (
                  <div
                    key={row.symbol}
                    className={`grid h-[54px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border px-3 ${
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
                      <div className="text-xs font-bold text-maet-text-faint">{row.state}</div>
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
                  <div className="text-xs text-maet-text-muted">Not live market data</div>
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
                  <div className="text-xs text-maet-text-muted">Paper checks only</div>
                </div>
              </div>
              <div className="space-y-2">
                <PreviewLine label="Symbol" value="RELIANCE" />
                <PreviewLine label="Mode" value="Paper" />
                <PreviewLine label="Broker context" value="Read-only" />
                <PreviewLine label="AI notes" value="Advisory" />
              </div>
              <div className="mt-auto rounded-xl border border-maet-violet/30 bg-maet-violet/10 p-3 text-sm leading-6 text-maet-text-soft">
                AI can explain market context, but cannot approve or place trades.
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="maet-glass flex items-center gap-3 p-3">
              <Briefcase className="h-5 w-5 shrink-0 text-maet-cyan" />
              <div>
                <div className="text-sm font-bold text-maet-text">Read-only portfolio context</div>
                <div className="text-xs text-maet-text-muted">No holdings or PnL are invented.</div>
              </div>
            </div>
            <div className="maet-glass flex items-center gap-3 p-3">
              <Bot className="h-5 w-5 shrink-0 text-maet-violet" />
              <div>
                <div className="text-sm font-bold text-maet-text">AI market notes</div>
                <div className="text-xs text-maet-text-muted">Research context only.</div>
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
