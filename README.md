# PSX Pilot — Your Intelligent Investing Workspace

A personal investing workspace for Pakistan Stock Exchange (PSX) investors: portfolio tracking, interactive calculators, a trade journal, behavioral insights, watchlists & alerts, daily routines, research notes, a Shariah center and a portfolio Q&A assistant.

> **Data notice.** This build ships with a **demo market-data provider that generates synthetic prices**. It is not PSX market data. Every screen that shows prices labels them as demo data. Connect a licensed data vendor before relying on prices.

## Run it locally

Requirements: Node.js 20 or newer.

```bash
cd psx-pilot
npm install
npm run dev
```

Open http://localhost:3000. The app starts with clearly labelled demo data; remove it in **Settings → Data source & your data → Remove demo data**.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the calculation test suite (portfolio ledger, fees, calculators, journal, behavior, CSV import, assistant) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build && npm start` | Production build and server |

### Optional: enable the AI assistant

Copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY`. The key is used only by the server route `src/app/api/assistant/route.ts` and is never sent to the browser. Without a key, the assistant runs in a clearly labelled **rule-based demo mode** that answers from your own records.

## What is functional now

- **App shell**: collapsible sidebar, mobile bottom navigation, command palette (Ctrl/⌘ K), global symbol search, dark/light themes, toasts, keyboard-accessible modals, PWA manifest.
- **Command Center**: KPIs, value history vs. a benchmark, allocation, best/worst holdings, risk summary, alerts, events, today's plan, insights and behavior snapshot. Widgets can be reordered (drag or arrows), resized and hidden.
- **Portfolios**: multiple real and paper portfolios; add, edit and delete transactions (buy, sell, dividend, bonus, deposit, withdrawal, fee); weighted-average cost; realized and unrealized P/L; fees; cash; protection against selling more than you hold; CSV import with column auto-matching, validation and duplicate detection; cash and holdings reconciliation; CSV export and print-to-PDF.
- **Investment Lab**: average cost, what-if scenarios with sliders, risk-based position sizing, profit targets, rebalancing (HHI, effective N, illustrative volatility), dividend income (hypothetical vs. declared shown separately), compounding. Scenarios can be saved and reopened.
- **Trade Journal**: multi-step entry form (trade, plan and risk, mindset, review), search and filters, CSV export, equity curve, drawdown, monthly P/L, R-multiples, results by strategy. Profit factor and expectancy stay hidden until there are enough closed trades to make them meaningful.
- **Behavior Studio**: plan and risk-rule adherence, weekly frequency, overtrading weeks, possible loss-chasing, confidence vs. outcome, emotions, recurring themes, weekly review and reflection timeline. Detection thresholds are adjustable.
- **Watchlists & Alerts**: multiple lists with notes; price, % change, volume and concentration alerts; a notification center; opt-in browser notifications and sound.
- **Daily Workspace**: before-, during- and after-market views with checklists, price levels, trading plan, notes, recap, risk-rule review and carry-over of unfinished tasks.
- **Research**: price chart with SMA 20/50/200, RSI and MACD; multi-symbol comparison; notes; investment thesis builder.
- **Calendar**: month and list views, filter by holdings, reminders, and a dividend tracker that keeps expected, declared and received amounts separate. "Mark received" posts the dividend to your ledger.
- **Shariah Center**: every symbol shows *Status Not Verified* unless you record a status from an official published source with its date. Also includes screening education, classification history and a purification calculator.
- **Paper Trading**: virtual cash, an order ticket, a decision log and learning milestones.
- **Settings**: fee profile (all rates start at zero, nothing is assumed), risk limits, checklist template, notifications, number format (lakh/crore), JSON backup and restore, demo-data management and erase-all.

## What still needs integration

| Area | Status |
| --- | --- |
| Live PSX prices, announcements, financials, dividend history | Needs a licensed data vendor. Implement `MarketDataProvider` (`src/lib/market/demo-provider.ts`). |
| Cloud accounts, login, password reset, multi-device sync | The schema and row-level security are ready in `supabase/migrations/0001_init.sql`. Data currently lives only in the browser (local mode). |
| Subscriptions and billing | Tiers are configurable in the Admin preview; no payment provider is connected. |
| Email, WhatsApp and server-side alert monitoring | Needs a backend job plus a provider. Alerts are evaluated in the browser while the app is open. |
| Official Shariah lists and status-change alerts | Needs an authorised feed of the published lists. |
| Historical replay for paper trading | Needs licensed historical data. |
| Excel (.xlsx) import | Save the file as CSV and import that for now. |
| Admin authentication | The admin page is a local preview, not a secured console. |

## Architecture

- Next.js 15 (App Router), TypeScript, Tailwind CSS, Recharts and Lucide icons.
- `src/lib/finance/`: pure, tested calculation modules (portfolio ledger, fees, calculators, journal, behavior and indicators).
- `src/store/`: a Zustand store persisted to browser storage. Its types mirror the database tables, so a server-backed repository can replace it.
- `src/lib/market/`: the market-data provider interface and the synthetic demo provider.
- `src/app/api/assistant`: the server-only AI route, with input validation and size limits.
- Security headers are set in `next.config.ts`, and CSV exports neutralise spreadsheet formulas.

## Disclaimer

PSX Pilot is an educational and record-keeping tool. Its calculations are hypothetical scenarios, not forecasts. Nothing in the app is investment advice. Review the applicable SECP regulations before adding features that give investment recommendations, route orders or manage money for others.
