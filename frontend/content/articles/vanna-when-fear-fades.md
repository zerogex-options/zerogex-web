# Vanna: When Fear Fades, Dealers Buy

*Vanna is the rate at which an option's delta changes when implied volatility changes. When priced fear drains out of the market after an event that never delivered, vanna forces dealers to buy stock in a slow, steady drip — the "up on no news" grind that shows up on the chart but never in the volume.*

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

Customers are, in aggregate, long options. They buy calls for upside and puts for protection, and dealers are short the other side. Consider the moments *after* a scare: implied vol got bid up ahead of a CPI print, an FOMC meeting, an earnings event. The risk passes. The feared move does not materialize. Implied vol, which was rich, starts bleeding lower over the following hours and days.

As vol falls:

1. The deltas of the out-of-the-money options the dealer is short drift toward zero.
2. The dealer's net short-delta position shrinks — they are mechanically less short the market than they were.
3. To restore the hedge, they buy stock.
4. The vol keeps bleeding, so the drift keeps going, so the buying keeps coming — small, steady, all day.

That steady, mechanical purchase is the vanna grind. It is not a bet. No dealer decided the market should go up. Vol fell, deltas drifted, and the hedge demanded stock. But the aggregate of thousands of small forced buys is indistinguishable, on the chart, from genuine demand — which is exactly why the tape drifts higher while the volume says nothing is happening. The buying is real; it just arrives as a limit-order drip rather than a market-order surge, so it moves price without lighting up the volume bars.

---

## The vanna ladder

Because vanna flow is driven by a variable you can shock directly, you can lay it out as a ladder: hold spot and time fixed, step implied vol up and down by a point at a time, and read off how much stock the dealer book is forced to trade at each rung.

The live [Vanna Ladder](/forced-flow) chart does exactly this. At zero vol change the forced flow is zero — nothing has moved, so nothing is compelled. Step vol *down* a point and the chart shows the forced buy that a one-point compression would produce; step it down two points and the buy roughly doubles. Step vol *up* and the sign flips: a vol spike forces dealers to sell, which is part of why fear feeds on itself in a selloff. The ladder makes the asymmetry legible — you can see, before it happens, how much of a bid a two-point vol bleed is worth today.

---

## Putting a number on it

Say SPX is at 5,800 the morning after a calm inflation print, implied vol is starting to come in, and the dealer book carries the typical customer-long skew. The engine reprices the book with spot held at 5,800 and vol down two points, and finds dealer delta higher by the equivalent of $60 million of index exposure. That is roughly **$60 million** of forced buying, spread across the session as the vol actually bleeds — a persistent bid with no catalyst behind it that any headline would report.

Reverse the vol move and the same machinery forces selling. Vanna, like charm, has no built-in direction; the sign comes from the book and the direction of the vol move. What is dependable is the *character* of the flow: slow, steady, invisible in volume, and tightly coupled to the vol trend rather than the price trend.

---

## How to read it without chasing it

Vanna is context, not a trigger. A short discipline:

- **Check the vol trend first.** A multi-day IV bleed after an event is the classic vanna-bid setup. A vol that is rising inverts the flow to selling. No vol trend, no vanna story.
- **Confirm the regime.** The vanna grind coexists naturally with a positive-gamma regime — both favor the same calm, absorbing tape. In a negative-gamma regime the same vol move can get overwhelmed by amplified price reactions. Read [gamma](/education/gamma-exposure-explained) first, vanna inside it.
- **Expect the grind, not a pop.** Vanna buying is a drip. It produces drift, not thrust. If you are waiting for a vanna candle, you have misunderstood the flow — it hides in the slope, not the spike.
- **Respect the volume mismatch.** "Up on no volume" is not a warning sign in a vanna regime; it is the signature. The absence of volume is the tell that the buying is mechanical.

When the scare that never comes finally passes, the fear has to unwind somewhere. It unwinds through the dealer book, one re-hedge at a time, and it looks like a market quietly deciding to go up for no reason. Now you know the reason.

For the clock-driven sibling see [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader), for the foundation see [Why Market Makers Are Forced to Trade Stock](/education/why-market-makers-trade-stock), and to watch the vanna ladder move with today's book, open the live [Forced Flow](/forced-flow) page.

Educational content only — none of the above is a trade recommendation.
