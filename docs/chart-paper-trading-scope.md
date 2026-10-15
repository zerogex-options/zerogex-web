# Paper trading on the Gamma Chart — scope

*Simulated buy and sell at market on the chart, with the position, its P&L and
its fills drawn on the tape. A member asked for it on 2026-10-15 ("it would be
cool if we could simulate buy/sell at market in the graphic").*

> **Status: scoped, not built.** Nothing here is in the product. §4 lists the
> six decisions to make before building, each with a recommendation; the
> Codex prompt in §9 bakes the recommendations in, so change §9 if you change
> a decision.
>
> **Size.** About the size of the Wall Alerts feature (one pull request, a few
> thousand lines with tests): new tables, four API routes, one pure module, a
> ticket on the chart and a trade log. No backend (zerogex-oa) change: fills
> are priced from the quote endpoint the chart already reads.

---

## 1. The ask

Click **Buy** or **Sell** on the Gamma Chart and get a simulated position at
the current price, watch its P&L against the levels on the same chart, and
close it. The point is practice: trade the put wall, the flip, the call wall,
and see how it would have gone, without a broker.

## 2. What version 1 is

- **A trade ticket on the chart's toolbar**: quantity, **Buy**, **Sell**, and
  once a position is open, a chip with side, size, average price and live P&L,
  plus **Flatten**. On a phone, one **Trade** button opens a bottom sheet with
  the same controls.
- **Market orders only**, filled at the server's latest quote at the moment
  of the order. No limit or stop orders.
- **On the tape**: a dashed line at the position's average price with a
  right-axis tag showing live P&L, and a marker on the candle of every fill
  (buy below the candle, sell above it). Hovering a marker shows the fill.
- **A trade log** under the chart: today's fills (time ET, side, size, price),
  closed trades with realized P&L, and the day's totals (realized,
  unrealized, trades, win rate).
- **Saved to the member's account**, so a position survives a reload and
  follows them to another device, with a **Reset** that clears positions and
  history and restores the starting balance.
- **Labeled as a simulation everywhere it appears**: a PAPER badge on the
  ticket and on the chart's position line, and one line of copy: "Simulated
  fills at the last price. No orders are sent anywhere."

## 3. What version 1 is not

- Not real trading, and no broker connection. Order routing would be a
  separate decision with legal and support weight of its own (see
  `docs/integrations-ibkr-collective2-feasibility.md`).
- No options. Paper-trading options needs a contract picker and per-contract
  quotes; that is phase 3.
- No practice on replayed sessions. That is the most valuable follow-up and
  phase 2 (§8).
- No leaderboards, sharing, or performance claims in marketing.

## 4. Decisions to make first

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Which instruments | **SPY and QQQ in shares; ES and NQ in contracts** ($50 and $20 a point). Hide the ticket on SPX and NDX: the cash indexes are not tradable, and the futures are on the same menu. |
| 2 | Fill price | **The quote's last price** from `/api/market/quote`, fetched by the server when the order arrives. The quote carries no bid/ask, so there is no spread to cross. Optional slippage can come later. |
| 3 | When orders fill | **SPY/QQQ only while the quote's `session` is `open`**: the regular session, on the backend's own market calendar, so holidays are handled. ES/NQ whenever the quote is fresh (`stale` false and `data_age_seconds` under 30). Otherwise the order is refused with the reason. |
| 4 | Who gets it | **Basic and up**, wherever the live chart is (Main Dashboard, Gamma Terminal, My Dashboard tile). Not on the public, delayed gamma-levels pages. |
| 5 | Balance and size | **$100,000 starting balance**, no margin model, a size cap per order (10,000 shares or 50 contracts) and per position, and **Reset** at any time. |
| 6 | Overnight and the futures roll | **Positions may be held overnight.** An ES/NQ position is in the contract the chart showed when it opened (stored with the fill); when the chart's contract rolls, the position is closed at the old contract's last price and the member is told. Quarterly, so rare. |

## 5. How it fits the code

- **The chart** is `frontend/components/GammaTerminalChart.tsx`, a hand-drawn
  SVG. The ticket belongs in its toolbar (`viewActions`, beside Save and Full
  screen); the overlays are one more set of lines, tags and markers drawn the
  way the level lines and level tags already are. Keep the integration to a
  prop or two and a small drawing block; everything else lives outside.
