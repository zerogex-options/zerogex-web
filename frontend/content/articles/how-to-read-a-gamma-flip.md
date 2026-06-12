# How to Read a Gamma Flip

*The practical read on the gamma flip — what the level actually is, what changes above versus below it, and how to act on it intraday. Gamma flip explained without the hand-waving.*

---

## Why the gamma flip matters

Most traders read price action against support and resistance. The gamma flip is something different: it is a **regime boundary**, not a target. When spot is above the flip, dealer-hedging mechanics tend to *dampen* volatility. When spot is below it, those same mechanics tend to *amplify* it. The setups that work in one regime are usually the wrong setups in the other — and recognizing which regime you are in is most of the edge.

This piece is the trader-facing read. We will cover what the flip level actually is, what changes when spot crosses it, and how to use it inside a session. If you want the underlying market structure in more depth, start with the [Gamma Exposure pillar](/education/gamma-exposure-explained); for the calculation methodology, see the [Gamma Flip Calculation guide](/guides/gamma-flip-calculation-before-vs-after).

---

## What is a gamma flip?

The gamma flip is the price level at which aggregate dealer gamma exposure crosses zero. Above the flip, dealers are typically net long gamma; below it, they are typically net short. It is not a fixed strike. It is the price at which the dealer gamma profile changes sign — and as the chain reweights through the day, that price moves.

A few things worth being explicit about:

- The flip is a **level, not a wall.** It does not resist price the way a heavy call or put strike might. It marks a behavioral inflection point, not a structural barrier.
- It is a **regime indicator, not a directional one.** Spot above the flip is not bullish. Spot below it is not bearish. The regime tells you about realized *volatility character*, not direction.
- It is **dynamic.** As open interest rolls, expiries decay, and fresh flow hits the book, the flip drifts. A stale flip is a misleading flip.

Treat it the way a meteorologist treats a weather front — knowing which side you are on tells you what kind of weather to expect, not where the storm is going.

---

## What happens above the gamma flip?

Above the flip, dealers are generally net long gamma. To stay delta-neutral, they sell into strength and buy into weakness. That hedging reflex pushes *against* directional moves rather than with them.

Practical consequences traders see on the tape:

- **Realized vol tends to compress.** Breakouts more often stall and get faded.
- **Pin behavior becomes more likely.** Price tends to gravitate toward strikes with heavy gamma concentration, especially into the close.
- **Mean-reversion setups have a higher hit rate.** Fading rallies into a [call wall](/education/gamma-walls-explained), dip-buying near a put wall, and short-premium structures all benefit from the dampening reflex.
- **Trend-following has a lower hit rate.** Breakouts that look clean on a 5-minute chart often fail to extend.

None of this is a guarantee. Macro shocks, OpEx mechanics, or a flip-cross down can override the regime mid-session. As a baseline lean, though, above-flip behavior leans toward calm.

---

## What happens below the gamma flip?

Below the flip, dealers are generally net short gamma. To stay delta-neutral, they now buy into strength and sell into weakness. That hedging reflex pushes *with* directional moves, not against them.

Practical consequences:

- **Realized vol tends to expand.** Breakouts have more follow-through; selloffs accelerate.
- **Pin behavior breaks down.** Strikes that magneted price above the flip start releasing it.
- **Trend-continuation has a higher hit rate.** Momentum tends to extend rather than fade.
- **Mean-reversion gets dangerous.** Catching a falling knife in a deep negative-gamma regime tends to compound losses, because the dealer reflex you would be counting on (buying weakness) is the reflex that just inverted.

This is also a probabilistic lean, not a forecast. A single calm headline can quiet the tape inside the same regime. But knowing you are in short-gamma territory should change which trades you take and — more importantly — which trades you skip.

---

## How to act on the gamma flip intraday

Reading the gamma flip in real time is a short set of habits:

