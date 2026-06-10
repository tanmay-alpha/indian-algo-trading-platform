import Link from 'next/link'
import { TerminalPreviewFrame } from './TerminalPreviewFrame'

export function Hero() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <h1 className="max-w-2xl font-mono text-4xl font-medium leading-tight text-text-primary">
        A professional algo desk for Indian markets.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted">
        Candlestick charts, technical indicators, dry-run validation, and portfolio context - built on Angel One SmartAPI with a C++17 indicator engine.
      </p>
      <Link
        href="/terminal"
        className="mt-8 inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
      >
        Open terminal
      </Link>
      <TerminalPreviewFrame />
    </section>
  )
}
