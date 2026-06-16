import { MarketMoodGauge } from '@/components/MarketMoodGauge';
import { MoversTable } from '@/components/MoversTable';
import Link from 'next/link';

const INDICES = [
  {
    sym: 'NIFTY',
    name: 'NIFTY 50',
    slug: 'nifty-50',
    desc: 'Top 50 NSE stocks',
  },
  {
    sym: 'BANKNIFTY',
    name: 'NIFTY Bank',
    slug: 'bank-nifty',
    desc: '12 banking stocks',
  },
  {
    sym: 'SENSEX',
    name: 'BSE Sensex',
    slug: 'sensex',
    desc: 'Top 30 BSE stocks',
  },
];

export default function MarketsPage() {
  return (
    <main
      className="min-h-screen p-6 md:p-8"
      style={{ backgroundColor: 'var(--bg-0)', color: 'var(--text-0)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div
            className="text-[11px] uppercase tracking-wider mb-2 font-mono"
            style={{ color: 'var(--gold)' }}
          >
            Markets · Live
          </div>
          <h1 className="text-3xl font-display font-semibold mb-2">
            Market Hub
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--text-1)' }}
          >
            Real-time breadth, top movers, and index drilldown.
          </p>
        </div>

        {/* Top: Mood + 3 index cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <MarketMoodGauge />
          {INDICES.map((idx) => (
            <Link
              key={idx.sym}
              href={`/markets/${idx.slug}`}
              className="block border rounded p-6 transition-colors hover:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-1)',
                borderColor: 'var(--border)',
              }}
            >
              <div
                className="text-[10px] uppercase tracking-wider font-mono"
                style={{ color: 'var(--text-2)' }}
              >
                {idx.sym}
              </div>
              <div className="text-lg font-display font-semibold mt-2">
                {idx.name}
              </div>
              <div
                className="text-xs mt-1"
                style={{ color: 'var(--text-2)' }}
              >
                {idx.desc}
              </div>
              <div
                className="text-xs mt-4"
                style={{ color: 'var(--accent)' }}
              >
                View detail →
              </div>
            </Link>
          ))}
        </div>

        {/* Movers table */}
        <MoversTable />
      </div>
    </main>
  );
}
