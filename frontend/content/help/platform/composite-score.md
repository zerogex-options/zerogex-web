# Composite Score

*The blended read of the current market **regime** — how it's built, why it is not a direction call, and how to use it as a filter rather than a forecast.*

---

## What the Composite Score is

The Composite Score — internally **MSI**, the Market State Index — is the **single-number summary of the current option-structure regime** on the active symbol. It answers one question: *is the tape likely to trend, or to chop?*

It lives on a **0–100 scale, where 50 is neutral.** It is **not** a directional score — it does not tell you bull vs. bear. A high MSI means trends are likely to *run*; a low MSI means the tape is *pinned, choppy, or fragile*. For direction, read [Trade Bias](/help/platform/trade-bias) — that is the signed, bull-vs-bear read.

> **A high MSI does not mean "bullish." It means trends can run.**
> **A low MSI does not mean "bearish." It means trends are unlikely to work.**

## The regime bands

| Score | Regime | What it means |
| --- | --- | --- |
| ≥ 70 | **Trend / Expansion** | Widest forward travel of the four bands, historically |
| 40 – 70 | **Controlled Trend** | Above-average forward travel |
| 20 – 40 | **Chop / Range** | Below-average forward travel |
| < 20 | **Compression** | Narrowest forward travel of the four bands, historically |

The bands are ordered by measured forward travel: readings in the top band have historically been followed by the widest range, the bottom band by the narrowest. That ordering holds at every horizon we tested, but the effect is modest — it shifts the odds, it does not determine them.

One caveat we would rather state than hide: the score is not a pure regime read. Two of its six components measure the *direction* of options flow rather than how far price travels, and they enter the score signed. In practice a strongly bearish tape can pull the score into the lower bands even when the options structure has not changed. We are separating the two reads; until that lands, treat a low score during a sharp decline as partly a directional signal rather than purely a range forecast.

## How it's built

The MSI blends **six independent components**, each scored on a −1…+1 line and weighted into a point budget that sums to 100:

| Component | Points | Reads |
| --- | --- | --- |
| Gamma Anchor | 30 | Proximity to gamma flip, local gamma density, max-gamma strike — pinned vs. free |
| Order Flow Imbalance | 19 | Smart-money call vs. put premium — *the one directional input* |
| Dealer Delta Pressure | 17 | Dealer forced-hedge direction |
| Net GEX Sign | 16 | Dealers long gamma (damps moves) vs. short gamma (amplifies) |
| Put/Call Ratio | 12 | Structural-fragility proxy |
| Volatility Regime | 6 | Live vol vs. the 20-vol pivot |

The components are summed onto the neutral-50 baseline through a soft-saturating (tanh) blend, so no single input can pin the gauge on its own. **Roughly two-thirds of the weight is directionless structure** (Gamma Anchor, Net GEX Sign, Put/Call, Vol) — these push toward *trend* or *chop*, not up or down. Only Order Flow Imbalance and Dealer Delta are genuinely directional, which is why a strongly one-sided tape can nudge the score even though the gauge is a regime read.

For each component, **+1 argues for a tradable / trending regime; −1 argues for chop / pinning / reversal.**

## The MSI gauge

The Composite Score page shows:

- The **MSI gauge** — score on the 0–100 arc, colored by *regime band* (not by bull/bear).
- The **regime label** — Trend / Expansion, Controlled Trend, Chop / Range, or Compression.
- The **contributing components** panel — each input's current push, right for "trending," left for "chop / reversal," sorted by magnitude.
- The **Δ since open** and **Δ last 5 min** — how far the regime score has moved (toward trend if positive, toward chop if negative). These are regime momentum, not direction.
- A **sparkline** of the score over the session.

## Reading the composite

A simple rubric — read it as *how much to trust a trend*, and take direction from Trade Bias:

| Composite | Read |
| --- | --- |
| ≥ 70 | Trending regime — trends in the prevailing bias can run; press with the trend |
| 40 – 70 | Controlled trend — a real but moderate edge; size down |
| 20 – 40 | Chop / range — fade the extremes, don't chase breakouts, favor defined-risk |
| < 20 | Fragile / high-reversal-risk — mean-reversion only, expect failed breakouts |

The most useful extremes are the top and the bottom. The middle (~40–60) is a "no strong regime" zone — don't force a trend trade out of it.

## How to use it

Three patterns:

1. **As a conviction dial on direction.** Trade Bias gives you the side; the MSI tells you how hard to press it. Long bias + MSI 75 → press it. Long bias + MSI 25 → buy the dip small, fade the extremes, don't chase.
2. **As a chop filter.** Don't put on trend/breakout trades when the MSI is low (< 40) — the tape is choppy or mean-reverting *regardless of direction*. A low score is not a signal to go short.
3. **As a regime confirmer.** MSI reads *tend to* be stronger and more persistent in negative-gamma sessions, consistent with the more directional behavior those regimes tend to show.

## What it isn't

The composite is **not a trade signal**, and it is **not a direction call.** It tells you what *kind* of tape you're in — trend vs. chop; it does not tell you which way, what timeframe to use, or where to put your stop. Pair it with Trade Bias (direction) and the individual signals (triggers).

## Why the composite can flip fast

Two reasons:

- A gamma-flip cross can swing the structural components (Gamma Anchor, Net GEX Sign) hard, moving the regime read quickly.
- A sharp shift in smart-money flow moves the one directional component enough to nudge the blend.

The sparkline makes these step-changes visible — look for the discontinuities.

## Trader habits we've seen work

- Read the MSI at the open and at 11:00 / 12:30 / 14:30 ET as your check-ins.
- Treat the MSI as position **sizing**, and Trade Bias as position **direction**.
- Treat scores between ~40 and ~60 as "no strong regime — wait" rather than a direction.

## Tier note

The Composite Score page is Pro-only. The MSI gauge also appears on the Dashboard for all paid tiers.

## See also

- [Trade Bias](/help/platform/trade-bias) — the signed, directional read
- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Signals: Explained](/guides/signals-explained)
