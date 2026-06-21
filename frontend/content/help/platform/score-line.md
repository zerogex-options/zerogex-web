# Reading the [-1, +1] Score Line

*Every signal score lives on the same number line. What sign and magnitude mean, when a 0 is a non-answer, and when to act.*

---

## Why the score line is fixed

Every ZeroGEX signal — Advanced or Basic — outputs its read on the same **[-1, +1]** scale. The benefit is obvious: cross-signal confluence becomes a fair comparison. A +0.5 on Squeeze Setup and a +0.5 on EOD Pressure are saying conceptually similar things about confidence.

The cost: each signal has a different **trade bias**, so the meaning of a +0.5 depends on which signal it came from.

## Sign

For directional signals, the sign maps to expected price direction:

- **Positive ⇒ bullish lean** (long-direction trade is the trade bias)
- **Negative ⇒ bearish lean**

For mean-reversion signals (Positioning Trap, Trap Detection in some configurations), the sign maps to the **direction of the move you should fade**:

- **Positive ⇒ the move higher is offside / failed** (fade up)
- **Negative ⇒ the move lower is offside / failed** (fade down)

The signal card on every page declares which one applies. Read the trade-bias chip before reading the score.

## Magnitude

The closer to ±1, the higher the conviction. Practical rubric:

| Range | Read |
| --- | --- |
| 0.0 – 0.2 | Inside noise. No actionable read. |
| 0.2 – 0.4 | Soft lean. Filter, not trigger. |
| 0.4 – 0.6 | Solid read. Combined with confluence, tradeable. |
| 0.6 – 0.8 | Strong read. The signal is making a real statement. |
| 0.8 – 1.0 | Maximum conviction. Rare. Pay attention. |

## A score of 0 is almost never neutral

This is the most-missed point about signal scores.

A score of 0 typically means:

- The data is **insufficient** for the question this signal asks.
- The question doesn't apply right now (e.g., EOD Pressure during the open).
- The inputs are **canceling cleanly** — equally bullish and bearish.

Any of those is a "no read", not a "neutral market". A market that's structurally neutral usually shows up as scores meandering around ±0.1 — not a clean zero.

When you see a true 0, hover the signal card. The tooltip explains why.

## Triggers vs. scores

Some Advanced signals have additional state on top of the score:

- A discrete **trigger** (yes/no) that fires when the score crosses a threshold.
- A secondary metric (loading 0–100 for Market Pressure, imminence 0–100 for Range Break) that gates the trigger independently of the score.

The score is the **read**; the trigger is the **event**. You can use the score as a filter without waiting for the trigger.

## Reading the sparkline

The slope matters as much as the level.

- A score at +0.4 trending **up** is a developing read — momentum is on its side.
- A score at +0.4 trending **down** from +0.7 is a fading read — the signal was right earlier, less so now.
- A score that flips sign in a short window is volatility, not conviction. Wait it out.

## When to act

A simple rule of thumb that has held up:

> Act on **confluence**, not on individual scores.

A single +0.7 on one signal is interesting. A +0.5 on three signals from independent dimensions (a Basic signal, an Advanced signal, the composite) is a trade.

## What changes if the regime changes

Cross the gamma flip and the **interpretation** of some scores changes:

- Gamma/VWAP Confluence: long-gamma above flip ⇒ mean-revert; short-gamma below flip ⇒ continuation.
- Trap Detection is sharper in negative gamma.
- EOD Pressure pins harder in positive gamma.

The signal cards account for this — but knowing it explains why the same score can mean different things on different days.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signals: Explained](/guides/signals-explained)
