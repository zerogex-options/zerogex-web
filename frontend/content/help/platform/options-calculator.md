# Strategy Builder

*Build any single- or multi-leg options strategy. How the calculator prices, how greeks are computed, and how to read the P&L scenarios.*

---

## What the Strategy Builder is

The Strategy Builder is the **per-trade modeling tool**. You build a strategy leg by leg, the page prices it live, and you read the P&L surface and the aggregate greeks.

It's where you go after the dashboard tells you "the structure is bullish" and you need to pick the actual instrument.

## Building a strategy

1. **Pick a symbol** (SPY, SPX, QQQ).
2. **Add a leg** — buy or sell, call or put, strike, expiration. The chain is live.
3. **Repeat** for multi-leg structures (verticals, condors, calendars, ratios, straddles, strangles).
4. **Set the spot for analysis** — defaults to live spot but you can scenario-test any price.

The aggregate price, the breakevens, and the greeks update on every change.

## The pricing model

The Builder uses **Black-Scholes** with the live implied volatility surface for each leg. The IV surface is pulled from our data pipeline — same surface that powers the chain on the [Live Options Quotes](/help/platform/option-contracts) page.

For American-style exercise considerations (relevant for ETFs like SPY and QQQ), the model approximates with an early-exercise premium on deep ITM legs near expiry. SPX is European-exercise so no adjustment is applied.

## The greeks panel

For each leg and for the aggregate:

- **Delta** — directional exposure
- **Gamma** — how delta moves with spot
- **Theta** — time decay (per day)
- **Vega** — IV sensitivity (per 1% change)
- **Charm** — delta decay (per day)

Aggregate greeks let you read a multi-leg structure in one glance — e.g., a long calendar is net long vega, short theta in the front month, long theta in the back.

## The P&L surface

The 2D P&L chart shows:

- Spot price on the x-axis.
- P&L value on the y-axis.
- Multiple curves: at expiration (the payoff), and at various dates between now and expiry.

You can also see the breakevens highlighted on the x-axis.

## Scenario testing

The scenario panel lets you sweep two variables at once — typically spot and IV — and see the resulting P&L grid. Useful for:

- A long-vol structure: how much do you make on a 2-vol shock?
- A pin trade: how much can you lose if spot diverges from max pain by 1%?

## What it doesn't do

The Strategy Builder is a **pricing tool**, not a trade-routing tool. It does not connect to your broker. You take the structure and put it on yourself.

## Tier note

The Strategy Builder is available to Basic and Pro.

## See also

- [Live Options Quotes](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
