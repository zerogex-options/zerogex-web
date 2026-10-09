# Product Update Campaigns — Send Runbook

Campaigns are sent **directly, per-recipient, from the server** via Resend
(`emails.send`) with `scripts/send-product-update.mts`. Each campaign is registered
in that script's `CAMPAIGNS` map and selected with `--campaign`; the newest is the
default, so a bare invocation sends the current one.

Every message carries a per-recipient `{{UNSUB_URL}}` — a signed `/unsubscribe`
link in the body, and the same URL as a one-click `List-Unsubscribe` header
(RFC 8058; disable the header with `--no-list-unsubscribe`, not recommended).
Users who have opted out (`users.marketing_unsubscribed_at`) and accounts that
self-deleted (`users.deleted_at`) are excluded from every cohort.

---

## Current campaign: October 2026 (`--campaign 2026-10`, the default)

Covers what shipped in September (one Gamma Terminal, Spread Monitor, 0DTE on
the Daily Replay, Hedging Flow and Gamma Weather, the Intraday Cone and Track
Record, My Dashboard on the account, the phone rebuild), the first Folds of
Honor donation ($459 for Q3 2026, sent October 1), and the roadmap: single
stocks (most likely the Magnificent Seven first), licensed history for
backtesting, and a look at futures and indices outside the U.S.

| Audience | Who | Files | Subject |
|---|---|---|---|
| `subscribers` | Active + trialing customers (`subscription_status IN ('active','trialing')`) | `2026-10-product-update.html` / `.txt` | What's new at ZeroGEX, and our first Folds of Honor donation |
| `registrants` | Verified, never subscribed, signed up **since the August send**, logged in | `2026-10-product-update-registrants.html` / `.txt` | What's new at ZeroGEX this month |

**Idempotency key:** `product_update_2026_10`. Each successful send stamps
`audit_events(type='product_update_2026_10_sent')`, so a re-run (including after a
`--limit` test batch) skips anyone already emailed and an interrupted run resumes
cleanly.

**Subscribers have not had a campaign since July.** The August send went only to
registrants and cancelled members, so the subscriber copy also carries a short
"In case you missed it" list of the late-August features. Trialing members are
in this cohort, so the copy names Pro-only items as Pro.

**The subscriber copy pitches the referral program.** Its box only makes sense
while `REFERRAL_PROGRAM_ENABLED=1` in `frontend/.env.local` (the Account page
hides the Referrals panel otherwise). Check before sending, from `frontend/`:

```
grep '^REFERRAL_PROGRAM_ENABLED=' .env.local    # must print REFERRAL_PROGRAM_ENABLED=1
```

**There is no `cancelled` variant this time.** August swept the never-win-backed
backlog, so what that cohort holds now is mostly members who left in the last
few weeks, and the weekly automated win-back (`092.winback`) reaches each of them
about a month after they leave, with the dated highlights from
`winback-highlights.json`. A campaign would only pitch them the same discount
sooner. `--audience cancelled` on this campaign refuses with "no content".

## How the audiences and offers work

These apply to every campaign registered in the script.

### Why `registrants` no longer skips the already-nudged

July excluded anyone the automated ~2h onboarding nudge
(`scripts/send-verified-never-paid.mts`) had reached, to avoid a same-week
double-touch. That rule is wrong once the automation is in steady state: its
timer fires **every 2 hours** over a 2h–7d window, so it stamps
`verified_never_paid_email_sent_at` on essentially every verified signup within
hours of registration. A live August run with the exclusion returned **2
recipients against 146 skipped**.

So August and October keep them. The flag is per-campaign
(`CampaignSpec.excludeOnboardingNudged`), not deleted, so re-running
`--campaign 2026-07` still reproduces the cohort July actually sent to. The
dry-run reports the overlap either way — `Excluded:` when the campaign skips
them, `Second touch:` when it doesn't.

### The `registrants` audience grants the extended trial

The August and October emails tell registrants "your **extended free trial** is
still on the table" and their CTA is `/pricing?trial=1&reactivate=1`. That link is only a
*signal*: `/pricing` renders the longer number straight off the URL parameter,
but `app/api/billing/checkout/route.ts` re-derives the actual grant server-side
and gives the extended `REACTIVATION_TRIAL_DAYS` trial **only** when
`users.reactivation_email_sent_at` is set. So each successful `registrants` send
on a campaign flagged `grantsExtendedTrial` stamps that column. Two
consequences, both intended:

- the recipient actually gets the trial length the email promised, instead of
  seeing 30 days on `/pricing` and being charged by Stripe after 7, and
- the daily reactivation timer (`scripts/send-reactivation.mts`) will never
  pitch the same extended-trial offer to them a second time.

