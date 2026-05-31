'use client'

import Link from 'next/link'
import { ShieldCheck, Cpu, Layers, Activity, ArrowRight, Lock, Terminal, Eye, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function LandingPage() {
  const [tickerPrice, setTickerPrice] = useState(24210.55)
  const [tickerChange, setTickerChange] = useState(120.45)
  const [tickerPercent, setTickerPercent] = useState(0.50)

  // Subtle simulated market ticker update to give the page life
  useEffect(() => {
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.48) * 4.5
      setTickerPrice((prev) => {
        const next = prev + delta
        const change = next - 24090.10
        setTickerChange(change)
        setTickerPercent((change / 24090.10) * 100)
        return next
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#05070a] text-text font-sans relative overflow-x-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#38bdf8]/10 to-transparent rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] -right-40 w-[500px] h-[500px] bg-gradient-to-b from-[#a855f7]/5 to-transparent rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 term-grid pointer-events-none opacity-20 -z-20" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#05070a]/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#38bdf8] to-[#0284c7] text-[#05070a] font-bold shadow-lg shadow-[#38bdf8]/20">
              M
            </div>
            <div>
              <span className="font-bold text-sm tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-text to-text-2">
                MAET <span className="text-[#38bdf8] font-mono text-xs">TERMINAL</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-down/30 bg-down/10 text-down font-mono text-[9px] font-semibold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-down animate-ping" />
              LIVE SHIELD ACTIVE
            </div>
            <Link
              href="/terminal"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 transition-all shadow-sm shadow-[#38bdf8]/10 hover:shadow-[#38bdf8]/20"
            >
              Launch Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.05] bg-panel-2/40 backdrop-blur-sm text-text-dim text-[11px] font-mono mb-8 hover:border-white/10 transition-all select-none">
          <Terminal className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>v0.1.0 Institutional Workstation for Indian Markets</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-4xl mx-auto select-none">
          Market Analytics &amp; Execution{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#a855f7] text-glow-cyan">
            Terminal
          </span>
        </h1>

        <p className="text-base sm:text-lg text-text-2 max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
          A high-performance, mobile-first frontend shell built for Indian algorithmic trading.
          Stream real-time data from NSE/BSE and monitor strategies inside a hardened safety sandbox.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/terminal"
            className="w-full sm:w-auto px-8 py-3 text-sm font-semibold rounded-md text-bg bg-[#38bdf8] hover:bg-[#7dd3fc] transition-all shadow-lg shadow-[#38bdf8]/20 hover:shadow-[#38bdf8]/35 text-center font-mono flex items-center justify-center gap-2"
          >
            Launch Terminal <Terminal className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3 text-sm font-semibold rounded-md text-text border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-all text-center font-mono flex items-center justify-center gap-2"
          >
            Source Code (GitHub) <ArrowRight className="w-4 h-4 opacity-65" />
          </a>
        </div>

        {/* Live Index Ticker Strip (Visual Component) */}
        <div className="max-w-4xl mx-auto mb-16 p-[1px] rounded-lg bg-gradient-to-r from-transparent via-[#38bdf8]/20 to-transparent">
          <div className="bg-[#0c1117]/60 backdrop-blur-md py-3 px-6 rounded-lg flex flex-wrap items-center justify-around gap-4 text-xs font-mono border border-white/[0.03]">
            <div className="flex items-center gap-2">
              <span className="text-text-dim uppercase tracking-wider text-[10px]">NIFTY 50</span>
              <span className="font-semibold">{tickerPrice.toFixed(2)}</span>
              <span className={tickerChange >= 0 ? 'text-up' : 'text-down'}>
                {tickerChange >= 0 ? '+' : ''}{tickerChange.toFixed(2)} ({tickerPercent.toFixed(2)}%)
              </span>
            </div>
            <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-text-dim uppercase tracking-wider text-[10px]">SENSEX</span>
              <span className="font-semibold">79,648.90</span>
              <span className="text-up">+480.20 (+0.60%)</span>
            </div>
            <div className="h-4 w-[1px] bg-white/[0.08] hidden md:block" />
            <div className="flex items-center gap-2">
              <span className="text-text-dim uppercase tracking-wider text-[10px]">SESSION</span>
              <span className="text-warn font-semibold">PRE-MARKET (NSE)</span>
            </div>
          </div>
        </div>

        {/* Terminal Screen Mockup Preview (3D Glass UI) */}
        <div className="max-w-5xl mx-auto glass-card-3d rounded-xl overflow-hidden border border-[#38bdf8]/25 p-2 shadow-2xl relative select-none">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#38bdf8] via-[#a855f7] to-[#38bdf8]" />
          
          {/* Header */}
          <div className="h-8 border-b border-white/[0.05] px-3 flex items-center justify-between text-[11px] font-mono text-text-dim bg-bg-2/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-down/40" />
              <span>MAET TERMINAL v0.1.0</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-up flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" /> WEBSOCKET: CONNECTED</span>
              <span>REST: API PORT 8088</span>
            </div>
          </div>

          {/* Simulated content preview */}
          <div className="bg-[#05070a]/90 grid grid-cols-1 md:grid-cols-4 h-[380px] text-left">
            {/* Sidebar nav simulation */}
            <div className="border-r border-white/[0.05] p-3 space-y-2 hidden md:block bg-bg/40">
              <div className="text-[10px] font-mono text-text-faint tracking-widest uppercase mb-4">WORKSPACES</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#38bdf8]/10 text-[#38bdf8] font-mono text-xs"><Terminal className="w-3.5 h-3.5" /> Terminal Canvas</div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-text-dim font-mono text-xs"><Activity className="w-3.5 h-3.5" /> Market Heatmap</div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-text-dim font-mono text-xs"><Cpu className="w-3.5 h-3.5" /> Strategy Lab</div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-text-dim font-mono text-xs"><Layers className="w-3.5 h-3.5" /> Portfolio (Read-only)</div>
            </div>

            {/* Main content simulation */}
            <div className="col-span-3 p-4 flex flex-col justify-between font-mono">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">NIFTY 50 WEEKLY STRATEGY</h3>
                    <p className="text-[10px] text-text-dim">MAET Core Engine advisory feed</p>
                  </div>
                  <span className="text-[10px] border border-warn/30 bg-warn/10 text-warn px-2 py-0.5 rounded uppercase font-semibold">Advisory Advisory Only</span>
                </div>

                {/* Simulated Chart lines */}
                <div className="h-44 border border-white/[0.05] bg-panel-2/30 rounded p-3 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-0 chart-grid opacity-10" />
                  <div className="flex justify-between text-[9px] text-text-faint">
                    <span>24,250</span>
                    <span>24,200</span>
                    <span>24,150</span>
                  </div>
                  {/* Drawing simulated vector path of chart line */}
                  <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 0 60 Q 20 40 40 70 T 80 20 T 100 30" fill="none" stroke="var(--info)" strokeWidth="1.5" />
                    <path d="M 0 60 Q 20 40 40 70 T 80 20 T 100 30 L 100 100 L 0 100 Z" fill="url(#grad)" opacity="0.05" />
                    <defs>
                      <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--info)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="flex justify-between text-[9px] text-text-dim z-10 pt-36">
                    <span>14:00</span>
                    <span>14:30</span>
                    <span>15:00</span>
                    <span>15:30</span>
                  </div>
                </div>
              </div>

              {/* Bottom status indicator */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.05]">
                <div className="text-[10px] text-[#38bdf8] border border-[#38bdf8]/20 bg-[#38bdf8]/5 px-2 py-0.5 rounded font-mono">
                  LIVE EXECUTION LOCKED
                </div>
                <div className="text-[10px] text-warn border border-warn/20 bg-warn/5 px-2 py-0.5 rounded font-mono">
                  PAPER TRADING GATED
                </div>
                <div className="text-[10px] text-[#a855f7] border border-[#a855f7]/20 bg-[#a855f7]/5 px-2 py-0.5 rounded font-mono">
                  BROKER RECONCILIATION READ-ONLY
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/[0.03]">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-12">
          Engineered for Performance &amp; Safety
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-panel p-6 rounded-lg border border-white/[0.05] relative group">
            <div className="w-10 h-10 rounded-md bg-[#38bdf8]/10 text-[#38bdf8] flex items-center justify-center mb-4 border border-[#38bdf8]/20">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Real-Time Data Feeds</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Consumes real-time streaming WebSocket updates directly from backend brokers and feeds it seamlessly into responsive frontend UI cells.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-lg border border-white/[0.05] relative group">
            <div className="w-10 h-10 rounded-md bg-[#a855f7]/10 text-[#a855f7] flex items-center justify-center mb-4 border border-[#a855f7]/20">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">3D Glass Dashboard</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Crafted with semi-transparent surfaces, modern border glows, and micro-layouts for dense market overview on desktop and mobile viewports.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-lg border border-white/[0.05] relative group">
            <div className="w-10 h-10 rounded-md bg-warn/10 text-warn flex items-center justify-center mb-4 border border-warn/20">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">AI-Advisory Engine</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Direct strategy advice overlay and signals with fully transparent, read-only analytical flows directly linked to Python ML kernels.
            </p>
          </div>
        </div>
      </section>

      {/* Safety Architecture Section */}
      <section className="bg-gradient-to-b from-transparent to-[#0c1117]/30 border-t border-white/[0.03] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-panel p-8 md:p-12 rounded-xl border border-down/20 relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-down/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
              <div className="w-14 h-14 shrink-0 rounded-full bg-down/10 text-down flex items-center justify-center border border-down/30 shadow-lg shadow-down/10">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                  Safety Gating &amp; Hardened Infrastructure Policy
                </h2>
                <p className="text-xs sm:text-sm text-text-2 mb-6 max-w-3xl leading-relaxed">
                  MAET Terminal operates on a hardened architecture constraint. High-frequency live order mutations are programmatically locked at the backend compiled level. All portfolio views and account sync events are executed through a read-only parser to prevent unauthorized mutations.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-text-dim">
                    <Lock className="w-4 h-4 text-down shrink-0" />
                    <span>Live Order Gating (Active)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-text-dim">
                    <Eye className="w-4 h-4 text-[#38bdf8] shrink-0" />
                    <span>Read-Only Broker Reconciliation</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-text-dim">
                    <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
                    <span>Analytical Advisory Pipeline Only</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] bg-[#05070a] py-8 text-center text-xs font-mono text-text-dim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>© 2026 MAET Terminal. Secure Algorithmic Engineering client.</span>
          </div>
          <div className="flex gap-4">
            <Link href="/terminal" className="hover:text-white transition-colors">Workspace</Link>
            <span>·</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
