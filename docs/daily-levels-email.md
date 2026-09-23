# Free daily levels email

The pre-open digest an anonymous visitor can subscribe to from the public
`/<ticker>-gamma-levels` pages. One email each trading morning with the gamma
flip, call wall, put wall, max pain and net GEX for all six symbols, led by
the ticker the subscriber chose.

## Why it exists

Before this shipped there was no way to leave an email address anywhere on the
site outside the account signup flow. The free levels pages take the large
majority of the organic impressions, and every one of those sessions was a
one-shot: read the numbers, leave, unreachable forever. The only ask the page
made of a cold search visitor was a credit card.

This is the smaller ask that comes first. It is deliberately **not** an
account: see "Why not a user row" below.

## Moving parts

| Piece | File |
| --- | --- |
| Decision rules (window, freshness, tokens, opt-in policy) | `frontend/core/levelsEmail.ts` |
| Storage | `frontend/core/levelsSubscribers.ts`, table in `frontend/core/db.ts` |
| Rate limiting | `frontend/core/levelsRateLimit.ts` |
| Digest model + rendering | `frontend/core/dailyLevelsDigest.ts` |
| Signup form | `frontend/components/LevelsEmailSignup.tsx` |
| Subscribe endpoint | `frontend/app/api/levels-email/route.ts` |
| Confirm / unsubscribe pages | `frontend/app/levels-email/{confirm,unsubscribe}/route.ts` |
| Emails | `sendLevelsConfirmationEmail`, `sendDailyLevelsEmail` in `frontend/core/mailer.ts` |
| Send script | `frontend/scripts/send-daily-levels.mts` |
| Timer | `deploy/systemd/zerogex-web-daily-levels.{service,timer}`, installed by `deploy/steps/099.daily-levels` |

## Running it by hand

```bash
cd ~/zerogex-web

# What would go out, and why. Prints the per-symbol freshness verdict, the
# subject, the recipient count, the preference split, and the text body.
make daily-levels DRY_RUN=1 FORCE=1

# One copy to an address you name. No database writes, no subscriber touched.
make daily-levels PREVIEW_TO=you@example.com FORCE=1

# The real send. This is what the timer runs.
make daily-levels YES=1

# Bounded, for a first live send to a large list.
make daily-levels YES=1 LIMIT=25 THROTTLE_MS=500
```

`FORCE=1` skips only the clock window. It does **not** skip the trading-day or
freshness guards, so a forced run on a Saturday still aborts.

## The three guards

Each aborts the whole run rather than sending something wrong.

1. **Trading day.** Weekends structurally; NYSE holidays from
   `NEXT_PUBLIC_NYSE_HOLIDAYS`. Evaluated against the session being *named*, so
   `SESSION_DATE=` moves which day is checked and never disables the check.
   An empty holiday list degrades to weekends-only — guard 3 is the backstop.
2. **Send window, 08:30–09:25 ET.** Always against the real clock. This exists
   because systemd's `Persistent=` replays a missed unit as soon as the box is
   back, and a "pre-open levels" email arriving at 14:00 is worse than none.
   The unit sets `Persistent=false`; this is the second lock.
3. **Freshness, per symbol.** The snapshot must be from the current session or
   the one immediately before it. `serverApiGet`-style reads hand back a
   last-good value when the backend is unreachable, so "we got data" is not
   "we got the right data". A feed frozen since Thursday fails on a Monday.

### Why "or the session before"

**Measured on the first live send, 2026-09-22 08:48 ET.** The six tickers do
not agree before the open, and the split is structural:

| | Snapshot at 08:48 ET | Why |
| --- | --- | --- |
| SPY, QQQ | that morning, 1-2 min old | ETF options trade pre-market |
| SPX, NDX | previous close, 15:59 ET | index options do not refresh pre-open in this pipeline |
| ES, NQ | previous close, 15:59 ET | derived from SPX / NDX, so they inherit it |

So the guard has to accept either session, and the digest has to say which
each row came from. Demanding the current date would abort every send;
forcing one timestamp onto all six would either drop the fresh rows or
mislabel them.

THE FIRST VERSION DID DROP THEM. An anchor rule required every row to match
the primary's session, which sounds right and is exactly backwards before the
open: an SPX-led digest dropped SPY and QQQ for being NEWER than the anchor,
and a SPY-led one dropped four of six. Two subscribers on the same morning
received materially different emails. Every row now carries its own short
stamp instead ("8:48 AM" for the session being named, "Mon 3:59 PM" for an
earlier one), and a mixed digest opens by explaining the split rather than
hiding it.

## Partial data

Every ticker that passed the freshness guard is printed, stamped with its own
time. Only a ticker with **no usable snapshot at all** is dropped, and it is
named ("Not included this morning").

An unresolved gamma flip is marked `*` and footnoted, linking `/methodology` —
which already commits to the policy: "when the option chain is too degraded
for the flip resolver to find a qualifying crossing, ZeroGEX reports the flip
as unresolved ... rather than fabricating an edge value". A bare em dash reads
as an outage; the asterisk says the number was withheld on purpose.

