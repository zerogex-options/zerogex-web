# Squeeze Setup Signal Explained: Reading Coiled Markets

*The practical deep-dive on the ZeroGEX Squeeze Setup signal — what it measures, the five inputs that drive the score, when it triggers versus stays silent, and how to use it to identify markets coiled for a directional move.*

---

## Why this signal exists

Most options-flow tools tell you something is happening *right now*. Almost nothing tells you the tape has quietly **stored** the energy to move — that flow, momentum, gamma, and volatility are all aligning before the actual move fires.

That is the gap the Squeeze Setup signal is built to fill. It does not predict direction outright. It tells you when the conditions for a directional move have stacked up across multiple structural inputs, so when the catalyst arrives, the move has fuel behind it.

This piece is the trader-facing read on the Squeeze Setup signal. It covers what it asks, how it is scored, when it fires versus stays silent, and how to act inside a session. The full ZeroGEX signal reference lives in the [Signals: Explained guide](/guides/signals-explained), and the structural mechanics that drive most of its inputs are covered in the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## What is the Squeeze Setup signal?

The Squeeze Setup signal asks one question:

> Is the market coiled — are flow, momentum, gamma, and volatility aligning to load energy that has not yet been released?

It is an **Advanced** signal in the ZeroGEX stack — it produces both a continuous score on the [-1, +1] number line and a discrete trigger when the absolute score crosses **0.25**.

Critically, Squeeze Setup is a **Continuation** signal, not a fade. When it fires, the practical lean is to trade *with* the move once it breaks, not against it. That makes it the opposite of mean-reversion tools like Positioning Trap or Trap Detection. Knowing which bucket a signal lives in is half of reading it correctly.

---

## The mechanism: how compression builds up

Markets don't always coil before they move — but when they do, certain measurable conditions tend to cluster:

1. **Flow has started leaning directionally.** Call premium is consistently dominating put premium, or the reverse — and the lean is large enough relative to the symbol's typical flow volatility that it stands out.
2. **Short-term momentum is accelerating.** 5-bar momentum is outpacing 10-bar. The slope is steepening, not just trending.
3. **Net gamma is dense enough that hedging matters.** A flat dealer book doesn't propagate moves; a loaded one does.
4. **Spot is positioned relative to the gamma flip in a way that opens upside.** If spot is just below the flip and flow is bullish, the structural setup for a flip-cross-and-extend is on.
5. **Vol regime is right.** A panic VIX regime dampens setups (everything is already moving); a dead VIX regime can produce false coils.

Squeeze Setup combines all five into a single continuous score per side (bull and bear), then nets them.

---

## The five headline inputs

| Input | What it captures |
|---|---|
| Flow z-score | Call/put flow deltas z-scored by per-symbol flow volatility — a "big" flow on a quiet symbol is treated as meaningful; a "big" flow on a noisy symbol has to clear a higher bar |
| 5/10-bar momentum | Two horizons compared, looking for acceleration (5-bar outpacing 10-bar) rather than just direction |
| Gamma readiness | Net gamma run through a smooth tanh, giving "is the book loaded enough to matter?" as a continuous 0-1 multiplier |
| Flip distance | How close spot is to the gamma flip, with the side multiplied in so a bull setup near the flip from below scores higher |
| VIX regime | Dead / normal / elevated / panic — used to dampen or amplify the score depending on context |

The output is one number, but it carries the joint structure of all five.

---

## How the score is computed

For each side (bull and bear), the signal multiplies:

```
side_score = normalized_flow × directional_momentum_strength
           × gamma_readiness × acceleration_multiplier × flip_side_multiplier
```

The net score is `bull_score − bear_score`, clamped to [-1, +1]. The trigger fires at absolute score ≥ **0.25**.

Two structural facts about that formula matter for reading:

- **Every term multiplies, not adds.** If any one of the five terms goes to zero, the side zeroes. The signal is opinionated about *when* squeezes work — it refuses to fire when one of the conditions isn't met, even if the others are screaming.
- **Bull and bear sides are computed independently, then netted.** In rare cases where both fire simultaneously (genuinely contested setups), they partially cancel — appropriate, because the read is ambiguous.

---

## Score interpretation

| Score | Reading |
|---|---|
| +0.6 to +1.0 | Strongly coiled to the upside |
| +0.25 to +0.6 | Triggered bullish — the upside breakout playbook is on |
| -0.25 to +0.25 | Sub-threshold — informational, not actionable on its own |
| -0.25 to -0.6 | Triggered bearish — the downside breakout playbook is on |
| -0.6 to -1.0 | Strongly coiled to the downside |

The 0.25 threshold is deliberately conservative. Squeeze Setup is asking a high bar — does *every* structural input align? — and the threshold reflects that. A 0.20 read is borderline; only 0.25+ counts as triggered.

---

## When the signal fires versus stays silent

