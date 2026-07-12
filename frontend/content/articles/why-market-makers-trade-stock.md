# Why Market Makers Are Forced to Trade Stock

*Market makers don't trade stock because they have a view. They trade it because the delta of the options they hold keeps moving on its own — and every time it moves, they are mechanically compelled to trade the underlying to stay flat. That forced flow is the most predictable order flow in the market.*

---

## The dealer's job is to have no opinion

A market maker who sells you a call option does not want to be short the market. They want the spread — the few cents between the bid and the ask — and they want to go home flat. Selling the call left them short delta, so they buy stock against it until the position has no net directional exposure. That is delta-hedging, and it is the entire economic model of an options dealer: warehouse the option, neutralize the direction, collect the edge.

The problem is that "flat" is not a place you arrive at once. It is a place you have to keep returning to, all day, every day, because the delta of an option book refuses to sit still. And here is the part that matters for anyone reading flow: when that delta moves, the dealer does not *choose* to trade the underlying. They are *forced* to. The trade carries no view, no conviction, no discretion. Delta moved, so stock gets bought or sold. Full stop.

That distinction — forced versus discretionary — is why dealer hedging is readable at all. Discretionary flow is a guess about what a trader will do. Forced flow is a calculation of what a dealer *must* do. One is a coin flip. The other is arithmetic.

---

## Delta is a moving target, not a number

Delta is the hedge ratio: how many shares of stock offset one option contract. A call with delta 0.40 behaves, right now, like 40 shares of long stock per contract. Sell 100 of those contracts and you are short 4,000 deltas; buy 4,000 shares and you are flat.

But 0.40 is a snapshot, not a constant. That same call will have a different delta tomorrow even if the stock never moves, a different delta if implied volatility ticks down, and a very different delta if the stock rallies 1%. The dealer hedged to 0.40. The moment delta drifts to 0.44, they are short 400 deltas they didn't sign up for, and they have to buy 400 more shares to get back to flat.

So the dealer is never really hedging delta. They are hedging the *change* in delta. The initial hedge is free — you put it on once. The flow, the thing that shows up in the tape, is the endless stream of re-hedges that chase delta around as it moves. Understand what moves delta, and you understand what forces the flow.

---

## The stock they already hold tells you nothing

Here is a trap worth stepping around early, because it sinks a lot of naive dealer-positioning analysis.

You might think the way to measure dealer pressure is to add up all the delta in the book — every contract's delta times its open interest — and call that "dealer exposure." It feels right. It is the natural sibling of gamma exposure. It is also close to useless, and the reason is the stock hedge.

The shares a dealer holds against their options have a delta of exactly 1.00 each. That stock delta is put on *specifically to cancel* the option delta. By construction, a properly hedged dealer's net delta is approximately zero — the option delta and the stock delta sum to nothing. That is the whole point of the hedge. So a number that measures the *level* of delta in the book is measuring the one greek dealers have already flattened to zero. It tells you about a position that has, by design, no net directional exposure left in it.

What is not zero — what can never be pre-hedged away — is how much that delta is about to *move*. Stock has a delta of 1 and it never changes. You cannot use a constant-delta instrument to pre-neutralize a delta that shifts with spot, time, and vol. That residual, the un-pre-hedgeable drift in the book's delta, is the entire source of forced flow. (We wrote a whole piece on why the level-of-delta number is a trap and why we refuse to publish it — see [Why We Don't Publish DEX](/education/why-we-dont-publish-dex).)

---

## Three things move delta, and the dealer controls none of them

Between now and expiry, exactly three state variables move the delta of an option book, and a dealer can influence none of them:

- **Spot price.** When the stock moves, every option's delta moves with it. The sensitivity of delta to spot is **gamma**. This is the reactive flow — it only fires when price actually moves, and it is large and immediate.
- **Time.** As expiry approaches, delta drifts even with spot pinned: out-of-the-money options bleed toward delta 0, in-the-money options climb toward delta 1. The sensitivity of delta to time is **charm**. It runs continuously, whether or not anything happens.
- **Implied volatility.** When the market's priced fear rises or falls, delta shifts with spot perfectly still. The sensitivity of delta to vol is **vanna**. A vol reset can move the book's delta hard without a single tick in price.

Price, the clock, and fear. Those are the three levers, and the dealer is strapped to all three. Each one, when it moves, drags the book's delta off its hedge and forces a stock trade to put it back. That is why we call the combined output **forced flow**: it is the dollar amount of stock a dealer is mechanically compelled to buy or sell as spot, time, and vol evolve.

---

## What this is worth in dollars

The abstraction becomes concrete the moment you attach a size to it.

Say the dealer book in SPY is positioned such that a 1% move in the underlying changes aggregate dealer delta by 8 million shares. SPY at 560 means each 1% move forces roughly 8,000,000 × $5.60 ≈ **$45 million** of stock to change hands purely to keep the book hedged — before a single discretionary trader has formed an opinion. In a short-gamma regime the dealer buys into strength and sells into weakness, and that $45 million pushes *with* the move, widening the range. In a long-gamma regime it leans against the move and compresses it. Same forced-flow machinery, opposite sign, completely different tape.

Charm and vanna carry their own dollar tags. Time decay alone might force tens of millions of stock by the close on a heavy 0DTE day. A two-point drop in implied vol after a calm CPI print might force a similar amount of buying spread across the afternoon. None of it is anybody's opinion. All of it is the book chasing its own delta back to flat.

---

## Why forced flow is the flow worth reading

Most order flow is a fog of competing intentions. Someone is buying, someone is selling, and you are guessing at motive. Forced dealer flow is different in kind: it is the one large, persistent stream in the market that is fully determined by positioning and the three variables above. You do not have to guess whether it will happen. If spot moves 1%, the gamma hedge fires. If the clock runs to 4pm, the charm flow arrives. If vol drops two points, the vanna hedge follows. The flow is a consequence, not a decision.

That is what the rest of this series unpacks. [Delta and Its Three Children](/education/delta-and-its-three-children) breaks down gamma, charm, and vanna as the three derivatives of delta. [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader) shows how time decay alone forces a predictable into-close flow you can compute hours in advance. [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades) explains the vol-compression grind. And the live [Forced Flow](/forced-flow) page reprices the entire book under any spot/time/vol scenario so you can see the compelled trade before it prints.

The dealer has no opinion. That is exactly why their flow is worth more than most opinions.

Educational content only — none of the above is a trade recommendation.
