import Link from 'next/link'
import type { Metadata } from 'next'
import { ProductRiskFooter } from '@/components/compliance/ProductRiskFooter'

export const metadata: Metadata = {
  title: 'MAET Terminal Docs',
  description: 'User guide for the MAET Terminal paper-trading research workspace.',
}

const sections = [
  {
    title: 'What MAET does',
    body: 'MAET Terminal gives Indian-market traders a paper-mode workspace for watchlists, candlestick charts, indicators, dry-run order validation, and portfolio context.',
  },
  {
    title: 'Paper mode',
    body: 'The terminal validates order parameters and records paper workflow state. This deployment does not place real-money orders.',
  },
  {
    title: 'Charts and indicators',
    body: 'Use the chart workspace to review OHLCV candles with EMA, VWAP, RSI, MACD, Bollinger Bands, ATR, and candle-pattern context.',
  },
  {
    title: 'Broker and portfolio context',
    body: 'Portfolio and broker sections are read-only unless an authenticated backend session provides permitted data. Broker-side account mutations stay disabled.',
  },
  {
    title: 'Backend cold starts',
    body: 'The hosted backend may need a short warm-up on free infrastructure. The terminal falls back to demo market data while the connection recovers.',
  },
  {
    title: 'Security model',
    body: 'Admin operations require an admin token or authenticated JWT. MFA-capable login is supported when a user account has TOTP enabled.',
  },
]

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-base text-text-primary">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-mono text-sm text-text-primary">
            MAET
          </Link>
          <Link href="/terminal" className="rounded bg-accent px-3 py-2 text-sm font-medium text-white">
            Open terminal
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <p className="font-mono text-[11px] uppercase tracking-wide text-accent">User docs</p>
        <h1 className="mt-3 max-w-2xl font-mono text-3xl font-medium leading-tight">
          Paper trading workspace for Indian-market research.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted">
          These notes explain the product behavior a trader sees in the browser. Engineering and deployment
          details remain in the repository docs.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded border border-border bg-panel p-4">
              <h2 className="font-mono text-sm text-text-primary">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded border border-border bg-panel p-4">
          <h2 className="font-mono text-sm text-text-primary">Operational checklist</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-text-muted">
            <li>Confirm the top banner says paper trading only before using order validation.</li>
            <li>Use demo data only for UI review; connect a broker-backed backend for real market feed context.</li>
            <li>Do not treat AI notes, indicators, or backtests as financial advice.</li>
            <li>Review API health at the backend Swagger UI before demos that require live backend data.</li>
          </ul>
        </div>
      </section>

      <ProductRiskFooter />
    </main>
  )
}
