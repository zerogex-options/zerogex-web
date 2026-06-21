# Streaming & Performance

*How real-time updates reach your browser, what to do if a page feels stale, and the simple fixes for a slow connection.*

---

## How streaming works

ZeroGEX pushes live data to your browser using a long-lived connection — open the dashboard and data starts flowing in within a second of page load. There's no polling on the client side.

The connection refreshes itself if it drops. If a refresh fails repeatedly, the UI shows a "Reconnecting…" chip and starts a retry with backoff.

## What "live" actually means

| Surface | Update cadence |
| --- | --- |
| Price quote | ~1 second |
| Flow / tape | ~1 second |
| Signal scores | 1–5 seconds depending on signal |
| GEX surface | 5–15 seconds (bottleneck: chain snapshot) |
| Composite Score | ~5 seconds |

When the page is in the background tab, the browser may throttle updates. Bring the tab forward and updates resume immediately.

## When a page feels stale

The common culprits, in order of how often we see them:

1. **The tab has been backgrounded for hours.** The connection may have dropped. Reload the page.
2. **You're on a slow connection.** WebSocket messages back up; the latest data wins but updates feel sluggish. Switch networks or close other heavy tabs.
3. **An ad blocker or extension is interfering.** Some over-aggressive blockers drop WebSocket frames. Try in a private window with extensions disabled.
4. **The market is closed.** The session badge says so. Last computed values are shown.

## What to check first

When something looks wrong, the four-step diagnostic:

1. Look at the **session badge** — is the market open?
2. Look at the **price tile** — is the timestamp recent?
3. Look at the **connection chip** in the header — is it green?
4. Hard reload (Cmd+Shift+R or Ctrl+Shift+R).

That covers ~95% of "this looks broken" situations.

## Performance tips

### Use a recent browser

ZeroGEX is built for evergreen Chrome, Edge, Firefox, and Safari (Tech Preview). Older browser versions will technically work but won't get the performance optimizations.

### Close other heavy tabs

The dashboard pushes several charts live. If you've got a YouTube tab streaming and three TradingView windows open, the browser has to share CPU. Close what you don't need.

### Disable unnecessary extensions

Privacy and ad-blocking extensions are generally fine. Aggressive script blockers (NoScript with restrictive defaults) need ZeroGEX domains allowlisted.

### Light mode is slightly faster

Light theme renders slightly faster than dark theme on most setups because of how shadow and tinting are composited. Marginal — but if you're on a low-power device, worth knowing.

### Symbol switching is heavier than timeframe switching

Switching symbols re-fetches everything; switching timeframes re-uses the underlying stream. If you're moving fast, prefer the timeframe selector.

## Mobile

ZeroGEX runs on phones — every page is responsive — but the platform is **built for desktop**. The chart density assumes a screen wider than 1024px. On mobile, scroll horizontally on charts; the data is all there but the layout is denser.

## When to email support

If the platform itself feels stuck (not your connection, not a stale tab), check the bottom-right connection chip. If it stays red across multiple hard reloads, email [support@zerogex.io](mailto:support@zerogex.io) with:

- The page you were on
- The time it happened (with timezone)
- Your browser and OS

Logs on our side are timestamped — that's enough to trace it.

## See also

- [Troubleshooting](/help/platform/troubleshooting)
- [Data Coverage & Refresh](/help/platform/data-coverage)
