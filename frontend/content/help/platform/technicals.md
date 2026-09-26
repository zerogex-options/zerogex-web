# Technicals

*The intraday price picture the option book sits on - VWAP, the opening range, volume spikes, and momentum divergence.*

---

## What this page shows

The Technicals page is the **price-first read** of the active symbol. It is the only Metrics page that reads price rather than the option chain - VWAP, the opening range, unusual volume, and momentum checked against the options flow.

It's the page you open when you need to confirm what dealers' positioning is implying with what price is actually doing.

## VWAP Analysis

Four cards - **Current Price**, **VWAP**, **Deviation** (how far price sits from VWAP, in percent), and **Position** (above or below it) - and a chart of price against VWAP through the session. The shaded channel between the two widens as price pulls away from VWAP: green when price is above, red when below.

## Opening Range Breakout

The opening range is the high and low of the first 30 minutes of the regular session (09:30-09:59 ET), held flat for the rest of the day. The cards show **ORB High** and **ORB Low** with the distance to each, plus the **ORB Range**; **Position Within Range** shows where price sits between them, and the **ORB breakout map** charts price against both lines.

## Unusual Volume Spikes

The 5-minute bars that traded at least one standard deviation above their own recent average - tagged Moderate, High, or Extreme Spike - drawn against the underlying price. Each bar is shaded from red (all down-volume) through neutral to green (all up-volume). Hover a bar for its volume, its multiple of the average, and the buying-pressure split.

## Momentum Divergence Signals

A running list, newest first, that checks each 5-minute price move against the options flow and the up/down volume behind it: **Bearish Divergence** (price up while puts are bought), **Bullish Divergence** (price down while calls are bought), **Bullish** or **Bearish Confirmation** when price and options flow agree, and **Weak Rally** or **Weak Selloff** when volume leans against the move.

## How to read it

Three patterns - the walls and the flip come from Dealer Positioning or the Gamma Terminal:

1. **Price stuck between the call wall and put wall** in positive gamma ⇒ *tends toward* mean-reversion intra-range. The technicals confirm the range; the dealer page suggests why.
2. **Price breaking below the put wall** in negative gamma with IV expanding ⇒ trend continuation *becomes more likely*. The technicals show the break; the dealer page explains the modeled amplification.
3. **VWAP and the gamma flip stacking at the same level** ⇒ a structural pivot worth watching. Reactions there *can* be higher-conviction than at either alone.

To see the flip, the walls, max pain, and VWAP drawn on the candles themselves, use the Gamma Terminal chart - see [How to Read ZeroGEX Charts](/help/platform/reading-charts).

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [How to Read ZeroGEX Charts](/help/platform/reading-charts)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
