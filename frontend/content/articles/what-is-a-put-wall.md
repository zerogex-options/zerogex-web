# What Is a Put Wall? Put Gamma Concentration Explained

*The put wall in plain English — what it is, why price often reacts near it, why the modeled short-put hedge does not make it a mechanical floor, how it differs from the call wall, what a break means, and where to find today's SPX, SPY, QQQ and NDX put wall.*

---

## What is a put wall?

A **put wall** is the strike below the current price where put-side gamma exposure is most concentrated on the option chain. Traders watch it as the lower edge of the range that current positioning is most consistent with — the strike where a decline is most likely to meet a reaction from hedging, liquidity, and the rest of the flow that gathers around a heavy strike.

More precisely: the Put Wall is the strike at or below spot with the largest unsigned put-gamma magnitude in the selected option chain. ZeroGEX ranks strikes from modeled gamma multiplied by official open interest and applies the spot-side filter. It is a structural reference, not a promise that price will bounce.

Under ZeroGEX's traditional call-positive/put-negative convention, the put inventory at this strike is **locally negative modeled dealer gamma**. For a delta-hedged dealer short a put, a price decline makes the option position more positively delta; maintaining the hedge generally calls for selling more underlying. That local adjustment can reinforce the decline. The Put Wall therefore is not a mechanically defended dealer floor or the mirror image of a positive call wall.

## How ZeroGEX models dealer positioning

Public option-chain data does not reveal dealers' complete long and short inventory. ZeroGEX therefore assigns calls positive modeled exposure and puts negative modeled exposure, broadly corresponding to dealers being net long calls sold by customers and net short puts purchased by customers. The convention is useful for comparing chain structure, but it is not a direct observation of dealer inventory; actual positioning may differ.

Modeled Net GEX remains:

```text
Modeled Net GEX = Call GEX - Put GEX
```

Long calls and long puts each have positive gamma; short calls and short puts each have negative gamma. The put-negative sign above comes from the assumed dealer position, not from an inherent negative gamma for puts.

## Why the put wall often coincides with support

A Put Wall can coincide with observed support because of the complete gamma profile, liquidity, put monetization, customer behavior, systematic demand, or other market flows. Positive modeled call gamma elsewhere may also outweigh the negative modeled put gamma at the wall, leaving aggregate Net GEX positive. But aggregate positive gamma does not prove that dealer buying is concentrated at the Put Wall.

Treat the level as:

- a large put-gamma concentration;
- a possible liquidity and positioning reference;
- a level that may empirically behave as support; and
- a level whose behavior depends on aggregate and local gamma plus surrounding flow.

## Put wall vs call wall

The two walls are built the same way on opposite sides of spot, and that is where the symmetry ends.

| | Put wall | Call wall |
|---|---|---|
| Side of spot | At or below | At or above |
| Ranked by | Largest put-gamma magnitude (modeled gamma × open interest) | Largest call-gamma magnitude (modeled gamma × open interest) |
| Modeled dealer sign | Negative — dealers modeled short the puts customers buy | Positive — dealers modeled long the calls customers sell |
| Common reading | Lower edge of the positioning range; may coincide with support | Upper edge of the positioning range; may coincide with resistance or pinning |
| Local hedge, in isolation | A decline can call for more selling, which can reinforce the move | A rally can call for more selling, which can lean against the move |
| On a break | The reference failed or migrated; in negative gamma the move can accelerate | The reference failed or migrated; often read as a positioning shift |

Call and Put Walls are not mechanically symmetric. A Call Wall is the at-or-above-spot strike with the largest call-gamma magnitude; a Put Wall uses put-gamma magnitude below spot. Option type alone does not determine resistance, support, attraction, or acceleration. The fuller comparison is in [What Is a Call Wall?](/education/what-is-a-call-wall) and [Gamma Walls Explained](/education/gamma-walls-explained).

## Put wall vs gamma flip vs max pain

Three levels that get confused for one another:

- The **put wall** is a *concentration* — the densest put-gamma strike below spot.
- The [gamma flip](/education/how-to-read-a-gamma-flip), or [zero gamma level](/education/zero-gamma-level-explained), is a *regime line* — the price where modeled net dealer gamma changes sign. It decides whether hedging near the walls tends to damp moves or amplify them. The flip is frequently above the put wall, so price can break the put wall while still in positive gamma, or hold it while already in negative gamma.
- [Max pain](/education/max-pain-explained) is an *expiration-value* calculation — the strike where option holders' expiring value is minimized. It is not a gamma concentration and is often nowhere near either wall.

Reading the put wall without the flip is the most common mistake on this page. The wall tells you where positioning is dense; the flip tells you what dense positioning is likely to do.

## Why a wall can migrate intraday

Official open interest is generally updated after clearing rather than continuously intraday. ZeroGEX walls can still migrate during the session because spot, time to expiry, and implied volatility change each strike's modeled gamma. The relative ranking can change, a strike can cross from one side of spot to the other, or another fixed-OI strike can become the maximum.

The wall calculation does not establish that fresh volume opened new positions. Volume cannot identify opening versus closing activity, and it is not verified intraday open interest. As expiration approaches, gamma becomes increasingly concentrated near the at-the-money strike: ATM gamma can rise sharply, while gamma at strikes that become decisively in or out of the money tends toward zero. That repricing is different from contracts closing or official OI updating.

## What happens when the put wall breaks

A break below the put wall is information, not a verdict. Read it against four questions:

1. **Which regime was in force?** Above the gamma flip, aggregate hedging tends to lean against the decline, and a break more often stalls at the next put concentration. Below the flip, the reflex runs with the move, and a break can accelerate — the local short-put hedge described above is now aligned with the broader book.
2. **Did the wall migrate or fail?** A wall that re-ranked to a lower strike as inputs changed was not "broken"; the reference moved. Compare the wall's strike before and after the break.
3. **Did flow overwhelm it?** Macro headlines, index rebalances, and large single orders supply flow that dwarfs hedging. A break on that kind of tape says little about the wall.
4. **Was the gamma flip crossed?** A break can mean the reference failed, surrounding flow dominated, local gamma weakened, or the wall migrated. Only a crossing of the calculated Gamma Flip — or an actual change in modeled Net GEX sign — supports a gamma-regime-change claim.

After a break, the next-largest put-gamma strike below becomes the new put wall on the next snapshot. That is how the level "steps down" through a trending session.

## A practical read

Suppose SPX is at 5,830, the Put Wall is 5,790, the Call Wall is 5,850, and modeled Net GEX is positive. The Put Wall identifies the largest below-spot put-gamma magnitude. It does **not** by itself identify a buy zone. A trader can watch whether liquidity absorbs selling there, whether the aggregate gamma profile remains stable, whether the wall migrates as inputs change, and whether directional flow confirms or overwhelms the level.

Now suppose SPX slips to 5,785 an hour later and the gamma flip, published at 5,815, has been crossed. Two things changed at once: the put wall reference failed, and the modeled regime turned negative. The second is the one that matters for the next trade — the hedging reflex that might have leaned against the decline is now modeled to lean with it, and the next put concentration below is the new reference, not a bounce target.

## How to find today's put wall

ZeroGEX publishes the put wall — with the call wall, gamma flip, max pain, and net GEX — free and delayed roughly 15 minutes, for [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels), and [NQ](/nq-gamma-levels). Each page refreshes through the session and shows the snapshot time next to every level. To draw the level on your own chart, the free [TradingView indicator](/tradingview-indicator) and [thinkorswim study](/thinkorswim-indicator) plot the put wall as a horizontal line; the live, sub-minute value updates inside the ZeroGEX dashboard.

Two habits make the number useful rather than decorative: note the snapshot time (a morning put wall read against an afternoon tape is a different book), and read it with the gamma flip on the same screen.

## Takeaway

> The Put Wall is a modeled put-gamma concentration and a useful structural reference. It may coincide with support, but support is not a direct consequence of the modeled dealer-short-put hedge at that strike.

See today's modeled walls on [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), and [NDX](/ndx-gamma-levels), or compare the broader framework in [Gamma Walls Explained](/education/gamma-walls-explained).

Educational content only — none of the above is a trade recommendation.
