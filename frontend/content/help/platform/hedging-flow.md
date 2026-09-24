# Hedging Flow

*Estimated dealer hedging pressure created by today's option trades, against price.*

---

## What this page shows

Every other positioning surface on ZeroGEX reads the **book**. Net GEX, the gamma flip, the walls, Forced Flow - all of them take the open interest that exists right now and ask what it *would* make dealers do.

That is a question about a standing position. It is not a question about today.

Hedging Flow asks the other one: for the options that actually **traded** this session, how much stock does staying delta-flat imply someone had to buy or sell? It is the estimated counterpart to the modeled surfaces - what the tape did to the book, on the same timeline as price.

Positive means the delta-flat hedge **buys** stock. Negative means it sells.

## How the estimate is built

For every option print in the session, the net customer position change is converted into the stock a delta-flat hedge implies:

`(buy − sell) × delta × 100 × spot`

Accumulated across the session, in 5-minute bars. Every figure on the page is USD of *stock*, positive for buying - the same sign convention and units the Forced Flow engine uses, so the modeled and estimated sources can sit on one axis without conversion.

> **This is an estimate, and it rests on an assumption that is under test rather than established.** Classifying a print as customer-initiated says which side crossed the spread; it does not prove who was on the passive side. This series assumes the passive side of each classified print was a market maker. Public option data cannot confirm that, so nothing here is observed dealer flow - it is what dealer hedging would look like *if* that assumption holds. The page carries the same caveat under its chart, authored server-side.

## The sign will not always be what you expect

The call-driven and put-driven splits divide the pressure by **which book produced it**, not by direction.

This trips people up, so it is worth stating plainly: **put activity is not automatically bearish here.** When customers *sell* puts, the delta-flat hedge has to **buy** stock. That pressure is positive, and it lands in the put-driven column. The same works in reverse - customers selling calls push the call-driven figure negative.

A session can show large put-driven *buying* pressure. That is not a contradiction; it is a crowd selling downside.

## The two views

One quantity, two views, because a single line cannot answer both questions.

### Pressure rate

How much pressure is being created **right now**, bar by bar, with a trailing average over it.

This is the view where "accelerating" and "reversing" are visible at all. The trailing average is null until its window fills, so the line starts a few bars into the session rather than being back-filled with a guess.

### Session cumulative

Where the session has leaned **in total** - the call-side and put-side contributions stacked, with the net on top, so you can see which book has been doing the pushing.

Because it is an integral, it moves slowly and turns late. It is the right view for "where has today ended up" and the wrong one for "what just changed."

Bars that have not happened yet are left empty rather than drawn at zero. A zero would put a flat line through the afternoon that reads as measured *no pressure*, which is a different claim from *no data*.

## Flips

A flip is the estimated pressure changing sign.

The markers on the chart, and the **Last flip** card, read the **rate** series - the immediate push turning over. Those are frequent and are the actionable ones. The session total also crosses zero occasionally, but rarely and late; that crossing is context about the day's lean, not a trigger, and it is deliberately kept out of the badge so the badge means one thing on every day.

Two details about how a flip is scored:

- Its magnitude is the **swing across zero**, not the level at it. A series is near zero at the moment it crosses zero, by definition, so the level would be meaningless.
- That swing is then scored against the session's own typical swing. A flip that clears the bar is marked significant; the rest are marked light, and **Significant flips only** hides them.

Flip markers are drawn on the rate view only. On the cumulative curve they would sit at points where the line is visibly doing nothing.

## The structure panel underneath

The panel below the flow chart is the other half of the same instrument.

**Flow says how hard the tape is pushing. Structure says whether the book absorbs that push or amplifies it.** They share a session window, a 5-minute grid, one view toggle, and a synchronized crosshair - hover either chart and the same bar highlights on both. That is what makes them one instrument rather than two stacked pictures.

Two lines, because collapsing them would lose the distinction that matters:

- **Stability** - is near-spot gamma building or thinning? Positive means dealers hedge *against* moves: pinning, volatility suppression. Negative means the book has turned accelerant.
- **Lean** - which side is it building on? Positive is supportive (building below spot, or eroding above). Negative is capping.

A book can firm up symmetrically (stability up, lean flat), or roll its gamma from below spot to above without changing near-spot totals at all (lean down, stability flat). One line cannot say both.

The pair is labelled as a four-way read:

