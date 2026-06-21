# Composite Score

*The blended read across all ZeroGEX signals — how it's built, how to read it, and how to use it as a filter rather than a forecast.*

---

## What the Composite Score is

The Composite Score — internally **MSI**, the Market Score Indicator — is the **single-number summary** of all ZeroGEX signals on the active symbol. It lives on the same **[-1, +1]** line as every other signal score.

Positive composite ⇒ structural bullish lean. Negative ⇒ structural bearish lean. Magnitude is conviction.

## How it's built

Three rolling inputs blend into one number:

1. **Basic signals** — each Basic signal contributes a small fixed weight (4–8% of the composite). Even when they don't fire, they nudge the composite continuously in the background.
2. **Advanced signal triggers** — when an Advanced signal trigger is hot, it contributes its signed score with a higher weight.
3. **Regime context** — the active gamma regime acts as a multiplier on the directional inputs.

The weights are tuned to keep no single signal from dominating. A composite reading near ±0.4–0.6 typically requires several inputs aligning.

## The MSI gauge

The Composite Score page shows:

- The **MSI gauge** — score on the [-1, +1] line, with color coding from deep red to deep green.
- The **trigger state** — whether the composite has crossed an attention threshold.
- The **contributing signals** panel — each input with its current contribution to the composite, sorted by magnitude.
- The **regime header** — Positive Gamma, Negative Gamma, or Transitioning.
- A **sparkline** of the composite over the last session.

## Reading the composite

A simple rubric:

| Composite | Read |
| --- | --- |
| ≥ +0.6 | Strong bullish — multiple signals aligned long, regime supports it |
| +0.3 to +0.6 | Lean bullish — bias is real but not overwhelming |
| -0.3 to +0.3 | No read — composite is unhelpful, look at individual signals |
| -0.6 to -0.3 | Lean bearish |
| ≤ -0.6 | Strong bearish |

The most useful range is the extremes. The middle is intentionally a "the data isn't telling you anything" zone — don't force trades out of it.

## How to use it

Three patterns:

1. **As a filter.** Don't put on long-direction trades when the composite is at -0.6 unless your edge is specifically counter-trend.
2. **As a confluence check.** A high-confidence Advanced trigger backed by a composite in the same direction is a higher-confidence read than the trigger alone.
3. **As a regime confirmer.** Composite reads tend to be stronger and more persistent in negative gamma sessions — they line up with the underlying market behavior.

## What it isn't

The composite is **not a trade signal**. It tells you whether the structural picture leans one way; it does not tell you to take a trade, what timeframe to use, or where to put your stop.

## Why the composite can flip fast

Two reasons:

- A high-weight Advanced signal can trigger and dominate the read.
- The regime context (gamma flip cross) can shift the multiplier on everything else.

The sparkline makes these step-changes visible — look for the discontinuities.

## Trader habits we've seen work

- Read the composite at the open and at 11:00 / 12:30 / 14:30 ET as your check-ins.
- Don't trade against the composite during the EOD Pressure window.
- Treat composite scores between -0.3 and +0.3 as "wait" rather than "neutral".

## Tier note

The Composite Score page is Pro-only. The composite gauge also appears on the Dashboard for all paid tiers.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Reading the [-1, +1] Score Line](/help/platform/score-line)
- [Signals: Explained](/guides/signals-explained)
