'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { StatusOrb } from '@/components/effects/status-orb'
import { useTerminalStore } from '@/store/terminal-store'
import { cn } from '@/lib/utils'

type Message = { role: 'user' | 'assistant'; content: string }

const EXAMPLE_PROMPTS = [
  { label: 'Candle setup', prompt: 'Explain this candle setup' },
  { label: 'RELIANCE indicators', prompt: 'Summarize RELIANCE indicators' },
  { label: 'Dry-run risk', prompt: 'Risk-check this dry-run order' },
  { label: 'Live lock reason', prompt: 'Why is live execution locked?' },
]

const EXPLANATION_CARDS = [
  ['Indicator context', 'Explains RSI, MACD, VWAP, and trend structure when candle data exists.'],
  ['Risk framing', 'Can describe dry-run inputs, but cannot authorize execution.'],
  ['Safety boundary', 'Live execution stays locked and broker actions stay disabled.'],
]

export function AiScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const apiStatus = useTerminalStore((s) => s.apiStatus)
  const selectedSymbol = useTerminalStore((s) => s.selectedSymbol)
  const chartTimeframe = useTerminalStore((s) => s.chartTimeframe)
  const strategyStatus = useTerminalStore((s) => s.strategyStatus)
  const manualOrderStatus = useTerminalStore((s) => s.manualOrderStatus)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendPrompt = (prompt = input) => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setInput('')
    setMessages((current) => [...current, { role: 'user', content: trimmed }])
    setIsTyping(true)

    window.setTimeout(() => {
      setIsTyping(false)
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content:
            `Advisory engine is unavailable for "${trimmed}". ` +
            'AI cannot route or approve broker orders, and no trade calls or financial advice are produced here.',
        },
      ])
    }, 520)
  }

  return (
    <MobilePage className="flex h-full min-h-0 flex-col gap-3 pb-4 lg:pb-0">
      <div className="maet-glass-strong shrink-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-maet-text">AI Advisory Desk</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-maet-text-muted">
              Research explanations, indicator context, and risk framing. No trade calls are presented as trading truth.
            </p>
          </div>
          <StatusBadge tone="ai" dot>AI advisory only</StatusBadge>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="maet-glass-strong min-h-0 overflow-hidden border-maet-violet/25">
          <div className="flex h-full min-h-[300px] flex-col lg:min-h-[360px]">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {messages.length === 0 ? (
                <div className="grid min-h-full place-items-start py-3 sm:py-5">
                  <div className="mx-auto w-full min-w-0 max-w-2xl text-center">
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-maet-violet/30 bg-maet-violet/10 text-maet-violet sm:h-12 sm:w-12">
                      <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <h2 className="mt-2 font-heading text-lg font-bold text-maet-text sm:mt-3">Ask for research context</h2>
                    <p className="mt-1 text-sm leading-5 text-maet-text-muted sm:mt-2 sm:leading-6">
                      The advisory desk can frame indicators and paper-risk checks. It cannot route or approve broker orders.
                    </p>
                    <div className="mt-3 flex w-full min-w-0 max-w-full justify-start gap-2 overflow-x-auto pb-1 sm:mt-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0">
                      {EXAMPLE_PROMPTS.map((item) => (
                        <button
                          key={item.prompt}
                          type="button"
                          aria-label={item.prompt}
                          onClick={() => sendPrompt(item.prompt)}
                          className="glass-button w-[calc(50%-0.25rem)] min-w-0 shrink-0 justify-start px-2 py-2 text-left text-xs leading-4 !whitespace-normal sm:w-auto sm:px-3"
                        >
                          <Sparkles className="h-4 w-4 text-maet-violet" />
                          <span className="sm:hidden">{item.label}</span>
                          <span className="hidden sm:inline">{item.prompt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[88%] rounded-xl border px-3 py-2 text-sm leading-6',
                          message.role === 'user'
                            ? 'rounded-tr-sm border-maet-cyan/40 bg-maet-cyan/10 text-maet-text'
                            : 'rounded-tl-sm border-maet-violet/40 bg-maet-violet/10 text-maet-text-soft'
                        )}
                      >
                        {message.role === 'assistant' && (
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-maet-violet">
                            <Sparkles className="h-3.5 w-3.5" />
                            Research advisor
                          </div>
                        )}
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-maet-panel-soft px-3 py-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maet-text-muted" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maet-text-muted [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maet-text-muted [animation-delay:240ms]" />
                    </div>
                  )}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-maet-ink-950/42 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') sendPrompt()
                  }}
                  placeholder="Ask about indicators, candles, risk, or live lock..."
                  className="maet-input"
                />
                <button
                  type="button"
                  onClick={() => sendPrompt()}
                  aria-label="Send advisory prompt"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-maet-violet text-white hover:bg-maet-violet/90"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid min-h-0 gap-3 xl:content-start">
          <ContextCard
            title="Market context"
            rows={[
              ['Advisory', apiStatus === 'ONLINE' ? 'Available' : 'Unavailable'],
              ['Selected', selectedSymbol ?? 'No symbol selected'],
              ['Timeframe', chartTimeframe],
              ['Strategy notes', strategyStatus?.available ? strategyStatus.engine : 'Unavailable'],
            ]}
          />
          <div className="maet-glass p-3">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-maet-amber" />
              <div className="font-heading text-sm font-bold text-maet-text">Risk checklist</div>
            </div>
            <div className="space-y-2">
              <SafetyLine label="LIVE LOCKED" value="Locked" />
              <SafetyLine label="BROKER MUTATION DISABLED" value="Disabled" />
              <SafetyLine label="AI ADVISORY ONLY" value="Research only" />
              <SafetyLine label="AI order routing" value="Cannot approve orders" />
              <SafetyLine label="Broker order creation" value={manualOrderStatus?.creates_broker_order ? 'Unexpected' : 'Disabled'} />
            </div>
          </div>
          <div className="grid gap-2">
            {EXPLANATION_CARDS.map(([title, body]) => (
              <div key={title} className="maet-glass p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-maet-violet" />
                  <div className="font-heading text-sm font-bold text-maet-text">{title}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-maet-text-muted">{body}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </MobilePage>
  )
}

function ContextCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="maet-glass p-3">
      <div className="mb-3 flex items-center gap-2">
        <StatusOrb tone="violet" />
        <div className="font-heading text-sm font-bold text-maet-text">{title}</div>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 text-sm">
            <span className="text-maet-text-muted">{label}</span>
            <span className="truncate font-mono text-maet-text-soft">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SafetyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border border-maet-amber/20 bg-maet-amber/10 px-3 py-2">
      <span className="text-xs font-bold text-maet-amber">{label}</span>
      <span className="font-mono text-xs font-bold text-maet-text">{value}</span>
    </div>
  )
}
