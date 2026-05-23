# Gamma Flip Calculation: Before vs. After

*How ZeroGEX locates the zero-gamma level — what changed, why it changed, and what you will see on the platform.*

---

## Summary

The Gamma Flip (the zero-gamma level) calculation was changed from a cumulative net-GEX-by-strike approximation to a spot-shift dealer gamma profile — the actual SpotGamma / SqueezeMetrics construction. Subsequent hardening then layered an adaptive grid ladder and three acceptance gates (interior / structural / actionable-distance) on top of the raw zero crossing, and added a multi-horizon view (term-structure and surface endpoints) so a single calculation can serve consumers with different decision horizons.

Net effect: the flip now resolves correctly when it sits well away from spot, refuses to report brittle near-edge, noise-floor, or far-from-spot crossings, and reports a visible gap (NULL + health warning) when no qualifying crossing exists on any rung — instead of fabricating a value or freezing a stale one.

---

## At a glance: the matrix

### Before vs. After

| Dimension | Before — Cumulative net-GEX-by-strike | After — Spot-shift dealer gamma profile |
| --- | --- | --- |
| Gamma treatment | Single broker snapshot gamma at the current spot only, never re-priced | Each option's gamma re-priced with Black-Scholes at every hypothetical spot |
| Domain searched | Ingested strike band only (roughly ±10 strikes) | Adaptive ladder of grids — ±20% → ±35% → ±50% of spot (configurable), in 0.25% steps; the narrowest rung that produces a qualifying crossing wins |
| DTE treatment | All expirations weighted equally (net GEX aggregated by strike across expirations) — a same-day 0DTE/OPEX wall could set a flip irrelevant for any multi-day horizon | Each contract scaled by a horizon-occupancy ramp min(1, DTE / ref) (default 5d, on); switchable curve shape (linear / sqrt / exp) — near-dated down-weighted so the flip is the multi-day regime level; contracts ≥ reference horizon unweighted (1.0) |
| Definition | Retail approximation of zero gamma | The recognized SpotGamma / SqueezeMetrics definition |
| Headline net-GEX | Computed separately — could disagree with the flip regime | Sampled from the same curve — sign-consistent by construction |
| Crossing acceptance | Any zero crossing accepted (linear-interpolated, nearest spot kept) | Three acceptance gates: **interior** (≥10% of grid width inside either edge), **structural** (local window peak ≥ 2% × p90 reference, anchored to a canonical ±15% band with an active-strike filter), **actionable-distance** (≤8% from spot) |
| Flip far from spot | One-signed curve, no crossing → the flat / stuck flip symptom | Inside ±8% of spot: resolves via the ladder; beyond that: rejected by the distance gate and persisted as unresolved |
| Degraded chain | Could freeze on the last good level or fabricate one | Reported as unresolved (NULL gap) plus a health warning whenever no ladder rung yields a crossing that passes all three gates |
| Horizons exposed | One scalar — whatever the (implicit) DTE treatment produced | One persisted scalar (the production 5-day horizon by default) plus on-demand multi-horizon endpoints (flip term-structure + dealer-gamma surface) |

### Pros and cons

| Approach | Pros | Cons |
| --- | --- | --- |
| Before — Cumulative net-GEX-by-strike | Cheap to compute; single pass over the snapshot; intuitive to reason about | Not the published definition; bounded by the ingested strike band; froze when the flip was far from spot; headline figure could contradict the regime |
| After — Spot-shift dealer gamma profile | Matches the industry definition; resolves a far-from-spot flip; headline and regime are sign-consistent; degraded / brittle / far-from-spot crossings rejected rather than masked; near-dated 0DTE/OPEX no longer pins the multi-day regime level; multi-horizon view (term structure + surface) from the same primitive | More compute (re-prices the chain across a grid, potentially at multiple ladder rungs); uses sticky-strike vol (a full vol-surface re-shift is out of scope); live flip values shifted by design; a second deliberate live-value shift for chains with material near-dated/0DTE OI; more knobs (ladder rungs, gate thresholds, DTE curve shape) — bundled into operator-facing `default` / `strict` / `lenient` profiles to keep the surface small for most users |

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

*2026-05-18.*

**Procedure** — **_gamma_exposure_profile** in **src/analytics/main_engine.py**

