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
    <div className="w-full overflow-hidden rounded border border-border-light bg-base shadow-[0_0_34px_rgba(240,192,64,0.08)]">
      <svg viewBox="0 0 920 460" role="img" aria-label="MAET terminal preview" className="h-auto w-full">
        <rect width="920" height="460" fill="#0B0D13" />
        <rect y="0" width="920" height="44" fill="#0F1117" />
        <circle cx="30" cy="22" r="4" fill="#F0C040" />
        <text x="44" y="27" fill="#F0C040" fontFamily="JetBrains Mono, monospace" fontSize="14">MAET</text>
        <rect x="96" y="12" width="74" height="20" rx="3" fill="rgba(240,192,64,0.12)" stroke="rgba(240,192,64,0.45)" />
        <text x="108" y="26" fill="#F0C040" fontFamily="JetBrains Mono, monospace" fontSize="10">paper</text>
        <circle cx="796" cy="22" r="4" fill="#4ADE80" />
        <text x="808" y="26" fill="#6B6A65" fontFamily="JetBrains Mono, monospace" fontSize="10">NSE 14:32:11 IST</text>

        <rect x="0" y="44" width="220" height="424" fill="#0F1117" stroke="rgba(255,255,255,0.06)" />
        <text x="18" y="78" fill="#6B6A65" fontFamily="Inter, sans-serif" fontSize="10">WATCHLIST</text>
        {[
          ['RELIANCE', 'Reliance Industries', '₹2,847.50', '+1.24%', '#4ADE80'],
          ['SBIN', 'State Bank of India', '₹792.30', '+0.68%', '#4ADE80'],
          ['HDFCBANK', 'HDFC Bank', '₹1,641.75', '-0.33%', '#F87171'],
          ['INFY', 'Infosys', '₹1,538.45', '+2.11%', '#4ADE80'],
        ].map((row, index) => {
          const y = 98 + index * 58
          return (
            <g key={row[0]}>
              <rect x="12" y={y} width="196" height="46" fill={index === 0 ? '#151822' : '#0F1117'} stroke="rgba(255,255,255,0.06)" />
              {index === 0 && <rect x="12" y={y} width="2" height="46" fill="#F0C040" />}
              <text x="24" y={y + 19} fill="#E8E6DF" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="600">{row[0]}</text>
              <text x="24" y={y + 34} fill="#6B6A65" fontFamily="Inter, sans-serif" fontSize="10">{row[1]}</text>
              <text x="196" y={y + 19} textAnchor="end" fill="#E8E6DF" fontFamily="JetBrains Mono, monospace" fontSize="11">{row[2]}</text>
              <text x="196" y={y + 34} textAnchor="end" fill={row[4]} fontFamily="JetBrains Mono, monospace" fontSize="10">{row[3]}</text>
            </g>
          )
        })}

        <rect x="220" y="44" width="500" height="424" fill="#0B0D13" />
        <rect x="220" y="44" width="500" height="40" fill="#0F1117" stroke="rgba(255,255,255,0.06)" />
        <text x="244" y="69" fill="#E8E6DF" fontFamily="JetBrains Mono, monospace" fontSize="12">RELIANCE</text>
        <text x="332" y="69" fill="#4ADE80" fontFamily="JetBrains Mono, monospace" fontSize="12">₹2,847.50 +1.24%</text>
        {[140, 198, 256, 314, 372].map((y) => (
          <line key={y} x1="238" x2="700" y1={y} y2={y} stroke="#ffffff08" />
        ))}
        {[280, 360, 440, 520, 600, 680].map((x) => (
          <line key={x} x1={x} x2={x} y1="104" y2="396" stroke="#ffffff08" />
        ))}
        <polyline
          points="248,318 310,300 372,276 434,246 496,220 558,198 622,160 692,142"
          fill="none"
          stroke="#F0C040"
          strokeWidth="1.5"
          opacity="0.75"
        />
        {candles.map((candle) => (
          <g key={candle.x}>
            <line x1={candle.x} x2={candle.x} y1={candle.y - 24} y2={candle.y + candle.h} stroke={candle.up ? '#4ADE80' : '#F87171'} strokeWidth="2" />
            <rect x={candle.x - 7} y={candle.y} width="14" height={candle.h} fill={candle.up ? '#4ADE80' : '#F87171'} />
          </g>
        ))}

        <rect x="720" y="44" width="200" height="424" fill="#0F1117" stroke="rgba(255,255,255,0.06)" />
        <text x="740" y="78" fill="#6B6A65" fontFamily="Inter, sans-serif" fontSize="10">OHLC | RELIANCE</text>
        {[
          ['OPEN', '₹2,811.00', '#E8E6DF'],
          ['HIGH', '₹2,861.80', '#4ADE80'],
          ['LOW', '₹2,796.40', '#F87171'],
          ['CLOSE', '₹2,847.50', '#4ADE80'],
        ].map((item, index) => {
          const x = 740 + (index % 2) * 82
          const y = 98 + Math.floor(index / 2) * 62
          return (
            <g key={item[0]}>
              <rect x={x} y={y} width="72" height="48" fill="#151822" stroke="rgba(255,255,255,0.06)" />
              <text x={x + 8} y={y + 18} fill="#6B6A65" fontFamily="Inter, sans-serif" fontSize="9">{item[0]}</text>
              <text x={x + 8} y={y + 34} fill={item[2]} fontFamily="JetBrains Mono, monospace" fontSize="10">{item[1]}</text>
            </g>
          )
        })}
        <rect x="740" y="268" width="160" height="92" fill="#151822" stroke="rgba(255,255,255,0.06)" />
        <text x="756" y="292" fill="#6B6A65" fontFamily="Inter, sans-serif" fontSize="10">PAPER ORDER</text>
        <rect x="756" y="308" width="64" height="24" fill="rgba(74,222,128,0.12)" stroke="rgba(74,222,128,0.45)" />
        <text x="782" y="324" textAnchor="middle" fill="#4ADE80" fontFamily="JetBrains Mono, monospace" fontSize="10">BUY</text>
        <rect x="828" y="308" width="64" height="24" fill="rgba(248,113,113,0.12)" stroke="rgba(248,113,113,0.45)" />
        <text x="860" y="324" textAnchor="middle" fill="#F87171" fontFamily="JetBrains Mono, monospace" fontSize="10">SELL</text>
      </svg>
    </div>
  )
}
