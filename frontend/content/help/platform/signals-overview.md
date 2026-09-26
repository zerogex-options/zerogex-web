# How Signals Work End-to-End

*The full signal model - Advanced vs. Basic, how they relate to the Composite Score and Trade Bias, what the cards show you, and how to use it all.*

---

## The two families

ZeroGEX runs **two families** of signals. They behave differently, on purpose.

- **Advanced signals** (Pro) ask a sharp, situational question - *"is the close getting pinned?"*, *"did this breakout just fail?"*. Each produces a score on a **-100 to +100** line **and** a discrete **trigger**: once the score crosses the signal's threshold, its card switches from *Stand by* to *Triggered*, and the trigger can gate a playbook. They are event-driven.
- **Basic signals** (Basic and Pro) are continuous. They don't fire, and they carry **no weight in the Composite Score (MSI)** - they're advisory reads that sit alongside it. Their value is in agreement (conviction) or disagreement (divergence): when the flow-side reads diverge from the structure reads, a regime shift is often underway before the MSI moves.

That is the most important distinction. Internalize it before reading individual signal pages.

## The score line

Every ZeroGEX signal - Advanced or Basic - lives on the same number line: **-100 to +100**.

- **Sign** tells you direction. For most signals positive is bullish and negative is bearish - but some are mean-reversion or otherwise sign-inverted, so a positive score doesn't always mean "go long." Check the signal's trade bias (below) before you read its sign.
- **Magnitude** tells you conviction. The closer the score is to ±100, the stronger the read.
- **A 0 score is almost never neutral.** For most signals it means the data is insufficient or this specific question has no answer right now. Read a 0 as "no read", not "no trade".

See [Reading the -100 to +100 Score Line](/help/platform/score-line) for the full deep-dive.

## Triggers (Advanced signals only)

Each Advanced signal has a trigger threshold:

| Signal | Trigger threshold |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

When a signal's trigger crosses:

1. Its card on the Advanced Signal Dashboard is outlined and tinted in the direction it fired, and its status changes from *Stand by* to *Triggered*.
2. The Composite Score does **not** move - Advanced signals aren't part of the MSI.

Nothing is pushed to you, and nothing is added to the Live Bulletin. To look back at what a signal did, use its Event Timeline - see [Signal Alerts](/help/platform/alerts).

## The composite (MSI)

The Composite Score (Market State Index, MSI) is a separate read, built from **six option-structure components**: net GEX sign, gamma anchor, put/call ratio, volatility regime, smart-money order-flow imbalance, and dealer delta pressure. The Basic and Advanced signals aren't among its inputs.

The composite is a **0-100 regime score**, where 50 is neutral - not a point on the -100 to +100 line. A high reading (≥ 70) means a trend / expansion regime where trends can run; a low reading (< 20) is the Compression band, where moves have historically traveled the least. It tells you the regime, not the direction - for which way, read Trade Bias.

Where the signals do come together:

- **Trade Bias** folds the MSI and several Basic and Advanced signals into one directional call. The full page is Pro; a compact card sits on the Main Dashboard.
- **Signal Breadth**, on the Main Dashboard, counts how many signals lean bullish, neutral or bearish.

See [Composite Score](/help/platform/composite-score) for the full breakdown.

## Anatomy of a signal page

Each signal page on ZeroGEX has the same anatomy. Once you know it, every signal is a quick read.

1. **Title and question** - the signal's name, the question it asks, and an ⓘ tooltip with the short version of how it works.
2. **Score hero** - the current score on -100 to +100, a one-line reading of it, and an expandable score history.
3. **Input panels** - the headline inputs that drive the score (e.g., for EOD Pressure: the time ramp, the pin target, dealer charm at spot, and the gamma regime).
4. **"How it's built"** - the math, in formulas and short notes.
5. **Event Timeline** - the score's path over the last two sessions, with direction flips marked and the underlying's move over the next 30, 60 or 120 minutes.

The order is consistent across pages.

## Trade bias categories

Every signal has a declared trade bias; [Signals: Explained](/guides/signals-explained) lists each one.

- **Directional read** - score sign maps to expected price direction.
- **Mean-reversion (vs. crowd)** - the score reflects fading the crowd, not price: a positive score flags a bearish-leaning crowd that can squeeze *higher*, a negative score a bullish-leaning crowd that can flush *lower*.
- **Mean-reversion (long gamma)** - fade extension toward the mean when dealers are long gamma.
- **Continuation** - score sign maps to the next leg's direction.
- **Regime / playbook switch** - the signal tells you to change strategy, not to take a trade.

Match the trade bias to your strategy. A continuation signal is not a fade.

## How to use the signals

Three patterns:

1. **As a filter.** Don't take trend/breakout trades when MSI is low (choppy regime). Don't fade rallies in negative gamma.
2. **As a trigger.** Use an Advanced signal trigger as the entry cue, with your own stop and target.
3. **As confluence.** Stack two or three independent signals (a Basic signal read + an Advanced trigger + the Trade Bias card on the Main Dashboard).

## What signals don't do

- They don't give you exits.
- They don't size your trade.
- They don't know your risk tolerance.

Use them inside a rule-based process, not as standalone trade tickets.

## See also

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained) - the full reference matrix
