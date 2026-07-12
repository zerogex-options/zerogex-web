# Delta and Its Three Children

*Delta tells a dealer how much stock to hold. But delta never sits still — and it can only move in three ways: with price, with time, and with volatility. Those three sensitivities are gamma, charm, and vanna. Every dollar of forced dealer flow is one of delta's three children coming to collect.*

---

## Start with the hedge ratio

Delta is the most important number in an option and the least interesting. It is simply the hedge ratio: the number of shares that behave like one option contract right now. A 0.55-delta call moves like 55 shares of stock; a −0.30-delta put moves like 30 shares short. A dealer who wants no directional exposure holds the offsetting stock, and the book sits flat.

If delta were a constant, the story would end there. You would hedge once and never touch it again. But delta is a derivative — the rate of change of the option's value with respect to spot — and derivatives are themselves functions of the world. Change the world and delta changes. The dealer's entire ongoing job, and the entire source of readable dealer flow, is chasing delta as it moves.

So the question that actually matters is not "what is delta" but "what makes delta move." There are exactly three answers.

---

## The three ways a delta can move

Between the moment a dealer puts on a hedge and the moment the option expires, three things in the world can change, and each one drags delta with it:

1. **The stock price changes.** Delta's sensitivity to spot is **gamma** (∂Δ/∂S).
2. **Time passes.** Delta's sensitivity to time is **charm** (∂Δ/∂t).
3. **Implied volatility changes.** Delta's sensitivity to vol is **vanna** (∂Δ/∂σ).

That is the whole family. Gamma, charm, and vanna are the three first-order derivatives of delta, one for each variable that can move underneath a hedged book. Traders memorize them as separate greeks with exotic names; they are better understood as a single idea — *how delta moves* — split three ways by *what moved it*.

This is the cleanest mental model for dealer flow: a dealer does not hedge delta, a dealer hedges the **change** in delta. And there are precisely three channels the change can arrive through. Name the channel and you have named the flow.

---

## Gamma: delta moves because price moved

Gamma is the one everyone knows. When the stock rallies, call deltas rise and put deltas rise toward zero; when it falls, they drop. Gamma is how fast that happens. A high-gamma book re-hedges hard for every tick; a low-gamma book barely flinches.

The defining feature of gamma flow is that it is **reactive**. Nothing happens until price moves. Spot sits still, gamma sits silent. Then the market moves 0.5% and the dealer must trade a slug of stock to re-flatten — buying into a rally and selling into a dip if they are short gamma, doing the opposite if they are long. This is the flow behind the gamma flip, the pinning, and the squeeze, and it is covered in depth in the [Gamma Exposure pillar](/education/gamma-exposure-explained).

Gamma is the loudest child. It is also the only one that needs a spot move to speak. The other two are more unsettling, because they force trades when nothing is happening at all.

---

## Charm: delta moves because time passed

Charm is delta's sensitivity to the passage of time. An out-of-the-money option is worth something today only because there is still time for spot to reach it; as that time drains away, its delta bleeds toward zero. An in-the-money option's delta, meanwhile, firms up toward 1. Delta is loosely the probability of finishing in the money, and as expiry nears that probability has to resolve to a clean yes or no. The drift as it resolves *is* charm.

The unsettling part: charm forces hedging with spot perfectly pinned. The clock is a trader. A dealer can watch the tape do absolutely nothing for an hour and still be forced to sell stock the entire time, because the deltas in the book are quietly decaying and the hedge has to shrink to match. On a 0DTE-heavy chain, this flow concentrates violently into the final hour, when the rate of decay peaks. [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader) is the full treatment.

---

## Vanna: delta moves because fear moved

Vanna is delta's sensitivity to implied volatility. Raise the market's priced fear and the distribution of possible outcomes fattens, pulling out-of-the-money deltas up toward the middle; lower it and the distribution sharpens, pushing them back toward their intrinsic 0 or 1. So a change in vol re-prices every option's delta without spot moving a cent.

Vanna is the quietest child and, in the right regime, the most persistent. After a scare that never delivers — an event where implied vol got bid up, then bleeds lower for days once the risk passes — the dealer book's delta drifts a little lower every hour, and the re-hedge is a steady, mechanical bid. That is the vol-compression grind: markets floating higher on no news and no volume. [Vanna: When Fear Fades, Dealers Buy](/education/vanna-when-fear-fades) walks through the mechanism.

---

## Why you can't just add them up

A tempting shortcut: compute each greek's flow separately and sum them. Gamma flow plus charm flow plus vanna flow equals total forced flow. It is a fine first approximation and a bad final answer, because the three children interact.

Gamma itself changes as time passes and as vol shifts. The charm you have at today's spot is not the charm you have after a 2% move. A scenario that combines a spot move, an afternoon of decay, and a vol drop is not the sum of the three effects computed in isolation — the cross-terms are real and, near expiry, large. Adding the greeks is a Taylor expansion, and Taylor expansions fall apart exactly where the action is: close to the money, close to expiry, where the surface curves hardest.

The honest way to compute forced flow is to **fully re-price the book** under the new scenario, read off the dealer's delta in that new state, and take the difference from the delta now. The greeks are then useful for *attribution* — telling you how much of the compelled trade was gamma versus charm versus vanna — but the total comes from repricing, not from summing. This is exactly what the live [Forced Flow](/forced-flow) reprice curve does: it moves spot across a grid, reprices every contract, and reads the compelled hedge directly. The gamma/charm/vanna split is drawn as attribution bands underneath, so you see both the total and which child is driving it.

---

## The one-sentence version

Delta is a hedge ratio that will not hold still. It moves with price (gamma), with time (charm), and with volatility (vanna) — and nothing else. Every forced dealer trade in the market is one of those three sensitivities pulling the book off its hedge and demanding a stock trade to put it back.

Learn the parent and the three children, and dealer flow stops being a mystery and starts being an accounting problem. For the foundation under this whole idea, see [Why Market Makers Are Forced to Trade Stock](/education/why-market-makers-trade-stock).

Educational content only — none of the above is a trade recommendation.
