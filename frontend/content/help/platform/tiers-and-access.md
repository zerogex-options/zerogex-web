# Tiers, Access & What Unlocks Where

*A clear map of which pages are public, Basic, and Pro — and what changes between tiers on each page.*

---

## The three tiers

ZeroGEX has three account tiers. They map to what data and which signals you see.

| Tier | Who it's for | What you get |
| --- | --- | --- |
| Public | Browsing, education | The landing site, education, guides, articles, free SPX / SPY / QQQ gamma levels pages (15-min delayed) |
| Basic | Active intraday traders | Dashboard, Live Bulletin, all Metrics, Strategy Builder, Live Options Quotes, all Basic Signals |
| Pro | Serious operators | Everything in Basic + all Advanced Signals + Composite Score + Backtesting + API access |

See the live breakdown — and a 7-day trial path — on the [Pricing](/pricing) page.

## What's gated where

### Public (no account needed)

- The marketing site (landing, About, Education Hub, Articles, Guides)
- Free SPX, SPY, and QQQ gamma levels pages — delayed about 15 minutes
- Help Center, FAQs, Quick Starts
- Privacy, Terms

### Basic tier

- **Dashboard** — full real-time metrics
- **Live Bulletin** — streaming feed of signal events
- **All Metrics pages** — Dealer Positioning, GEX Summary & Greeks, Flow Analysis, Smart Money, Max Pain, Technicals
- **Basic Signals** — Tape Flow Bias, Skew Delta, Vanna/Charm Flow, Dealer Delta Pressure, GEX Gradient, Positioning Trap
- **Strategy Builder** — full options pricing and P&L
- **Live Options Quotes** — the live chain

### Pro tier

- Everything in Basic, plus:
- **Composite Score** — the blended read across all signals
- **All Advanced Signals** — Volatility Expansion, EOD Pressure, Squeeze Setup, Trap Detection, 0DTE Position Imbalance, Gamma/VWAP Confluence, Range Break Imminence, Market Pressure Index
- **Backtesting** — historical signal backtests
- **API access** — the same data through `api.zerogex.io`

## What changes between tiers on the same page

A few pages exist for all tiers but behave differently depending on what you've got access to:

- The **Dashboard** is fully populated for Basic and Pro. Public users see a teaser view that links to the live page after sign-in.
- The **Signals** sidebar section is always visible — anyone can click a signal name. If you don't have access, the click routes to the [Pricing](/pricing) page so you can see what unlocks it.
- **Live Bulletin** badges and chips are tier-aware: items locked to Pro show a small lock chip for Basic users.

## How to upgrade or change tier

Account changes happen in two places:

1. **[Account](/account)** — see your current tier, current plan status, and the link to the billing portal.
2. **[Stripe Billing Portal](/account)** — accessed from the Account page. Change between Basic and Pro, switch monthly to annual, change payment method, view invoices.

For step-by-step, see [Billing & Stripe Portal](/help/platform/billing).

## When you're on a trial

If your account is on a free trial (Basic or Pro), the Account page shows a "Trial active — X days left" chip. When the trial ends, the subscription continues automatically at the rate you signed up at. To prevent that, cancel in the billing portal before the trial expires.

## What if you click something you don't have access to?

You're routed to the [Pricing](/pricing) page rather than blocked or shown an error. The landing page on Pricing shows you exactly which tier unlocks the page you tried to open.

## See also

- [Pricing](/pricing) — the live tier breakdown and trial path
- [Account Settings](/help/platform/account)
- [Billing & Stripe Portal](/help/platform/billing)
