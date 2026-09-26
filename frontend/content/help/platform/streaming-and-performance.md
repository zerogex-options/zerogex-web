# Streaming & Performance

*How real-time updates reach your browser, what to do if a page feels stale, and the simple fixes for a slow connection.*

---

## How live updates work

Every page keeps itself current - there's nothing to reload. The price in the header updates about once a second, and each panel fetches fresh numbers on its own short timer, every few seconds for most surfaces. Data starts arriving as soon as the page loads.

If a request fails, the page keeps showing the last good values and tries again on its next cycle. The Composite Score and Trade Bias pages also show a live indicator, with a "Reconnecting…" notice if updates stop arriving.

## What "live" actually means

Pages check for new numbers every few seconds, but each number changes only as often as it's computed:

| Surface | How often it changes |
| --- | --- |
| Price quote | About every second |
| Dealer positioning (GEX, walls, flip, max pain) | Recomputed about once a minute |
| Signal scores and the Composite Score | About once a minute; the signal pages check every 5 seconds |
| Options flow | Five-minute bars |
| Volatility gauges (VIX / VXN) | Five-minute bars |

When the page is in the background tab, the browser may throttle updates. Bring the tab forward and updates resume immediately.

## When a page feels stale

The common culprits, in order of how often we see them:

1. **The tab has been backgrounded for hours.** Updates may have stalled. Reload the page.
2. **You're on a slow connection.** Requests back up; the latest data wins but updates feel sluggish. Switch networks or close other heavy tabs.
3. **An ad blocker or extension is interfering.** Some over-aggressive blockers block the background requests that fetch fresh data. Try in a private window with extensions disabled.
4. **The market is closed.** The session badge says so. Last computed values are shown.

## What to check first

When something looks wrong, the three-step diagnostic:

1. Look at the **session badge** - is the market open?
2. Hover the **price in the header** - does its "as of" time look recent?
3. Hard reload (Cmd+Shift+R or Ctrl+Shift+R).

That covers most "this looks broken" situations.

## Performance tips

### Use a recent browser

ZeroGEX is built for current versions of Chrome, Edge, Firefox, and Safari. If something misbehaves in an older browser, update it first.

### Close other heavy tabs

The dashboard updates several charts live. If you've got a YouTube tab streaming and three TradingView windows open, the browser has to share CPU. Close what you don't need.

### Disable unnecessary extensions

Privacy and ad-blocking extensions are generally fine. Aggressive script blockers (NoScript with restrictive defaults) need ZeroGEX domains allowlisted.

### Symbol switching is heavier than timeframe switching

Switching symbols re-fetches every panel on the page; switching a chart's timeframe only re-fetches that chart.

## Mobile

ZeroGEX runs on phones - every page is responsive - but the platform is **built for desktop**. The chart density assumes a screen wider than 1024px. On a phone, charts fit the screen and thin out their labels; the data is all there but the layout is denser. Swipe up or down to scroll the page - charts only take sideways drags.

## When to email support

If the platform itself feels stuck (not your connection, not a stale tab) and hard reloads don't fix it, email [support@zerogex.io](mailto:support@zerogex.io) with:

- The page you were on
- The time it happened (with timezone)
- Your browser and OS

Logs on our side are timestamped - that's enough to trace it.

## See also

- [Troubleshooting](/help/platform/troubleshooting)
- [Data Coverage & Refresh](/help/platform/data-coverage)
