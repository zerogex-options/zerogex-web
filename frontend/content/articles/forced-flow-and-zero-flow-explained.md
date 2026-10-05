# Forced Flow and Zero Flow Explained: Where Dealer Hedging Nets to Zero

*Gamma exposure tells you how dealer hedging is shaped. Forced Flow puts a dollar figure and a deadline on it: how much stock the current option book would oblige hedgers to buy or sell if price, time or implied volatility moves. The zero-flow level turns that figure into a price: the one spot where all of it cancels out.*

---

## A question most gamma tools skip

Net GEX and the gamma flip describe the shape of dealer hedging. They tell you whether hedging should lean against a move or with it, and roughly how hard per point. What they do not tell you is how much stock is involved, in which direction, and by when, even if the market does nothing at all.

That last part matters more than it sounds. An option book changes its delta when price moves, but also when the clock runs and when implied volatility shifts. A hedger who wants to stay delta-flat has to trade stock in all three cases. On an index with a large same-day expiry, the clock alone can rival the other two by the afternoon.

Forced Flow asks that question directly, and the zero-flow level answers the follow-up: at what price would the book owe nothing at all by the close?

Here is where it sits next to the other two ways ZeroGEX looks at dealer hedging:

| | **GEX and the gamma flip** | **Hedging Flow** | **Forced Flow** |
|---|---|---|---|
| Reads | The standing book | Today's trades | The standing book |
| Answers | How hedging responds per point of price | What hedge today's trades implied | How much stock a scenario would force, and where it nets to zero |
| Direction in time | A snapshot | Backward through the session | Forward, to the 4:00 PM ET close |
| Units | Dollar gamma | Dollars of stock | Dollars of stock |

Hedging Flow and Forced Flow share units and a sign convention on purpose, so the two can be read side by side.

---

## What forced flow is

Start with the modeled dealer position: the open interest on every tracked expiration and strike, with dealers assumed to hold the other side of the customer, net long the calls and net short the puts. That is the same convention behind ZeroGEX's net GEX and gamma flip. It is an assumption, not an observation: public option data does not show who holds what, and the [methodology page](/methodology) explains where the convention can be wrong.

From that position, Forced Flow computes the book's total delta twice: once now, and once under a scenario (a different price, later in the day, a different implied volatility, or any mix). The difference is how far the hedge has drifted. The stock needed to put it back is the forced flow:

`forced flow = −(dealer delta under the scenario − dealer delta now) × scenario price`

**Positive means the delta-flat hedge buys stock. Negative means it sells.**

Two details make this more than a back-of-the-envelope number:

- **It is a full reprice.** Every contract is priced again under the scenario, rather than estimated by adding up gamma, charm and vanna. Adding the greeks is a fine first approximation and a poor final answer, because the three interact; [Delta and Its Three Children](/education/delta-and-its-three-children) covers why.
- **The greeks are still reported, for attribution.** The page splits each figure into a gamma part (price), a charm part (time) and a vanna part (volatility), so you can see what is driving it. When a scenario is extreme enough that the simple split stops adding up, the full reprice is the number to trust.

Open interest is published once a day. Intraday, forced flow does not change because new positions were opened. It changes because the existing book is repriced as price, time and volatility move.

---

## The three levers

Forced Flow moves one lever at a time, and the page draws each one:

- **Price.** The *reprice curve* shows the forced flow at every price within about 2% of spot, if the underlying finishes the session there. The time to the close is included, so the curve shows the price lever on top of whatever the clock already owes.
- **Time, holding price.** *Charm Into the Close* walks the clock from now to the 4:00 PM bell with price fixed, and plots how much stock time decay alone forces dealers to trade along the way. The curve steepens into the final hour as same-day options resolve. [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader) explains the mechanics.
- **Volatility, holding price and time.** The *Vanna Ladder* shifts implied volatility up and down, in half-point steps out to three points either way, and shows the stock each shift would force right now. [Vanna: How Falling IV Can Change Dealer Hedging](/education/vanna-when-fear-fades) covers why.

---

## What the zero-flow level is

