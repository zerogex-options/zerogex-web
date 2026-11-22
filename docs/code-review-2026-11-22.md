# ZeroGEX Website Audit — 2026-11-22

Scope: `zerogex-web` at `release` `60d60f3`, reviewed as both a software
engineer (security, billing correctness, reliability, performance) and a
quantitative analyst (do the tools show true numbers). The backend review is in
`zerogex-oa/docs/CODE_REVIEW_2026-11-22.md`.

All fixes are on branch `claude/gifted-noether-uje8y8`, one commit per finding,
each with a test or a harness run that fails on the old code. Each commit
message has the full reasoning; this document is the index.

---

## Deploy notes

**No auth database changes.** No new tables or columns.

**One thing to confirm on the box.** Sign-in rate limits now trust the address
nginx puts in `X-Real-IP`, which is the visitor's real address only while the
Cloudflare real-IP config is installed (it has been since the 503 fix). Check
that it exists and is not empty:

```bash
test -s /etc/nginx/conf.d/zerogex-realip.conf && echo ok || echo MISSING
```

**What will look different after the deploy (all intended):**

- Any `/api/...` path containing `%` gets a 400. No page builds one.
- Following a TradeWorkz bot and the follow feed are Pro; unfollowing stays
  open to every tier. The Spread Monitor API is Basic.
- TradeWorkz trade emails go only to verified Pro members; anyone else's queued
  emails are skipped with the reason recorded on the row.
- A paused member who tries to switch plans gets a 409 asking them to resume
  first.
- The per-address sign-in limit counts failed attempts only, and a new cap of
  10 failures per account per 10 minutes applies from any address.
- The GEX heatmap refreshes its surface every 10 seconds instead of every
  second (the live price still updates every second).

**After the deploy (optional, informational):** how many deleted accounts were
sent the reactivation email before this fix:

```bash
sqlite3 /var/lib/zerogex/auth.db "SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL AND reactivation_email_sent_at > deleted_at;"
```

---

## Fixed

### Security

**S1. Account pre-hijack through Google/Apple sign-in** — `4088b19`
Registration signs a member in before they verify the address, and a Google or
Apple sign-in adopted the account with that address without asking whether it
was ever verified. Anyone could register a member's address first with their
own password and keep a way in after the real owner signed in with Google and
subscribed. Adopting an unverified account now clears its password, sessions
and linked sign-ins first. Apple's "email not verified" flag, which the
callback used to drop, is now honored.

**S2. Three ways to read paid data for free** — `3710543`
- A percent-escape in the path (`/api/market/%68istorical`) matched no tier
  rule, and the gate is fail-open, while the backend decoded and served it.
  Every paid endpoint was readable this way. Paths with `%` are now refused.
- Following a bot, and the follow feed, were open to every tier, which is the
  TradeWorkz product itself. They are Pro now; unfollowing stays open.
- `/api/market/spreads/*` matched no rule, so anonymous callers read a Basic
  page's live data.

**S3. Sign-in limits could be skipped or reset** — `ffd85d8`
The client address came from the first `X-Forwarded-For` entry, which the
visitor chooses, so a script rotating it skipped every per-address limit (login,
password reset, signup) and wrote any address into the audit log. A successful
sign-in to one's own account also reset the counter for that address. Now the
address comes from `X-Real-IP`, only failures count, and a per-account cap
holds whatever address the guesses come from. Password checks no longer block
the server for ~40 ms each, and unknown addresses are checked against a decoy
hash so response time doesn't reveal which addresses are members.

### Billing

**B1. A late Stripe "incomplete" event dropped a paying member to Public** — `194626b`
Checkout fires three events in the same second. When the "created
(incomplete)" one arrived last, the member was set to Public and their Pro API
keys revoked, with nothing to restore them until the next renewal. Stripe never
moves a subscription back to incomplete, so that snapshot is now ignored for a
subscription that already started.

**B2. Referral reward paid before the referee's card was charged** — `fc9a9ec`
Stripe moves a trial to active about an hour before it charges, so every
referred trial earned the referrer a $59 credit, declines included, which made
a prepaid-card self-referral farm free. The reward now waits for a paid invoice.

**B3. A paused plan could be switched, voiding the new plan's invoice** — `c6d470c`
A paused trialer who picked Pro annual got an invoice that the pause voided, so
Resume would have given a year of Pro free. Paused plans must be resumed before
switching.

**B4. Pauses from the 29th-31st ran long** — `9d4b0b1`
A one-month pause from Jan 31 resumed on Mar 3, which for a member billed on
the 1st voided two renewals. It now ends on the last day of a shorter month.

### Email

**E1. TradeWorkz trade alerts went to churned and deleted accounts** — `96a793b`
A follow outlives the plan that made it, so members who dropped to Public, or
deleted their account and could no longer unfollow, kept getting every alert.

