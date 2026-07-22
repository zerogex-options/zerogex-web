# Why Market Makers Are Forced to Trade Stock

*When market makers trade stock, it often isn't because they have a directional view. It is because the delta of the options they hold keeps changing — and as it changes, they generally need to adjust the underlying hedge to stay near flat. That hedging flow is one of the more structurally estimable sources of order flow in the market.*

> **Key takeaway**
> Dealers generally do not hedge because they became bullish or bearish. They hedge because the risk of their options portfolio changed. Understanding what changes that risk helps explain where hedge pressure may appear in the market.

---

## The dealer's job is to stay neutral

A market maker who sells you a call option is generally not trying to express a bearish view. They want the spread — the few cents between the bid and the ask — and generally want to keep their directional exposure near neutral. Selling the call leaves them short delta, so they buy stock against it until the position is approximately delta-neutral. That is delta-hedging, and it is a core part of the economic model of an options dealer: warehouse the option, neutralize the direction, collect the edge.

The problem is that "flat" is not a place you arrive at once. It is a place a dealer keeps returning to, throughout the session, because the delta of an option book rarely sits still. And here is the part that matters for anyone reading flow: when that delta moves, the resulting hedge is generally driven by risk management rather than a directional view. No conviction, no market call — the book's risk changed, so the dealer generally needs to adjust. *When* and *how* they do it stays discretionary. The likely direction and approximate size of that adjustment are the parts that are more estimable.

That distinction — risk-driven versus discretionary — is why dealer hedging is readable at all. Discretionary flow is a guess about what a trader *wants* to do. Hedging flow is an estimate of what a dealer will likely *need* to do to stay near flat. One depends on trader intent. The other is constrained by portfolio mechanics.

---

## Delta is a moving target, not a number

Delta is the hedge ratio: how many shares of stock offset one option contract. A call with delta 0.40 behaves, right now, like 40 shares of long stock per contract. Sell 100 of those contracts and you are short 4,000 deltas; buy 4,000 shares and you are flat.

But 0.40 is a snapshot, not a constant. That same call will have a different delta tomorrow even if the stock never moves, a different delta if implied volatility ticks down, and a very different delta if the stock rallies 1%. The dealer hedged to 0.40. Once delta drifts to 0.44, the book is short roughly 400 deltas it didn't sign up for, and the dealer will generally buy about 400 more shares to move back toward flat.

So hedging is really two jobs, not one. First the dealer neutralizes the *current* level of the book's delta — the one-time trade that puts the position near flat. Then comes the ongoing job: as new options trade and as spot, time, and vol move that delta around, the dealer rebalances to stay near flat. The initial hedge is established when the position is put on. The flow that shows up on the tape is the endless stream of re-hedges that chase delta as it drifts. Understand what moves delta, and you understand where the hedging pressure comes from.

---

## The stock they already hold tells you less than you think

Here is a trap worth stepping around early, because it sinks a lot of naive dealer-positioning analysis.

You might think the way to gauge dealer pressure is to add up all the delta in the book — every contract's delta times its open interest — and call that "dealer exposure." It feels right. It is the natural sibling of gamma exposure. But it leans on a hidden assumption, and it often measures the wrong thing for estimating future hedge pressure.

Start with the assumption. Open interest tells you a contract exists; it does not tell you whether a dealer is long or short it. Dealer inventories are not publicly disclosed in a complete, real-time form, so any "dealer delta" figure has to be inferred from a model of who is likely holding what — a reasonable estimate, but an estimate. Now grant the estimate and look at what the *level* of delta even measures. The shares a dealer holds against their options have a delta of exactly 1.00 each, put on *specifically to cancel* the option delta. By construction, a well-hedged dealer's net delta sits near zero — the option delta and the stock delta roughly offset. So a figure that sums the level of option delta is describing the one exposure dealers work hardest to flatten, while ignoring the offsetting stock they hold against it.

