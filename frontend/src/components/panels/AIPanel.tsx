'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Send } from 'lucide-react';
import { sendAIChat } from '@/services/angelone';
import { useTerminalStore } from '@/hooks/useTerminalStore';

type Props = { className?: string };

type Role = 'user' | 'ai';

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  error?: boolean;
};

type PendingStatus = 'sending' | 'error' | null;

const SUGGESTIONS = [
  'Explain RELIANCE candle pattern',
  'RSI divergence on NIFTY?',
  'What is VWAP pullback?',
];

const STORAGE_KEY = 'maet.ai.history.v1';

function loadHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        m &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'ai') &&
        typeof m.text === 'string'
    );
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore quota / private-mode errors
  }
}

function isMarketOpenIST(now: Date): boolean {
  const ist = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

function makeId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function AIPanel({ className }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingStatus>(null);
  const [hydrated, setHydrated] = useState(false);
  const currentSymbol = useTerminalStore((s) => s.currentSymbol);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  // Persist on every change
  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
  }, [messages, hydrated]);

  // Auto-scroll to bottom on new content
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const send = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (!text || pending === 'sending') return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setPending('sending');

      const marketStatus = isMarketOpenIST(new Date()) ? 'OPEN' : 'CLOSED';
      try {
        const res = await sendAIChat(text, {
          symbol: currentSymbol,
          marketStatus,
        });
        const reply = res?.response?.trim() || 'No response from assistant.';
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'ai', text: reply },
        ]);
        setPending(null);
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : 'Failed to fetch response';
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: 'ai',
            text: `${reason} · Try again`,
            error: true,
          },
        ]);
        setPending('error');
      }
    },
    [input, pending, currentSymbol]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send]
  );

  const showSuggestions = hydrated && messages.length === 0 && !pending;
  const disabled = pending === 'sending' || input.trim().length === 0;

  return (
    <section
      className={
        'flex h-full min-h-0 w-full flex-col bg-[#050812] ' + (className ?? '')
      }
      aria-label="AI assistant"
    >
      {/* TOP BAR */}
      <header
        className="flex h-11 shrink-0 items-center justify-between border-b px-4"
        style={{
          background: '#0A1020',
          borderBottomColor: 'rgba(0,212,255,0.08)',
        }}
      >
        <span
          className="font-mono text-[12px] font-medium uppercase tracking-wider text-[#00D4FF]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          AI MARKET NOTES
        </span>
        <span
          className="text-[11px] text-[#5F6B7A]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Explains · Does not trade
        </span>
      </header>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4"
      >
        {showSuggestions ? (
          <div className="flex flex-wrap gap-2 py-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border px-3 py-1.5 text-[12px] transition-colors hover:bg-white/[0.04]"
                style={{
                  background: 'rgba(0,212,255,0.06)',
                  borderColor: 'rgba(0,212,255,0.2)',
                  color: '#00D4FF',
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AIBubble key={m.id} text={m.text} error={m.error} />
          )
        )}

        {pending === 'sending' ? <TypingIndicator /> : null}
      </div>

      {/* INPUT */}
      <div
        className="flex shrink-0 items-end gap-2.5 border-t p-3 px-4"
        style={{
          height: 64,
          background: '#0A1020',
          borderTopColor: 'rgba(0,212,255,0.08)',
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about chart patterns, indicators, risk..."
          rows={1}
          disabled={pending === 'sending'}
          className="flex-1 resize-none rounded-lg border px-3.5 py-2.5 text-[13px] leading-snug text-white outline-none transition-colors disabled:opacity-50"
          style={{
            background: '#0F1929',
            borderColor: 'rgba(0,212,255,0.15)',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            maxHeight: 120,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#00D4FF';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)';
          }}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={disabled}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: '#00D4FF', color: '#050812' }}
        >
          <Send size={16} strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[75%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm border px-3.5 py-2.5 text-[13px] text-white"
        style={{
          background: 'rgba(0,212,255,0.08)',
          borderColor: 'rgba(0,212,255,0.15)',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AIBubble({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-bl-sm border px-3.5 py-2.5 text-[13px]"
        style={{
          background: '#0F1929',
          borderColor: error
            ? 'rgba(239,68,68,0.4)'
            : 'rgba(255,255,255,0.06)',
          color: error ? '#EF4444' : '#E8EAED',
          lineHeight: 1.65,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-xl rounded-bl-sm border px-3.5 py-3"
        style={{
          background: '#0F1929',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
        aria-label="Assistant is typing"
      >
        <Dot delay="0s" />
        <Dot delay="0.18s" />
        <Dot delay="0.36s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{
        background: '#5F6B7A',
        animation: `aiDotPulse 1.1s ease-in-out ${delay} infinite`,
      }}
    />
  );
}
