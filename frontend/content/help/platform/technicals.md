# Technicals

*The intraday technical snapshot — price, candles, volatility gauges, and how the levels overlay the GEX walls.*

---

## What this page shows

The Technicals page is the **price-first read** of the active symbol. It is the only page that does **not** lead with options-derived numbers — it leads with price action, volatility, and the standard technical context.

It's the page you open when you need to confirm what dealers' positioning is implying with what price is actually doing.

## The candle chart

The headline chart. Standard OHLC candles with the timeframe selector (1m / 5m / 15m / 1h / 1d). Overlays:

- **VWAP** (anchored to session open).
- **The gamma flip** as a horizontal line.
- **The call wall and put wall** as horizontal lines.
- **Max pain** as a horizontal line (where relevant).

The point of the overlays is to let you read the price action through the dealer-positioning lens without having to flip tabs.

## The volatility gauges

Three gauges:

- **Implied Volatility** — current ATM IV with the rank versus the last 60 days.
- **Realized Volatility** — short-window realized vol with a longer-window baseline.
- **IV / RV ratio** — when ratio is meaningfully above 1, vol is rich (sell premium); below, vol is cheap (buy premium).

## The session strip

A small strip showing:

- The current session (Pre-market, Open, After-hours, Closed)
- The session open price
- The session high and low
- The distance from spot to VWAP
- Time to next major session event (open, lunch, close)

## How to read it

Three patterns:

1. **Price stuck between the call wall and put wall** in positive gamma ⇒ mean-revert intra-range. The technicals confirm the range; the dealer page tells you why.
2. **Price breaking below the put wall** in negative gamma with IV expanding ⇒ trend continuation. The technicals show the break; the dealer page explains the amplification.
3. **VWAP and the gamma flip stacking at the same level** ⇒ structural pivot. Reactions at that level are higher-conviction than at either alone.

## The intraday-tools view

The intraday-tools page is a paired layout — the candle chart on top, a compressed dealer-positioning header underneath — for traders who want both views side-by-side.

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
