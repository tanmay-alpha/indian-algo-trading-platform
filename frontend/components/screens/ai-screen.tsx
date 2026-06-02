'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Brain,
  Cpu,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobilePage } from '@/components/mobile/mobile-page'
import { PremiumCard } from '@/components/ui-maet/premium-card'
import { SectionTitle } from '@/components/ui-maet/section-title'

type Message = { role: 'user' | 'assistant'; content: string }
type ResearchStance = 'WATCH' | 'WAIT' | 'AVOID'

const RESEARCH_NOTES: {
  symbol: string
  stance: ResearchStance
  score: number
  reason: string
}[] = [
  {
    symbol: 'NIFTY 50',
    stance: 'WATCH',
    score: 71.4,
    reason: 'VWAP support and breadth should be reviewed with fresh broker candles before any paper validation.',
  },
  {
    symbol: 'BANKNIFTY',
    stance: 'WAIT',
    score: 62.8,
    reason: 'Option-chain context suggests volatility risk. The advisory model does not authorize entries.',
  },
  {
    symbol: 'RELIANCE',
    stance: 'AVOID',
    score: 58.2,
    reason: 'Recent resistance context is marked for research only. No broker action can be triggered here.',
  },
]

export function AiScreen() {
  const [activeTab, setActiveTab] = useState<'chat' | 'signals'>('chat')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Welcome to MAET AI Advisory Core. I can summarize chart context, explain risk factors, and prepare dry-run research notes. execution_allowed=false and AI cannot place orders.',
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setIsTyping(true)

    window.setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            `[PASSIVE RESEARCH NOTE FOR "${trimmed.toUpperCase()}"]\n` +
            'This is explanatory analysis only, based on available chart and risk context.\n\n' +
            'execution_allowed=false\nlive_execution_enabled=false\nbroker_mutation_allowed=false\n\n' +
            'Use dry-run validation for parameter checks only. Consult a licensed financial advisor before making investment decisions.',
        },
      ])
    }, 900)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <MobilePage className="flex flex-col h-full pb-4 space-y-4">
      <PremiumCard className="p-4 border-[#A855F7]/18 bg-[#A855F7]/[0.035]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#A855F7]/12 border border-[#A855F7]/25 flex items-center justify-center text-[#A855F7] shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-text leading-tight">AI Advisory Only</div>
            <p className="text-xs text-text-dim leading-relaxed mt-1">
              Passive research notes can explain signals and risks. AI cannot submit, route, or authorize orders.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 mt-4 text-[10px] font-mono">
          <SafetyLine icon={<Lock className="w-3.5 h-3.5" />} label="execution_allowed" value="false" />
          <SafetyLine icon={<ShieldCheck className="w-3.5 h-3.5" />} label="live_execution_enabled" value="false" />
          <SafetyLine icon={<AlertTriangle className="w-3.5 h-3.5" />} label="broker_mutation_allowed" value="false" />
        </div>
      </PremiumCard>

      <div className="shrink-0 flex items-center justify-between bg-white/[0.015] border border-white/[0.04] p-2 rounded-2xl">
        <div className="flex bg-white/[0.02] p-1 rounded-xl border border-white/[0.04] flex-1 mr-3">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              'flex-1 min-h-9 rounded-lg text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60',
              activeTab === 'chat'
                ? 'bg-[#A855F7] text-white shadow-sm'
                : 'text-text-dim hover:text-text'
            )}
            type="button"
          >
            Copilot Chat
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={cn(
              'flex-1 min-h-9 rounded-lg text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60',
              activeTab === 'signals'
                ? 'bg-[#A855F7] text-white shadow-sm'
                : 'text-text-dim hover:text-text'
            )}
            type="button"
          >
            Research
          </button>
        </div>

        <span className="text-xs font-mono font-bold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase">
          <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
          Passive
        </span>
      </div>

      <div className="flex-1 min-h-0 relative">
        {activeTab === 'chat' ? (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {messages.map((msg, i) => (
                <div
                  key={`${msg.role}-${i}`}
                  className={cn(
                    'flex flex-col max-w-[90%] rounded-2xl p-3.5 border text-xs leading-relaxed',
                    msg.role === 'user'
                      ? 'ml-auto bg-[#A855F7]/10 border-[#A855F7]/20 text-text'
                      : 'mr-auto bg-white/[0.018] border-white/[0.07] text-text-dim'
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-mono text-text-faint uppercase font-bold mb-1.5">
                    {msg.role === 'user' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
                        <span>Operator</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-[#A855F7]" />
                        <span>Research Advisor</span>
                      </>
                    )}
                  </div>
                  <p className="font-mono whitespace-pre-wrap select-text leading-normal">{msg.content}</p>
                </div>
              ))}

              {isTyping && (
                <div className="mr-auto bg-white/[0.018] border border-white/[0.07] rounded-2xl p-3.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-text-dim rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="pt-3 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Ask for passive risk context..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 h-11 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 text-xs text-text placeholder-text-faint focus:outline-none focus:border-[#A855F7]/50 focus:ring-1 focus:ring-[#A855F7]/30 transition-colors"
              />
              <button
                onClick={handleSend}
                aria-label="Send advisory prompt"
                className="w-11 h-11 rounded-xl bg-[#A855F7] hover:bg-[#A855F7]/90 flex items-center justify-center text-white transition-all active:scale-95 shrink-0 shadow-[0_4px_12px_rgba(168,85,247,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A855F7]/60"
                type="button"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto space-y-4 pr-1">
            <div className="text-xs text-[#F59E0B] bg-[#F59E0B]/5 border border-[#F59E0B]/15 p-3 rounded-xl flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
              <span>Research notes are explanatory only. No note below can become a broker order.</span>
            </div>

            <div>
              <SectionTitle title="Research Watchlist" />
              <div className="space-y-3">
                {RESEARCH_NOTES.map((note) => (
                  <SignalCard key={note.symbol} {...note} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </MobilePage>
  )
}

function SafetyLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2">
      <span className="flex items-center gap-2 text-text-dim min-w-0">
        <span className="text-[#F59E0B] shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[#F59E0B] font-bold">{value}</span>
    </div>
  )
}

function SignalCard({
  symbol,
  stance,
  score,
  reason,
}: {
  symbol: string
  stance: ResearchStance
  score: number
  reason: string
}) {
  const stanceClass = {
    WATCH: 'bg-[#22D3EE]/10 border-[#22D3EE]/20 text-[#22D3EE]',
    WAIT: 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]',
    AVOID: 'bg-white/[0.05] border-white/[0.1] text-text-dim',
  }[stance]

  return (
    <PremiumCard className="relative overflow-hidden p-3.5 border-[#A855F7]/12 bg-white/[0.025]">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/[0.04] gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 flex items-center justify-center border border-[#A855F7]/25 text-[#A855F7] shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text block leading-tight truncate">{symbol}</span>
            <span className="text-xs text-text-faint font-semibold uppercase tracking-wider mt-0.5 block">
              Passive model note
            </span>
          </div>
        </div>
        <div className={cn('text-[10px] font-bold font-mono px-2 py-1 rounded-full border shrink-0', stanceClass)}>
          {stance}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-mono text-text-dim bg-white/[0.01] p-3 rounded-xl border border-white/[0.04] leading-relaxed">
          <div className="text-text-faint font-bold uppercase tracking-wider mb-1">Explanation</div>
          <div>{reason}</div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-text-faint pt-1 gap-3">
          <span>Evidence score: <strong className="text-text font-bold">{score.toFixed(1)}%</strong></span>
          <span className="flex items-center gap-1.5 text-[#F59E0B] font-semibold text-right">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" /> NOT A TRADE SIGNAL
          </span>
        </div>
      </div>
    </PremiumCard>
  )
}
