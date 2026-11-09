# Using the Fuseline Radar

*Your trade's route through modeled gamma: the Fuse, your targets, and how the terrain at each strike along the way is changing.*

Concept and product specification by Plus3 Forecasting. The page is in beta.

---

## What this page shows

Most pages on ZeroGEX describe the whole market. The Fuseline Radar is built around **one trade**: a Fuse (your anchor), a direction, and one or two targets.

Three things share one screen:

- **The chart.** The same Gamma Chart as the dashboard, with its timeframes, levels, volume and tools.
- **Your plan.** The Fuse, the targets and the stretch between the Fuse and the current price, drawn on the chart as their own layer.
- **The ladder.** A column on the right, one row per strike, on the chart's own price scale. Each row shows how much modeled gamma sits at that strike and how it has changed over the last few minutes.

The purpose is to see the next relevant concentration on your route, and how it is changing, without assembling several pages in your head.

Nothing on this page is a trade signal or a recommendation. It organizes modeled data around a plan you bring.

## Setting up your plan

The first row of controls holds the plan.

- **Plan prices in (ES / SPX).** The instrument you type your prices in. ES by default. Switching it converts the prices you have already entered at the current ES/SPX ratio, so the plan keeps pointing at the same place. It does **not** change what the chart shows; that is **Chart in**, below.
- **Direction (Up / Down).** The way the trade is meant to go.
- **Fuse.** Required. The anchor the route is measured from.
- **Target 1.** Required. It must be on the trade's side of the Fuse: above it for an up route, below it for a down route.
- **Target 2.** Optional. It must be beyond Target 1.
- **Clear plan** empties all three prices.

Targets are never reordered for you. If one is on the wrong side, the page says so in a line under the controls and leaves it off the chart until you fix it.

The plan is remembered in this browser, so it is there when you come back.

## Chart in ES or SPX

**Chart in** sets the instrument for the chart, its levels and the ladder. It is the same choice as the symbol picker in the site header: picking ES or SPX in either place moves both. Picking another symbol in the header (SPY, QQQ and so on) leaves the radar on its last ES or SPX choice, because the radar only reads those two.

The gamma behind the ladder and the levels is **SPX-derived**. In ES, the candles, every strike and every level are carried onto the ES price axis at a **cost-of-carry ratio**: the futures fair value implied by SPX, interest rates and dividends. The line under the controls shows that ratio, labeled **theoretical carry, not measured** in amber.

Carry is not the live ES price. ES trades away from fair value, usually by a few points, and by more overnight or around news. So a level on this page can sit a few points from the same level on your own ES chart. Measuring the live ES/SPX gap takes licensed CME futures data, which ZeroGEX does not carry. If a few points matter, plan in SPX: with **Plan prices in** and **Chart in** both on SPX, nothing is converted.

If the ratio is unavailable, the radar shows SPX rather than draw SPX numbers on an ES axis, and says so. Your plan is unchanged either way.

## View: A to B, A to B to C, Wide

These decide which prices the chart keeps on screen when it fits itself:

- **A to B** keeps the Fuse and Target 1 in view.
- **A to B to C** adds Target 2 (it behaves like A to B when there is no Target 2).
- **Wide** reaches a set distance from the Fuse in the trade's direction. 100 points by default; the box beside it changes the distance.

Your own zoom and pan always win. Double-click the chart, or press its reset button, to go back to the fitted view.

## Change over: 1, 4 or 20 minutes

The window the ladder compares against: how each strike stands now versus 1, 4 or 20 minutes ago. Four minutes lines up with a 4-minute Fuse chart; one minute shows the immediate change; twenty shows the broader drift.

This is separate from how often the page refreshes (see **Freshness** below).

## What is drawn on the chart

- **On the chart: Fuse / Levels / Both.**
  - **Fuse** shows only your plan: the Fuse (solid purple line), the targets (dashed purple lines) and the Fuse-to-spot zone (a light purple band).
  - **Levels** shows only the market levels: call wall, put wall, gamma flip, max pain, VWAP and pin strike.
  - **Both** shows your plan and the levels together.
- **Labels** turns the name tags on the lines (FUSE, T1, CALL WALL and so on) on or off. The price tags on the right axis always stay.
- **Height: Standard / Tall.** Tall makes the chart about twice as tall, with the extra room going to the price pane, so levels sit further apart at any zoom.
- **Ladder** shows or hides the ladder column. With it hidden the candles get the width.
- **Bars: Net / Split / Combined** sets how the ladder draws each strike. See **Reading the ladder**, below.

These choices are remembered in this browser.

## The chart's own controls

The chart is the dashboard's Gamma Chart, so its controls work the same way there and here. In brief:

- **Timeframe**: 1M, **4M**, 5M, 15M, 1H, 1D. The radar opens on **4M**, to match the 4-minute chart a Fuse trade is usually planned on (the dashboard's chart has no 4M). 4-minute candles are counted from each instrument's session open, the way charting platforms count them: SPX candles start at 09:30, 09:34, 09:38 and so on; ES candles are counted from the 6:00 pm ET futures open, so they fall on the clock at 09:28, 09:32 and so on. So at any moment, an ES candle and an SPX candle cover minutes two apart.
- **Candles / Line / Area**, as three icons.
- **Layers** opens the chart's switches: Gamma Flip, Call Wall, Put Wall, Regime, VWAP, Max Pain and Pin Strike, each on its own; **Expected Range**, which shades the implied-volatility band; **EMAs**, up to three exponential moving averages of the close, 13, 40 and 200 to start (the 4-minute view holds about 144 bars, too few for a 200, which draws on the other intraday timeframes); **Volume**, where **Up/Down** stacks buying and selling volume per bar and **Cumulative** shows the running net; and **Bar Timer**, which counts down the forming candle. **Quick looks** at the top set them all at once.
- **Expiry** picks which expirations the chart's levels are built from. It does not change the ladder yet, which always shows all expirations.
- **Save** downloads a picture of the chart. **Full screen** gives the chart the whole window, ladder included.
- **Time** and **Price** zoom buttons, drag to pan, drag the price axis to stretch it, double-click to reset.
- **Rewind** replays the session on the chart. The ladder stays live while you rewind; it dims and says so, until replay of the ladder arrives.

The gamma rail, ribbons, GEX King and centroids are left off this page, because the ladder does their job here. For more on each overlay, see [Using the Gamma Terminal](/help/platform/gamma-terminal).

## Reading the ladder

Each row is one strike, drawn at that strike's height on the chart. **Blue is positive gamma, amber is negative.** Neither color means bullish or bearish. Bar lengths are measured against the largest strike on the whole board today, not just the strikes in view, so zooming or moving a target never changes how big a strike looks.

**Bars** chooses one of three views of the same strikes:

- **Net** (the default): one bar, the strike's modeled net gamma now.
- **Split**: two bars. The **call** side to the right in blue and the **put** side to the left in amber. A strike whose net barely moved can still have both sides growing, and Split shows that.
- **Combined**: the call and put bars faded, with the **net** as a narrower solid bar on top, so you see what the net is made of.

In Split and Combined the bars share one scale, set by the largest single side (call or put) on the board, so a strike's call, put and net can be compared directly.

- **The outline** is the same bar at the start of the change window. A bar that reaches past its outline is **strengthening**; one inside its outline is **weakening**. In Split each side has its own outline; in Net and Combined the outline is the net. Strengthening and weakening are about size, whatever the sign: a negative strike going from -760M to -420M is weakening.
- **▲ and ▼ with a figure** mark a change in the size of the **net** beyond the noise threshold, with the size of the change. They are the net change in every view, so switching views never changes which strikes are flagged (the column header says **net** in Split and Combined as a reminder). When strikes sit close together, figures are placed biggest change first and any that would overprint are left off; the outline still shows the change.
- **Faded rows** are behind the Fuse, past your last target, or hold less than 3% of today's total gamma.
- **The purple dot** marks the next relevant strike: the first strike ahead of the current price, on your route, holding at least 8% of today's total.
- **Hover** a row for its numbers, including its call and put sides and how much each changed in size over the window. **Click** it to open its history underneath the chart.

## The strike history

Clicking a strike opens one panel below the chart (one at a time; click again or **Close** to put it away):

- **Modeled net gamma now**, with its sign.
- **Change over 1, 4 and 20 minutes**: the change in size, a percentage where the starting value is large enough to divide by, and whether it cleared the threshold.
- **Size today**: its rank among all tracked strikes and its share of today's total.
- **Expiry mix**: how much of it is 0DTE versus later expirations.
- **On your route**: where it sits relative to your plan, and how far it is from the current price.
- **A session chart** of its modeled net gamma, with the start of the change window marked.

## Freshness, updates and pause

The bar above the chart says how current the ladder is.

- **Price is always live.** Only the ladder's gamma follows the update setting.
- **Manual / Every 1 min / Every 5 min** sets how often the ladder reads new data. **Refresh now** reads immediately. If nothing new has been published since the last reading, it says so rather than showing the same numbers as new.
- **Pause** freezes the ladder so you can study it. The chart's price keeps moving, and the bar says the gamma is paused.
- In a hidden browser tab the ladder stops reading new data until you come back to it.
- During the session, if the newest reading is five minutes old or more, the bar says how old it is.

## Messages under the controls

- **Anchor crossed: route under review.** The price has crossed the Fuse against your direction. The route is not reversed for you; deciding what that means is yours.
- **Target 1 passed.** The price is beyond Target 1. Its line stays on the chart, and the remaining route runs to Target 2 if you set one.
- **Target problems**, such as a target on the wrong side, as described above.

## What the ladder measures, and what it does not

The gamma is **modeled from open interest, which is published once a day**. During the session, a strike's gamma changes because the same positions are repriced as price, time and volatility move, and mostly because the price moves nearer to or farther from that strike. So:

- **Strengthening or weakening is not positions opening or closing.** It is the existing book repricing.
- **A large concentration is not a guaranteed pin or reaction.**
- The **noise threshold** and the **next relevant strike** rule are provisional: 3% of today's largest strike, scaled with the window, and the 8% share. They will be replaced by adjustable settings.

## Coming next

Planned additions, in order:

- A single classification for the Fuse-to-spot zone, with adjustable settings for how strict it is.
- Replay of past sessions with the same settings, so those settings can be tested against what happened.
- How big a strike is compared with the same time of day on past sessions.
- Vanna and charm context, and a separate layer showing where today's trading is concentrating.
