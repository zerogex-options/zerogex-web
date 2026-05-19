# Gamma Flip Calculation: Before vs. After

*How ZeroGEX locates the zero-gamma level — what changed, why it changed, and what you will see on the platform.*

---

## Summary

The Gamma Flip (the zero-gamma level) calculation was changed from a cumulative net-GEX-by-strike approximation to a spot-shift dealer gamma profile — the actual SpotGamma / SqueezeMetrics construction. A follow-up change also hardened how the system behaves when the option chain is degraded.

Net effect: the flip now resolves correctly even when it sits well away from spot, and when the data is too degraded to compute it honestly, the system reports a visible gap instead of a stale or fabricated number.

---

## At a glance: the matrix

### Before vs. After

| Dimension | Before — Cumulative net-GEX-by-strike | After — Spot-shift dealer gamma profile |
| --- | --- | --- |
| Gamma treatment | Single broker snapshot gamma at the current spot only, never re-priced | Each option's gamma re-priced with Black-Scholes at every hypothetical spot |
| Domain searched | Ingested strike band only (roughly ±10 strikes) | Price grid of spot ±20% (configurable), in 0.25% steps |
| Definition | Retail approximation of zero gamma | The recognized SpotGamma / SqueezeMetrics definition |
| Headline net-GEX | Computed separately — could disagree with the flip regime | Sampled from the same curve — sign-consistent by construction |
| Flip far from spot | One-signed curve, no crossing → the flat / stuck flip symptom | Resolves correctly — the grid spans well past the strike band |
| Degraded chain | Could freeze on the last good level or fabricate one | Reported as unresolved (NULL gap) plus a health warning |

### Pros and cons

| Approach | Pros | Cons |
| --- | --- | --- |
| Before — Cumulative net-GEX-by-strike | Cheap to compute; single pass over the snapshot; intuitive to reason about | Not the published definition; bounded by the ingested strike band; froze when the flip was far from spot; headline figure could contradict the regime |
| After — Spot-shift dealer gamma profile | Matches the industry definition; resolves a far-from-spot flip; headline and regime are sign-consistent; degraded data is visible, not masked | More compute (re-prices the chain across a grid); uses sticky-strike vol (a full vol-surface re-shift is out of scope); live flip values shifted by design |

---

## Before — Cumulative net-GEX-by-strike

**Procedure**

- Compute per-strike dealer GEX from the snapshot gamma: **GEX = γ · OI · 100 · S² · 0.01** (calls +, puts −), where γ is the broker-supplied gamma at the current spot only.
- Aggregate net GEX by strike across expirations and sort strikes ascending.
- Walk strikes low → high, accumulating a running cumulative total.
- The flip is the price where that cumulative curve crosses zero (linear-interpolated between strikes, with the crossing nearest spot kept).

**Core limitation.** Gamma is a function of spot — every option's gamma changes as the underlying moves. This method cumulated the fixed snapshot gamma and never re-priced it, so it was a retail approximation of the published zero-gamma definition, not the definition itself. It was also bounded by the ingested strike band (roughly ±10 strikes). When the true zero-gamma level sat outside that band, the cumulative curve was one-signed (no crossing) and the flip could not be found — which produced the flat-flip symptom, where the persisted level froze and stopped tracking the market.

> Lineage note: an even earlier version used the adjacent per-strike sign change rather than the cumulative curve — a non-standard level. That was replaced by the cumulative method on 2026-05-16, which is the before baseline most relevant here.

---

## After — Spot-shift dealer gamma profile

*Commit 1731efc, 2026-05-18.*

**Procedure** — **_gamma_exposure_profile** in **src/analytics/main_engine.py**

- Build a grid of hypothetical underlying prices spanning spot ± **GAMMA_PROFILE_SPAN_PCT** (default ±20%), stepped by **GAMMA_PROFILE_STEP_PCT** (default 0.25% of spot).
- At every grid price, re-price each option's gamma with Black-Scholes (γ = N'(d1) / (S·σ·√T), q=0, risk-free rate from config). Each contract's implied volatility is held at its snapshot value across the shift (sticky-strike — the standard simplification; a full vol-surface re-shift is out of scope).
- At each grid price, sum dealer dollar gamma γ(S) · OI · 100 · S² · 0.01 with the same dealer sign convention (calls +, puts −).
- The Gamma Flip is the zero crossing of this profile (linear-interpolated; with multiple crossings on a lumpy book, the one nearest spot is kept).
- The headline net-GEX-at-spot is the same profile sampled at the current price. Because both come from one curve, the headline figure and the spot-vs-flip regime can never contradict each other (the sign-consistency invariant).

**Why this is correct.** This is the actual industry construction. The zero-gamma level is defined as the spot at which dealer gamma flips sign as the underlying moves — that can only be located by re-pricing gamma at each hypothetical spot, not by cumulating a single static snapshot value. Because the grid spans ±20% of spot rather than the ingested strike band, the flip resolves even when the zero-gamma level sits several percent away — directly fixing the flat-flip root cause.

---

## Degraded-chain handling

*Commit f5c4ded, 2026-05-19.*

The interim version clamped the flip to the grid edge when the profile was one-signed across the entire ±20% grid. Investigation showed that, for a liquid chain, this only happens when the snapshot is degraded (stale feed / after-hours: ingestion nulls the Greeks, the snapshot query drops gamma-NULL rows, and the residual chain is one-sided) — not a genuine flip is far away.

The grid-edge clamp was therefore removed. Now, on a one-signed profile:

- The Gamma Flip is reported as **unresolved** — persisted as NULL (a visible gap), not a fabricated edge value.
- A WARN is emitted (visible in analytics-health) with usable-contract counts.
- The carry-forward is gated: an explicitly unresolved flip will not silently re-freeze the last good level (that re-freeze was the original flat-flip failure mode). A transient missing value with no degradation flag still carries forward, preserving back-compatibility.

---

## What the customer will observe

- Live **gamma_flip_point** values shifted when the method changed — this was a deliberate definition correction to the recognized SpotGamma / SqueezeMetrics level, not a bug fix. Any absolute thresholds built on the old flip distance should be re-reviewed; relative usage is unaffected.
- The flip now tracks the market even when zero-gamma is several percent from spot (the previous stuck / flat-flip symptom is resolved).
- Headline net-GEX and the spot-vs-flip regime are always consistent (both read off one curve).
- On degraded / stale data the flip shows a NULL gap rather than a frozen or fabricated value, with a corresponding health warning — by design, so a degraded feed is visible rather than masked.
