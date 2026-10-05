# Forced Flow

*The stock dealers would have to trade to stay hedged if price, time or implied volatility moves, modeled from open interest, and the zero-flow level where that hedging nets to nothing.*

---

## What this page shows

Every other flow surface on ZeroGEX measures something that already traded. Forced Flow looks forward instead. It takes the option book as it stands right now and asks: if price moves, if the clock runs to the close, or if implied volatility shifts, how much stock would a delta-flat hedge have to buy or sell?

It then finds the **zero-flow level**: the price at which, carried to today's close, the book would owe no hedging at all.

Forced Flow is a Basic page and is marked **Beta**. For the concepts behind it, with a worked example, read [Forced Flow and Zero Flow Explained](/education/forced-flow-and-zero-flow-explained). This page is the panel-by-panel reference.

## Units, sign and the assumption underneath

Every dollar figure on the page is USD of the *underlying stock*. **Positive means the hedge buys. Negative means it sells.** That is the same convention Hedging Flow uses, so the two pages can be read side by side.

The figures come from a full reprice. The model computes the book's total delta now and again under the scenario, and the forced flow is the change, turned into dollars of stock at the scenario price. Gamma, charm and vanna are used only to split the total into what price, time and volatility each contributed.

> **This is a model, not observed flow.** Dealers are assumed to hold the other side of the open interest, net long the calls and net short the puts: the same convention behind net GEX and the gamma flip. Public option data does not show who holds what, and real desks net positions, hedge with other instruments and rebalance in bands. Read every figure here as what the model's hedge *would* require, not as an order anyone will place.

Open interest is published once a day, so nothing on this page moves because new positions were opened intraday. It moves because the existing book is repriced as price, time and volatility change.

## Picking a symbol

The chips at the top of the page switch between SPY, SPX, QQQ, NDX, ES and NQ. They drive the same symbol as the picker in the site header, so the rest of the app follows.

ZeroGEX tracks index options rather than options on futures. For ES and NQ, the page reads the SPX or NDX book and carries its price levels onto the futures price, so the levels line up with the futures chart. The dollar figures are the index book's.

## The Read

The card at the top is the verdict. Everything below it is the evidence.

The header shows the symbol, its current price and the time left to the 4:00 PM ET close. The sentence underneath says three things, when each is available:

- **The regime.** Whether dealers are modeled long or short gamma, from where price sits against the gamma flip. Below the flip, hedging amplifies moves. Above it, hedging dampens them.
- **The into-close flow.** The stock that time decay alone forces dealers to trade by the 4:00 PM bell if price stays where it is.
- **The zero-flow level** and its distance from price.

Under the sentence are two chips:

- **Lean** reads *with the move* when dealers are short gamma and *fade the extremes* when they are long gamma. It restates the regime. It is not a trade instruction.
- **The forecast chip** summarizes the Track Record at the bottom of the page. It reads *collecting* until 30 sessions have been scored, *not yet a proven edge* after that, and *beats the baseline* only when the Track Record's significance test passes.

The three tiles:

- **Regime** shows Short γ or Long γ, and how far price sits above (+) or below (−) the gamma flip.
- **Into-close flow** shows Buy or Sell and the dollar figure, plus how much of it lands in the final hour. The small chart traces it from now to the close, with the final hour shaded. When the market is closed, the tile reads *No time pressure into a bell right now*.
- **Magnet · zero-flow** shows the zero-flow level, whether it sits above or below price, and the distance.

> **About the Magnet tile.** It shows the zero-flow level nearest price, whichever kind it is. A zero-flow level is a *magnet* when the hedging on both sides leans toward it, and a *pivot* when it leans away. When the Regime tile reads **Short γ**, the level near price is usually a pivot, which pushes price away rather than pulling it in. The Forced-Flow Field below draws the two kinds separately. When they disagree, go by the Field.

The time under the tiles is the snapshot the Read was priced from. If the card says there is no actionable read, the market is closed or the book is too thin to price.

## Forced-Flow Rail

The rail plots four levels against the current price, highest at the top:

- **Gamma flip:** where modeled net dealer gamma changes sign. This is the same gamma flip the rest of ZeroGEX shows.
- **Charm flip:** the price at which time decay into the close changes sign. On one side of it the clock forces buying; on the other, selling.
- **Vanna flip:** the price at which the hedge forced by a one-point rise in implied volatility changes sign.
- **Zero-flow:** the zero-flow level, the same one the Read shows.

