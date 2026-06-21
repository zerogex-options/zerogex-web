# Advanced Signal Dashboard

*The event-driven signals — what each asks, when each fires, and how to use them.*

---

## What the Advanced Signal Dashboard is

The Advanced Signal Dashboard is the **trigger grid** for all eight Advanced signals. Each card shows the score on [-1, +1], the trigger state (idle, hot, just fired), and a sparkline.

Advanced signals are **event-driven**. Each produces a continuous score, but the interesting moment is when the score crosses the signal's trigger threshold.

## The eight signals

| Signal | Asks | Trade bias | Trigger |
| --- | --- | --- | --- |
| EOD Pressure | "Is the close getting pinned?" | Directional | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | "Are key levels stacking up here?" | Mean-rev (long gamma) / Continuation (short gamma) | abs(score) ≥ 0.20 |
| Market Pressure Index | "Is the market loaded to move?" | Continuation | loading ≥ 50 AND \|dir\| ≥ 0.20 |
| Range Break Imminence | "Is this range about to break?" | Regime / playbook switch | imminence ≥ 65 |
| Squeeze Setup | "Is the market coiled?" | Continuation | abs(score) ≥ 0.25 |
| Trap Detection | "Did this breakout just fail?" | Mean-reversion (vs. price break) | abs(score) ≥ 0.25 |
| Volatility Expansion | "Is volatility about to break out?" | Continuation | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | "Are 0DTE traders leaning one way?" | Directional | abs(score) ≥ 0.25 |

## Quick read on each

### EOD Pressure

Active in the last 90 minutes. Ramps from 14:30 ET, peaks around 15:45 ET. Built from dealer charm at spot, pin gravity, realized vol, and witching flags. Reads "the close is being pinned to X" with a direction.

### Gamma/VWAP Confluence

Stacks gamma flip, VWAP, max pain, max-gamma strike, and call wall. Asks whether these levels are aligned at a price. In positive gamma, confluence reads are fades; in negative gamma, they're continuation reads.

### Market Pressure Index

The all-in "is the market loaded" read. Combines wall pinch, flip proximity, regime, vanna/charm, the DNI, premium and smart-money flow skew, IV rank, and realized vol compression. Two-dimensional: a **loading 0–100** and a **direction -1 to +1**.

### Range Break Imminence

20-bar compression read. Skew delta + dealer delta + trap pressure + 10/60-bar compression ratio. Outputs both a score and a 0–100 imminence. Fires at imminence ≥ 65 — meaning the range is genuinely tight relative to its recent history.

### Squeeze Setup

Multi-day setup detector. Flow z-score, 5/10-bar momentum, gamma readiness, flip distance, VIX regime. Continuation bias — reads "the market is coiled, the next leg is X".

### Trap Detection

The failed-breakout detector. Walls (current + prior), VWAP, flip, net GEX and ΔGEX, flow deltas. Mean-reversion bias — fires when a break above the call wall or below the put wall snaps back.

### Volatility Expansion

5-bar momentum window scaled by realized vol. Net GEX + vol-normalized momentum z-score + realized vol. Asks whether vol is about to expand. Continuation read.

### 0DTE Position Imbalance

0DTE-window read. Weighted by hours-to-close. Call/put flow imbalance, smart-money C/P ratio, PCR, moneyness buckets. Tells you which way 0DTE traders are leaning today.

## How triggers work

When a signal trigger crosses:

1. The signal card on the dashboard glows in the direction of the score.
2. An entry lands in the [Live Bulletin](/help/platform/live-bulletin) with the score, the trigger threshold, and a one-line context.
3. The composite reflects the higher conviction.

A signal can stay in "hot" state for multiple bars. The bulletin entry shows the **first** trigger crossing; subsequent bars within the same hot state are aggregated.

## Reading the dashboard

Two patterns:

1. **Look for active triggers.** Hot cards bubble to the top in the default layout.
2. **Look for stacked triggers.** Two or more Advanced signals firing in the same direction is the highest-confluence read on the platform. Add the composite for the structural read.

## Each card has a deep-dive page

Click any card and you get the individual signal page with the score sparkline, the inputs, the trigger history, and the "How it's built" explanation.

## Important: trade bias matters

Some Advanced signals are continuation, some are mean-reversion. Trap Detection firing positive does **not** mean "go long" — it means "fade the failed breakout to the downside". Always check the trade bias chip on the card.

## See also

- [Composite Score](/help/platform/composite-score)
- [Basic Signal Dashboard](/help/platform/basic-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
- [Squeeze Setup, Positioning Trap & Trap Detection](/education/squeeze-setup-positioning-trap-and-trap-detection)
- [Trading the Close: EOD Pressure & Trap Detection](/education/eod-pressure-and-trap-detection)
