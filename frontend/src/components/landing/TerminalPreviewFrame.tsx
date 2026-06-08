export function TerminalPreviewFrame() {
  const candles = [
    { x: 250, y: 210, h: 42, up: true },
    { x: 282, y: 194, h: 58, up: true },
    { x: 314, y: 206, h: 44, up: false },
    { x: 346, y: 176, h: 76, up: true },
    { x: 378, y: 166, h: 62, up: true },
    { x: 410, y: 184, h: 46, up: false },
    { x: 442, y: 148, h: 82, up: true },
    { x: 474, y: 136, h: 70, up: true },
    { x: 506, y: 126, h: 54, up: true },
    { x: 538, y: 142, h: 58, up: false },
    { x: 570, y: 112, h: 78, up: true },
  ]

  return (
    <div className="mt-12 w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-base">
      <svg viewBox="0 0 920 460" role="img" aria-label="MAET terminal preview" className="h-auto w-full">
        <rect width="920" height="460" fill="#0c0d12" />
        <rect y="0" width="920" height="44" fill="#131722" />
        <circle cx="30" cy="22" r="4" fill="#2962ff" />
        <text x="44" y="27" fill="#e0e3eb" fontFamily="JetBrains Mono, monospace" fontSize="14">MAET</text>
        <rect x="96" y="12" width="74" height="20" rx="3" fill="rgba(41,98,255,0.12)" stroke="rgba(41,98,255,0.45)" />
        <text x="108" y="26" fill="#2962ff" fontFamily="JetBrains Mono, monospace" fontSize="10">paper</text>
        <circle cx="796" cy="22" r="4" fill="#26a69a" />
        <text x="808" y="26" fill="#787b86" fontFamily="JetBrains Mono, monospace" fontSize="10">NSE 14:32:11 IST</text>

        <rect x="0" y="44" width="220" height="424" fill="#131722" stroke="#2a2e39" />
        <text x="18" y="78" fill="#787b86" fontFamily="JetBrains Mono, monospace" fontSize="10">WATCHLIST</text>
        {[
          ['RELIANCE', 'Reliance Industries', '₹2,847.50', '+1.24%', '#26a69a'],
          ['SBIN', 'State Bank of India', '₹792.30', '+0.68%', '#26a69a'],
          ['HDFCBANK', 'HDFC Bank', '₹1,641.75', '-0.33%', '#ef5350'],
          ['INFY', 'Infosys', '₹1,538.45', '+2.11%', '#26a69a'],
        ].map((row, index) => {
          const y = 98 + index * 58
          return (
            <g key={row[0]}>
              <rect x="12" y={y} width="196" height="46" fill={index === 0 ? '#1e222d' : '#131722'} stroke="#2a2e39" />
              {index === 0 && <rect x="12" y={y} width="2" height="46" fill="#2962ff" />}
              <text x="24" y={y + 19} fill="#e0e3eb" fontFamily="JetBrains Mono, monospace" fontSize="12">{row[0]}</text>
              <text x="24" y={y + 34} fill="#787b86" fontFamily="DM Sans, sans-serif" fontSize="10">{row[1]}</text>
              <text x="196" y={y + 19} textAnchor="end" fill="#e0e3eb" fontFamily="JetBrains Mono, monospace" fontSize="11">{row[2]}</text>
              <text x="196" y={y + 34} textAnchor="end" fill={row[4]} fontFamily="JetBrains Mono, monospace" fontSize="10">{row[3]}</text>
            </g>
          )
        })}

        <rect x="220" y="44" width="500" height="424" fill="#0c0d12" />
        <rect x="220" y="44" width="500" height="40" fill="#131722" stroke="#2a2e39" />
        <text x="244" y="69" fill="#e0e3eb" fontFamily="JetBrains Mono, monospace" fontSize="12">RELIANCE</text>
        <text x="332" y="69" fill="#26a69a" fontFamily="JetBrains Mono, monospace" fontSize="12">₹2,847.50 +1.24%</text>
        {[140, 198, 256, 314, 372].map((y) => (
          <line key={y} x1="238" x2="700" y1={y} y2={y} stroke="#ffffff08" />
        ))}
        {[280, 360, 440, 520, 600, 680].map((x) => (
          <line key={x} x1={x} x2={x} y1="104" y2="396" stroke="#ffffff08" />
        ))}
        <polyline
          points="248,318 310,300 372,276 434,246 496,220 558,198 622,160 692,142"
          fill="none"
          stroke="#2962ff"
          strokeWidth="1.5"
          opacity="0.75"
        />
        {candles.map((candle) => (
          <g key={candle.x}>
            <line x1={candle.x} x2={candle.x} y1={candle.y - 24} y2={candle.y + candle.h} stroke={candle.up ? '#26a69a' : '#ef5350'} strokeWidth="2" />
            <rect x={candle.x - 7} y={candle.y} width="14" height={candle.h} fill={candle.up ? '#26a69a' : '#ef5350'} />
          </g>
        ))}

        <rect x="720" y="44" width="200" height="424" fill="#131722" stroke="#2a2e39" />
        <text x="740" y="78" fill="#787b86" fontFamily="JetBrains Mono, monospace" fontSize="10">OHLC · RELIANCE</text>
        {[
          ['OPEN', '₹2,811.00', '#26a69a'],
          ['HIGH', '₹2,861.80', '#26a69a'],
          ['LOW', '₹2,796.40', '#ef5350'],
          ['CLOSE', '₹2,847.50', '#26a69a'],
        ].map((item, index) => {
          const x = 740 + (index % 2) * 82
          const y = 98 + Math.floor(index / 2) * 62
          return (
            <g key={item[0]}>
              <rect x={x} y={y} width="72" height="48" fill="#1e222d" stroke="#2a2e39" />
              <text x={x + 8} y={y + 18} fill="#787b86" fontFamily="JetBrains Mono, monospace" fontSize="9">{item[0]}</text>
              <text x={x + 8} y={y + 34} fill={item[2]} fontFamily="JetBrains Mono, monospace" fontSize="10">{item[1]}</text>
            </g>
          )
        })}
        <rect x="740" y="268" width="160" height="92" fill="#1e222d" stroke="#2a2e39" />
        <text x="756" y="292" fill="#787b86" fontFamily="JetBrains Mono, monospace" fontSize="10">PAPER ORDER</text>
        <rect x="756" y="308" width="64" height="24" fill="rgba(38,166,154,0.12)" stroke="rgba(38,166,154,0.45)" />
        <text x="782" y="324" textAnchor="middle" fill="#26a69a" fontFamily="JetBrains Mono, monospace" fontSize="10">BUY</text>
        <rect x="828" y="308" width="64" height="24" fill="rgba(239,83,80,0.12)" stroke="rgba(239,83,80,0.45)" />
        <text x="860" y="324" textAnchor="middle" fill="#ef5350" fontFamily="JetBrains Mono, monospace" fontSize="10">SELL</text>
      </svg>
    </div>
  )
}