If the subscriber's *chosen* ticker has no usable snapshot, they receive the
SPX-led digest instead of nothing. If SPX itself has none, the run aborts.

## The reading list

Every digest ends with five public, no-account links: `/methodology`,
`/education/how-to-read-a-gamma-flip`, `/education/gamma-walls-explained`,
`/scorecard` and `/tradingview-indicator`. Defined in one place
(`FOOTER_LINKS` in core/dailyLevelsDigest.ts) and asserted public by test.

`/scorecard` is there deliberately: the September Search Console review found
it had "no entry point at all: dated permalinks, no sidebar entry, no inbound
link", and a daily email to engaged readers is the best inbound link it gets.

## Double opt-in

A submission stores an unconfirmed row and sends one confirmation. Nothing
else is ever sent until the link is clicked. This is not optional: the form is
public and unauthenticated, and the bounces and spam complaints from single
opt-in would land on the same sending domain as the receipts, trial reminders
and payment-failure mail.

Abuse paths are closed in storage, not at the route:

* A confirmed address is never re-mailed, so the form cannot be pointed at a
  stranger as a mailbomb.
* An opt-out is a standing instruction. Resubmitting the address does not
  restart mail, and a confirmation link cannot be used after it.
* Confirm and unsubscribe tokens are namespaced, so a forwarded unsubscribe
  link cannot confirm a subscription nobody asked for.
* The endpoint answers **identically** for every outcome — new, pending,
  already confirmed, opted out, malformed, honeypot, even a storage error.
  Any variation would make it an oracle for whether an address reads this site.

## Why not a user row

A levels subscriber is not a `users` row and carries no tier. Two reasons:

1. About twenty sites across billing and lifecycle email treat the literal
   string `tier='public'` as "not a paying customer", five of them cohort
   queries that would silently stop matching if signups landed on a new tier.
2. A `users` row minted by this form would fall straight into the
   verify-reminder, verified-never-paid and reactivation cohorts — so somebody
   who asked for a levels email would start receiving "finish verifying your
   account" and "try the trial". They never asked for an account.

A separate table means this feature cannot reach that machinery, and can be
removed without touching any of it.

## The image

The digest embeds `/embed/image/<SYMBOL>.png` — the public, free-tier levels
card the widget already serves. It is a Next `ImageResponse` route: no auth, no
token, no headless browser in the send path.

Deliberately **not** the Live Bulletin snapshot. `scripts/render-bulletin-png.mjs`
screenshots the same `GammaReportCard` the Basic-gated `/live-bulletin` page
renders, so mailing it daily would give away free exactly what the last line of
the email asks the reader to buy — and would put Playwright and
`BULLETIN_SNAPSHOT_TOKEN` into a cron that must never fail.

Everything the image shows is repeated as text beneath it, because most clients
block images by default and Gmail proxies the rest.

## Environment

Read from `frontend/.env.local` or the process env:

| Var | Required | Note |
| --- | --- | --- |
| `ZEROGEX_API_TOKEN` | yes | Reads the levels. Script refuses to start without it. |
| `ZEROGEX_END_USER_TOKEN_SECRET` | yes | Signs confirm + unsubscribe links. Refuses to start without it — mail nobody can opt out of is worse than no mail. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | to send | Checked before anything else happens. |
| `NEXT_PUBLIC_APP_URL` | yes | Link and image base. |
| `NEXT_PUBLIC_NYSE_HOLIDAYS` | recommended | Unset degrades guard 1 to weekends-only. |
| `AUTH_DB_PATH` | yes | Also mirrored into the unit's `ReadWritePaths` by the deploy step. |

## Operating

```bash
systemctl list-timers zerogex-web-daily-levels.timer   # next / last run
journalctl -u zerogex-web-daily-levels -n 80           # what the last run did
sudo systemctl start zerogex-web-daily-levels.service  # fire the real send now
```

A failed run routes to the standard `zerogex-web-alert@` unit.

`Persistent=false` on this timer is load-bearing and unlike every other timer
in `deploy/systemd`. A missed morning is skipped, never replayed. Do not
"fix" it for consistency.

## Counts

```bash
sqlite3 /var/lib/zerogex/auth.db \
  "SELECT symbol, COUNT(*) FROM levels_subscribers
    WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
    GROUP BY symbol ORDER BY 2 DESC;"
```

The `DRY_RUN=1` preamble prints the same split, plus pending and unsubscribed.

## Telemetry

`levels_email_submitted` fires on submit, never on confirmation — the endpoint
cannot tell the browser what happened, so the event must not pretend to.
Confirmed counts come from the database. **The gap between the two is the
double opt-in drop-off, which is the number worth watching.**
`levels_email_rejected` splits by `reason` (`invalid` / `rate_limited`).