The reprice curve shows forced flow at each price, assuming that price is where the underlying sits at the close. Somewhere along it, the curve crosses zero. That price is the **zero-flow level**: the spot at which the book, carried to the close, owes nothing. Dealers would not have to buy or sell anything there to stay hedged.

If the clock did not exist, that price would be spot itself: no move, no rehedge. The reason it sits somewhere else is time. With price held still, time decay already owes some amount of stock by the close. The zero-flow level is the price move whose own hedge exactly cancels it.

### A worked example

These are round, illustrative numbers, not a live reading.

SPY is at $660.00 with two hours to the bell. The reprice curve shows **Flow at spot: buy $300M**. That is what the clock alone owes if SPY finishes right here.

Near spot, the book is long gamma: for every $1 SPY rises, the hedge has to sell about $120M of SPY, and for every $1 it falls, buy about $120M.

So if SPY rises $2.50 by the close, price-driven selling of about $300M cancels the time-driven buying of about $300M. The zero-flow level is roughly **$662.50**.

The rule of thumb behind that:

`distance to zero flow ≈ −(flow at spot) ÷ (forced flow per $1 of price)`

It is a first-order approximation. The page solves for the crossing exactly, by repricing the whole book at every price on its grid, which matters when the move is large or the book is heavy in same-day options.

---

## Magnet or pivot: the slope decides

A zero-flow level is a single price, but what happens on either side of it depends on which way the curve slopes through it.

Take the example above. Below $662.50, time-driven buying outweighs price-driven selling, so the book owes net buying. Above it, the reverse: net selling. Hedging leans toward the level from both sides. That is a **magnet**, a stable zero-flow level.

Now flip the book to short gamma near spot: for every $1 SPY rises, the hedge has to *buy* $120M, and suppose the clock owes $300M of selling instead. The same arithmetic puts the zero-flow level at the same $662.50. But now, below it the book owes net selling, and above it net buying. Hedging leans *away* from the level on both sides. That is a **pivot**, an unstable zero-flow level: a tripwire rather than a pin.

| Near the level, dealers are | Below the level | Above the level | Hedging leans | On the page |
|---|---|---|---|---|
| Long gamma | Net buying | Net selling | Toward the level | Magnet: solid blue line on the Field |
| Short gamma | Net selling | Net buying | Away from the level | Pivot: dashed amber line on the Field |

The same price can be either one. Reading a pivot as a magnet gets the lean exactly backward, which is why the full-session Field draws the two separately. On the reprice curve, you can tell by eye: a curve that falls through zero from buying on the left to selling on the right is a magnet; one that rises through zero is a pivot.

As a rule of thumb, below the gamma flip the zero-flow level nearest spot is usually a pivot, and above it usually a magnet. The slope at the level itself is what decides.

"Leans toward" and "leans away" describe the modeled hedging, not a promise about price. Whether price actually responds is an empirical question, and the page measures it rather than assuming it (more on that below).

---

## Zero flow is not the gamma flip

The page plots four levels on its rail, and they answer four different questions:

- **Gamma flip:** the price where modeled net dealer gamma changes sign. It marks the boundary between the regime where hedging dampens moves (above) and the one where it amplifies them (below). See [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).
- **Zero-flow level:** the price where total forced flow, carried to the close, nets to zero. It folds time into the picture, which the gamma flip does not.
- **Charm flip:** the price at which time decay into the close changes sign. On one side of it, the clock forces buying; on the other, selling.
- **Vanna flip:** the price at which the hedge forced by a one-point rise in implied volatility changes sign.

The gamma flip says what kind of hedging to expect. The zero-flow level says where, given the clock, that hedging nets out. They can sit close together or far apart, and one does not stand in for the other.

---

## How zero flow moves through the day

The horizon is always "from now to today's 4:00 PM ET close," so the zero-flow level is a moving target by design:

