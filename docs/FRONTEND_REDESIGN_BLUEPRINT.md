# Phase 20A — Frontend Redesign Blueprint (MAET Terminal)

## 1. Executive Verdict
The current MAET Terminal frontend is functionally robust but visually cluttered and suffers from a "debug tool" aesthetic. It lacks a clear hierarchy, with the chart (the most critical component) often fighting for space with side panels and redundant workspace headers. The redesign aims to transition the UI from a multi-panel "terminal" into a sleek, "broker-grade" trading platform that prioritizes the chart and simplifies complex data into readable, actionable views.

---

## 2. Current UI Problems

### P0: Critical Failures
- **Pointer Event Interception**: Top-right notifications/toasts intercept pointer events for mode selection buttons (CLEAN/ANALYSIS/FOCUS), breaking interactivity during alerts.
- **Layout Overflow**: On smaller screens (<1200px), panels crush each other; the minimum width of 1100px is too high for modern workflows without better responsive behavior.

### P1: UX Friction
- **Duplicate Views**: "Trade" and "Charts" workspaces are virtually identical, leading to user confusion.
- **Wasted Space**: The `BottomDock` and `RightTradePanel` are persistent in almost all workspaces, even when they contain no relevant data (e.g., in "Strategy" or "Risk").
- **Visual Clutter**: The `term-grid` background and redundant `WorkspaceFrame` headers add unnecessary visual noise.
- **Hidden Features**: Premium chart modes (ANALYSIS) are hidden behind a layout selector that isn't immediately obvious as a core navigation tool.

### P2: Aesthetic Inconsistency
- **Color Overload**: Excessive use of cyan/yellow accents makes the platform look like a development console rather than a financial tool.
- **Copywriting**: Many empty states are blunt or technical (e.g., "NO_CANDLES").
- **Inconsistent Padding**: Spacing between cards and table rows varies across workspaces.

---

## 3. Component Inventory

| Category | Component(s) | Status | Action |
| :--- | :--- | :--- | :--- |
| **Shell** | `TerminalLayout`, `WorkspaceRail` | Functional | **Redesign**: Make rail more compact; remove fixed min-width. |
| **Bars** | `TopMarketBar`, `StatusBar` | Solid | **Keep**: Refine typography and spacing. |
| **Watchlist** | `WatchlistPanel` | Strong | **Refactor**: Move search into a top-level global search. |
| **Chart** | `IndicatorChartShell` | Excellent | **Keep**: This is the core. Focus on surrounding it with less noise. |
| **Trading** | `RightTradePanel`, `OrderTicket` | Cluttered | **Redesign**: Move to a slide-over or floating drawer when needed. |
| **Workspaces** | `Portfolio`, `Markets`, `Strategy` | Debug-like | **Redesign**: Rebuild with card-based layouts and clean tables. |

---

## 4. New Information Architecture

### Main Navigation (Workspace Rail)
1.  **Trade** (Merge Charts + Trade + Order Panel)
2.  **Markets** (Screener, Indices, Gainers/Losers)
3.  **Strategy Lab** (Backtesting & Signal Design)
4.  **Portfolio** (Positions, Holdings, PnL)
5.  **OMS Blotter** (Order History, Fills, Audit)
6.  **System Journal** (Event Logs, Health, Debug)

**Key Changes:**
- **Merge "Charts" into "Trade"**: Provide a "Chart-Only" toggle within the Trade view instead of a separate workspace.
- **Merge "Risk" into "OMS/Portfolio"**: Risk metrics are secondary to portfolio state and order management.
- **Bottom Dock → Collapsible Activity Tray**: Replace the fixed bottom dock with a "Drawer" pattern that only opens for active orders or recent alerts.

---

## 5. New Layout Blueprint

### Trade Workspace (The "Active View")
- **Layout**: 3-Column Split.
- **Left (280px)**: Compact Watchlist + Mini-Screener.
- **Center (Fluid)**: Chart-First. Absolute dominance.
- **Right (320px)**: **Symbol Intelligence**. Shows Symbol Details, market-depth availability, and Order Ticket in a single tabbed sidebar.
- **Bottom (Floating)**: Active Positions bar (P0 stats only).

### Markets Workspace
- **Top**: Horizontal Index Strip (NIFTY 50, BANKNIFTY, FINNIFTY).
- **Grid**: 2x2 layout for Top Gainers, Top Losers, Sector Breadth, and Volume Spikes.
- **Full Width**: Searchable Screener table with sparklines.

### Strategy Lab (Research First)
- Split screen: **Configuration** (Left 30%) vs. **Results** (Right 70%).
- Results include a high-contrast **Equity Curve** (Lightweight Chart) and a clean **Trade Log**.

---

## 6. Design System Proposal

### Color Palette
- **Primary BG**: `#05070a` (Deeper black for "True Dark" feel)
- **Surface**: `#0c1117` (Cards and Panels)
- **Border**: `#1d2128` (Subtle, non-distracting)
- **Accent (Action)**: `#38bdf8` (Sky Blue - use sparingly)
- **Bullish**: `#16c784` / **Bearish**: `#ea3943`
- **Warning/Paper**: `#f59e0b` (Amber)

### Typography
- **Sans**: Inter (UI labels, buttons)
- **Mono**: JetBrains Mono (Prices, Ticks, Timestamps - always `tabular-nums`)
- **Scale**: Small (11px) for data tables, Base (13px) for primary UI.

---

## 7. Implementation Roadmap (Phases 20B–20H)

| Phase | Goal | Key Files |
| :--- | :--- | :--- |
| **20B** | **Design Tokens & Shell** | `globals.css`, `tailwind.config.js`, `TerminalLayout` |
| **20C** | **Trade Workspace Rebuild** | `TradeWorkspace.tsx`, `SymbolIntelligence.tsx`, `WatchlistPanel` |
| **20D** | **Markets Workspace Rebuild**| `MarketsWorkspace.tsx`, `IndexTicker.tsx` |
| **20E** | **Portfolio & OMS Rebuild** | `PortfolioWorkspace.tsx`, `OmsDashboard.tsx` |
| **20F** | **Strategy Lab Rebuild** | `StrategyLab.tsx`, `BacktestResults.tsx` |
| **20G** | **Journal & System** | `JournalWorkspace.tsx`, `SystemStatus.tsx` |
| **20H** | **Responsive & UX Polish** | Global responsive pass, animations, and transitions. |

---

## 8. First Implementation Step (Phase 20B)

**Prompt for 20B**: 
"Clean up the global shell and design tokens. Update `tailwind.config.js` and `globals.css` with the new deeper black palette. Refactor `TerminalLayout` to remove the fixed `term-grid` background and redundant `WorkspaceFrame` headers. Implement the new compact `WorkspaceRail` with the revised 6-item information architecture."

---

## 9. Safety Confirmation
- **No backend changes**: Verified.
- **No trading logic modified**: Verified.
- **No fake data added**: Verified.
- **Safety Lock (PAPER)**: Remains default and visually highlighted via the Amber theme.
