# Flow Analysis

*What traded today and who crossed the spread to trade it: contracts bought and sold on each side, net premium, and the put/call, on one clock.*

---

## What this page shows

The Flow Analysis page is the **tape view** of the options market. Where Dealer Positioning shows you the standing book, this page shows you the **flow**: what traded today, and which side crossed the spread to trade it.

Two controls in the header apply to the whole page: **Session** (the live session or any of the last week's, so you can see whether today is unusual at all) and **Contracts** (every contract, or the strikes and expirations you pick). The chart's own toolbar sets the bar size, **5 min** or **1 min**.

## Bought and sold

Every option print is classed by the side that crossed the spread, using the Lee-Ready convention:

- At or near the **ask**, a buyer paid up: it counts as **bought**.
- At or near the **bid**, a seller hit it: it counts as **sold**.
- Prints at the **midpoint** are shared out between the two in proportion to that contract's ask and bid prints in the same minute. Prints with no side to go on at all, like the 09:30 opening auction, count half each way.

So bought plus sold is always every contract that traded. The aggressor read is the closest the feed gets to intent, but it cannot tell an opening trade from a closing one: a put "sold" at the bid can be a new seller or a buyer taking profits.

Calls bought and puts sold make up the **bullish side**. Puts bought and calls sold make up the **bearish side**. Color follows that everywhere on the page: green is the bullish side, red the bearish side. That is why a put row's "bought" is red.

## The session read

The row across the top reads the session in one line:

- **Flow** - **Risk-on** when net premium and net flow both lean bullish, **Risk-off** when both lean bearish, and **Two-way** when they disagree or are both too small to call (net flow under 1% of the contracts traded and net premium under 5% of the call and put premium).
- **Net premium** - net call premium minus net put premium, each counted as bought minus sold, with the call and put legs underneath. A negative put leg means puts were net sold.
- **Net flow** - the bullish side minus the bearish side, in contracts, and the bullish side's share of everything traded.
- **Put/call** - put volume divided by call volume.
- **Volume** - every contract traded, and how many since the latest bar opened.

## Bought vs. sold

Session totals for calls and puts, each split into **bought** and **sold**, with the split as a bar, the **net** (bought minus sold), and what the latest bar has added so far. The line underneath adds the two sides up: the bullish side against the bearish side, and how far one leads, which is the session's net flow.

The numbers update as the session trades, every few seconds.

## The session chart

One chart, in panes that share the session's clock and a crosshair, times in ET:

- **Price** - the underlying through the session. On a live session its newest point follows the live quote every second.
- **Strikes** - behind the price line, a lane for each strike and a dot for each bar. A dot is the net flow at that strike in that bar: calls bought minus calls sold, plus puts sold minus puts bought. Green above zero, red below; a strike where the two sides cancel exactly gets no dot. Dots come in three sizes, and **Dot sizes** beside the price pane's label sets where each starts. **Auto** measures a dot against the day's own flow, so it suits any symbol without setup, but a dot can shrink later in the day as bigger flow arrives. Your own numbers, in net contracts, keep each minute's dot once it closes, and this browser remembers them for each symbol. **All dots**, **Medium+** and **Large** set the smallest dot shown. Hover over a dot, or tap it, for that strike's calls and puts bought and sold, each with its own net. The lanes follow your contract picks and show on both bar sizes.
- **Flip and walls** - the gamma flip and the call and put walls as dashed lines: the same levels as the Key Levels strip and the gamma charts. They are where the levels stand now, so they show on the current session only. Flow at a wall's strike is context, not a call on the wall: in our study of 737 wall tests, it did not predict which walls broke.
- **Net premium** - the running net premium, shaded green above zero and red below, with the **call and put legs** as thin lines.
- **Contracts** - what traded in each bar. Up bars are the bullish side (calls bought, with puts sold stacked lighter on top); down bars are the bearish side (puts bought, with calls sold).
- **Put/call** - the running ratio, with a dashed line at 1.
- **Numbered markers** along the top match the flow log.

The buttons above the chart turn each pane on or off, and this browser remembers your choice. Hover over the chart, or tap it on a phone, for every number at that bar. **Full screen** gives the chart the whole window, with the panes sized to it; Escape or **Exit** brings it back.

To zoom in on part of the session, the same way as on the Gamma Chart:

- **Ctrl + scroll** (**Cmd + scroll** on a Mac), or pinch on a trackpad, to zoom time. A plain scroll wheel scrolls the page, not the chart.
- **Shift + scroll**, or scroll over the price scale on the left, to zoom the price.
- The **Time** and **Price** − and + buttons at the bottom left do the same in steps.
- **Drag** a zoomed chart sideways to move through time, or up and down once the price is zoomed.

Zoomed in, each pane's scale fits what is on screen, so the strike lanes spread out along with the bars. On a live session a zoomed chart keeps up with the newest bar until you drag it back. **Reset** returns to the whole session. On a phone, pinch or use the **Time** buttons to zoom, and drag sideways to pan.

## Flow log

The session's notable flow, newest first:

- **Net flow turned bullish / bearish** - the running net flow changed sides and the new side leads by at least 0.5% of the contracts traded. Small wobbles around zero are not listed.
- **Net premium turned bullish / bearish** - the same for net premium, by at least 3% of the call and put premium.
- **Put/call rose above 1 / fell below 1** - once it is 0.05 past 1.
- **Volume burst** - a bar at least 2.5 times the median of the previous hour's bars, with which side led it. The six biggest of the session are listed.

Nothing is called in the first ten minutes, when every total is small enough to swing on a single print.

## Bar by bar

Each bar's calls and puts, bought and sold, and its net flow, newest first. Bars in which nothing traded are left out. During the session the top row is the bar still trading.

## Picking contracts

**Contracts** opens the strike and expiration picks. A pick narrows everything on the page, so every number you see describes the same contracts. Expiration picks are shared with the gamma charts in the same browser tab, and the header always says which contracts the page is reading; the **×** beside it goes back to all of them.

ES and NQ have no option chain of their own: their flow is SPX and NDX flow, so the strikes listed are index strikes, not futures prices.

## How to read it

Three patterns:

1. **Strong bullish-side flow and rising net premium while dealers are modeled short gamma** ⇒ traders are paying for upside that dealers are modeled short. A continuation read.
2. **Puts bought hard into a level** with the Positioning Trap signal loaded on the short-crowd side ⇒ the bearish crowd may be offside; watch for a snap back.
3. **Flow flat near a key level** ⇒ wait for the break. Flow without conviction is not a trade.

## When the page is most useful

- **Right after the open** - the first half hour tells you a lot about the day's lean.
- **At any key level** - the flow into a wall or VWAP shows who is pressing it. In our study of 737 wall tests, signed flow at the wall strike did not predict which walls broke, so read it as context, not a verdict.
- **Into the close** - with EOD Pressure, the flow read sharpens the directional cue.

## Net volume vs. directional flow

For the longer read on why raw volume can mislead, why the aggressor split adds signal, and why premium is usually the stronger conviction measure, see [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

## See also

- [Smart Money](/help/platform/smart-money)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow)
