'use client';

import { Newspaper, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  thumbnail?: string;
}

interface Props {
  symbol: string;
}

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

// Backend doesn't yet expose a news endpoint, so we link to a public Google
// News search for the symbol. The page never errors — empty state is clear.
export function StockNews({ symbol }: Props) {
  const [items, setItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setItems(null);
    fetch(`${API}/api/stocks/${encodeURIComponent(symbol)}/news?limit=10`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        // Backend returns {symbol, articles: [{title, link, source, published, snippet}]}
        // UI expects {items: [{title, publisher, link, publishedAt, thumbnail?}]}
        if (d && Array.isArray(d.articles)) {
          const mapped: NewsItem[] = d.articles.map((a: any) => ({
            title: a.title,
            publisher: a.source || 'Google News',
            link: a.link,
            publishedAt: a.published || '',
          }));
          setItems(mapped);
        } else {
          setItems([]);
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const query = encodeURIComponent(`${symbol} stock NSE`);
  const googleNewsHref = `https://news.google.com/search?q=${query}`;

  return (
    <section
      className="border rounded p-6"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Stock news"
    >
      <div className="flex items-center gap-2 mb-4">
        <Newspaper size={14} style={{ color: 'var(--gold)' }} />
        <h2
          className="text-[11px] uppercase tracking-wider font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          News
        </h2>
        <a
          href={googleNewsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[11px] inline-flex items-center gap-1 hover:underline"
          style={{ color: 'var(--text-1)' }}
        >
          Open in Google News <ExternalLink size={10} />
        </a>
      </div>

      {items === null && (
        <div
          className="text-sm py-6 text-center"
          style={{ color: 'var(--text-2)' }}
        >
          Loading news...
        </div>
      )}

      {items !== null && items.length === 0 && (
        <div
          className="text-sm py-6 text-center"
          style={{ color: 'var(--text-2)' }}
        >
          No news wired yet. View the latest coverage on{' '}
          <a
            href={googleNewsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--gold)' }}
          >
            Google News
          </a>
          .
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex gap-3 py-2 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <a
                  href={it.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline line-clamp-2"
                  style={{ color: 'var(--text-0)' }}
                >
                  {it.title}
                </a>
                <div
                  className="text-[11px] mt-1 font-mono"
                  style={{ color: 'var(--text-2)' }}
                >
                  {it.publisher} ·{' '}
                  {new Date(it.publishedAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
