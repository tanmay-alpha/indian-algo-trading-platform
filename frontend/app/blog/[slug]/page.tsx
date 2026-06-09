import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'

interface BlogPostProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const { slug } = await params
  const post = POSTS[slug as keyof typeof POSTS]
  if (!post) {
    return { title: 'Post Not Found | MAET Terminal' }
  }
  return {
    title: `${post.title} | MAET Terminal Blog`,
    description: post.excerpt,
  }
}

const POSTS = {
  'paper-trading-why-it-matters': {
    title: 'Paper Trading: Why It Matters',
    excerpt: 'Understanding the safety model that makes algorithmic trading accessible without risking real money.',
    date: 'June 8, 2026',
    readTime: '5 min read',
    content: `
## What is Paper Trading?

Paper trading is simulating trades without using real money. It's like a flight simulator for traders — you practice in a safe environment where mistakes cost nothing.

When I built MAET Terminal, safety was my top priority. I wanted to create a platform where anyone could learn algorithmic trading without accidentally pressing the wrong button and losing their life savings.

## The Problem with Live Trading

Most trading platforms put live trading front and center. There's a prominent "Buy" button, and if you click it, your money is on the line. This is dangerous for several reasons:

1. **Emotional decisions** — Real money triggers greed and fear
2. **No testing** — Strategies that look good in backtesting fail in live markets
3. **Technical glitches** — API errors, network issues, or simple typos can cause catastrophic losses
4. **Lack of understanding** — New traders don't understand order types, margins, or risk

## MAET's Safety Model

MAET Terminal takes a different approach:

### 1. Paper-First Design
Everything runs in paper mode by default. You can test strategies, place orders, and see results — all with zero financial risk.

### 2. Hard Locks
Live trading is physically locked in the codebase. Even if someone tries to enable it, the system blocks all broker mutations.

### 3. Explicit Approvals
Any action that could involve real money requires multiple explicit approvals and clear warnings.

### 4. Read-Only Modes
Portfolio and account views are read-only by default. No accidental mutations.

## Why This Matters

I built MAET because I believe:

- **Everyone deserves to practice** — New traders shouldn't risk real money while learning
- **Strategies need testing** — Backtesting isn't enough; paper trading reveals execution issues
- **Safety enables learning** — When you're not worried about losing money, you can focus on learning

## The Result

With MAET, you can:

- ✅ Test strategies with real market data (not just backtests)
- ✅ Practice order placement without risk
- ✅ Understand platform behavior in different market conditions
- ✅ Build confidence before going live

And when you're ready to go live? You'll have a clear understanding of what you're doing, and the platform will still warn you at every step.

---

*Paper trading isn't about avoiding risk — it's about learning to manage it.*
    `,
  },
  'why-i-built-maet': {
    title: 'Why I Built MAET Terminal',
    excerpt: 'My journey building a paper-mode research platform for Indian algo traders.',
    date: 'June 5, 2026',
    readTime: '8 min read',
    content: `
## The Problem

I've been interested in algorithmic trading for years. I studied markets, learned technical analysis, and built dozens of strategies in Python. But every time I wanted to actually trade? I hit a wall.

**Every platform is designed for live trading first.**

Want to test a strategy? Great — backtest it! Oh, you need live data? That costs money. Want to automate orders? Enable live trading! Want to see if your bot works? Well, I hope you have capital to lose.

I couldn't find a platform that said: "Hey, let's practice first. Learn the markets. Test your ideas. Then, when you're ready, we'll help you go live safely."

## The Indian Market Problem

Trading in India has unique challenges:

1. **Data costs money** — Free APIs are rare or delayed
2. **Brokers have different APIs** — No standard integration
3. **Regulatory complexity** — SEBI registration, compliance, etc.
4. ** Limited automation** — Most brokers don't support API trading

But there's also opportunity: millions of Indian traders who want to learn but can't afford to lose money while practicing.

## My Vision

I built MAET Terminal with a simple philosophy:

> **Paper-first, safety-second, live-when-ready**

### What MAET Does

- **Free market data** — Real-time quotes during market hours
- **Paper trading** — Simulate any strategy, any order type
- **Professional tools** — 50+ indicators, multiple timeframes, charting
- **AI assistance** — LLM-powered market analysis
- **Hard safety locks** — Live trading requires explicit action

### What MAET Doesn't Do

- ❌ Require real money
- ❌ Expose live trading by default
- ❌ Make it easy to lose money
- ❌ Give financial advice

## The Journey So Far

### May 2026: Started Building
I spent the month setting up the infrastructure:
- FastAPI backend with Angel One SmartAPI
- SQLite database for orders and fills
- Technical indicator engine (C++ for speed)
- Frontend with Next.js

### June 2026: Beta Launch
- Real-time market data
- Paper trading simulation
- Mobile-responsive design
- Safety warnings everywhere

### What's Next

- More indicators and strategies
- Backtesting capabilities
- Strategy marketplace
- Paper trading competitions

## Why Free?

MAET is free during beta because:

1. **I want feedback** — Tell me what breaks, what confuses, what helps
2. **Network effects** — More users = better data = better platform
3. **I believe in the mission** — Everyone should be able to learn

When MAET grows, I'll find sustainable ways to monetize (Pro tier, API access, custom integrations). But the core will always be free for learning.

## Join Me

If you're curious about algorithmic trading, want to test strategies, or just want to understand markets better — MAET is here for you.

Start at [maet.in](/), explore the charts, place some paper orders, and let me know what you think.

---

*Building in public. Learning out loud. Hoping to help.*
    `,
  },
}

