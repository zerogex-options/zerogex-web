# Basic Signal Dashboard

*The six continuous reads that feed the composite — what they are, how to read them, and where to drill in.*

---

## What the Basic Signal Dashboard is

The Basic Signal Dashboard is the **at-a-glance grid** of all six Basic signals. Each card shows the current score on the [-1, +1] line, the contribution it's making to the composite, and a sparkline.

Basic signals are **continuous**. They don't trigger discrete alerts — they nudge the composite up or down on every refresh.

## The six signals

| Signal | What it asks | Trade bias | Composite weight |
| --- | --- | --- | --- |
| Tape Flow Bias | "Which way is the tape leaning?" | Continuation | 0.08 |
| Skew Delta | "How much is fear bid into puts?" | Directional read | 0.04 |
| Vanna/Charm Flow | "Will vol or time force dealers to re-hedge?" | Continuation | 0.04 |
| Dealer Delta Pressure | "Are dealers forced to chase this move?" | Directional read | 0.08 |
| GEX Gradient | "Is gamma stacked on one side?" | Directional read | 0.08 |
| Positioning Trap | "Is the crowd offside?" | Mean-reversion (vs. crowd) | 0.06 |

The weights are the share of the composite each signal contributes when the rest of the universe is silent.

## Quick read on each

### Tape Flow Bias

Lee-Ready aggressor classification on the options tape. Net of call buy/sell premium and put buy/sell premium. Positive = aggressors are paying for upside. A strong signal here in the absence of an opposing GEX gradient is real-time conviction.

### Skew Delta

The OTM put IV minus OTM call IV spread versus its baseline. Negative reads mean fear is bid; positive reads mean call premium is bid (greed). Useful as a sentiment temperature check more than a precision signal.

### Vanna/Charm Flow

Aggregated dealer vanna and charm. Vanna is what dealers will hedge if vol moves; charm is what they'll hedge as time passes. Positive reads mean structural flow supports higher prices; negative the opposite. Charm ramps into the close.

### Dealer Delta Pressure

The dealer net delta from the option chain (call_delta_oi + put_delta_oi). Strong negative means dealers are short delta and will buy higher; strong positive means they're long and will sell higher. The signal asks "are dealers forced to chase?".

### GEX Gradient

Above-spot gamma versus below-spot gamma, with an ATM-concentration check. Tells you which side of the spot has more gamma weight. Positive gradient ⇒ gamma stacked above spot ⇒ structural upside pin; negative ⇒ structural downside pin.

### Positioning Trap

PCR + signed smart-money imbalance + 5-bar momentum + flip lean + regime context. Asks whether the crowd is positioned the wrong way. **This is a mean-reversion signal** — a high positive score is a "fade up" cue, not a "go long" cue.

## Reading the dashboard

Three patterns:

1. **Look for confluence.** If three or four of the six are pointing the same direction with non-trivial magnitudes, the composite will reflect it.
2. **Look for divergence.** When Tape Flow Bias is strongly positive but the GEX Gradient is sharply negative, dealers will fade the buying — the tape is wrong about where the structural pin is.
3. **Look at the Positioning Trap separately.** It's the only Basic signal with mean-reversion bias. Treat a high positive Trap reading with the Tape strongly long as a warning, not a confirmation.

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
