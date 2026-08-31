# What Is a Gamma Wall? Gamma Walls in Trading Explained

*The short answer, in plain English — what a gamma wall is, the two kinds, why price often reacts near them, and why a wall is a reference level rather than a floor or a ceiling.*

---

## What is a gamma wall?

A **gamma wall** is a strike on the option chain where modeled dealer gamma exposure is heavily concentrated. It marks a price level where option positioning is unusually dense, so the hedging that dealers may do around that level can be larger than it is at neighboring strikes.

Two things follow from that definition, and both matter.

First, a gamma wall is derived from real open interest — contract by contract, weighted by the gamma each contract carries — not from chart geometry. It is not a moving average, a trendline, or a round number.

Second, a wall describes *where positioning sits*, not *what price will do*. Whether a wall behaves as resistance, support, a magnet, or an accelerant depends on the modeled dealer gamma **sign** and the surrounding flow — not on whether the contracts at that strike happen to be calls or puts.

## The two gamma walls

Traders usually mean one of two specific levels when they say "gamma wall":

- The **call wall** — the heaviest call-gamma concentration above spot. See [What Is a Call Wall?](/education/what-is-a-call-wall)
- The **put wall** — the heaviest put-gamma concentration below spot. See [What Is a Put Wall?](/education/what-is-a-put-wall)

Together they bracket spot, and traders often read them as the outer edges of the range that current positioning is most consistent with. That reading holds more often in a positive-gamma regime and less often in a negative one — which is why the walls are read alongside the [gamma flip](/education/how-to-read-a-gamma-flip) rather than on their own.

## Why price can react at a gamma wall

Dealers who are delta-hedged do not hold a static hedge. As spot moves, the delta of the options they hold changes on its own, and restoring the hedge means buying or selling the underlying. Gamma measures how fast that delta changes.

Where gamma is concentrated at one strike, the hedging adjustment as price approaches that strike is correspondingly larger. In a positive-gamma regime that adjustment leans against the move — selling into strength, buying into weakness — which is the mechanism behind the common observation that price stalls or churns near a wall. In a negative-gamma regime the same concentration can work the other way, with hedging adding to the move instead of damping it.

This is a modeled tendency, not a rule. Dealer inventory is not directly observable, and the sign convention used to model it is an assumption.

## Why a gamma wall is not support or resistance

This is the most common misreading, and it is worth being blunt about.

A wall is not a mechanically defended level. Nothing obliges any participant to trade at a strike, and the hedging flow that a wall implies is only one source of order flow among many. Large walls are broken regularly — often on days when a macro catalyst or an index rebalance supplies flow that dwarfs hedging.

A more defensible way to hold it: a gamma wall tells you where positioning is dense enough that a reaction is *more likely than at a random strike*, and it tells you nothing about direction on its own.

## Gamma walls move

Walls are not fixed for the session. They are recomputed as the book changes, and they migrate for two separate reasons:

- **Open interest changes.** New positions open and old ones close, shifting where gamma actually sits.
- **Repricing.** As spot, time, and implied volatility move, the gamma each existing contract carries changes — so the ranking of strikes can shift even with open interest unchanged.

A wall that was 40 points away at the open can be a different strike by the afternoon. This matters most on 0DTE, where repricing is fastest.

## How walls relate to the other levels

- The [gamma flip](/education/how-to-read-a-gamma-flip) is where modeled dealer gamma changes sign. It sets the regime that decides whether walls damp or amplify.
- [Max pain](/education/max-pain-explained) is an expiration-value calculation, not a gamma concentration. Different construction, different meaning.
- The walls are the two dense gamma strikes on either side of spot.

For the fuller treatment — how walls behave through the session, and when the thesis holds versus breaks — see [Gamma Walls Explained](/education/gamma-walls-explained). For the underlying concept, start with the [Gamma Exposure pillar](/education/gamma-exposure-explained).

## Today's gamma walls

ZeroGEX publishes the current call wall and put wall for SPX, SPY, QQQ, NDX, ES and NQ on free, delayed pages — no signup required:

- [SPX gamma levels](/spx-gamma-levels)
- [SPY gamma levels](/spy-gamma-levels)
- [QQQ gamma levels](/qqq-gamma-levels)
- [NDX gamma levels](/ndx-gamma-levels)

Levels on those pages are delayed roughly 15 minutes and are modeled estimates, not observed dealer inventory.
