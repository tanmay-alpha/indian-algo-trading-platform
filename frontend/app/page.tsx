'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Database,
  Github,
  LineChart,
  LockKeyhole,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { StatusBadge } from '@/components/ui-maet/status-badge'

const features = [
  {
    title: 'Chart-first workspace',
    body: 'Watchlist, candles, indicators, and external chart handoffs sit in one broker-like workspace.',
    Icon: LineChart,
  },
  {
    title: 'Paper OMS',
    body: 'Manual tickets validate risk gates and return simulation records. The submit action never means execution.',
    Icon: ShieldCheck,
  },
  {
    title: 'Broker read-only',
    body: 'Angel One account context is treated as a snapshot source, not as a mutation path.',
    Icon: Database,
  },
]

const watchRows = [
  { symbol: 'NIFTY 50', name: 'Index', price: '22,884.40', change: '+0.42%', tone: 'up' },
  { symbol: 'BANKNIFTY', name: 'Index', price: '49,208.10', change: '-0.18%', tone: 'down' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: '2,841.75', change: '+0.31%', tone: 'up' },
  { symbol: 'SBIN', name: 'State Bank of India', price: 'Offline', change: 'Backend', tone: 'muted' },
]

export default function LandingPage() {
  return (
    <main className="min-h-[calc(100dvh-var(--safety-strip-h))] overflow-hidden bg-maet-base text-maet-text">
      <section className="relative isolate border-b border-maet-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_10%,rgba(77,156,248,0.18),transparent_34%),radial-gradient(circle_at_18%_28%,rgba(0,214,143,0.10),transparent_26%),var(--bg-base)]" />

        <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-maet-blue font-heading text-lg font-extrabold text-white shadow-cyan">
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
              className="hidden h-10 items-center gap-2 rounded-md border border-maet-border bg-maet-surface px-3 text-sm font-bold text-maet-text-secondary hover:border-maet-border-strong hover:text-maet-text sm:inline-flex"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Link
              href="/terminal"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-maet-blue px-4 text-sm font-extrabold text-white hover:bg-[#6fb2ff]"
            >
              Open Terminal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-10 pt-6 sm:px-6 lg:min-h-[640px] lg:grid-cols-[0.82fr_1fr] lg:px-8">
          <div className="max-w-2xl">
            <div className="font-heading text-5xl font-extrabold leading-none tracking-normal text-maet-text sm:text-[64px]">
              MAET
            </div>
            <div className="mt-2 font-mono text-sm text-maet-text-muted">Terminal</div>
            <h1 className="mt-6 font-heading text-3xl font-bold leading-tight text-maet-text sm:text-4xl lg:text-5xl">
              Safety-first market analytics for Indian markets.
            </h1>
            <p className="mt-5 max-w-xl text-xl leading-8 text-maet-text-secondary">
              A broker-style research terminal for watchlists, charts, dry-run validation, read-only portfolio context, and passive AI notes.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/terminal"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-maet-blue px-5 text-sm font-extrabold text-white hover:bg-[#6fb2ff]"
              >
                Open Terminal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-maet-border-strong px-5 text-sm font-bold text-maet-text-secondary hover:bg-maet-elevated hover:text-maet-text"
              >
                <Github className="h-4 w-4" />
                Source Code
              </a>
            </div>
          </div>

          <ProductMockup />
        </div>
      </section>

      <section className="border-b border-maet-border bg-maet-surface px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {features.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-card border border-maet-border bg-maet-base p-5 shadow-card">
              <div className="mb-5 grid h-10 w-10 place-items-center rounded-md border border-maet-blue/30 bg-maet-blue/12 text-maet-blue">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-heading text-lg font-bold text-maet-text">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-maet-text-secondary">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-maet-base px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-heading text-3xl font-bold text-maet-text">Built on a hard safety lock</h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-maet-text-secondary">
              Paper mode means every order-like workflow is validation-only. Broker data can be read for context, but MAET does not expose a live broker mutation path.
            </p>
          </div>

          <div className="overflow-hidden rounded-card border border-maet-border bg-maet-surface">
            {[
              ['live_execution', 'false'],
              ['broker_mutation', 'false'],
              ['order_flow', 'dry-run validation only'],
              ['broker_sync', 'read-only snapshot'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-maet-border px-4 py-3 last:border-b-0">
                <span className="font-mono text-xs text-maet-text-muted">{label}</span>
                <span className="text-right font-mono text-xs font-bold text-maet-text">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-maet-border bg-maet-void px-4 py-5 text-center font-mono text-xs text-maet-text-muted sm:px-6 lg:px-8">
        MAET Terminal v0.1.0 / GitHub / Next.js / FastAPI / Angel One SmartAPI
      </footer>
    </main>
  )
}

function ProductMockup() {
  return (
    <div className="relative">
      <div className="rounded-card border border-maet-border bg-maet-surface p-3 shadow-raised">
        <div className="flex items-center justify-between border-b border-maet-border px-2 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-maet-blue font-heading text-sm font-bold text-white">M</div>
            <div>
              <div className="font-heading text-sm font-bold">Terminal workspace</div>
              <div className="font-mono text-[11px] text-maet-text-muted">NSE/BSE research view</div>
            </div>
          </div>
          <StatusBadge tone="paper">Paper research</StatusBadge>
        </div>

        <div className="grid min-h-[440px] gap-3 pt-3 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
          <div className="rounded-card border border-maet-border bg-maet-base p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-heading text-sm font-bold">Watchlist</div>
              <Search className="h-4 w-4 text-maet-blue" />
            </div>
            <div className="space-y-2">
              {watchRows.map((row) => (
                <div key={row.symbol} className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-maet-border bg-maet-surface px-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-bold text-maet-text">{row.symbol}</div>
                    <div className="truncate text-[11px] text-maet-text-muted">{row.name}</div>
                  </div>
                  <div className="text-right">
                    <div className={row.tone === 'up' ? 'font-mono text-xs font-bold text-maet-green' : row.tone === 'down' ? 'font-mono text-xs font-bold text-maet-red' : 'font-mono text-xs font-bold text-maet-amber'}>
                      {row.price}
                    </div>
                    <div className={row.tone === 'up' ? 'font-mono text-[10px] text-maet-green' : row.tone === 'down' ? 'font-mono text-[10px] text-maet-red' : 'font-mono text-[10px] text-maet-text-muted'}>
                      {row.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-maet-border bg-maet-void p-3">
            <div className="mb-3 flex h-10 items-center justify-between border-b border-maet-border pb-3">
              <div>
                <div className="font-mono text-sm font-bold">RELIANCE</div>
                <div className="text-[11px] text-maet-text-muted">5m candles / indicators</div>
              </div>
              <div className="flex gap-1">
                {['1m', '5m', '15m', '1h', 'D'].map((item) => (
                  <span key={item} className={item === '5m' ? 'rounded border border-maet-blue bg-maet-blue/15 px-2 py-1 font-mono text-[10px] text-maet-blue' : 'rounded border border-maet-border px-2 py-1 font-mono text-[10px] text-maet-text-muted'}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative h-[310px] overflow-hidden rounded-md border border-maet-border bg-[linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)] bg-[size:56px_44px]">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 310" role="img" aria-label="Mock price chart">
                <polyline points="18,210 72,194 116,224 154,168 204,178 248,118 310,136 358,86 420,112 488,62 540,78" fill="none" stroke="#00d68f" strokeWidth="3" />
                <polyline points="18,238 72,224 116,246 154,208 204,214 248,174 310,186 358,154 420,166 488,128 540,136" fill="none" stroke="#4d9cf8" strokeWidth="2" opacity="0.55" />
              </svg>
              <div className="absolute bottom-4 left-4 rounded-md border border-maet-border bg-maet-surface/90 px-3 py-2">
                <div className="font-mono text-[11px] text-maet-text-muted">Backend state</div>
                <div className="font-mono text-xs font-bold text-maet-amber">Offline fallback ready</div>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-maet-border bg-maet-overlay p-3">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-maet-amber" />
              <div>
                <div className="font-heading text-sm font-bold">Dry-run validation</div>
                <div className="font-mono text-[11px] text-maet-text-muted">No execution route</div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <MockField label="Symbol" value="RELIANCE" />
              <MockField label="Side" value="BUY / SELL" />
              <MockField label="Qty" value="1" />
              <button className="h-10 w-full rounded-md bg-maet-blue font-mono text-xs font-bold text-white" type="button">
                Validate Dry-Run
              </button>
            </div>
            <div className="mt-4 rounded-md border border-maet-violet/30 bg-maet-violet/12 p-3 text-xs leading-5 text-maet-text-secondary">
              <Bot className="mr-2 inline h-4 w-4 text-maet-violet" />
              AI notes stay advisory and cannot authorize an order.
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 left-8 right-8 -z-10 h-16 rounded-full bg-maet-blue/20 blur-3xl" />
    </div>
  )
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] text-maet-text-muted">{label}</div>
      <div className="h-10 rounded-md border border-maet-border bg-maet-surface px-3 py-2 font-mono text-xs font-bold text-maet-text">{value}</div>
    </div>
  )
}
