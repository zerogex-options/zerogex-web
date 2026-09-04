# What Is Zero Gamma? The Zero Gamma Level Explained

*Zero gamma explained in plain English — what the zero gamma level is, how it relates to the gamma flip and to net GEX, what tends to change on either side of it, and where to see today's SPX, SPY, QQQ and NDX zero gamma level.*

---

## What is the zero gamma level?

The **zero gamma level** is the price at which modeled dealer gamma exposure crosses zero. Above it, the option book is modeled as net *positive* gamma for dealers; below it, net *negative*. It is the same level most traders call the **gamma flip**, and the two names are used interchangeably: "zero gamma" describes what the number is (the point where net dealer gamma equals zero), and "gamma flip" describes what happens there (the sign flips).

That is the whole definition, and it is worth holding onto the plain version, because the level gets talked about as if it were a support or resistance line. It is not. Zero gamma is a **regime boundary**: it marks where the *character* of dealer hedging is modeled to change, not where price is expected to stop.

A few consequences follow directly:

- It is a **price level, not a strike.** The zero crossing usually sits between strikes, because it comes from a curve — modeled dealer gamma evaluated across a range of spot prices — rather than from any single contract.
- It **moves.** As open interest changes and as existing contracts reprice with spot, time, and implied volatility, the curve reshapes and its zero crossing shifts. Yesterday's zero gamma level is a different number from today's.
- It is a **model output.** Dealer inventory is not directly observable, so the level depends on a sign convention (ZeroGEX uses the traditional call-positive / put-negative convention) and on which expirations and inputs the model includes.

## Zero gamma vs gamma flip vs net GEX

Three closely related terms, and the differences matter more than they look:

| Term | What it is | Unit |
|---|---|---|
| **Net GEX** | Modeled net dealer gamma across the chain, evaluated at the current spot price | Signed dollars ("dollar gamma"), e.g. +$1.2B |
| **Zero gamma level** | The spot price at which that modeled net gamma would equal zero | A price, e.g. 5,815 |
| **Gamma flip** | The same level, named for the sign change that happens there | A price |

So net GEX is a *reading* and zero gamma is a *level*. They are two views of one curve: when spot is above the zero gamma level, net GEX at spot is positive; when spot is below it, net GEX at spot is negative. If the two ever seem to disagree — a positive net GEX print with spot below the published flip — the model is telling you it found more than one zero crossing, or that the reading and the level came from different snapshots. See [SPX Net GEX Today](/education/spx-net-gamma-exposure-today) for how to read the dollar figure itself.

## How the zero gamma level is found

The quick way to locate zero gamma is to sum signed gamma by strike, running from the lowest strike upward, and mark where the cumulative total crosses zero. It is quick, and it is also wrong more often than it looks, because it treats every contract's gamma as fixed when in fact gamma depends on where spot is.

The better approach — the one ZeroGEX moved to — re-prices the whole book at each candidate spot price, computes modeled net dealer gamma *as if spot were there*, and reads off where that profile crosses zero. The [Gamma Flip Calculation guide](/guides/gamma-flip-calculation-before-vs-after) walks through both methods and why the spot-shift profile is the one worth trusting.

Two things fall out of the better method:

1. **The level can be absent.** If the profile never crosses zero near spot — deep inside one regime, a thin or one-sided chain, an implied-volatility spike that collapses modeled gamma across the board — there is no honest zero gamma level to publish, and ZeroGEX leaves it blank rather than inventing one. The sign of net GEX still tells you which regime you are in.
2. **There can be more than one.** A lumpy chain can produce two crossings. ZeroGEX publishes the one close enough to spot to be tradable and backed by real open interest; it is worth knowing that a second one may be sitting further out.

## What tends to change above and below zero gamma

The sign of modeled dealer gamma is what decides whether hedging leans *against* moves or *with* them.

**Above the zero gamma level (positive gamma).** Dealers are modeled net long gamma. To stay delta-neutral they tend to sell into strength and buy into weakness, which pushes against the direction of the move. Realized volatility tends to compress, ranges tend to be tighter, and price tends to gravitate toward heavy strikes into the close. Breakouts stall more often than they extend.

**Below the zero gamma level (negative gamma).** Dealers are modeled net short gamma. The same hedging reflex now runs with the move — buying strength, selling weakness — and realized volatility tends to expand. Ranges widen, breakouts have more follow-through, and the pinning that held above the level tends to release. [What negative gamma means](/education/what-is-negative-gamma) covers this regime in depth.

**At the level itself.** Spot sitting on zero gamma is the least informative state, not the most. Positive and negative modeled contributions roughly offset, the net hedging tendency is weak, and a small change in inputs can flip the sign. Traders who use the level treat this band as contested territory rather than as a signal.

None of this is directional. Above zero gamma is not bullish; below it is not bearish. The level speaks to the *texture* of the tape — sticky or slippery — not to where price is headed.

## How traders use the zero gamma level

The level is most useful as a **filter** that decides which playbook is running, rather than as a trigger:

1. **Read the regime first.** Before a setup, check whether spot is above or below zero gamma, and by how much.
2. **Match tactics to the side.** Above: fades, range trades, patience near the [call wall and put wall](/education/gamma-walls-explained). Below: momentum, breakouts, tighter risk.
3. **Watch the distance and the drift.** A level far from spot is a stable regime read; a level a few tenths of a percent away is a contested one. A level that migrates toward price through the session is a different tell from one that stays put while price approaches it.
4. **Check the net GEX magnitude.** A zero gamma level with $2B of modeled gamma above it describes a sharper regime than one with $200M. Sign and size together, not sign alone.

[What Is a Gamma Flip?](/education/how-to-read-a-gamma-flip) turns these into an intraday routine, and [How to Trade Around Gamma Flip Levels](/education/how-to-trade-around-gamma-flip) covers what changes when spot crosses.

## Common misreadings

- **Treating zero gamma as support or resistance.** It is a regime line. Buying weakness into the level from above and buying weakness from below are structurally different trades.
- **Reading a stale level.** The zero gamma level can move several points in a few hours. A morning number read against an afternoon tape is a different book.
- **Confusing it with max pain.** [Max pain](/education/max-pain-explained) is a payoff-geometry strike — where option holders' expiration value is minimized. Zero gamma is a hedging-regime line. They answer different questions and frequently disagree.
- **Expecting a bounce or a break at the level.** Price crossing zero gamma changes the modeled *reflex* of hedging. It does not, by itself, tell you whether the move continues.

## Today's zero gamma level

ZeroGEX publishes the zero gamma level — labeled "gamma flip" — with the call wall, put wall, max pain and net GEX, free and delayed roughly 15 minutes, for [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) and [NQ](/nq-gamma-levels). The live, session-long value updates inside the dashboard. For what ZeroGEX observes versus what it models, see the [methodology](/methodology).

## Takeaway

> Zero gamma is the price where modeled net dealer gamma is zero — the same level as the gamma flip. Above it, hedging tends to dampen moves; below it, hedging tends to amplify them. It is a regime line, not a target, and it moves through the day.

Educational content only — none of the above is a trade recommendation.
