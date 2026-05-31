'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Cpu, AlertTriangle, Send, Brain,
  Sparkles, ShieldCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobilePage } from '@/components/mobile/mobile-page'
import { PremiumCard } from '@/components/ui-maet/premium-card'
import { SectionTitle } from '@/components/ui-maet/section-title'
import { EmptyState } from '@/components/ui-maet/empty-state'

export function AiScreen() {
  const [activeTab, setActiveTab] = useState<'chat' | 'signals'>('chat')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'Welcome to MAET AI Advisory Core. I can analyze NSE/BSE charts, generate dry-run signal theories, and evaluate option chain dynamics. All outputs are strictly passive advisory suggestions.'
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = input
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsTyping(true)

    // Auto-respond with advisory template
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `[ADVISORY ANALYSIS FOR "${userMsg.toUpperCase()}"]\nCalculated signal theory based on historical chart profiles.\n\nRecommended mode is PAPER / DRY-RUN. Real money execution is blocked by hardware security policies.\n\nSeek a licensed financial advisor before making any investment decisions.`
        }
      ])
    }, 1200)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <MobilePage className="flex flex-col h-full pb-4 space-y-4">
      {/* Sub tabs header */}
      <div className="shrink-0 flex items-center justify-between bg-white/[0.015] border border-white/[0.04] p-2 rounded-2xl">
        <div className="flex bg-white/[0.02] p-1 rounded-xl border border-white/[0.04] w-2/3">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-150',
              activeTab === 'chat'
                ? 'bg-[#A855F7] text-white shadow-sm'
                : 'text-text-dim hover:text-text'
            )}
          >
            Copilot Chat
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-150',
              activeTab === 'signals'
                ? 'bg-[#A855F7] text-white shadow-sm'
                : 'text-text-dim hover:text-text'
            )}
          >
            Signals
          </button>
        </div>

        <span className="text-[9px] font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase">
          <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
          Passive
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        {activeTab === 'chat' ? (
          <div className="absolute inset-0 flex flex-col">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[88%] rounded-2xl p-3.5 border text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'ml-auto bg-[#A855F7]/10 border-[#A855F7]/20 text-text'
                      : 'mr-auto bg-white/[0.015] border-white/[0.06] text-text-dim'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-faint uppercase font-bold mb-1.5">
                    {msg.role === 'user' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
                        <span>Operator</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5 text-[#A855F7] animate-pulse" />
                        <span>AI Advisor</span>
                      </>
                    )}
                  </div>
                  <p className="font-mono whitespace-pre-wrap select-text leading-normal">{msg.content}</p>
                </div>
              ))}

              {isTyping && (
                <div className="mr-auto bg-white/[0.015] border border-white/[0.06] rounded-2xl p-3.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input box */}
            <div className="pt-3 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Ask about strategy or symbol theory…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 h-11 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 text-xs text-text placeholder-text-faint focus:outline-none focus:border-[#A855F7]/50 transition-colors"
              />
              <button
                onClick={handleSend}
                className="w-11 h-11 rounded-xl bg-[#A855F7] hover:bg-[#A855F7]/90 flex items-center justify-center text-white transition-all active:scale-95 shrink-0 shadow-[0_4px_12px_rgba(168,85,247,0.2)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto space-y-4 pr-1">
            <div className="text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B]/5 border border-[#F59E0B]/15 p-3 rounded-xl flex items-center gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span>Simulated advisory metrics only. Real order execution is globally locked.</span>
            </div>

            <div className="space-y-3.5">
              <SignalCard
                symbol="NIFTY 50"
                signal="BUY"
                confidence={91.4}
                reason="VWAP trend support is holding steady at 24,180. MACD indicator remains bullish on 15m intervals."
              />
              <SignalCard
                symbol="BANKNIFTY"
                signal="HOLD"
                confidence={68.2}
                reason="Option pain profile shows max resistance clustering around 51,500. Recommend waiting for a volatility breakout."
              />
              <SignalCard
                symbol="RELIANCE"
                signal="SELL"
                confidence={84.1}
                reason="Multiple top rejections observed near 2,920 supply zone with contracting buying volumes."
              />
            </div>
          </div>
        )}
      </div>
    </MobilePage>
  )
}

function SignalCard({ symbol, signal, confidence, reason }: { symbol: string, signal: 'BUY' | 'SELL' | 'HOLD', confidence: number, reason: string }) {
  return (
    <PremiumCard glow className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#A855F7]/5 rounded-full blur-xl pointer-events-none" />
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#A855F7]/10 flex items-center justify-center border border-[#A855F7]/25 text-[#A855F7]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-text block leading-tight">{symbol}</span>
            <span className="text-[9px] text-text-faint font-semibold uppercase tracking-wider mt-0.5">AI Signal Core</span>
          </div>
        </div>
        <div className={cn(
          'text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border',
          signal === 'BUY' ? 'bg-[#16C784]/10 border-[#16C784]/20 text-[#16C784]' :
          signal === 'SELL' ? 'bg-[#EA3943]/10 border-[#EA3943]/20 text-[#EA3943]' :
          'bg-white/[0.05] border-white/[0.1] text-text-dim'
        )}>
          {signal}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] font-mono text-text-dim bg-white/[0.01] p-3 rounded-xl border border-white/[0.04] leading-relaxed">
          <div className="text-text-faint font-bold uppercase tracking-wider mb-1">Insight Details</div>
          <div>{reason}</div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-text-faint pt-1">
          <span>Confidence: <strong className="text-text font-bold">{confidence}%</strong></span>
          <span className="flex items-center gap-1.5 text-[#F59E0B] font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" /> PASSIVE MODEL
          </span>
        </div>
      </div>
    </PremiumCard>
  )
}
