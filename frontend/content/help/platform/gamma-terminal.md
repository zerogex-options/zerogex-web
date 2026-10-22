# Using the Gamma Terminal

*A guide to every panel, control and chart overlay on the Gamma Terminal: what each one shows, how to read it, and what it can't tell you.*

---

## What the Gamma Terminal is for

The [Gamma Terminal](/chart) puts price and modeled dealer gamma on one screen. The candles show what price is doing. The lines, shading and panels around them show where options dealers' hedging is modeled to be heaviest, and whether that hedging is damping moves or adding to them right now.

Every gamma figure on the page is an estimate. Public option data shows how many contracts are open at each strike but not who holds them, so ZeroGEX applies the standard convention that dealers are net long the calls and net short the puts. Read the levels as context for your own decisions, not as a measured order book or a price target. The [Methodology](/methodology) page explains the model.

From top to bottom, the page has:

1. **Key Levels** - the six numbers that matter most, with their distance from price.
2. **About this terminal** - a short description, folded away for members.
3. **Beside the tape** - a switch for the panel next to the chart: **Gamma Ladders** or **Strike Panel**.
4. **The Gamma Chart** - candles with the gamma levels and overlays drawn in, and the panel you picked to its right (below it on narrower screens).
5. **What you're looking at** - six cards summarizing the main features.
6. **Playbook** - what the current regime implies as price approaches a wall.

