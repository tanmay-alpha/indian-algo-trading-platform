# MAET Frontend Art Direction V2

## Design Goals

MAET Terminal should feel like a premium Indian market workspace: chart-first on desktop, one-task-at-a-time on mobile, and visibly safe at every interaction point. The UI should look intentional and broker-grade without implying live execution, real-time data availability, profitability, or broker mutation capability.

## Current UI Issues

- The desktop chart workspace gives equal weight to surrounding panels, so the chart does not dominate.
- Watchlist rows and landing demo cards feel more like toy dashboard cards than broker rows.
- The safety strip reads like a developer state list instead of product trust infrastructure.
- Several screens rely on repeated glass cards with weak hierarchy and too much empty space.
- AI, system, and portfolio screens need denser but calmer information architecture.
- Mobile is too close to a compressed desktop layout in some flows.

## Palette

- Base: `#020617`, `#06111f`, `#081827`, `#0b1b2e`.
- Surfaces: dark translucent panels with readable foreground text.
- Primary accents: cyan `#22d3ee`, blue `#2f80ff`.
- Market only: green `#16c784`, red `#ea3943`.
- Safety/locked: amber `#f59e0b`.
- AI only: violet `#8b5cf6`.

## Typography

- Sans-serif is the default for content and controls.
- Heading font is reserved for product identity and major screen titles.
- Monospace is limited to symbols, prices, IDs, and technical status values.
- Visible labels should stay at 12px or above; utility copy must remain readable on glass.
- Numerics use tabular figures.

## Spacing

- Desktop workspace uses dense, aligned rails rather than large floating cards.
- Chart content gets the largest continuous area.
- Watchlist rows target 52-60px on desktop and 60-68px on mobile.
- Controls need stable min-height and no layout shift on hover, load, or selection.

## Desktop Layout

- Rail: 72px.
- Watchlist panel: 300-340px.
- Center chart: `minmax(620px, 1fr)`.
- Right panel: 340-380px.
- Right panel must contain selected symbol summary, dry-run validation state, safety checklist, OMS/manual-ticket history state, broker read-only warning, and AI advisory note.

## Mobile Layout

- One screen at a time.
- Bottom dock stays touch-friendly.
- Chart header, timeframe controls, and dry-run CTA must be reachable without horizontal scroll.
- Avoid desktop side panels on mobile; use sheets and stacked panels.

## Component Rules

- Use compact broker rows over bulky cards for market lists.
- Cards should frame repeated items or real tools only.
- Icons should come from the existing icon set and maintain consistent stroke/size.
- Buttons use icons where the action is familiar.
- Empty states explain real unavailable conditions without fake data.

## Glass And Material Rules

- Glass is used for hierarchy, not haze.
- Important text never sits over noisy background.
- Avoid over-blur and flat grey translucent panels.
- Use edge highlights, restrained shadows, and panel strength differences to show depth.

## Data Honesty

- Do not show fake prices, candles, holdings, orders, fills, PnL, or predictions as real.
- Landing previews must be labeled `Visual demo - not live market data.`
- Terminal screens use `--`, `Unavailable`, `Locked`, or explicit backend states when data is absent.
- Paper execution is not broker execution.

## Safety UX

Always keep these visible in the product chrome:

- LIVE LOCKED
- PAPER MODE
- READ ONLY
- AI ADVISORY ONLY
- BROKER MUTATION DISABLED

Admin tokens are in-memory only and never persisted. Broker context remains read-only. Manual order flow remains dry-run validation only.

## QA Checklist

- Landing feels product-specific and not generic.
- Chart dominates desktop.
- Watchlist rows are compact and readable.
- Right panel is never blank.
- AI, system, and portfolio screens have useful empty/locked states.
- Mobile has no horizontal overflow at 360, 390, and 430 widths.
- Safety strip remains visible.
- No console errors.
- No frontend build, lint, or type-check failures.
- No screenshots are committed.
