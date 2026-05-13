# Squeeze Setup, Positioning Trap & Trap Detection: Three Signals, Three Stories

If you've spent any time in the Signals tab, you've probably noticed three names that sound like they're measuring the same thing: Squeeze Setup, Positioning Trap, and Trap Detection. They all output a tidy number between −1 and +1. They all flip sign depending on direction. And they all light up around the same kinds of pivots.

But under the hood, they're answering three very different questions about the tape. Understanding which question each one is asking is the difference between front-running a breakout and getting steamrolled by one.

This article breaks down what each signal actually measures, how to read it, and — most importantly — when *not* to trade off of it.

---

## The 30-Second Version

| | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Asks | "Is the market coiled?" | "Is the crowd offside?" | "Did this breakout just fail?" |
| Trade Bias | Continuation (with the move) | Mean-reversion (against the crowd) | Mean-reversion (back through the broken level) |
| Timeframe | Multi-day setup | Intraday (5–10 min) | Intraday → overnight |
| Headline Inputs | Flow, momentum acceleration, gamma readiness | Put/call ratio, smart-money imbalance | Wall proximity, gamma regime, wall migration |
| Output | [-1, +1], triggered at ±0.25 | [-1, +1], continuous | [-1, +1], triggered at ±0.25 |

Three signals. Three theses. Same number line.

---

## Squeeze Setup — "The Coiled Spring"

**What it measures:** Whether implied vol has compressed, gamma is dense, and flow is starting to lean directionally — i.e., whether the market has charged potential energy for a breakout.

**Inputs:**

- Call and put flow deltas, z-scored by per-symbol flow volatility
- 5-bar vs. 10-bar momentum (to detect acceleration, not just direction)
- Net gamma exposure, run through a smooth tanh for "gamma readiness"
- Distance from the gamma flip strike
- VIX regime (dead / normal / elevated / panic)

**How it scores:** For each side (bull and bear), the signal multiplies normalized flow × directional momentum strength × gamma readiness × acceleration multiplier × flip-side multiplier. The net score is bull minus bear, clamped to [-1, +1]. Triggers fire at abs(score) ≥ 0.25.

**What a trader does with it:** A positive Squeeze Setup that persists for two consecutive sessions is the trigger gate for the Squeeze Breakout playbook — entry on a clean break of a 30-bar volatility envelope, in the direction the signal is leaning. Negative scores mirror this on the downside.

> **Key intuition:** Squeeze Setup is the only one of the three that wants you to trade *with* the move. It's a continuation signal.

---

## Positioning Trap — "The Crowded Trade"

**What it measures:** Whether the options crowd is lopsidedly positioned (heavily long or heavily short) and the tape is starting to invalidate that bias — the classic setup for a short-cover squeeze or a long-side flush.

**Inputs:**

- 5-bar momentum
- Put/call ratio (the crowding measure)
- Signed smart-money imbalance: (call_signed − put_signed) / (abs(call) + abs(put))
- Gamma flip proximity
- Net GEX regime (smoothed via tanh)

**How it scores:** A weighted sum — 0.45 on crowding, 0.25 on imbalance skew, 0.15 on momentum, 0.10 on flip lean, 0.05 on negative-GEX regime — computed independently for the squeeze side (long crowd at risk) and flush side (short crowd at risk). The two are netted to a single score.

Unlike the other two, Positioning Trap has no triggered flag — it feeds the MSI composite as a continuous component (weight 0.06) and gates the `positioning_trap_squeeze` playbook at abs(score) ≥ 0.5.

**What a trader does with it:** Identify the crowded side, then wait for the tape to turn against it. A long crowd doesn't get squeezed until sellers show up. The signal tells you the fuel is there; the tape has to provide the spark.

> **Key intuition:** Positioning Trap fades the crowd's bet.

---

## Trap Detection — "The Failed Breakout"

**What it measures:** Whether price has poked through a key structural level — call wall, put wall, VWAP, max gamma strike, or gamma flip — but is failing to sustain the move, signaling dealers will fade it back.

**Inputs:**

- Call and put walls — and their prior positions (to detect wall migration)
- Max gamma strike, VWAP, gamma flip
- Net GEX and the rate of change of net GEX
- Call/put flow deltas (looking for deceleration)
- Realized volatility (used to scale the breakout buffer)

**How it scores:** First, the signal identifies the nearest broken level above and below the close, and applies a vol-scaled buffer (~0.15% × σ × √5) to confirm a real break. Then for each side it multiplies breakout strength × continuous long-gamma factor × GEX-strengthening factor × wall-migration penalty × magnitude × flow multiplier.

The wall-migration check is what makes this signal different: if the wall has moved *away* from price, the breakout is real, not a trap, and the score is heavily penalized.

**What a trader does with it:** A triggered bearish fade (price broke up, but dealers are long gamma and flow is decelerating) is the gate for the Overnight Trap Continuation playbook — a 1DTE debit positioned against the false breakout, held into the next session. Bullish fades mirror this on the downside.

> **Key intuition:** Trap Detection fades the price's break of a structural level.

---

## Same Number, Different Meaning

Here's the trap that traps traders: all three signals print a [-1, +1] score, and a +0.6 on one is not the same trade as a +0.6 on another.

| Score Sign | Squeeze Setup | Positioning Trap | Trap Detection |
|---|---|---|---|
| Positive (+) | Buy the breakout up | Fade short crowd → upside squeeze | Buy the failed breakdown |
| Negative (−) | Sell the breakout down | Fade long crowd → downside flush | Sell the failed breakout |
| Zero (0) | No coiled energy / no flow lean | No crowd extreme | No structural break failing |

A 0 doesn't mean "neutral market." It means *this specific question has no answer right now*. Squeeze Setup at 0 doesn't tell you positioning is balanced — it tells you nothing is compressed. Trap Detection at 0 doesn't tell you the crowd is fine — it tells you no level is being rejected.

Three signals are reading the same tape through three different lenses. Treat them that way.

---

## How to Read Them Together

A few patterns to look for:

**Confluence (high conviction):** Squeeze Setup +0.5 and Trap Detection +0.4 → the market is coiled to the upside and a downside break just failed. Both signals are pointing at the same trade from different angles.

**Sequence (better entries):** Positioning Trap flags a long crowd at +0.7 → wait. Trap Detection then flips negative (upside break fails) → that's the spark. Trade the fade with the crowd as fuel.

**Contradiction (stand down):** Squeeze Setup says +0.6 (go long with the break). Trap Detection says −0.5 (the upside break is failing). One of them is wrong. Skip it.

The signals are independent for a reason — when they agree, listen. When they fight, the smartest trade is usually no trade.
