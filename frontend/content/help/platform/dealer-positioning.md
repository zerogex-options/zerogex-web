# Dealer Positioning

*The full GEX surface - net GEX at spot, the gamma flip, call wall and put wall, and how to read the term structure.*

---

## What this page shows

The Dealer Positioning page is the **structural map** of the options book. Every chart and tile on it answers a single question: where are dealers positioned, and what will they have to do as price moves?

It is the most important page for understanding context - even if the trade itself is taken elsewhere.

The **GEX unit** toggle in the header switches every dollar figure on the page between gamma per 1% move and per 1 point. The exposure is the same either way; only the unit changes.

## The regime header

The top of the page reads the regime in one line:

- **The badge** - **+ Gamma Regime** when spot is above the gamma flip, **- Gamma Regime** when it is below, **~ Gamma Regime** when spot is within about 0.25% of the flip, and **? Gamma Regime** when no flip resolved this snapshot.
- **The gamma flip** - the level, and how many points spot sits above or below it.
- **The scenario** - **Positive GEX (pinned, low vol)**, **Negative GEX (trending, high vol)**, **At the Flip (neutral, transition)**, or **Flip unresolved this snapshot**.
- **A posture tag** - **Aggressive**, **Balanced**, or **Defensive** - built from the gamma sign at spot, IV rank, and vanna.
- **Market Context** - the same read in plain English, switchable between **Intraday** and **Swing**.

The regime is read purely from spot versus the flip, not from the sign of the chain-wide total, so the badge and the flip can't disagree.

### Gamma Flip

The price level where the modeled dealer gamma curve crosses zero. It's the regime line: above it, modeled hedging *tends* to be stabilizing; below it, amplifying. Because it's a zero-crossing of a modeled profile, it can shift with the sign convention, expirations, and IV - treat a cross as a change in the model's aggregate hedging tendency, not a guaranteed switch from mean-reverting to trending.

## The headline cards

### Net GEX

The dollar-gamma value of all open options, signed by ZeroGEX's modeled dealer-positioning convention (calls +, puts −), evaluated **at the current spot price**. Positive ⇒ dealers are *modeled* net long gamma; negative ⇒ *modeled* net short.

> This is an estimate: dealer gamma is modeled from the traditional call-positive / put-negative open-interest convention. Actual dealer inventory is not directly observable from public option-chain data.

The number you see here is measured at spot, not summed across the chain - that's important because the sign at spot shapes the modeled dealer hedging tendency right now, regardless of what the cumulative curve does at other prices. The badge beside it ranks the reading against the last 30 days (NORMAL, ELEVATED, EXTREME HIGH, and so on).

### IV Rank

Where implied volatility sits on a 0-100% scale, read from VIX (VXN for QQQ and NDX). 0% is historically calm; 100% is extreme fear.

### Vanna Flow and Charm Decay

Net vanna and net charm summed across every strike, shown as a label - **+Tailwind**, **-Headwind**, or **Neutral** for vanna; **Bullish**, **Bearish**, or **Neutral** for charm. They say whether moves in implied vol, and the passage of time, are modeled to add or remove directional delta pressure.

Max pain and the pin strike aren't on this page - see [GEX Summary](/help/platform/gex-summary) and [Max Pain](/help/platform/max-pain).

## The Gamma Exposure by Strike chart

The headline chart. Strike on the x-axis; modeled dealer gamma per strike as bars - calls up, puts down - with the **GEX Profile** curve overlaid on its own axis. Three things to read:

1. **Where the GEX Profile curve crosses zero** - the gamma flip.
2. **The largest call gamma stack at or above spot** - the call wall.
3. **The largest put gamma stack at or below spot** - the put wall.

Reference lines mark spot, the flip, and both walls. Each bar is stacked by expiration - the nearest (0DTE) boldest, the furthest faintest - so you can see how much of a strike's gamma rolls off soon. The expiration selector scopes the bars, the curve, the walls, and the flip to the expirations you pick, and the pick carries over to the other charts that share the expiry filter. The chart opens zoomed out across every strike loaded; the X and Y zoom buttons and the scrollbars narrow it.

### Call Wall / Put Wall

The strikes with the largest call-side and put-side gamma. They often act as intraday friction - but option type alone doesn't fix the direction; whether a wall behaves as resistance, support, a magnet, or an accelerant depends on the modeled dealer-gamma sign and surrounding flow. Wall behavior is most "wall-like" when dealers are modeled long gamma.

## The Open Interest by Strike chart

The contracts behind the gamma: open interest at each strike, calls above the axis and puts below, stacked by expiration the same way. Toggle between **OI** (contracts outstanding) and **Notional** (strike × 100 × OI). A large stack of open interest far from spot can still carry little gamma - which is why the walls are ranked on gamma, not on open interest.

## The GEX heatmaps

Two heatmaps show how gamma is spread across time and across expirations:

- **GEX Heatmap Timeseries** - net dealer gamma by strike through the session, orange for positive and blue for negative, with the price candles and the gamma flip drawn on top. It's the same chart as the standalone GEX Heatmap page.
- **GEX Heatmap · Strike × DTE** - net dealer gamma for the strikes carrying the most gamma over the next week (rows, highest strike on top) against days to expiration (columns, out to 7DTE). Green is positive, red negative, and deeper is larger. A crown marks the **GEX King** - the strike with the largest net dealer gamma across those near-term expirations.

Useful for:

- Spotting **0DTE pin behavior** isolated from the bigger book.
- Spotting whether a wall is concentrated in the nearest expiry (transient) or spread across later ones (stickier).

The heatmaps update through the session as spot, time, and IV shift the modeled gamma - watching them move is informative.

## The rest of the page

- **Charm & Vanna Flows** - aggregate vanna and charm across the chain, an end-of-day charm estimate for hedging pressure into the close, and a vol expansion risk read.
- **Volatility Surface** - implied vol across strikes for near-term versus longer-dated expirations.
- **GEX Metrics Snapshot** - the strike-by-strike table: net GEX, vanna, charm, open interest, and volume, centered on spot with the flip and the walls marked. Filter it by expiration; the **Strikes** toggle hides strikes with no open interest.

## Reading dealer positioning in three steps

1. **Where is spot relative to the flip?** Above ⇒ modeled stabilization tendency; below ⇒ modeled amplification tendency.
2. **Where are the walls?** The call wall is your upside friction; the put wall is your downside friction.
3. **How is the heatmap migrating?** If the call wall is drifting up, the modeled call-wall strike (where call-side gamma peaks) is climbing as spot, gamma, time, and IV shift - a bullish structural lean. The wall can move without new open interest: it tracks where modeled exposure peaks, not verified intraday OI.

## Why ZeroGEX's gamma flip calculation is different

The flip is computed from a **spot-shift dealer gamma profile** - not a cumulative-net-GEX approximation. For the methodology and the before/after comparison, see [Gamma Flip Calculation: Before vs After](/guides/gamma-flip-calculation-before-vs-after).

## Common reads

- **Spot well above flip, call wall close above** ⇒ pin into the close, fade extension.
- **Spot below flip, put wall close below** ⇒ trend bias; expect amplification on a break.
- **Spot near the flip with rising vol** ⇒ regime change risk; size down or wait.
- **Heatmap concentration on 0DTE call strikes near spot** ⇒ pin pressure into the close.

## See also

- [GEX Summary](/help/platform/gex-summary)
- [Reading the Dashboard](/help/platform/dashboard)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip)
