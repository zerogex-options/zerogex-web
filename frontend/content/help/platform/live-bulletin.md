# Using the Live Bulletin

*The streaming feed of signal events, regime shifts, and notable flow.*

---

## What the Live Bulletin is

The Live Bulletin is your **timeline of the trading day**. Every time a signal fires, the GEX regime shifts, a wall migrates by a meaningful amount, or smart-money flow shows up in size, an entry lands in the bulletin.

Think of it as the "newsfeed view" of everything ZeroGEX detects, ranked by importance and time.

## What lands in the bulletin

There are five families of items:

- **Signal triggers** — when an Advanced signal crosses its trigger threshold.
- **Regime events** — gamma flip cross, regime transition (positive ↔ negative).
- **Wall events** — call wall or put wall migrating by a meaningful amount.
- **Flow notables** — premium spikes, smart-money runs, unusual blocks.
- **Schedule events** — market open, EOD pressure window opening, close.

## How items are scored and ordered

Each item has:

- A **timestamp** — when it occurred (and a "fresh" badge for the most recent items)
- A **direction chip** — bullish, bearish, or neutral
- A **conviction score** — how strong the signal/event was

Items are time-ordered top-to-bottom by default. You can switch to importance-ordered using the sort dropdown.

## Reading an item

Each row has:

1. **Title** — the event name ("EOD Pressure fired", "Trap Detection bearish", "Gamma flip crossed").
2. **Subtitle** — the key context (symbol, score, level).
3. **Time** — relative ("4m ago") and absolute on hover.
4. **Action** — click "Open" to jump to the relevant signal or metric page.

For triggers, the rows also show the **score that fired** and the **trigger threshold** so you can see whether it was a borderline event or a strong one.

## Filtering

The filter bar lets you scope the feed by:

- **Symbol** — SPY, SPX, QQQ (defaults to the symbol you've got active)
- **Signal family** — Advanced, Basic, Regime, Flow, Schedule
- **Direction** — bullish, bearish, neutral
- **Time window** — last hour, today, last 24h, last 5 trading days

Filters compose. You can stack symbol = SPX with signal family = Advanced with direction = bearish to surface only Advanced bearish triggers on SPX.

## When the bulletin is most useful

- **In the morning** — scroll back over the last few sessions to see what fired overnight and pre-market.
- **Around major levels** — when price is approaching the gamma flip, the call wall, or the put wall, expect events to land.
- **In the final hour** — the EOD Pressure signal often delivers actionable reads from 14:30 ET onward.
- **As a journaling tool** — every fired signal is logged, so the bulletin is the audit trail for what your day looked like.

## What it isn't

The Live Bulletin is **not a trade signal feed**. Items are events worth your attention; whether they are trades depends on your strategy. The Composite Score panel is the closer thing to a "what does this mean for direction" read, and even that is a filter, not a forecast.

## Visibility by tier

- Basic tier sees Basic signal events, regime events, wall events, and flow notables.
- Pro tier additionally sees Advanced signal triggers.

Locked items (for tier upgrade prompts) show a lock chip rather than disappearing.

## The admin mirror

There's a watermark-free admin version of the bulletin used for screenshots and demos. That's an internal-only path.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Composite Score](/help/platform/composite-score)
- [Signal Alerts](/help/platform/alerts)