The dominant state is **silent**. Squeeze Setup is designed to be quiet most of the time. On most symbols, most of the trading day, none of the five conditions are stacking — and that silence is informative. It tells you the structural pre-conditions for a breakout are not in place, so the breakouts you see are probably noise.

The signal will trigger only when:

- Flow is large enough to be statistically meaningful relative to the symbol's history (z-score component is non-trivial).
- Momentum is accelerating, not just trending.
- Gamma is loaded enough that hedging flows can propagate moves.
- Spot is positioned relative to the flip in a way that opens directional asymmetry.
- The vol regime does not dampen the signal to zero.

A few minutes of every session, on the few symbols where these all align — that is where Squeeze Setup lives.

---

## What a trader does when it triggers

The canonical playbook gate:

> A persistent Squeeze Setup score above the threshold across two consecutive sessions triggers the Squeeze Breakout playbook — entry on a clean break of a 30-bar volatility envelope, in the direction the signal is leaning.

The two-session persistence is a deliberate filter. Single-bar triggers are too noisy; the structural coil needs to *hold*. When it does, the signal is essentially saying: the conditions to move are there, wait for the break, then trade in the direction of the score.

A few practical notes:

- **Direction comes from the score sign, not from the entry technique.** The signal does the directional read; the volatility-envelope break is the timing trigger.
- **Magnitude matters.** A score of +0.55 is materially different from +0.27 — both triggered, but the higher conviction trade is the higher score.
- **Sub-threshold scores still inform.** A persistent +0.20 reading isn't actionable alone, but if every other signal is also leaning bullish, it adds to the composite read.

---

## Reading Squeeze Setup with other signals

Squeeze Setup is one signal among many — and confluence is where the real edge lives. A few common cross-reads:

- **Squeeze Setup + Vol Expansion same direction.** Two Continuation signals agreeing — the move has both *coil* and *capacity*. The cleanest setup.
- **Squeeze Setup + Trap Detection opposing.** Coiled to the upside per Squeeze, but Trap Detection says the most recent upside break is failing. One of them is wrong about the current break; usually the right move is to skip and wait.
- **Squeeze Setup + Positioning Trap aligning.** Coiled with the crowd offside on the same side — a short-cover squeeze if the crowd is short, a flush if they're long. Both signals point to the same trade. The companion piece on the [Positioning Trap signal](/education/positioning-trap-explained) covers that read in depth.
- **Squeeze Setup at 0 with every other signal active.** Probably nothing structural is coiled; the move you're seeing is reactive, not loaded.

When several Continuation signals (Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow) align same-direction, conviction compounds. When they fight Mean-reversion signals, the tape is contested.

---

## Common misreads

Three traps:

- **Treating a 0 as "neutral."** A 0 on Squeeze Setup means *nothing is compressed* — not that the market is balanced. Do not trade off it as a "calm" green light.
- **Trading off a sub-threshold score.** The 0.25 threshold matters. An 0.18 reading might *feel* like a setup, but it is not triggered — and the difference between "feels coiled" and "is structurally coiled" is most of the edge.
- **Ignoring the regime.** Squeeze Setup says nothing about the gamma regime by itself. A coiled market below the flip behaves differently than one above. Always cross-check with the [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) workflow.

---

## How ZeroGEX surfaces the Squeeze Setup signal

The dashboard surfaces it in a few places:

- **The Squeeze Setup card** shows the live score, the trigger state, and the input breakdown.
- **The Composite Signal Score** integrates Squeeze Setup as one input alongside the other Advanced and Basic signals.
- **The Trade Stream** flags `squeeze_breakout`-gated playbook trades when they fire.

*[Image placeholder: ZeroGEX Squeeze Setup card with score, trigger state, and input contributions — drop file at /public/blog/zerogex-squeeze-setup-card.png]*

A worked example. Suppose SPX is grinding sideways into Wednesday's session and ZeroGEX shows:

- **Squeeze Setup:** +0.42 (triggered bullish)
- **Net GEX:** +$800M
- **Gamma Flip:** spot is 0.2% above
- **Tape Flow Bias:** +0.6
- **Trap Detection:** 0

The structural read: coiled-upside setup with confirming flow lean, no countervailing failed-breakout signal, and a long-gamma regime that will dampen the move if it tries to extend too far. Practical lean: stay alert for an upside volatility-envelope break; when it comes, the structural conditions for follow-through are in place. None of this is a trade — it is the regime read that should reshape which entries you take seriously.

---

## Takeaway

> Squeeze Setup tells you when the market has *stored* the energy to move, not when it has moved. It's a precondition signal, not a timing signal.

The discipline is to use it as a filter on which directional breakouts you take seriously, rather than as the trigger itself. When the score is triggered, the breakout setup is real; when it's at zero, the breakouts you're seeing are noise. That distinction is most of the edge.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's Squeeze Setup read in real time alongside the gamma flip, the walls, and the other Advanced and Basic signals, the free ZeroGEX dashboard surfaces all of it.
