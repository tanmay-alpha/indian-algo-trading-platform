'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Cpu, AlertTriangle, Sparkles, Send, Brain,
  MessageSquareCode, TrendingUp, TrendingDown, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
    <div className="flex flex-col h-full bg-bg">
      {/* Sub tabs header */}
      <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border/60 bg-bg-surface flex items-center justify-between">
        <div className="flex bg-bg-card p-1 rounded-xl border border-border/80">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'chat'
                ? 'bg-info text-bg shadow-sm'
                : 'text-text-dim hover:text-text'
            )}
          >
            Copilot Chat
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'signals'
                ? 'bg-info text-bg shadow-sm'
                : 'text-text-dim hover:text-text'
            )}
          >
            Advisory Signals
          </button>
        </div>

        <span className="text-[10px] font-mono text-warn bg-warn/10 border border-warn/25 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          PASSIVE MODE
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        {activeTab === 'chat' ? (
          <div className="absolute inset-0 flex flex-col">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[85%] rounded-2xl p-3.5 border text-xs',
                    msg.role === 'user'
                      ? 'ml-auto bg-info/10 border-info/20 text-text'
                      : 'mr-auto bg-bg-card border-border/80 text-text-2'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-faint uppercase font-bold mb-1.5">
                    {msg.role === 'user' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-info" />
                        <span>Operator</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5 text-warn animate-pulse" />
                        <span>AI Advisor</span>
                      </>
                    )}
                  </div>
                  <p className="leading-relaxed font-mono whitespace-pre-wrap select-text">{msg.content}</p>
                </div>
              ))}

              {isTyping && (
                <div className="mr-auto bg-bg-card border border-border/80 rounded-2xl p-3.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input box */}
            <div className="p-3 border-t border-border/60 bg-bg-surface flex items-center gap-2 shrink-0 pb-nav">
              <input
                type="text"
                placeholder="Ask about strategy or symbol theory…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 h-11 bg-bg-card border border-border/80 rounded-xl px-4 text-xs text-text placeholder-text-faint focus:outline-none focus:border-info/50"
              />
              <button
                onClick={handleSend}
                className="w-11 h-11 rounded-xl bg-info hover:bg-info/95 flex items-center justify-center text-bg transition-colors active:scale-95 shrink-0"
              >
                <Send className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-4 pb-nav">
            <div className="text-2xs font-mono text-text-faint bg-warn/5 border border-warn/15 p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warn shrink-0" />
              <span>Simulated advisory metrics only. Real order execution is globally locked.</span>
            </div>

            <div className="space-y-3">
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
    </div>
  )
}

function SignalCard({ symbol, signal, confidence, reason }: { symbol: string, signal: 'BUY' | 'SELL' | 'HOLD', confidence: number, reason: string }) {
  return (
    <div className="p-4 rounded-2xl border border-border/60 bg-bg-card relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-warn/5 rounded-full blur-xl pointer-events-none" />
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-warn/10 flex items-center justify-center border border-warn/25 text-warn">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-text block leading-tight">{symbol}</span>
            <span className="text-[10px] text-text-faint font-mono leading-tight">AI Signal core</span>
          </div>
        </div>
        <div className={cn(
          'text-xs font-bold font-mono px-2 py-0.5 rounded',
          signal === 'BUY' ? 'bg-up/10 text-up' : signal === 'SELL' ? 'bg-down/10 text-down' : 'bg-text-dim/10 text-text-2'
        )}>
          {signal}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-2xs font-mono text-text-dim bg-bg/50 p-2 rounded-lg border border-border/40">
          <div className="text-text-faint font-bold uppercase mb-0.5">Insight Details</div>
          <div className="leading-relaxed">{reason}</div>
        </div>

        <div className="flex items-center justify-between text-2xs font-mono text-text-faint pt-1">
          <span>Confidence: <strong className="text-text">{confidence}%</strong></span>
          <span className="flex items-center gap-1 text-warn">
            <AlertTriangle className="w-3 h-3" /> Passive Model
          </span>
        </div>
      </div>
    </div>
  )
}