- **Pure logic** goes in `frontend/core/paperTrading.ts`, tested under the
  Node runner like `core/flowAnalysis.ts`: average price on adds, realized
  P&L on reductions, reversals through zero, multipliers, the size caps, the
  fill-allowed rules of §4.3 (read off the quote's own `session` and
  freshness fields, not the browser's clock).
- **Storage** follows My Dashboard's boards: tables created in
  `frontend/core/db.ts` (`CREATE TABLE IF NOT EXISTS`, lazy init), read and
  written by account routes like `frontend/app/api/account/board/route.ts`
  (session auth, `validateCsrf` on writes, `Cache-Control: no-store`).
- **Pricing** uses `frontend/core/api/serverFetch.ts` to read
  `/api/market/quote` on the server, uncached, at order time. The browser's
  own price is never trusted for a fill; the live P&L between fills is
  marked from the quote the chart already polls.

## 6. Data and API

Tables (all keyed by `user_id`, `ON DELETE CASCADE` to `users`):

- `paper_accounts`: starting cash, cash, realized P&L, created, last reset.
- `paper_positions`: one row per (user, symbol): signed quantity, average
  price, multiplier, contract (futures), opened, updated.
- `paper_fills`: every fill: symbol, side, quantity, price, multiplier,
  contract, the quote's own timestamp, filled-at, and the realized P&L the
  fill booked.

Routes under `/api/account/paper`: `GET` (account, positions, today's fills),
`POST order` (symbol, side, quantity: priced and applied in one transaction),
`POST flatten` (one symbol or all), `POST reset`. Rate-limited per member.

## 7. Risks

- **A stale or missing quote** must refuse the order, never fill at an old
  price. The quote's own timestamp is stored on the fill so a bad fill can be
  traced.
- **The futures roll** (§4.6) is the one place the simple model bends. It is
  quarterly and the rule is simple, but it needs a test.
- **Confusion with real trading**: the PAPER labeling is part of the feature,
  not decoration. Keep it out of performance marketing.
- **Load** is negligible: a few writes per member per day.

## 8. Phases

1. **Version 1** (this scope): market orders, positions, P&L on the tape,
   trade log, saved per account.
2. **Practice on replays**: trade the chart's Rewind clock on a past session,
   fills at the replayed price, in a separate practice ledger. Then limit and
   stop orders, drawn as draggable lines on the tape.
3. **Options**: paper-trade single contracts from the chain, priced from the
   contract quotes the Option Contracts page already reads.

## 9. Codex prompt

Paste everything between the two rules into Codex.

---

You are working in the ZeroGEX web app, the repository `zerogex-web` (Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Node 22). The frontend is in `frontend/`. Start from the latest `release` branch on a new branch named `codex/chart-paper-trading`. Write American English in all copy and comments.

Goal: add paper trading to the Gamma Chart. A member clicks Buy or Sell on the chart, gets a simulated position at the current price, sees the position, its live P&L and its fills drawn on the chart, and can flatten it. It is saved to their account. It is clearly labeled as a simulation. No real orders are ever sent anywhere.

Read these first, and follow their patterns rather than inventing new ones:
- `frontend/components/GammaTerminalChart.tsx`: the chart. It is a large hand-drawn SVG component. Its toolbar actions are built in `viewActions` (the Save and Full screen buttons). Level lines and right-axis level tags are drawn in the SVG body. Keep your change to this file small: a prop or two, the ticket rendered from `viewActions`, and one drawing block for the overlays. Put everything else in new files.
- `frontend/core/db.ts`: the SQLite database (`node:sqlite`, `DatabaseSync`) with tables created lazily in `initDb()` using `CREATE TABLE IF NOT EXISTS`. Add your tables there the same way.
- `frontend/app/api/account/board/route.ts` and the helpers it imports from `frontend/core/serverAuth.ts`: how an account route reads the session, validates CSRF on writes (`validateCsrf`), sets `Cache-Control: no-store, private`, and re-issues the CSRF and session cookies. Copy that shape.
- `frontend/core/api/serverFetch.ts`: how the Next server calls the ZeroGEX API (`serverApiGetResult`, `serverApiGet`). Fills must be priced on the server from `/api/market/quote?symbol=<SYMBOL>`, fetched without caching at the moment of the order. Its row has `close` (the last price), `timestamp`, `session`, and for ES/NQ `data_contract`, `stale` and `data_age_seconds`. Never trust a price sent by the browser.
- `frontend/core/flowAnalysis.ts` with `frontend/tests/flowAnalysis.test.ts`: the house style for pure logic and its tests (no React, run with `node --experimental-strip-types --test`), and `frontend/package.json` for how a test script is registered.
- `frontend/app/globals.css` (the `.zg-*` classes and tokens) and `frontend/components/controls/Filters.tsx`: the design system. Use theme tokens only (`var(--color-bull)`, `var(--color-bear)`, `var(--color-accent-hot)`, `var(--text-*)`, `var(--bg-*)`, `var(--border-*)`), 2px radii, mono numbers (`.zg-metric`, `.zg-mono`), no hard-coded colors, no gradients or glows, no emoji. Every control is a real `<button>` with an accessible name, at least 40px tall on touch screens.
- `frontend/core/dashboardWidget.ts` (`useInDashboardWidget`) and the chart's `delayed` / `snapshot` props: the chart also renders inside My Dashboard tiles and, delayed, on public pages.

Rules (these are decisions already made):
1. Instruments: SPY and QQQ trade in shares (multiplier 1). ES trades in contracts at $50 a point and NQ at $20 a point. On SPX and NDX the ticket is not shown. Put the multipliers in one table in the pure module.
2. Orders are market orders only, filled at the quote's `close` fetched by the server when the order arrives.
3. SPY and QQQ fill only while the server's quote reports `session` equal to `open` (the regular session on the backend's market calendar, so holidays are already handled; do not use the clock-only helpers in `frontend/core/utils.ts` for this). ES and NQ fill whenever the quote has `stale` not true and `data_age_seconds` under 30. If an order cannot fill, refuse it with a clear reason and change nothing. Put this check in the pure module so it is tested.
4. Available to every signed-in member who can see the live chart: the Main Dashboard, the Gamma Terminal and the My Dashboard tile. Not shown when the chart is `delayed` or has a `snapshot` (public pages), and not shown to signed-out visitors.
5. Each account starts with $100,000. No margin model. Cap each order at 10,000 shares or 50 contracts, and each position at 50,000 shares or 200 contracts. A Reset clears positions and fills and restores the starting balance.
6. Positions may be held overnight. Store the futures contract (`data_contract`) on each fill and position. When the chart's quote reports a different contract for that symbol, close the old position at the last price recorded for the old contract and show the member a one-line notice.

Build:
- `frontend/core/paperTrading.ts`, pure and fully tested: applying a fill to a position (opening, adding with a new average price, reducing with realized P&L, closing, reversing through zero in one fill), P&L in dollars with the multiplier, the size caps, the fill-allowed check of rule 3, and the roll rule of rule 6. Tests in `frontend/tests/paperTrading.test.ts`, registered as `npm run test:paper-trading`.
- Tables in `frontend/core/db.ts`: `paper_accounts` (user_id primary key, starting_cash, cash, realized_pnl, created_at, reset_at, updated_at), `paper_positions` (user_id, symbol, qty signed, avg_price, multiplier, contract, opened_at, updated_at; primary key user_id and symbol), `paper_fills` (id, user_id, symbol, side, qty, price, multiplier, contract, quote_ts, realized_pnl, filled_at). Foreign keys to users with ON DELETE CASCADE. Index fills by user and time.
- Routes under `frontend/app/api/account/paper/`: `GET` returns the account, open positions and today's fills (ET day); `POST order` takes `{ symbol, side, qty }`, prices it on the server and applies it in a single transaction (`BEGIN IMMEDIATE`); `POST flatten` takes `{ symbol }` or `{ all: true }`; `POST reset`. All require a session, all writes validate CSRF, none are cached, and orders are rate-limited to a few per second per member.
- `frontend/hooks/usePaperAccount.ts`: loads the account, places orders, refreshes after each, and exposes the live unrealized P&L marked from the quote the chart already polls (do not open a second quote poll).
- `frontend/components/PaperTradeTicket.tsx`: quantity input (with sensible steps per instrument), Buy and Sell buttons, the position chip (side, size, average price, live P&L in bull or bear color), Flatten, and a PAPER badge. On a phone it is one Trade button that opens a bottom sheet. Show the refusal reason inline when an order is refused. Rendered from the chart's `viewActions`.
- On the chart: a dashed line at the position's average price with a right-axis tag showing the live P&L, in the same style as the existing level lines and tags, and a small marker at each fill's candle and price (buy below the candle, sell above it), with the fill details on hover or tap. Draw nothing when there is no position and no fills.
- `frontend/components/PaperTradeLog.tsx` under the chart on the Main Dashboard: today's fills (time ET, side, size, price), closed trades with realized P&L, and the day's totals (realized, unrealized, number of trades, win rate), plus Reset with a confirmation.
- Copy, once on the ticket and once in the log: "Paper trading. Simulated fills at the last price. No orders are sent anywhere."
- A help section in `frontend/content/help/platform/` for the dashboard or the chart (match the existing help files; if you add English, add the de, es, fr and it versions too).

Do not:
- Send orders anywhere, add a broker connection, or change the backend API repository.
- Trust any price from the browser.
- Restructure GammaTerminalChart beyond the small integration described above.
- Run `black`, prettier or any formatter across whole files.
- Commit generated files such as `frontend/AGENTS.md` or `frontend/CLAUDE.md` that the Next dev server writes.

Done means:
- `cd frontend && npm run typecheck` passes, `npx eslint` on every file you touched passes, `npm run test:paper-trading` passes, and the existing suite (`node --experimental-strip-types --test tests/*.test.ts`) still passes.
- On `/dashboard` with the dev server: buy 100 SPY during market hours and see the position line, the P&L tag and a fill marker; sell 200 and see the position reverse to short 100 with realized P&L booked; flatten; reload the page and see the same history; Reset clears it. Outside market hours an SPY order is refused with the reason shown. The ticket does not appear on SPX, NDX, the public gamma-levels pages, or when signed out.
- A short summary of what you built, how a fill is priced, and anything you had to decide that this prompt did not cover.

---
