# Signal Alerts

*How signal triggers surface inside the platform, what fires versus what stays quiet, and how to look back at what fired.*

---

## Where alerts show up

ZeroGEX shows signal triggers **in-app**, not by email, SMS, or push notification. They surface in two places:

1. **The signal card** - on the Advanced Signal Dashboard (Pro), a trigger outlines the card, tints it in the score's direction, and switches its status from *Stand by* to *Triggered*.
2. **The Event Timeline** - on the dashboard's Event Timelines tab and at the bottom of each signal's page: the score's recent path, with direction flips marked.

Triggers don't land in the Live Bulletin - that's a share-ready card of the current dealer-gamma snapshot - and they don't move the Composite Score.

This is intentional. ZeroGEX is built to be **watched, not interrupted**. Push-style alerts cause overtrading; the in-app views let you scan when you choose to.

## What fires

Only the eight Advanced signals fire, each when its trigger threshold is crossed (see the table below).

Basic signals do **not** fire. They're continuous, advisory reads, and they carry no weight in the Composite Score. Their cards are outlined and marked *Triggered* past ±25, but that only highlights a strong read.

Structural changes - price crossing the gamma flip, a wall moving - aren't alerts either. You read those on the Gamma Chart and the Metrics pages.

## How a trigger lands

When a trigger crosses:

1. The signal engine marks the signal as triggered on the cycle where its score crosses the threshold.
2. The card on the Advanced Signal Dashboard switches to *Triggered* and takes the direction's color. The page checks for new values every few seconds, so there's no need to reload.
3. The Composite Score is unaffected.

A card stays *Triggered* while the score holds past the threshold, and goes back to *Stand by* when it drops back inside. There's no separate list of trigger events - the Event Timeline is the record.

## Trigger thresholds reference

| Signal | Threshold |
| --- | --- |
| EOD Pressure | \|score\| ≥ 20 |
| Gamma/VWAP Confluence | \|score\| ≥ 20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | \|score\| ≥ 25 |
| Trap Detection | \|score\| ≥ 25 |
| Volatility Expansion | \|score\| ≥ 25 |
| 0DTE Position Imbalance | \|score\| ≥ 25 |

Scores run from -100 to +100. See [Reading the -100 to +100 Score Line](/help/platform/score-line).

## Why some signals don't fire

A signal can show a sizable score and not be firing, or sit at 0 when you expect a read. Reasons:

- Its trigger isn't the score alone: Market Pressure Index needs loading ≥ 50 as well as a clear direction, and Range Break Imminence fires on imminence ≥ 65.
- It's gated by a session window: EOD Pressure only runs from 14:30 to 16:00 ET and is forced to 0 outside it, and 0DTE Position Imbalance reads *Inactive* when its window is closed.

The card shows its current state: *Triggered*, *Stand by*, or *Inactive* with the reason.

## Looking back at what fired

There's no trigger log. To see what a signal did while you were away, open the **Event Timelines** tab on the Advanced Signal Dashboard, or the Event Timeline at the bottom of the signal's page. It plots the score over the last two sessions with direction flips marked, next to how far the underlying moved over the following 30, 60 or 120 minutes, and you can zoom from 30 minutes out to the full range.

For a graded look back at a whole session, the public **Signals - one day** scorecard (under Receipts in the sidebar) shows which signals flipped, how many of those flips could be graded, and how they resolved.

## Outbound alerts

Signal triggers are shown **in-app only** - on the signal cards and in the Event Timelines. They are not sent by email, SMS, push notification, or webhook.

The channel toggles under [Account → Notifications](/account/notifications) belong to **TradeWorkz™ Bot Trading** (Pro, beta), not to signal triggers: they cover entry and exit notifications from bots you follow. In-app (the bell on the Bot Trading page) and email deliver today; the webhook channel stores your preference but doesn't deliver anything yet, so don't build against it. To automate on signals today, poll the [API](/help/platform/api-access) (Pro) rather than wait on a push that won't arrive.

Outbound delivery is on the list, not shipped. If it would change how you trade, email [support@zerogex.io](mailto:support@zerogex.io) with the channel and the signals you'd want - specifics move it up.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Advanced Signal Dashboard](/help/platform/advanced-signals-dashboard)
- [Email Preferences](/help/platform/email-preferences)