export default async function BlogPostPage({ params }: BlogPostProps) {
  const { slug } = await params
  const post = POSTS[slug as keyof typeof POSTS]

  if (!post) {
    notFound()
  }

  const content = post.content.trim().split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return { type: 'h2' as const, content: line.replace('## ', '') }
    }
    if (line.startsWith('### ')) {
      return { type: 'h3' as const, content: line.replace('### ', '') }
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      return { type: 'bold' as const, content: line.replace(/\*\*/g, '') }
    }
    if (line.startsWith('- ') || line.startsWith('✅ ') || line.startsWith('❌ ')) {
      return { type: 'list' as const, content: line }
    }
    if (line.startsWith('---')) {
      return { type: 'divider' as const, content: '' }
    }
    return { type: 'p' as const, content: line }
  })

  return (
    <main className="maet-page-bg min-h-screen p-4 lg:p-8">
      <article className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-4">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-maet-text-muted hover:text-maet-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
          <h1 className="font-heading text-3xl font-bold text-maet-text lg:text-4xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-maet-text-muted">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {post.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.readTime}
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="maet-card space-y-4 p-6">
          {content.map((line, i) => {
            switch (line.type) {
              case 'h2':
                return (
                  <h2 key={i} className="font-heading text-xl font-bold text-maet-text mt-6">
                    {line.content}
                  </h2>
                )
              case 'h3':
                return (
                  <h3 key={i} className="font-heading text-base font-bold text-maet-text mt-4">
                    {line.content}
                  </h3>
                )
              case 'list':
                return (
                  <li key={i} className="ml-4 list-disc text-maet-text-secondary">
                    {line.content}
                  </li>
                )
              case 'divider':
                return <hr key={i} className="my-4 border-maet-glass-border" />
              case 'bold':
                return (
                  <p key={i} className="font-bold text-maet-text">
                    {line.content}
                  </p>
                )
              default:
                return line.content ? (
                  <p key={i} className="text-maet-text-secondary leading-relaxed">
                    {line.content}
                  </p>
                ) : null
            }
          })}
        </div>

        {/* Author bio */}
        <section className="maet-card flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-maet-cyan/20 text-lg font-bold text-maet-cyan">
            TM
          </div>
          <div>
            <p className="font-bold text-maet-text">Tanmay Mangal</p>
            <p className="text-sm text-maet-text-muted">Creator, MAET Terminal</p>
          </div>
        </section>

        {/* Back to blog */}
        <footer className="text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm text-maet-text-muted hover:text-maet-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
        </footer>
      </article>
    </main>
  )
}