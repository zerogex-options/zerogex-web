# Vanna: When Fear Fades, Dealers Buy

*Vanna is the rate at which an option's delta changes when implied volatility changes. When priced fear drains out of the market after an event that never delivered, vanna can push a typical dealer book to buy stock in a slow, steady drip — the "up on no news" grind whose hedge prints hide in plain sight on the tape while the motive behind them stays invisible.*

---

## The flow you can't see in the tape

There is a kind of session every trader recognizes and few can explain: the market floats higher all day, green candle after green candle, on volume that is nothing special and news that is nonexistent. Nobody seems to be buying, yet it keeps going up. Ask around and you get shrugs — "melt-up," "low-vol drift," "gamma." The real engine is usually vanna, and once you understand it, those sessions stop looking mysterious.

Vanna is delta's sensitivity to implied volatility — ∂Δ/∂σ. It is the third of delta's three children, alongside gamma (delta versus price) and charm (delta versus time), laid out in [Delta and Its Three Children](/education/delta-and-its-three-children). Like charm, it forces dealers to trade with spot perfectly still. Unlike charm, its trigger is not the clock but fear: the market's priced expectation of future movement, quoted as implied volatility.

This is the mechanical deep-dive that sits beneath our broader [Vanna and Charm explainer](/education/vanna-and-charm-explained). That piece places vanna in the regime picture; this one shows exactly why a falling vol print turns into a dealer bid.

---

## Why delta moves when vol moves

Implied volatility sets the width of the market's expected distribution of outcomes. High IV means the market thinks a wide range of prices is plausible; low IV means it expects things to stay near where they are.

Now think about what that does to an out-of-the-money call. When IV is high and the distribution is wide, that far-away strike has a real chance of being reached, so its delta is meaningfully above zero — say 0.25. Let the fear drain out, the distribution narrow, and that same strike suddenly looks far less reachable. Its delta falls toward zero — say 0.15. Spot never moved. The only thing that changed was the market's estimate of how far spot *could* move, and that alone re-priced the option's delta.

That shift is vanna. Every out-of-the-money option in the chain re-prices its delta when vol moves, and the whole book's delta drifts as a result. The dealer hedged to yesterday's deltas; today's vol print just changed them; the hedge has to move to catch up.

---

## Why fading fear tends to be a bid

The direction of vanna flow depends on how the book is composed, but the textbook setup — and the one that produces the recognizable grind — runs like this.

Customers, in aggregate, tend to overwrite calls for yield and buy puts for protection — so under the traditional convention dealers are modeled as long those calls and short those puts. Consider the moments *after* a scare: implied vol got bid up ahead of a CPI print, an FOMC meeting, an earnings event. The risk passes. The feared move does not materialize. Implied vol, which was rich, starts bleeding lower over the following hours and days.

As vol falls:

1. The out-of-the-money option deltas in the dealer's book drift toward zero.
2. The dealer's net *long* option delta shrinks, so the book tips short against its stock hedge.
3. To restore the hedge, they buy stock.
4. The vol keeps bleeding, so the drift keeps going, so the buying keeps coming — small, steady, all day.

That steady, mechanical purchase is the vanna grind. It is not a bet. No dealer decided the market should go up. Vol fell, deltas drifted, and the hedge demanded stock. But the aggregate of thousands of small hedge buys is hard to tell apart, on the chart, from genuine demand — which is why the tape can drift higher without any obvious surge in activity. Those buys are real prints and they do add to volume; they just arrive as a steady drip rather than a market-order rush, so they lift price without a dramatic spike in the volume bars — and nothing on the tape flags them as hedging rather than conviction.

---

## The vanna ladder

Because vanna flow is driven by a variable you can shock directly, you can lay it out as a ladder: hold spot and time fixed, step implied vol up and down by a point at a time, and read off how much stock the dealer book is forced to trade at each rung.

The live [Vanna Ladder](/forced-flow) chart does exactly this. At zero vol change the forced flow is zero — nothing has moved, so nothing is compelled. Step vol *down* a point and the chart shows the forced buy that a one-point compression would produce; step it down two points and the buy roughly doubles. Step vol *up* and the sign flips: a vol spike tends to push the same book to sell, which is part of why fear can feed on itself in a selloff. The ladder makes the asymmetry legible — you can see, before it happens, how much of a bid a two-point vol bleed is worth today.

---

## Putting a number on it

Say SPX is at 5,800 the morning after a calm inflation print, implied vol is starting to come in, and the dealer book is modeled with the typical customer-long skew. The engine reprices the book with spot held at 5,800 and vol down two points, and finds modeled dealer delta higher by the equivalent of $60 million of index exposure. That is roughly **$60 million** of estimated hedge buying, spread across the session as the vol actually bleeds — a persistent bid with no catalyst behind it that any headline would report.

Reverse the vol move and the same machinery forces selling. Vanna, like charm, has no built-in direction; the sign comes from the book and the direction of the vol move. What is dependable is the *character* of the flow: slow, steady, invisible in volume, and tightly coupled to the vol trend rather than the price trend.

---

## How to read it without chasing it

Vanna is context, not a trigger. A short discipline:

- **Check the vol trend first.** A multi-day IV bleed after an event is the classic vanna-bid setup. A vol that is rising inverts the flow to selling. No vol trend, no vanna story.
- **Confirm the regime.** The vanna grind coexists naturally with a positive-gamma regime — both favor the same calm, absorbing tape. In a negative-gamma regime the same vol move can get overwhelmed by amplified price reactions. Read [gamma](/education/gamma-exposure-explained) first, vanna inside it.
- **Expect the grind, not a pop.** Vanna buying is a drip. It produces drift, not thrust. If you are waiting for a vanna candle, you have misunderstood the flow — it hides in the slope, not the spike.
- **Respect the volume mismatch.** A steady climb on unremarkable volume is not a warning sign in a vanna regime; it is the signature. It is not that the buying leaves no prints — it does — but that it never spikes and never announces its motive, which is the tell that it may be mechanical hedging rather than conviction.

When the scare that never comes finally passes, the fear has to unwind somewhere. It unwinds through the dealer book, one re-hedge at a time, and it looks like a market quietly deciding to go up for no reason. Now you know the reason.

For the clock-driven sibling see [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader), for the foundation see [Why Market Makers Are Forced to Trade Stock](/education/why-market-makers-trade-stock), and to watch the vanna ladder move with today's book, open the live [Forced Flow](/forced-flow) page.

Educational content only — none of the above is a trade recommendation.
