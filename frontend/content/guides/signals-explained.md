# ZeroGEX™ Guide: Signals, Explained

*Every ZeroGEX signal on one page - what each one asks, the timeframe it reads, when it fires, and what a positive, negative, or zero score actually means.*

---

## How to read this guide

ZeroGEX runs two families of signals, and they behave differently by design.

**Advanced signals** answer a sharp, situational question ("is the close getting pinned?", "did this breakout just fail?"). Each one produces a score on a **-100 to +100** line *and* a discrete **trigger**: when the signal's trigger condition is met - usually the score crossing a threshold - its card switches from *Stand by* to *Triggered*, and the trigger is logged on the signal's Event Timeline. They are event-driven, and they are part of Pro.

**Basic signals** are continuous, advisory reads. They carry no weight in the **Composite MSI**, which is built from six components of its own, and the engine never triggers on them. Their value is as an early warning: when they disagree with the MSI, a regime shift may be coming before the MSI moves. They are in Basic and Pro.

Three things are worth internalizing before the tables:

- The score line is always **-100 to +100**. Sign tells you direction; magnitude tells you conviction.
- A score of **0 almost never means "neutral market."** For most signals it means *the data is insufficient* or *this specific question has no answer right now*. Do not read a 0 as a green light.
- Advanced signals **trigger**; Basic signals **warn early**. A Basic card lights up *Triggered* at ±25, but that is only a highlight on the card, not an engine trigger.

---

## The 30-second version

What each signal asks, the bias it leans toward, the window it reads, the headline inputs that drive it, and how it surfaces.

### Advanced signals

| Signal | Asks | Trade Bias | Timeframe | Headline Inputs | Trigger / Output |
| --- | --- | --- | --- | --- | --- |
| EOD Pressure | "Is the close getting pinned?" | Directional read | Last 90 min (ramps 14:30-15:45 ET) | Dealer charm at spot, pin gravity, realized vol, witching flags | Score -100 to +100; triggers at ±20 |
| Gamma/VWAP Confluence | "Are key levels stacking up here?" | Mean-rev (long gamma) / Continuation (short gamma) | Continuous intraday | Gamma flip, VWAP, max pain, max-gamma strike, call wall | Score -100 to +100; triggers at ±20 |
| Market Pressure | "Is the market loaded to move, and which way will it break?" | Continuation | Forward-looking; session-weighted vanna→charm blend | Wall pinch, flip proximity, net-GEX regime, dealer vanna/charm, DNI, premium + smart-money flow skew, IV rank, realized-vol squeeze | Score -100 to +100 plus loading 0-100; triggers at loading ≥ 50 and \|direction\| ≥ 0.20 |
| Range Break Imminence | "Is this range about to break?" | Regime / playbook switch | 20-bar window | Skew delta, dealer delta, trap pressure, 10/60-bar compression ratio | Score -100 to +100 plus imminence 0-100; triggers at imminence ≥ 65 |
| Squeeze Setup | "Is the market coiled?" | Continuation | Multi-day setup | Flow z-score, 5/10-bar momentum, gamma readiness, flip distance, VIX regime | Score -100 to +100; triggers at ±25 |
| Trap Detection | "Did this breakout just fail?" | Mean-reversion (vs. price break) | Intraday to overnight | Walls (current + prior), VWAP, flip, net GEX and ΔGEX, flow deltas | Score -100 to +100; triggers at ±25 |
| Vol Expansion | "Is volatility about to break out?" | Continuation | 5-bar momentum window | Net GEX, vol-normalized momentum z-score, realized vol | Score -100 to +100; triggers at ±25 |
| Zero DTE Position Imbalance | "Are 0DTE traders leaning one way?" | Directional read | 0DTE session (weighted by hours-to-close) | Call/put flow imbalance, smart-money C/P ratio, PCR, moneyness buckets | Score -100 to +100; triggers at ±25 |

### Basic signals

| Signal | Asks | Trade Bias | Timeframe | Headline Inputs | Output |
| --- | --- | --- | --- | --- | --- |
| Dealer Delta Pressure | "Are dealers forced to chase this move?" | Directional read | Immediate intraday | Dealer net delta (call_delta_oi + put_delta_oi), strike OI distribution | Score -100 to +100; advisory, not in the MSI |
| GEX Gradient | "Is gamma stacked on one side?" | Directional read | Per-strike snapshot (on GEX refresh) | Above-spot gamma, below-spot gamma, ATM concentration, wing fraction, realized vol | Score -100 to +100; advisory, not in the MSI |
| Positioning Trap | "Is the crowd offside?" | Mean-reversion (vs. crowd) | Intraday (5-10 min) | PCR, signed smart-money imbalance, 5-bar momentum, flip lean, net GEX regime | Score -100 to +100; advisory, not in the MSI |
| Skew Delta | "How much is fear bid into puts?" | Directional read | Intraday (on quote refresh) | OTM put IV, OTM call IV, spread vs. baseline | Score -100 to +100; advisory, not in the MSI |
| Tape Flow Bias | "Which way is the tape leaning?" | Continuation | Short rolling window (Lee-Ready) | Call buy/sell premium, put buy/sell premium, total premium flow | Score -100 to +100; advisory, not in the MSI |
| Vanna/Charm Flow | "Will vol or time force dealers to re-hedge?" | Continuation | Intraday (charm ramps last 2 hrs) | Aggregated dealer vanna, aggregated dealer charm, session-time charm multiplier | Score -100 to +100; advisory, not in the MSI |

---

## What the score sign means