- Build a grid of hypothetical underlying prices spanning spot ± **GAMMA_PROFILE_SPAN_PCT** (default ±20%), stepped by **GAMMA_PROFILE_STEP_PCT** (default 0.25% of spot).
- At every grid price, re-price each option's gamma with Black-Scholes (γ = N'(d1) / (S·σ·√T), q=0, risk-free rate from config). Each contract's implied volatility is held at its snapshot value across the shift (sticky-strike — the standard simplification; a full vol-surface re-shift is out of scope).
- At each grid price, scale every contract's dollar gamma γ(S) · OI · 100 · S² · 0.01 by a DTE weight — by default the linear horizon-occupancy ramp min(1, DTE / GAMMA_PROFILE_DTE_REF_DAYS) (default 5 days; GAMMA_PROFILE_DTE_WEIGHTING, on by default), with **GAMMA_PROFILE_DTE_WEIGHT_SHAPE** switching between three curves (`linear` | `sqrt` | `exp`) that all cancel the BS 1/√T near-expiry spike. Then sum across the chain with the dealer sign convention (calls +, puts −). The ramp weights each expiry by the fraction of the multi-day reference horizon over which the contract still exists, so a same-day 0DTE / OPEX wall is down-weighted out of contention while contracts living at least the full reference horizon are unweighted (1.0).
- The Gamma Flip is the zero crossing of this profile that passes the resolver's three acceptance gates (see *Resolver hardening* below). With multiple qualifying crossings on a lumpy book, the one nearest spot is kept.
- The headline net-GEX-at-spot is the same profile sampled at the current price. Because both come from one curve, the headline figure and the spot-vs-flip regime can never contradict each other (the sign-consistency invariant).

**Why this is correct.** This is the actual industry construction. The zero-gamma level is defined as the spot at which dealer gamma flips sign as the underlying moves — that can only be located by re-pricing gamma at each hypothetical spot, not by cumulating a single static snapshot value. Because the grid spans ±20% of spot rather than the ingested strike band, the flip resolves even when the zero-gamma level sits several percent away — directly fixing the flat-flip root cause.

**Why DTE-weight.** The spot-shift rewrite fixed the range / stale-carry-forward failure, but on its own it did not address near-dated domination — re-greeking actually adds a colossal 1/√T gamma spike at a 0DTE strike, so a same-day OPEX wall would still pin the nearest-to-spot crossing to a strike irrelevant for any multi-day horizon (the original 751.82-vs-spot pathology). The horizon-occupancy ramp removes that pin: a same-day expiry (gone by today's close) barely counts toward a multi-day regime level, while longer-dated structure is unchanged. Applied inside the single shared profile, so the flip and net-GEX-at-spot stay sign-consistent. Lineage note: this is a distinct refinement (2026-05-19), layered on the earlier spot-shift rewrite; the interim spot-shift version equal-weighted every expiration.

---

## Resolver hardening — adaptive ladder + acceptance gates

*2026-05-20.*

The base profile is the right primitive, but the raw zero crossing isn't always the right flip. Three failure modes turned up in production once the spot-shift method was live, each motivating a different gate. The resolver (**_resolve_gamma_flip** in **src/analytics/main_engine.py**) walks an ascending ladder of grid widths and accepts the first rung whose nearest-to-spot crossing passes all three gates; if no rung qualifies, the flip is persisted NULL with a WARN — never fabricated.

**Adaptive ladder.** The single ±20% grid was replaced by an ordered sequence (default `[0.20, 0.35, 0.50]`, set by **GAMMA_PROFILE_SPAN_PCT** + **GAMMA_PROFILE_EXPANSION_RUNGS**, composed into **GAMMA_PROFILE_SPAN_LADDER**). Narrow rungs are tried first; the resolver widens only when the narrow rung yields no qualifying crossing. The grid step (**GAMMA_PROFILE_STEP_PCT**) stays constant across rungs, so the dollar-per-point resolution does not degrade as the search widens.

**Interior gate.** A candidate crossing must sit at least **GAMMA_PROFILE_INTERIOR_MARGIN** of the grid width (default 10%) inside either edge. Far from spot, every option's gamma has decayed near zero (γ ∝ N'(d1)/(S·σ·√T) collapses well outside the strike cluster), and a hairline imbalance in that noise floor could flip sign spuriously — directly at the literal grid boundary. The interior gate rejects those edge-pinned crossings and forces the resolver to widen the grid instead. Geometrically the same idea as a well-bracketed root in Brent's method.

