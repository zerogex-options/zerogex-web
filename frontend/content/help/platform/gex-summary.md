# GEX Summary & Greeks

*Headline GEX numbers plus delta, gamma, vanna and charm aggregates.*

---

## What this page shows

The GEX Summary page is the **per-greek aggregation** of the options book. Where Dealer Positioning is structural (walls, flip, profile), this page is the by-the-numbers totals: aggregated delta, gamma, vanna, charm, vega.

## The five top-line numbers

### Net GEX

Aggregate dealer gamma in dollars. Positive ⇒ dealers buy weakness, sell strength. Negative ⇒ dealers chase price. Shown at spot.

### Net DEX

Aggregate dealer delta. Strong negative means dealers are short delta and structurally need to buy higher.

### Net VEX (Vanna)

Aggregate dealer vanna — sensitivity of delta to IV. Positive means an IV drop forces dealers to sell; an IV rise forces them to buy. This is the engine of "vol-compression grind" days.

### Net Charm

Aggregate dealer charm — sensitivity of delta to time. Positive structurally supports the close drift; negative pressures it. Charm-driven flow ramps in the last two hours.

### Net Vega

Aggregate dealer vega. Tells you how exposed dealers are to a meaningful IV move.

## The by-strike breakdown

Underneath the totals, the page shows the same numbers broken down by strike — the per-strike contributions to gamma, delta, vanna, and charm. Use this when:

- You want to see **which strikes** are driving the headline number.
- You want to confirm the call wall is actually where the GEX profile says it is.
- You want to spot a vanna or charm concentration that the GEX profile doesn't make obvious.

## Sign conventions

ZeroGEX uses the dealer perspective consistently:

- Positive gamma ⇒ dealers are long calls / short puts net, and they hedge against price.
- Positive delta ⇒ dealers are long delta.
- Positive vanna ⇒ dealers benefit (delta-wise) when vol rises.
- Positive charm ⇒ dealers benefit (delta-wise) as time decays.

When you're reading another GEX provider, double-check the sign convention. Most use the same dealer-perspective sign, but a few flip it.

## Reading the page

Two patterns:

1. **Cross-check with Dealer Positioning.** If Net GEX is meaningfully positive but the GEX profile shows the curve crossing negative just below spot, you're sitting at the regime line — risk is asymmetric.
2. **Watch vanna and charm into the close.** Both reach peak intraday influence in the last two hours; the per-strike charm contribution tells you where the pin will sit.

## See also

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Vanna and Charm Explained for Options Traders](/education/vanna-and-charm-explained)
- [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained)
