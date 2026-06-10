import Link from 'next/link'
import { TerminalPreviewFrame } from './TerminalPreviewFrame'

const GITHUB_URL = 'https://github.com/tanmay-alpha/indian-algo-trading-platform'

export function Hero() {
  return (
    <section className="mx-auto grid min-h-[calc(100dvh-56px)] max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 lg:grid-cols-[0.47fr_0.53fr] lg:py-10">
      <div>
        <h1 className="max-w-xl font-sans text-4xl font-bold leading-tight text-text-primary lg:text-5xl">
          A professional algo desk for Indian markets.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-text-muted">
          Candlestick charts, technical indicators, dry-run validation, and portfolio context - built on Angel One SmartAPI with a C++17 indicator engine.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/terminal"
            className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-[#1A1600] transition-colors hover:bg-[#f5d36c]"
          >
            Open terminal -&gt;
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded border border-border-light bg-transparent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-dim"
          >
            GitHub
          </a>
        </div>
      </div>
      <div className="min-w-0">
        <TerminalPreviewFrame />
      </div>
    </section>
  )
}