Basic and Pro members get the terminal live. Everyone else sees a free preview of SPY that runs about 15 minutes behind; see [Free preview vs. live](/help/platform/gamma-terminal#free-preview-vs-live).

## Your first five minutes

1. **Pick an underlying.** Use the symbol buttons on the chart, the dropdown on the first ladder, or the arrows on the Key Levels strip. Each one changes the whole page.
2. **Read the regime.** The **Dealer Gamma @ Spot** box at the top right of the chart reads **LONG Γ** or **SHORT Γ**. In long gamma, dealer hedging is modeled to lean against moves (pinning). In short gamma, it is modeled to add to them (trending). The tinted chart background says the same thing.
3. **Find the key lines.** The azure `FLIP` line is where the regime changes. The red `CALL WALL` above price and the green `PUT WALL` below it are the strikes carrying the most call and put gamma. The Key Levels cards give the exact distance to each.
4. **Look beside the tape.** The ladders list net dealer gamma at every strike near price, lined up with the chart. The biggest values are the strikes with the most hedging attached.
5. **Add what you need.** Turn on **Expected Range** for the move implied volatility is pricing, **Centroids** to see where today's option trading is centered, or **PD/PM Levels** for the prior day's high, low and close.
6. **Rewind** to replay how price and the gamma book moved through the session.

## The Key Levels strip

The strip across the top shows the six levels the chart draws, for the chart's symbol and expiration filter.

- **Spot** - the current price and its change from the previous close.
- **Gamma Flip** - the price where modeled net dealer gamma changes sign.
- **Pin Strike** - the nearby same-day (0DTE) strike where dealer gamma is modeled to pull price in hardest into the close, with a strength label.
- **Call Wall** - the strike at or above price with the largest call gamma.
- **Put Wall** - the strike at or below price with the largest put gamma.
- **Max Pain** - the strike where options holders would collect the least at expiration.

Each card shows the level and its distance from price in dollars and percent, with a green arrow when the level is above price and a red arrow when it's below. Hover a card for its full definition. The header names the expirations the levels come from and carries a **LONG Γ** or **SHORT Γ** chip.

When a card shows a dash instead of a number, the note under it says why:

- **Unresolved this snapshot** - the model returned no level this time, usually because the option chain was thin. Hover the amber **?** for details. It normally comes back on a later update.
- **No flip in selected expiries** - the expirations you picked never change sign. See [The Expiry filter](/help/platform/gamma-terminal#the-expiry-filter).
- **No active pin** - no nearby same-day strike qualifies as a pin right now.

Members get three more things here. On a computer, hover the strip for arrows that step through the symbols; on a phone, swipe it. The whole page follows. The bell on the Call Wall and Put Wall cards sets up an [alert](/help/platform/alerts) for when price reaches that wall. And the Pin Strike card notes how long the current pin has held, as in "Held since 09:41".

## Gamma Ladders and the Strike Panel

The panel beside the chart shows the per-strike dealer gamma book in one of two ways. Pick one with the **Gamma Ladders** / **Strike Panel** switch above the chart. The chart itself stays the same either way, and your choice is remembered.

### Gamma Ladders

Two ladders side by side. Each row is a strike, highest at the top, and its number is the **net dealer gamma** at that strike. By default it's in dollars per 1% move: roughly how much stock dealers would have to trade at that strike to stay hedged if price moved 1%.

- **Orange rows** are long gamma (positive) and **navy rows** are short gamma (negative). The deeper the color, the bigger the number.
- The row with the strike in a highlighted pill is the strike nearest price. On wide screens it sits level with the price on the chart.
- `GF`, `CW`, `PW` and `MP` tags mark the Gamma Flip, Call Wall, Put Wall and Max Pain on the nearest row. The header lists their values, or `NA` when a level isn't available.
- The **crown** marks the heaviest strike visible in that ladder. It isn't the chart's GEX King, which is the heaviest strike in the whole chain.
- The **LONG Γ** / **SHORT Γ** chip in each header compares price with that symbol's flip.

The first ladder is the chart's symbol. The second compares any other symbol, and starts on the matching book: SPY with SPX, QQQ with NDX, ES with SPX, NQ with NDX, and NVDA with QQQ. [SPY vs SPX Gamma Levels](/education/spy-vs-spx-gamma-levels) explains why two books on the same index read differently.

The controls at the top of the panel:

- **Strikes: Active / All** - **Active** (the default) hides strikes with no open interest. **All** shows every listed strike near price.
- **Session Δ: On / Off** - marks each strike with a green ▲ where dealer gamma has built since the 9:30 AM ET open, or a red ▼ where it has eroded. Small changes are left unmarked. Live only.
- **Unit: 1% / 1pt** - shows gamma per 1% move (the default) or per 1-point move. Same exposure, different unit. This setting applies across the site.

An amber "Positioning as of 15:55 ET" note means the latest updates carried no positioning (after the options close, for example), so the ladder shows the most recent one that did. The levels in its header stay live.

### Strike Panel

The same book as a picture: net dealer gamma at every price. On wide screens it's drawn on the chart's own price scale, so each strike sits level with that price on the candles.

There are four views, picked at the top of the panel:

- **Silhouette** (the default) - a smoothed curve. The green lobe to the right is long gamma, the red lobe to the left is short gamma, and dots mark the biggest peak on each side.
- **Net** - one bar per strike: green to the right for long gamma, red to the left for short.
- **Split** - calls and puts apart: a green call bar to the right and a red put bar to the left.
- **Combined** - the Split bars plus a violet net bar.

In Split and Combined, each bar is shaded by expiration: boldest at the center line for the nearest expiration and faintest at the tip for the farthest. **Labels** prints dollar figures on the bars. They hide when strikes are packed too closely, so zoom the price axis in to bring them back. A dashed azure line marks the flip.

Hover a strike, or tap it on a phone, for its card: call, put and net gamma, open interest and the put/call ratio, its weight against the heaviest strike in view, its distance from price, and any level on it. "Long Γ · magnet / brake" and "Short Γ · accelerant" describe what dealer hedging at that strike is modeled to do: lean against moves, or add to them.

The free preview shows the Silhouette view only.

## The chart header

- **Session badge** - **● LIVE** in the regular session, **CLOSED**, a pre-market or after-hours badge outside regular hours, **◀ REWIND** while replaying, and **◷ DELAYED ~15 MIN** on the free preview. **◆ FUTURES** appears on a cash index outside regular hours, when the headline price is the futures contract's; the candles stay on the index.
- **Price and change** - the change is from the previous regular-session close. Outside regular hours the headline holds the 4:00 PM close, and SPY, QQQ and NVDA add a second line with the extended-hours price.
- **Updated** - when the last price tick arrived.
- **Dealer Gamma @ Spot** - **LONG Γ** or **SHORT Γ**, and the net dealer gamma at the current price in dollars, such as +$1.23B. This box is the regime read for the whole page. With an Expiry filter set, it shows the selected expirations' own figure and names them.
- **On ES and NQ** - an **IMPLIED FROM SPX** (or **NDX**) chip and the futures contract code. See [ES and NQ](/help/platform/gamma-terminal#es-and-nq).

## The toolbar

- **Symbol** - SPY, QQQ, SPX, NDX, ES, NQ and NVDA. Changing the symbol resets the zoom, ends Rewind, and sets the Expiry filter back to All unless it's on 0DTE.
- **Timeframe** - **1M**, **5M**, **15M**, **1H** or **1D** bars. The chart opens on 5M each visit.
- **Style** - **Candle**, **Line** or **Area**. A candle is green when it closed at or above the previous close and red when it closed below. It's hollow when it closed at or above its own open.
- **VOL** - the eye shows or hides the volume pane. See [Volume pane](/help/platform/gamma-terminal#volume-pane).
- **Overlay pills** - one per overlay. See [The overlays](/help/platform/gamma-terminal#the-overlays). On a phone, the overlays, style, volume and Expiry controls sit under **Layers**, which counts how many overlays are on.
- **Expiry** - which expirations feed the gamma levels. See [The Expiry filter](/help/platform/gamma-terminal#the-expiry-filter).
- **Reset** - appears once you've zoomed or panned, and returns to the live view.
- **Save** - downloads the chart as a PNG image: the candles, lines, tags and axes, without the toolbar, the legend or the panel beside the chart.

## The overlays

Each overlay has a pill in the toolbar. Click it to turn the overlay on or off; the chart remembers your choices. The legend under the chart is a color key, not a switch.

| Overlay | What it draws | On by default | Where it works |
|---|---|---|---|
| Gamma Levels | The Gamma Flip, Call Wall and Put Wall lines | Yes | Everywhere |
| Regime | Long- and short-gamma background shading | Yes | Everywhere |
| Ribbons | Each strike's gamma through time, behind the candles | Yes | Live |
| VWAP | The session's volume-weighted average price | Yes | Everywhere |
| Max Pain | The max pain strike | Yes | Everywhere |
| Pin Strike | Today's pin strike and its strength | Yes | Live |
| GEX King | The heaviest gamma strike in the whole chain | No | Live |
| PD/PM Levels | The prior day's high, low and close; the pre-market high and low | No | Live: SPY, QQQ, NVDA |
| Expected Range | The ±1σ move implied volatility is pricing | No | Live, except NVDA |
| Centroids | Where today's call and put trading is centered | No | Live, 1M to 1H bars |
| Bar Timer | Time left in the current candle | No | Live |

A few things hold for every level line:

- Each level is a dashed line across the chart, with its name in a chip at the left edge and its price in a tag on the right axis.
- A level outside the price range on screen shows as a tag pinned to the top or bottom of the axis, marked ▲ or ▼. Zoom the price axis out to see the line itself.
- The flip, the walls and VWAP widen the price axis to stay in view when they're reasonably close to price, and so do the PD/PM and Centroid lines while they're on. Max Pain, Pin Strike, GEX King and the Expected Range lines never do, so they often appear only as arrowed tags.
- When price is within about 0.12% of a level, that level's line is drawn bolder.

### Gamma Levels

Three lines:

- **Gamma Flip** (`FLIP`, azure, long dashes) - the price where modeled net dealer gamma changes sign.
- **Call Wall** (`CALL WALL`, red, short dashes) - the strike at or above price with the largest call gamma exposure.
- **Put Wall** (`PUT WALL`, green, short dashes) - the strike at or below price with the largest put gamma exposure.

The walls are colored by what they do, not by calls and puts. The red wall above is where dealer selling is modeled to lean against a rally; the green wall below is where dealer buying is modeled to lean against a selloff.

**How to read them.** Above the flip, dealers are modeled long gamma: their hedging sells rallies and buys dips, which damps moves. Below it, they're modeled short gamma: their hedging chases the move, which amplifies it. The closer price is to the flip, the closer the market is to a regime change.

The walls are where the most hedging sits. They often act as resistance and support: in our study of 737 wall tests, S&P walls held about two times in three within an hour and Nasdaq walls about half, whichever side of the gamma flip price was on. Treat a wall as a place to watch, not a place price has to stop. See [How Often Do Gamma Walls Break?](/education/how-often-do-gamma-walls-break) and [Gamma Walls Explained](/education/gamma-walls-explained).

**How the walls are picked.** They don't jump with every tick. A wall is re-picked the minute price breaks through it, and otherwise every 15 minutes. At each re-pick the current wall keeps its place as long as it still carries at least three-quarters of the gamma of the biggest strike on its side.

**When the flip line is missing**, a chip near the bottom of the chart says why:

- `FLIP ↑ 7,750.00` or `FLIP ↓ 22,600.00` - the flip is above or below the prices on screen. Zoom the price axis out with **Price −**, Shift + scroll, or by dragging the right-hand price scale.
- `FLIP UNAVAILABLE` - the model found no crossing it trusts: one close enough to price to matter and backed by real open interest. That happens when price sits deep inside one regime or the chain is thin, such as in extended hours or during a volatility spike. It usually resolves on a later update. Hover the amber **?** for the details.
- `NO FLIP IN SELECTED EXPIRIES` - see [The Expiry filter](/help/platform/gamma-terminal#the-expiry-filter).

Without a flip, the chart can't draw the Regime shading either.

### Regime

**What it shows.** The chart background is tinted green on the long-gamma side of the flip and red on the short-gamma side. On wider screens the tints are labeled `LONG Γ · PINNING` and `SHORT Γ · TRENDING`.

**How to read it.** In long gamma, dealer hedging is modeled to lean against moves, which tends to damp volatility and pin price. In short gamma, it adds to moves, which tends to amplify them. [What Is Negative Gamma?](/education/what-is-negative-gamma) and [How to Trade Around the Gamma Flip](/education/how-to-trade-around-gamma-flip) go deeper.

**Keep in mind.**

- The band that contains price always agrees with the **Dealer Gamma @ Spot** box. Usually that means long gamma above the flip and short gamma below, but on an uneven book the shading can be the other way round. Go by the box.
- If you pan or zoom so the flip is off screen, the whole view takes one tint. It describes the prices on screen, which may not be where price is now.
- No flip, no shading.

### Ribbons

**What it shows.** Each strike is a lane running behind the candles, and every bar drops one orb in it. The orb's size and opacity show that strike's net dealer gamma in the bar's 5-minute window, compared with the heaviest strike on screen. **Gold** orbs are long gamma; **violet** orbs are short gamma.

**How to read it.**

- A thick lane that persists all session is a wall.
- Gold is a magnet and a brake: dealers are modeled to sell into strength and buy weakness there. Violet is an accelerant: dealers chase moves there.
- A lane swells as price nears its strike and thins as price leaves. That's gamma peaking at the money, not new positions: open interest only updates once a day, after the close. A fat lane right at price is where hedging is most active now.
- A lane that switches color is a strike whose long- and short-gamma contracts are close to balanced.

**Controls.** The **Opacity** slider next to the pill fades or strengthens all the orbs together. Hover a lane for the strike's exact value. Orbs under 5% of the heaviest strike aren't drawn, and the legend under the chart carries a key.

**Keep in mind.** Ribbons are live only, and on by default on the Gamma Terminal. They follow the Expiry filter. The history covers the strikes being tracked at the time, so earlier bars at far-away strikes can be blank.

### VWAP

**What it shows.** The session's volume-weighted average price (`VWAP`, dashed): the average price traded today, with each price weighted by how much volume traded there. It starts fresh each trading day.

**How to read it.** Many traders treat VWAP as the day's fair value. Price above it means buyers have been paying up on average; below it, sellers have been pressing. Where VWAP lines up with a gamma level, see [Gamma-VWAP Confluence](/education/gamma-vwap-confluence-explained).

**Keep in mind.** SPX and NDX don't trade directly, so their VWAP applies SPY's and QQQ's volume pattern to the index's prices. The Expiry filter doesn't affect it.

### Max Pain

**What it shows.** The strike where options holders would collect the least if the underlying settled there (`MAX PAIN`, gold, dotted). Without an Expiry filter, it's the max pain of the nearest expiration: today's, when there is one.

**How to read it.** It's most relevant in the last day or two before a meaningful expiration. The rest of the time it often sits away from price, and the walls and the flip matter more. See [Max Pain Explained](/education/max-pain-explained).

**Keep in mind.** Max Pain never widens the price axis, so it often shows only as an arrowed tag. With an Expiry filter, the chart and the Key Levels card recompute it from the expirations you picked; the ladders show `NA` instead.

### Pin Strike

**What it shows.** The nearby same-day (0DTE) strike where positive dealer gamma and the odds of price reaching it before the close combine most strongly (teal, labeled `PIN · STRONG`, `PIN · MODERATE` or `PIN · WEAK`).

**How to read it.** The strength word measures how much the winning strike stands out from its neighbors, not how big its gamma is. **Weak** means the pull is spread across several nearby strikes, not that the level is unimportant. It's a modeled pinning level, not a price target. [Pin Strike](/help/platform/pin-strike) explains how it's built.

**Keep in mind.** No line is drawn when there's no active pin. The pin is same-day by design, so it ignores the Expiry filter. It isn't part of the free preview.

### GEX King

**What it shows.** The strike with the largest net dealer gamma, long or short, across the whole option chain (`GEX KING`, violet). Off by default.

**How to read it.** The King is the slow-moving, structural counterpart to the same-day Pin: the strike with the most hedging attached, whatever its expiration. It can be a short-gamma strike.

**Keep in mind.** It ignores the Expiry filter, since narrowing it would make it a different measure. The crown on the ladders marks the heaviest strike in that ladder's view, which isn't always the King. It isn't part of the free preview.

### PD/PM Levels

**What it shows.** Where price has been: the previous regular session's high, low and close (`PDH`, `PDL`, `PDC`, gray, long dashes), and today's pre-market high and low (`PMH`, `PML`, gray, dotted). Off by default.

**How to read it.** These aren't dealer levels. They're reference prices many traders watch, drawn in gray so they never read as a gamma level.

**Keep in mind.** They're available on SPY, QQQ and NVDA only. SPX and NDX have no pre-market, and ES and NQ trade nearly around the clock, so the levels don't apply there. The numbers are always listed in a row above the chart. The pill, or the eye at the end of that row, draws them as lines.

### Expected Range

**What it shows.** A shaded band between `ER HIGH` and `ER LOW`: the move implied volatility is pricing, one standard deviation either side of the current price. Off by default. Pick **Daily**, **Weekly** or **Monthly** once it's on.

**How it's calculated.** It uses VIX for SPX, SPY and ES, and VXN for QQQ, NDX and NQ. The move is price × (VIX ÷ 100) × √(days ÷ 252), with 1, 5 or 21 trading days. With SPY at $600 and VIX at 16, the daily move is about $6.05, so the band runs from about $593.95 to $606.05.

**How to read it.** Under the usual assumptions, price finishes inside a one-standard-deviation band about 68% of the time. The band tells you how far, not which way. It re-centers as price moves, so it describes the range from here, not from the open.

**Keep in mind.** Expected Range is live only, and hidden during Rewind, since volatility is a live reading. It isn't drawn on NVDA, whose own volatility runs well above either index.

### Centroids

**What it shows.** Where today's option trading is centered. The **call centroid** (green) is the average strike of the calls traded today, weighted by how many contracts traded at each strike. The **put centroid** (red) is the same for puts. Off by default.

- The **crisp lines** cover the last 15 minutes of trading.
- The **wide, soft lines** cover the whole session so far.

**How to read it.** Calls trade mostly above price and puts mostly below, so the two lines usually sit on either side of price. The gap between them shows how widely today's trading is spread. When the call centroid drifts down or the put centroid drifts up, trading is concentrating closer to price. The session lines move slowly because they average the whole day; the 15-minute lines follow price and are noisier. Hover a bar to read both.

**Keep in mind.** Centroids describe where trading happened; they don't forecast where price will go. They count every expiration ZeroGEX tracks, so the Expiry filter doesn't apply. They also count only the strikes in the band ZeroGEX records around price (see [Data Coverage](/help/platform/data-coverage)), so they sit closer to price than a tool that counts every listed strike. When a strike joins that band during the day, its earlier volume is counted all at once, which can make the 15-minute line jump. Centroids are live only, on 1M to 1H bars.

### Bar Timer

**What it shows.** How long until the current candle closes: a countdown under the last-price tag, with a thin bar that fills as the candle ages. Hover the live candle for the elapsed and remaining time. Off by default.

**Keep in mind.** It shows only while the market is open and you're looking at the latest bar.

### Volume pane

The pane under the candles, shown or hidden with the eye next to **VOL**:

- **Up/Down** (the default) - uptick volume (green) stacked over downtick volume (red), one column per bar.
- **Cumulative** - a running total of uptick minus downtick volume for the current session, starting from zero at the open. Above zero, buyers have led the tape today; below zero, sellers have.

On SPX and NDX the pane is marked **PROXY (EST.)**. A cash index doesn't trade, so the volume shown is a derived estimate, not traded volume. [Options Flow Explained](/education/net-volume-vs-directional-flow) covers net volume in more depth.

## The Expiry filter

The **Expiry** menu in the toolbar picks which option expirations feed the gamma levels. **All expirations** uses the whole chain ZeroGEX tracks; [Data Coverage](/help/platform/data-coverage) lists it. **0DTE · today's expiry** follows the same-day expiration and rolls to the next one each day. You can also tick one or more specific dates.

| What | Follows the Expiry filter? |
|---|---|
| Gamma Flip, Call Wall, Put Wall | Yes |
| Max Pain | Yes on the chart and Key Levels; `NA` on the ladders |
| Regime shading and Dealer Gamma @ Spot | Yes |
| Ribbons, the Strike Panel and the ladders | Yes |
| The Key Levels strip and the Playbook | Yes |
| Pin Strike | No: always same-day |
| GEX King | No: always the whole chain |
| Centroids | No: every expiration |
| VWAP, PD/PM Levels, Expected Range | No: not built from the option chain |

A few things to know:

- A subset of expirations has its own flip: the price where that subset's gamma changes sign. A same-day book is often one-signed, with every strike on the same side, so there's no crossing to draw and the chart shows `NO FLIP IN SELECTED EXPIRIES`. That won't resolve later, because nothing is missing. Set Expiry back to **All** to see the whole-chain flip.
- `NO 0DTE TODAY · SHOWING ALL EXPIRIES` means there's no same-day expiration today, on a weekend or holiday for example, so the levels use all expirations.
- The filter is kept for your browser tab and shared with other charts that filter by expiration. Changing the symbol sets it back to All, unless it's on 0DTE.

## Reading the crosshair

Hover the chart, or tap or press and hold on a phone, for a crosshair and a card with:

- The bar's time, open, high, low, close and volume, plus **Net** in Cumulative volume mode.
- **Strike Γ near** the crosshair price: the net dealer gamma at the strikes nearby. This tells you how much hedging sits there. It is **not** the regime at that price, because a long-gamma strike can sit inside a short-gamma book. Read the regime from the shading and the Dealer Gamma @ Spot box.
- The nearest key level, and how far away it is.
- With Centroids on: the call and put centroids, the 15-minute value first and then the session value.
- With Ribbons on: the lane nearest the crosshair, its net gamma, and its share of the heaviest strike on screen.

## Zooming, panning and resetting

With a mouse or trackpad:

- **Drag** the chart sideways to move through time.
- **Ctrl + scroll** (**Cmd + scroll** on a Mac), or pinch on a trackpad, to zoom time. A plain scroll wheel scrolls the page, not the chart.
- **Shift + scroll**, or scroll over the right-hand price scale, to zoom the price axis. You can also drag the price scale up or down.
- The **Time** and **Price** − and + buttons at the bottom right do the same in steps.
- **»** jumps back to the latest bar.

On a phone, drag sideways to pan, pinch to zoom time, and use the **Price** buttons under the chart to zoom price. Tap, or press and hold and slide, for the crosshair; tap again to clear it.

Once you zoom or pan, the price scale stays where you put it. **Reset**, a double-click, or a new symbol or timeframe hands it back to automatic fitting. On the Gamma Terminal, automatic fitting keeps price in the vertical center, which is what lets the ladders line up with it.

## Rewind

**Rewind**, under the chart, replays the session: price and the gamma book as they stood at each moment.

- **Play** and **Pause**, a speed of **1×**, **4×**, **8×** or **16×**, and **Loop**, which is on by default.
- Drag the **scrubber** to jump to any candle.
- The levels, the Strike Panel, the ribbons and both ladders show what was known at that moment. VWAP and Max Pain are rebuilt for it.
- Expected Range, Bar Timer and the dollar figure in Dealer Gamma @ Spot are hidden while you rewind, because they're live readings.
- Rewind reaches back as far as the gamma history the chart holds, about six and a half hours, and less on 1H and 1D bars. For a full session from the open, follow the **full session** link to [Daily Replay](/replay).
- **● LIVE** or **»** returns to live, and so does changing the symbol or timeframe.

## The Playbook

Under the cards, **Where do we expect the underlying to go?** sets out what the current regime implies as price approaches a wall:

| | Up toward the Call Wall | Down toward the Put Wall |
|---|---|---|
| Positive γ (dealers long gamma) | Damped rally | Cushioned dip |
| Negative γ (dealers short gamma) | Squeeze risk | Flush risk |

It follows the chart live. Click a cell to read another scenario, and **Follow the chart** to go back. Each scenario lists what to watch, what invalidates it, and how often walls break.

## ES and NQ

ZeroGEX reads index options, not options on futures, so the ES and NQ levels come from the SPX and NDX chains, carried onto the futures price at fair value (the cost of carry to the contract's expiration). The **IMPLIED FROM SPX** (or **NDX**) chip says so. The price itself is the futures contract's own, and its code, such as ESZ26, appears in the header. When futures trade rich or cheap to fair value, the levels can sit slightly off. [Futures Contract Months](/help/platform/futures-contract-months) explains why prices can differ from other platforms.

## Free preview vs. live

| | Free preview | Basic and Pro |
|---|---|---|
| Data | About 15 minutes behind; reload for a newer snapshot | Live |
| Symbols and timeframes | SPY on 5-minute bars | All seven symbols, 1M to 1D |
| Panel | SPY and SPX ladders; Strike Panel silhouette only | Any pair; all four Strike Panel views; Session Δ |
| Overlays | Gamma Levels, Regime, VWAP, Max Pain | All of them |
| Tools | Zoom, crosshair, Save | Also the Expiry filter, Rewind and wall alerts |

[Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access) covers the rest of the site.

## What the terminal remembers

On this browser, the terminal saves your overlays, chart style, volume mode, Expected Range horizon, ribbon opacity, panel choice and Strike Panel view, along with your symbol and the ladders' Strikes, Session Δ and Unit settings. The Expiry filter is kept per browser tab.

It doesn't save the timeframe (it opens on 5M), the second ladder's symbol, zoom and pan, or Rewind.

## What the Gamma Terminal can't tell you

- **Who actually holds the options.** Dealer gamma is modeled from open interest using a standard convention. Real dealer books differ, and desks hedge in ways public data doesn't show.
- **New positions during the day.** Open interest updates once a day, after the close. During the session, levels move because price, time and volatility change the gamma of positions already open.
- **Where price will go.** The walls, the pin, max pain, the expected range and the centroids are context, not targets or promises. Gamma levels are decision-support, not investment advice.

## See also

- [Reading the Dashboard](/help/platform/dashboard)
- [How to Read ZeroGEX Charts](/help/platform/reading-charts)
- [Pin Strike](/help/platform/pin-strike)
- [Gamma Exposure Explained](/education/gamma-exposure-explained)
- [Gamma Walls Explained](/education/gamma-walls-explained)
- [How to Trade Around the Gamma Flip](/education/how-to-trade-around-gamma-flip)
- [Data Coverage](/help/platform/data-coverage)
