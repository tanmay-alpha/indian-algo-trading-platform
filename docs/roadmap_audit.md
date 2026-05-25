# MAET Personal Broker + Algo Bot Roadmap Audit

## 1. Current Truth
Today, the MAET project is a highly robust, clean, and test-hardened **paper trading and research terminal** focused on Indian stock market specifications (specifically Angel One SmartAPI specs). 
- **What it is**: A state-of-the-art sandbox simulation environment featuring market-hours rules, slippage modeling, limit/market order emulation, persistent fills, pre-trade risk controls, startup OMS recovery, and a beautiful read-only dashboard.
- **What it is NOT**: A production-ready personal broker or automated trading bot. It lacks persistent database storage (currently local SQLite that resets on Render Free restarts), authentication (static admin token only), a complete instrument universe (relies on a fallback cache subset of symbols), dynamic strategy lifecycle controls, proper real-time charting, and live execution (which is hard-locked for safety).

---

## 2. Feature Gap Table
| Feature | Current State | Missing | Priority | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Full Instrument Universe** | Loaded from hardcoded offline fallback files (subset of symbols). | Live synchronization with Angel One's full instrument master (50k+ contracts), stored in DB with indexed search. | High | Memory exhaustion when loading full universe. |
| **Market Watch** | Managed in-memory on backend; resets on restart. | Watchlists saved to persistent DB, custom watchlists per user. | Medium | Stale token/symbol mappings. |
| **Quotes** | Live streaming ltp and basic bid/ask spreads. | Full Level-2 order book depth stream, OHLC history retrieval. | Low | High WebSocket bandwidth usage. |
| **Charts** | Basic charting in frontend. | Full TradingView Lightweight Charts integration with custom indicators and draw tools. | High | Rendering lag with high tick counts. |
| **Scanner** | Simple in-memory technical scanner. | DB-driven multi-timeframe screener running queries on computed indicators. | Medium | Excessive CPU utilization during scans. |
| **Strategy Runtime** | Static classes initialized at boot. | Dynamic upload, registration, validation, starting, and stopping of strategies. | High | Unchecked user scripts crashing the main loop. |
| **Paper Trading** | Realistic execution modeling with fees/slippage. | Margin calculations, balance simulated deposits, multi-account support. | Low | Low risk. |
| **Live Execution** | Disabled and mock-locked. | Full API connection to Angel One for placing real orders on NSE/BSE. | Critical | Extreme real-money financial risk. |
| **OMS** | Local SQLite OrderStore with recovery. | Live order status polling, synchronization with real exchange records. | High | Local/Broker order status desynchronization. |
| **Risk** | Static PreTradeRiskGate checks. | Real-time exposure limits, margin requirements tracking, circuit breakers. | High | Latency overhead inside risk loop. |
| **Reconciliation** | Local reconciler comparing local vs mock broker. | Automatic daily end-of-day trade book and ledger reconciliation. | Medium | API token expiry mid-process. |
| **Portfolio** | In-memory reconstruction from local fills. | Historical equity curve tracking, tax/charge reports. | Medium | Inaccurate cost-basis math. |
| **Funds/Margin** | Mock capital ($50,000 / Rs 50,000). | Synchronization with real Angel One RMS limits and funds. | High | Trading on stale/insufficient balance records. |
| **Auth** | Static ADMIN_TOKEN in env. | Multi-user support, dynamic login, OTP/TOTP, session encryption. | Critical | Unauthorized trading bot control. |
| **DB** | Local SQLite database. | Production SQL (PostgreSQL, Supabase) with schema migrations. | Critical | Total database reset on Render container recycle. |
| **Deployment** | Render Free and Vercel. | Dockerized production deployment on dedicated VM with crash recovery (PM2/Systemd). | Medium | Server sleep/disconnects during market hours. |
| **C++** | CMake bindings for technical indicators. | Full native compilation of indicators and backtester for speed. | Medium | Segment faults crashing Python process. |

---

## 3. Real-Money Blockers
| Blocker | Current State | Required Fix | Severity |
| :--- | :--- | :--- | :--- |
| **Ephemeral DB Storage** | Render Free discards database writes on restart. | Switch to managed database (e.g., Supabase PostgreSQL). | Critical |
| **Lack of Real Auth** | Single hardcoded admin token. | Implement JWT sessions, multi-factor login, and encrypted secrets storage. | Critical |
| **Live API Locked** | Executions are hard-locked to Paper. | Implement manual gate toggle and fully test with Angel One SandBox credentials. | High |
| **No Manual Order Gate** | Strategies place orders automatically without a secondary human check. | Implement a manual "Approval Queue" in the UI for live orders. | High |
| **Angel One Rate Limits** | No throttling; could trigger rate-limit blocks. | Implement Token Bucket rate limiter for order placing. | High |

