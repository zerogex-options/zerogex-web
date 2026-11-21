# Sanjay Khemka: Pro API history for an ES backtest, and a Pro trial that shows Public (2026-11-21)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

> **Status (2026-11-21):** trial extended to 2026-11-29, Pro granted by hand
> (diagnose-user reads `pro`), and the code fix
> (`claude/no-card-trial-card-add-lockout`) is deployed, so his next sync keeps
> Pro. Both replies final; send Reply A, then the API answers. Flow
> 5-minute history (`flow_series_5min`, SPX) starts 2026-05-13.

## Thread so far

1. **Inbound, to support.** Sanjay is evaluating the Pro API to build an
   automated intraday ES momentum system. He wants historical and real-time
   data to backtest indicators for large intraday ES moves, and asks:
   1. Historical intraday Flow Analysis (net contracts, premium, call/put
      flow) at 1- or 5-minute bars, and how far back.
   2. Historical Gamma Shift data, including regime changes and net gamma
      shift.
   3. Historical 0DTE GEX by strike, with gamma flip, call/put walls and net
      GEX.
   4. Forecast Receipt data (expected range, volatility, key levels, touch
      probabilities).
   5. Update frequency and timestamps for all of the above.

## The read

- **Yes to all four, and lead with that.** Everything he names is in the API
  on a Pro key. The real answer is in the history depth, which differs by
  dataset, so give it per item.
- **The 60-day window is the thing he most needs to know.** One-minute flow
  and per-strike (0DTE) GEX are only kept about 60 days, on a rolling basis.
  For a backtester, "start saving it now" is the most useful sentence in the
  mail: every day he waits, a day of that data is gone for good.
- **Tell him ES is SPX, once, up front.** It answers a question he hasn't
  asked yet (why do the levels freeze overnight?) and tells him he can pass
  `symbol=ES` everywhere he needs.
- **Steer him off the live Gamma Shift card.** The card on the page
  (`/api/gex/regime-shift`) only compares "now" against an earlier point. It
  can't be pointed at a past time. The series is what he wants.
- **Give him the two backtest traps.** Same as Val's reply: bar-start stamps
  carrying the bar's last value (look-ahead), and empty flips. Both fail
  silently.
- **No pricing.** He didn't ask.

## Verified

Read from the code on `release`, 2026-11-21. zerogex-oa paths unless noted.

**Access**

- **A Pro key reaches all of it.** Website keys are minted with no scopes
  (`frontend/app/api/account/api-keys/route.ts` sends none; zerogex-oa
  `src/api/routers/admin_api_keys.py`), and scope enforcement is off by
  default (`API_SCOPE_ENFORCEMENT`, `src/api/security.py`). Forecast sits
  under the `signals` scope (`src/api/main.py`, `include_router(forecast_router
  ...)`), which the Pro help page lists as included
  (`frontend/content/help/platform/api-access.md`).
- **ES works on every endpoint in the draft.** `/api/flow/series`,
  `/api/flow/by-strike`, `/api/gex/*` (regime-series, historical),
  `/api/replay/` and `/api/forecast` are all on the futures projection
  allowlist (`src/api/futures_middleware.py`, `_PROJECTABLE_PREFIXES`).
  Historical series are projected per row on their own session's basis (API
  guide, "ES / NQ and the basis a response is projected on").
