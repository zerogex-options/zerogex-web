# Basic Signal Dashboard

*The six continuous reads that feed the composite — what they are, how to read them, and where to drill in.*

---

## What the Basic Signal Dashboard is

The Basic Signal Dashboard is the **at-a-glance grid** of all six Basic signals. Each card shows the current score on the [-1, +1] line, the contribution it's making to the composite, and a sparkline.

Basic signals are **continuous**. They don't trigger discrete alerts — they nudge the composite higher (toward trend) or lower (toward chop) on every refresh.

## The six signals

| Signal | What it asks | Trade bias | Composite weight |
| --- | --- | --- | --- |
| Tape Flow Bias | "Which way is the tape leaning?" | Continuation | 0.08 |
| Skew Delta | "How much is fear bid into puts?" | Directional read | 0.04 |
| Vanna/Charm Flow | "Might vol or time nudge dealers to re-hedge?" | Continuation | 0.04 |
| Dealer Delta Pressure | "Are dealers forced to chase this move?" | Directional read | 0.08 |
| GEX Gradient | "Is gamma stacked on one side?" | Directional read | 0.08 |
| Positioning Trap | "Is the crowd offside?" | Mean-reversion (vs. crowd) | 0.06 |

The weights are the share of the composite each signal contributes when the rest of the universe is silent.

## Quick read on each

### Tape Flow Bias

Lee-Ready aggressor classification on the options tape. Net of call buy/sell premium and put buy/sell premium. Positive = aggressors are paying for upside. A strong signal here in the absence of an opposing GEX gradient is real-time conviction.

### Skew Delta

The OTM put IV minus OTM call IV spread versus its baseline, sign-inverted so the score reads directionally: negative means fear is bid (put skew rich); positive means call premium is bid (greed). Useful as a sentiment temperature check more than a precision signal.

### Vanna/Charm Flow

Aggregated dealer vanna and charm. Vanna models what dealers *may* hedge if vol moves; charm models the delta drift from time passing (holding spot and IV constant). A positive read models hedge flow that *can* support higher prices; negative the opposite — direction and size still depend on the book's composition and who owns the options. Charm pressure tends to build into the close.

### Dealer Delta Pressure

The dealer net delta from the option chain (call_delta_oi + put_delta_oi) — a separate modeled read from gamma. Strong negative models dealers short delta, who would *tend* to buy higher to stay hedged; strong positive models them long, tending to sell higher. The signal asks "are dealers likely to chase this move?".

### GEX Gradient

Above-spot gamma versus below-spot gamma, with an ATM-concentration check. Tells you which side of spot carries more modeled gamma weight. Positive gradient ⇒ more gamma below spot ⇒ a modeled supportive floor (bullish lean, assuming dealers are long gamma there); negative ⇒ more gamma above spot ⇒ downside-amplifying lean. The lean assumes the modeled dealer-gamma sign holds.

### Positioning Trap

PCR + signed smart-money imbalance + 5-bar momentum + flip lean + regime context. Asks whether the crowd is positioned the wrong way — and it fades the crowd, not price. A high **positive** score flags a short-leaning crowd (heavy puts) that can be squeezed **higher** — an upside short-cover squeeze; a high **negative** score flags a long-leaning crowd (heavy calls) vulnerable to a **downside** flush. Read the sign as the squeeze/flush direction, not a plain "go long/short" cue.

## Reading the dashboard

Three patterns:

1. **Look for confluence.** If three or four of the six are pointing the same direction with non-trivial magnitudes, the composite will move toward a trend or chop regime accordingly.
2. **Look for divergence.** When Tape Flow Bias is strongly positive but the GEX Gradient is sharply negative, dealers will fade the buying — the tape is wrong about where the structural pin is.
3. **Look at the Positioning Trap separately.** It's the only Basic signal with mean-reversion bias. A high **negative** Trap reading (a long-leaning crowd at risk of a downside flush) alongside a strongly long Tape is a warning, not a confirmation — the crowd the tape is joining is the one the Trap flags as offside.

## What's not on the Basic dashboard

Triggers. None of these signals fire. If you want trigger-driven alerts, look at the [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard).

## Each card has a deep-dive page

Click any card and you go to the individual signal page, which shows:

- The score sparkline at higher resolution
- The current input values (the components feeding the score)
- The "How it's built" explanation
- Recent history

## See also

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