**Structural gate.** A candidate is rejected unless the peak |profile| value within ±**GAMMA_PROFILE_STRUCTURAL_WINDOW_PCT** × candidate (default 1%) is at least **GAMMA_PROFILE_STRUCTURAL_MIN_FRAC** (default 2%) of a robust high-magnitude reference for the chain. That reference is the **GAMMA_PROFILE_STRUCTURAL_REFERENCE_PERCENTILE** (default p90) of |profile| computed across a canonical ±**GAMMA_PROFILE_STRUCTURAL_REFERENCE_SPAN_PCT** band (default ±15%) with grid points filtered to those within **GAMMA_PROFILE_STRUCTURAL_ACTIVE_DISTANCE_PCT** (default ±1% of spot) of an open-interest-bearing strike. Three properties matter:

- **Robust percentile, not max.** A single colossal ATM wall used to dominate the global max so every ordinary crossing was rejected as noise relative to that one spike; p90 is stable to a small number of outlier peaks while still matching the max in a truly uniform chain.
- **Active-strike filter.** Anchors the noise floor to the actual book rather than to deep-OTM grid points that happen to live in OI dead zones — important for extended-hours degraded chains and long-dated tails.
- **Canonical band, anchored across rungs.** The reference is computed once over the same ±15% band regardless of which ladder rung is being evaluated. Without this, widening the grid would dilute p90 with deep-OTM near-zero values and quietly lower the floor, so the same marginal crossing that failed at ±20% could slip through at ±35% — a stealth floor-relaxation pathology that motivated this design.

**Actionable-distance gate.** A structurally valid crossing further than **GAMMA_PROFILE_MAX_FLIP_DISTANCE_PCT** (default 8%) from spot is rejected. A zero-gamma level that far away is not actionable on any reasonable trading horizon; in production it was also a recurring symptom of morning-open / IV-spike artifacts where the gamma landscape genuinely had a far-from-spot zero but the line walked off the chart while the headline summary went NULL on the next cycle.

The resolver never extrapolates beyond the widest ladder rung. When the actionable flip genuinely sits beyond ±**GAMMA_PROFILE_MAX_FLIP_DISTANCE_PCT** of spot, or the chain is degraded enough that no rung produces a qualifying crossing, the persisted flip is NULL and the regime is reported honestly — not patched with a fabricated value.

**Configurable parameters**

Most users do not touch these individually — the operator-facing bundle **GAMMA_FLIP_PROFILE** (`default` | `strict` | `lenient`) sets a coherent group at once. Per-knob overrides below still beat the bundle for ops emergencies.

*Profile primitive*

- **GAMMA_PROFILE_SPAN_PCT** — initial grid half-width as a fraction of spot (default ±20%).
- **GAMMA_PROFILE_STEP_PCT** — grid step as a fraction of spot (default 0.25%).
- **GAMMA_PROFILE_EXPANSION_RUNGS** — additional grid widths the resolver will try, ascending (default `[0.35, 0.50]`).

*DTE weighting*

- **GAMMA_PROFILE_DTE_WEIGHTING** — enable the horizon-occupancy DTE ramp (default true / on).
- **GAMMA_PROFILE_DTE_REF_DAYS** — reference horizon in days for the ramp (default 5, bounded 0.5–60).
- **GAMMA_PROFILE_DTE_WEIGHT_SHAPE** — `linear` (default) | `sqrt` | `exp`; all three cancel the BS 1/√T near-expiry spike but redistribute weight across the near-dated bucket differently (sqrt is more aggressive on near-dated; exp removes the hard saturation cliff at DTE = ref).

*Acceptance gates*

- **GAMMA_PROFILE_INTERIOR_MARGIN** — required distance of a crossing from either grid edge, as a fraction of grid width (default 0.10).
- **GAMMA_PROFILE_STRUCTURAL_MIN_FRAC** — local-window peak threshold relative to the reference (default 0.02).
- **GAMMA_PROFILE_STRUCTURAL_WINDOW_PCT** — half-width of the local window, as a fraction of the candidate price (default 0.01).
- **GAMMA_PROFILE_STRUCTURAL_REFERENCE_PERCENTILE** — percentile of |profile| used as the reference magnitude (default 90).
- **GAMMA_PROFILE_STRUCTURAL_REFERENCE_SPAN_PCT** — canonical band the reference is computed over, independent of the resolver's current rung (default 0.15).
- **GAMMA_PROFILE_STRUCTURAL_ACTIVE_DISTANCE_PCT** — active-strike filter: grid points are included in the reference only when within this fraction of spot of a non-zero-OI strike (default 0.01).
- **GAMMA_PROFILE_MAX_FLIP_DISTANCE_PCT** — maximum acceptable distance from spot for a resolved flip, as a fraction of spot (default 0.08).

