# EOD Pressure Signal Explained: Reading the Close

*The practical deep-dive on the ZeroGEX EOD Pressure signal — what it asks, why the close has structural drift, how the score combines charm and pin gravity, and how to read it inside the final 90 minutes.*

---

## Why this signal exists

The final 90 minutes of the cash session is structurally different from the rest of the day. Charm decay on 0DTE positions tends to push dealers to re-hedge more actively. Pin gravity around heavy gamma strikes can intensify. The modeled dealer book is more constrained than at almost any other point in the session.

Those forces are often directional and readable — *if* you know what to look for. The EOD Pressure signal is designed to surface that modeled directional drift in real time, so traders can position with the closing flow rather than fighting it.

This piece is the trader-facing read on the EOD Pressure signal. It covers what it measures, why the close is different, how the score is built from charm and pin gravity, and how to read it inside the window. For the deeper combined methodology piece that pairs EOD Pressure with Trap Detection, see [Trading the Close](/education/eod-pressure-and-trap-detection); for the underlying mechanics, [Vanna and Charm Explained](/education/vanna-and-charm-explained) covers how charm drives modeled hedge flows in detail.

---

## What is the EOD Pressure signal?

The EOD Pressure signal asks one question:

> Given the modeled dealer book and the proximity of a magnet strike, which way does modeled hedging lean into the close?

It is an **Advanced** signal in the ZeroGEX stack — it produces both a continuous score on the [-1, +1] number line and a discrete trigger when the absolute score crosses **0.20**. The threshold is deliberately lower than other Advanced signals because the structural context (the closing window) is itself a filter — when EOD Pressure reads 0.15+ inside the active window, it is already directionally informative.

Trade bias: **directional read**. The signal points which way pressure is leaning — it does not prescribe ride-versus-fade on its own. That comes from the regime context.

---

## Why the close is different

Three structural mechanisms compound in the final session window:

1. **Charm decay accelerates.** As 0DTE options approach expiry, their delta tends to drift toward 0 (out-of-the-money) or ±1 (in-the-money), holding other inputs constant. Dealers running a roughly delta-neutral book tend to re-hedge more often, and the modeled rate of that re-hedging *increases* as the close approaches.
2. **Pin gravity intensifies.** Heavy gamma strikes can pull harder on price as time-to-expiry shrinks. In a modeled long-gamma regime, the modeled magnetism toward the nearest heavy strike tends to strengthen through the afternoon.
3. **Liquidity thins.** Block flows, end-of-day rebalancing, and structural index orders shift the flow profile from continuous to bursty. Dealers have less room to absorb mistakes.

EOD Pressure combines the first two into a directional read. The third is implicit in the score's calibration.

---

## The four core components

The signal aggregates four components — three contribute to magnitude, one acts as a hard gate.

### Component 1: Charm at spot

The most direct modeled measure of hedge flow. The signal sums modeled dealer charm exposure across a vol-scaled at-the-money band, weighted by expiry bucket:

| Bucket | Weight | Why |
|---|---|---|
| 0DTE | 0.70 | Charm hits hardest on day-of-expiry. Dominant contributor. |
| Weekly | 0.20 | Material but secondary. |
| Monthly | 0.10 | Background contribution. |
| LEAPS | 0.00 | Too far out to matter for today's close. |

The aggregate is normalized so ±$20M of bucketed dealer charm saturates the sub-score at ±1.0.

### Component 2: Pin gravity

The pin term encodes the regime-dependent pull of the magnet strike:

```
pin_target   = max_pain  OR  max_gamma_strike
distance_pct = (pin_target − close) / close
normalized   = clip(distance_pct / 0.003, [-1, +1])
sign         = +1 if net_gex >= 0 else -1
pin_score    = sign × normalized
```

A pin target 0.3% above spot in a modeled positive-gamma regime gives a pin score of +1.0 — the magnet is above and gravity is on. In a modeled negative-gamma regime, the same pin above spot produces a *negative* pin score, because the current implementation reverses target distance when Net GEX is negative.

**Methodology limitation:** the negative-gamma sign reversal is a ZeroGEX house heuristic, not a direct consequence of negative-gamma mechanics. Negative gamma amplifies the direction already underway; target distance alone cannot determine that direction. The analytics repository was not available in this workspace for a safe implementation-and-test change, so this documentation identifies rather than disguises the limitation.

### Component 3: Time ramp (the gate)

The ramp is multiplicative. Before **14:30 ET**, it is exactly zero — the entire signal short-circuits.

| Time (ET) | Ramp |
|---|---|
| Before 14:30 | 0.00 |
| 14:30 | 0.00 |
| 14:45 | 0.20 |
| 15:00 | 0.40 |
| 15:30 | 0.80 |
| 15:45 – 16:00 | 1.00 |

This is why EOD Pressure reads zero through most of the trading day. The signal is structurally inactive outside the window.

### Component 4: Calendar amplifier

The amplifier increases conviction on dates where positioning concentrates:

| Calendar | Amp |
|---|---|
| Normal day | 1.0× |
| Monthly OPEX (third Friday) | 1.5× |
| Quad witching (third Friday of Mar/Jun/Sep/Dec) | 2.0× |

This is the only point in the signal where the intermediate score can exceed ±1 — the final clamp brings it back into range.

---

## How the score is computed

The final aggregation:

```
combined = (0.6 × charm_score + 0.4 × pin_score) × amp × ramp
score    = clip(combined, [-1, +1])
```

The 60/40 weighting is a hand-picked design choice, not a fitted one: it reflects the view that **charm is the more direct modeled measure of hedge flow**, while **pin gravity is the indirect, regime-dependent pull**. Both matter in the model. Charm leads.