Same number line, very different questions. Here is what positive, negative, and zero mean for each signal - read the **0 column carefully**, it is where most misreads happen.

### Advanced signals

| Signal | Positive score | Negative score | Zero |
| --- | --- | --- | --- |
| EOD Pressure | Bullish pin pressure (charm bid + gamma pull up) | Bearish pin pressure (charm offer + gamma pull down) | No pin compression or charm activity in the final window |
| Gamma/VWAP Confluence | Price above the confluence cluster (fade down under long gamma / accelerate up under short gamma) | Price below the confluence cluster (mirror) | Missing core inputs (flip / VWAP unavailable) - *not* "neutral" |
| Market Pressure | Bullish loading - dealers forced to buy on any catalyst (vanna+charm tilt up, call-side flow, dealers short delta) | Bearish loading - dealers forced to sell on any catalyst (mirror) | Either a pillar is missing (no walls, no flip, no greeks, no flow) or the coil is genuinely uncocked - not "neutral market." When loaded with direction = 0, opposing forces are canceling. |
| Range Break Imminence | Bullish break imminent (upside structural pressure aligned) | Bearish break imminent | Low imminence - stay in range-fade mode; no break loading |
| Squeeze Setup | Buy the upside breakout (call flow + up-acceleration) | Sell the downside breakout (put flow + down-acceleration) | Nothing is compressed - no coiled energy, no flow lean |
| Trap Detection | Buy the failed breakdown (downside break can't hold) | Sell the failed breakout (upside break can't hold) | No structural level is being rejected right now |
| Vol Expansion | Bullish momentum + capacity for vol expansion (dealers short gamma) | Bearish momentum + vol expansion capacity | No momentum, or positive GEX damping movement |
| Zero DTE Position Imbalance | Call-heavy 0DTE positioning (upside flow skew) | Put-heavy 0DTE positioning (downside protection bid) | Balanced 0DTE flow - or signal dormant outside RTH |

### Basic signals

| Signal | Positive score | Negative score | Zero |
| --- | --- | --- | --- |
| Dealer Delta Pressure | Dealers modeled short delta - they tend to buy into a rally to stay hedged (bullish lean) | Dealers modeled long delta - they tend to sell into rallies (bearish lean) | Balanced dealer book or insufficient OI |
| GEX Gradient | Bullish lean. In short gamma: more gamma above spot (dealers would chase a rally). In long gamma: more gamma below spot (a supportive floor) | Bearish lean. In short gamma: more gamma below spot (dealers would chase a sell-off). In long gamma: more gamma above spot (resistance overhead) | Flat gradient or insufficient OI |
| Positioning Trap | Short crowd offside - upside short-cover squeeze loading | Long crowd offside - downside flush loading | No crowd extreme detected |
| Skew Delta | Put skew *below* baseline - fear is unwinding (bullish lean) | Put skew elevated - fear is bid (bearish lean) | Skew sitting at baseline, or data missing |
| Tape Flow Bias | Aggressive call buying dominates the tape (bullish conviction) | Aggressive put buying dominates the tape (bearish conviction) | Balanced premium flow or insufficient volume |
| Vanna/Charm Flow | Dealer hedging is a buying tailwind (vol-crush / decay) | Dealer hedging is a selling headwind (vol-up / unwind) | Balanced dealer exposure or missing dealer rows |

---

## A zero is (almost) never "neutral"

This is the single most common misread, so it gets its own section.

> A score of 0 usually means *data insufficient* or *this specific question has no answer right now* - **not** "the market is balanced, trade freely."

When Gamma/VWAP Confluence returns 0 because the gamma flip or VWAP is unavailable, that is a *blind spot*, not a calm tape. When EOD Pressure is 0 outside the closing window, the question simply does not apply yet. Treat a 0 as "this lens is dark," size accordingly, and lean on the signals that *are* reporting.

## The four trade-bias buckets

Every signal's "Trade Bias" rolls up into one of four families. Knowing which bucket a signal lives in tells you how to act on it before you even read the score.

- **Continuation (5):** Squeeze Setup, Vol Expansion, Market Pressure, Tape Flow Bias, Vanna/Charm Flow - these say *the move has fuel; ride it*.
- **Mean-reversion (2):** Positioning Trap, Trap Detection - these say *the move is overextended or false; fade it*. Gamma/VWAP Confluence joins this bucket when dealers are long gamma.
- **Directional read (5):** EOD Pressure, Zero DTE Imbalance, Dealer Delta Pressure, GEX Gradient, Skew Delta - these tell you *which way pressure points*, without prescribing ride-vs-fade on their own.
- **Regime / structural (1):** Range Break Imminence - this one switches the playbook itself, flipping you between range-fade and breakout modes.

When several signals from the **same** bucket align, conviction compounds. When Continuation and Mean-reversion signals disagree, that conflict is itself information: the tape is contested.

## Triggers vs. advisory reads

Advanced and Basic signals are not just "harder" and "easier" versions of each other - they are wired into the system differently.

- **Advanced signals fire discrete triggers.** Most trigger when the score crosses ±25 (±20 for EOD Pressure and Gamma/VWAP Confluence); Range Break Imminence and Market Pressure trigger on imminence and loading instead. The card switches to *Triggered* and the trigger goes on the signal's Event Timeline. Between triggers the score is informational.
- **Basic signals never trigger in the engine.** They are continuous, advisory reads with no weight in the Composite MSI. Watch them for divergence: flow reads turning against the structure is the early warning they exist for.

Triggers show in the app - on the Advanced cards and their Event Timelines - not by email, SMS or push.
