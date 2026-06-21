# How Signals Work End-to-End

*The full signal model — Advanced vs. Basic, how scores combine, what the cards show you, and how to use it all.*

---

## The two families

ZeroGEX runs **two families** of signals. They behave differently, on purpose.

- **Advanced signals** ask a sharp, situational question — *"is the close getting pinned?"*, *"did this breakout just fail?"*. Each produces a score on a **[-1, +1]** line **and** a discrete **trigger**: once the score crosses the signal's threshold, it fires an alert and can gate a playbook. They are event-driven.
- **Basic signals** are continuous. They don't fire — instead they feed the **MSI composite** with a fixed weight, nudging the blended read up or down on every refresh. You see them as inputs to the bigger picture, not as standalone alerts.

That is the most important distinction. Internalize it before reading individual signal pages.

## The score line

Every ZeroGEX signal — Advanced or Basic — lives on the same number line: **[-1, +1]**.

- **Sign** tells you direction. Positive is bullish; negative is bearish. Some signals are mean-reversion (so a positive score means "fade higher"); those carry a clear "trade bias" chip on the page.
- **Magnitude** tells you conviction. The closer the score is to ±1, the stronger the read.
- **A 0 score is almost never neutral.** For most signals it means the data is insufficient or this specific question has no answer right now. Read a 0 as "no read", not "no trade".

See [Reading the [-1, +1] Score Line](/help/platform/score-line) for the full deep-dive.

## Triggers (Advanced signals only)

Each Advanced signal has a trigger threshold:

| Signal | Trigger threshold |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

When a signal trigger crosses, three things happen:

1. The signal card on the dashboard glows in the direction it fired.
2. An entry lands in the [Live Bulletin](/help/platform/live-bulletin).
3. The composite score reflects the higher conviction.

## The composite (MSI)

The Composite Score (Market Score Indicator, MSI) is the **blended read across all signals**. Each Basic signal contributes a fixed weight; Advanced signals contribute when their trigger is hot.

The composite sits on the same [-1, +1] line. A composite reading above +0.4 with multiple signals contributing in the same direction is a high-confluence read. A composite hovering near 0 with mixed contributions is intentionally "no read".

See [Composite Score](/help/platform/composite-score) for the full breakdown.

## Anatomy of a signal page

Each signal page on ZeroGEX has the same anatomy. Once you know it, every signal is a quick read.

1. **Title + score hero** — the score, the trigger state, and the timeframe.
2. **Trade-bias chip** — directional, mean-reversion, continuation, regime-switch.
3. **Sparkline panel** — the score over the most recent window.
4. **Input panel** — the headline inputs that drive the score (e.g., for EOD Pressure: dealer charm, pin gravity, realized vol).
5. **"How it's built"** — plain-English explanation of the math.
6. **Recent triggers** — the audit log of recent firings.

The order is consistent across pages.

## Trade bias categories

Every signal has a declared trade bias. It's on the card and on the signal page.

- **Directional read** — score sign maps to expected price direction.
- **Mean-reversion (vs. crowd)** — high positive score means "fade higher"; trades opposite of the crowd's positioning.
- **Mean-reversion (long gamma)** — fade extension toward the mean when dealers are long gamma.
- **Continuation** — score sign maps to the next leg's direction.
- **Regime / playbook switch** — the signal tells you to change strategy, not to take a trade.

Match the trade bias to your strategy. A continuation signal is not a fade.

## How to use the signals

Three patterns:

1. **As a filter.** Don't take long trades when the composite is at -0.6. Don't fade rallies in negative gamma.
2. **As a trigger.** Use an Advanced signal trigger as the entry cue, with your own stop and target.
3. **As confluence.** Stack two or three independent signals (a Basic regime read + an Advanced trigger + the dashboard's trade bias chip).

## What signals don't do

- They don't give you exits.
- They don't size your trade.
- They don't know your risk tolerance.

Use them inside a rule-based process, not as standalone trade tickets.

## See also

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) — the full reference matrix
