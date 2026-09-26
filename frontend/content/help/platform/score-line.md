# Reading the -100 to +100 Score Line

*Every signal score lives on the same number line. What sign and magnitude mean, when a 0 is a non-answer, and when to act.*

---

## Why the score line is fixed

Every ZeroGEX signal - Advanced or Basic - outputs its read on the same **-100 to +100** scale. (Under the hood each signal computes a value between -1 and +1; the app shows it multiplied by 100.) The benefit is obvious: cross-signal confluence becomes a fair comparison. A +50 on Squeeze Setup and a +50 on EOD Pressure are saying conceptually similar things about confidence.

The cost: each signal has a different **trade bias**, so the meaning of a +50 depends on which signal it came from.

The one headline number that isn't on this line is the Composite Score (MSI): a 0-100 regime gauge where 50 is neutral. See [Composite Score](/help/platform/composite-score).

## Sign

For directional signals, the sign maps to expected price direction:

- **Positive ⇒ bullish lean** (long-direction trade is the trade bias)
- **Negative ⇒ bearish lean**

For mean-reversion signals (Positioning Trap, Trap Detection), the sign maps to the **resolved directional lean** - the trade runs *against* the offside crowd or the failed break, so the sign still points the same way as the directional signals above:

- **Positive ⇒ bullish lean** - e.g. a short/bearish crowd at risk of squeezing higher, or a failed downside break you would buy
- **Negative ⇒ bearish lean** - e.g. a long/bullish crowd at risk of flushing lower, or a failed upside break you would sell

Know which kind of signal you're reading before you read the score. Each signal page's ⓘ tooltip and "How it's built" panel say what its sign means, and [Signals: Explained](/guides/signals-explained) lists every signal's trade bias.

## Magnitude

The closer to ±100, the higher the conviction. A practical rubric, based on the thresholds and labels the signal pages use:

| Score (either sign) | Read |
| --- | --- |
| 0 - 25 | Below the activation line for most signals. The pages call this balanced, flat, neutral or "no edge". No actionable read on its own. |
| 25 - 50 | A lean that's building. Most cards activate at ±25; EOD Pressure and Gamma/VWAP Confluence trigger a little earlier, at ±20. Filter, or trigger with confluence. |
| 50 - 70 | Strong read. Several signal pages switch to their strongest label at ±50 or ±60 - Positioning Trap calls it a squeeze or flush setup, for example. |
| 70 - 100 | The top of the scale. EOD Pressure and Volatility Expansion save their strongest labels for ±70 and up. Rare. Pay attention. |

Each signal page also prints its own one-line reading of the current score. Where the page and this table differ, go with the page. Range Break Imminence and Market Pressure Index don't trigger on the score at all - see Triggers vs. scores below.

## A score of 0 is almost never neutral

This is the most-missed point about signal scores.

A score of 0 typically means:

- The data is **insufficient** for the question this signal asks.
- The question doesn't apply right now (e.g., EOD Pressure before its 14:30 ET window opens).
- The inputs are **canceling cleanly** - equally bullish and bearish.

Any of those is a "no read", not a "neutral market". A market that's structurally neutral usually shows up as scores meandering around ±10 - not a clean zero.

Basic signals rarely show a true 0 at all: when one has no primary data, the engine shows a small tilt taken from the regime instead, within ±10. Treat a Basic score in single digits as "no read" too.

When you see a true 0, check the card and the signal page. The EOD Pressure and 0DTE Position Imbalance cards read *Inactive* while their window is closed, and many signal pages' "How it's built" panels say what a 0 means for that signal.

## Triggers vs. scores

Advanced signals have additional state on top of the score:

- A **trigger** that fires when the score crosses a threshold - ±25 for most, ±20 for EOD Pressure and Gamma/VWAP Confluence. The card reads *Triggered* or *Stand by*.
- A secondary metric (loading 0-100 for Market Pressure Index, imminence 0-100 for Range Break Imminence) that sets the trigger instead of the score: Market Pressure Index triggers at loading ≥ 50 with a clear direction, Range Break Imminence at imminence ≥ 65.

The score is the **read**; the trigger is the **event**. You can use the score as a filter without waiting for the trigger.

Basic signal cards are also outlined and marked *Triggered* past ±25, but for Basic signals that only highlights a strong read - there's no trigger rule behind it.

## Reading the sparkline

The slope matters as much as the level. Every dashboard card carries a sparkline; on a signal page, open **Expand score history**.

- A score at +40 trending **up** is a developing read - momentum is on its side.
- A score at +40 trending **down** from +70 is a fading read - the signal was right earlier, less so now.
- A score that flips sign in a short window is volatility, not conviction. Wait it out.

## When to act

A simple rule of thumb that has held up:

> Act on **confluence**, not on individual scores.

A single +70 on one signal is interesting. A +50 on three signals from independent dimensions (say, two Basic signals and an Advanced signal) is a trade. The composite isn't part of that tally - it's a 0-100 regime gauge, not a -100 to +100 directional score, so don't read its level as bull/bear.

## What changes if the regime changes

Cross the gamma flip and the **interpretation** of some scores changes:

- Gamma/VWAP Confluence: long-gamma above flip ⇒ mean-revert; short-gamma below flip ⇒ continuation.
- GEX Gradient flips with the regime: in short gamma, heavy gamma above spot scores bullish; in long gamma, heavy gamma below spot does, and the read is damped.
- Trap Detection only fires when dealers are modeled long gamma - in negative gamma it stays at 0.
- EOD Pressure pulls toward the pin in positive gamma; in negative gamma it leans with the recent move instead.

The signal cards account for this - but knowing it explains why the same score can mean different things on different days.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signals: Explained](/guides/signals-explained)