---

## Degraded-chain handling

*2026-05-19.*

The interim version (before the resolver gates) clamped the flip to the grid edge when the profile was one-signed across the entire ±20% grid. Investigation showed that, for a liquid chain, this primarily happens when the snapshot is degraded (stale feed / after-hours: ingestion nulls the Greeks, the snapshot query drops gamma-NULL rows, and the residual chain is one-sided) — not a genuine flip far away. DTE weighting added a second, by-design path — if the only zero crossing came purely from now-down-weighted near-dated mass, a healthy chain can also go one-signed and is likewise reported unresolved.

The resolver hardening described above extended this NULL behavior to cover the *qualified*-crossing failure modes too. The flip is now persisted as **unresolved (NULL)** in any of the following:

- The profile is one-signed across the widest ladder rung (the original degraded-chain case).
- No ladder rung produces a crossing that passes all three acceptance gates (the brittle-near-edge / noise-floor / far-from-spot cases).

In all of these:

- The Gamma Flip column is persisted as NULL — a visible gap, not a fabricated edge value, not a frozen prior level.
- A WARN is emitted (visible in analytics-health) with usable-contract counts and resolver diagnostics.
- The carry-forward is gated: an explicitly unresolved flip will not silently re-freeze the last good level (the original flat-flip failure mode). A transient missing value with no degradation flag still carries forward, preserving back-compatibility.

---

## Multi-horizon view

*2026-05-22.*

The persisted **gamma_flip_point** is a single scalar resolved at the production horizon (**GAMMA_PROFILE_DTE_REF_DAYS**, default 5 days) — the right default for most consumers. But the same primitive can be re-evaluated at any horizon by substituting that constant for one call, so two on-demand endpoints expose multi-horizon views from one underlying calculation:

- **`GET /api/gex/flip-term-structure`** — returns the resolved flip at each requested multi-day horizon (e.g. `horizons=1,3,5,10,20,60`), each with its own resolver state (`resolved`, `span_used`, `net_gex_at_spot`). The whole curve is sign-consistent within each horizon because each horizon's flip and net-GEX-at-spot are still read off the same per-horizon profile.
- **`GET /api/gex/flip-surface`** — returns the full per-horizon dealer-gamma profile on a shared price grid, suitable for contour and 3D-surface visualizations, plus the resolver-validated flips overlaid as a line. Wall overlays (call wall, put wall) come from the chain-level production-weighted gex-by-strike, independent of horizon.

Both endpoints are currently labeled prototype: they compute on-demand (N times the per-cycle cost of the steady-state resolver, one re-greeked profile per horizon). A production deployment would pre-compute and persist per-horizon flips so reads become cheap; the contracts and the analytics methods (**compute_flip_term_structure**, **compute_flip_surface**) are already in place.

---

## What the customer will observe

- Live **gamma_flip_point** values shifted when the method changed — this was a deliberate definition correction to the recognized SpotGamma / SqueezeMetrics level, not a bug fix. Any absolute thresholds built on the old flip distance should be re-reviewed; relative usage is unaffected.
- For chains with material near-dated/0DTE OI, the flip moved a second time (separate from the method-change shift): with DTE weighting on by default, it now reports the multi-day regime level instead of a same-day-pinned one. Same guidance — re-review any absolute thresholds.
- The flip now tracks the market even when zero-gamma is several percent from spot (the previous stuck / flat-flip symptom is resolved), but the actionable-distance gate caps reported flips at ±8% of spot by default — beyond that the column is NULL by design, not a regression.
- The flip no longer reports values pinned to the literal grid edge (the QQQ "$839 / $802" pathology), nor noise-floor crossings during morning-open / IV-spike windows — those are rejected by the interior and structural gates and persisted as NULL with a health warning.
- Headline net-GEX and the spot-vs-flip regime are always consistent (both read off one curve).
- On degraded / stale data the flip shows a NULL gap rather than a frozen or fabricated value, with a corresponding health warning — by design, so a degraded feed is visible rather than masked.
- The multi-horizon endpoints (`/api/gex/flip-term-structure`, `/api/gex/flip-surface`) expose flips and the full dealer-gamma profile at any requested horizon — useful when an intraday signal and a swing thesis would naturally weight near-dated OI differently. The persisted dashboard scalar remains the 5-day-horizon value for back-compatibility.
