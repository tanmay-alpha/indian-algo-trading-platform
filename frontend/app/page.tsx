"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  Radio,
  Database,
  ShieldCheck,
  Cpu,
  Bell,
  Lock,
} from "lucide-react";
import { LiveTicker } from "@/components/LiveTicker";

/* ----------------------------- DATA ----------------------------- */

const TICKER: { sym: string; price: string; pct: number; clickable: boolean }[] = [
  { sym: "NIFTY", price: "23,847", pct: 0.29, clickable: false },
  { sym: "BANKNIFTY", price: "51,432", pct: 1.12, clickable: false },
  { sym: "RELIANCE", price: "2,914", pct: 1.24, clickable: true },
  { sym: "TCS", price: "3,824", pct: -0.43, clickable: true },
  { sym: "INFY", price: "1,567", pct: 2.11, clickable: true },
  { sym: "HDFCBANK", price: "1,623", pct: -0.33, clickable: true },
  { sym: "ICICIBANK", price: "1,108", pct: 0.85, clickable: true },
  { sym: "SBIN", price: "824", pct: 0.68, clickable: true },
  { sym: "BHARTIARTL", price: "1,212", pct: 1.45, clickable: true },
  { sym: "ITC", price: "467", pct: 0.22, clickable: true },
  { sym: "LT", price: "3,612", pct: 0.91, clickable: true },
  { sym: "HINDUNILVR", price: "2,478", pct: -0.41, clickable: true },
  { sym: "AXISBANK", price: "1,156", pct: 0.55, clickable: true },
  { sym: "KOTAKBANK", price: "1,789", pct: 0.73, clickable: true },
  { sym: "ASIANPAINT", price: "2,941", pct: -0.18, clickable: true },
  { sym: "MARUTI", price: "12,345", pct: 1.87, clickable: true },
  { sym: "SUNPHARMA", price: "1,712", pct: 1.23, clickable: true },
  { sym: "TITAN", price: "3,521", pct: 0.66, clickable: true },
  { sym: "ULTRACEMCO", price: "10,567", pct: -0.85, clickable: true },
  { sym: "BAJFINANCE", price: "7,234", pct: 1.34, clickable: true },
];

const MARKET_TILES = [
  { label: "NIFTY 50", value: "23,847.20", delta: "+68.20", pct: "+0.29%", up: true },
  { label: "SENSEX", value: "79,118.45", delta: "+312.15", pct: "+0.40%", up: true },
  { label: "BANKNIFTY", value: "51,432.10", delta: "+570.45", pct: "+1.12%", up: true },
  { label: "USD/INR", value: "84.32", delta: "-0.12", pct: "-0.14%", up: false },
  { label: "GOLD", value: "74,580", delta: "+320", pct: "+0.43%", up: true },
  { label: "CRUDE", value: "78.45", delta: "-0.85", pct: "-1.07%", up: false },
];

const FEATURES = [
  {
    num: "01",
    icon: Radio,
    title: "Live tick stream",
    desc: "Angel One SmartAPI WebSocket. Sub-second quotes, no polling.",
  },
  {
    num: "02",
    icon: Database,
    title: "20 years of history",
    desc: "Yahoo Finance backfill. 1M to ALL-time candles for every NSE stock.",
  },
  {
    num: "03",
    icon: ShieldCheck,
    title: "Paper execution",
    desc: "Real fills on live ticks. Live gate stays closed until you say so.",
  },
  {
    num: "04",
    icon: Cpu,
    title: "5 strategies",
    desc: "EMA, RSI, VWAP, MACD, BB. C++17 indicators, sub-ms compute.",
  },
  {
    num: "05",
    icon: Bell,
    title: "BSE bell",
    desc: "Audio cues at open, close, halt. The floor comes alive.",
  },
  {
    num: "06",
    icon: Lock,
    title: "Read-only broker",
    desc: "Connect Angel One to see real positions, never place real orders.",
  },
];

