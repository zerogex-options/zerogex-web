# Navigating the App

*The sidebar, the symbol picker, the timeframe selector, theme toggles, and the keyboard shortcuts that speed things up.*

---

## The sidebar

The left sidebar is the main way you move around. It's grouped:

- **Main** — Dashboard, Live Bulletin
- **Signals** — Composite Score, Signaled Trades, the Basic Signal Dashboard and the Advanced Signal Dashboard (each expandable into the individual signal pages)
- **Metrics** — Dealer Positioning, GEX Summary, Flow Analysis, Smart Money, Max Pain, Technicals
- **Strategy Tools** — Strategy Builder, Live Options Quotes, Backtesting
- **Education** — Hub, Help, Guides (expandable), Articles (expandable)
- **More** — About, API Specs, Account

Each group collapses and expands. Click the group header to toggle it.

### Showing and hiding the sidebar

The whole sidebar can be hidden. Hover the right edge of the sidebar and a chevron tab appears — click it to hide. Click the small chevron tab on the left edge to bring it back. The preference is remembered across sessions.

## The header

The header floats at the top of every analytics page and shows:

- The logo and a link back home
- The active symbol and a live price for it
- A session badge — Pre-market, Open, After-Hours, or Closed
- Theme toggle (sun / moon)

You can collapse the header to recover vertical room — the preference syncs to the sidebar's compact summary card.

## The symbol picker

ZeroGEX covers **SPY**, **SPX**, and **QQQ**. The symbol picker is in the header. Choosing a symbol updates every page on the platform — dashboard tiles, signals, charts — to that symbol.

## The timeframe selector

Most chart-based pages have a timeframe selector — 1 min / 5 min / 15 min / 1 hr / 1 day. It controls the rolling window used for the chart, not the underlying signal logic. The signal score itself is computed continuously.

## Theme

ZeroGEX ships in dark and light. The default is dark. The toggle is in the header. The preference is stored per-browser.

## Keyboard shortcuts

A small set of shortcuts speed up daily use:

- `/` — focus the symbol picker
- `t` — toggle theme
- `b` — toggle the sidebar
- `?` — show the shortcut palette

The shortcuts intentionally don't override the browser's defaults (Cmd/Ctrl + anything).

## The Live Bulletin button

The Live Bulletin link in the sidebar shows a small badge when there are unread events since you last opened it. Click through and the badge clears.

## Tier-aware menu items

If you don't have access to a page, the menu item routes you to [Pricing](/pricing) on click rather than to the gated page. Admin-only entries are hidden entirely.

## Quick tour of the page anatomy

Every analytics page on ZeroGEX has the same anatomy:

1. **Title row** — the page name and a short subtitle.
2. **Hero metric or chart** — the headline read.
3. **Context strip** — regime label, trade-bias chip, fired/idle state.
4. **Supporting panels** — the inputs that drive the headline.
5. **"How it's built"** — a plain-English explanation of the math.

Once you've read one page in this anatomy, every other page is a quick scan.

## See also

- [How to Read ZeroGEX Charts](/help/platform/reading-charts)
- [Reading the Dashboard](/help/platform/dashboard)
- [Using the Live Bulletin](/help/platform/live-bulletin)
