# What Is a Gamma Squeeze? How Dealer Hedging Feeds a Move

*A gamma squeeze is a move that feeds on itself because the dealers on the other side of the options have to hedge in the same direction as price. Here is how one starts, why short-dated options matter so much, how it differs from a short squeeze, what usually ends it, and what gamma exposure data can and cannot tell you about one.*

---

## What is a gamma squeeze?

A **gamma squeeze** is a fast move in a stock or index - usually higher - that is fed by option dealers' own hedging. When dealers are **short gamma**, a rising price pushes up the delta of the options they are short, so they have to buy more of the underlying to stay hedged. That buying lifts price further, which raises delta again, which calls for more buying. The move helps pay for its own continuation.

The textbook source of that short gamma is heavy **call buying**. A market maker who sells calls to customers is short those calls and hedges by buying the underlying. As price climbs toward and through the strikes, each call's delta rises, and the hedge has to grow with it. For options near the money, the closer expiration is, the faster delta changes, which is why short-dated calls do most of the work.

Three things to hold onto:

- **The forced buyer is a hedger, not an investor.** Dealers are not betting on direction; they are trying to keep their books close to delta-neutral. A squeeze happens when that bookkeeping all points the same way.
- **It is a feedback loop, not a cause.** Something else starts the move - news, a wave of buying, a break of a level. Dealer hedging is what can make it run further and faster than it otherwise would.
- **It needs fuel close to the current price.** Gamma is concentrated in options near the money. Once price runs well past the strikes where the short gamma sits, the hedging demand from those strikes fades.

The term went mainstream during the meme-stock rallies of early 2021, when heavy retail call buying in a handful of single stocks put a spotlight on how option dealers hedge. The mechanism itself is as old as options market making.

## How a gamma squeeze works, step by step

1. **Customers buy calls.** Often short-dated and out of the money, and often in size relative to the underlying's normal volume.
2. **Dealers sell them and hedge.** The market maker on the other side is now short calls, which leaves it short delta. It buys shares or futures to get back to neutral.
3. **Price rises.** For whatever reason - the hedging itself, more buying, a headline.
4. **Delta rises.** Gamma is the rate at which delta changes. As price approaches a strike the dealer is short, each call's delta climbs, so the dealer's short delta grows.
5. **Dealers buy more.** To stay neutral, the hedge has to grow with delta, so the dealer buys more of the underlying - into a rising price.
6. **Repeat.** That buying can lift price toward the next strike, where the same thing happens again.

The loop runs in reverse too. If price falls, the calls' delta drops and dealers sell part of their hedge, which can add to the decline. Short gamma amplifies moves in both directions; a squeeze is the name traders give the upside version. The regime itself is covered in [What Does Negative Gamma Mean?](/education/what-is-negative-gamma); this piece is about the event.

## Why expiration matters: gamma peaks near the money, near expiry

An option's gamma is highest when it is at the money and close to expiration. A 0DTE call a little out of the money can go from a small delta to a large one on a modest move, while the same strike a month out barely changes. That is why squeezes tend to be tied to short-dated options, and why they tend to be short-lived:

- **The fuel burns fastest near expiry.** Hedge adjustments are largest exactly when gamma is highest, so the feedback is strongest in the final hours or days before the options expire.
- **Expiration removes the fuel.** When the options expire, their gamma - and the hedging it required - is gone. A move that leaned on that hedging can lose its support the next session.
- **Deep in the money, gamma fades.** Once price runs far past a strike, those calls behave almost like stock, with a delta near 1. Their gamma drops and they stop forcing extra buying. A squeeze that is not refueled by new buying at higher strikes tends to run out of steam.

For index traders this is the 0DTE story: same-day SPX and SPY options now make up a large share of index options trading, which is why the dealer book can change character within a single session. [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained) covers that in depth.

## Gamma squeeze vs short squeeze

The two get confused because they produce the same picture - a fast, forced rally - and they can happen in the same stock at the same time. The mechanics differ:

| | Gamma squeeze | Short squeeze |
|---|---|---|
| Who is forced to buy | Option dealers adjusting their delta hedges | Short sellers buying back borrowed shares |
| What creates the pressure | Short gamma near the current price, typically from heavy call buying | Short interest meeting a rising price, higher borrow costs, margin calls |
| Where the fuel sits | Open interest in near-the-money, short-dated options | The number of shares sold short |
| What usually ends it | Expiration, price running past the concentrated strikes, call demand fading | Shorts finishing their covering, new supply |

A short squeeze needs short sellers. A gamma squeeze needs only short-gamma dealers and a move to start the loop.

## Gamma squeezes in single stocks vs indexes

**Single stocks.** The classic squeeze is call-driven. A burst of call buying in a name where options activity is large relative to trading in the shares themselves can leave dealers heavily short gamma at a few strikes, and their hedging can become a meaningful share of the stock's volume. Single stocks also carry company news, so the trigger is often a headline.