1. **Check the regime first.** Before any setup, know whether spot is above or below the flip. That single read filters out a meaningful share of bad trades.
2. **Watch the distance to the flip.** Spot clear of the flip by a healthy margin is a stable regime read. Spot wedged within a few tenths of a percent is a contested regime — both sides of the book are partially active, and behavior is unstable. Tighten size or stand aside.
3. **Watch for migration.** Flip levels shift as positioning rebalances. A flip that drifts up alongside price has a different meaning than one anchored while price moves toward it.
4. **Pair the flip with the walls.** The flip tells you the regime; the [call wall and put wall](/education/gamma-walls-explained) tell you the structural boundaries inside it. Read them together.
5. **Respect 0DTE concentration.** When same-day expiries dominate the chain, the flip becomes especially reactive. See [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained) for the regime-specific reads.

The discipline is to use the flip as a **filter**, not a signal. It tells you which playbook to be running; the entry still has to come from somewhere else.

---

## Reading the gamma flip on ZeroGEX

The ZeroGEX dashboard surfaces the flip in two places:

- **The Gamma Flip metric card** shows the current flip level alongside live dollar and percent distance from spot.
- **The dealer gamma profile chart** plots the curve across strikes, with the zero crossing — the flip — visible directly.

![ZeroGEX dashboard Gamma Flip card showing SPX spot above the flip with live distance](/blog/zerogex-gamma-flip-card.png)

A worked example. Suppose SPX is trading at 5,830 and the dashboard shows:

- **Net GEX:** +$1.2B
- **Gamma Flip:** 5,815
- **Distance:** +15 / +0.26%

The read: spot is in long-gamma territory, comfortably above the flip. The headline Net GEX figure is consistent with the regime — positive, because it is the value of the same dealer gamma curve evaluated at spot, and that curve only turns positive once you have crossed above the flip. (That sign-consistency is structural to how ZeroGEX calculates the profile.) Practical lean: dampened vol, breakouts more likely to fade, pin behavior toward heavy-gamma strikes on the table into the close.

![ZeroGEX dealer gamma profile chart with the gamma flip line marked and spot above it](/blog/zerogex-strike-profile-flip.png)

Now imagine the same dashboard 30 minutes later: SPX 5,810, gamma flip 5,818. Spot has crossed below, and the flip has actually drifted up toward where spot was. That is the structural inflection where intraday character changes — and a trader who was fading rallies above the flip should be much more cautious about fading the next selloff inside the new regime.

---

## Common mistakes when reading the gamma flip

A few patterns that catch traders out:

- **Treating the flip as support or resistance.** It is a regime line, not a level to trade against. Buying weakness *into* the flip from above is a structurally different trade than buying weakness from below.
- **Ignoring how dynamic it is.** The flip can move several points in a few hours as positioning shifts. Reading yesterday's flip on today's tape is reading a stale book.
- **Mistaking proximity for confirmation.** Spot sitting *at* the flip is the least informative state, not the most. Both regimes are partially active and the read is weak.
- **Reading the flip without checking the Net GEX magnitude.** A flip with $2B of dealer gamma above it is a much sharper regime than a flip with $200M. Magnitude matters as much as sign.
- **Confusing the flip with max pain.** Max pain is an expiry-pinning estimate based on option-holder payoff. The flip is a real-time hedging-regime line based on dealer gamma. They often disagree, and they answer different questions.

---

## Takeaway

> Above the flip is generally a long-gamma, vol-dampening regime. Below is generally a short-gamma, vol-amplifying one. Spot at the flip is contested, not neutral.

Used as a filter — not as a signal — the gamma flip is the closest thing dealer-positioning analysis has to a single, durable read. It will not tell you which way the market is going. It will tell you which trades have the dealer reflex behind them and which ones are fighting it.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's gamma flip read in real time, the free ZeroGEX dashboard surfaces it alongside Net GEX, the call and put walls, and the dealer gamma profile chart.
