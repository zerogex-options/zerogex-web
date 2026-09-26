# Live Options Quotes

*Follow one option contract through the session. Picking the contract, reading the bid/mid/ask volume bars, and the stats above the chart.*

---

## What this page shows

The Live Options Quotes page follows **one option contract** on the active symbol through the trading session: its last trade price, and each minute's volume split by where it traded - at the ask, at the mid, or at the bid. It refreshes every 30 seconds.

## Picking a contract

Three menus above the chart choose the contract:

- **Expiration** - the expirations trading this session, today or later. Defaults to today's (0DTE) if there is one, otherwise the nearest.
- **Strike** - defaults to the strike closest to the live price.
- **Type** - **Call** or **Put**. Defaults to Call.

The contract's name appears under the menus - e.g. `SPY 600 C 10/02/2026` - with its days to expiration.

## The stats above the chart

For the session shown:

- **Vol** - contracts traded so far.
- **OI** - open interest.
- **Avg** - the average trade price, weighted by volume.
- **Prem** - premium traded: Vol × Avg × 100.
- **IV**, **Δ** (delta) and **Θ** (theta) - from the latest quote.

## The chart

- **Bars** (left axis) - volume per minute, stacked by where it traded: **Ask Vol**, **Mid Vol** and **Bid Vol**.
- **Line** (right axis) - the **Last** trade price.

The time axis spans the session, 9:30 AM to 4:15 PM ET. Before today's session opens, the page shows the most recent one. On a phone the bars are grouped into 5-minute bins so they stay readable.

Hover a bar for the time, the last price, and how many contracts traded at the bid, mid and ask.

## How to read it

Three patterns:

1. **Who is crossing the spread?** Ask-side volume is trades that printed at or near the ask - buyers paying up to get filled. Bid-side volume is sellers hitting the bid. Mid volume is trades in between.
2. **Does the price agree?** Ask-side volume with the Last line rising is buyers in control of this contract. Heavy ask-side volume while the price goes nowhere is worth a closer look.
3. **How big is today next to OI?** When Vol is large relative to OI, today's trading is big next to the positions already open - new positioning may be building.

## ES and NQ

ES and NQ have no option chain of their own - their levels are derived from SPX and NDX options. This page isn't available for them; switch to SPX or NDX.

## Tier note

Live Options Quotes is available to Basic and Pro.

## See also

- [Strategy Builder](/help/platform/options-calculator)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Flow Analysis](/help/platform/flow-analysis)
