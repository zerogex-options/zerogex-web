# Navigating the App

*The sidebar, the header, the symbol picker, the timeframe selector, and theme toggles.*

---

## The sidebar

The left sidebar is the main way you move around. It's grouped:

- **Main** - Main Dashboard, My Dashboard, Gamma Terminal, Live Bulletin
- **Signals** - Trade Bias, Composite Score, the Basic Signal Dashboard and the Advanced Signal Dashboard (each expandable into the individual signal pages)
- **TradeWorkz™** - Bot Trading, Backtesting, Pattern Insights
- **Metrics** - Positioning, Options Flow, and Market Context, each expandable into its pages
- **Strategy Tools** - Strategy Builder, Live Options Quotes, Premium Surface
- **Receipts** - the one-day and intraday forecasts, the all-time forecast record, the one-day signals scorecard, and session replay
- **Education** - Hub, Guides, Articles, and Help (each expandable)
- **More** - About, Integrations, API Specs, Support, Account

Each group collapses and expands. Click the group header to toggle it. Pages still in development carry a **Beta** pill.

### Favorites

Hover a page in the sidebar and click the pin icon next to it to add it to **Favorites**, a group at the top of the sidebar for the pages you use most. Click the pin again to remove it. Favorites are saved in your browser.

### Showing and hiding the sidebar

The whole sidebar can be hidden. Hover the right edge of the sidebar and a chevron tab appears - click it to hide. Click the small chevron tab on the left edge to bring it back. The preference is remembered across sessions.

## The header

The header floats at the top of every analytics page and shows:

- The logo and a link back home
- The symbol picker and a live price for the active symbol, with its change on the day
- A session badge - Pre-market, Market Open, After Hours, Closed, or Futures while SPX or NDX is showing its future overnight. Click it for a countdown to the open or the close.
- Theme toggle (sun / moon) and the palette menu
- Clocks for New York, London, and Tokyo, an options calendar, and top headlines
- A camera button that saves a PNG snapshot of the page you're on
- The language menu, search, and your profile menu (Account, Upgrade, Logout)

You can collapse the header to recover vertical room - the preference syncs to the sidebar's compact summary card.

## The symbol picker

ZeroGEX covers **SPY**, **SPX**, **QQQ**, and **NDX**, plus the **ES** and **NQ** futures. The symbol picker is in the header. Choosing a symbol updates every page on the platform - the dashboard, signals, charts - to that symbol, and your pick is remembered in that browser. ES and NQ are read off the SPX and NDX options books, so the few pages that list individual option contracts don't offer them.

## The timeframe selector

The price charts - the Gamma Terminal, the Gamma Chart on the Main Dashboard, and a few others - have a timeframe selector: 1 min / 5 min / 15 min / 1 hr / 1 day. It controls the rolling window used for the chart, not the underlying signal logic. The signal score itself is computed continuously.

## Theme

ZeroGEX ships in dark and light. The default is dark. The sun / moon toggle in the header switches between them, and the palette menu next to it offers a set of color palettes. Signed in, your choice is saved to your account and follows you to other devices; signed out, it's stored in the browser.

## Tier-aware menu items

Signed in, pages your plan doesn't include show a lock badge (🔒 Basic or 🔒 Pro); clicking one takes you to [Pricing](/pricing) rather than to the gated page. Signed out, or without a plan, the menu lists only the pages you can open. Admin-only entries are hidden entirely.

## Quick tour of the page anatomy

The Metrics pages share one header, so once you've read one, the rest are a quick scan:

1. **Eyebrow** - the menu subgroup the page is filed under: Positioning, Options Flow, or Market Context.
2. **Title** - the page name, matching its menu label, with a Beta pill if the page is in beta.
3. **Info icon** - hover it for the long read: what the number is, how it's built, and how to use it.
4. **Standfirst** - a one- or two-sentence summary under the title.
5. **Filters** - the page's own controls, on the right.

The individual signal pages close with a **How it's built** section - a plain-English walk-through of the math.

## See also

- [How to Read ZeroGEX Charts](/help/platform/reading-charts)
- [Reading the Dashboard](/help/platform/dashboard)
- [Using the Live Bulletin](/help/platform/live-bulletin)