| | **Lean positive** | **Lean negative** |
|---|---|---|
| **Stability positive** | **Firming** - structure stabilizing and supportive, dips absorbed | **Capping** - stabilizing but building above, rallies sold into |
| **Stability negative** | **Fragile bid** - supportive lean but thinning gamma, a bid that can gap | **Deteriorating** - thinning and leaning heavy, moves more likely to accelerate |

The view toggle drives this panel too, and the two lenses are matched on purpose: **Pressure rate** reads structure against a rolling lookback ("how is it changing right now"), **Session cumulative** reads it against the session's first bar ("how has it changed today"). Two independent toggles would let you compare a 30-minute flow rate against a since-the-open structure change and believe they lined up.

The two structure lenses do **not** sum. Both are proximity-weighted around each bar's own spot, so the kernel re-centres every bar; treating the anchored reading as a running total of the rolling one would produce a number matching neither.

This series is written once per Analytics Engine cycle rather than accumulated per trade. On a live session an empty panel means *not written yet*, and the page says exactly that instead of showing an error.

## The header cards

**Session pressure** is the session total - all the stock the delta-flat hedge implies against every option traded so far today.

**Call-driven** and **Put-driven** are that total split by the book that produced it, per the sign discussion above.

**Last flip** is the most recent rate flip and the time it happened, or *None today*.

All four read the most recent bar carrying real flow. When the latest bar is carried forward rather than measured, the cards skip back to the last real one rather than reporting a repeat as new.

## The 0DTE toggle

**0DTE only** is the expirations filter carrying today's date - which is also why it can honestly report that there is no 0DTE book to show. On a day that is not an expiry for the symbol, the filter resolves to nothing and the page says so, rather than silently substituting Friday.

The structure panel below is deliberately **not** filtered by the toggle. Dealer gamma structure is a property of the whole book, and scoping it to 0DTE would answer a different question from the one the flow panel above it appears to be asking.

## What this page does not claim

**Not observed dealer flow.** See the callout above. This is an estimate resting on the passive-side assumption, and no surface on ZeroGEX may present it otherwise.

**Not a position.** This measures pressure *created* during today's session. It says nothing about the standing book those trades landed on - that is what Dealer Positioning and the GEX surfaces are for. A session with small hedging flow can still sit on an enormous gamma position.

**Not a forecast.** The pressure shown has already been created. Forced Flow is the page that projects what the current book *would* force under a move in spot, time or implied volatility.

**Not causation.** Price and estimated pressure are drawn on one timeline because that is the useful way to look at them, not because one is claimed to drive the other. Hedging is one source of order flow among many, and on a day with a macro catalyst or an index rebalance it is not the largest.

## Hedging Flow vs Forced Flow

They are the same question asked of two different things, and reading one as the other is the most common mistake on this page.

| | **Hedging Flow** | **Forced Flow** |
|---|---|---|
| Reads | Today's trades | The standing book |
| Answers | What pressure *was* created | What pressure *would* be created |
| Direction in time | Backward through the session | Forward, under a scenario |
| Basis | Aggressor-classified prints | Open interest |

Same units and same sign convention, deliberately, so they can be compared. Large forced flow into the close with the tape already pushing the same way is a different setup from the same forced flow with the tape leaning against it.

## Practical uses

- **Reading a move that has no news.** A grind with steady one-sided pressure underneath it looks different from the same grind with pressure flat - one has a mechanical contribution, the other does not.
- **Timing against a reversal.** The rate view turns before the cumulative curve does. A significant flip is the earliest thing on this page.
- **Checking whether a push has support.** Strong pressure into a *deteriorating* structure reading is a move the book will amplify; the same pressure into *firming* structure is one it will absorb.
- **Separating the two books.** When the net is quiet, the split often is not. Call-driven and put-driven pressure cancelling each other out is a different session from neither one doing anything.
- **Isolating expiry day.** The 0DTE toggle answers whether today's pressure is coming from the contracts that expire tonight or from the rest of the board.

## See also

- [Flow Analysis](/help/platform/flow-analysis) - the tape itself: premium, net volume, and the aggressor split this estimate is built on
- [Dealer Positioning](/help/platform/dealer-positioning) - the standing book these trades land on
- [Why Dealers Are Forced to Trade](/education/why-market-makers-trade-stock) - why hedging flow is estimable at all
- [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow) - why raw contract counts mislead
