# What Is a Put Wall? Put Gamma Concentration Explained

*How traders interpret large put-gamma strikes, why they may coincide with support, and when the level can fail.*

---

## Definition

The **Put Wall** is the strike at or below spot with the largest unsigned put-gamma magnitude in the selected option chain. ZeroGEX ranks strikes from modeled gamma multiplied by official open interest and applies the spot-side filter. It is a structural reference, not a promise that price will bounce.

Under ZeroGEX's traditional call-positive/put-negative convention, the put inventory at this strike is **locally negative modeled dealer gamma**. For a delta-hedged dealer short a put, a price decline makes the option position more positively delta; maintaining the hedge generally calls for selling more underlying. That local adjustment can reinforce the decline. The Put Wall therefore is not a mechanically defended dealer floor or the mirror image of a positive call wall.

## How ZeroGEX models dealer positioning

Public option-chain data does not reveal dealers' complete long and short inventory. ZeroGEX therefore assigns calls positive modeled exposure and puts negative modeled exposure, broadly corresponding to dealers being net long calls sold by customers and net short puts purchased by customers. The convention is useful for comparing chain structure, but it is not a direct observation of dealer inventory; actual positioning may differ.

Modeled Net GEX remains:

```text
Modeled Net GEX = Call GEX - Put GEX
```

Long calls and long puts each have positive gamma; short calls and short puts each have negative gamma. The put-negative sign above comes from the assumed dealer position, not from an inherent negative gamma for puts.

## Why the level may still matter

A Put Wall can coincide with observed support because of the complete gamma profile, liquidity, put monetization, customer behavior, systematic demand, or other market flows. Positive modeled call gamma elsewhere may also outweigh the negative modeled put gamma at the wall, leaving aggregate Net GEX positive. But aggregate positive gamma does not prove that dealer buying is concentrated at the Put Wall.

Treat the level as:

- a large put-gamma concentration;
- a possible liquidity and positioning reference;
- a level that may empirically behave as support; and
- a level whose behavior depends on aggregate and local gamma plus surrounding flow.

Call and Put Walls are not mechanically symmetric. A Call Wall is the at-or-above-spot strike with the largest call-gamma magnitude; a Put Wall uses put-gamma magnitude below spot. Option type alone does not determine resistance, support, attraction, or acceleration.

## Why a wall can migrate intraday

Official open interest is generally updated after clearing rather than continuously intraday. ZeroGEX walls can still migrate during the session because spot, time to expiry, and implied volatility change each strike's modeled gamma. The relative ranking can change, a strike can cross from one side of spot to the other, or another fixed-OI strike can become the maximum.

The wall calculation does not establish that fresh volume opened new positions. Volume cannot identify opening versus closing activity, and it is not verified intraday open interest. As expiration approaches, gamma becomes increasingly concentrated near the at-the-money strike: ATM gamma can rise sharply, while gamma at strikes that become decisively in or out of the money tends toward zero. That repricing is different from contracts closing or official OI updating.

## A practical read

Suppose SPX is at 5,830, the Put Wall is 5,790, the Call Wall is 5,850, and modeled Net GEX is positive. The Put Wall identifies the largest below-spot put-gamma magnitude. It does **not** by itself identify a buy zone. A trader can watch whether liquidity absorbs selling there, whether the aggregate gamma profile remains stable, whether the wall migrates as inputs change, and whether directional flow confirms or overwhelms the level.

A break can mean the reference failed, surrounding flow dominated, local gamma weakened, or the wall migrated. Only a crossing of the calculated Gamma Flip—or an actual change in modeled Net GEX sign—supports a gamma-regime-change claim.

## Takeaway

> The Put Wall is a modeled put-gamma concentration and a useful structural reference. It may coincide with support, but support is not a direct consequence of the modeled dealer-short-put hedge at that strike.

See today's modeled walls on [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), and [NDX](/ndx-gamma-levels), or compare the broader framework in [Gamma Walls Explained](/education/gamma-walls-explained).

Educational content only — none of the above is a trade recommendation.
