import { useLiveSeries } from "@/hooks/use-live-price";

/**
 * Mini sparkline chart driven by a simulated random-walk series.
 *
 * IMPORTANT: this component is **simulated**, not live, even when a WSClient
 * is connected. The previous name "LiveMiniChart" suggested otherwise and
 * silently swallowed a real feed. The hook only produces a random-walk
 * because no `symbol` is passed (see use-live-price.ts); when a real feed is
 * available, the parent should pass a `symbol` and call `useLivePrice`
 * directly. This component is renamed to keep the mock nature honest.
 */
export function SimulatedMiniChart({ seed = 2945, height = 280 }: { seed?: number; height?: number }) {
  const data = useLiveSeries(seed, 90, { volatility: 0.004, interval: 800 });
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = (max - min) * 0.08 || 1;
  const lo = min - pad, hi = max + pad;
  const W = 100, H = 100;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * W},${((hi - v) / (hi - lo)) * H}`).join(" ");
  const areaPath = `M0,${H} L${points.split(" ").join(" L")} L${W},${H} Z`;
  const last = data[data.length - 1];
  const first = data[0];
  const bull = last >= first;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%" }} className="overflow-visible">
      <defs>
        <linearGradient id="liveFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={bull ? "var(--color-bull)" : "var(--color-bear)"} stopOpacity="0.35" />
          <stop offset="100%" stopColor={bull ? "var(--color-bull)" : "var(--color-bear)"} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1="0" x2="100" y1={(i / 4) * 100} y2={(i / 4) * 100} stroke="var(--color-grid)" strokeWidth="0.1" />
      ))}
      <path d={areaPath} fill="url(#liveFill)" />
      <polyline points={points} fill="none" stroke={bull ? "var(--color-bull)" : "var(--color-bear)"} strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <circle
        cx={W}
        cy={((hi - last) / (hi - lo)) * H}
        r="0.9"
        fill={bull ? "var(--color-bull)" : "var(--color-bear)"}
      >
        <animate attributeName="r" values="0.9;2.2;0.9" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/**
 * Backwards-compatible alias for the previous name. The previous component
 * was always simulated — the rename just makes that explicit. New code should
 * import `SimulatedMiniChart` directly.
 */
export const LiveMiniChart = SimulatedMiniChart;