The flag lives per-campaign in `CAMPAIGNS` because it is a property of the copy:
July's registrant email linked to a bare `/pricing` and named no length, so it is
`grantsExtendedTrial: false`. Before sending, the script cross-checks the flag
against what the template actually links to and **refuses to run** if the two
disagree in either direction — a campaign cannot promise the offer without
claiming the latch, or claim the latch without promising the offer.

> The 2026-08 send went out before this was wired up, so its recipients were
> promised the extended trial without the stamp. Repair that batch with
> `make backfill-reactivation-entitlement DRY_RUN=1` and then `YES=1`. It also
> takes `EMAIL=<addr>` for honoring the offer for one member who writes in.
>
> Read the dry run's call-out lists before applying — a stamp cannot help any of
> them. **OWED AN EXTENSION** is anyone mid-trial on less than the promised
> length; their trial lives on the Stripe subscription, so the run prints a
> ready-to-paste `make extend-trial` line per account with the exact
> `EXTEND_DAYS`. Being mid-trial is not by itself a shortfall — someone the
> reactivation email had already reached started a full-length trial, and those
> are listed separately as **already on N days**, with a do-not-extend. The
> length is measured from the account's own `billing_checkout_started` audit row
> (when the trial began) to where `trial_end` sits now, because neither the
> users row nor Stripe records how long a trial is — only when it ends. That
> measures the trial as it stands TODAY, so an account you have already extended
> drops off the list by itself; deciding on the `trial=<n>d` the checkout row
> records instead would re-report it forever, and a second pass would push a
> 30-day trial to 53. **ALREADY CHARGED** converted off a short
> trial and was billed on day 7 having been told 30 — a refund or credit
> decision, by hand.
> Both lists are restricted to recipients of the *registrants* copy, so a
> churned member who resubscribed after the win-back email is not mistaken for
> one of them.

Write query strings in the HTML as `&amp;` (`?trial=1&amp;reactivate=1`). A raw
`&` is invalid in an attribute, and a mail client that sanitizes links can drop
the second parameter — which sends the reader to a pricing page showing the
standard trial. `npm run test:newsletter-offers` enforces this and the flag
cross-check.

### The `cancelled` audience needs a win-back coupon

The email's CTA is `/pricing?winback=1`, and `app/api/billing/checkout/route.ts`
only attaches the coupon when **both** `subscription_lapsed=1` **and**
`users.winback_email_sent_at` is set. So each successful `cancelled` send also
stamps `winback_email_sent_at`. Two consequences, both intended:

- the member becomes eligible for the discount the email promises, and
- the weekly automated win-back (`092.winback`) will never double-touch them.

The Stripe webhook clears the stamp on re-subscribe, so a future re-churn
re-qualifies for the automated flow.

Because the promise is worthless without a coupon, the script **refuses to run**
the `cancelled` audience unless at least one `STRIPE_COUPON_WINBACK_*` env is
set, and warns per missing (tier, cadence). Pass `--allow-missing-coupon` only if
you are honoring the discount by hand with
`scripts/honor-winback-discount.mts`.

### The discount rate is never hardcoded

The cancelled email does not state a percentage of its own. It carries
`{{DISCOUNT_LABEL}}` (the full phrase, e.g. "50% off your first year") and
`{{DISCOUNT_SHORT}}` (the button, e.g. "50% off"), both substituted at send time
from **`WINBACK_DISCOUNT_LABEL`** — the same value `scripts/send-winback.mts`
and the `/pricing` welcome-back banner read. Set it to match whatever the
configured coupon actually grants, and the coupon, the banner, the automated
win-back and this campaign all state one rate.

The script **refuses to send** when a template needs the label and
`WINBACK_DISCOUNT_LABEL` is unset — a default would reintroduce exactly the
drift this exists to prevent. Every run echoes what the copy will claim:

```
Discount copy:  "50% off your first year"  (button reads "Come back at 50% off")
```

Check that line against the coupon before sending. To confirm the coupon itself:

```
KEY=$(grep -m1 '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s "https://api.stripe.com/v1/coupons/<coupon id>" -u "$KEY:"
```

### Before a `cancelled` send

Consider pausing the weekly automated win-back timer for the duration of the
`cancelled` send so the two can't interleave mid-run:

```
sudo systemctl stop zerogex-web-winback.timer     # re-enable when the send is done
```

It is not strictly required — the shared `winback_email_sent_at` latch already
prevents a double-touch — but it keeps the digest's counts honest while a
campaign is draining the same cohort.

---

## Prerequisites (run in production, from `frontend/`)

- Real `auth.db` reachable (`AUTH_DB_PATH`), `RESEND_API_KEY` + `RESEND_FROM_EMAIL`
  set (or in `frontend/.env.local`), Resend sending domain verified, `sqlite3`
  CLI installed.
- `ZEROGEX_END_USER_TOKEN_SECRET` and `NEXT_PUBLIC_APP_URL` set — used to sign the
  per-recipient unsubscribe links.