---

## Score interpretation

| Score | Reading |
|---|---|
| +0.6 to +1.0 | Strong modeled upward drift into the close |
| +0.2 to +0.6 | Positive model lean |
| -0.2 to +0.2 | Weak or offsetting model components |
| -0.2 to -0.6 | Negative model lean |
| -0.6 to -1.0 | Strong modeled downward drift into the close |

The **0.20** trigger is a hand-selected model threshold, not a calibrated probability or expected win rate. Historical validation is required before treating it as a performance edge.

---

## When the signal fires versus stays silent

The dominant state is **silent**. Most of the trading day, EOD Pressure is zero — and that zero is *informational*, not "neutral." It means the active window has not started yet.

The signal can also read zero inside the window when:

- No strikes sit inside the vol-scaled ATM band on a sparse or thinly-quoted chain.
- Both `max_pain` and `max_gamma_strike` are null.
- Pin target is sitting exactly at spot.
- Charm and pin scores happen to cancel — rare, requires opposite directions and roughly equal magnitude.

A 0 outside the window is normal. A 0 inside the window is informative — *EOD Pressure has nothing to add today.*

---

## What a trader does with it

Three workflow patterns:

### 1. Pre-window setup

Before 14:30 ET, EOD Pressure is zero by construction. Use the pre-window time to identify what the structural setup *will* be: where is max gamma, where is the gamma flip, what regime are we in, where is spot relative to the pin target? When the window opens, the signal won't surprise you — it will confirm or contradict the read you've already built.

### 2. The 15:30 inflection

EOD Pressure crosses 0.8× ramp at 15:30 ET. If the charm and pin terms have been agreeing through the early ramp window (14:45–15:30), conviction tends to consolidate around 15:30. Treat that ramp as model timing, not an instruction to pre-position or evidence that dealer orders are scheduled.

### 3. Quad witching is structural context

The 2.0× amplifier on quad-witching days is large enough to push a +0.4 unamplified signal to +0.8 amplified. Treat those days as having structurally higher conviction — and structurally higher whipsaw risk earlier in the day, before the window opens.

---

## Reading EOD Pressure with other signals

EOD Pressure is a **directional read** — it tells you which way pressure points without prescribing ride-versus-fade on its own. The fade-versus-ride decision comes from the regime:

- **Modeled positive-gamma regime + positive EOD Pressure score:** modeled drift is up, dealer hedging is modeled to dampen, the read favors positioning *with* the drift toward the magnet strike — buying weakness rather than fading into it — and fading only overshoots beyond the magnet.
- **Modeled negative-gamma regime + positive EOD Pressure score:** the signal is reading a charm-driven up-bias, but in a short-gamma regime the dealer reflex is modeled to amplify rather than absorb — momentum continuation is more likely.

Combined with other signals:

- **EOD Pressure + Trap Detection same direction:** The most common high-conviction setup. EOD drift confirms a failed-breakout fade.
- **EOD Pressure + [Squeeze Setup](/education/squeeze-setup-explained) same direction:** Coiled to the close with charm-driven drift confirming. Strong continuation setup.
- **EOD Pressure ≠ 0 inside the window with no other signals active:** The structural drift is the only read. Smaller size, treat as a directional lean rather than a high-conviction trade.

---

## Common misreads

Three traps:

- **Treating a pre-window zero as "no signal today."** The window has not opened yet. The signal is *structurally inactive*, not absent of information.
- **Ignoring the regime sign flip in pin gravity.** Positive-gamma attraction toward the target is a model heuristic. In negative gamma, the implemented distance-sign reversal is a house heuristic; do not interpret it as mechanically necessary repulsion.
- **Trading the raw score without the ramp.** A +0.4 reading at 14:45 (ramp 0.20) is actually a +0.08 effective score. Read the ramp-adjusted magnitude, not the raw input score.

---

## How ZeroGEX surfaces the EOD Pressure signal

The dashboard surfaces it in a few places:

- **The EOD Pressure card** shows the live score, the trigger state, and the component breakdown (charm vs. pin contributions).
- **The Composite Signal Score** integrates EOD Pressure as one input.
- **The Trade Stream** flags `eod_pressure`-gated playbook trades when they fire.

*[Image placeholder: ZeroGEX EOD Pressure card with score, components, and ramp status during the active window — drop file at /public/blog/zerogex-eod-pressure-card.png]*

A worked example. SPX is at 5,825 at 15:15 ET on a monthly OPEX Friday and ZeroGEX shows:

- **EOD Pressure:** -0.55 (triggered bearish)
- **Net GEX:** +$1.2B (positive)
- **Gamma Flip:** spot is +15 (above flip)
- **Max Pain:** 5,810 (below spot)
- **Charm-at-spot:** modestly negative (sells loading)
- **Calendar amp:** 1.5× (monthly OPEX)

The structural read: modeled positive-gamma regime with a heavy magnet 15 points below spot, modeled charm-driven hedging is pointing down, and the OPEX amplifier is boosting the score. Practical lean: under the model's read, drift toward 5,810 is the path favored by the model into the close. The trade isn't EOD Pressure itself — it's positioning consistent with the drift direction, with size calibrated to the modeled OPEX read.

---

## Takeaway

> EOD Pressure is designed to estimate which way modeled hedging leans in the closing window. It does not tell you anything about the rest of the day. That silence is the point.

The discipline is to use it as a directional read for the last 90 minutes, cross-checked against the regime to decide ride-versus-fade, and validated against the other Advanced signals for confluence. Outside the window, look elsewhere.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's EOD Pressure read in real time during the active window, alongside Trap Detection and the regime context, the free ZeroGEX dashboard surfaces all of it.
