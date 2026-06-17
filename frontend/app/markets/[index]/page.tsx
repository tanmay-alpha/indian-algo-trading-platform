'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

const SLUG_MAP: Record<string, { symbol: string; name: string }> = {
  'nifty-50': { symbol: 'NIFTY', name: 'NIFTY 50' },
  'bank-nifty': { symbol: 'BANKNIFTY', name: 'NIFTY Bank' },
  sensex: { symbol: 'SENSEX', name: 'BSE Sensex' },
};

interface Quote {
  ltp: number;
  change: number;
  changePct: number;
}

interface Constituent {
  symbol: string;
  name: string;
  changePct: number;
}

export default function IndexDetailPage() {
  const params = useParams();
  const slug = params?.index as string;
  const idx = slug ? SLUG_MAP[slug] : undefined;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [constituents, setConstituents] = useState<Constituent[]>([]);

  useEffect(() => {
    if (!idx) return;
    let cancelled = false;
    fetch(`${API}/api/quote/${idx.symbol}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setQuote(d);
      })
      .catch(console.error);
    // Proxy: top 10 gainers as "constituents" — real constituents live
    // in the symbol_universe, but until we have an /api/index/{slug}/constituents
    // endpoint, the gainers table is a useful preview.
    fetch(`${API}/api/market/movers?direction=gainers&limit=10`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setConstituents(d.stocks || []);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [idx?.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!idx) {
    return (
      <main
        className="min-h-screen p-8"
        style={{
          backgroundColor: 'var(--bg-0)',
          color: 'var(--text-1)',
        }}
      >
        <div className="max-w-6xl mx-auto">
          <p>Index not found.</p>
          <Link
            href="/markets"
            className="hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            ← Back to markets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-6 md:p-8"
      style={{ backgroundColor: 'var(--bg-0)', color: 'var(--text-0)' }}
    >
      <div className="max-w-6xl mx-auto">
        <Link
          href="/markets"
          className="text-xs hover:text-[var(--text-0)] mb-4 inline-block"
          style={{ color: 'var(--text-2)' }}
        >
          ← Back to markets
        </Link>
        <div
          className="border rounded p-8 mb-6"
          style={{
            backgroundColor: 'var(--bg-1)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="text-[10px] uppercase tracking-wider mb-2 font-mono"
            style={{ color: 'var(--gold)' }}
          >
            {idx.symbol}
          </div>
          <h1 className="text-4xl font-display font-semibold mb-4">
            {idx.name}
          </h1>
          {quote && typeof quote.ltp === 'number' ? (
            <div className="flex items-baseline gap-4 flex-wrap">
              <div className="text-5xl font-mono font-semibold">
                ₹{quote.ltp.toFixed(2)}
              </div>
              <div
                className="text-xl font-mono"
                style={{
                  color:
                    quote.changePct >= 0 ? 'var(--green)' : 'var(--red)',
                }}
              >
                {quote.change >= 0 ? '+' : ''}
                {quote.change?.toFixed(2)} ({quote.changePct >= 0 ? '+' : ''}
                {quote.changePct?.toFixed(2)}%)
              </div>
            </div>
          ) : (
            <div
              className="text-sm"
              style={{ color: 'var(--text-2)' }}
            >
              Loading quote...
            </div>
          )}
        </div>

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
            Top Movers
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {constituents.length === 0 ? (
              <div
                className="col-span-full text-sm text-center py-8"
                style={{ color: 'var(--text-2)' }}
              >
                Loading top movers...
              </div>
            ) : (
              constituents.map((c) => (
                <Link
                  key={c.symbol}
                  href={`/stocks/${encodeURIComponent(c.symbol)}`}
                  className="block p-3 border rounded transition-colors hover:border-[var(--accent)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-0)' }}
                  >
                    {c.symbol}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="text-sm font-mono mt-1"
                    style={{
                      color:
                        c.changePct >= 0 ? 'var(--green)' : 'var(--red)',
                    }}
                  >
                    {c.changePct >= 0 ? '+' : ''}
                    {c.changePct?.toFixed(2)}%
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}