const WATCHLIST = [
  { sym: "RELIANCE", price: "2,914.20", pct: "+1.24%", up: true },
  { sym: "SBIN", price: "824.50", pct: "+0.68%", up: true },
  { sym: "HDFCBANK", price: "1,623.00", pct: "-0.33%", up: false },
  { sym: "INFY", price: "1,567.85", pct: "+2.11%", up: true },
  { sym: "TCS", price: "3,824.10", pct: "-0.43%", up: false },
];

/* ----------------------------- ICONS ----------------------------- */

function BSEBell({ size = 28, color = "var(--gold)" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3.5C9.5 3.5 7.5 5.5 7.5 8v5.5C7.5 14.5 6.5 15.5 5.5 16h13C17.5 15.5 16.5 14.5 16.5 13.5V8c0-2.5-2-4.5-4.5-4.5z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M5 17.5h14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9 20.5h6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 2v1.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ----------------------------- 3D CHART ----------------------------- */

type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  up: boolean;
};

function buildCandles(n: number, seed: number): Candle[] {
  // simple deterministic PRNG
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const candles: Candle[] = [];
  let prev = 100;
  for (let i = 0; i < n; i++) {
    const open = prev;
    const drift = (rand() - 0.45) * 4;
    const close = Math.max(20, open + drift);
    const range = 2 + rand() * 6;
    const high = Math.max(open, close) + rand() * range;
    const low = Math.min(open, close) - rand() * range;
    candles.push({ open, close, high, low, up: close >= open });
    prev = close;
  }
  return candles;
}

function CandleGroup({ candles }: { candles: Candle[] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.05;
    }
  });

  const spacing = 0.32;
  const startX = -((candles.length - 1) * spacing) / 2;
  const green = new THREE.Color("#26A69A");
  const red = new THREE.Color("#EF5350");

  return (
    <group ref={ref}>
      {candles.map((c, i) => {
        const x = startX + i * spacing;
        // Each candle: scale its own (open,close,high,low) into a 0..1 range,
        // then map to 0..1.4 units tall. bodyH then wickH are candle-specific.
        const rng = c.high - c.low + 0.0001;
        const bodyTop = 0.7 * (Math.max(c.open, c.close) - c.low) / rng;
        const bodyBot = 0.7 * (Math.min(c.open, c.close) - c.low) / rng;
        const wickTop = 0.7 * (c.high - c.low) / rng;
        const wickBot = 0.0;
        const bodyMid = (bodyTop + bodyBot) / 2;
        const bodyH = Math.max(0.05, bodyTop - bodyBot);
        const wickMid = (wickTop + wickBot) / 2;
        const wickH = Math.max(0.05, wickTop - wickBot);
        const color = c.up ? green : red;
        return (
          <group key={i} position={[x, -0.7, 0]}>
            {/* wick */}
            <mesh position={[0, wickMid, 0]}>
              <boxGeometry args={[0.04, wickH, 0.04]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                metalness={0.3}
                roughness={0.6}
              />
            </mesh>
            {/* body */}
            <mesh position={[0, bodyMid, 0]}>
              <boxGeometry args={[0.22, bodyH, 0.22]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                metalness={0.3}
                roughness={0.6}
              />
            </mesh>
          </group>
        );
      })}
      {/* floor plane */}
      <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0E1219" metalness={0.1} roughness={0.95} />
      </mesh>
    </group>
  );
}

function Chart3D() {
  const candles = useMemo(() => buildCandles(50, 42), []);
  return (
    <Canvas
      camera={{ position: [0, 4, 14], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={["#0B0E14"]} />
      <ambientLight intensity={0.9} />
      <pointLight
        position={[5, 6, 5]}
        intensity={2.0}
        color="#FFB300"
        distance={30}
      />
      <pointLight
        position={[-5, 2, -3]}
        intensity={0.8}
        color="#2962FF"
        distance={20}
      />
      <directionalLight position={[3, 8, 3]} intensity={0.8} />
      <group rotation={[0.35, 0, 0]} position={[0, 0, 0]}>
        <CandleGroup candles={candles} />
      </group>
    </Canvas>
  );
}

/* ----------------------------- PIECES ----------------------------- */

function Navbar() {
  // IST market open: 09:15 - 15:30 weekdays
  const [marketOpen, setMarketOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      // Get current UTC time, then convert to IST (UTC+5:30)
      const now = new Date();
      const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
      const istMin = (utcMin + 330) % 1440; // wrap 24h
      const day = now.getUTCDay(); // 0 Sun, 6 Sat
      const isWeekday = day >= 1 && day <= 5;
      // 09:15 = 555, 15:30 = 930
      setMarketOpen(isWeekday && istMin >= 555 && istMin < 930);
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="tvp-nav">
      <div className="tvp-nav-inner">
        <Link href="/" className="tvp-brand">
          <BSEBell size={28} color="var(--gold)" />
          <span className="tvp-brand-name">MAET</span>
        </Link>
        <nav className="tvp-nav-links" aria-label="Primary">
          <Link className="tvp-nav-link" href="/markets">Markets</Link>
          <Link className="tvp-nav-link" href="/screener">Screener</Link>
          <a className="tvp-nav-link" href="/terminal">Strategies</a>
          <a className="tvp-nav-link" href="/terminal">Backtest</a>
          <a className="tvp-nav-link" href="/docs">Docs</a>
        </nav>
        <div className="tvp-nav-right">
          {marketOpen && (
            <span className="tvp-pill tvp-pill-live">
              <span className="tvp-pulse-dot" />
              MARKETS OPEN
            </span>
          )}
          <span className="tvp-pill tvp-pill-paper">PAPER MODE</span>
          <a className="tvp-login" href="/terminal">Login</a>
        </div>
      </div>
    </header>
  );
}

function TickerBar() {
  // duplicate the list so the loop is seamless
  const loop = [...TICKER, ...TICKER];
  return (
    <div className="tvp-ticker" aria-label="Live ticker of NSE stocks">
      <div className="tvp-ticker-track">
        {loop.map((t, i) => (
          <Link
            key={i}
            href={t.clickable ? `/stocks/${encodeURIComponent(t.sym)}` : '#'}
            className="tvp-ticker-item"
            style={{ textDecoration: 'none', cursor: t.clickable ? 'pointer' : 'default' }}
          >
            <span className="tvp-ticker-symbol">{t.sym}</span>
            <span className="tvp-ticker-price">₹{t.price}</span>
            <span className={t.pct >= 0 ? "tvp-ticker-up" : "tvp-ticker-down"}>
              {t.pct >= 0 ? "▲" : "▼"}
              {Math.abs(t.pct).toFixed(2)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="tvp-hero">
      <div className="tvp-hero-left">
        <span className="tvp-eyebrow">
          BSE / NSE TERMINAL · PAPER TRADING
        </span>
        <h1 className="tvp-h1">
          The trading floor
          <br />
          for the algorithmic age.
        </h1>
        <p className="tvp-sub">
          Real Angel One SmartAPI ticks. 20 years of Yahoo Finance history.
          Paper execution that respects the live gate.
        </p>
        <div className="tvp-cta-row">
          <Link href="/terminal" className="tvp-cta-primary">
            Open Terminal →
          </Link>
        </div>
      </div>
      <div className="tvp-hero-right">
        <div className="tvp-chart-frame">
          <Chart3D />
        </div>
      </div>
    </section>
  );
}

function MarketStrip() {
  return (
    <section className="tvp-market-strip" aria-label="Live market summary">
      {MARKET_TILES.map((tile) => (
        <div key={tile.label} className="tvp-market-tile">
          <span className="tvp-market-label">{tile.label}</span>
          <span className="tvp-market-value">₹{tile.value}</span>
          <span
            className={`tvp-market-delta ${tile.up ? "tvp-ticker-up" : "tvp-ticker-down"}`}
          >
            {tile.up ? "▲" : "▼"} {tile.delta} {tile.pct}
          </span>
        </div>
      ))}
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="tvp-features" aria-label="Features">
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.num} className="tvp-feature-cell">
            <span className="tvp-feature-num">{f.num}</span>
            <span className="tvp-feature-icon">
              <Icon size={16} strokeWidth={1.5} />
            </span>
            <h3 className="tvp-feature-title">{f.title}</h3>
            <p className="tvp-feature-desc">{f.desc}</p>
          </div>
        );
      })}
    </section>
  );
}

function TerminalPreview() {
  // CSS-only candles: 6 candles, varied green/red
  const candles = [
    { h: 70, wick: 18, up: false },
    { h: 90, wick: 22, up: true },
    { h: 60, wick: 14, up: false },
    { h: 110, wick: 26, up: true },
    { h: 80, wick: 18, up: true },
    { h: 130, wick: 30, up: true },
  ];
  const volumes = [40, 70, 30, 60, 80, 50];
  return (
    <section className="tvp-terminal-section">
      <span className="tvp-section-eyebrow">BUILT FOR SPEED</span>
      <h2 className="tvp-section-title">Every pixel earns its place.</h2>
      <p className="tvp-section-sub">
        Bloomberg density. TradingView polish. Zero bloat.
      </p>
      <div className="tvp-terminal-frame">
        <div className="tvp-terminal-topbar">
          MAET Terminal · PAPER MODE · 13:19:08 IST
        </div>
        <div className="tvp-terminal-body">
          <div className="tvp-terminal-left">
            <div className="tvp-terminal-candles">
              {candles.map((c, i) => (
                <div
                  key={i}
                  className="tvp-candle"
                  style={{
                    color: c.up ? "var(--green)" : "var(--red)",
                  }}
                >
                  <div
                    className="tvp-candle-wick"
                    style={{ height: `${c.wick}px` }}
                  />
                  <div
                    className="tvp-candle-body"
                    style={{ height: `${c.h}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="tvp-terminal-volumes">
              {volumes.map((v, i) => (
                <div
                  key={i}
                  className="tvp-volume-bar"
                  style={{ height: `${v}%` }}
                />
              ))}
            </div>
          </div>
          <div className="tvp-terminal-right">
            <span className="tvp-watchlist-label">WATCHLIST</span>
            {WATCHLIST.map((row) => (
              <div key={row.sym} className="tvp-watchlist-row">
                <span className="tvp-watchlist-symbol">{row.sym}</span>
                <span className="tvp-watchlist-price">{row.price}</span>
                <span
                  className={row.up ? "tvp-ticker-up" : "tvp-ticker-down"}
                >
                  {row.pct}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="tvp-footer">
      <div className="tvp-footer-cols">
        <div className="tvp-footer-col">
          <div className="tvp-footer-brand">
            <BSEBell size={24} color="var(--gold)" />
            <span className="tvp-brand-name">MAET</span>
          </div>
          <p className="tvp-footer-meta">
            Paper workspace · Not SEBI registered
          </p>
          <p className="tvp-footer-meta">© 2026 Tanmay · VIT Bhopal</p>
        </div>
        <div className="tvp-footer-col">
          <span className="tvp-footer-head">Product</span>
          <a className="tvp-footer-link" href="/terminal">Terminal</a>
          <a className="tvp-footer-link" href="/screener">Screener</a>
          <a className="tvp-footer-link" href="/terminal">Strategies</a>
          <a className="tvp-footer-link" href="/terminal">Backtest</a>
          <a className="tvp-footer-link" href="/terminal">AI Notes</a>
        </div>
        <div className="tvp-footer-col">
          <span className="tvp-footer-head">Connect</span>
          <a
            className="tvp-footer-link"
            href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className="tvp-footer-link"
            href="https://x.com/TanmayEquity"
            target="_blank"
            rel="noreferrer"
          >
            X @TanmayEquity
          </a>
          <a className="tvp-footer-link" href="#">Discord</a>
          <a className="tvp-footer-link" href="#">Email</a>
        </div>
      </div>
      <div className="tvp-footer-strip">
        This is not financial advice. Paper trading only. SEBI registration not claimed.
      </div>
    </footer>
  );
}

/* ----------------------------- PAGE ----------------------------- */

export default function LandingPage() {
  return (
    <main className="tvp-page">
      <Navbar />
      <LiveTicker />
      <Hero />
      <MarketStrip />
      <FeatureGrid />
      <TerminalPreview />
      <Footer />
    </main>
  );
}
