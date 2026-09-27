# Tiers, Access & What Unlocks Where

*A clear map of which pages are public, Basic, and Pro - and what changes between tiers on each page.*

---

## The three tiers

ZeroGEX has three account tiers. They map to what data and which signals you see.

| Tier | Who it's for | What you get |
| --- | --- | --- |
| Public | Browsing, education | The landing site, education, guides, articles, the Gamma Terminal and the free SPX / SPY / QQQ / NDX / ES / NQ gamma levels pages (about 15 minutes delayed), and the Receipts pages |
| Basic | Active intraday traders | Main Dashboard, My Dashboard, the live Gamma Terminal, Live Bulletin, all Metrics, Strategy Builder, Live Options Quotes, Premium Surface, all Basic Signals |
| Pro | Serious operators | Everything in Basic + Trade Bias + Composite Score + all Advanced Signals + TradeWorkz™ (bots and backtesting) + API access |

See the live breakdown on the [Pricing](/pricing) page. Basic monthly comes with a 7-day free trial; every other plan is covered by a 7-day money-back guarantee.

## What's gated where

### Public (no account needed)

- The marketing site (landing, About, Education Hub, Articles, Guides)
- The [Gamma Terminal](/chart) - a SPY view delayed about 15 minutes
- Free SPX, SPY, QQQ, NDX, ES, and NQ gamma levels pages - delayed about 15 minutes
- The Receipts pages - the daily forecast and its intraday cone, the forecast track record, the daily signals scorecard, and session replay
- The chart-platform Integrations pages - the TradingView and thinkorswim scripts are free
- Help Center, FAQs, Quick Starts
- Privacy, Terms

### Basic tier

- **Main Dashboard** - full real-time metrics
- **My Dashboard** - your own board, built from widgets
- **Gamma Terminal** - live, on every symbol
- **Live Bulletin** - a live, share-ready dealer-gamma snapshot
- **All Metrics pages** - Positioning (Dealer Positioning, GEX Summary, GEX Strike Profile, GEX Heatmap, Gamma Shift, Pair Comparison, Max Pain), Options Flow (Flow Analysis, Hedging Flow, Forced Flow, Smart Money, Market Tide), and Market Context (Volatility, Technicals, Spread Monitor)
- **Basic Signals** - Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Strategy Builder** - full options pricing and P&L
- **Live Options Quotes** - the live chain
- **Premium Surface** - option time value and breakeven distance across strikes and expirations

### Pro tier

- Everything in Basic, plus:
- **Trade Bias** - the full breakdown behind the dashboard's Trade Bias card
- **Composite Score** - the full page for the MSI, the 0-100 read of the market regime (Basic sees the MSI itself on the Main Dashboard)
- **All Advanced Signals** - Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **TradeWorkz™** (beta) - Bot Trading, Backtesting, and Pattern Insights
- **API access** - personal API keys for the same data through `api.zerogex.io`, which also run the auto-updating NinjaTrader and Sierra Chart indicators

## What changes between tiers on the same page

A few pages exist for all tiers but behave differently depending on what you've got access to:

- The **Gamma Terminal** is open to everyone. Visitors get a SPY view delayed about 15 minutes; Basic and Pro get it live, on every symbol.
- The **Main Dashboard** needs Basic. Signed out, opening it takes you to the free SPX gamma levels page instead. On Basic, the Pro-only Regime Triggers card shows an **Unlock with Pro** button.
- **My Dashboard** needs Basic. On Basic, Pro-only widgets show an upgrade card in their place.
- The **sidebar** follows your plan. Signed in, pages above your plan carry a lock badge (for example, 🔒 Pro), and clicking one opens [Pricing](/pricing). Signed out, or without a plan, the menu lists only what you can open.

## How to upgrade or change tier

Account changes happen in two places:

1. **[Account](/account)** - see your current tier, current plan status, and the link to the billing portal.
2. **[Stripe Billing Portal](/account)** - accessed from the Account page. Change between Basic and Pro, switch between monthly, quarterly and annual billing, change payment method, view invoices.

For step-by-step, see [Billing & Stripe Portal](/help/platform/billing).

## When you're on a trial

The 7-day free trial comes with Basic monthly only (one per account). About 48 hours before it ends, we email you a reminder with the amount that will be charged. When the trial ends, the subscription continues automatically at the rate you signed up at. To prevent that, cancel before the trial expires - in the billing portal, or with **Cancel subscription** on the Account page - and you won't be charged.

Moving to Pro, or to a quarterly or annual plan, during the trial ends the trial and bills the new plan that day; the [Pricing](/pricing) page shows the exact amount and asks you to confirm, and that payment is covered by the 7-day money-back guarantee.

## What if you click something you don't have access to?

From the menu, a locked page takes you to [Pricing](/pricing) rather than to an error. If you open a gated page directly - from a bookmark or a shared link - you'll see an unlock screen that names the plan that includes it, with a button to get that plan. Signed out, you'll be asked to sign in first.

## See also

- [Pricing](/pricing) - the live tier breakdown and plan options
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
