# ZeroGEX Daily Gamma Levels — TradingView indicator

A free, manual-entry Pine Script that plots the daily ZeroGEX dealer-positioning
levels (Gamma Flip, Call Wall, Put Wall, Max Pain) as horizontal lines on
any chart. It is a **discovery funnel**, not a data integration:

> Google / TradingView search → free indicator → daily levels page → dashboard trial

**Published (public, open-source):**
<https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/>

## Files

| File | Purpose |
| --- | --- |
| `frontend/public/tradingview/zerogex-daily-gamma-levels.pine` | The source of record for the script. Kept in sync with the published TradingView version; edit here first, then *Update* the published script. Also served at `https://zerogex.io/tradingview/zerogex-daily-gamma-levels.pine`. |
| `frontend/components/PlotOnTradingView.tsx` | "Plot these levels on TradingView" section rendered on all three gamma pages. Now that the script is public, it just links to the published script and tells users to add it from the indicator search — no copy/download. |

## Rollout order

1. **Publish the script on TradingView.** ✅ Done — live at the URL above
   (public, open-source, so it appears in the indicator search).
2. **The three free gamma pages are already linked** from the script header and
   the info box (`zerogex.io/spx-gamma-levels`).
3. **All three gamma pages link back** to the published script via the "Plot
   these levels on TradingView" section — the CTA opens the script page and tells
   users to add it from the Indicators search. ✅ Done.
4. **Post on X / StockTwits:** "I made a free TradingView script to plot today's
   ZeroGEX gamma levels — Gamma Flip, Call Wall, Put Wall, Max Pain." Link the
   published script.

> **House Rules note:** TradingView restricts advertising/external links in
> public scripts. Keep the published description educational with at most a
> single factual `zerogex.io` mention; heavy CTAs/links risk moderation removal.

---

## TradingView publish form — copy/paste

**Title**

```
ZeroGEX Daily Gamma Levels — SPY/SPX/QQQ
```

**Description**

```
ZeroGEX Daily Gamma Levels lets traders manually plot key options-positioning
levels on their chart, including Gamma Flip, Call Wall, Put Wall, and Max Pain.

These levels are commonly used by SPY, SPX, QQQ, ES, and NQ traders to identify
potential support, resistance, pinning zones, and volatility-regime shifts.

HOW TO USE
1. Add the indicator to your chart.
2. Open Settings and type in today's levels:
   • Gamma Flip
   • Call Wall
   • Put Wall
   • Max Pain
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

Gamma Flip · Call Wall · Put Wall · Max Pain
Works on SPY, SPX, QQQ, ES, NQ.

Grab today's numbers free: https://zerogex.io/spx-gamma-levels
Script: <published TradingView URL>
```
