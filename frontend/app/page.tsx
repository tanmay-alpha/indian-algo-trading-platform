'use client'

import Link from 'next/link'
import {
  ShieldCheck, Cpu, Layers, Activity, ArrowRight,
  Lock, Terminal, Eye, AlertTriangle, BookOpen,
  List, BarChart2, Briefcase, Brain, Flame, Smartphone, ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'

type MockTab = 'home' | 'chart' | 'portfolio' | 'ai'

export default function LandingPage() {
  const [activeMockTab, setActiveMockTab] = useState<MockTab>('home')
  
  // Tickers for simulated market feeds
  const [niftyPrice, setNiftyPrice] = useState(24210.55)
  const [niftyChange, setNiftyChange] = useState(120.45)
  const [niftyPercent, setNiftyPercent] = useState(0.50)

  const [reliancePrice, setReliancePrice] = useState(2450.75)
  const [relianceChange, setRelianceChange] = useState(15.30)
  
  const [tcsPrice, setTcsPrice] = useState(3890.20)
  const [tcsChange, setTcsChange] = useState(-22.45)

  // Live simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Update Nifty
      const niftyDelta = (Math.random() - 0.48) * 4.5
      setNiftyPrice((prev) => {
        const next = prev + niftyDelta
        const change = next - 24090.10
        setNiftyChange(change)
        setNiftyPercent((change / 24090.10) * 100)
        return next
      })

      // Update Reliance
      const relDelta = (Math.random() - 0.47) * 0.8
      setReliancePrice((prev) => {
        const next = prev + relDelta
        setRelianceChange(next - 2435.45)
        return next
      })

      // Update TCS
      const tcsDelta = (Math.random() - 0.52) * 1.2
      setTcsPrice((prev) => {
        const next = prev + tcsDelta
        setTcsChange(next - 3912.65)
        return next
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#070A0F] text-text font-sans relative overflow-x-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#38bdf8]/8 to-transparent rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-[800px] -right-40 w-[500px] h-[500px] bg-gradient-to-b from-[#a855f7]/5 to-transparent rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute bottom-[200px] -left-40 w-[600px] h-[600px] bg-gradient-to-b from-[#16c784]/3 to-transparent rounded-full blur-[125px] pointer-events-none -z-10" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 term-grid pointer-events-none opacity-20 -z-20" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.05] bg-[#070A0F]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#38bdf8] to-[#0284c7] text-[#070A0F] font-bold shadow-lg shadow-[#38bdf8]/20">
              M
            </div>
            <div>
              <span className="font-bold text-sm tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-text to-[#94a3b8]">
                MAET <span className="text-[#38bdf8] font-mono text-xs">MOBILE</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-down/30 bg-down/10 text-down font-mono text-[9px] font-semibold tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              LIVE SHIELD LOCKED
            </div>
            <Link
              href="/terminal"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 transition-all shadow-sm shadow-[#38bdf8]/10"
            >
              Launch App
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm text-text-dim text-[11px] font-mono mb-8 hover:border-white/10 transition-all select-none">
          <Smartphone className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>v0.1.0 Premium Phone-First Trading Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1] max-w-4xl mx-auto select-none">
          Indian Markets. Sandbox Advisory.{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#a855f7] text-glow-cyan">
            Mobile Redefined
          </span>
        </h1>

        <p className="text-sm sm:text-base text-text-2 max-w-2xl mx-auto mb-10 leading-relaxed">
          Experience a beautiful mobile broker shell built for NSE/BSE. Simulated dry-run validations, 
          real-time telemetry logs, portfolio reconciliation, and AI advisory alerts in one elegant interface.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 max-w-md mx-auto">
          <Link
            href="/terminal"
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold rounded-xl text-bg bg-[#38bdf8] hover:bg-[#7dd3fc] transition-all shadow-lg shadow-[#38bdf8]/20 hover:scale-[1.02] text-center font-mono flex items-center justify-center gap-2"
          >
            Launch Mobile Dashboard <Smartphone className="w-4 h-4" />
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-semibold rounded-xl text-text border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-all hover:scale-[1.02] text-center font-mono flex items-center justify-center gap-2"
          >
            GitHub Repo <ArrowRight className="w-4 h-4 opacity-60" />
          </a>
        </div>

        {/* Live Index Ticker Strip */}
        <div className="max-w-3xl mx-auto mb-16 space-y-3">
          <div className="p-[1px] rounded-2xl bg-gradient-to-r from-transparent via-[#38bdf8]/25 to-transparent">
            <div className="bg-[#0b1017]/85 backdrop-blur-md py-3.5 px-6 rounded-2xl flex flex-wrap items-center justify-around gap-4 text-xs font-mono border border-white/[0.04]">
              <div className="flex items-center gap-2 select-none">
                <span className="text-text-dim uppercase tracking-wider text-[10px]">NIFTY 50</span>
                <span className="font-semibold tabular-nums text-text">{niftyPrice.toFixed(2)}</span>
                <span className={`font-semibold tabular-nums ${niftyChange >= 0 ? 'text-up' : 'text-down'}`}>
                  {niftyChange >= 0 ? '+' : ''}{niftyChange.toFixed(2)} ({niftyPercent.toFixed(2)}%)
                </span>
              </div>
              <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />
              <div className="flex items-center gap-2 select-none">
                <span className="text-text-dim uppercase tracking-wider text-[10px]">RELIANCE</span>
                <span className="font-semibold tabular-nums text-text">{reliancePrice.toFixed(2)}</span>
                <span className={`font-semibold tabular-nums ${relianceChange >= 0 ? 'text-up' : 'text-down'}`}>
                  {relianceChange >= 0 ? '+' : ''}{relianceChange.toFixed(2)}
                </span>
              </div>
              <div className="h-4 w-[1px] bg-white/[0.08] hidden md:block" />
              <div className="flex items-center gap-2 select-none">
                <span className="text-text-dim uppercase tracking-wider text-[10px]">NSE FEED</span>
                <span className="text-up font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse" /> DEMO FEED
                </span>
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] font-mono text-text-dim px-4 leading-normal">
            ⚠️ <strong>Visual demo — not live market data.</strong> MAET is currently in research/paper mode. Live execution is locked.
          </div>
        </div>

        {/* Interactive Device Simulation Container */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-4">
          
          {/* Column 1: Selector Tabs / Features */}
          <div className="md:col-span-5 text-left space-y-4 order-2 md:order-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#38bdf8]">
              Interactive App Demo
            </div>
            <h3 className="text-xl font-extrabold text-white leading-tight">
              Toggle screen mockups &amp; preview the mobile terminal
            </h3>
            <p className="text-xs text-text-2 leading-relaxed">
              MAET has been redesigned from the ground up for phone viewports. Try clicking the screens below to preview each dashboard module.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setActiveMockTab('home')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  activeMockTab === 'home'
                    ? 'bg-[#38bdf8]/10 border-[#38bdf8]/30 text-white'
                    : 'bg-white/[0.01] border-white/[0.04] text-text-dim hover:bg-white/[0.03]'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeMockTab === 'home' ? 'bg-[#38bdf8]/20 text-[#38bdf8]' : 'bg-white/[0.03] text-text-faint'}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">1. Home Workspace</div>
                  <div className="text-[10px] text-text-dim mt-0.5">Quick access dashboard &amp; environment checks</div>
                </div>
              </button>

              <button
                onClick={() => setActiveMockTab('chart')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  activeMockTab === 'chart'
                    ? 'bg-[#16c784]/10 border-[#16c784]/30 text-white'
                    : 'bg-white/[0.01] border-white/[0.04] text-text-dim hover:bg-white/[0.03]'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeMockTab === 'chart' ? 'bg-[#16c784]/20 text-[#16c784]' : 'bg-white/[0.03] text-text-faint'}`}>
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">2. Advanced Charts</div>
                  <div className="text-[10px] text-text-dim mt-0.5">Stock vector tracking &amp; manual execution validations</div>
                </div>
              </button>

              <button
                onClick={() => setActiveMockTab('portfolio')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  activeMockTab === 'portfolio'
                    ? 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-white'
                    : 'bg-white/[0.01] border-white/[0.04] text-text-dim hover:bg-white/[0.03]'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeMockTab === 'portfolio' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-white/[0.03] text-text-faint'}`}>
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">3. Portfolio Snapshot</div>
                  <div className="text-[10px] text-text-dim mt-0.5">Holdings, position values, and developer unlock</div>
                </div>
              </button>

              <button
                onClick={() => setActiveMockTab('ai')}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  activeMockTab === 'ai'
                    ? 'bg-[#a855f7]/10 border-[#a855f7]/30 text-white'
                    : 'bg-white/[0.01] border-white/[0.04] text-text-dim hover:bg-white/[0.03]'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeMockTab === 'ai' ? 'bg-[#a855f7]/20 text-[#a855f7]' : 'bg-white/[0.03] text-text-faint'}`}>
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">4. Strategy Copilot</div>
                  <div className="text-[10px] text-text-dim mt-0.5">Real-time signals, confidence index &amp; advisory advice</div>
                </div>
              </button>
            </div>
          </div>

          {/* Column 2: The Mock Phone Frame */}
          <div className="md:col-span-7 flex justify-center order-1 md:order-2">
            <div className="w-[320px] h-[580px] rounded-[38px] border-8 border-[#1E293B] bg-[#070A0F] shadow-2xl relative flex flex-col overflow-hidden select-none">
              
              {/* Phone Speaker Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-[#1E293B] rounded-b-xl z-50 flex items-center justify-center">
                <div className="w-8 h-1 bg-gray-600 rounded-full" />
              </div>

              {/* Mock Top Status Bar */}
              <div className="h-6 pt-1 px-5 flex items-center justify-between text-[9px] font-semibold text-text-dim font-mono z-40 bg-bg/40 shrink-0">
                <span>09:30</span>
                <div className="flex items-center gap-1">
                  <span>5G</span>
                  <div className="w-3.5 h-2 border border-text-dim rounded-sm p-[1px] flex items-center">
                    <div className="h-full w-2.5 bg-text-dim rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* Mock App Top Header */}
              <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.05] bg-[#080B12]/95 backdrop-blur-md z-40 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#38bdf8] to-blue-600 flex items-center justify-center text-bg font-bold text-xs">
                    M
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text">
                      {activeMockTab === 'home' && 'MAET'}
                      {activeMockTab === 'chart' && 'Chart'}
                      {activeMockTab === 'portfolio' && 'Portfolio'}
                      {activeMockTab === 'ai' && 'AI Advisory'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-bold font-mono text-up">OPEN</span>
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-down/10 text-down border border-down/20 text-[8px] font-mono font-bold">
                    LOCKED
                  </div>
                </div>
              </div>

              {/* Mock Screen Body */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-8 text-left relative bg-[#070A0F]">
                
                {/* 1. HOME SCREEN MOCKUP */}
                {activeMockTab === 'home' && (
                  <div className="space-y-3.5 fade-in">
                    <div className="pt-0.5">
                      <div className="text-sm font-bold text-text">Welcome back, Operator</div>
                      <div className="text-[9px] text-text-dim mt-0.5">Sandbox Research Workspace</div>
                    </div>

                    {/* Safety Status card */}
                    <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-warn">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ENVIRONMENT CONSTRAINTS</span>
                      </div>
                      <p className="text-[9px] text-text-dim leading-normal">
                        Advisory client is locked. Order routing is redirected to local simulated validation kernels.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[7px] font-semibold bg-down/10 text-down border border-down/20 px-1 rounded font-mono">LIVE GATING ACTIVE</span>
                        <span className="text-[7px] font-semibold bg-warn/10 text-warn border border-warn/20 px-1 rounded font-mono">PAPER TRADING</span>
                      </div>
                    </div>

                    {/* Quick navigation lists */}
                    <div className="space-y-1.5">
                      <div className="text-[8px] font-bold uppercase tracking-wider text-text-faint">Active Modules</div>
                      
                      <div className="flex items-center gap-2 p-2 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                        <div className="w-7 h-7 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/25 flex items-center justify-center">
                          <List className="w-3.5 h-3.5 text-[#22D3EE]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-text">Watchlist Panel</div>
                          <div className="text-[8px] text-text-dim truncate">Monitor NSE indices &amp; option tickers</div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-text-faint" />
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                        <div className="w-7 h-7 rounded-lg bg-[#16C784]/10 border border-[#16C784]/25 flex items-center justify-center">
                          <BarChart2 className="w-3.5 h-3.5 text-[#16C784]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-text">Chart &amp; Execution</div>
                          <div className="text-[8px] text-text-dim truncate">Interactive visual stock tracking</div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-text-faint" />
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                        <div className="w-7 h-7 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/25 flex items-center justify-center">
                          <Brain className="w-3.5 h-3.5 text-[#A855F7]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-text">AI Advisory Desk</div>
                          <div className="text-[8px] text-text-dim truncate">Research signals and feedback</div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-text-faint" />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. CHART SCREEN MOCKUP */}
                {activeMockTab === 'chart' && (
                  <div className="space-y-3.5 fade-in">
                    {/* Symbol stats */}
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-[9px] text-text-dim font-bold font-mono">RELIANCE · NSE</div>
                        <div className="text-sm font-extrabold text-white tabular-nums">{reliancePrice.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold font-mono text-up bg-up/10 px-1.5 py-0.5 rounded">
                          +{relianceChange.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Chart illustration */}
                    <div className="h-32 border border-white/[0.06] bg-white/[0.01] rounded-xl relative p-2 flex flex-col justify-between overflow-hidden">
                      <div className="absolute inset-0 chart-grid opacity-10" />
                      <div className="flex justify-between text-[7px] text-text-faint">
                        <span>2,460</span>
                        <span>2,450</span>
                        <span>2,440</span>
                      </div>
                      
                      {/* Interactive dynamic SVG */}
                      <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M 0 65 Q 20 40 45 75 T 85 25 T 100 35" fill="none" stroke="var(--info)" strokeWidth="1.5" />
                        <path d="M 0 65 Q 20 40 45 75 T 85 25 T 100 35 L 100 100 L 0 100 Z" fill="url(#grad2)" opacity="0.06" />
                        <defs>
                          <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--info)" />
                            <stop offset="100%" stopColor="transparent" />
                          </linearGradient>
                        </defs>
                      </svg>

                      <div className="flex justify-between text-[7px] text-text-dim">
                        <span>10:30</span>
                        <span>11:30</span>
                        <span>12:30</span>
                      </div>
                    </div>

                    {/* Mock validation ticket drawer overlay */}
                    <div className="border border-[#16C784]/20 bg-[#16C784]/5 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex justify-between text-[8px] font-bold text-[#16C784] tracking-wider uppercase">
                        <span>DRY-RUN CONFIRMATION</span>
                        <span>PAPER ONLY</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-text">
                        <span>Qty: 50 Shares</span>
                        <span className="font-mono">Est: ₹{ (reliancePrice * 50).toLocaleString('en-IN', { maximumFractionDigits: 2 }) }</span>
                      </div>
                      <div className="h-6 bg-[#16C784] text-bg font-extrabold text-[9px] rounded-lg flex items-center justify-center tracking-wider">
                        VALIDATE SIMULATED TRADE
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. PORTFOLIO SCREEN MOCKUP */}
                {activeMockTab === 'portfolio' && (
                  <div className="space-y-3.5 fade-in">
                    {/* Metrics header */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 border border-white/[0.05] bg-white/[0.01] rounded-xl text-left">
                        <div className="text-[8px] text-text-dim font-medium uppercase">Total Value</div>
                        <div className="text-xs font-bold text-text mt-0.5">₹1,84,500.00</div>
                      </div>
                      <div className="p-2 border border-white/[0.05] bg-white/[0.01] rounded-xl text-left">
                        <div className="text-[8px] text-text-dim font-medium uppercase">Day's P&amp;L</div>
                        <div className="text-xs font-bold text-up mt-0.5">+₹1,450.00</div>
                      </div>
                    </div>

                    {/* Holdings items */}
                    <div className="space-y-2">
                      <div className="text-[8px] font-bold uppercase tracking-wider text-text-faint">Positions (2)</div>
                      
                      <div className="flex items-center justify-between p-2 border border-white/[0.04] bg-white/[0.01] rounded-xl">
                        <div>
                          <div className="text-[9px] font-bold text-text">RELIANCE</div>
                          <div className="text-[8px] text-text-dim mt-0.5">Qty 50 · Avg 2435.45</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-bold text-text">₹{reliancePrice.toFixed(2)}</div>
                          <div className={`text-[8px] font-bold mt-0.5 ${relianceChange >= 0 ? 'text-up' : 'text-down'}`}>
                            {relianceChange >= 0 ? '+' : ''}₹{(relianceChange * 50).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2 border border-white/[0.04] bg-white/[0.01] rounded-xl">
                        <div>
                          <div className="text-[9px] font-bold text-text">TCS</div>
                          <div className="text-[8px] text-text-dim mt-0.5">Qty 30 · Avg 3912.65</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-bold text-text">₹{tcsPrice.toFixed(2)}</div>
                          <div className={`text-[8px] font-bold mt-0.5 ${tcsChange >= 0 ? 'text-up' : 'text-down'}`}>
                            {tcsChange >= 0 ? '+' : ''}₹{(tcsChange * 30).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. AI SCREEN MOCKUP */}
                {activeMockTab === 'ai' && (
                  <div className="space-y-3.5 fade-in">
                    {/* Advisory notice */}
                    <div className="p-2.5 rounded-xl border border-violet/25 bg-violet/5 flex items-start gap-2">
                      <Brain className="w-3.5 h-3.5 text-violet mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[8px] font-bold text-violet uppercase tracking-wider">AI Strategy Engine</div>
                        <p className="text-[7.5px] text-text-dim leading-relaxed mt-0.5 font-medium">
                          Advisory intelligence runs simulation checks every 30 seconds. Confirm execution parameter checks before validating.
                        </p>
                      </div>
                    </div>

                    {/* Chat Bubble simulation */}
                    <div className="space-y-2 text-[9px]">
                      <div className="flex gap-2">
                        <div className="w-4 h-4 rounded-full bg-violet/10 flex items-center justify-center text-violet font-bold text-[7px] shrink-0">AI</div>
                        <div className="bg-[#151D28] text-text p-2 rounded-r-xl rounded-bl-xl border border-white/[0.03] max-w-[85%] font-medium">
                          I recommend reviewing TCS options. Real-time indicators showing minor sell-off volume exhaustion.
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <div className="bg-info/10 text-info p-2 rounded-l-xl rounded-br-xl border border-[#38BDF8]/10 max-w-[85%] font-medium">
                          Analyze option chain for strike 3900 Call?
                        </div>
                        <div className="w-4 h-4 rounded-full bg-info/10 flex items-center justify-center text-info font-bold text-[7px] shrink-0">OP</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mock Bottom Tab Bar */}
              <div className="h-12 bg-[#080B12] border-t border-white/[0.05] flex items-center justify-around z-40 shrink-0 pb-1">
                <button
                  onClick={() => setActiveMockTab('home')}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 ${
                    activeMockTab === 'home' ? 'text-[#38bdf8]' : 'text-text-faint'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-medium leading-none">Home</span>
                </button>

                <button
                  onClick={() => setActiveMockTab('chart')}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 ${
                    activeMockTab === 'chart' ? 'text-[#16c784]' : 'text-text-faint'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-medium leading-none">Chart</span>
                </button>

                <button
                  onClick={() => setActiveMockTab('portfolio')}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 ${
                    activeMockTab === 'portfolio' ? 'text-[#f59e0b]' : 'text-text-faint'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-medium leading-none">Portfolio</span>
                </button>

                <button
                  onClick={() => setActiveMockTab('ai')}
                  className={`flex flex-col items-center justify-center flex-1 gap-0.5 ${
                    activeMockTab === 'ai' ? 'text-[#a855f7]' : 'text-text-faint'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span className="text-[8px] font-medium leading-none">AI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grids */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/[0.04] bg-white/[0.005]">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-12">
          Engineered for Performance, Hardened for Safety
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="premium-card p-6 border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#22d3ee]/10 text-[#22d3ee] flex items-center justify-center mb-5 border border-[#22d3ee]/20 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Real-Time Data Streams</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Consumes real-time streaming WebSocket updates directly from backend brokers and feeds it seamlessly into responsive mobile-styled UI components.
            </p>
          </div>

          <div className="premium-card p-6 border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#a855f7]/10 text-[#a855f7] flex items-center justify-center mb-5 border border-[#a855f7]/20 group-hover:scale-110 transition-transform">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">AI Copilot Advisory</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Direct strategy advice overlay and signals with fully transparent, read-only analytical flows directly linked to Python ML kernels.
            </p>
          </div>

          <div className="premium-card p-6 border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02] transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center mb-5 border border-[#f59e0b]/20 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Observability &amp; Telemetry</h3>
            <p className="text-xs text-text-2 leading-relaxed">
              Detailed logs and live status updates detailing backend performance metrics, system memory, and order verification states.
            </p>
          </div>
        </div>
      </section>

      {/* Safety Gating Policy Callout */}
      <section className="bg-gradient-to-b from-transparent to-[#080c12]/50 border-t border-white/[0.04] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="premium-card p-8 md:p-10 border-down/20 bg-down/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-down/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="w-12 h-12 shrink-0 rounded-full bg-down/10 text-down flex items-center justify-center border border-down/30 shadow-lg shadow-down/5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                  Safety Gating &amp; Hardened Infrastructure Policy
                </h2>
                <p className="text-xs text-text-2 mb-5 leading-relaxed">
                  MAET Terminal operates on a hardened architecture constraint. High-frequency live order mutations are programmatically locked at the backend compiled level (BUILD_LIVE_EXECUTION_ALLOWED = False). All portfolio views and account sync events are executed through a read-only parser to prevent unauthorized mutations.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-dim">
                    <Lock className="w-4 h-4 text-down shrink-0" />
                    <span>Live Order Gating (Active)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-dim">
                    <Eye className="w-4 h-4 text-[#38bdf8] shrink-0" />
                    <span>Read-Only Broker Snapshot</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-dim">
                    <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
                    <span>Analytical Advisory Only</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] bg-[#070A0F] py-8 text-center text-xs font-mono text-text-dim">
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
