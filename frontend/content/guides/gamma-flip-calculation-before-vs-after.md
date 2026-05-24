# GEX and the Gamma Flip — How ZeroGEX calculates them

*A plain-English walkthrough of the dealer gamma-exposure profile, the resolver that turns it into an actionable level, and how the methodology compares to other popular vendors.*

---

## What "dealer gamma" actually is

Market-makers (the "dealers") sit on the other side of every option you trade. When you buy a call, a dealer sells it to you. To stay flat directionally, they hedge by buying or selling the underlying. As the stock moves, the option's hedge ratio (delta) changes, so the dealer has to keep re-buying or re-selling.

**Gamma** is how fast that hedging requirement changes. **GEX** ("gamma exposure") translates the whole option chain's gamma into dollars — roughly, *the dollar amount of underlying dealers need to trade for every 1% move in the stock.*

There are two regimes, separated by a single price level called the **gamma flip**:

- **Above the flip — dealers net long gamma.** When the stock rises they sell, when it falls they buy → mean-reverting / volatility-suppressing.
- **Below the flip — dealers net short gamma.** When the stock rises they buy, when it falls they sell → momentum-amplifying / volatility-expanding.

---

## How we calculate it (and why this way)

The core primitive is one curve: the **spot-shift dealer gamma profile**.

1. Take today's option chain snapshot.
2. Imagine the stock at every price on a grid spanning roughly ±20% of spot (in 0.25%-of-spot steps — a few hundred grid points).
3. At each grid price, **re-price every option's gamma** with Black-Scholes (gamma is itself a function of spot, so you cannot use the static snapshot value).
4. Multiply each contract's gamma by `OI × 100 × S² × 0.01` (the industry "dollar GEX per 1% move" convention used by SpotGamma / SqueezeMetrics / Cheddar Flow), and apply the dealer sign convention (calls +, puts −).
5. Weight each contract by `min(1, DTE / 5 days)` — a horizon-occupancy ramp so a same-day 0DTE wall (which carries a colossal `1/√T` gamma spike) cannot pin a multi-day regime level.
6. Sum across the chain → one curve, *dealer dollar gamma vs. hypothetical spot.*

Two readings come from that **same** curve:

- **Gamma Flip** = the price where the curve crosses zero (the actionable crossing).
- **Net GEX at spot** = the value of the curve at today's price.

Because both come from one curve, the headline GEX number and the spot-vs-flip regime *can never contradict* each other — that's a structural invariant of the calculation. That's why we built it this way. The old "cumulate static gamma by strike" shortcut (still used by several vendors) could give you a positive net GEX number while telling you spot was below the flip — incoherent.

---

## The hardened flip resolver

The raw zero crossing isn't enough by itself — three real failure modes had to be defended against:

1. **Grid-edge crossings.** Gamma decays to ~0 at the grid extremes, so a hairline imbalance can flip sign there → **Interior gate**: a crossing must sit ≥10% of the grid width away from either edge.
2. **Noise-floor crossings** (morning-open / IV-spike artifacts). When the whole chain's gamma is degraded, the profile drifts through zero in a low-signal region → **Structural gate**: a candidate's local-window peak |profile| must be ≥ 2% of a robust reference (the p90 of |profile| over a canonical ±15% band, restricted to grid points near a real OI > 0 strike).
3. **Far-from-spot crossings.** A structurally valid crossing 20% below spot isn't actionable on any reasonable horizon → **Actionable-distance gate**: candidates further than 8% from spot are rejected.

If the ±20% grid yields no qualifying crossing, the resolver **expands the grid** to ±35%, then ±50% (an adaptive ladder). If no rung qualifies, the flip is reported **unresolved (NULL + WARN)** — honestly, rather than fabricating an edge value or freezing a stale one.

---

## How this differs from popular sites

| Site | Method | Pros | Cons |
| --- | --- | --- | --- |
|! **ZeroGEX (this codebase)** | Spot-shift dealer gamma profile, adaptive grid ladder, interior / structural / actionable-distance acceptance gates, DTE horizon-occupancy weighting, honest NULL on degraded chains | The published industry definition; sign-consistent headline (flip and net-GEX-at-spot read off one curve); hardened against degraded-chain, near-edge, and far-from-spot artifacts; multi-horizon endpoints expose 1d / 5d / 20d flips from one primitive | More compute per cycle (re-greeks the chain across a grid, sometimes at multiple ladder rungs); more tunable knobs (bundled into `default` / `strict` / `lenient` profiles to keep the surface small); sticky-strike vol simplification (a full vol-surface re-shift is out of scope) |
| **SpotGamma** | Spot-shift dealer gamma profile (the canonical / original definition) | Industry reference for the definition; published research lineage | Closed methodology; sticky-strike too; the reported flip is a single horizon |
| **SqueezeMetrics** | Spot-shift dealer gamma profile (the other canonical source) | Original DIX / GEX paper is the public reference for this construction | Mostly daily-cadence retail product; not real-time |
| **Unusual Whales** | Per-strike GEX aggregation (cumulate gamma × OI by strike) | Cheap to compute; very fast; intuitive per-strike bar chart | Not the spot-shift definition — a cumulative-by-strike "zero gamma" level is a retail approximation; freezes when the true zero-gamma is outside the ingested strike band |
| **Cheddar Flow** | Per-strike GEX aggregation | Same as UW — fast and intuitive | Same caveat — not the spot-shift definition |

The biggest practical difference: **vendors that aggregate by strike will give you a "flip" that sticks at a wall as long as that wall is in their snapshot, even when the true zero-gamma level is several percent away.** We saw that exact symptom in our own historical data before the rewrite — the persisted flip went flat for hours. Re-pricing across a wider grid fixes it.

The second difference is **honesty about degraded data**: most vendors carry forward the last known value silently when their feed goes stale. We persist NULL and emit a health warning instead, so a degraded feed is visible rather than masked.
