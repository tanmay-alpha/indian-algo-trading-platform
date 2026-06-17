'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';

const API =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'https://maet-backend.onrender.com';

const INTERVALS = ['1m', '5m', '15m', '1h', '1D'] as const;
type Interval = (typeof INTERVALS)[number];

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  symbol: string;
  initialInterval?: Interval;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function toLineData(
  values: (number | null)[],
  times: number[]
): { time: Time; value: number }[] {
  const out: { time: Time; value: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      out.push({ time: times[i] as UTCTimestamp, value: values[i] as number });
    }
  }
  return out;
}

export function InteractiveChart({ symbol, initialInterval = '1D' }: Props) {
  const [interval, setInterval] = useState<Interval>(initialInterval);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema9Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // Init chart once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.offsetWidth,
      height: container.offsetHeight,
      layout: {
        background: { color: '#0B0E14' },
        textColor: '#A0A8B8',
      },
      grid: {
        vertLines: { color: 'rgba(255,214,0,0.04)' },
        horzLines: { color: 'rgba(255,214,0,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: 'rgba(255,214,0,0.12)' },
      timeScale: {
        borderColor: 'rgba(255,214,0,0.12)',
        timeVisible: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderUpColor: '#26A69A',
      borderDownColor: '#EF5350',
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(255,214,0,0.15)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.25 },
    });

    const ema9 = chart.addSeries(LineSeries, {
      color: '#FFD600',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA 9',
    });
    const ema21 = chart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA 21',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema9Ref.current = ema9;
    ema21Ref.current = ema21;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        chart.resize(e.contentRect.width, e.contentRect.height);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema9Ref.current = null;
      ema21Ref.current = null;
    };
  }, []);

  // Fetch candles whenever symbol or interval changes
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `${API}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${interval}&limit=300`
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        // Backend may wrap in {candles: []} or return a flat array.
        const list: Candle[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.candles)
            ? data.candles
            : [];
        if (cancelled) return;
        setCandles(list);
        if (list.length === 0) {
          setError('No data for this symbol/interval');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message ?? 'Failed to load candles');
          setCandles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Push data into the chart
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const ema9 = ema9Ref.current;
    const ema21 = ema21Ref.current;
    if (!candleSeries || !volumeSeries || !ema9 || !ema21) return;

    if (candles.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      ema9.setData([]);
      ema21.setData([]);
      return;
    }

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? 'rgba(38,166,154,0.4)'
            : 'rgba(239,83,80,0.4)',
      }))
    );

    const closes = candles.map((c) => c.close);
    const times = candles.map((c) => c.time);
    ema9.setData(toLineData(ema(closes, 9), times));
    ema21.setData(toLineData(ema(closes, 21), times));

    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <section
      className="border rounded overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderColor: 'var(--border)',
      }}
      aria-label="Price chart"
    >
      {/* Header: symbol + interval pills */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-wider font-mono"
            style={{ color: 'var(--text-2)' }}
          >
            Chart
          </span>
          <span
            className="text-sm font-mono font-semibold"
            style={{ color: 'var(--gold)' }}
          >
            {symbol}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => {
            const active = iv === interval;
            return (
              <button
                key={iv}
                type="button"
                onClick={() => setInterval(iv)}
                className="rounded px-2.5 py-1 text-[12px] font-mono transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--gold)',
                        color: 'var(--bg-0)',
                        fontWeight: 600,
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: 'var(--text-1)',
                        border: '1px solid var(--border)',
                      }
                }
              >
                {iv}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart canvas */}
      <div
        className="relative"
        style={{ height: 480 }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 z-10"
            style={{ backgroundColor: 'rgba(11,14,20,0.6)' }}
          >
            <Loader2
              size={16}
              className="animate-spin"
              style={{ color: 'var(--gold)' }}
            />
            <span
              className="text-sm font-mono"
              style={{ color: 'var(--text-1)' }}
            >
              Loading {interval} candles...
            </span>
          </div>
        )}
        {!loading && candles.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center"
          >
            <span
              className="text-sm font-mono"
              style={{ color: 'var(--text-2)' }}
            >
              {error ?? `No data for ${symbol}`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
