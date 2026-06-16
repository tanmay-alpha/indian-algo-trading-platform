'use client';
import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

interface Mood {
  score: number;
  label: string;
  advances: number;
  declines: number;
  unchanged: number;
  total: number;
}

/**
 * Fear/Greed dial for the markets hub. Polls /api/market/mood every 30s.
 * SVG arc shows current score (0-100) on a 180° sweep with a gradient
 * stroke going red → amber → green.
 */
export function MarketMoodGauge() {
  const [mood, setMood] = useState<Mood | null>(null);
  const idRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadMood = async () => {
      try {
        const res = await fetch(`${API}/api/market/mood`);
        if (res.ok) {
          const data = await res.json();
          setMood(data.mood);
        }
      } catch (e) {
        console.error('Mood fetch failed:', e);
      }
    };
    loadMood();
    const applyInterval = () => {
      if (idRef.current) clearInterval(idRef.current);
      const delay = document.hidden ? 180000 : 30000;
      idRef.current = setInterval(loadMood, delay);
    };
    applyInterval();
    const onVisibility = () => applyInterval();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (idRef.current) clearInterval(idRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!mood) {
    return (
      <div
        className="border rounded p-6"
        style={{
          backgroundColor: 'var(--bg-1)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="text-[10px] uppercase tracking-wider mb-4 font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Market Mood Index
        </div>
        <div className="text-sm" style={{ color: 'var(--text-2)' }}>
          Loading...
        </div>
      </div>
    );
  }

  // Map score to needle angle: -90° (left) to +90° (right)
  const angle = (mood.score / 100) * 180 - 90;
  const color =
    mood.score < 30
      ? '#EF5350'
      : mood.score < 50
      ? '#FFB300'
      : mood.score < 70
      ? '#26A69A'
      : '#10B981';

  // Arc length is ~125.6 (half of a 40-radius circle)
  const arcLength = 125.6;
  const filled = (arcLength * mood.score) / 100;

  return (
    <div
      className="border rounded p-6"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wider mb-4 font-mono"
        style={{ color: 'var(--text-2)' }}
      >
        Market Mood Index
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div
            className="text-4xl font-display font-semibold"
            style={{ color }}
          >
            {mood.score}
          </div>
          <div
            className="text-sm font-medium mt-1"
            style={{ color }}
          >
            {mood.label}
          </div>
          <div
            className="mt-4 text-xs space-y-1 font-mono"
            style={{ color: 'var(--text-2)' }}
          >
            <div>
              Advances:{' '}
              <span style={{ color: 'var(--green)' }}>{mood.advances}</span>
            </div>
            <div>
              Declines:{' '}
              <span style={{ color: 'var(--red)' }}>{mood.declines}</span>
            </div>
            <div>
              Unchanged:{' '}
              <span style={{ color: 'var(--text-1)' }}>{mood.unchanged}</span>
            </div>
          </div>
        </div>
        <div className="relative w-32 h-20 flex-shrink-0">
          <svg viewBox="0 0 100 60" className="w-full h-full">
            <defs>
              <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#EF5350" />
                <stop offset="0.5" stopColor="#FFB300" />
                <stop offset="1" stopColor="#26A69A" />
              </linearGradient>
            </defs>
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="var(--bg-2)"
              strokeWidth="6"
            />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="6"
              strokeDasharray={arcLength}
              strokeDashoffset={arcLength - filled}
              strokeLinecap="round"
            />
            <line
              x1="50"
              y1="50"
              x2={50 + 30 * Math.cos((angle * Math.PI) / 180)}
              y2={50 + 30 * Math.sin((angle * Math.PI) / 180)}
              stroke="var(--text-0)"
              strokeWidth="2"
            />
            <circle cx="50" cy="50" r="3" fill="var(--text-0)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
