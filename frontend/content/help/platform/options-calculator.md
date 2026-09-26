# Strategy Builder

*Price a single- or multi-leg options strategy at live quotes. Picking a strategy, adjusting its legs, and reading the profit/loss-at-expiration chart.*

---

## What the Strategy Builder is

The Strategy Builder is the **per-trade modeling tool**. You pick a strategy and adjust its legs, the page prices it at live quotes, and you read its profit or loss at expiration across a range of prices.

It's where you go after the dashboard tells you "the structure is bullish" and you need to pick the actual instrument.

## Building a strategy

1. **Pick a symbol** (SPY, SPX, QQQ, NDX) with the symbol picker.
2. **Pick a strategy** from the **Strategy** menu - over 40 presets, from single calls and puts through verticals, straddles, strangles, iron condors, butterflies, ratios, backspreads, calendars, diagonals, collars and synthetics. Each leg starts on a sensible default strike and expiration.
3. **Adjust the legs** - every option leg has its own **Exp** and **Strike** menu, filled from the live chain.
4. **Set Contracts** - the number of contracts, applied to every leg; a ratio leg keeps its ratio.

The leg prices, the total, the chart and the breakevens update on every change.

ES and NQ have no option chain of their own, so the Strategy Builder isn't available for them - switch to SPX or NDX.

## How legs are priced

Each option leg is priced at its **live quote**, refreshed every few seconds: a long leg at the **ask**, a short leg at the **bid** - what you would actually pay or collect crossing the spread. Each leg shows its contract, that price, and which side it used. Stock legs (in covered calls, collars, conversions and the like) are 100 shares per contract, entered at the current spot.

**Total position** adds it all up across every leg and contract: **debit** is what the structure costs to put on, **credit** is what it collects.

## The P&L chart

**Profit / Loss at Expiration** shows what the structure is worth on expiration day, net of what it cost or collected to open:

- Underlying price on the x-axis - by default ±5% around spot. The **+** and **-** buttons zoom in and out, **RESET** goes back to the default, and the **%** / **$** toggle labels each gridline as a percent or dollar move from spot.
- Dollar P&L on the y-axis, for the number of contracts you set.
- A dashed line at the current spot, and a **BE** line at each breakeven in view.

Hover anywhere on the curve for the P&L at that price and its distance from spot.

## Calendars and diagonals

When the legs expire on different dates, the chart still values every leg at its intrinsic value, as if they all expired together. That understates what the far-dated leg is still worth, so the page flags it - read the curve as a rough guide only.

## What it doesn't do

The Strategy Builder is a **pricing tool**, not a trade-routing tool. It does not connect to your broker. You take the structure and put it on yourself.

It also shows only the payoff at expiration - there are no greeks and no curves for dates before expiry.

## Tier note

The Strategy Builder is available to Basic and Pro.

## See also

- [Live Options Quotes](/help/platform/option-contracts)
- [Backtesting](/help/platform/backtesting)