**E2. Reactivation email went to deleted accounts** — `c84b60b`
"I extended your free trial to 30 days" reached accounts that can no longer
sign in. Deleting an account is also the marketing opt-out.

**E3. Card-expiry warning went to members who already canceled** — `3ffed31`
"Your next renewal could be declined" when there is no renewal.

**E4. Trial reminders could be skipped** — `7ab2a0e`
The 48-hour reminder's window was exactly as wide as its timer cadence, so
timer jitter missed about 1 in 400 trials, and every trial ending during an
outage was charged with no reminder. Same for the day-2 nudge. Both windows now
reach back further; the sent-at markers prevent duplicates.

### Data and tools

**D1. Strategy Builder drew fake payoffs after a symbol switch** — `d3fa41b`
Strike and expiration picks survived a symbol change. A Long Call picked on SPY
and viewed on NVDA had no strike or quote and drew +$17k profit at every price.
Picks now reset per symbol, nothing is drawn until every leg has a quote, and
the curve bends exactly at the strikes (it used to smooth a butterfly's $420
peak down to $393).

**D2. Signal pages' 30-session record never loaded** — `42013f8`
There was no `/api/scorecard` proxy route, so every request got a 404.

**D3. GEX heatmap pulled 1-3 MB every second and rebuilt on every quote** — `0d4787c`
The surface changes once a minute. It now polls every 10 seconds, and the grid
rebuilds only when a bar or the surface changes, not on every quote (that was
70-150 ms of main-thread work per second on SPX/NDX).

### Deploy

**O1. `sudo ./deploy/deploy.sh` locked the app out of its own database** — `c9718b5`
The auth data directory was given to `$USER`, which is root under sudo, so the
app could not open `auth.db` after the restart. It now goes to the invoking
user.

---

## Deferred

Found and checked, not fixed in this pass.

### Medium

| ID | Finding | Why deferred |
|----|---------|--------------|
| B5 | The Stripe webhook records an event as processed before handling it, so a restart mid-handler (a deploy) loses that event on redelivery. | Fixing it safely means making every handler safe to run twice; worth its own change, tested with the billing harness. |
| B6 | Withheld-card trials keep the plan through trial end plus grace. | Needs a product decision on the grace period. |
| E5 | The trial reminder's engagement check is anchored on signup, not on the trial start. | Copy/targeting question; can wait. |
| E6 | Levels-email confirm and unsubscribe act on a GET, so a mail scanner opening the link can confirm or unsubscribe. | Needs a confirm page; can wait. |
| E7 | TradeWorkz emails have no List-Unsubscribe header, and a 429/5xx from the mail provider marks the email failed for good. | Delivery-policy change; can wait. |
| W1 | The Gamma Chart ignores the per-1-point GEX unit. | Display-only; needs the unit confirmed per endpoint. |
| W2 | The GEX profile and walls charts keep the previous symbol's strike window after a switch. | Display-only. |
| W3 | The Max Pain page searches all candles on every render, including pointer moves. | Performance only. |
| W4 | Polling never pauses in hidden tabs, and some 5-minute reloads never stop. | Load reduction; can wait. |
| W5 | Viewer-local times are shown next to ET data in a few charts. | Display-only. |

### Low

E8 operator alert emails print shell commands containing an unvalidated email
address (plausible) · E9 the levels digest goes out on a holiday missing from
the env list · E10 the return-intent digest embeds a real member's unsubscribe
link · E11 the TradeWorkz worker pages every minute while the backend is down ·
E12 renewal/plan-offer latch released if the audit insert throws · W6 a
websocket tick overwrites day volume with minute volume (only with
`NEXT_PUBLIC_ENABLE_WEBSOCKET`) · W7 Jade Lizard's default short call is deep in
the money · W8 the default expiration can be an expired 0DTE after the close ·
S4 a leftover OAuth link cookie can attach the next sign-in · S5 session
rotation can fail in-flight requests · S6 account enumeration through the
register message and forgot-password timing (login timing is fixed in S3) ·
B7 two checkout tabs can create two subscriptions · B8 a decline on the
checkout page triggers the dunning email · B9 (spring 2027) the founding-lifetime
sweep can remove the intro coupon early · M1 the news route caches an empty
result for 5 minutes when every feed fails.

---

## Verification

- Full test suite: 4,256 passed, 0 failed (release: 4,239 passed, 0 failed;
  the difference is the new tests).
- `tsc --noEmit` clean; ESLint on the changed files shows only the existing
  unused-variable warning in `GammaHeatmapCanvas.tsx`.
- The billing fixes were run through the real Stripe webhook route with a
  stubbed Stripe: the "created event arrives last" order now ends Pro/active
  with no keys revoked (on release: Public/incomplete, two revocations); a
  referral pays exactly once when the charge clears, and never on a decline.
