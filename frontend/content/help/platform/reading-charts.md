# How to Read ZeroGEX Charts

*A shared visual vocabulary - colors, scales, hover behavior, legends, and the chart-specific notes for the gamma profile, open interest, the heatmaps, and the Gamma Chart.*

---

## The color language

ZeroGEX uses a small, consistent palette across every chart. Once you know it, every chart is a faster read.

- **Amber / warm orange** - accent color; used for warnings, brand emphasis, and the score-line track.
- **Green** - bullish, positive, long-direction, gain.
- **Red** - bearish, negative, short-direction, loss.
- **Blue / deep navy** - neutral structural info; reference lines, axes, baselines.
- **Coral / pink** - informational secondary; session badges such as Pre-market, After hours, and Futures.

Color **meaning** is stable across charts. The same green is "bullish" everywhere. Surfaces that shade dealer gamma by sign use their own ramps, named in each chart's legend: the GEX heatmap over time runs from blue (negative) through white to orange (positive), and the Gamma Chart's ribbons are gold for long gamma and violet for short.

### The key levels

On the Gamma Chart and the other price charts that draw them, four levels carry their own color, held apart from the bullish/bearish language above so a level never reads as a direction:

- **Azure** - the **gamma flip**. It's the boundary between the long-gamma and short-gamma zones, so it is deliberately neither green nor red.
- **Gold** - **max pain**.
- **Teal** - the **pin strike**.
- **Violet** - the **GEX king**, the dominant gamma node.

The **call wall** and **put wall** take the directional colors. On the Gamma Chart they're colored by what the level does - the call wall red (resistance above), the put wall green (support below). Charts that split calls from puts, like the per-strike bars on Dealer Positioning, keep calls green and puts red. The live **last-traded price** takes each theme's hot accent - always a warm color, never the azure of the flip.

The Gamma Exposure by Strike chart on Dealer Positioning labels its reference lines in text (Spot, Flip, Call Wall, Put Wall) and draws its flip in amber, so go by the label there.

## The score line

Every Basic and Advanced signal score sits on the same **−100 to +100** scale - the [-1, +1] score, scaled by 100 - with zero in the middle.

- The sign encodes direction.
- The distance from zero encodes conviction.
- Advanced signal cards print where the signal activates ("activates at ±N").
- On a signal's event timeline, the score is the amber line, zero is the faint horizontal rule, and triangles mark direction flips - green toward bullish, red toward bearish.

For the deeper read, see [Reading the -100 to +100 Score Line](/help/platform/score-line).

## The Gamma Exposure by Strike chart

A staple of the Dealer Positioning page.

- **X-axis** - strike price.
- **Bars** - modeled dealer gamma per strike in dollars, signed by the call-positive / put-negative convention: calls up, puts down, each bar stacked by expiration with the nearest boldest.
- **GEX Profile curve** - the modeled dealer gamma profile across prices, on its own axis.
- **Where the curve crosses zero** - the gamma flip.
- **Tall call bars** - call-side gamma stacks (call wall candidates).
- **Tall put bars** - put-side gamma stacks (put wall candidates).
- **Reference lines** - spot, the flip, and the call and put walls.

The chart opens zoomed out across every strike loaded. The X buttons zoom the strikes, the Y buttons magnify the gamma scale to inspect small bars, and the reset button restores both.

## The open interest chart

Open Interest by Strike, also on Dealer Positioning: open contracts at each strike, calls above the axis and puts below, stacked by expiration like the gamma bars. Switch between **OI** (contract count) and **Notional** (strike × 100 × OI); a dotted line marks spot. Read it next to the gamma chart - open interest shows where the contracts are, gamma shows how much hedging they imply.

## The strike × DTE heatmap

GEX Heatmap · Strike × DTE, on the Dealer Positioning page.

- **Rows** - the strikes carrying the most gamma over the next week, highest strike on top.
- **Columns** - days to expiration, out to 7DTE.
- **Cell color** - net dealer gamma at that strike/expiry combo: green positive, red negative, deeper for larger.
- **Crown** - the GEX king, the strike with the largest net dealer gamma across those expirations.

Hottest cells are the strikes that matter for the nearest expiries. Watch the heatmap migrate intraday - if the brightest cell jumps strikes, the wall is moving.

## The GEX heatmap over time

GEX Heatmap Timeseries, on the GEX Heatmap page and on Dealer Positioning: strikes up the side, time across, each column the net dealer gamma at that moment - orange positive, blue negative, near-white around zero - with the candles and the gamma flip drawn on top. Dashed stretches of the flip line mark cycles where the flip was only found by widening the search far from spot; treat those as marginal.

## The Gamma Chart

The price chart on the Gamma Terminal and the ZeroGEX Gamma Chart on the Main Dashboard are the same chart: the underlying's price with the dealer-gamma structure drawn in.

