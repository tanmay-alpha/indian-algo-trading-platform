import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, Brain, CandlestickChart, Github, Linkedin, Mail, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About | MAET Terminal',
  description: 'About MAET Terminal - Making algo trading accessible for Indian markets.',
}

const TECH_STACK = [
  { icon: '⚛️', name: 'Next.js 15', description: 'Frontend framework' },
  { icon: '🐍', name: 'FastAPI', description: 'Backend API' },
  { icon: '📊', name: ' lightweight-charts', description: 'Financial charting' },
  { icon: '🗄️', name: 'SQLite + Alembic', description: 'Data persistence' },
  { icon: '🔌', name: 'Angel One SmartAPI', description: 'Market data & orders' },
  { icon: '⚡', name: 'C++17', description: 'Indicator compute' },
  { icon: '🤖', name: 'AI/LLM', description: 'Market analysis' },
  { icon: '🔒', name: 'Safety-first', description: 'Live trading locks' },
]

export default function AboutPage() {
  return (
    <main className="maet-page-bg min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <Link href="/" className="text-sm text-maet-text-muted hover:text-maet-text">
            ← Back to Home
          </Link>
          <h1 className="mt-4 font-heading text-3xl font-bold text-maet-text lg:text-4xl">
            About MAET Terminal
          </h1>
        </header>

        {/* Mission */}
        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Our Mission</h2>
          <p className="text-lg leading-relaxed text-maet-text-secondary">
            Making <strong>algorithmic trading accessible</strong> for Indian markets.
          </p>
          <p className="text-sm text-maet-text-secondary">
            We believe retail investors deserve the same tools as institutions.
            MAET Terminal puts professional-grade trading infrastructure in your hands —
            without the complexity or risk.
          </p>
        </section>

        {/* Developer */}
        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Developer</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-maet-cyan/20 text-xl font-bold text-maet-cyan">
              TM
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-maet-text">
                Tanmay Mangal
                <BadgeCheck className="h-4 w-4 text-maet-cyan" />
              </div>
              <p className="text-sm text-maet-text-muted">Creator, MAET Terminal</p>
            </div>
          </div>
          <p className="text-sm text-maet-text-secondary">
            Building trading systems since 2026. Focused on safety, simplicity, and transparency.
          </p>
          <div className="flex gap-3">
            <Link
              href="https://linkedin.com/in/tanmaymangal"
              className="inline-flex items-center gap-2 text-sm text-maet-text-muted hover:text-maet-text"
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </Link>
            <Link
              href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
              className="inline-flex items-center gap-2 text-sm text-maet-text-muted hover:text-maet-text"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Tech Stack</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className="rounded-xl border border-maet-glass-border bg-maet-bg-deep/30 p-3 text-center"
              >
                <div className="text-xl">{tech.icon}</div>
                <div className="mt-1 text-xs font-bold text-maet-text">{tech.name}</div>
                <div className="text-[10px] text-maet-text-muted">{tech.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Key Features */}
        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Key Features</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-maet-green" />
              <div>
                <span className="font-bold text-maet-text">Safety-first design</span>
                <p className="text-sm text-maet-text-muted">
                  Live trading is hard-locked. All broker actions require explicit approval.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CandlestickChart className="mt-0.5 h-5 w-5 shrink-0 text-maet-cyan" />
              <div>
                <span className="font-bold text-maet-text">Professional charting</span>
                <p className="text-sm text-maet-text-muted">
                  Interactive charts with 50+ technical indicators.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Brain className="mt-0.5 h-5 w-5 shrink-0 text-maet-violet" />
              <div>
                <span className="font-bold text-maet-text">AI-assisted analysis</span>
                <p className="text-sm text-maet-text-muted">
                  LLM-powered market insights and explanations.
                </p>
              </div>
            </li>
          </ul>
        </section>

        {/* Created */}
        <section className="maet-card space-y-2 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Timeline</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-maet-text-muted">Created</dt>
              <dd className="font-mono text-maet-text">May 2026</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-maet-text-muted">Beta Launch</dt>
              <dd className="font-mono text-maet-text">June 2026</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-maet-text-muted">Mobile Support</dt>
              <dd className="font-mono text-maet-text">June 2026</dd>
            </div>
          </dl>
        </section>

        {/* Contact */}
        <section className="maet-card space-y-4 p-6">
          <h2 className="font-heading text-lg font-bold text-maet-text">Get in Touch</h2>
          <p className="text-sm text-maet-text-secondary">
            Have questions, feedback, or want to contribute? We&apos;d love to hear from you.
          </p>
          <Link
            href="mailto:tanmay@maet.in"
            className="inline-flex items-center gap-2 text-sm text-maet-text-muted hover:text-maet-text"
          >
            <Mail className="h-4 w-4" />
            tanmay@maet.in
          </Link>
        </section>

        <footer className="text-center text-xs text-maet-text-muted">
          <Link href="/" className="hover:text-maet-text">
            ← Back to Home
          </Link>
        </footer>
      </div>
    </main>
  )
}