- For `cancelled`: `STRIPE_COUPON_WINBACK_{BASIC,PRO}_{MONTHLY,ANNUAL}` configured
  in Stripe and in `.env.local`.
- **Deploy first.** It serves the header and footer logos at
  `https://zerogex.io/email/zerogex-email-header.png` and `zerogex-email-footer.png`
  (generated from `assets/branding/` by `make logo`; otherwise the logo is broken)
  and publishes the `/unsubscribe` route the footer link and one-click header point
  to.

## Send to subscribers

No date window: the cohort is everyone on an active or trialing subscription.

```
cd frontend

# 1. See the count + a sample (nothing sent)
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --dry-run

# 2. Send one preview to yourself; open on desktop + phone
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --preview-to Michael@zerogex.io

# 3. Small live test batch (first 5 real recipients)
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --send --yes --limit 5

# 4. Send to everyone remaining
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --send --yes
```

## Send to registrants

`--since` pins the signup floor to the last campaign, so only people who
registered after it are contacted. For October, use the date the August send
started, which the audit log records:

```
sqlite3 /var/lib/zerogex/auth.db \
  "SELECT MIN(created_at) FROM audit_events WHERE type = 'product_update_2026_08_sent';"
```

Put its date (the first 10 characters) in place of `<AUGUST_SEND_DATE>`:

```
cd frontend

# 1. See the count + a sample (nothing sent)
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since <AUGUST_SEND_DATE> --dry-run

# 2. Send one preview to yourself; open on desktop + phone
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since <AUGUST_SEND_DATE> --preview-to Michael@zerogex.io

# 3. Small live test batch (first 5 real recipients)
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since <AUGUST_SEND_DATE> --send --yes --limit 5

# 4. Send to everyone remaining
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since <AUGUST_SEND_DATE> --send --yes
```

## Send to cancelled (campaigns that have a `cancelled` variant)

Same shape, no `--since`: the cohort is defined by the never-win-backed latch,
not a date window. October has no `cancelled` variant, so these name the August
campaign explicitly.

```
node --experimental-strip-types scripts/send-product-update.mts --campaign 2026-08 --audience cancelled --dry-run
node --experimental-strip-types scripts/send-product-update.mts --campaign 2026-08 --audience cancelled --preview-to Michael@zerogex.io
node --experimental-strip-types scripts/send-product-update.mts --campaign 2026-08 --audience cancelled --send --yes --limit 5
node --experimental-strip-types scripts/send-product-update.mts --campaign 2026-08 --audience cancelled --send --yes
```

Or export the cohort and send from the Resend UI:

```
node --experimental-strip-types scripts/send-product-update.mts --campaign 2026-08 --audience cancelled --csv cancelled.csv
```

## Notes

- **Throttle:** `--throttle-ms` (default 550ms ≈ 1.8/s) stays under Resend's rate
  limit; 429s are retried with backoff automatically.
- **`--send` requires `--yes`.** Default mode is dry-run.
- **Verified only:** every cohort requires `email_verified_at`; subscribers are
  verified by definition.
- **Keep the copy in sync.** The highlights appear in three places: the
  campaign emails here, `frontend/content/winback-highlights.json` (the automated
  win-back's dated "what's new since you left" bullets), and the matching entry
  on `/updates` (`app/updates/page.tsx`). Update all three together.

---

## Past campaigns

### August 2026 (`--campaign 2026-08`)

The follow-up to the July send: the TradingView and NinjaTrader indicators,
ES/NQ futures coverage, Gamma Shift, Pin Strike, and the Market Tide / Pair
Comparison / Volatility metric pages.

| Audience | Who | Files | Subject |
|---|---|---|---|
| `registrants` | Verified, never subscribed, signed up **since the July send** (`--since 2026-07-20`), logged in | `2026-08-product-update-registrants.html` / `.txt` | What's new at ZeroGEX since you signed up |
| `cancelled` | Churned (`subscription_lapsed=1`), verified, no live sub, not an operator, and **never win-backed** (`winback_email_sent_at IS NULL`) | `2026-08-product-update-cancelled.html` / `.txt` | What's changed at ZeroGEX since you left |

**Idempotency key:** `product_update_2026_08`. Sent in early September 2026; still
registered so the cohort can be re-counted or audited, and so the `cancelled`
variant stays available.

### July 2026 (`--campaign 2026-07`)

| Audience | Who | Files | Subject |
|---|---|---|---|
| `subscribers` | Active + trialing customers (`subscription_status IN ('active','trialing')`) | `2026-07-product-update.html` / `.txt` | What's new at ZeroGEX — and what's coming next |
| `registrants` | Signed up ≤30d, verified, logged in, never subscribed, not already sent the verified-never-paid nudge | `2026-07-product-update-registrants.html` / `.txt` | Your ZeroGEX account is ready — start with the free levels |

**Idempotency key:** `product_update_2026_07`. Complete; still registered so the
cohort can be re-counted or audited.
