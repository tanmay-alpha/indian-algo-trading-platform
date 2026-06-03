'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import { MobilePage } from '@/components/mobile/mobile-page'
import { StatusBadge } from '@/components/ui-maet/status-badge'
import { cn } from '@/lib/utils'

type Message = { role: 'user' | 'assistant'; content: string }

const EXAMPLE_PROMPTS = [
  'Summarize RELIANCE technical indicators',
  'What is the current NIFTY 50 market session state?',
  'Explain the current strategy signals for BANKNIFTY',
]

export function AiScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

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
            `AI advisory backend not connected yet for "${trimmed}". ` +
            'execution_allowed=false. This interface cannot route, authorize, or place broker orders.',
        },
      ])
    }, 750)
  }

  return (
    <MobilePage className="flex h-full flex-col pb-4">
      <div className="reflection-card mb-3 flex shrink-0 items-center justify-between gap-3 p-4 shadow-[0_18px_60px_rgba(139,92,246,0.10)]">
        <div>
          <h1 className="font-heading text-xl font-bold text-maet-text">AI Advisory</h1>
          <p className="mt-1 text-xs leading-5 text-maet-text-secondary">Ask for market context, indicator explanations, and risk framing.</p>
        </div>
        <StatusBadge tone="ai">Backend not connected - advisory only</StatusBadge>
      </div>

      <div className="reflection-card min-h-0 flex-1 overflow-hidden border-maet-violet/25 bg-maet-bg-deep/58">
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="grid min-h-full place-items-center py-8">
                <div className="w-full max-w-md text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-maet-violet/30 bg-maet-violet/12 text-maet-violet">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 font-heading text-lg font-bold text-maet-text">Start with a research question</h2>
                  <p className="mt-2 text-sm leading-6 text-maet-text-secondary">
                    AI advisory backend not connected yet. execution_allowed=false. This interface cannot route, authorize, or place broker orders.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendPrompt(prompt)}
                        className="glass-button px-3 py-2 text-xs"
                      >
                        {prompt}
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
                        'max-w-[86%] rounded-xl border px-3 py-2 text-sm leading-6',
                        message.role === 'user'
                          ? 'rounded-tr-sm border-maet-border-strong bg-maet-glass-2 text-maet-text'
                          : 'rounded-tl-sm border-maet-violet/35 border-l-maet-violet bg-maet-violet/10 text-maet-text-secondary'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="mb-1 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-maet-violet">
                          <Sparkles className="h-3.5 w-3.5" />
                          Research advisor
                        </div>
                      )}
                      {message.content}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="inline-flex items-center gap-1 rounded-xl border border-maet-border bg-maet-surface px-3 py-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maet-text-muted" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maet-text-muted [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maet-text-muted [animation-delay:240ms]" />
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-maet-glass-border bg-maet-bg-deep/42 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendPrompt()
                }}
                placeholder="Ask about market context, indicators, or risk..."
                className="maet-input"
              />
              <button
                type="button"
                onClick={() => sendPrompt()}
                aria-label="Send advisory prompt"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-maet-violet text-white hover:bg-maet-violet/90"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </MobilePage>
  )
}
