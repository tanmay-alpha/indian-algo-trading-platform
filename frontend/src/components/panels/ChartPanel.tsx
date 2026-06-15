'use client';

import {
  useCallback,
  useEffect,
  useMemo,
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
import { Search, X } from 'lucide-react';
import { getOHLCV, searchSymbol } from '@/services/angelone';
import { useTerminalStore } from '@/hooks/useTerminalStore';
import type { OHLCV, SearchResult } from '@/types/market';

type Interval = '1m' | '5m' | '15m' | '1h' | '1D';
const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '1D'];
const INDICATORS = ['EMA', 'VWAP', 'RSI', 'MACD', 'BB'] as const;
type Indicator = (typeof INDICATORS)[number];

const SEARCH_DEBOUNCE_MS = 300;
const TOP_BAR_HEIGHT = 44;

type Props = { className?: string };

// ---------- Indicator math ----------

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

function vwapSeries(data: OHLCV[]): { time: Time; value: number }[] {
  let cumPV = 0;
  let cumVol = 0;
  const out: { time: Time; value: number }[] = [];
  for (const c of data) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
    if (cumVol > 0) {
      out.push({ time: c.time as UTCTimestamp, value: cumPV / cumVol });
    }
  }
  return out;
}

function bollinger(
  values: number[],
  period = 20,
  stdMult = 2
): { time: Time; value: number }[][] {
  const upper: { time: Time; value: number }[] = [];
  const mid: { time: Time; value: number }[] = [];
  const lower: { time: Time; value: number }[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean;
      sq += d * d;
    }
    const std = Math.sqrt(sq / period);
    const t = i;
    const mk = (val: number) => ({ time: t as UTCTimestamp, value: val });
    upper.push(mk(mean + stdMult * std));
    mid.push(mk(mean));
    lower.push(mk(mean - stdMult * std));
  }
  return [upper, mid, lower];
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
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

function toRsiBars(
  values: (number | null)[],
  times: number[]
): { time: Time; value: number; color: string }[] {
  const out: { time: Time; value: number; color: string }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    out.push({
      time: times[i] as UTCTimestamp,
      value: v,
      color: v >= 50 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
    });
  }
  return out;
}