---

## 4. Terminal/UI Gaps
| Component | Status | Problem | Fix |
| :--- | :--- | :--- | :--- |
| **Charting Panel** | Minimalist | Lacks interactive historical charts, drawing features, and overlays. | Integrate standard TradingView Lightweight Charts on frontend. |
| **Symbol Search** | Limited | Only matches hardcoded list of fallback contracts. | Build auto-completing search bar backed by live instruments database. |
| **Risk Console** | Missing | No UI to edit pre-trade risk thresholds. | Create an admin controls page for dynamically tweaking risk caps. |
| **Auth Gateway** | Missing | Login screen is missing; terminal loads immediately. | Add security wrapper login page on frontend. |

---

## 5. Database Plan
| Table | Purpose | Needed For | Priority |
| :--- | :--- | :--- | :--- |
| `instruments` | Directory of 50,000+ NSE/BSE contracts. | Symbol search, metadata resolution. | High |
| `watchlists` | User-defined list of watched tokens. | Real-time watchlist state persistence. | Medium |
| `candles` | Historical bar cache for indicators. | Charting and indicator computation. | Medium |
| `strategies` | Saved strategy configurations. | Strategy setup persistence. | High |
| `strategy_runs` | Logs of strategy execution instances. | Strategy audit trail and performance track. | High |
| `signals` | Trade signals generated by strategies. | Backtesting and audit log. | High |
| `orders` | Permanent record of all orders. | OMS state and recovery. | Critical |
| `order_events` | Audit log of order status state changes. | Transparency and debugging. | Critical |
| `fills` | Record of partial and full executions. | Portfolio rebuild and margin ledger. | Critical |
| `positions` | Tracked open/closed position metrics. | Portfolio overview. | High |
| `holdings` | Long-term holdings state. | Portfolio management. | Medium |
| `portfolio_snapshots` | Daily snapshots of equity and capital. | Performance chart generation. | Medium |
| `risk_events` | Log of blocked orders by PreTradeRiskGate. | Risk compliance and strategy auditing. | High |
| `audit_logs` | Platform operational logs. | Security compliance. | Critical |
| `journal_entries` | Manual user trade notes. | Operational improvements. | Low |

---

## 6. C++ Plan
| Component | Keep Python / Move to C++ / Already C++ | Reason |
| :--- | :--- | :--- |
| **Indicator Math** | Move to C++ | Pybind11 is setup. Native speed is required for multi-contract screening. |
| **Backtester Core** | Move to C++ | Replaying millions of bars in Python is slow; native loops save time. |
| **Live Tick Ingestion** | Keep Python | Asyncio and websockets-client are stable and easier to maintain. |
| **Strategy Generation** | Keep Python | Fast prototyping and readability of strategy rules is key. |

---

## 7. Cleanup/Remove List
| File/Area | Issue | Action |
| :--- | :--- | :--- |
| `backend/verify_angel.py` | Standalone connection script. | Move to `backend/scratch/` as a reference utility. |
| `backend/test_integration.py` | Obsolete code snippet. | Delete or refactor into `tests/`. |
| `.ai-workspace-backup/` | Redundant archive folders. | Clean up and ensure it is fully ignored in `.gitignore`. |

---

## 8. Roadmap

### Phase 19 — Production Database & Migration Framework
- **Goal**: Transition database from local SQLite to PostgreSQL.
- **Features**: Setup SQLAlchemy/Alembic, configure Supabase connection, schema definitions for core tables (`orders`, `fills`, `instruments`).
- **Files affected**: `backend/core/database.py`, `backend/core/config.py`, introduction of database migrations folder.
- **Risks**: Connectivity latency on Render Free; connection pooling issues.
- **Tests**: DB unit tests for connection, reads, and writes.
- **Stop condition**: Backend boots, creates database tables dynamically, and passes basic CRUD tests.

### Phase 20 — User Management & Authentication Hardening
- **Goal**: Secure api endpoints and frontend with formal user logins.
- **Features**: JWT token authentication, user password hashing, UI Login Page.
- **Files affected**: `backend/routers/auth.py`, `frontend/components/auth/login.tsx`, `backend/api_server.py`.
- **Risks**: Token interception, storage of session keys.
- **Tests**: Auth token generation tests, protected endpoint access tests.
- **Stop condition**: Endpoints reject requests without valid Bearer tokens; Login UI successfully queries token and saves session.

### Phase 21 — Full Instrument Universe Sync
- **Goal**: Enable search for any NSE/BSE contract.
- **Features**: Daily background cron job to download Angel One instrument master, save to DB with index search.
- **Files affected**: `backend/gateway/instrument_loader.py`, `backend/routers/discovery.py`.
- **Risks**: Inserting 50,000+ records can take minutes if not batched.
- **Tests**: Verify batch insert script runs in under 30 seconds; search API matches correct tokens.
- **Stop condition**: API successfully returns search matches for NSE:INFY-EQ, BSE:SBI, etc.

