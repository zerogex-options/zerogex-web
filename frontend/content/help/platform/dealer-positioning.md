# Dealer Positioning

*The full GEX surface — net GEX at spot, the gamma flip, call wall and put wall, and how to read the term structure.*

---

## What this page shows

The Dealer Positioning page is the **structural map** of the options book. Every chart and tile on it answers a single question: where are dealers positioned, and what will they have to do as price moves?

It is the most important page for understanding context — even if the trade itself is taken elsewhere.

## The headline tiles

### Net GEX at spot

The dollar-gamma value of all open options, signed by ZeroGEX's modeled dealer-positioning convention (calls +, puts −), evaluated **at the current spot price**. Positive ⇒ dealers are *modeled* net long gamma; negative ⇒ *modeled* net short.

> This is an estimate: dealer gamma is modeled from the traditional call-positive / put-negative open-interest convention. Actual dealer inventory is not directly observable from public option-chain data.

The number you see here is measured at spot, not summed across the chain — that's important because the sign at spot shapes the modeled dealer hedging tendency right now, regardless of what the cumulative curve does at other prices.

### Gamma Flip

The price level where the modeled dealer gamma curve crosses zero. It's the regime line: above it, modeled hedging *tends* to be stabilizing; below it, amplifying. Because it's a zero-crossing of a modeled profile, it can shift with the sign convention, expirations, and IV — treat a cross as a change in the model's aggregate hedging tendency, not a guaranteed switch from mean-reverting to trending. The tile shows both the absolute level and the percent distance from spot.

### Call Wall / Put Wall

The strikes with the largest call-side and put-side gamma. They often act as intraday friction — but option type alone doesn't fix the direction; whether a wall behaves as resistance, support, a magnet, or an accelerant depends on the modeled dealer-gamma sign and surrounding flow. Wall behavior is most "wall-like" when dealers are modeled long gamma.

### Max Pain

The strike at which total option-buyer payout is minimized. Most relevant in the last 24–48 hours of a meaningful expiration.

## The GEX profile chart

The headline chart. Strike on the x-axis; dealer gamma on the y-axis. Three things to read:

1. **Where the curve crosses zero** — the gamma flip.
2. **The largest call gamma stack** — the call wall.
3. **The largest put gamma stack** — the put wall.

The current spot price is shown as a vertical reference line. The visible range is centered on spot.

## The walls chart

A separate, larger-format view of the wall structure with the call wall, put wall, max pain, and gamma flip overlaid. Useful when you're trying to see how the structure has migrated since the open.

## The term-structure chart

The GEX profile **per expiry**. Stacks 0DTE, this week's expiries, next week, and monthlies in one view. Useful for:

- Spotting **0DTE pin behavior** isolated from the bigger book.
- Spotting whether a wall is concentrated in monthlies (sticky) versus weeklies (transient).

## The strike × DTE heatmap

A 2D heatmap of dealer gamma across strike (rows) and DTE (columns). The hottest cells are the strikes that matter for the nearest expiries. The heatmap migrates intraday as flow comes in — watching it move is informative.

## The regime header

The very top of the page repeats the GEX regime label (Positive / Negative / Transitioning) with the one-line interpretation. If the regime label and the spot/flip relationship don't agree, hover the regime — the tooltip explains why (the "Transitioning" label fires when net GEX at spot is close to zero).

## Reading dealer positioning in three steps

1. **Where is spot relative to the flip?** Above ⇒ modeled stabilization tendency; below ⇒ modeled amplification tendency.
2. **Where are the walls?** The call wall is your upside friction; the put wall is your downside friction.
3. **How is the heatmap migrating?** If the call wall is drifting up, the modeled call-wall strike (where call-side gamma peaks) is climbing as spot, gamma, time, and IV shift — a bullish structural lean. The wall can move without new open interest: it tracks where modeled exposure peaks, not verified intraday OI.

## Why ZeroGEX's gamma flip calculation is different

The flip is computed from a **spot-shift dealer gamma profile** — not a cumulative-net-GEX approximation. For the methodology and the before/after comparison, see [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Common reads

- **Spot well above flip, call wall close above** ⇒ pin into the close, fade extension.
- **Spot below flip, put wall close below** ⇒ trend bias; expect amplification on a break.
- **Spot near the flip with rising vol** ⇒ regime change risk; size down or wait.
- **Heatmap concentration on 0DTE call strikes near spot** ⇒ pin pressure into the close.

## See also

- [GEX Summary & Greeks](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