function formatLtp(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

// ---------- Component ----------

export function ChartPanel({ className }: Props) {
  const [symbol, setSymbol] = useState('');
  const [interval, setIntervalState] = useState<Interval>('1D');
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(
    () => new Set()
  );
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ltp, setLtp] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const setCurrentSymbol = useTerminalStore((s) => s.setCurrentSymbol);

  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<never>[]>>(
    new Map()
  );
  const rsiSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Symbol search debounce
  useEffect(() => {
    if (!showSearch) return;
    const q = searchQuery.trim();
    if (q.length === 0) {
      setSearchResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await searchSymbol(q);
        setSearchResults(res.results ?? []);
      } catch {
        setSearchResults([]);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchQuery, showSearch]);

  // Escape closes the modal
  useEffect(() => {
    if (!showSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSearch]);

  // Refetch OHLCV when symbol or interval changes
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOHLCV(symbol, interval)
      .then((data) => {
        if (cancelled) return;
        const safe = Array.isArray(data) ? data : [];
        setOhlcvData(safe);
        setLtp(safe.length > 0 ? safe[safe.length - 1].close : null);
        setChangePct(null);
        if (safe.length === 0) {
          setError('No data for this symbol/interval');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load candles');
        setOhlcvData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Initialise main chart on mount; observe resize.
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.offsetWidth,
      height: container.offsetHeight,
      layout: {
        background: { color: '#0A1020' },
        textColor: '#5F6B7A',
      },
      grid: {
        vertLines: { color: 'rgba(0,212,255,0.04)' },
        horzLines: { color: 'rgba(0,212,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: 'rgba(0,212,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(0,212,255,0.1)',
        timeVisible: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(0,212,255,0.15)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    // Reserve the bottom 20% of the price pane for the volume histogram.
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    // The candle series owns the right price scale; tighten the top
    // margin so candles don't overlap the volume area.
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.05, bottom: 0.25 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      indicatorSeriesRef.current.forEach((arr) => {
        arr.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch {
            // ignore
          }
        });
      });
      indicatorSeriesRef.current.clear();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Push OHLCV data to the main chart
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!candleSeries || !volumeSeries) return;
    if (ohlcvData.length === 0) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      return;
    }
    candleSeries.setData(
      ohlcvData.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volumeSeries.setData(
      ohlcvData.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open
            ? 'rgba(16,185,129,0.4)'
            : 'rgba(239,68,68,0.4)',
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [ohlcvData]);

  // Manage indicator overlays on the main chart + a separate RSI pane
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const closes = ohlcvData.map((c) => c.close);
    const times = ohlcvData.map((c) => c.time);
    const active = activeIndicators;

    const cleanup = (key: string) => {
      const existing = indicatorSeriesRef.current.get(key);
      if (!existing) return;
      existing.forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {
          // ignore
        }
      });
      indicatorSeriesRef.current.delete(key);
    };

    // EMA
    if (active.has('EMA') && ohlcvData.length > 0) {
      cleanup('EMA');
      const e9 = chart.addSeries(LineSeries, {
        color: '#00D4FF',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'EMA 9',
      });
      const e21 = chart.addSeries(LineSeries, {
        color: 'rgba(0,212,255,0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'EMA 21',
      });
      e9.setData(toLineData(ema(closes, 9), times));
      e21.setData(toLineData(ema(closes, 21), times));
      indicatorSeriesRef.current.set('EMA', [e9 as ISeriesApi<never>, e21 as ISeriesApi<never>]);
    } else {
      cleanup('EMA');
    }

    // VWAP
    if (active.has('VWAP') && ohlcvData.length > 0) {
      cleanup('VWAP');
      const v = chart.addSeries(LineSeries, {
        color: '#F59E0B',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'VWAP',
      });
      v.setData(vwapSeries(ohlcvData));
      indicatorSeriesRef.current.set('VWAP', [v as ISeriesApi<never>]);
    } else {
      cleanup('VWAP');
    }

    // Bollinger Bands
    if (active.has('BB') && ohlcvData.length >= 20) {
      cleanup('BB');
      const [upper, mid, lower] = bollinger(closes, 20, 2);
      const u = chart.addSeries(LineSeries, {
        color: 'rgba(239,68,68,0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'BB Upper',
      });
      const m = chart.addSeries(LineSeries, {
        color: 'rgba(255,255,255,0.3)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'BB Mid',
      });
      const l = chart.addSeries(LineSeries, {
        color: 'rgba(239,68,68,0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'BB Lower',
      });
      u.setData(upper);
      m.setData(mid);
      l.setData(lower);
      indicatorSeriesRef.current.set('BB', [
        u as ISeriesApi<never>,
        m as ISeriesApi<never>,
        l as ISeriesApi<never>,
      ]);
    } else {
      cleanup('BB');
    }

    // MACD: simple two-line approximation (MACD line + signal)
    if (active.has('MACD') && ohlcvData.length > 0) {
      cleanup('MACD');
      const e12 = ema(closes, 12);
      const e26 = ema(closes, 26);
      const macd: (number | null)[] = closes.map((_, i) => {
        const a = e12[i];
        const b = e26[i];
        return a !== null && b !== null ? a - b : null;
      });
      const macdValues = macd.map((v) => v ?? 0);
      const signal = ema(macdValues, 9);
      const macdLine = chart.addSeries(LineSeries, {
        color: '#00D4FF',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'MACD',
      });
      const signalLine = chart.addSeries(LineSeries, {
        color: '#F59E0B',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'Signal',
      });
      macdLine.setData(toLineData(macd, times));
      signalLine.setData(toLineData(signal, times));
      indicatorSeriesRef.current.set('MACD', [
        macdLine as ISeriesApi<never>,
        signalLine as ISeriesApi<never>,
      ]);
    } else {
      cleanup('MACD');
    }

    // RSI — separate pane chart
    if (active.has('RSI') && ohlcvData.length > 14) {
      // Lazy-init RSI chart
      if (!rsiChartRef.current && rsiContainerRef.current) {
        const rsiChart = createChart(rsiContainerRef.current, {
          width: rsiContainerRef.current.offsetWidth,
          height: rsiContainerRef.current.offsetHeight,
          layout: { background: { color: '#0A1020' }, textColor: '#5F6B7A' },
          grid: {
            vertLines: { color: 'rgba(0,212,255,0.04)' },
            horzLines: { color: 'rgba(0,212,255,0.04)' },
          },
          crosshair: { mode: CrosshairMode.Magnet },
          rightPriceScale: { borderColor: 'rgba(0,212,255,0.1)' },
          timeScale: {
            borderColor: 'rgba(0,212,255,0.1)',
            timeVisible: true,
          },
        });
        rsiChartRef.current = rsiChart;
        const rsi = rsiChart.addSeries(HistogramSeries, {
          color: 'rgba(0,212,255,0.5)',
          priceScaleId: 'rsi',
        });
        rsi.priceScale().applyOptions({
          scaleMargins: { top: 0.1, bottom: 0.1 },
        });
        rsiSeriesRef.current = rsi;

        const ro = new ResizeObserver((entries) => {
          for (const e of entries) {
            rsiChart.resize(e.contentRect.width, e.contentRect.height);
          }
        });
        ro.observe(rsiContainerRef.current);
        (rsiChart as IChartApi & { _ro?: ResizeObserver })._ro = ro;
      }
      if (rsiSeriesRef.current) {
        rsiSeriesRef.current.setData(toRsiBars(rsi(closes, 14), times));
        rsiChartRef.current?.timeScale().fitContent();
      }
    } else {
      // Tear down RSI chart when off
      if (rsiChartRef.current) {
        const ro = (rsiChartRef.current as IChartApi & { _ro?: ResizeObserver })
          ._ro;
        if (ro) ro.disconnect();
        if (rsiSeriesRef.current) {
          try {
            rsiChartRef.current.removeSeries(rsiSeriesRef.current);
          } catch {
            // ignore
          }
          rsiSeriesRef.current = null;
        }
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
    }
  }, [activeIndicators, ohlcvData]);

  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const pickSymbol = useCallback(
    (s: string) => {
      setSymbol(s);
      setCurrentSymbol(s);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    },
    [setCurrentSymbol]
  );

  const change = useMemo(() => {
    if (ohlcvData.length < 2) return null;
    const first = ohlcvData[0].close;
    const last = ohlcvData[ohlcvData.length - 1].close;
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  }, [ohlcvData]);

  const ltpDisplay = ltp !== null ? ltp : changePct !== null && ohlcvData.length > 0
    ? ohlcvData[ohlcvData.length - 1].close
    : null;
  const pctDisplay = changePct !== null ? changePct : change;

  return (
    <section
      className={
        'relative flex h-full min-h-0 w-full flex-col bg-[#0A1020] ' +
        (className ?? '')
      }
      aria-label="Chart"
    >
      {/* TOP BAR */}
      <header
        className="flex h-11 shrink-0 items-center justify-between border-b px-4"
        style={{ borderBottomColor: 'rgba(0,212,255,0.08)' }}
      >
        {/* LEFT — symbol picker */}
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="rounded-md border bg-transparent px-3 py-1.5 text-sm text-white"
          style={{
            borderColor: 'rgba(0,212,255,0.2)',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontWeight: 500,
          }}
        >
          {symbol ? `${symbol} · NSE ▼` : 'Select symbol ▼'}
        </button>

        {/* CENTER — interval pills */}
        <div className="flex items-center gap-1.5">
          {INTERVALS.map((iv) => {
            const active = iv === interval;
            return (
              <button
                key={iv}
                type="button"
                onClick={() => setIntervalState(iv)}
                className={
                  'rounded px-2.5 py-1 text-[12px] ' +
                  (active
                    ? 'bg-[#00D4FF] text-[#050812]'
                    : 'border bg-transparent text-[#5F6B7A]')
                }
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontWeight: 500,
                  borderColor: active ? 'transparent' : 'rgba(255,255,255,0.1)',
                }}
              >
                {iv}
              </button>
            );
          })}
        </div>

        {/* RIGHT — indicators + LTP */}
        <div className="flex items-center gap-2">
          {INDICATORS.map((ind) => {
            const active = activeIndicators.has(ind);
            return (
              <button
                key={ind}
                type="button"
                onClick={() => toggleIndicator(ind)}
                className="rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  borderColor: active ? '#00D4FF' : 'rgba(255,255,255,0.1)',
                  color: active ? '#00D4FF' : '#5F6B7A',
                  background: 'transparent',
                }}
              >
                {ind}
              </button>
            );
          })}

          <div
            className="ml-3 flex items-baseline gap-2 border-l pl-3"
            style={{ borderColor: 'rgba(0,212,255,0.08)' }}
          >
            <span
              className="text-[18px] text-white"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatLtp(ltpDisplay)}
            </span>
            <span
              className="text-[13px]"
              style={{
                color:
                  pctDisplay !== null && pctDisplay >= 0
                    ? '#10B981'
                    : '#EF4444',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {formatPct(pctDisplay)}
            </span>
          </div>
        </div>
      </header>

      {/* CHART AREA + RSI PANE */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={chartContainerRef}
          className="relative min-h-0 flex-1"
          style={{ height: activeIndicators.has('RSI') ? '70%' : '100%' }}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2">
              <div
                className="h-[60px] w-2 rounded"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  animation: 'chartPulse 1.5s ease-in-out infinite',
                }}
              />
              <div
                className="h-[40px] w-2 rounded"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  animation: 'chartPulse 1.5s ease-in-out 0.2s infinite',
                }}
              />
              <div
                className="h-[50px] w-2 rounded"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  animation: 'chartPulse 1.5s ease-in-out 0.4s infinite',
                }}
              />
            </div>
          )}
          {!loading && ohlcvData.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-[#5F6B7A]">
                {symbol
                  ? error ?? 'No data for this symbol/interval'
                  : 'Select a symbol to load chart'}
              </p>
            </div>
          )}
        </div>
        {activeIndicators.has('RSI') && (
          <div
            className="border-t"
            style={{
              borderColor: 'rgba(0,212,255,0.08)',
              height: '30%',
            }}
          >
            <div ref={rsiContainerRef} className="h-full w-full" />
          </div>
        )}
      </div>

      <ChartPulseStyles />

      {/* SEARCH MODAL */}
      {showSearch && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20"
          style={{ background: 'rgba(5,8,18,0.9)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSearch();
          }}
        >
          <div
            className="w-[480px] max-w-[90vw] overflow-hidden rounded-xl border"
            style={{
              background: '#0F1929',
              borderColor: 'rgba(0,212,255,0.2)',
            }}
          >
            <div
              className="flex items-center gap-2 border-b px-4 py-3"
              style={{ borderColor: 'rgba(0,212,255,0.2)' }}
            >
              <Search size={16} className="text-[#5F6B7A]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search NSE/BSE symbol..."
                className="flex-1 bg-transparent text-base text-white placeholder:text-[#5F6B7A] focus:outline-none"
              />
              <button
                type="button"
                onClick={closeSearch}
                className="rounded p-1 text-[#5F6B7A] hover:bg-white/[0.04] hover:text-white"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto">
              {searchResults.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-[#5F6B7A]">
                  {searchQuery.trim().length === 0
                    ? 'Type to search'
                    : 'No matches'}
                </li>
              ) : (
                searchResults.map((r) => (
                  <li
                    key={`${r.exchange}:${r.symbol}`}
                    onClick={() => pickSymbol(r.symbol)}
                    className="flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-white/[0.04]"
                  >
                    <div>
                      <div className="text-[14px] font-semibold text-[#00D4FF]">
                        {r.symbol}
                      </div>
                      <div className="text-[12px] text-[#5F6B7A]">{r.name}</div>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#5F6B7A]">
                      {r.exchange}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function ChartPulseStyles() {
  return (
    <style jsx global>{`
      @keyframes chartPulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.7; }
      }
    `}</style>
  );
}
