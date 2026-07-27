# GEX Summary & Greeks

*Headline GEX numbers plus delta, gamma, vanna and charm aggregates.*

---

## What this page shows

The GEX Summary page is the **per-greek aggregation** of the options book. Where Dealer Positioning is structural (walls, flip, profile), this page is the by-the-numbers totals: aggregated delta, gamma, vanna, charm, vega.

## The five top-line numbers

### Net GEX

Modeled dealer gamma in dollars, using the traditional call-positive / put-negative open-interest convention. Under that convention, positive net GEX is consistent with dealers *tending* to buy weakness and sell strength; negative with dealers *tending* to chase price. Shown at spot.

> Net GEX is an **estimate**: it models dealer gamma from the call-positive / put-negative convention. Actual dealer inventory is not directly observable from public option-chain data.

### Net DEX

Aggregate dealer delta — a separate modeled read from gamma. Strong negative models dealers short delta, who would tend to buy higher to stay hedged.

### Net VEX (Vanna)

Aggregate dealer vanna — sensitivity of delta to IV. Under the modeled book, a falling IV *can* push dealers to buy and a rising IV to sell, but the direction and size depend on call vs. put, moneyness, skew, and who actually owns the options. When it lines up, it's part of what drives "vol-compression grind" days.

### Net Charm

Aggregate dealer charm — the modeled effect of time passing on delta (holding spot and IV constant). A positive reading models hedge pressure that *can* support the close drift; negative pressures it. This is modeled hedge pressure, not a scheduled order, and it tends to build in the last two hours.

### Net Vega

Aggregate dealer vega. Tells you how exposed dealers are to a meaningful IV move.

## The by-strike breakdown

Underneath the totals, the page shows the same numbers broken down by strike — the per-strike contributions to gamma, delta, vanna, and charm. Use this when:

- You want to see **which strikes** are driving the headline number.
- You want to confirm the call wall is actually where the GEX profile says it is.
- You want to spot a vanna or charm concentration that the GEX profile doesn't make obvious.

## Sign conventions

ZeroGEX signs every greek from a modeled dealer perspective — the same convention throughout, not observed inventory:

- Positive gamma ⇒ under the call-positive / put-negative convention, dealers are *modeled* net long calls / short puts, hedging against price.
- Positive delta ⇒ dealers modeled long delta.
- Positive vanna ⇒ dealers modeled to benefit (delta-wise) when vol rises.
- Positive charm ⇒ dealers modeled to benefit (delta-wise) as time decays.

The gamma convention (dealers long calls / short puts) and the delta read are separate modeling choices — don't conflate the two.

When you're reading another GEX provider, double-check the sign convention. Most use the same dealer-perspective sign, but a few flip it.

## Reading the page

Two patterns:

1. **Cross-check with Dealer Positioning.** If Net GEX is meaningfully positive but the GEX profile shows the curve crossing negative just below spot, you're sitting at the regime line — risk is asymmetric.
2. **Watch vanna and charm into the close.** Both tend to reach peak intraday influence in the last two hours; the per-strike charm contribution can point to where a pin may form.

## See also

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Vanna and Charm Explained for Options Traders](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
