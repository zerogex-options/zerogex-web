# Technicals

*The intraday price picture the option book sits on - VWAP, the opening range, volume spikes, and momentum divergence, on one chart with the flip and the walls.*

---

## What this page shows

The Technicals page is the **price-first read** of the active symbol. It is the only Metrics page that reads price rather than the option chain - VWAP, the opening range, unusual volume, and momentum checked against the options flow - and it draws all of it against the gamma flip, the walls, and the pin.

It's the page you open when you need to confirm what dealers' positioning is implying with what price is actually doing.

## The session read

The row across the top reads the session in one line: **Price**, **VWAP** (and how far price sits from it), where price is in the **Opening range**, **Dealer gamma** (long or short gamma, and which side of the flip price is on), and the **Walls**, each with its distance from price.

## The session chart

Five-minute candles for the session, times in ET, with:

- **VWAP** - the dashed line through the candles.
- **The opening range** - the shaded band between the high and low of 09:30-09:59 ET. Its lighter top and bottom fifths are where the status reads near the high or near the low.
- **The flip, the walls, and the pin** - the same levels as the Key Levels strip and the Gamma Terminal. A level too far from the session's prices to draw is flagged with an arrow at the edge of the price axis.
- **Volume** - underneath. Bars at least one standard deviation above their own recent average are colored by whether buying (green) or selling (red) led; the rest are gray.
- **Numbered markers** - divergences and opening-range breaks, numbered in time order to match the event list.

The buttons above the chart turn each layer on or off, and this browser remembers your choice. Hover over a candle, or tap it on a phone, for its open, high, low, close, VWAP, and volume.

## Opening range

The high and low of the first 30 minutes of the regular session (09:30-09:59 ET), held flat for the rest of the day, with each one's distance from price, the range's size, and its **status**:

- **Above the range** / **Below the range** - the latest five-minute close is past the high or the low.
- **Near the high** / **Near the low** - inside the range, in its top or bottom fifth.
- **Inside** - the middle three-fifths.

"Near" is measured against the range itself, so it scales with the day rather than with the price. **Where price sits** draws the same zones as a bar.

The **breakout log** lists what price did around the range: tests of the high or low (a wick through, then a close back inside), breaks (a close beyond it), the furthest point reached in multiples of the range, and closes back inside, with how long the break lasted.

## Events

One list, newest first:

- **Bearish divergence** - price up over five minutes while the options flow leaned to puts. **Bullish divergence** - price down while it leaned to calls.
- **Weak rally** / **Weak selloff** - price moved while the up and down volume leaned the other way.
- **Volume spike** - a five-minute bar at least one standard deviation above its recent average, with how far above and whether buying or selling led.
- **Opening-range events** from the breakout log.

Bars where price and the options flow agree (confirmations) are left out, because they are the ordinary case. The five-minute change is in the symbol's own price units - points on ES and NQ - not a percent.

## How to read it

Three patterns, all visible on the one chart:

1. **Price between the call wall and put wall** in positive gamma ⇒ hedging leans against moves toward either wall, a mean-reversion setting. The candles confirm the range; the levels suggest why.
2. **Price breaking below the put wall** in negative gamma with IV expanding ⇒ trend continuation *becomes more likely*. The candles show the break; the regime explains the modeled amplification.
3. **VWAP and the gamma flip stacking at the same level** ⇒ a structural pivot worth watching. Reactions there *can* be higher-conviction than at either alone.

For the rest of the gamma picture beside the candles - the strike ladders, the ribbons, and rewind - use the Gamma Terminal; see [How to Read ZeroGEX Charts](/help/platform/reading-charts).

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [How to Read ZeroGEX Charts](/help/platform/reading-charts)
- [What Is a Gamma Flip?](/education/how-to-read-a-gamma-flip)
