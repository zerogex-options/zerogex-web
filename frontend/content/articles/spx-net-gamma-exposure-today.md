# SPX Net GEX Today: Current SPX Net Gamma Exposure Value

*"What's the current SPX net gamma exposure?" Today's delayed reading is at the top of this page and refreshes through the session. Below it: what SPX net GEX is, how to read a positive print versus a negative one, what the "dollar gamma" unit means, and where the zero-cross sits.*

---

## Where to see today's SPX net gamma exposure

If you're here for the current number, it's in the box above — the same ~15-minute-delayed **SPX net GEX**, gamma flip, call wall, put wall, and max pain that the free [SPX gamma levels page](/spx-gamma-levels) publishes, refreshed on the same schedule. The same read is available for [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), and [NDX](/ndx-gamma-levels). For the live, sub-second value, the [real-time 0DTE GEX dashboard](/real-time-gex-0dte) updates through the session. The rest of this page explains what that number means and how to use it.

---

## What is SPX net gamma exposure?

**Net gamma exposure (net GEX)** for SPX is the sum of dealer gamma across the entire S&P 500 option chain, collapsed into a single signed dollar figure — often called "dollar gamma." It estimates how much S&P index exposure options dealers would need to buy or sell, mechanically, to stay hedged as SPX moves.

- The **sign** tells you the regime: positive means dealer hedging tends to dampen moves, negative means it tends to amplify them.
- The **magnitude** (e.g. +$1.5B, −$800M) tells you how much modeled hedging sits under the tape — how strongly the regime is likely to express itself.

Net GEX is the headline number in the broader [gamma exposure](/education/what-is-gex-in-trading) framework. It's evaluated at the current spot price, so it moves as SPX moves and as the option chain re-prices through the day.

> Net GEX is a *modeled* estimate. It uses the traditional call-positive / put-negative open-interest convention — dealers modeled as net long the calls customers sell and net short the puts customers buy. Actual dealer inventory is not directly observable from public option-chain data.

---

## Net GEX in "dollar gamma": what the unit means

Net GEX is quoted in dollars — "$1.5B of gamma" — because it is scaled to answer a dollar question: roughly how much S&P index exposure would dealers need to trade to re-hedge if SPX moved 1%? That is why searches for "SPX net GEX dollar gamma" and "SPX net gamma exposure" land on the same figure: dollar gamma *is* net GEX, expressed per 1% move. The sign carries the regime; the dollar magnitude carries how much modeled hedging sits behind it. A print of +$1.5B and one of +$150M describe the same regime with ten times the cushion.

---

## How to read the current net GEX reading

Two cases, opposite playbooks:

- **Positive SPX net GEX (long-gamma regime).** Dealers are net long gamma at spot. They sell rallies and buy dips to hedge, which tends to *suppress* volatility. Expect tighter ranges, more mean reversion, pinning toward heavy strikes, and rally attempts that often stall near the call wall. A large positive reading is a "quiet, rangebound" tell.
- **Negative SPX net GEX (short-gamma regime).** Dealers are net short gamma at spot. They buy rallies and sell dips, which tends to *amplify* volatility. Expect wider ranges, extending breakouts, and trends that run. A large negative reading is a "fast, trending, respect-your-stops" tell. This is [what negative gamma means](/education/what-is-negative-gamma) for the tape.

The reading isn't a direction — it's a *character*. Positive net GEX doesn't say "up," it says "sticky." Negative doesn't say "down," it says "volatile."

---

## The zero-cross: net GEX and the gamma flip

The most-watched moment is the **zero-cross** — where net GEX passes through zero. That price is the [gamma flip](/education/how-to-read-a-gamma-flip): above it dealers are typically net long gamma (positive), below it net short (negative).

When traders search for "SPX net gamma exposure zero cross," this is what they mean — the regime line. Watching net GEX relative to zero, and spot relative to the flip, is the same read from two angles:

- Spot well above the flip with strongly positive net GEX → deep in the calming regime.
- Spot hovering near the flip with net GEX close to zero → an unstable, whippy tape that can tip either way.
- Spot below the flip with negative net GEX → the amplifying regime is in control.

---

## Why the SPX 0DTE book makes today's number move

0DTE options account for a large share of SPX trading activity and can dominate near-spot gamma sensitivity on some sessions. As expiration approaches, ATM gamma can rise sharply while decisively ITM or OTM gamma tends toward zero. Spot, time, and implied volatility can therefore move modeled Net GEX intraday even though official OI generally updates after clearing. Gross volume and OI do not reveal the balance of customer buying and selling or prove net dealer exposure.

Practical implication: a net GEX number from three hours ago may already be stale. For SPX specifically, the *current* reading matters more than for slower, longer-dated books — which is exactly why it's worth pulling the live value rather than trusting a morning snapshot. For the dealer-positioning context behind the intraday swing, see [0DTE dealer positioning explained](/education/0dte-dealer-positioning-explained).

---

## How to use the reading in your session

1. **Open with the number.** Before your first trade, check whether SPX net GEX is positive or negative, and how large. That sets the day's playbook.
2. **Locate the zero-cross.** Mark the gamma flip. Know whether spot is above or below it and by how much.
3. **Match the tactics to the sign.** Positive → fades, range plays, and patience near the walls. Negative → momentum, breakouts, and tighter risk.
4. **Re-check intraday.** Because the 0DTE book shifts, glance at the current reading again after the morning and around the final hour.

---

## Takeaway

> SPX net gamma exposure is one signed number that tells you whether dealers are dampening or amplifying today's move. Read the sign first, watch it relative to the zero-cross, and remember the 0DTE-heavy SPX book keeps the number moving — so pull the *current* value, don't trust this morning's.

Educational content only — none of the above is a trade recommendation.

---

Want to see this in real time? Check today's SPX net GEX on the free [SPX gamma levels page](/spx-gamma-levels) (also [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), and [NDX](/ndx-gamma-levels)), go deeper with [Gamma Exposure Explained](/education/gamma-exposure-explained), or open the [real-time 0DTE GEX dashboard](/real-time-gex-0dte) — [start a free trial](/register) for the live, sub-second read.