What the level misses is how much that delta is about to *move*. Stock has a delta of 1 that doesn't change, so a static stock hedge cannot neutralize future changes in option delta. Future hedge pressure comes from changes in the dealer's estimated portfolio delta, not from summing the delta sitting in the book today. That drift — the part a static stock hedge cannot fully absorb in advance — is where much of the rehedging flow is born. (We wrote a whole piece on why the level-of-delta number is a trap and why we refuse to publish it — see [Why We Don't Publish DEX](/education/why-we-dont-publish-dex).)

---

## Three forces move delta, and the dealer rides all three

Between now and expiry, three variables dominate how an option book's delta moves intraday, and a dealer has little control over any of them:

- **Spot price.** When the stock moves, every option's delta moves with it. The sensitivity of delta to spot is **gamma**. This is the reactive component — it responds when price moves, and its effect can be large and immediate.
- **Time.** As expiry approaches, delta drifts even with spot pinned: out-of-the-money options bleed toward delta 0, in-the-money options climb toward delta 1. The sensitivity of delta to time is **charm**. It runs continuously, whether or not anything happens.
- **Implied volatility.** When the market's priced fear rises or falls, delta shifts with spot perfectly still. The sensitivity of delta to vol is **vanna**. A vol reset can move the book's delta hard without a single tick in price.

Price, the clock, and fear. Those are the three big levers, and the dealer is exposed to all three. When any of them moves, it drags the book's delta off its hedge and creates pressure to adjust the stock hedge. These aren't the *only* inputs — interest rates, dividends, shifts in the volatility surface, financing assumptions, and fresh option trades hitting the book all nudge delta too — but intraday they are usually second-order next to spot, time, and vol. The combined effect is what we call **Forced Flow**: an estimate of the stock a dealer will generally need to buy or sell to stay hedged as spot, time, and vol evolve.

---

## What this is worth in dollars

The abstraction becomes concrete the moment you attach a size to it.

Say the dealer book in SPY is estimated to be positioned such that a 1% move in the underlying changes aggregate dealer delta by about 1 million shares. The hedge is that share change times the price of the stock: at SPY $560, that is 1,000,000 × $560 ≈ **$560 million**. Under the model's assumptions, that represents roughly $560 million of potential hedge demand — stock that would generally need to change hands to keep the book near flat, before a single discretionary trader has formed an opinion. In a short-gamma regime dealers generally buy into strength and sell into weakness, so that flow tends to push *with* the move, widening the range. In a long-gamma regime it leans against the move and compresses it. Same machinery, opposite sign, very different tape.

Charm and vanna carry their own dollar tags. On a heavy 0DTE day, time decay alone might imply tens of millions of stock to hedge by the close — though the direction depends on how the book is estimated to be positioned, not on the clock alone. A two-point drop in implied vol after a calm CPI print might imply a similar-sized hedge; whether that becomes buying or selling again depends on the sign of the book's estimated vanna. None of it is a market call. All of it is the book being rebalanced back toward flat.

---

## Why Forced Flow is the flow worth reading

Most order flow is a fog of competing intentions. Someone is buying, someone is selling, and you are guessing at motive. Dealer hedging is different in kind: it is a persistent stream shaped by positioning and the three variables above rather than by anybody's opinion. That makes it generally more estimable than discretionary flow. If spot moves 1%, gamma-related hedging tends to respond. As the clock runs toward the close, charm-driven hedging tends to build. If vol drops two points, vanna-related hedge pressure can follow — in a direction set by the book's estimated positioning. The need to manage the risk is mechanical, even though the timing and execution remain discretionary.

That is what the rest of this series unpacks. [Delta and Its Three Children](/education/delta-and-its-three-children) breaks down gamma, charm, and vanna as the three derivatives of delta. [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader) shows how time decay alone can drive an estimable into-close flow you can model hours in advance. [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades) explains the vol-compression grind. And the live [Forced Flow](/forced-flow) page reprices the entire book under any spot/time/vol scenario, so you can see the estimated hedge pressure before it may reach the tape.

Dealer hedging is not perfectly predictable. Inventories aren't public, positioning has to be inferred, and the timing and execution of any hedge stay at the dealer's discretion.

But because it is driven by portfolio risk rather than discretionary opinion, it is one of the more structurally estimable sources of potential buying and selling pressure in modern markets. The purpose of Forced Flow is not to predict the exact order before it prints. It is to estimate where dealer hedging may reinforce, resist, or shift market movement as price, time, and volatility evolve.

Educational content only — none of the above is a trade recommendation.
