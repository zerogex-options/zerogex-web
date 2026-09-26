# GEX Summary

*The headline GEX numbers and the levels they imply on one screen - plus how the gamma flip holds up across horizons, and whether today's dealer gamma is unusual.*

---

## What this page shows

The GEX Summary page is the **by-the-numbers** view of the options book. Where Dealer Positioning is structural (profile, walls, heatmaps), this page puts ten headline numbers on one screen, then shows how the gamma flip changes across option horizons and how today's dealer gamma compares with its own history.

The **GEX unit** toggle in the header switches every dollar GEX figure between gamma per 1% move (the default) and per 1 point. The exposure is the same either way; only the unit changes.

## The top row

### Price

The live price of the active symbol. When the cash market is closed and the price comes from futures, the card says so and names the contract - the GEX levels stay on the cash index.

### Net GEX

Modeled dealer gamma in dollars, using the traditional call-positive / put-negative open-interest convention. Under that convention, positive net GEX is consistent with dealers *tending* to buy weakness and sell strength; negative with dealers *tending* to chase price. Shown at spot - the value that is sign-consistent with the gamma flip, not the chain-wide total.

> Net GEX is an **estimate**: it models dealer gamma from the call-positive / put-negative convention. Actual dealer inventory is not directly observable from public option-chain data.

### Gamma Flip

The structural flip: the price where aggregate modeled dealer gamma changes sign, computed with a horizon weighting that down-weights near-dated 0DTE walls. Above it, modeled hedging *tends* to dampen moves; below it, to amplify them. **Raw nearest** underneath is the nearest crossing on the unweighted profile - the convention many other dashboards publish. Without the weighting, near-dated walls can pull it much closer to spot than the structural flip.

### Max Pain

The strike where option-holder payout at expiration is smallest. See [Max Pain](/help/platform/max-pain) for when it matters and when it doesn't.

### Pin Strike

The reachable 0DTE strike with the strongest modeled positive dealer gamma into the close, with its strength (Strong, Moderate, or Weak) and confidence percent. See [Pin Strike](/help/platform/pin-strike) for how it's computed and what "Weak" actually means.

## The bottom row

- **Call GEX** and **Put GEX** - total modeled gamma exposure from calls and from puts, the two halves behind Net GEX.
- **Put/Call Ratio** - put volume divided by call volume. Above 1 leans bearish; below 1, bullish.
- **Call Wall (Resistance)** and **Put Wall (Support)** - the strike at or above spot with the largest call gamma, and the strike at or below spot with the largest put gamma, each summed over today's expiration and the next two (0-2DTE), with the distance from spot. A chart scoped to 0DTE alone can show a different strike. The labels are the usual reading, not a guarantee: whether a wall holds depends on the modeled dealer-gamma sign and the surrounding flow.

## Gamma Flip · Term Structure

Today's gamma flip, resolved separately for each option horizon - 1 to 60 days by default, with **Std**, **Short**, and **Long** presets. Each point is colored by the sign of dealer gamma at spot. Diamond outlines mark the flip recorded that many days ago, and a red X flags a horizon where no crossing could be resolved. Use it to see whether the flip holds across horizons or is a near-dated effect.

## Horizon × Price Contour

The same question as a surface: modeled dealer gamma across hypothetical spot prices (x) and option horizons (y). Blue cells are long gamma (stabilizing), red cells short gamma (destabilizing), and a black line traces the zero crossing - the flip at each horizon. Guides mark current spot and the heaviest call and put walls.

## Gamma Pulse

*"Is current dealer gamma irregular?"* Net GEX at spot and the chain-wide total net GEX, each ranked against the last 30 days and against all history - **EXTREME HIGH**, **ELEVATED**, **NORMAL**, **LOW**, or **EXTREME LOW** - with a trophy when a reading sets a record. The comparison is time-of-day aware, so the usual end-of-day pin isn't flagged as unusual.

## Sign conventions

ZeroGEX signs every greek from a modeled dealer perspective - the same convention throughout, not observed inventory:

- Positive gamma ⇒ under the call-positive / put-negative convention, dealers are *modeled* net long calls / short puts, hedging against price.
- Negative gamma ⇒ dealers are *modeled* net short gamma, hedging with price.

When you're reading another GEX provider, double-check the sign convention. Most use the same dealer-perspective sign, but a few flip it.

## Reading the page

Two patterns:

1. **Cross-check with Dealer Positioning.** If Net GEX is meaningfully positive but the GEX profile shows the curve crossing negative just below spot, you're sitting at the regime line - risk is asymmetric.
2. **Compare the flip with Raw nearest.** When the two sit far apart, near-dated gamma is doing the pulling. The flip term structure shows whether the level holds across horizons.

## See also

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Pin Strike](/help/platform/pin-strike)
- [Vanna and Charm Explained for Options Traders](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
