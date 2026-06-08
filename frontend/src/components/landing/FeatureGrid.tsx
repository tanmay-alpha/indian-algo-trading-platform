import {
  IconActivity,
  IconBrain,
  IconChartBar,
  IconChartCandle,
  IconListSearch,
  IconShieldCheck,
} from '@tabler/icons-react'

const features = [
  {
    title: 'Candlestick charts',
    description: 'NSE/BSE OHLCV data with EMA, VWAP, RSI, MACD, and Bollinger Band overlays.',
    Icon: IconChartCandle,
  },
  {
    title: 'Symbol search',
    description: 'Search the full NSE/BSE instrument master across equity, index, and F&O segments.',
    Icon: IconListSearch,
  },
  {
    title: 'Dry-run validation',
    description: 'Test order parameters before any real-money workflow. All validation runs in paper mode only.',
    Icon: IconShieldCheck,
  },
  {
    title: 'Portfolio context',
    description: 'Read-only view of broker-side holdings, positions, and equity curve — no account mutations.',
    Icon: IconChartBar,
  },
  {
    title: 'AI market notes',
    description: 'Ask about candle patterns, indicator readings, and risk context. The AI explains — it does not trade.',
    Icon: IconBrain,
  },
  {
    title: 'Strategy backtesting',
    description: 'Run EMA crossover, RSI mean-reversion, and VWAP pullback strategies against historical candle data.',
    Icon: IconActivity,
  },
] as const

export function FeatureGrid() {
  return (
    <section className="border-t border-border px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, Icon }) => (
            <article key={title} className="border border-border bg-panel p-5">
              <Icon aria-hidden className="h-6 w-6 text-accent" stroke={1.8} />
              <h2 className="mt-5 font-mono text-[15px] font-semibold text-primary">{title}</h2>
              <p className="mt-3 font-sans text-[13px] leading-6 text-muted">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
