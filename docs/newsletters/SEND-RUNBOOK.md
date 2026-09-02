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

## Current campaign — August 2026 (`--campaign 2026-08`, the default)

The follow-up to the July send. Covers everything that shipped since: the
TradingView and NinjaTrader indicators, ES/NQ futures coverage, Gamma Shift,
Pin Strike, and the Market Tide / Pair Comparison / Volatility metric pages.

| Audience | Who | Files | Subject |
|---|---|---|---|
| `registrants` | Verified, never subscribed, signed up **since the July send**, logged in | `2026-08-product-update-registrants.html` / `.txt` | What's new at ZeroGEX since you signed up |
| `cancelled` | Churned (`subscription_lapsed=1`), verified, no live sub, not an operator, and **never win-backed** (`winback_email_sent_at IS NULL`) | `2026-08-product-update-cancelled.html` / `.txt` | What's changed at ZeroGEX since you left |

**Idempotency key:** `product_update_2026_08`. Each successful send stamps
`audit_events(type='product_update_2026_08_sent')`, so a re-run — including after a
`--limit` test batch — skips anyone already emailed and an interrupted run resumes
cleanly.

### Why `registrants` no longer skips the already-nudged

July excluded anyone the automated ~2h onboarding nudge
(`scripts/send-verified-never-paid.mts`) had reached, to avoid a same-week
double-touch. That rule is wrong once the automation is in steady state: its
timer fires **every 2 hours** over a 2h–7d window, so it stamps
`verified_never_paid_email_sent_at` on essentially every verified signup within
hours of registration. A live August run with the exclusion returned **2
recipients against 146 skipped**.

So August keeps them. The flag is per-campaign
(`CampaignSpec.excludeOnboardingNudged`), not deleted, so re-running
`--campaign 2026-07` still reproduces the cohort July actually sent to. The
dry-run reports the overlap either way — `Excluded:` when the campaign skips
them, `Second touch:` when it doesn't.

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

### Before sending

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
- **Deploy first.** It serves the header image at
  `https://zerogex.io/email/zerogex-header.png` (otherwise the logo is broken) and
  publishes the `/unsubscribe` route the footer link and one-click header point to.

## Send to registrants

`--since` pins the signup floor to the last campaign, so only people who
registered after it are contacted. Use the July send date.

```
cd frontend

# 1. See the count + a sample (nothing sent)
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since 2026-07-20 --dry-run

# 2. Send one preview to yourself; open on desktop + phone
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since 2026-07-20 --preview-to Michael@zerogex.io

# 3. Small live test batch (first 5 real recipients)
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since 2026-07-20 --send --yes --limit 5

# 4. Send to everyone remaining
node --experimental-strip-types scripts/send-product-update.mts \
  --audience registrants --since 2026-07-20 --send --yes
```

## Send to cancelled

Same shape, no `--since` — the cohort is defined by the never-win-backed latch,
not a date window.

```
node --experimental-strip-types scripts/send-product-update.mts --audience cancelled --dry-run
node --experimental-strip-types scripts/send-product-update.mts --audience cancelled --preview-to Michael@zerogex.io
node --experimental-strip-types scripts/send-product-update.mts --audience cancelled --send --yes --limit 5
node --experimental-strip-types scripts/send-product-update.mts --audience cancelled --send --yes
```

Or export the cohort and send from the Resend UI:

```
node --experimental-strip-types scripts/send-product-update.mts --audience cancelled --csv cancelled.csv
```

## Notes

- **Throttle:** `--throttle-ms` (default 550ms ≈ 1.8/s) stays under Resend's rate
  limit; 429s are retried with backoff automatically.
- **`--send` requires `--yes`.** Default mode is dry-run.
- **Verified only:** every cohort requires `email_verified_at`; subscribers are
  verified by definition.
- **Keep the copy in sync.** The five highlights appear in three places — the
  campaign emails here, `frontend/content/winback-highlights.json` (the automated
  win-back's "what's new since you left" bullets), and the August entry on
  `/updates` (`app/updates/page.tsx`). Update all three together.

---

## Past campaigns

### July 2026 (`--campaign 2026-07`)

| Audience | Who | Files | Subject |
|---|---|---|---|
| `subscribers` | Active + trialing customers (`subscription_status IN ('active','trialing')`) | `2026-07-product-update.html` / `.txt` | What's new at ZeroGEX — and what's coming next |
| `registrants` | Signed up ≤30d, verified, logged in, never subscribed, not already sent the verified-never-paid nudge | `2026-07-product-update-registrants.html` / `.txt` | Your ZeroGEX account is ready — start with the free levels |

**Idempotency key:** `product_update_2026_07`. Complete; still registered so the
cohort can be re-counted or audited.
