# Reading the Dashboard

*The page you open first every morning. Every strip, chart and card explained.*

---

## What the Dashboard is for

The Main Dashboard is the **single-screen read** of the current market. It answers, in 30 seconds, three questions:

1. **Where are dealers positioned?** (the gamma regime and the key levels)
2. **What is the tape saying?** (flow and volatility)
3. **What is the blended read?** (Trade Bias and the Composite MSI)

You're not making decisions on the Dashboard. You're orienting. From there you drill into the right page.

## Simple and Detailed

The **Simple / Detailed** toggle at the top right sets how much the page shows. **Simple** is the default and keeps the page glance-first: Today's Read, Proprietary Signals & Volatility, and Positioning & Flow start folded - click a section's title to open it. **Detailed** opens every section. Your choice is remembered.

## The anatomy

### 1. Key Levels

The strip across the top. Its header shows the symbol, the expirations the levels come from, and the **Long γ / Short γ** chip: long gamma means dealer hedging tends to dampen moves (pinning); short gamma means it tends to amplify them (trending). Below it is one card per level, each with how far price is from it:

- **Spot** - the live price and its change.
- **Gamma Flip** - the level where modeled dealer gamma changes sign. Above it, hedging dampens moves; below it, hedging amplifies them. The closer price is to the flip, the higher the risk of a regime change.
- **Pin Strike** - the nearby 0DTE strike where positive dealer gamma and the odds of price getting there combine most strongly, with a Strong / Moderate / Weak label. It's a modeled pinning level, not a price target, and the card says so when no strike qualifies. See [Pin Strike](/help/platform/pin-strike).
- **Call Wall** and **Put Wall** - the strikes with the most call gamma and put gamma. They often act as resistance and support: in our study of 737 wall tests, S&P walls held about two times in three within an hour and Nasdaq walls about half, whichever side of the gamma flip price was on. See [Gamma Walls Explained](/education/gamma-walls-explained).
- **Max Pain** - the strike that minimizes the total value of outstanding options at expiration. Most relevant in the last day or two before a meaningful expiration. See [Max Pain Explained](/education/max-pain-explained).

The strip shows exactly the levels the Gamma Chart draws, including any expiration filter you set on the chart. To switch symbols from the strip, hover it for arrows on a computer, or swipe it on a phone.

### 2. Today's Read

An auto-generated headline and short paragraph on the regime for the selected symbol: long gamma (pinned, lower volatility), short gamma (trending, higher volatility), sitting at the flip (a transition), or unresolved when the flip can't be computed from the current snapshot. It's built from the same model as the [Live Bulletin](/help/platform/live-bulletin), and clicking it opens the full bulletin.

### 3. The Gamma Chart

The ZeroGEX Gamma Chart is the centerpiece: live candles with the dealer-gamma structure drawn on the same price axis. By default it draws the flip and the call and put walls (**Gamma Levels**), **Max Pain**, **Pin Strike** and **VWAP**, and shades the long- and short-gamma zones (**Regime**) - each one a toggle above the chart. The **Gamma Rail** beside the candles shows net dealer gamma by price, so the walls show up as literal bars. The chart's header carries the live price, its change, the session and the dealer-gamma regime. Use the chart's controls to change the timeframe and chart style and to filter which expirations feed the levels. See [How to Read ZeroGEX Charts](/help/platform/reading-charts).

### 4. Trade Bias

A single card with the positioning state (such as *Long Gamma · Bullish Flow* or *Mixed Signals*), which way its inputs lean, and an agreement score out of 10. It describes positioning and flow as they stand; it is **not** a trade signal or a forecast. **Open Trade Bias** goes to the full breakdown on the Trade Bias page, which is part of Pro. On Basic, the card is built without the Pro-only signal inputs.

Under the card, **How to read these signals** (folded) explains how Trade Bias, the Composite MSI, the Basic signals and the Advanced signals fit together.

### 5. Proprietary Signals & Volatility

- **Composite MSI** - a 0-100 regime gauge: 70 and up is **Trend / Expansion**, 40-70 **Controlled Trend**, 20-40 **Chop / Range**, and under 20 **Compression**, the band where moves have traveled least. A high MSI doesn't mean bullish - it means trends can run. Read direction from Trade Bias or the individual signals.
- **Signal Breadth** - how many signals lean bullish, neutral or bearish, with the strongest on each side.
- **Regime Triggers** (Pro) - how ready the market is for a regime shift, from Volatility Expansion, Range Break Imminence and Market Pressure. Read the size of each score, not its sign.
- **Volatility Monitor** - two gauges: **Level** (VIX, or VXN for QQQ and NDX) and **Momentum** (whether volatility is collapsing, easing, stable, rising or surging).

### 6. Positioning & Flow

- **Call GEX** and **Put GEX** - total gamma exposure from calls and from puts.
- **Call Wall (Resistance)** and **Put Wall (Support)** - the largest call gamma at or above spot and the largest put gamma at or below it, with the distance from spot. These are ranked across today's expiration and the next two (0-2DTE), so if you've filtered the chart to 0DTE only, the Key Levels strip can show a different strike.
- **Net Flow**, **Net Premium** and **Put/Call Ratio** - for the current session: net call contracts minus net put contracts, the same in premium dollars, and put volume divided by call volume. "Net" means buyer-initiated minus seller-initiated, so a positive Net Flow is flow leaning to calls.

At the bottom of the page are the reminder that dealer positioning is modeled, not directly observed, and the time of the last update.

## How the dashboard refreshes

Everything updates live, so there's no need to reload the page. The price updates every second. The levels and signals are recomputed about once a minute, and the page picks up each new computation within a few seconds. The volatility gauges refresh about every 30 seconds.

## Pre-market, after-hours, and closed

The session shown in the Gamma Chart's header tells you which session the price is from. Outside regular hours, the levels and signals reflect the most recent computation.

## Reading the Dashboard in 30 seconds

The discipline:

1. Read the **Long γ / Short γ** chip and where Spot sits against the **Gamma Flip**.
2. Read the **Call Wall** and **Put Wall** - these are your levels. Near expiration, check the **Pin Strike** too.
3. Glance at the **Trade Bias** card.
4. Open **Today's Read** if you want it in words.
5. Decide which page to open for the actual trade.

That's it. If you find yourself spending more than 30 seconds here, you've stopped orienting and started analyzing - go to the signal page that's relevant.

Want your own layout? [My Dashboard](/my-dashboard) lets you build a board from widgets, including Key Levels, and on a computer you can split it to watch two symbols side by side.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Using the Live Bulletin](/help/platform/live-bulletin)
- [Pin Strike](/help/platform/pin-strike)