Each carries its price and its distance from spot. When levels sit close together, the labels are nudged apart so they stay readable. The printed price is always exact, even where a dot has moved off its true position.

## Reprice curve

**Forced Dealer Flow · Reprice Curve** shows the price lever. For each price within about 2% of spot, it shows the forced flow if the underlying finishes the session at that price. The time to the close is included, so the curve shows what a price move would add to whatever the clock already owes.

- The **line** is the exact total from the full reprice.
- The **stacked bands** split it into gamma (price), charm (time) and vanna (volatility). This view holds implied volatility fixed, so the vanna band stays at zero here. The Vanna Ladder is where volatility moves.
- **Flow at spot** is the curve's value at the current price: what the clock alone owes by the close if price does not move.
- **Zero-flow level** is where the line crosses zero, marked on the chart beside the spot marker. It reads *none in range* when the line does not cross zero within the plotted range.

You can tell a magnet from a pivot by the slope. A line that falls through zero, buying on the left and selling on the right, crosses at a magnet. A line that rises through zero crosses at a pivot.

## Charm Into the Close

This chart shows the time lever. Price and implied volatility are held fixed while the clock runs from now to the 4:00 PM bell. The curve is cumulative: it starts at zero now and ends at the full into-close figure, which is the number in its headline and in the Read.

It usually steepens late in the day because same-day options resolve at the bell. This chart lets them settle all the way, which is what makes the final hour so heavy on an expiry day.

## Vanna Ladder

**Vanna Ladder · Flow vs Vol** shows the volatility lever. Price and time are held fixed while implied volatility shifts up and down, in half-point steps out to three points either way. The flow is zero at no change.

The headline reads the bar for a one-point drop. It calls that move "VIX −1" as shorthand. The model actually shifts every option's own implied volatility by one point at the same time, and VIX and the IV of a given option do not always move one-for-one.

## Forced-Flow Field · Full Session

The Field shows the whole trading day at once. Price runs up the vertical axis, and time runs left to right from the open to the 4:00 PM close.

- **Color** is the total forced flow to the close from that moment, if price went to that level: green means dealers would be forced to buy, red to sell.
- **Left of the "now" line** is the actual field. Each column is rebuilt from the book as it actually stood at that point in the session.
- **Right of it**, shaded and labeled *projection*, is the current book carried forward to the close.
- The **solid blue line** is the magnet: the stable zero-flow level for each column.
- The **dashed amber line** is the pivot: the unstable zero-flow level for each column.
- The **hollow candles** are the realized 5-minute price, green for up bars and red for down. The **dashed gray line** is the current price.

The chart opens zoomed in around price, where the magnet and pivot are easiest to read. Zoom out to see the wings, where same-day options dominate and the colors get extreme. Scroll or pinch to zoom, drag to pan, drag an axis to stretch just that axis, and double-click or press **Reset view** to go back.

### The read above the Field

The strip above the chart turns the Field into a sentence and a row of chips. Its headline is one of:

- **Upward pin**, **Downward pin** or **Flat pin**: the nearest zero-flow level is a magnet, and the heading is toward it (toward the projected close magnet when there is one).
- **Amplifying · short γ**: the nearest level is a pivot. The heading is away from it, on whichever side price already sits.
- **No level near spot**: neither kind of level is close to price.
- **Forming**: too little of the session has printed to read.

The heading reads **Flat** when the level sits within 0.04% of price.

The chips:

- **Regime:** *Pin · long γ* or *Pivot · short γ*, depending on which kind of level is nearer to price.
- **Heading:** up, down or flat, as described above.
- **Magnet** or **Pivot:** the level the read is built on, with its distance from price.
- **Pin respect** or **Ran off pivot:** a within-session tally. Between each pair of past columns, did price move toward the magnet (or away from the pivot)? The sentence only leans on it once at least five moves have been scored. It describes today. It is not a forecast.
- **Into close:** the projected magnet at the bell, shown in a pin regime only.

The Read at the top of the page takes its regime from the gamma flip. The Field takes its regime from which kind of zero-flow level sits nearest price. They are computed differently, so they can disagree, most often when price is close to the gamma flip.

## Charm-into-Close · Track Record

The last panel scores the charm forecast across sessions. It is built to be unflattering.

