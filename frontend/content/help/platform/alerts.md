# Signal Alerts

*How signal triggers surface inside the platform, what fires versus what stays quiet, and how to use the Live Bulletin as your alert log.*

---

## Where alerts show up

ZeroGEX delivers alerts **in-app**, not by SMS or push notification. There are three places they surface:

1. **Live Bulletin** — every trigger lands here with full context. This is your audit log.
2. **The signal card** — on the dashboard or signal-list page, a trigger lights the card and tints it in the score direction.
3. **The composite panel** — when a trigger has high enough conviction, it shifts the composite visibly.

This is intentional. ZeroGEX is built to be **watched, not interrupted**. Push-style alerts cause overtrading; the in-app log lets you scan when you choose to.

## What fires

Only Advanced signal triggers and structural events fire:

- The eight Advanced signals when their trigger thresholds are crossed.
- Gamma flip crosses.
- Regime transitions (positive ↔ negative gamma at spot).
- Wall migrations of more than 0.5% from the prior level.
- Flow notables (block prints, sweep clusters, smart-money runs).

Basic signals do **not** fire. They're continuous inputs to the composite.

## How a trigger lands

When a trigger crosses:

1. The signal score is logged at the cross.
2. The Live Bulletin row is created with timestamp, direction, score, threshold, and context.
3. The signal card on every page reflects the new state.
4. The composite updates.

If a signal stays in trigger state across multiple bars, only the **first** trigger event is logged in the bulletin. Subsequent bars are aggregated into the existing entry.

## Trigger thresholds reference

| Signal | Threshold |
| --- | --- |
| EOD Pressure | abs(score) ≥ 0.20 |
| Gamma/VWAP Confluence | abs(score) ≥ 0.20 |
| Market Pressure Index | loading ≥ 50 AND \|direction\| ≥ 0.20 |
| Range Break Imminence | imminence ≥ 65 |
| Squeeze Setup | abs(score) ≥ 0.25 |
| Trap Detection | abs(score) ≥ 0.25 |
| Volatility Expansion | abs(score) ≥ 0.25 |
| 0DTE Position Imbalance | abs(score) ≥ 0.25 |

## Why some signals don't fire

A signal can be at +0.7 and **not** be firing. Reasons:

- The signal's trigger threshold uses a composite (Market Pressure needs loading ≥ 50 too).
- The signal is gated by a session window (EOD Pressure only active 14:30–15:45 ET).
- The signal has a debounce — it must hold the threshold for some minimum number of bars.

The signal card on the page will explain the current trigger state in plain English.

## Using the bulletin as your alert log

The Live Bulletin is the **system of record** for triggers. If you went to lunch, you don't open every page to see what fired — you open the bulletin, filter by symbol and signal family, and read the day's events in chronological order.

## What's coming

We don't currently send alerts by email, SMS, push notification, or webhook. If demand justifies it, those channels can be added — email [support@zerogex.io](mailto:support@zerogex.io) to vote.

## See also

- [Using the Live Bulletin](/help/platform/live-bulletin)
- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Email Preferences](/help/platform/email-preferences)