- **Symbol and timeframe** - SPY, QQQ, SPX, NDX, ES, or NQ, on 1m, 5m, 15m, 1H, or 1D bars.
- **Price style** - Candle, Line, or Area, over a volume pane that shows Up/Down volume or the session's Cumulative net.
- **Expiry** - on the live chart, scopes the gamma levels and the rail to the expirations you pick; **All** is the whole chain.

The overlays are the ZeroGEX twist, each switched by a pill in the toolbar above the chart (under **Layers** on a phone):

- **Gamma Levels** - the gamma flip line (long dashes, azure, tagged `FLIP` at the left edge) and the call wall and put wall lines.
- **Gamma Rail** - dealer gamma by strike, drawn level with the prices on the tape, as a smoothed silhouette or as Net, Split, or Combined bars. On the Gamma Terminal it sits in the panel beside the chart, where you can swap it for two strike-aligned Net-GEX ladders.
- **Max Pain** and **Pin Strike** - their own lines in gold and teal; the pin line carries its strength, as in `PIN · STRONG`.
- **VWAP**, and **Regime** shading - the long-gamma and short-gamma zones on either side of the flip.
- Off until you turn them on: **GEX King**, and on the live chart **Expected Range**, **Ribbons** (per-strike gamma through time, behind the tape), and **Bar Timer**.

On SPY and QQQ, a row just above the live chart lists the previous session's high, low and close and today's pre-market high and low: `PDH`, `PDL`, `PDC`, `PMH`, `PML`. The eye at the end of the row, or the **PD/PM Levels** pill, draws them on the chart as gray lines with outlined price tags, long dashes for the prior day and dots for the pre-market. They're off until you turn them on. SPX and NDX have no pre-market, and ES and NQ trade almost around the clock, so the row doesn't appear on those four.

The finely-dotted line in the theme's hot accent is the **last traded price**, not a gamma level - it's listed as "Last" in the legend under the chart.

The overlays let you read price action through the dealer-positioning lens without leaving the chart. Without a Basic or Pro plan, the Gamma Terminal shows a snapshot delayed about 15 minutes, with the symbol and timeframe fixed; members get it live.

### When there's no flip line

A level is only drawn while it sits inside the price range on screen, so on a high-priced underlying whose flip is far from spot - NDX especially - the flip line can be off the visible scale. The chart says so rather than leaving you to guess: a chip at the plot edge reads `FLIP ↓ 22,600.00` with the direction and the price, and the right-hand price axis carries a matching arrowed tag. Zoom the price axis out (the **Price −** button, Shift+scroll, or drag the right-hand price scale) to bring the line itself into view.

Occasionally no flip can be resolved at all. The resolver only publishes a zero crossing that sits close enough to spot to trade and is backed by real open interest, so when spot is deep inside one gamma regime, or the chain is thin or one-sided (extended hours, an implied-volatility spike), nothing clears that bar. Then the chip reads `FLIP UNAVAILABLE` with an amber `?` beside it - hover the mark for the reason, and on ES / NQ for which chain the miss happened on - and the "Dealer Gamma @ Spot" badge shows a plain `—`. Nothing is drawn rather than a level we don't trust; it normally resolves again on a later snapshot.

A blank flip means something different when the **Expiry** filter holds a subset of the chain. The chart then draws the levels for the expirations you picked, and their flip is rebuilt from those strikes alone - but a subset is often one-signed (an afternoon 0DTE book that is negative-gamma at every strike never crosses zero), so there is no crossing to draw. The chip says so directly: `NO FLIP IN SELECTED EXPIRIES`. Unlike the case above, that one will *not* resolve on a later snapshot, because nothing is missing. Set **Expiry** back to **All** to see the whole-chain flip - the same level the Dealer Positioning page reports, which reads the full chain and so keeps showing a number while the chart is scoped.

## Hover behavior

Most charts show a tooltip on hover with the precise values at the cursor's x-coordinate. The tooltip respects the chart's color language - the value chip color matches the series.

## Legends

Legends name each series and its color - they're a key, not a switch. On the Gamma Chart, the overlay pills above the chart are what turn layers on and off.

## Sparklines

The signal cards on the dashboards use sparklines - small inline mini-charts of the score over the recent window. The sparkline's slope is more informative than its absolute level: a score at +40 trending up is a different read than +40 trending down.

## Light mode

Every chart works in both dark and light themes. The color **identities** stay the same; the **values** flip to maintain contrast. Green-bullish and red-bearish are stable across themes.

## Common mistakes

- **Reading the wrong axis.** Score charts run −100 to +100; GEX charts are dollars. Don't compare across.
- **Treating a sparkline as a trade chart.** Sparklines are context, not entry signals.
- **Reading the heatmap from far away.** The whole point of the heatmap is the texture - zoom in if the cells are small.

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Reading the -100 to +100 Score Line](/help/platform/score-line)
