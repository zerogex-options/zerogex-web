# ZeroGEX Daily Gamma Levels — TradingView indicator

A free, manual-entry Pine Script that plots the daily ZeroGEX dealer-positioning
levels (Gamma Flip, Call Wall, Put Wall, Max Gamma / Pin) as horizontal lines on
any chart. It is a **discovery funnel**, not a data integration:

> Google / TradingView search → free indicator → daily levels page → dashboard trial

## Files

| File | Purpose |
| --- | --- |
| `frontend/public/tradingview/zerogex-daily-gamma-levels.pine` | The script itself. Single source of truth. Served at `https://zerogex.io/tradingview/zerogex-daily-gamma-levels.pine`. |
| `frontend/components/PlotOnTradingView.tsx` | "Plot these levels on TradingView" section (copy / download / instructions) rendered on `/spx-gamma-levels`. |

The Copy button on the site fetches the `.pine` file directly, so there is only
one copy of the source to maintain — edit the `.pine` file and both the site and
the download update.

## Rollout order

1. **Publish the script on TradingView.** (Manual — needs a TradingView account.)
   Open Pine Editor → paste the script → *Add to chart* → *Publish script*.
   Use the title, description, and tags below.
2. **The three free gamma pages are already linked** from the script header and
   the info box (`zerogex.io/spx-gamma-levels`).
3. **`/spx-gamma-levels` already links back** to TradingView via the new "Plot
   these levels on TradingView" section. Once the script is live on TradingView,
   optionally swap the copy/download buttons for a direct link to the published
   script URL.
4. **Post on X / StockTwits:** "I made a free TradingView script to plot today's
   ZeroGEX gamma levels — Gamma Flip, Call Wall, Put Wall, Max Gamma." Link the
   published script.

---

## TradingView publish form — copy/paste

**Title**

```
ZeroGEX Daily Gamma Levels — SPY/SPX/QQQ
```

**Description**

```
ZeroGEX Daily Gamma Levels lets traders manually plot key options-positioning
levels on their chart, including Gamma Flip, Call Wall, Put Wall, and Max Gamma /
Pin.

These levels are commonly used by SPY, SPX, QQQ, ES, and NQ traders to identify
potential support, resistance, pinning zones, and volatility-regime shifts.

HOW TO USE
1. Add the indicator to your chart.
2. Open Settings and type in today's levels:
   • Gamma Flip
   • Call Wall
   • Put Wall
   • Max Gamma / Pin
3. Each level draws as a horizontal line with a price label, plus an on-chart
   info box. Set any level to 0 to hide it. Optional cross-alerts are included.

WHERE TO GET THE NUMBERS
Free, ~15-minute-delayed levels are published daily at:
  https://zerogex.io/spx-gamma-levels

This script is manual-entry only — it does not pull data. For real-time,
auto-updating levels, live dealer positioning, option flow, signals, and the
intraday dashboard, visit:
  https://zerogex.io

DISCLAIMER
For informational and educational purposes only. Not financial advice. Options
trading involves significant risk.
```

**Suggested tags**

```
GEX, gamma, gamma exposure, call wall, put wall, gamma flip, max pain,
SPX, SPY, QQQ, ES, NQ, options, dealer positioning, support and resistance
```

Publish as an **open-source** script so it is indexable/searchable and shows in
the public library.

---

## X / StockTwits post (draft)

```
I built a free TradingView script to plot today's gamma levels on your chart 📈

Gamma Flip · Call Wall · Put Wall · Max Gamma / Pin
Works on SPY, SPX, QQQ, ES, NQ.

Grab today's numbers free: https://zerogex.io/spx-gamma-levels
Script: <published TradingView URL>
```
