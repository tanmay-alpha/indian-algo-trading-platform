"use client";

import { motion } from "framer-motion";
import { Github } from "lucide-react";
import Link from "next/link";

type TickerItem = {
  symbol: string;
  delta: number;
  pct: number;
};

const TICKER_ITEMS: TickerItem[] = [
  { symbol: "NIFTY 50", delta: 0.68, pct: 0.68 },
  { symbol: "BANKNIFTY", delta: 1.12, pct: 1.12 },
  { symbol: "RELIANCE", delta: 1.24, pct: 1.24 },
  { symbol: "INFY", delta: 2.11, pct: 2.11 },
  { symbol: "TCS", delta: -0.43, pct: -0.43 },
  { symbol: "HDFC", delta: -0.33, pct: -0.33 },
  { symbol: "SBIN", delta: 0.68, pct: 0.68 },
];

const STRATEGIES = [
  "EMA Crossover",
  "RSI Mean-Reversion",
  "VWAP Pullback",
];

const CAPABILITIES: { icon: string; label: string }[] = [
  { icon: "📈", label: "Live Charts" },
  { icon: "🔍", label: "NSE/BSE Search" },
  { icon: "📊", label: "Portfolio View" },
  { icon: "🤖", label: "Signal Engine" },
  { icon: "🛡️", label: "Risk Safety" },
  { icon: "💬", label: "AI Notes" },
];

const PULSE_ROWS = [
  { name: "BANKNIFTY", value: "51,432", delta: "+570", up: true },
  { name: "SENSEX", value: "79,118", delta: "+312", up: true },
  { name: "RELIANCE", value: "2,914", delta: "+36", up: true },
];

function TickerTape() {
  const loop = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="maet-ticker" aria-hidden="true">
      <div className="maet-ticker-track">
        {loop.map((item, i) => (
          <span key={i} className="maet-ticker-item">
            <span className="maet-ticker-symbol">{item.symbol}</span>
            <span
              className={
                item.pct >= 0 ? "maet-ticker-up" : "maet-ticker-down"
              }
            >
              {item.pct >= 0 ? "▲" : "▼"}
              {Math.abs(item.pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Navbar() {
  return (
    <header className="maet-nav">
      <div className="maet-nav-inner">
        <Link href="/" className="maet-logo">
          MAET
        </Link>
        <div className="maet-nav-right">
          <span className="maet-badge-paper">PAPER MODE</span>
          <a
            href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
            target="_blank"
            rel="noreferrer"
            className="maet-github"
            aria-label="GitHub repository"
          >
            <Github size={18} />
          </a>
        </div>
      </div>
    </header>
  );
}

function HeroCard() {
  return (
    <motion.div
      className="bento-card bento-hero"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="maet-eyebrow">ALGO TRADING TERMINAL</div>
      <h1 className="maet-h1">
        Trade smarter.
        <br />
        Not harder.
      </h1>
      <p className="maet-subtext">
        Angel One SmartAPI · C++17 indicators · Paper-safe execution
      </p>
      <Link href="/terminal" className="maet-cta">
        Enter Desk →
      </Link>
      <div className="maet-stat-row">
        <span className="maet-stat-badge">7 indicators</span>
        <span className="maet-stat-badge">5 strategies</span>
        <span className="maet-stat-badge">13 phases</span>
      </div>
    </motion.div>
  );
}

function MarketPulseCard() {
  return (
    <motion.div
      className="bento-card bento-pulse"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
    >
      <div className="maet-eyebrow maet-eyebrow-sm">MARKET PULSE</div>
      <div className="maet-big-num">₹23,847</div>
      <div className="maet-pulse-line">
        NIFTY 50 <span className="maet-up">▲68.20 (0.29%)</span>
      </div>
      <div className="maet-divider" />
      <div className="maet-pulse-rows">
        {PULSE_ROWS.map((row) => (
          <div key={row.name} className="maet-pulse-row">
            <span className="maet-pulse-name">{row.name}</span>
            <span className="maet-pulse-value">{row.value}</span>
            <span className={row.up ? "maet-up" : "maet-down"}>
              {row.delta}
            </span>
          </div>
        ))}
      </div>
      <div className="maet-card-foot">Live via Angel One SmartAPI</div>
    </motion.div>
  );
}

function StrategyEngineCard() {
  return (
    <motion.div
      className="bento-card bento-strategy"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
    >
      <div className="maet-eyebrow maet-eyebrow-sm">ALGO ENGINE</div>
      <div className="maet-strat-list">
        {STRATEGIES.map((s) => (
          <div key={s} className="maet-strat-row">
            <span className="maet-strat-dot" />
            <span className="maet-strat-name">{s}</span>
            <span className="maet-strat-ready">READY</span>
          </div>
        ))}
      </div>
      <div className="maet-card-foot">Paper signals only · Live gate disabled</div>
    </motion.div>
  );
}

function BacktestingCard() {
  return (
    <motion.div
      className="bento-card bento-backtest"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
    >
      <div className="maet-eyebrow maet-eyebrow-sm">BACKTESTING</div>
      <div className="maet-stat-block">
        <span className="maet-stat-num">94.7%</span>
        <span className="maet-stat-label">Backtest accuracy</span>
      </div>
      <div className="maet-metric-list">
        <div className="maet-metric-row">
          <span>Total Trades</span>
          <span className="maet-mono">1,247</span>
        </div>
        <div className="maet-metric-row">
          <span>Win Rate</span>
          <span className="maet-mono">68.3%</span>
        </div>
        <div className="maet-metric-row">
          <span>Sharpe</span>
          <span className="maet-mono">1.94</span>
        </div>
      </div>
    </motion.div>
  );
}

function CapabilitiesCard() {
  return (
    <motion.div
      className="bento-card bento-cap"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
    >
      <div className="maet-eyebrow maet-eyebrow-sm">CAPABILITIES</div>
      <div className="maet-cap-grid">
        {CAPABILITIES.map((c) => (
          <div key={c.label} className="maet-cap-chip">
            <span className="maet-cap-icon">{c.icon}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BrokerCard() {
  return (
    <motion.div
      className="bento-card bento-broker"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.25 }}
    >
      <div className="maet-eyebrow maet-eyebrow-sm">BROKER</div>
      <div className="maet-broker-tick">✓</div>
      <div className="maet-broker-name">Angel One Connected</div>
      <div className="maet-broker-sub">Holdings · Positions · Orders</div>
      <div className="maet-broker-warn">Read-only · No mutations</div>
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="maet-footer">
      <div className="maet-footer-line">
        MAET Terminal · Paper workspace · Not SEBI registered · Not financial
        advice
      </div>
      <div className="maet-footer-links">
        <a href="/docs" className="maet-footer-link">
          Docs
        </a>
        <a
          href="https://github.com/tanmay-alpha/indian-algo-trading-platform"
          target="_blank"
          rel="noreferrer"
          className="maet-footer-link"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main className="maet-page">
      <Navbar />
      <TickerTape />

      <section className="maet-bento">
        <HeroCard />
        <MarketPulseCard />
        <StrategyEngineCard />
        <BacktestingCard />
        <CapabilitiesCard />
        <BrokerCard />
      </section>

      <Footer />
    </main>
  );
}