**What it scores.** For an index, the raw sign of the into-close flow reads "buy" on most sessions. Scoring that sign would only reproduce how often the market happens to rise. So instead, each session's morning reading (the first one between 9:35 and 10:30 AM ET) is compared with its own recent normal, the median of up to the prior 20 sessions. Stronger than normal is a **Buy** call, weaker is a **Sell** call. The call is then checked against the move from noon to the close. The first ten sessions of history are held out while that baseline builds.

**Two definitions, side by side.** **Full close flow** is the figure the headline shows, including same-day options settling at the bell. **Charm-only** is the smooth time-decay drift without that settlement. Both are scored over the same sessions.

Each panel shows:

- **Hit rate**, with its 95% confidence band;
- **Baseline:** the hit rate you would get by always guessing the more common direction. A hit rate at or below it is worth nothing;
- **Edge:** hit rate minus baseline, in percentage points;
- **Signal/day:** the average noon-to-close return of following the call, before costs. It can be negative;
- a verdict of **Sample too small** (under 30 scored sessions), **Not yet significant**, or **Significant at 95%**. The p-value and t-statistic appear once 30 sessions are in.

The ledger lists the latest scored sessions for the full definition: the date, the call, the noon-to-close move, and whether it was a hit. **Buy** and **Sell** there mean above or below recent normal. They do not mean the clock owed buying or selling that day. The panel covers the last 180 days. Sessions with a flat afternoon, or a reading exactly at its baseline, are not scored.

The Track Record scores the charm forecast only. There is no multi-session score yet for the zero-flow level.

## Two numbers that look alike

**Flow at spot vs into-close flow.** The reprice curve's *Flow at spot* and the Read's *Into-close flow* both answer "what does the clock owe if price does not move," but they are computed with one difference. The price views (the reprice curve, the rail levels, the Vanna Ladder and the Field) treat every contract as having at least 30 minutes left to expiry, a standard way of keeping the numbers finite in the final minutes. Charm Into the Close, and the Read's figure built from it, let same-day options settle all the way at the bell. On an expiry day, the into-close figure can be far larger than Flow at spot. The zero-flow level is built on the Flow at spot side.

**The zero-flow level on the curve vs the Read and rail.** The reprice curve looks for its zero crossing within its plotted range of about 2% around price. The Read and the rail look further, about 5%. When the crossing is between 2% and 5% away, the curve reads *none in range* while the Read and rail still show a level.

## Timing and refresh

The panels refresh every 15 seconds. The server reprices the book from the latest option chain about every 30 seconds, so a figure can trail the chain by up to about half a minute. The Track Record gains one session a day.

The horizon is always "from now to today's 4:00 PM ET close." As the day runs, the clock owes less and the zero-flow level folds in less time. At the bell the horizon reaches zero and the level sits on the current price, so after the close the time-based figures carry no information until the next session.

## What this page does not claim

**Not observed dealer flow.** See the callout at the top. Every figure rests on an assumed dealer position.

**Not a price target.** The zero-flow level is where the modeled hedging nets to zero. A magnet describes which way that hedging leans. It does not make price arrive.

**Not a proven edge.** The charm forecast is scored openly in the Track Record, and its verdict is the one to trust. The zero-flow level has no multi-session score yet.

**Not the only flow.** Hedging is one source of order flow among many. On a day with a macro catalyst or an index rebalance, it is rarely the largest.

## Forced Flow vs Hedging Flow

| | **Forced Flow** | **Hedging Flow** |
|---|---|---|
| Reads | The standing book | Today's trades |
| Answers | What pressure a scenario *would* create | What pressure today's trades *did* create |
| Direction in time | Forward, to the close | Backward through the session |
| Basis | Open interest | Aggressor-classified prints |

Same units and the same sign convention, so the two can be compared directly.

## See also

- [Forced Flow and Zero Flow Explained](/education/forced-flow-and-zero-flow-explained) - the concepts, with a worked example of magnets and pivots
- [Hedging Flow](/help/platform/hedging-flow) - the estimated hedge implied by today's trades
- [Dealer Positioning](/help/platform/dealer-positioning) - the standing book this page reprices
- [Charm: The Clock Is a Trader](/education/charm-the-clock-is-a-trader) - why time alone forces hedging
- [Vanna: How Falling IV Can Change Dealer Hedging](/education/vanna-when-fear-fades) - the volatility lever
- [Delta and Its Three Children](/education/delta-and-its-three-children) - why the total comes from a full reprice
