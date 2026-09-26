# Basic Signal Dashboard

*The six continuous reads that sit alongside the composite - what they are, how to read them, and where to drill in.*

---

## What the Basic Signal Dashboard is

The Basic Signal Dashboard (Basic and Pro) is the **at-a-glance view** of all six Basic signals. A strip at the top shows all six scores at once. Below it are three tabs:

- **Signal Grid** - a card per signal with its score on the -100 to +100 line, a sparkline, a one-line description, and **Context values** you can expand to see the inputs behind the score.
- **Confluence Matrix** - how often each pair of signals has agreed or disagreed in direction.
- **Event Timelines** - each signal's recent score path, with direction flips marked.

Basic signals are **continuous** and **advisory**. They don't trigger discrete alerts, and they carry **zero weight in the Composite Score (MSI)** - a move here doesn't move the MSI. Use them as an early cross-check: when the flow-side reads diverge from the structure reads, a regime shift is often underway before the MSI reacts.

A card whose score passes ±25 is outlined and marked *Triggered*; below that it reads *Stand by*. On this dashboard that's a highlight for a strong read, not a trigger event.

## The six signals

| Signal | What it asks | Trade bias |
| --- | --- | --- |
| Tape Flow Bias | "Which way is the tape leaning?" | Continuation |
| Skew Delta | "How much is fear bid into puts?" | Directional read |
| Vanna/Charm Flow | "Might vol or time nudge dealers to re-hedge?" | Continuation |
| Dealer Delta Pressure | "Are dealers forced to chase this move?" | Directional read |
| GEX Gradient | "Is gamma stacked on one side?" | Directional read |
| Positioning Trap | "Is the crowd offside?" | Mean-reversion (vs. crowd) |

None of the six feeds the Composite Score. The one overlap: the MSI has its own Dealer Delta Pressure component, built on the same dealer net delta read as the Basic signal.

## Quick read on each

### Tape Flow Bias

Lee-Ready aggressor classification on the options tape. Net of call buy/sell premium and put buy/sell premium. Positive = aggressors are paying for upside. A strong signal here in the absence of an opposing GEX gradient is real-time conviction.

### Skew Delta

The OTM put IV minus OTM call IV spread versus its baseline, sign-inverted so the score reads directionally: negative means fear is bid (put skew rich); positive means call premium is bid (greed). Useful as a sentiment temperature check more than a precision signal.

### Vanna/Charm Flow

Aggregated dealer vanna and charm. Vanna models what dealers *may* hedge if vol moves; charm models the delta drift from time passing (holding spot and IV constant). A positive read models hedge flow that *can* support higher prices; negative the opposite - direction and size still depend on the book's composition and who owns the options. Charm pressure tends to build into the close.

### Dealer Delta Pressure

The dealer net delta from the option chain (call_delta_oi + put_delta_oi) - a separate modeled read from gamma. The score is inverted: a strong **positive** score models dealers short delta, who would *tend* to buy into a rally to stay hedged (bullish lean); a strong **negative** score models them long delta, tending to sell into rallies (bearish lean). The signal asks "are dealers likely to chase this move?".

### GEX Gradient

Above-spot gamma versus below-spot gamma, with a check on how much of it sits in the far-OTM wings (heavy wing gamma lowers confidence). Tells you which side of spot carries more modeled gamma weight, and the read depends on the regime:

- When dealers are modeled **short gamma**, more gamma above spot scores **positive** (dealers would chase a rally) and more below spot scores negative (they would chase a sell-off).
- When they're modeled **long gamma**, the read flips and is damped: more gamma below spot scores positive (a supportive floor), more above scores negative (resistance overhead).

The lean assumes the modeled dealer-gamma sign holds.

### Positioning Trap

PCR + signed smart-money imbalance + 5-bar momentum + flip lean + regime context. Asks whether the crowd is positioned the wrong way - and it fades the crowd, not price. A high **positive** score flags a short-leaning crowd (heavy puts) that can be squeezed **higher** - an upside short-cover squeeze; a high **negative** score flags a long-leaning crowd (heavy calls) vulnerable to a **downside** flush. Read the sign as the squeeze/flush direction, not a plain "go long/short" cue.

## Reading the dashboard

Three patterns:

1. **Look for confluence.** If three or four of the six are pointing the same direction with non-trivial magnitudes, that's conviction. The **Confluence Matrix** tab shows which pairs have been agreeing.
2. **Look for divergence.** When Tape Flow Bias is strongly positive but the GEX Gradient is sharply negative, the modeled dealer positioning leans against the buying - the tape may be wrong about where the structural pin is. Flow reads diverging from structure reads is the early warning this page is built for.
3. **Look at the Positioning Trap separately.** It's the only Basic signal with mean-reversion bias. A high **negative** Trap reading (a long-leaning crowd at risk of a downside flush) alongside a strongly long Tape is a warning, not a confirmation - the crowd the tape is joining is the one the Trap flags as offside.

## What's not on the Basic dashboard

Trigger rules. None of these signals fire - the *Triggered* tag only marks a score past ±25. If you want trigger-driven signals, look at the [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard), which is part of Pro.

## Each card has a deep-dive page

Click any card (or pick the signal under Basic Signal Dashboard in the sidebar) to open its page, which shows:

- The score with a one-line reading and an expandable score history
- The current input values (the components feeding the score)
- The "How it's built" explanation
- The Event Timeline - the score's recent path, with direction flips marked

## See also

- [Composite Score](/help/platform/composite-score)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Signals: Explained](/guides/signals-explained)
