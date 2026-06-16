'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';

import { useStockDetail } from '@/hooks/useStockDetail';
import { StockHeader } from '@/components/stocks/StockHeader';
import { StockMetrics } from '@/components/stocks/StockMetrics';
import { InteractiveChart } from '@/components/stocks/InteractiveChart';
import { CompanyOverview } from '@/components/stocks/CompanyOverview';
import { FinancialsTable } from '@/components/stocks/FinancialsTable';
import { AnalystEstimates } from '@/components/stocks/AnalystEstimates';
import { StockNews } from '@/components/stocks/StockNews';
import { PriceTargets } from '@/components/stocks/PriceTargets';
import { PeerTable } from '@/components/stock/PeerTable';
import { AddToWatchlistButton } from '@/components/stock/AddToWatchlistButton';

function normalizeSymbol(raw: string | undefined): string {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[^A-Z0-9&\-]/g, '').slice(0, 20);
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = normalizeSymbol(params?.symbol);

  const {
    quote,
    fundamentals,
    marketStatus,
    quoteLoading,
    fundamentalsLoading,
    error,
  } = useStockDetail(symbol);

  if (!symbol) {
    return (
      <main
        className="min-h-screen p-8"
        style={{
          backgroundColor: 'var(--bg-0)',
          color: 'var(--text-0)',
        }}
      >
        <div className="max-w-6xl mx-auto">
          <p>Symbol missing.</p>
          <Link
            href="/markets"
            className="hover:underline"
            style={{ color: 'var(--gold)' }}
          >
            ← Back to markets
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen p-4 md:p-8"
      style={{ backgroundColor: 'var(--bg-0)', color: 'var(--text-0)' }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top: back link */}
        <div className="flex items-center justify-between">
          <Link
            href="/markets"
            className="inline-flex items-center gap-1.5 text-[12px] font-mono hover:underline"
            style={{ color: 'var(--text-1)' }}
          >
            <ArrowLeft size={12} /> Back to markets
          </Link>
          {error && (
            <div
              className="flex items-center gap-1.5 text-[11px] font-mono"
              style={{ color: 'var(--amber, #FFB300)' }}
            >
              <AlertCircle size={12} /> Quote feed degraded: {error}
            </div>
          )}
        </div>

        {/* Header: name, price, quote grid, market status */}
        <StockHeader
          symbol={symbol}
          quote={quote}
          fundamentals={fundamentals}
          marketStatus={marketStatus}
          loading={quoteLoading}
          error={error}
          rightAction={<AddToWatchlistButton symbol={symbol} />}
        />

        {/* Interactive chart auto-loads for `symbol` */}
        <InteractiveChart symbol={symbol} initialInterval="1D" />

        {/* Key metrics grid */}
        <StockMetrics
          fundamentals={fundamentals}
          loading={fundamentalsLoading}
        />

        {/* Two-column lower section: company + financial ratios */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CompanyOverview fundamentals={fundamentals} />
            <FinancialsTable fundamentals={fundamentals} />
          </div>
          <div className="space-y-6">
            <AnalystEstimates
              symbol={symbol}
              currentPrice={quote?.ltp ?? null}
            />
            <PriceTargets
              symbol={symbol}
              currentPrice={quote?.ltp ?? null}
              high52w={fundamentals?.['52wHigh'] ?? null}
              low52w={fundamentals?.['52wLow'] ?? null}
            />
          </div>
        </div>

        {/* News */}
        <StockNews symbol={symbol} />

        {/* Sector peers */}
        <section
          className="border rounded p-6"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-1)' }}
        >
          <h2
            className="text-[11px] uppercase tracking-wider font-mono font-semibold mb-4"
            style={{ color: 'var(--text-2)' }}
          >
            Sector Peers
          </h2>
          <PeerTable symbol={symbol} limit={8} />
        </section>

        {/* Footer disclaimer */}
        <footer
          className="text-[11px] py-4 text-center font-mono"
          style={{ color: 'var(--text-2)' }}
        >
          Quote data via Angel One · Fundamentals via Yahoo Finance ·{' '}
          <Link
            href="/disclaimer"
            className="hover:underline"
            style={{ color: 'var(--text-1)' }}
          >
            Disclaimer
          </Link>
        </footer>
      </div>
    </main>
  );
}