**Indexes.** SPX, SPY, QQQ and NDX options markets are vast and dominated by hedging, so a call-buying burst rarely moves the whole index on its own. The index version usually starts on the other side of the book. Customers buy puts for protection, so dealers are modeled short those puts. Below the [gamma flip](/education/how-to-read-a-gamma-flip), that short-put book is short gamma: as price rises, the puts lose delta and the short hedges dealers held against them are bought back, which adds to the rally. Once price climbs back above the flip, the modeled book turns long gamma and hedging starts leaning against the move instead. That is why a rebound out of a negative-gamma regime can have hedging behind it on the way up to the flip, and loses that tailwind above it.

## How a gamma squeeze shows up in gamma exposure data

GEX data can show the *conditions* a squeeze needs. It cannot confirm that one is happening, for a reason worth understanding.

**What it can show:**

- **The regime.** With spot below the gamma flip - net GEX negative at spot - the modeled dealer book is short gamma, and hedging tends to chase price instead of leaning against it. That is the environment in which a rally can feed on itself.
- **The magnitude.** A deeply negative [net GEX](/education/spx-net-gamma-exposure-today) reading describes more hedging per point of movement than one near zero.
- **The strikes in play.** The [call wall](/education/what-is-a-call-wall) is the strike where modeled call gamma is heaviest above spot. In a long-gamma regime it tends to act as a ceiling; if it gives way in a short-gamma regime, hedging can add to the move rather than absorb it.

**What it cannot show:** who opened each trade. The standard GEX convention - the one ZeroGEX uses - assumes customers mostly *sell* calls (overwriting) and *buy* puts, so dealers are modeled long calls and short puts. A call-buying frenzy is exactly the case where that assumption breaks. If customers bought the calls at a strike, dealers are short them, and a strike the model draws as a wall - a brake - can behave like fuel instead. Public option-chain data does not reveal which side opened a trade, so no open-interest model can see that from positioning alone. It is also the most likely reason a wall breaks "unexpectedly," as our [wall-break study](/education/how-often-do-gamma-walls-break) notes.

For scale, that study measured 737 wall tests over ten weeks. S&P 500 walls (SPX and SPY) broke within an hour of being tested about 31% of the time, and Nasdaq-100 walls (QQQ and NDX) about 47-50%. Call walls and put walls broke at the same rate, and which side of the flip price was on did not change how often walls broke. What the regime changes is whether hedging leans against the move or adds to it once a wall gives way.

## What ends a gamma squeeze

- **Expiration.** The short-dated options carrying the gamma expire, and the hedging they required goes with them.
- **Price runs past the fuel.** Deep in the money, the calls' gamma fades and they stop forcing new buying.
- **Demand dries up.** Without fresh call buying at higher strikes, no new short gamma replaces what is burning off.
- **The regime turns.** In an index, a rally that carries price above the gamma flip moves the modeled book into long gamma, where hedging leans against further gains.
- **Volatility moves.** A sharp change in implied volatility reprices gamma across the chain and can reshape the hedging picture on its own.

When the hedging that propped up a move unwinds, the move can retrace quickly - one reason squeezes are known for round trips.

## Common misreadings

- **"Every fast rally is a gamma squeeze."** Most fast moves have other causes - news, flows, short covering. Dealer hedging can add to a move without having caused it.
- **"Negative GEX means a squeeze is coming."** Short gamma is a condition, not a trigger, and it is not directional: the same reflex amplifies selloffs.
- **"The call wall caps the rally."** A wall is a base rate, not a ceiling - S&P walls gave way about one test in three within the hour in our sample, Nasdaq walls about half the time - and the model cannot tell when customers bought the calls at that strike.
- **"A squeeze always round-trips."** Some reverse at expiration; some keep going because the move found real buyers along the way. The hedging explains the speed, not the destination.
- **Confusing it with ZeroGEX's Squeeze Setup signal.** [Squeeze Setup](/education/squeeze-setup-explained) is a composite Pro signal that flags when flow, momentum, gamma and volatility line up for a directional move, in either direction. It is a precondition filter, not a gamma squeeze detector.

## Where to watch the inputs today

ZeroGEX publishes the gamma flip, call wall, put wall, net GEX and max pain for [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), [QQQ](/qqq-gamma-levels), [NDX](/ndx-gamma-levels), [ES](/es-gamma-levels) and [NQ](/nq-gamma-levels), and for the single stocks [NVDA](/nvda-gamma-levels) and [MSFT](/msft-gamma-levels), free and delayed about 15 minutes. The six market instruments are side by side at [GEX levels today](/gex-levels). For what ZeroGEX observes versus what it models, see the [methodology](/methodology).

## Takeaway

> A gamma squeeze is a move fed by dealer hedging: when dealers are short gamma, a rising price forces them to buy more of the underlying, and that buying can push price higher still. It is strongest near the money and near expiration, and it fades when the options expire or price runs past them. GEX data can show the short-gamma conditions a squeeze needs - it cannot show who bought the calls.

Educational content only - none of the above is a trade recommendation.
