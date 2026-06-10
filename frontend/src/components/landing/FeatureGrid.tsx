import {
  IconBrain,
  IconBriefcase,
  IconChartCandle,
  IconChartDots,
  IconSearch,
  IconShieldCheck,
} from '@tabler/icons-react'

const features = [
  {
    title: 'Candlestick charts',
    body: 'NSE/BSE OHLCV data with EMA, VWAP, RSI, MACD, and Bollinger Band overlays.',
    Icon: IconChartCandle,
  },
  {
    title: 'Symbol search',
    body: 'Search the full NSE/BSE instrument master across equity, index, and F&O segments.',
    Icon: IconSearch,
  },
  {
    title: 'Dry-run validation',
    body: 'Test order parameters before any real-money workflow. All validation runs in paper mode only.',
    Icon: IconShieldCheck,
  },
  {
    title: 'Portfolio context',
    body: 'Read-only view of broker-side holdings, positions, and equity curve.',
    Icon: IconBriefcase,
  },
  {
    title: 'AI market notes',
    body: 'Ask about candle patterns, indicator readings, and risk context. The AI explains; it does not trade.',
    Icon: IconBrain,
  },
  {
    title: 'Strategy backtesting',
    body: 'Run EMA crossover, RSI mean-reversion, and VWAP pullback on historical candle data.',
    Icon: IconChartDots,
  },
] as const

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, body, Icon }) => (
          <article key={title} className="flex flex-col gap-3 bg-base p-6">
            <Icon aria-hidden className="mb-1 h-6 w-6 text-accent" stroke={1.8} />
            <h2 className="font-sans text-sm font-medium text-text-primary">{title}</h2>
            <p className="text-xs leading-relaxed text-text-muted">{body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
