'use client'

import { useState } from 'react'
import { Cpu, AlertTriangle, Sparkles, Send, Brain, MessageSquareCode } from 'lucide-react'
import { AIAdvisoryCard } from '@/components/maet/ai-advisory-card'
import { GlassPanel } from '@/components/maet/glass-panel'
import { GlowBorder } from '@/components/maet/glow-border'

export function AiScreen() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: 'Welcome to MAET AI Advisory Core. I can analyze NSE/BSE charts, generate dry-run signal theories, and evaluate option chain dynamics. All outputs are strictly passive advisory suggestions.'
    }
  ])
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = input
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    
    // Auto-respond with advisory template
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `[ADVISORY REPORT FOR ${userMsg.toUpperCase()}]\nCalculated signal theory based on historical chart profiles. Recommended mode is PAPER / DRY-RUN. Real money execution is restricted by hardware security policies. Seek a licensed investment advisor for real executions.`
        }
      ])
    }, 1000)
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto space-y-4">
      <h2 className="text-sm font-bold tracking-tight text-white">AI ADVISORY LAB</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-4">
          {/* DEMO PLACEHOLDER — these advisory cards are static layout examples only, not real signals */}
          <div className="px-2 py-1 rounded border border-warn/20 bg-warn/5 text-[9px] font-mono text-warn tracking-wider uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warn/60 shrink-0" />
            Demo Placeholder — Not real signals
          </div>
          <AIAdvisoryCard 
            symbol="NIFTY 50" 
            signal="BUY" 
            confidence={91.4} 
            reason="Volume weighted average price (VWAP) trend support is holding at 24,180. MACD indicator remains bullish on 15m intervals."
          />
          <AIAdvisoryCard 
            symbol="BANKNIFTY" 
            signal="HOLD" 
            confidence={68.2} 
            reason="Option pain profile shows max resistance clustering around 51,500. Recommend waiting for a volatility breakout."
          />
        </div>

        {/* Chat / Advisory Interface */}
        <div className="md:col-span-2 flex flex-col min-h-[400px]">
          <GlowBorder className="h-full flex flex-col overflow-hidden">
            <GlassPanel className="flex-1 flex flex-col h-full bg-[#05070a]/90 rounded-xl overflow-hidden border-none shadow-none">
              <div className="h-10 px-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                <span className="text-xs font-semibold text-white tracking-wider flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-[#a855f7]" /> AI COPILOT CHAT
                </span>
                <span className="text-[10px] font-mono text-warn bg-warn/10 border border-warn/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> ADVISORY ONLY
                </span>
              </div>

              {/* Message History */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs select-text">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg border max-w-[85%] ${
                      msg.role === 'user'
                        ? 'ml-auto bg-cyan-950/20 border-cyan-500/30 text-cyan-200'
                        : 'mr-auto bg-white/[0.02] border-white/[0.06] text-text-2'
                    }`}
                  >
                    <span className="text-[9px] text-text-faint block uppercase font-bold mb-1">
                      {msg.role === 'user' ? 'Operator' : 'Advisory Bot'}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask about strategy theory (e.g. 'Reliance breakout')..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 h-9 bg-black/40 border border-white/[0.08] rounded-md px-3 text-xs text-white placeholder-text-faint focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={handleSend}
                  className="w-9 h-9 rounded-md bg-[#a855f7] hover:bg-[#a855f7]/80 flex items-center justify-center text-white transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </GlassPanel>
          </GlowBorder>
        </div>
      </div>
    </div>
  )
}
