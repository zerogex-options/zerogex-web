# Flow Analysis

*Premium-weighted and net-volume flow, the Lee-Ready aggressor split, and how to spot real conviction in the tape.*

---

## What this page shows

The Flow Analysis page is the **tape view** of the options market. Where Dealer Positioning shows you the static book, this page shows you the **flow** - what traded today, and which side crossed the spread to trade it.

Two menus in the header apply to the whole page: **Session** (the current session or the prior one, so you can see whether today is unusual at all) and **Volume basis** (**Directional** or **Total Traded** - see below).

## The three flow lenses

ZeroGEX shows flow through three lenses, because each one matters differently.

### Net contract volume

Just count contracts. Useful as a noise baseline. Useless as a conviction read on its own - a thousand $0.05 contracts and one $500 contract count the same. The **Total Traded** basis counts every contract that changed hands, so it only ever rises.

### Premium-weighted flow

Multiply contract volume by premium paid. **This is the conviction read.** A trader paying $500/contract for a 0DTE OTM call is making a real bet; a trader scalping $0.05 lotto tickets is not.

### Directional flow (Lee-Ready aggressor split)

Classify each trade as buyer-initiated or seller-initiated using the Lee-Ready algorithm (which side of the bid/ask the trade was on); prints too close to the midpoint to call either way are left unsigned. Sum buyer-initiated minus seller-initiated. Tells you whether the aggressors are paying for upside or downside. The **Directional** basis signs volume this way, so it can print below zero.

## The regime banner

**Flow Analysis Regime** labels the session so far: **Risk-On Flow Regime** when net premium and net flow both lean to calls, **Risk-Off Flow Regime** when both lean to puts, and **Mixed / Two-Way Flow** when they disagree or are both small. The paragraph underneath gives the numbers behind the label.

## The Flow Snapshot

Session totals as of the latest bar:

- **Call Volume** and **Put Volume** - contracts traded, with the net premium on each side underneath
- **Net Flow** - net call contracts minus net put contracts, each signed by the aggressor
- **Net Premium** - net call premium minus net put premium. Positive ⇒ aggressors paying for calls / selling puts on net; negative ⇒ aggressors paying for puts / selling calls.
- **Put/Call Ratio** - put volume divided by call volume

## The charts

- **Options Flow** - net call premium and net put premium through the session against the underlying price, with a volume area underneath on the basis you picked. Filter it by strike or expiration.
- **Net Directional Premium** - the running session total of net premium, shaded above and below zero.
- **Put/Call Ratio** - the session-cumulative ratio at each 5-minute bar.
- **Net Position (Buys vs. Sells)** - running net call and net put volume, so you can tell buying from selling, which the ratio can't.

Each is plotted as a series so you can see the slope, not just the level.

## Smart money

Smart-money prints have their own page - see [Smart Money](/help/platform/smart-money). Use it as a cross-check on the headline flow here.

## How to read it

Three patterns:

1. **Strong premium-weighted positive flow with a positive GEX Gradient while dealers are modeled short gamma** ⇒ traders are paying for upside that dealers are modeled short. High-conviction continuation read.
2. **Strong put buy with the Positioning Trap signal loaded on the short-crowd (positive) side** ⇒ the bearish crowd is offside; expect a snap back up.
3. **Flow flat near a key level** ⇒ wait for the break. Flow without conviction is not a trade.

## Net Volume vs. Directional Flow

For the deeper read on why raw volume can mislead, why directional flow adds signal, and why premium-weighted is usually the strongest conviction metric, see [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

## When the page is most useful

- **Right after the open** - the first 30 minutes tell you a lot about the day's bias.
- **At any key level** - the flow into a wall or VWAP shows who is pressing the level. In our study of 737 wall tests, signed flow at the wall strike did not predict which walls broke, so read it as context, not a verdict.
- **Into the close** - combined with EOD Pressure, the flow read sharpens the directional cue.

## See also

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow)
