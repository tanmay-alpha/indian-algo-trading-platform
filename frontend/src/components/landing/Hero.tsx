import Link from 'next/link'

export function Hero() {
  return (
    <section className="mx-auto grid min-h-[calc(100dvh-56px)] max-w-7xl items-center gap-10 px-4 pb-16 pt-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-mono text-[36px] font-semibold leading-[1.1] tracking-normal text-primary">
          A professional algo desk for Indian markets.
        </h1>
        <p className="mt-5 max-w-xl font-sans text-[16px] leading-7 text-muted">
          Candlestick charts, technical indicators, dry-run validation, and portfolio context — built on Angel One SmartAPI with a C++17 indicator engine.
        </p>
        <Link
          href="/terminal"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-sm bg-accent px-5 font-sans text-[14px] font-medium text-white transition-colors hover:bg-[#2563EB] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-base"
        >
          Open terminal →
        </Link>
      </div>

      <div className="relative">
        <div className="absolute -inset-4 -z-10 bg-accent-dim blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element -- prompt requires the hero visual to render as an img. */}
        <img
          src="/maet-terminal-mock.svg"
          alt="MAET Terminal interface with watchlist, candlestick chart, and OHLC panel"
          className="w-full border border-border-strong bg-panel"
        />
      </div>
    </section>
  )
}