- **Levels only change 9:30 to 16:00 ET for ES.** They come from SPX, which
  prints only in the cash session (API guide, "Cash indexes owe nothing
  outside 09:30–16:00 ET"; help page `data-coverage.md`).

**Retention** (`Makefile`, `DB_MAINTAIN_TABLES` and the notes above it;
production runs `DATA_RETENTION_DAYS=60`, `.env.example`)

- Pruned at 60 days: `option_chains`, `gex_by_strike`, `flow_contract_facts`,
  `flow_by_contract`, `flow_smart_money`, `trade_signals`.
- Kept forever: `gex_summary`, `underlying_quotes`, `hedging_flow_5min`,
  `gamma_regime_5min`, `flow_series_5min`, `daily_forecast`,
  `option_chains_archive`.

**1. Flow**

- `/api/flow/series`: session-cumulative call/put premium, call/put volume,
  net volume (calls bought minus sold, less puts bought minus sold), net
  premium, put/call ratio. `timeframe=5min|1min`, `date=YYYY-MM-DD`,
  `strikes`, `expirations`. `/api/flow/sessions` lists days (up to 60).
  `/api/flow/by-strike`: calls and puts bought and sold per strike per bar.
- **1-minute bars** always run the live query on `flow_contract_facts`
  (`src/api/database.py`, `_get_flow_series_1min`), so they reach back only
  60 days.
- **5-minute bars** read the kept-forever `flow_series_5min` snapshot ONLY
  when `FLOW_SERIES_USE_SNAPSHOT` is on (default off, `database.py` ~line
  980) and no strike/expiration filter is passed. Otherwise they run the
  query on `flow_by_contract`, which is pruned at 60 days. Whether production
  has it on isn't knowable from here. The draft says 60 days for everything
  until you check (see below).

**2. Gamma Shift**

- `/api/gex/regime-series` takes `date=YYYY-MM-DD` (`src/api/main.py`
  ~line 2158; the API guide's entry omits `date`, a doc gap that can wait).
  Reads `gamma_regime_5min`, retention-exempt, 5-minute bars. Per bar:
  `anchored_*` (versus the session's first bar) and `rolling_*` (versus a few
  bars back) for `stability` and `lean`, plus `gamma_flip`, flip distance,
  `cushion_state` (`SECURE` / `NORMAL` / `THIN` / `CROSSING` / `NO_FLIP`).
- `/api/gex/regime-history`: one stored regime read per session, `limit` up
  to 180 (`src/api/routers/gamma_shift.py`).
- `/api/gex/regime-shift` (the card the Gamma Shift page shows,
  `frontend/hooks/useRegimeShift.ts`) always diffs the current snapshot
  against a lookback. No timestamp parameter.

**3. 0DTE GEX by strike**

- `/api/replay/range?symbol=&date=&expirations=0dte`: every minute of the
  session (the `timeframe` parameter is accepted but ignored, always 1-minute
  frames), per-strike `call_gex`, `put_gex`, `net_gex`, with walls, flip and
  max pain re-derived from the scoped strikes. `strike_band_pct` default 4%,
  max 10% (`src/api/routers/replay.py`). Built from `gex_by_strike`, so 60
  days. A one-date scope reads the same before and after the November
  per-strike fix (API guide, Replay).
- `/api/gex/historical`: whole-chain `gamma_flip`, `call_wall`, `put_wall`,
  `net_gex`, `max_pain` per bar, `1min|5min|15min|1hr|1day`, 90 rows per
  request, from `gex_summary`. Starts June 29, 2026 for SPX, so for ES
  (published in `data-coverage.md`, "Historical depth").

**4. Forecast**

- `/api/forecast/{date}?symbol=` returns `morning` and `receipt`
  (`src/api/routers/forecast.py`, `_shape_row`). Morning: `projected_low`,
  `projected_high`, `projected_close`, `implied_move`, `expected_vol_state`,
  `expected_vol_ratio`, `gamma_flip`, `call_wall`, `put_wall`, `regime`,
  `flip_cross_prob`, `level_touch_probs` (`{"call_wall": p, "put_wall": p}`,
  `setup/database/schema.sql`). Receipt: `actual_low/high/close`,
  `range_respected`, `realized_vol_ratio`, `vol_state_correct`,
  `flip_crossed`, `level_touch_outcomes`, `levels_brier`.
- Also `/api/forecast/available-dates` (limit up to 365) and
  `/api/forecast/history/recent` (up to 180).
- **Times:** morning writer 08:30 ET Mon to Fri
  (`setup/systemd/zerogex-oa-forecast-writer.timer`; the code comments that
  still say 07:00 are stale), receipt 16:05 ET
  (`zerogex-oa-forecast-receipt.timer`).
- **Vol grading changed 2026-08-04** (`_DEFAULT_VOL_SCALE_FIX_DATE` in
  `forecast.py`). Before it, `vol_state_correct` measured a scale bug, so
  grades before that date aren't comparable.

**5. Cadence and timestamps**

- API guide, "Cadence profiles": GEX and levels 60 s, `/api/flow/*` 5-minute
  bars (1-minute on request), forecast once per session. Timestamps are
  ISO 8601 UTC (`api-access.md`). v2 adds the freshness envelope.
- `/api/gex/historical` rows are "stamped at the bar's start and carrying
  its last snapshot" (API guide). Flow rows carry `bar_start` and `bar_end`,
  with totals through the end of the bar.
- `gamma_flip` is null when the book has no honest crossing near spot
  (`src/api/models.py`, `GEXSummary`).

## Fill in before sending

> **Done 2026-11-21.** `DATA_RETENTION_DAYS=60`, `FLOW_SERIES_USE_SNAPSHOT=true`.
> Gamma Shift from 2026-09-09; forecasts from 2026-07-06, touch odds from
> 2026-07-15 (SPX). Both dates are in the draft. Still open, optional: the
> `flow_series_5min` query below. The draft says 60 days for flow, which is
> safe; if the query shows an earlier date, add the "exception" sentence.

On the EC2 box, from the `zerogex-oa` directory:

```bash
grep -E "DATA_RETENTION_DAYS|FLOW_SERIES_USE_SNAPSHOT" .env
make psql
```

Then in psql:

```sql
-- [GAMMA SHIFT START]: first day of the Gamma Shift series
SELECT MIN(bar_start AT TIME ZONE 'America/New_York')::date
FROM gamma_regime_5min WHERE symbol = 'SPX';

-- [FORECAST START]: first forecast, and first with touch odds
SELECT MIN(date) AS first_forecast,
       MIN(date) FILTER (WHERE level_touch_probs IS NOT NULL) AS first_touch_odds
FROM daily_forecast WHERE symbol = 'SPX';

-- Only matters if FLOW_SERIES_USE_SNAPSHOT=true above
SELECT MIN(bar_start AT TIME ZONE 'America/New_York')::date
FROM flow_series_5min WHERE symbol = 'SPX';
```

- Put the first query's date into `[GAMMA SHIFT START]`.
- Put `first_forecast` into `[FORECAST START]`. If `first_touch_odds` is a
  later date, change that sentence to: "It goes back to [first_forecast];
  the touch odds start on [first_touch_odds]."
- **If `DATA_RETENTION_DAYS` isn't 60**, change every "60 days" in the draft
  to the real number.
- **If `FLOW_SERIES_USE_SNAPSHOT=true` and the third query is more than 60
  days ago**, add this after the "How far back" sentence in section 1: "The
  exception is 5-minute bars across all strikes and expirations, which are
  kept permanently and go back to [that date]." Otherwise leave section 1 as
  it is.
- If any query returns nothing for SPX, try `symbol = 'ES'`.

## Draft

Reply in the same thread.

Hi Sanjay,

Thanks for the clear questions. Short answer: yes to all four. How far back each one goes differs, and some of it only reaches back about 60 days, so I've given that per item. Endpoint names match the docs at https://api.zerogex.io/docs, and they all work with a Pro API key.

One note first, since you're working with ES. Our ES levels come from the SPX options book (ES and SPX track the same index), converted onto the ES price. Pass symbol=ES and everything comes back on the futures price already. Historical rows are each converted at their own day's ratio, so a long backtest doesn't drift across contract rolls. The options-based numbers only change during the cash session, 9:30 AM to 4:00 PM ET, so overnight ES trades against the levels as they stood at the close.

**1. Flow Analysis**

Yes. /api/flow/series returns net contracts, call and put premium, call and put volume, net premium and the put/call ratio, in 1-minute or 5-minute bars (timeframe=1min or 5min). Values are running totals for the session, so the change from one bar to the next is that bar's flow. Add date=YYYY-MM-DD for a past day; /api/flow/sessions lists the days available. /api/flow/by-strike breaks the same flow down by strike (calls and puts bought and sold), and both take an expirations filter if you want 0DTE only.

How far back: about the last 60 days. That window moves forward every day, so if you want a longer history, start saving it on your side now. The exception is 5-minute bars across all strikes and expirations, which are kept permanently and go back to May 13, 2026.

**2. Gamma Shift**

Yes, as a series. /api/gex/regime-series gives the Gamma Shift read at every 5-minute bar of a session: stability (whether dealers are damping moves or adding to them) and lean (whether the change is supportive or capping), each measured against the session open and against a few bars earlier. Each bar also carries the gamma flip and how much room price has before crossing it, labeled secure, normal, thin or crossing. Add date=YYYY-MM-DD for a past day. This history is kept permanently and goes back to September 9, 2026.

/api/gex/regime-history gives one regime read per session, up to 180 sessions per request. The card at the top of the Gamma Shift page (/api/gex/regime-shift) only compares the present moment with an earlier one, so it can't be pointed at a past time. For backtesting, use the series.

**3. 0DTE GEX by strike**

Yes, for about the last 60 days. /api/replay/range?symbol=ES&date=YYYY-MM-DD&expirations=0dte returns every minute of a session with call, put and net GEX at each strike for that day's expiration only, plus the call wall, put wall, gamma flip and max pain recalculated from those 0DTE options alone. It covers strikes within 4% of price by default (strike_band_pct goes up to 10%). Per-strike data is kept on the same rolling 60-day window as the flow.

For the whole options book (all expirations), /api/gex/historical has the gamma flip, call wall, put wall, net GEX and max pain in 1-minute, 5-minute, 15-minute, hourly or daily bars. That history is kept permanently and starts on June 29, 2026. It returns up to 90 bars per request, so page back with start_date and end_date.

**4. Forecast Receipt**

Yes. /api/forecast/{date}?symbol=ES returns that day's morning forecast and, after the close, its receipt. The forecast is written at 8:30 AM ET: projected low, high and close, the implied move, the expected volatility, the gamma flip and walls, the odds of touching the call wall and the put wall, and the odds of crossing the flip. The receipt is added at 4:05 PM ET: the actual low, high and close, whether price stayed in the range, realized versus implied volatility, whether the flip was crossed, and which walls were touched. /api/forecast/available-dates lists the days, and /api/forecast/history/recent gives a compact row per day. It goes back to July 6, 2026, and the touch odds start on July 15, 2026. If you test the volatility call, start from August 4, 2026, when we corrected how it's graded; earlier grades aren't comparable.

**5. Update frequency and timestamps**

- GEX, walls, flip and per-strike GEX: recalculated about once a minute during the cash session.
- Flow: 1-minute and 5-minute bars.
- Gamma Shift series: 5-minute bars.
- Forecast: once a day, at 8:30 AM ET, with the receipt at 4:05 PM ET.

Every row carries a timestamp in ISO 8601, UTC. For live polling, use the v2 paths (/api/v2/...): each response adds a freshness block with when the data was observed, its age, and whether it's fresh or stale, so your system can tell a stalled feed from a closed market. It's a request-and-response API rather than a stream, and polling every few seconds is fine.

Two things that will save you a headache in the backtest:

1. Bars are stamped at their start but carry the value as of their end. Line each row up with the bar that closes at the end of it. Otherwise your backtest sees a few minutes into the future and will look better than it should.
2. Some bars have no gamma flip (the value is empty). That happens when the options book doesn't cross zero near price, so there's no honest level to give. Skip those bars rather than treating them as zero.

If you tell me which of these you plan to rely on most, I can suggest bar sizes and the order to download them in, so nothing ages out before you've saved it.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He wants an intraday forecast, not a daily one.** The intraday cone
  (`/api/cone/session/{date}`, `/api/cone/latest`) re-forecasts the range
  every 15 minutes from 9:45 AM to 3:30 PM ET and grades each claim
  (`src/jobs/intraday_cone_writer.py`; `/api/cone/reliability` is its track
  record). **SPX only through the API:** `/api/cone` is not on the futures
  projection allowlist, so `symbol=ES` answers 400. He'd use SPX and convert
  himself, or you'd add the prefix after auditing its fields.
- **He asks for dealer hedging flow.** `/api/flow/hedging` (estimated hedge
  pressure, 1- or 5-minute bars, 5-minute kept forever) is also
  **not** on the ES allowlist, so it's SPX only. Its `disclosure` field must
  travel with it: it's estimated from trade sides, not observed dealer flow.
- **He wants per-strike or 1-minute flow older than 60 days.** It's gone;
  nothing can rebuild it. Don't promise a backfill.
- **He asks why `/api/replay/range` ignores `timeframe=5min`.** It always
  returns 1-minute frames today. He can downsample on his side.
- **He gets `429 Too Many Requests` while backfilling.** He's paging too
  fast. Slow the loop and honor the `Retry-After` header.
- **He asks which flip to use.** `gamma_flip` is the one the site and
  integrations draw. `gamma_flip_raw` is the nearest zero crossing, which
  other dashboards publish and which often sits much closer to price.
- **He asks for a price or a trial.** Check the current pricing page before
  quoting; prices changed in October (`docs/pricing-october-2026-runbook.md`).

---

# Account shows Public (second inbound, 2026-11-21 09:36)

Sanjay Khemka, separate email. He "upgraded to the ZeroGEX Pro trial". The
billing portal shows the Pro trial active with the first charge on
**November 22** (tomorrow). The app shows him as **Public**. Paid pages
redirect to "Your account is still here" with **Resubscribe to Basic**, and he
can't reach the dashboard. Same in an incognito window.

## The read

- **Stripe has him on a Pro trial; our users row has him on `public`.** The
  site reads the tier from the row on every request, so nothing on his side
  (cache, incognito, signing out) will change it.
- **The screen he sees tells us more than "Public" does.** "Your account is
  still here" is the returning-member screen. It only shows when the row has
  `paid_welcome_email_sent_at` set or `subscription_lapsed = 1`. The welcome
  is only stamped when a sync actually grants a paid tier. So he was most
  likely granted access at some point, and a later sync took it away. "I
  upgraded to the Pro trial" suggests a Basic trial switched to Pro in-app.
  The cause isn't knowable from code alone; `make diagnose-user` will show it.
- **Fix it today.** His trial converts tomorrow. Charging him for a trial he
  couldn't use is the outcome to avoid.
- **Extend the trial a week.** It's the fair make-good, and it does double
  duty: pushing `trial_end` makes Stripe send a fresh
  `customer.subscription.updated`, and the webhook re-syncs his row from the
  subscription's current state.
- **Don't use "Resend" on the old event in the Stripe dashboard.** It does
  nothing: the webhook records every event id and drops a repeat as a
  duplicate (`app/api/webhooks/stripe/route.ts`, the
  `stripe_webhook_events` INSERT OR IGNORE). A fresh event is needed, which
  the trial extension produces.
- **Don't flip the tier by hand with `update-user-tier`.** The next sync
  recomputes the tier from Stripe and would undo it, and if the cause is an
  unconfirmed card it would grant Pro on exactly the card the gate is there
  to catch.

## Verified

Read from the code on `release`, 2026-11-21. All `frontend/` paths.

- **Returning screen:** `app/unauthorized/page.tsx` shows it when
  `resolveWall` returns `returning`, which needs `hasPriorPaid === true`
  (`core/returningMember.ts`). `hasPriorPaid` is
  `paid_welcome_email_sent_at != null || subscription_lapsed === 1`
  (`core/serverAuth.ts`). The button names Basic because the page he reached
  for (the dashboard) needs Basic.
- **The tier is read fresh on each request:** `proxy.ts` loads the session
  from the database, joined to `users.tier`. A reload picks up a fix.
- **What sets the tier:** `syncSubscriptionToUser` in the webhook route. A
  `trialing` subscription grants its tier only when its pending SetupIntent
  has succeeded; otherwise it writes `public` and logs
  `billing_trial_setup_pending`. `active` always grants. A paused
  subscription grants nothing.
- **The welcome stamp follows the grant:** `maybeSendPaidWelcomeEmail` runs
  only when `grantsTier` is true, so a set `paid_welcome_email_sent_at` means
  some sync did grant a paid tier.
- **A deletion of some other subscription can't cause this:**
  `clearSubscriptionFromUser` changes nothing when the row has moved on to a
  different subscription (`stripe_subscription_deleted_superseded`).
- **The extension re-syncs:** `scripts/extend-trial.mts` pushes `trial_end`
  on the live subscription; Stripe emits `customer.subscription.updated`, and
  the webhook mirrors it. It only touches subscriptions Stripe reports as
  `trialing`.
- **A re-added card re-syncs too:** `setup_intent.succeeded` re-reads the live
  subscription and runs the same sync, so if his card was never confirmed,
  re-entering it in the billing portal grants Pro within a minute.

## Fix steps

All on the EC2 box, from `~/zerogex-web`. Use his address from the email in
place of `<email>`.

1. **See what's on the row** (read-only):

   ```bash
   make diagnose-user EMAIL=<email>
   ```

   Note: Tier, Subscription status, the price (should be Pro), "Paid welcome
   sent", "Subscription lapsed", and the audit events at the bottom. Look for
   `billing_trial_setup_pending`, `billing_plan_switch_in_app`,
   `stripe_webhook_stale_skipped` and `stripe_webhook_orphan`.

   - If Stripe shows **no `trialing` subscription** for him, or his row has
     no subscription id, stop and send me the output. The steps below won't
     apply.

2. **Extend the trial a week, which also re-syncs him:**

   ```bash
   make extend-trial EMAIL=<email> EXTEND_DAYS=7 DRY_RUN=1
   make extend-trial EMAIL=<email> EXTEND_DAYS=7 YES=1
   ```

   The dry run should show the new trial end as about November 29. If it
   doesn't, use `TRIAL_END=` with the date you want instead of `EXTEND_DAYS`.

3. **Wait a minute, then check again:**

   ```bash
   make diagnose-user EMAIL=<email>
   ```

   - **Tier reads `pro`:** fixed. Send Reply A.
   - **Still `public`, with a new `billing_trial_setup_pending` row:** his
     card was never confirmed for the trial. Send Reply B.
   - **Still `public`, anything else:** send me both outputs before replying.

4. **Is anyone else stuck the same way?** Read-only:

   ```bash
   sqlite3 /var/lib/zerogex/auth.db "SELECT email, tier, subscription_status, stripe_price_id, current_period_end, paid_welcome_email_sent_at, subscription_lapsed FROM users WHERE subscription_status IN ('trialing','active') AND tier = 'public' AND paused_until IS NULL AND deleted_at IS NULL;"
   ```

   Rows with `trialing` and no confirmed card are expected (the gate working).
   An `active` row, or a `trialing` row that has a paid-welcome date, is the
   same problem as Sanjay's.

5. **Send me the step 1 output.** It shows what took his access away. If a
   sync revoked a granted trial, that's a bug that can hit any trial member
   who switches plans, and it needs a code fix. That part can wait until he's
   sorted.

## Second pass: what `diagnose-user` showed (2026-11-21)

The first-pass plan above assumed a re-sync would grant him or show an
unconfirmed card. Neither holds. The first-pass Reply A and Reply B are
retired; use the reply below.

**Timeline** (audit events, UTC):

- **Nov 15 12:44** no-card trial on **Basic** (`no_card_trial=1`). Synced
  `tier=basic`, paid welcome sent. That's why he sees the returning-member
  screen.
- **Nov 21 13:11** tries Basic to Pro twice: `billing_plan_switch_needs_card`.
  Sent to the billing portal to add a card.
- **13:15:16** card added (Visa 7541): `no_card_trial_card_added`, sync
  `tier=basic`. That event only comes from `setup_intent.succeeded`, so **his
  card was confirmed.**
- **13:15:17.5** another sync: `tier=public`,
  `billing_trial_setup_pending`.
- **13:15:17.6** `billing_default_pm_wired [subscription] [customer]`: our
  webhook set the card as the subscription's default.
- **13:15:26** in-app upgrade to Pro, sync `tier=public` again.
- **Later** the trial extension's re-sync also left him `public` (the
  stuck-trials query run right after still lists him).

**Likely cause (confirm with step 1 below):** `maybeWireDefaultPaymentMethod`
in `app/api/webhooks/stripe/route.ts` calls
`subscriptions.update(sub, { default_payment_method })` when the subscription
has no default, which is always true for a no-card trial. Stripe documents
that updating a subscription's payment method can attach a new
`pending_setup_intent` to it. Nobody confirms that one, so every later sync
sees a pending SetupIntent that hasn't succeeded and writes `public`.

- **Re-entering his card won't fix it.** `setup_intent.succeeded` re-reads
  the live subscription, which still carries the stuck SetupIntent.
- **Who else it hits:** every no-card trial member who adds a card in the
  portal mid-trial drops to Public until the trial converts. Card-at-checkout
  trials aren't affected; Checkout sets the subscription's default itself.
  Right now he's the only member stuck (the step 4 query returned one row).
- **The conversion still grants:** an `active` subscription skips the
  SetupIntent gate, so on Nov 29 a successful charge puts him on Pro by
  itself. The hand grant covers the week between.

## Second pass: steps

On the EC2 box, `cd ~/zerogex-web/frontend && source ~/.nvm/nvm.sh && nvm
use 22`, then:

1. **Confirm the cause** (read-only, prints two lines). Not run: the
   heredoc's closing `EOF` was indented, so the shell never saw it end. The
   fix doesn't depend on this output.

   ```bash
   node --input-type=module <<'EOF'
   import fs from "node:fs"; import Stripe from "stripe";
   const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY);
   const sub = await stripe.subscriptions.retrieve("sub_1Uc2nH4AOiqteMYYNAsvZd15", { expand: ["pending_setup_intent"] });
   const si = sub.pending_setup_intent;
   console.log("status:", sub.status, "| trial_end:", new Date(sub.trial_end * 1000).toISOString(), "| default_pm:", sub.default_payment_method);
   console.log("pending_setup_intent:", si ? `${si.id} status=${si.status} pm=${si.payment_method} created=${new Date(si.created * 1000).toISOString()} next_action=${si.next_action?.type ?? "-"} error=${si.last_setup_error?.code ?? "-"}` : "none");
   EOF
   ```

   Expected: `trialing`, trial end `2026-11-29T12:44:27`, and a
   `pending_setup_intent` created around `2026-11-21T13:15:17` with a status
   other than `succeeded`. Send the output to Claude either way; it decides
   the code fix.

2. **Give him Pro by hand:**

   ```bash
   node --no-warnings scripts/update-user-tier.mjs --email sanjaykhemka46@gmail.com --tier pro --dry-run
   node --no-warnings scripts/update-user-tier.mjs --email sanjaykhemka46@gmail.com --tier pro
   ```

   The dry run should say `public -> pro`.

3. **Check:** `cd ~/zerogex-web && make diagnose-user
   EMAIL=sanjaykhemka46@gmail.com`. Tier should read `pro`.

4. **Send Reply A** (below), then the API reply.

**The hand grant can be undone by the next sync** until the code fix ships.
Nothing is scheduled to sync him before Nov 29, but if he changes anything in
billing (portal or plan switch), he drops back to Public and his API key is
revoked (`maybeRevokeApiKeysOnTierDrop`). If he writes again, re-run step 2;
he'll need to generate a new key.

## Reply A: access restored

Reply in his "Pro trial shows Public" thread.

Hi Sanjay,

Thanks for letting me know, and sorry about this. It was a bug on our side: when you added your card to upgrade, our system wrongly treated the card as unverified and dropped your account to free access, even though billing had your Pro trial set up correctly.

It's fixed. Reload the page and you'll have full Pro access, including Account → API Access, where you can generate your API key.

Since this ate into your trial, I've extended it by a week. Your first charge moves from November 22 to November 29, and you can still cancel any time before then at no cost.

I'll answer your API questions in your other email shortly.

Best,
Michael
Founder, ZeroGEX

## If he replies

- **He's back on Public, or his API key stopped working.** A sync undid the
  hand grant (see above). Re-run step 2 and tell him to generate a new key.
- **He asks for more than the week.** Your call. The week covers the trial he
  lost.
- **He was charged on Nov 22 anyway.** Only possible if the extension didn't
  take; step 1's `trial_end` shows. Refund it.

---

# Third inbound: he'll start with Gamma Shift and Flow (2026-11-21, 2:22 PM)

Both earlier replies sent. He thanks us and says his first model will lean
on the Gamma Shift series and Flow Analysis. The API reply offered bar sizes
and a download order for what he picked, so this answers that.

## Verified

zerogex-oa `release`, 2026-11-21.

- **Gamma Shift series:** 5-minute bars only, from `gamma_regime_5min`,
  retention-exempt, starts 2026-09-09 (SPX; ES is projected from it).
- **Flow, 5-minute, unfiltered:** served from `flow_series_5min`
  (`FLOW_SERIES_USE_SNAPSHOT=true` on the box), kept forever, starts
  2026-05-13.
- **Ages out at 60 days:** 1-minute flow (`flow_contract_facts`, every call
  recomputes), 5-minute flow with a `strikes` or `expirations` filter (query
  on `flow_by_contract`), `/api/flow/by-strike` and `/api/flow/centroids`
  (`flow_contract_facts`).
- **`/api/flow/sessions` only lists days inside the 60-day window** (reads
  `flow_by_contract`). A dated flow or regime read for a day with nothing
  stored returns an empty list, not an error.
- **Session windows:** flow runs 9:30 to 16:15 ET, so a day's flow is final
  shortly after 16:15.

## Reply

Hi Sanjay,

Glad it helped. For those two, here's how I'd set it up.

Use 5-minute bars for both. The Gamma Shift series only comes in 5-minute bars, and 5-minute flow lines up with it bar for bar, so you can join the two on the bar start time.

Nothing you need is at risk of disappearing. Both are kept permanently: the Gamma Shift series goes back to September 9, 2026, and 5-minute flow across all strikes and expirations goes back to May 13, 2026. So your combined history starts on September 9, and you can download it at your own pace. Request one session at a time with date=YYYY-MM-DD; each call returns the whole day. /api/flow/sessions only lists about the last 60 days, so for older dates, step through the trading days yourself. A day with no data comes back as an empty list rather than an error.

What does age out after about 60 days is 1-minute flow and any flow filtered by strike or expiration, including 0DTE only and /api/flow/by-strike. If you think you'll want any of that later, start saving it now with a daily job that runs after 4:30 PM ET, when the day's flow is final.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
