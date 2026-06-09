import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Disclaimer | MAET Terminal',
  description: 'Important legal disclaimer for MAET Terminal - a paper-mode research platform.',
}

export default function DisclaimerPage() {
  const lastUpdated = 'June 2026'
  return (
    <main className="maet-page-bg min-h-screen p-4 lg:p-8">
      <article className="mx-auto max-w-2xl space-y-6">
        <header className="mb-8">
          <Link href="/" className="text-sm text-maet-text-muted hover:text-maet-text">
            ← Back to Home
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-maet-text">Disclaimer</h1>
          <p className="mt-2 text-sm text-maet-text-muted">Last updated: {lastUpdated}</p>
        </header>

        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Important Notice</h2>

          <div className="space-y-4 text-sm leading-relaxed text-maet-text-secondary">
            <p>
              <strong>MAET Terminal</strong> is a <em>paper-mode research and demo platform</em>.
              It is <strong>not</strong> registered with SEBI (Securities and Exchange Board of India) or any
              other regulatory authority in India or abroad.
            </p>

            <p>
              <strong>No Real Money Involved:</strong> This platform does not involve any real money transactions.
              All trading simulated through this platform is purely virtual/paper trading with no financial value.
            </p>

            <p>
              <strong>Not Investment Advice:</strong> The information, analysis, tools, and features provided
              through MAET Terminal do <strong>not</strong> constitute investment advice, financial advice,
              or any form of professional advice. Users should consult qualified financial advisors
              before making any investment decisions.
            </p>

            <p>
              <strong>Educational Purpose Only:</strong> This platform is provided for educational and
              research purposes only. It helps users understand algorithmic trading concepts and market
              mechanics without risking real capital.
            </p>

            <p>
              <strong>No Performance Guarantees:</strong> Past performance of any trading strategy, indicator,
              or algorithm does <strong>not</strong> guarantee future results. Market conditions change,
              and what works in historical backtesting may not work in live markets.
            </p>

            <p>
              <strong>Risk Warning:</strong> Trading in financial markets involves substantial risk.
              Users should only trade with capital they can afford to lose entirely.
            </p>
          </div>
        </section>

        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text"> liability</h2>
          <p className="text-sm leading-relaxed text-maet-text-secondary">
            To the maximum extent permitted by law, MAET Terminal and its developer (Tanmay Mangal) shall not be
            liable for any losses, damages, or expenses arising from the use of this platform. Users assume all responsibility
            for their trading decisions and actions.
          </p>
        </section>

        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Contact</h2>
          <p className="text-sm leading-relaxed text-maet-text-secondary">
            For questions about this disclaimer, please contact the developer through appropriate channels.
          </p>
        </section>

        <footer className="mt-8 text-center text-xs text-maet-text-muted">
          <Link href="/" className="hover:text-maet-text">
            ← Back to Home
          </Link>
        </footer>
      </article>
    </main>
  )
}