# Advanced Signal Dashboard

*The event-driven signals - what each asks, when each fires, and how to use them.*

---

## What the Advanced Signal Dashboard is

The Advanced Signal Dashboard (Pro) is the **trigger grid** for all eight Advanced signals. A strip at the top shows all eight scores. Below it are three tabs - **Signal Grid**, **Confluence Matrix** and **Event Timelines**. Each card in the grid shows the score on -100 to +100, the level it activates at, a status of *Triggered* or *Stand by*, a sparkline, and **Context values** you can expand. EOD Pressure and 0DTE Position Imbalance read *Inactive* while their time window is closed.

Advanced signals are **event-driven**. Each produces a continuous, modeled score - a derived read, not a guaranteed forecast - but the interesting moment is when the score crosses the signal's trigger threshold. None of the eight is part of the Composite Score (MSI).

## The eight signals

| Signal | Asks | Trade bias | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | "Is the close getting pinned?" | Directional | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | "Are key levels stacking up here?" | Mean-rev (long gamma) / Continuation (short gamma) | \|score\| ≥ 20 |
| Market Pressure Index | "Is the market loaded to move?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | "Is this range about to break?" | Regime / playbook switch | imminence ≥ 65 |
| Squeeze Setup | "Is the market coiled?" | Continuation | \|score\| ≥ 25 |
| Trap Detection | "Did this breakout just fail?" | Mean-reversion (vs. price break) | \|score\| ≥ 25 |
| Volatility Expansion | "Is volatility about to break out?" | Continuation | \|score\| ≥ 25 |
| 0DTE Position Imbalance | "Are 0DTE traders leaning one way?" | Directional | \|score\| ≥ 25 |

## Quick read on each

### EOD Pressure

Active in the last 90 minutes. Ramps from 14:30 ET, peaks around 15:45 ET. Built from dealer charm at spot, pin gravity, realized vol, and witching flags. Reads "the close *may* be pinned toward X" with a direction - a modeled lean, since pinning is probabilistic.

### Gamma/VWAP Confluence

Stacks gamma flip, VWAP, max pain, max-gamma strike, and call wall. Asks whether these levels are aligned at a price. In positive gamma, confluence reads are fades; in negative gamma, they're continuation reads.

### Market Pressure Index

The all-in "is the market loaded" read. Combines wall pinch, flip proximity, regime, vanna/charm, the DNI, premium and smart-money flow skew, IV rank, and realized vol compression. Two-dimensional: a **loading 0-100** and a **direction -1 to +1**.

### Range Break Imminence

20-bar compression read. Skew delta + dealer delta + trap pressure + 10/60-bar compression ratio. Outputs both a score and a 0-100 imminence. Fires at imminence ≥ 65 - the start of the Break Watch band (80 and up is Breakout Mode), where the page says to stop blindly fading the range.

### Squeeze Setup

Multi-day setup detector. Flow z-score, 5/10-bar momentum, gamma readiness, flip distance, VIX regime. Continuation bias - a derived read that the market *may* be coiled toward X, not a guaranteed next leg.

### Trap Detection

The failed-breakout detector. Walls (current + prior), VWAP, flip, net GEX and ΔGEX, flow deltas. Mean-reversion bias - it flags a break through a key level (a wall, VWAP, the gamma flip or the max-gamma strike) as likely to fail when dealers are modeled long gamma and gamma is strengthening; a wall migrating with the break weakens the read. It stays at 0 in negative gamma.

### Volatility Expansion

5-bar momentum window scaled by realized vol. Net GEX + vol-normalized momentum z-score + realized vol. Asks whether vol is about to expand. Continuation read.

### 0DTE Position Imbalance

0DTE-window read. Weighted by hours-to-close. Call/put flow imbalance, smart-money C/P ratio, PCR, moneyness buckets. Tells you which way 0DTE traders are leaning today.

## How triggers work

When a signal's trigger crosses:

1. Its card is outlined and tinted in the direction of the score, and its status changes from *Stand by* to *Triggered*.
2. The Composite Score doesn't change - Advanced signals aren't part of the MSI.

There's no alert or log entry: nothing is pushed to you, and nothing lands in the Live Bulletin. A card stays *Triggered* for as long as the score holds past its threshold. To see what happened earlier, open the **Event Timelines** tab or the signal's own page - the timeline plots the score over the last two sessions with direction flips marked.

## Reading the dashboard

Two patterns:

1. **Look for active triggers.** Triggered cards are outlined and tinted in the grid. The cards keep a fixed order, so scan for color.
2. **Look for stacked triggers.** Two or more Advanced signals firing in the same direction is the highest-confluence read on the platform. The **Confluence Matrix** tab shows which pairs tend to agree. Add the composite for the structural read.

## Each card has a deep-dive page

Click any card and you get the individual signal page with the score and its history, the inputs, the "How it's built" explanation, and the Event Timeline.

## Important: trade bias matters

Some Advanced signals are continuation, some are mean-reversion. Trap Detection fades a *failed price break*, not a breakout: a **positive** score means a downside break failed (the fade is up - buy the failed breakdown), a **negative** score means an upside break failed (the fade is down) - the mirror image of a continuation signal like Squeeze Setup. Always check which kind of signal you're reading - [Signals: Explained](/guides/signals-explained) lists each signal's trade bias.

## See also

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