- **The clock shrinks the horizon.** In the morning, the level folds in a full session of decay. Late in the day it folds in only what is left. At 4:00 PM the horizon is zero, there is nothing left for the clock to owe, and the level collapses onto spot. After the bell it carries no information until the next session.
- **Repricing reshapes the curve.** As price, implied volatility and time move, every contract's delta changes, and so does the slope of the curve and where it crosses zero. Open interest stays fixed until the next day's publication.
- **The Field keeps the history.** The full-session Field on the page rebuilds the book as it actually stood at each point in the session, so you can see where the magnet and pivot sat at 10:00, at noon and now, against the price that actually printed. To the right of "now," it carries the current book forward to the close as a projection.

---

## What these numbers are not

**Not observed flow.** Forced flow is a model of what a delta-flat hedge would require, built on an assumption about who holds the open interest. ZeroGEX does not see dealer inventory, and real desks net positions across books, hedge with other instruments, and rebalance in bands rather than continuously. A figure of +$300M means the model's hedge would buy about $300M. It does not mean anyone will.

**Not a price target.** The zero-flow level is where the modeled hedge nets to zero. It is not where price has to go, and a magnet does not make price arrive. Hedging is one source of order flow among many, and on a day with a macro catalyst or an index rebalance it is rarely the largest.

**Not a measured edge, yet.** ZeroGEX has not published a multi-session study of how often price closes near the zero-flow level. What the page does measure is narrower, and it is shown honestly:

- the full-session Field counts, within today's session, how often price moved toward the magnet (or away from the pivot) from one step to the next. That describes today. It is not a forecast for tomorrow;
- the **Track Record** at the bottom of the page scores the charm forecast across sessions. It does not score the raw buy-or-sell sign, which for an index book reads "buy" almost every day and so would just re-print the base rate. It scores whether a morning charm reading stronger or weaker than its own recent normal leans the same way as the noon-to-close move. It shows the hit rate against a naive baseline, with a 95% confidence band, and it only certifies an edge after at least 30 scored sessions. Read its verdict before leaning on the forecast. Until it says **Significant at 95%**, treat it as unproven.

---

## Reading the Forced Flow page in order

The page is laid out as a verdict followed by its evidence:

1. **The Read** puts the regime, the into-close flow and the zero-flow level in one sentence, with three tiles underneath.
2. **The Forced-Flow Rail** plots the gamma flip, charm flip, vanna flip and zero-flow level against spot.
3. **The reprice curve** shows the price lever and where the curve crosses zero.
4. **Charm Into the Close** and the **Vanna Ladder** show the time and volatility levers.
5. **The Forced-Flow Field** shows the whole session: actual on the left of "now," projected on the right, with the magnet and pivot drawn through it and the realized price on top.
6. **The Track Record** scores the charm forecast.

The [Forced Flow help page](/help/platform/forced-flow) is the panel-by-panel reference, including a few numbers that look alike but are computed differently.

---

## How to use it

Forced Flow works best as context around a level or an idea you already have, not as the idea itself. A few combinations read cleanly:

- **Everything lines up.** Long gamma near spot, a magnet a few points above, and the clock owing buying into the close. The modeled hedging leans the same way on every lever. That is a coherent picture, and it still depends on nothing larger hitting the tape.
- **A pivot near spot.** The level is a tripwire, not a target. What matters is which side of it price is on, because the modeled push changes direction when price crosses it.
- **The levers disagree.** The clock owes buying, but price sits just below a pivot where the price lever forces selling. The model is not giving a single direction, and the honest read is that hedging pressure is mixed.
- **Late in an expiry day.** On a heavy 0DTE book, much of the into-close figure can land in the final hour, and The Read says how much. That is when the clock's share of the hedging is largest, and also when other closing flows are largest.

Pair it with [Hedging Flow](/education/hedging-flow-explained). Forced Flow says what the book would force under a scenario. Hedging Flow estimates what today's trades actually created. Large forced buying into the close with the tape already pushing the same way is a different setup from the same figure with the tape leaning against it.

For the foundations, see [Why Market Makers Trade Stock](/education/why-market-makers-trade-stock), [Delta and Its Three Children](/education/delta-and-its-three-children) and [Why We Don't Publish DEX](/education/why-we-dont-publish-dex). To see today's numbers, open the live [Forced Flow](/forced-flow) page.

Educational content only - none of the above is a trade recommendation.
