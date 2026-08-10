# Why We Don't Publish Raw DEX as a Headline Flow Signal

*What options-only Delta Exposure measures, what it omits, and where it can still be useful.*

---

## The narrow objection

Raw DEX is a modeled estimate of **options-only delta exposure**, commonly summarized as `Σ(delta × open interest × contract multiplier)`. It can describe the assumed directional inventory of the option leg. Because it excludes the offsetting underlying hedge and measures a level rather than a change, ZeroGEX does not consider it a reliable standalone estimate of future dealer hedge flow.

That is a narrower claim than saying DEX has no meaning. Actual dealer ownership is not observable in public OI, so DEX also inherits whatever positioning convention the calculation applies.

## A level is not a future trade

A dealer can offset option delta with stock, futures, or other options and may manage the aggregate portfolio inside hedge bands. Raw options-only DEX omits those hedges. More importantly, a current delta level does not say how delta will change next. Potential hedge demand arises when spot, time, implied volatility, new trades, or position changes alter portfolio delta.

Deep-ITM contracts can contribute heavily to an options-only delta total because their absolute delta approaches one. That is not an error: it is part of the inventory estimate. It does mean that a large raw total need not identify the strikes with the greatest near-term delta sensitivity. Gamma, charm, and vanna have different strike and maturity profiles; they do not all universally peak at the money.

## Valid uses for DEX

With its assumptions stated clearly, DEX can support:

- modeled options-only directional inventory estimates;
- comparisons of chain structure over time;
- scenario analysis; and
- a component inside a broader portfolio model.

It should not be relabeled as an observed dealer position or a forecast of the next underlying order.

## Why ZeroGEX prefers scenario repricing

ZeroGEX's Forced Flow model compares modeled portfolio delta now with modeled delta under a defined spot/time/volatility scenario. The difference is an estimate of **potential** hedge pressure, conditional on the assumed inventory and scenario. It is not proof that dealers will execute that amount: portfolios can contain offsets, inputs can move together, and desks can hedge with different instruments or timing.

> Raw DEX can describe an assumed options-only delta level. ZeroGEX does not use that level alone as an estimate of future dealer hedge flow.

For the underlying concepts, see [Why Market Makers Trade Stock](/education/why-market-makers-trade-stock) and [Delta and Its Three Children](/education/delta-and-its-three-children).

Educational content only — none of the above is a trade recommendation.
