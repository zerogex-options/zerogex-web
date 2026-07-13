# Why We Don't Publish DEX

*Delta Exposure — DEX, the sum of every contract's delta times its open interest — looks like the natural sibling of gamma exposure. We refuse to publish it. It measures the one greek dealers have already hedged to zero, it puts all its weight in the strikes where the data is worst, and it is loudest exactly where forced flow is weakest. Here is the full case against a number a lot of tools will happily sell you.*

---

## The number that looks right and reads wrong

If gamma exposure works, delta exposure should work too. That is the intuition, and it is why "DEX" shows up on dashboard after dashboard, sitting next to GEX like its twin. Take every option in the chain, multiply each contract's delta by its open interest, sum it up, and you have a single number that supposedly tells you how the dealer book leans directionally. Positive DEX, dealers are long; negative DEX, dealers are short. Clean, symmetric, marketable.

It is also close to meaningless, and we made an early decision not to put it in front of anyone. Not because it is hard to compute — it is trivial to compute, which is part of the problem — but because the number is wrong in three independent and compounding ways. Any one of them would be disqualifying. Together they make DEX not merely uninformative but actively misleading, because it draws the eye to exactly the wrong part of the chain.

This is the article we most wanted to write in this series, because the discipline of *not* shipping a plausible-looking metric is worth more than most of the metrics people do ship.

---

## Strike one: dealers have already hedged delta to zero

Gamma exposure is meaningful because of a specific fact: **you cannot hedge gamma with stock.** Stock has a delta of 1 and a gamma of exactly zero. A dealer who is short gamma from selling options has no way to neutralize it with the underlying — they are stuck carrying it, and that trapped gamma is what forces them to chase price around. GEX measures a real, un-neutralized exposure. That is why it moves markets.

Delta is the opposite case in every respect. Delta is *precisely* the greek dealers hedge with stock, because stock is a pure-delta instrument. That is the entire job. A dealer sells a 0.40-delta call, buys 40 shares against it, and the position's net delta is zero. Do that across the whole book and the dealer's *net* delta is, by construction, approximately nil. Delta-hedging is the definition of the business.

So what does a Σ(Δ·OI) aggregate actually measure? It measures the delta of the *options alone*, ignoring the mountain of offsetting stock the dealer is holding against them. It is one leg of a two-leg position, reported as if it were the whole thing. The other leg — the stock hedge that cancels it — is invisible to the formula. DEX is a number that is large and dramatic specifically because it omits the hedge whose entire purpose is to make it small.

GEX measures an exposure dealers *can't* get rid of. DEX measures the one exposure they have already gotten rid of. That asymmetry is not a detail. It is the whole game, and it is why the two numbers are not siblings at all.

---

## Strike two: delta's weight lives where the data is worst

Set aside the hedging problem and grant, for the sake of argument, that we want to weight the chain by delta. Look at where that weighting puts its mass.

Delta runs from 0 to 1. It is near 0 for deep out-of-the-money options, crosses 0.5 near the money, and approaches 1 for deep in-the-money options. Compare that to gamma, which peaks sharply at-the-money and falls toward zero in both wings. Weighting the chain by delta instead of gamma does one specific thing: it drags the metric's center of mass **toward the in-the-money side** — and it hands real weight to the **deep in-the-money tail**, strikes that a gamma-weighted metric correctly ignores because their gamma is nil.

That in-the-money tail is the worst part of the chain to lean a metric on:

- They are illiquid. Deep-ITM options barely trade.
- Their spreads are wide, so their marks are stale and unreliable.
- Their open interest is frequently old, left over from positions opened long ago, rolled, or forgotten — and open interest is the input DEX multiplies by.

Meanwhile, the three greeks that actually drive forced flow — gamma, charm, and vanna — all peak **near the money**, where the options are liquid, tightly quoted, actively traded, and where open interest reflects live positioning. GEX draws its signal from the cleanest part of the chain. DEX draws its signal from the dirtiest. You could hardly design a metric more perfectly aimed at the noise.

---

## Strike three: delta is not where the flow is

