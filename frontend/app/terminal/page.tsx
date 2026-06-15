'use client';

import { useEffect, useState } from 'react';
import {
  BarChart2,
  Bot,
  Briefcase,
  List,
  Settings,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { ChartPanel } from '@/components/panels/ChartPanel';
import { WatchlistPanel } from '@/components/panels/WatchlistPanel';
import { PortfolioPanel } from '@/components/panels/PortfolioPanel';
import { StrategyPanel } from '@/components/panels/StrategyPanel';
import { BacktestPanel } from '@/components/panels/BacktestPanel';
import { AIPanel } from '@/components/panels/AIPanel';

type PanelId = 'chart' | 'watchlist' | 'portfolio' | 'strategy' | 'backtest' | 'ai';

type ConnectionState = 'connected' | 'connecting';

const SIDEBAR_ITEMS: Array<{
  id: PanelId;
  label: string;
  Icon: typeof BarChart2;
}> = [
  { id: 'chart', label: 'Chart', Icon: BarChart2 },
  { id: 'watchlist', label: 'Watchlist', Icon: List },
  { id: 'portfolio', label: 'Portfolio', Icon: Briefcase },
  { id: 'strategy', label: 'Strategy', Icon: Zap },
  { id: 'backtest', label: 'Backtest', Icon: TrendingUp },
  { id: 'ai', label: 'AI', Icon: Bot },
];

function isMarketOpenIST(now: Date): boolean {
  const ist = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  const open = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  return minutes >= open && minutes <= close;
}

function formatISTClock(now: Date): string {
  return now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
  });
}

function StatusBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const marketOpen = now ? isMarketOpenIST(now) : false;
  const clockText = now ? formatISTClock(now) : '--:--:--';

  type DotInfo = { id: string; label: string; state: ConnectionState };

  const dots: DotInfo[] = [
    { id: 'WS', label: 'WebSocket', state: 'connecting' },
    { id: 'API', label: 'API', state: 'connected' },
    { id: 'BRK', label: 'Broker', state: 'connected' },
  ];

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-between border-b border-[rgba(0,212,255,0.08)] bg-[rgba(5,8,18,0.9)] px-4 backdrop-blur"
      role="banner"
    >
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold tracking-wide text-[#00D4FF]">
          MAET
        </span>
        <span className="text-[13px] text-[#5F6B7A]">Terminal</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-full bg-[#F59E0B] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-black">
          Paper Mode
        </span>
        <span
          className="font-mono text-[12px] tabular-nums text-[#E8EAED]"
          aria-label="IST clock"
        >
          {clockText} IST
        </span>
        <span
          className={
            'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ' +
            (marketOpen
              ? 'bg-[rgba(16,185,129,0.12)] text-[#10B981]'
              : 'bg-[rgba(239,68,68,0.12)] text-[#EF4444]')
          }
          aria-label={marketOpen ? 'Market open' : 'Market closed'}
        >
          {marketOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <div className="flex items-center gap-2.5" aria-label="Connection status">
        {dots.map((d) => {
          const color = d.state === 'connected' ? '#10B981' : '#5F6B7A';
          return (
            <div
              key={d.id}
              className="group relative flex items-center gap-1.5"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#5F6B7A]">
                {d.id}
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute top-full right-0 mt-1.5 whitespace-nowrap rounded bg-[#0A1020] px-2 py-1 text-[11px] text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100"
              >
                {d.label}: {d.state}
              </span>
            </div>
          );
        })}
      </div>
    </header>
  );
}

function Sidebar({
  active,
  onSelect,
}: {
  active: PanelId;
  onSelect: (id: PanelId) => void;
}) {
  return (
    <nav
      className="relative flex h-full w-[52px] shrink-0 flex-col border-r border-[rgba(0,212,255,0.08)] bg-[#0A1020]"
      aria-label="Terminal panels"
    >
      <ul className="flex flex-col items-center gap-1 px-2 pt-4">
        {SIDEBAR_ITEMS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="group relative w-full">
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'flex h-9 w-full items-center justify-center rounded-md p-2 transition-colors ' +
                  (isActive
                    ? 'bg-[rgba(0,212,255,0.1)] text-[#00D4FF]'
                    : 'text-[#5F6B7A] hover:text-[#A0A8B8]')
                }
              >
                <Icon size={18} strokeWidth={1.75} />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-[#0A1020] px-2 py-1 text-[11px] text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100"
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <div className="group relative">
          <button
            type="button"
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-md p-2 text-[#5F6B7A] transition-colors hover:text-[#A0A8B8]"
          >
            <Settings size={18} strokeWidth={1.75} />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-[#0A1020] px-2 py-1 text-[11px] text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-100"
          >
            Settings
          </span>
        </div>
      </div>
    </nav>
  );
}

function PanelArea({ active }: { active: PanelId }) {
  if (active === 'chart') {
    return (
      <div className="flex h-full min-h-0 w-full">
        <div className="h-full w-[65%] min-w-0">
          <ChartPanel />
        </div>
        <div className="h-full w-[35%] min-w-0">
          <WatchlistPanel />
        </div>
      </div>
    );
  }

  if (active === 'watchlist') {
    return (
      <div className="h-full w-[420px] max-w-full">
        <WatchlistPanel />
      </div>
    );
  }

  if (active === 'portfolio') return <PortfolioPanel />;
  if (active === 'strategy') return <StrategyPanel />;
  if (active === 'backtest') return <BacktestPanel />;
  if (active === 'ai') return <AIPanel />;

  return null;
}

export default function TerminalPage() {
  const [active, setActive] = useState<PanelId>('chart');

  return (
    <div
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#050812] text-[#E8EAED]"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      <StatusBar />

      <div className="flex h-full min-h-0 w-full pt-9">
        <Sidebar active={active} onSelect={setActive} />
        <main className="min-w-0 flex-1">
          <PanelArea active={active} />
        </main>
      </div>
    </div>
  );
}