### Phase 22 — Persistent Watchlists & Charts
- **Goal**: Build an interactive analysis workspace.
- **Features**: Save watchlists to DB, integrate TradingView Lightweight Charts on frontend.
- **Files affected**: `frontend/components/watchlist.tsx`, `frontend/components/charts/tv-chart.tsx`.
- **Risks**: Chart lag, WebSocket overload.
- **Tests**: Mock streaming ticks to charting view; verify charts update smoothly.
- **Stop condition**: Clicking a symbol updates the live candlestick chart in real time.

### Phase 23 — Dynamic Strategy Lifecycle Manager
- **Goal**: Execute trading rules dynamically.
- **Features**: Strategy templates dashboard, parameters editor, start/stop toggle.
- **Files affected**: `backend/routers/strategies.py`, `frontend/components/strategy-manager.tsx`.
- **Risks**: Crashed strategy script takes down the server thread.
- **Tests**: Mock strategy crash does not impact core api responsiveness.
- **Stop condition**: A user can boot or terminate an SMA-Crossover strategy via UI.

### Phase 24 — Pre-Trade Risk Gate UI Console
- **Goal**: Manage limits safely.
- **Features**: UI panel to configure max drawdown, max order quantity, and daily loss limits.
- **Files affected**: `backend/risk/risk_manager.py`, `frontend/components/risk-console.tsx`.
- **Risks**: Changing limits during an active trade session.
- **Tests**: Validate that a newly applied limit immediately blocks subsequent mock orders.
- **Stop condition**: Reducing maximum order size to 1 immediately rejects a mock order of size 2.

### Phase 25 — Manual Order Approval & Execution Gate
- **Goal**: Eliminate runaway trading bot risks.
- **Features**: A visual approval queue where bots place "pending" trades, and humans click "Approve" to send them to the exchange.
- **Files affected**: `backend/execution/execution_router.py`, `frontend/components/approval-queue.tsx`.
- **Risks**: Latency while waiting for manual click.
- **Tests**: Validate that a trade is held in PENDING status until approved.
- **Stop condition**: Confirm order remains unrouted for 5 minutes, then routes successfully within 200ms of clicking "Approve".

### Phase 26 — Angel One SmartAPI Live Execution
- **Goal**: Connect to the real exchange.
- **Features**: Live execution toggle, rate limiter (3 calls/sec), live order status polling.
- **Files affected**: `backend/execution/execution_router.py`, `backend/gateway/market_gateway.py`.
- **Risks**: Real-money losses, account lockouts.
- **Tests**: Dry run placements of limit orders far from market price; immediate cancel tests.
- **Stop condition**: Send a live buy order for 1 share of liquid stock, see it executed on exchange, and verified in terminal ledger.

### Phase 27 — C++ Indicators & Backtesting Integration
- **Goal**: Native performance speedup.
- **Features**: Compiling native modules, binding them to python, migrating backtest loops to C++.
- **Files affected**: `backend/indicators/`, `cpp/src/indicators.cpp`.
- **Risks**: Pybind11 segmentation faults.
- **Tests**: Test indicators match Python equivalents exactly.
- **Stop condition**: Run 1-year backtest on 1-minute bars in under 1 second.

### Phase 28 — Production Deployment & Uptime Monitoring
- **Goal**: Stable platform hosting.
- **Features**: Docker-compose setup, PM2 process management, Prometheus/Grafana alerts.
- **Files affected**: `Dockerfile`, `docker-compose.yml`, `deployment/`.
- **Risks**: Host failure.
- **Tests**: Verify container restarts automatically on crash.
- **Stop condition**: Platform runs uninterrupted for 48 hours of live paper trading.

---

## 9. Recommended Next Step
**C. Learning-safe path** (dynamic watchlists, PostgreSQL setup, improved charting) to bridge the gap without taking live execution risks.

---

## 10. Next Implementation Prompt
```markdown
Phase 19 Target: Set up SQLAlchemy and migration framework (Alembic) to support PostgreSQL. Configure the database configuration in backend/core/config.py to fallback to local SQLite if POSTGRES_URL is missing. Define tables for 'orders', 'fills', and 'instruments' matching current schemas, and migrate existing SQLite database writes in OrderStore to use the new connection manager. Provide unit tests validating basic CRUD queries. Do not enable live trading.
```

---

> [!WARNING]
> **CRITICAL RELEASE POLICY**: Live trading must remain disabled until production DB, authentication, broker reconciliation, rate-limit handling, manual approval gate, and extensive sandbox/live dry-run testing are complete.