This is the deepest problem, and it is the one that ties the series together. **Forced flow does not come from the level of delta. It comes from the change in delta.** A dealer does not trade stock because their book has delta; they trade stock because their book's delta *moved*. (That is the entire thesis of [Why Market Makers Are Forced to Trade Stock](/education/why-market-makers-trade-stock).)

Now ask which strikes generate the change. Delta moves fastest where gamma, charm, and vanna are largest — near the money, near expiry. It barely moves at all in the deep wings. A deep-ITM call with delta 0.98 has a gamma near zero, a charm near zero, and a vanna near zero. Its delta is going to sit at roughly 0.98 no matter what spot, the clock, or vol does over the next few hours. It generates essentially **no hedging flow.**

And yet that same 0.98-delta contract, multiplied by its open interest, dumps almost its full weight into DEX. The metric assigns maximum importance to the strike that produces minimum flow. Run that logic across the chain and you find DEX is loudest exactly where forced flow is quietest, and quietest — near the money, where delta is a middling 0.5 — exactly where forced flow is loudest. DEX is not merely uncorrelated with the thing traders care about. It is close to *anti*-correlated with it. It systematically points away from the strikes that move the market.

Three strikes. A metric that measures a hedged-flat exposure, weights it toward the dirtiest data in the chain, and concentrates its signal precisely where no flow is generated. There is no version of that number worth putting on a screen.

---

## What we publish instead

The fix is not a better weighting of delta. It is to stop measuring the *level* of anything and start measuring the *forced trade*.

Our [Forced Flow](/forced-flow) engine does not sum Δ·OI. It sets up a scenario — spot moves this far, this much time passes, implied vol shifts this much — and **re-prices the entire book** in that new state. It reads the dealer's delta after the scenario, subtracts the dealer's delta now, and multiplies the difference by spot. The result is a dollar figure: the stock dealers are mechanically compelled to buy or sell to stay hedged as the world changes.

That number is everything DEX is not:

- It is a **flow**, not a level — it measures the compelled trade, which is the thing that actually hits the tape.
- It is driven by **gamma, charm, and vanna**, which live near the money in the clean, liquid, live part of the chain.
- It is dominated by the strikes that **generate** hedging, not the dead deep-ITM contracts that generate none.
- It comes from a **full reprice**, so the cross-terms between spot, time, and vol are handled correctly instead of being approximated away.

We then split that total into gamma, charm, and vanna attribution bands, so you can see not just how much dealers must trade but *why*. That is a number that means something. Σ(Δ·OI) is not.

---

## The honest caveat

We are not claiming delta is fake or that dealers ignore it. Delta is the most important greek in any single option — it is the hedge ratio, and hedging it is the dealer's whole job. Nor are we claiming that no one, anywhere, can extract anything from delta data with enough care about liquidity and OI hygiene.

The claim is narrower and, we think, airtight: a **Σ(Δ·OI) aggregate, published as a headline number next to GEX, is not a tradeable signal**, and presenting it as GEX's symmetric twin implies a parallel that does not exist. GEX earns its place because gamma can't be hedged with stock, concentrates near the money, and drives real flow. DEX fails all three tests. Putting them side by side doesn't give you two signals. It gives you one signal and one number that quietly poisons the read next to it.

---

## Why the omission is the point

It would be easy to add a DEX tile. It costs nothing to compute, it fills space, it matches what competitors show, and most users would never know it was hollow. That is exactly why leaving it off matters. A dashboard is a set of claims about what deserves your attention. Every number on it says "this is worth looking at." We are not willing to make that claim about a metric that measures a hedged-flat exposure, in the dirtiest data in the chain, precisely where no flow is born.

We would rather ship one number that survives scrutiny than two numbers where the second is decoration. DEX is decoration. Forced Flow is the trade.

For the machinery behind the alternative, start with [Why Market Makers Are Forced to Trade Stock](/education/why-market-makers-trade-stock) and [Delta and Its Three Children](/education/delta-and-its-three-children), then open the live [Forced Flow](/forced-flow) page and watch the reprice curve do the thing DEX only pretends to.

Educational content only — none of the above is a trade recommendation.
