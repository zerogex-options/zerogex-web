# Flow Analysis

*Premium-weighted and net-volume flow, smart-money buckets, the Lee-Ready aggressor split, and how to spot real conviction in the tape.*

---

## What this page shows

The Flow Analysis page is the **tape view** of the options market. Where Dealer Positioning shows you the static book, this page shows you the **flow** — what aggressors are doing in real time.

## The three flow lenses

ZeroGEX shows flow through three lenses, because each one matters differently.

### Net contract volume

Just count contracts. Useful as a noise baseline. Useless as a conviction read on its own — a thousand $0.05 contracts and one $500 contract count the same.

### Premium-weighted flow

Multiply contract volume by premium paid. **This is the conviction read.** A trader paying $500/contract for a 0DTE OTM call is making a real bet; a trader scalping $0.05 lotto tickets is not.

### Directional flow (Lee-Ready aggressor split)

Classify each trade as buyer-initiated or seller-initiated using the Lee-Ready algorithm (which side of the bid/ask the trade was on). Sum buyer-initiated minus seller-initiated. Tells you whether the aggressors are paying for upside or downside.

## The headline tile

The top of the page shows premium-weighted net flow over the rolling window. Positive ⇒ aggressors paying for calls / selling puts on net; negative ⇒ aggressors paying for puts / selling calls.

## The breakdown panels

Below the headline:

- **Call buy / call sell** premium
- **Put buy / put sell** premium
- **Net aggressor delta** — the Lee-Ready output scaled by contract delta

Each is plotted as a series so you can see the slope, not just the level.

## The smart-money chip

Tags on individual trades flag them as smart-money — typically large blocks, sweeps, repeated aggressive prints in the same direction. Smart-money flow is shown as a separate subseries. Use it as a cross-check on the headline.

## How to read it

Three patterns:

1. **Strong premium-weighted positive flow with a negative GEX gradient** ⇒ traders are paying for upside that dealers are structurally short. High-conviction continuation read.
2. **Strong put buy with the Positioning Trap signal also high** ⇒ the crowd is offside; expect a snap back.
3. **Flow flat near a key level** ⇒ wait for the break. Flow without conviction is not a trade.

## Net Volume vs. Directional Flow

For the deeper read on why raw volume can mislead, why directional flow adds signal, and why premium-weighted is usually the strongest conviction metric, see [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

## When the page is most useful

- **Right after the open** — the first 30 minutes tell you a lot about the day's bias.
- **At any key level** — the flow into a wall or VWAP tells you whether the level is being defended or broken.
- **Into the close** — combined with EOD Pressure, the flow read sharpens the directional cue.

## See also

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow)
