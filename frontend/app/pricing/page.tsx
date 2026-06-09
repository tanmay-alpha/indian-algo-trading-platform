import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, Check, Github, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pricing | MAET Terminal',
  description: 'MAET Terminal pricing - Free during beta, with Pro tier coming soon.',
}

const FEATURES = [
  { name: 'Real-time market data', free: true, pro: true },
  { name: 'Paper trading simulation', free: true, pro: true },
  { name: 'Technical indicators (50+)', free: true, pro: true },
  { name: 'AI market analysis', free: true, pro: true },
  { name: 'Custom strategies', free: true, pro: true },
  { name: 'Multi-leg orders', free: false, pro: true },
  { name: 'API access', free: false, pro: true },
  { name: 'Priority support', free: false, pro: true },
  { name: 'Custom integrations', free: false, pro: true },
]

const FEATURE_COLS = [
  { key: 'name', label: 'Feature' },
  { key: 'free', label: 'Free' },
  { key: 'pro', label: 'Pro' },
]

export default function PricingPage() {
  return (
    <main className="maet-page-bg min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="text-center">
          <Link href="/" className="text-sm text-maet-text-muted hover:text-maet-text">
            ← Back to Home
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-maet-text lg:text-4xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-2 text-maet-text-secondary">
            Start free during beta. Upgrade when you're ready.
          </p>
        </header>

        {/* Pricing Cards */}
        <section className="grid gap-6 lg:grid-cols-2">
          {/* Free Tier */}
          <div className="maet-card border-maet-glass-border p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold text-maet-text">Free</h2>
                <span className="rounded-full bg-maet-green/20 px-3 py-1 text-xs font-bold text-maet-green">
                  CURRENT
                </span>
              </div>
              <div>
                <span className="text-4xl font-bold text-maet-text">₹0</span>
                <span className="text-maet-text-muted">/forever</span>
              </div>
              <p className="text-sm text-maet-text-secondary">
                Perfect for learning and research.
              </p>
            </div>
            <ul className="mt-6 space-y-3">
              {FEATURES.filter(f => f.free).map((feature) => (
                <li key={feature.name} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-maet-green" />
                  <span className="text-maet-text">{feature.name}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href="/terminal"
                className="maet-btn maet-btn-primary block w-full text-center"
              >
                Get Started Free
              </Link>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="maet-card relative border-maet-cyan p-6">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-maet-cyan px-4 py-1 text-xs font-bold text-maet-bg">
                COMING SOON
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-xl font-bold text-maet-text">Pro</h2>
                <BadgeCheck className="h-5 w-5 text-maet-cyan" />
              </div>
              <div>
                <span className="text-4xl font-bold text-maet-text">₹499</span>
                <span className="text-maet-text-muted">/month</span>
              </div>
              <p className="text-sm text-maet-text-secondary">
                For serious traders and developers.
              </p>
            </div>
            <ul className="mt-6 space-y-3">
              {FEATURES.map((feature) => (
                <li
                  key={feature.name}
                  className={`flex items-center gap-2 text-sm ${
                    feature.pro ? 'text-maet-text' : 'text-maet-text-muted'
                  }`}
                >
                  {feature.pro ? (
                    <Check className="h-4 w-4 text-maet-cyan" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <span>{feature.name}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <button
                type="button"
                disabled
                className="maet-btn maet-btn-secondary pointer-events-none opacity-50 block w-full text-center"
              >
                <Mail className="mr-2 inline h-4 w-4" />
                Join Waitlist
              </button>
            </div>
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="maet-card overflow-hidden">
          <h2 className="border-b border-maet-glass-border p-4 font-heading text-lg font-bold text-maet-text">
            Feature Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-maet-glass-border">
                  {FEATURE_COLS.map((col) => (
                    <th
                      key={col.key}
                      className="p-3 text-left font-bold text-maet-text"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, i) => (
                  <tr
                    key={feature.name}
                    className={i % 2 === 0 ? 'bg-maet-bg-deep/30' : ''}
                  >
                    <td className="p-3 text-maet-text">{feature.name}</td>
                    <td className="p-3 text-maet-text">
                      {feature.free ? (
                        <Check className="h-4 w-4 text-maet-green" />
                      ) : (
                        <span className="text-maet-text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3 text-maet-text">
                      {feature.pro ? (
                        <Check className="h-4 w-4 text-maet-cyan" />
                      ) : (
                        <span className="text-maet-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ or Note */}
        <section className="rounded-2xl border border-maet-amber/25 bg-maet-amber/10 p-4">
          <h3 className="font-heading text-base font-bold text-maet-text">Free During Beta</h3>
          <p className="mt-2 text-sm text-maet-text-secondary">
            MAET Terminal is <strong>completely free</strong> during the beta period (until September 2026).
            No credit card required. All features are available.
            When we launch Pro tier, free users will continue to have access to all current features forever.
          </p>
        </section>

        {/* GitHub Link */}
        <footer className="text-center">
          <Link
            href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
            className="inline-flex items-center gap-2 text-sm text-maet-text-muted hover:text-maet-text"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </Link>
        </footer>
      </div>
    </main>
  )
}