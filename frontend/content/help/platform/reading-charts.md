# How to Read ZeroGEX Charts

*A shared visual vocabulary — colors, scales, hover behavior, legends, and the chart-specific notes for GEX profile, walls, and heatmaps.*

---

## The color language

ZeroGEX uses a small, consistent palette across every chart. Once you know it, every chart is a faster read.

- **Amber / warm orange** — accent color; used for warnings, brand emphasis, and the score-line track.
- **Green** — bullish, positive, long-direction, gain.
- **Red** — bearish, negative, short-direction, loss.
- **Blue / deep navy** — neutral structural info; reference lines, axes, baselines.
- **Coral / pink** — informational secondary; smart-money tags, special highlights.

Color **meaning** is stable across charts. The same green is "bullish" everywhere.

## The score line

Every signal score plots on the same **[-1, +1]** y-axis with the zero line in the middle. Background tinting near the trigger thresholds reminds you where the signal becomes actionable.

- The track color encodes magnitude.
- The sign encodes direction.
- A horizontal dashed line at the trigger threshold makes the cross visible.

For the deeper read, see [Reading the [-1, +1] Score Line](/help/platform/score-line).

## The GEX profile chart

A staple of the Dealer Positioning page.

- **X-axis** — strike price.
- **Y-axis** — dealer gamma in dollars, signed.
- **Vertical line** — current spot.
- **Where the curve crosses zero** — the gamma flip.
- **Tall positive bars** — call wall candidates.
- **Tall negative bars** — put wall candidates.

The chart auto-centers on spot. The default range is roughly ±5% from spot — wide enough to see the structural walls, narrow enough to keep the relevant strikes legible.

## The walls chart

Same data as the GEX profile but with the wall structure highlighted: the call wall, the put wall, max pain, and the gamma flip overlaid on the same axis. Use it when you want a single image that captures the entire structural read.

## The strike × DTE heatmap

A 2D heatmap on the Dealer Positioning page.

- **Rows** — strike (sorted around spot).
- **Columns** — DTE (0DTE, 1DTE, weekly, monthly).
- **Cell color** — dealer gamma at that strike/expiry combo.

Hottest cells are the strikes that matter for the nearest expiries. Watch the heatmap migrate intraday — if the brightest cell jumps strikes, the wall is moving.

## The candle chart

Standard OHLC candles with VWAP and the gamma overlays. The overlays are the ZeroGEX twist:

- The **gamma flip** line.
- The **call wall** and **put wall** lines.
- **Max pain** (where relevant).

The overlays let you read price action through the dealer-positioning lens without leaving the chart.

## Hover behavior

Most charts show a tooltip on hover with the precise values at the cursor's x-coordinate. The tooltip respects the chart's color language — the value chip color matches the series.

## Legends

Legends are clickable on most charts — click a series to hide it. Useful for isolating one signal or one greek.

## Sparklines

The signal cards on the dashboards use sparklines — small inline mini-charts of the score over the recent window. The sparkline's slope is more informative than its absolute level: a score at +0.4 trending up is a different read than +0.4 trending down.

## Light mode

Every chart works in both dark and light themes. The color **identities** stay the same; the **values** flip to maintain contrast. Green-bullish and red-bearish are stable across themes.

## Common mistakes

- **Reading the wrong axis.** Score charts are [-1, +1]; GEX charts are dollars. Don't compare across.
- **Treating a sparkline as a trade chart.** Sparklines are context, not entry signals.
- **Reading the heatmap from far away.** The whole point of the heatmap is the texture — zoom in if the cells are small.

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Reading the [-1, +1] Score Line](/help/platform/score-line)
