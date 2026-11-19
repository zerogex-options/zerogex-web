# Live Options Quotes

*Follow one option contract through the session. Picking the contract, reading the bought and sold volume bars, and the stats above the chart.*

---

## What this page shows

The Live Options Quotes page follows **one option contract** on the active symbol through the trading session: its last trade price, and each minute's volume split by side - bought, sold, or no side to go on. It refreshes every 30 seconds.

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

- **Bars** (left axis) - volume per minute, stacked by side: **Bought**, **No side** and **Sold**.
- **Line** (right axis) - the **Last** trade price.

The side comes from the **tick test**, which compares each trade's price with the contract's trade before it, not with the bid and ask. Higher counts as bought, lower as sold, and an unchanged price keeps the side of the last change. **No side** is volume the test can't sign: a trade with no earlier one to compare against, an unchanged price before any change has set a side, and everything in the 9:30 AM opening minute.

The time axis spans the session, 9:30 AM to 4:15 PM ET. Before today's session opens, the page shows the most recent one. On a phone the bars are grouped into 5-minute bins so they stay readable.

Hover a bar for the time, the last price, and how many of its contracts counted as sold, bought or no side.

## How to read it

Three patterns:

1. **Who is pushing the price?** Bought volume is buyers paying up to get filled: trades that moved the price up, or held it after a rise. Sold volume is sellers taking less: trades that moved it down, or held it after a drop. No-side volume is trades the test couldn't sign.
2. **How much volume is behind the move?** The side comes from this contract's own price changes, so bought volume and a rising Last line usually go together; their agreement is not a second, independent read. What the bars add is how many contracts traded on each move: a rise on a handful of contracts says less than one with heavy bought volume behind it.
3. **How big is today next to OI?** When Vol is large relative to OI, today's trading is big next to the positions already open - new positioning may be building.

## ES and NQ

ES and NQ have no option chain of their own - their levels are derived from SPX and NDX options. This page isn't available for them; switch to SPX or NDX.

## Tier note

Live Options Quotes is available to Basic and Pro.

## See also

- [Strategy Builder](/help/platform/options-calculator)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Flow Analysis](/help/platform/flow-analysis)
