# ZeroGEX Ambassador Program

The **third** partner category, sitting between the two existing programs:

| Program | Who | Reward | Module |
|---|---|---|---|
| Refer-a-Friend | any subscriber | 1 free month (account credit) | `core/referrals.ts` |
| **Ambassador** (new) | invite-only trusted customers | **20% cash** or **25% account credit** | `core/ambassadorLedger.ts` + `core/ambassadors.ts` |
| Content Creator Affiliate | large-audience creators | cash commission + audience coupon | `core/creatorPartners.ts` |

It is an **invite-only, manually-managed pilot**. It reuses the existing
affiliate plumbing rather than introducing a parallel attribution/payout system:
an ambassador is a `users` row with `partner_tier='ambassador'` and a
`referral_code`, whose referees are attributed via `users.referred_by_code` + the
`referrals` ledger and whose commissions accrue into the **shared**
`partner_commissions` ledger (rows tagged `partner_type='ambassador'` so creator
rows and ambassador rows never interfere).

## Architecture

```
core/ambassadorConfig.ts   Leaf module: env-driven terms + pure money/time/attribution
                           helpers. No DB/Stripe imports → unit-testable directly.
core/ambassadorLedger.ts   DB + integer-math core (Stripe-free). Accrual, attribution,
                           holding-period release (DB claim), reversals (returns the
                           Stripe clawbacks to perform), invite/accept/status/terms,
                           funnel + analytics + CSV, pilot expiry. Node-testable.
core/ambassadors.ts        Thin Stripe/email orchestration over the ledger: applies
                           account-credit rewards + clawbacks via Stripe balance
                           transactions, reads the live balance for the dashboard,
                           sends transactional email, re-exports the ledger surface.
```

Two-layer split is deliberate: the ledger's entire runtime import graph is
Node-resolvable (relative `.ts` imports, no `@/` alias, no `getStripe()`), so it
runs under `node --experimental-strip-types --test` — the app's normal
`@/`-aliased modules cannot. All money is stored and computed in **integer minor
units (cents)**; there is no floating-point arithmetic on money.

### Data model (all additive; migrations in `core/db.ts` `initDb()`)

**`users`** — extends the existing `partner_*` columns (creator program):
`partner_status` (invited|active|paused|inactive|rejected), `partner_designation`
(e.g. "Founding Ambassador"), `partner_reward_preference` (cash|account_credit),
`partner_credit_bps` (25%), `partner_attribution_window_days` (60),
`partner_holding_period_days` (30), `partner_pilot_started_at`/`_ends_at`,
`partner_early_access`, `partner_notes`, `partner_invited_at`/`_accepted_at`/
`_deactivated_at`, `partner_terms_version`. Reuses existing `partner_commission_bps`
(cash %, ambassadors set 2000), `partner_commission_window_months` (12),
`partner_activated_at`, `referral_code`.

**`referrals`** — extended with `partner_type` (snapshotted at attribution),
`first_touch_at`, `attribution_expires_at`, `subscription_id`, `customer_id`.

**`partner_commissions`** — extended with `partner_type` (default `'creator'`
backfills every existing row), `reward_type`, `commission_bps` (snapshotted),
`excluded_amount`, `hold_release_at`, `credited_at`, `reversal_reason`,
`updated_at`. Creator rows keep status `accrued→paid/reversed`; ambassador rows
use `pending→payable→paid` (cash) / `pending→credited` (credit), plus
`reversed`/`disputed`/`cancelled`/`approved`. `UNIQUE(stripe_invoice_id)` is what
makes accrual idempotent against Stripe retries.

**`partner_link_visits`** — `(code, visits, updated_at)` aggregate counter, bumped
by the rate-limited `/api/ambassador/visit` beacon (server-validated code only).

### Commission lifecycle

1. **Attribution** (`recordAmbassadorReferral`, called from `recordReferralSignup`
   at signup): honored only for an **active** ambassador, within the 60-day
   click→registration window (`zgx_ref_ts` cookie = first touch), not a
   self-referral, first-valid-attribution-wins.
2. **Accrual** (`maybeAccrueAmbassadorCommission`, Stripe `invoice.paid`): only on
   `amount_paid > 0` (excludes trials/failed/fully-coupon'd), inside the 12-month
   duration window, snapshotting reward type + rate → inserts `pending` with a
   30-day `hold_release_at`.
3. **Release** (daily cron `release-ambassador-commissions.mts`): cash
   `pending→payable`; credit → apply a Stripe balance credit → `credited`. Rewards
   ≥ `AMBASSADOR_REVIEW_THRESHOLD_CENTS` are held for admin approval.
4. **Payout** (cash): an admin marks `payable→paid` with a payout reference
   (no automated external payout — see *Deferred*).
5. **Reversal** (`charge.refunded` / `charge.dispute.created`): proportional for a
   partial refund, full for a full refund/chargeback. Not-yet-settled rows are
   reduced/flipped; already-settled (credited/paid) rows get a **compensating
   negative** ledger row (never a silent delete) + a Stripe credit clawback.

## API

| Route | Auth | Purpose |
|---|---|---|
| `GET/POST /api/account/ambassador` | session (self) | dashboard; accept invite; change reward preference |
| `POST /api/ambassador/visit` | public, IP rate-limited | referral-link visit beacon (server-validates the code) |
| `GET/POST /api/admin/ambassadors` | admin | list/detail/search/CSV; invite/status/terms/approve/mark-paid/adjust/release |

All mutating routes require the CSRF token (`x-csrf-token`, same as the rest of
the app). Admin routes re-check `tier === 'admin'` on every request. No internal
IDs, Stripe secrets, or other ambassadors' data are exposed to end users; referred
customers are shown to ambassadors as **masked emails** only.

## UI

- `/account/ambassador` — the ambassador's own area: onboarding + versioned terms
  acceptance + reward selection (for `invited`), then the dashboard (referral
  link/code + copy, reward preference, funnel, pending/payable/paid cash + pending/
  issued credit, recent referrals/commissions, pilot dates, early-access + feedback
  links, resources, disclosure guidance, full terms). Shown only to ambassadors; a
  small entry-point card appears on `/account` for them.
- `/admin/ambassadors` — admin console: analytics, user-search invite, roster,
  per-ambassador detail with status/terms controls, per-commission approve/mark-paid/
  cancel, manual adjustments, and CSV export. Destructive actions confirm first.
- `/ambassador-terms` — public terms page (invite-only messaging, no employee/agent/
  adviser language). Shared `components/AmbassadorTerms.tsx` renders the terms in
  both the onboarding flow and the public page.

## Feature flags / environment (see `.env.example`)

| Var | Default | Meaning |
|---|---|---|
| `AMBASSADOR_PROGRAM_ENABLED` | `0` | master switch (whole program inert when off) |
| `AMBASSADOR_ATTRIBUTION_DISABLED` | `0` | pause NEW attribution/accrual-of-new-signups while preserving existing records |
| `AMBASSADOR_COMMISSION_BPS` | `2000` | default cash rate (20%) |
| `AMBASSADOR_CREDIT_BPS` | `2500` | default account-credit rate (25%) |
| `AMBASSADOR_COMMISSION_WINDOW_MONTHS` | `12` | commission duration per referred customer |
| `AMBASSADOR_ATTRIBUTION_WINDOW_DAYS` | `60` | click→registration window |
| `AMBASSADOR_HOLDING_PERIOD_DAYS` | `30` | hold before payable/credited |
| `AMBASSADOR_PILOT_DAYS` | `90` | default pilot length |
| `AMBASSADOR_REVIEW_THRESHOLD_CENTS` | `20000` | rewards ≥ this need admin approval (0 disables) |
| `AMBASSADOR_TERMS_VERSION` | `v1` | recorded on acceptance; bump prospectively |
| `AMBASSADOR_FEEDBACK_URL` / `AMBASSADOR_EARLY_ACCESS_URL` | unset | optional dashboard links |

Rollout controls satisfied: global on/off (`AMBASSADOR_PROGRAM_ENABLED`),
invitation-only (no public application; admin invite required), admin-only
management (all admin routes gated), disable-new-attribution-while-preserving
(`AMBASSADOR_ATTRIBUTION_DISABLED`), staging-before-prod (env-driven — enable in
staging first).

## Migrations

No manual table edits. The schema lands via the app's lazy migration in
`core/db.ts` (`ensureColumn` + `CREATE TABLE IF NOT EXISTS`), same pattern as the
founding/creator columns. To force it (e.g. before a partial deploy):

```
cd frontend && make migrate     # opens a fresh Node process, runs initDb()
```

Deploy **step 090** (`deploy/steps/090.ambassador-release`) runs `make migrate`
before installing the timer, exactly like step 087 does for the creator columns.
Existing affiliate records are safe: `partner_commissions.partner_type` defaults to
`'creator'` (backfilling every existing row), and existing creators are backfilled
to `partner_status='active'`.

## Operations

| Command | What |
|---|---|
| `make ambassadors [EMAIL=…]` | read-only roster + rollups |
| `make ambassador-release DRY_RUN=1` | preview what's due to release/expire |
| `make ambassador-release YES=1` | release rewards past hold + expire pilots (the daily timer's action) |

`deploy/systemd/zerogex-web-ambassador-release.{service,timer}` runs the release
daily at 04:10 (installed/enabled by deploy step 090).

## Manual Stripe configuration

**None required beyond what's already configured.** Ambassadors are not given a
checkout coupon (unlike creators) — they are compensated by commission/credit on
collected revenue. The existing `invoice.paid`, `charge.refunded`, and
`charge.dispute.created` webhook events (already enabled for the creator program)
drive accrual and reversal. Account-credit rewards use the same Stripe
customer-balance mechanism as Refer-a-Friend. Ensure `STRIPE_SECRET_KEY` is set so
the release cron can apply credits.

## Testing

- `npm run test:ambassador-config` — pure money/attribution/time helpers
  (20%/25% calc, proportional refund, 60-day window valid/expired, 30-day hold,
  12-month expiry, decimal-safety).
- `npm run test:ambassador-ledger` — DB-backed (temp SQLite): invite/accept, unique
  code, valid/expired attribution, self-referral, monthly/annual/failed/trial
  payments, duplicate webhook, partial/full refund, chargeback, 12-month expiry,
  cash vs credit accrual, prospective preference change, hold release, review
  threshold, idempotent credit claim, deactivation, pilot expiry, CSV, analytics,
  and creator-program preservation. 37 assertions total.

## Preservation of existing behavior

- **Refer-a-Friend**: unchanged. `recordReferralSignup` still records referral/
  creator attribution as before; the only behavioral change is that it now *also*
  runs when the ambassador program is on (so ambassador-only mode works), skips the
  free-month reward for ambassadors (they earn commission/credit instead — same as
  it already did for creators), and stamps `partner_type`.
- **Creator affiliate**: unchanged. Creator accrual/reversal (`maybeAccruePartner
  Commission` / `reversePartnerCommissionsForInvoice`) resolve creators only and
  operate on `status='accrued'` rows; ambassador rows are `partner_type='ambassador'`
  with different statuses, so the two never collide. Existing creator accounts keep
  `partner_tier='creator'`.
- **Stripe webhook / billing / trials / account settings / admin**: the ambassador
  hooks are *additive* (new branches alongside the creator ones), best-effort, and
  never throw into the webhook's tier-sync path.

## Assumptions & deferred

**Assumptions**: single primary currency for dashboard rollups (per-row currency is
stored; sums assume a consistent currency, defaulting to USD); the `zgx_ref_ts`
first-touch cookie is best-effort (attribution fails *open* when it's absent, so a
lost cookie never drops a valid referral); only `public/email/zerogex-header.png`
exists as a brand asset, so the Resources section uses it and text blurbs rather
than fabricating screenshots.

**Intentionally deferred**:
- **Automated external cash payouts.** No secure payout rail exists, so cash is an
  operator workflow: the cron moves rewards to `payable`, an admin marks them
  `paid` with a reference. (Account-credit rewards *are* automated via Stripe.)
- **Per-visitor click analytics / device fingerprinting** — only an aggregate
  per-code visit counter is kept, deliberately, to avoid invasive tracking.

## Production rollout checklist

1. Deploy the code; run `make migrate` (or deploy step 090, which does it).
2. Install the release timer: `./deploy/deploy.sh --start-from 090` (or run the
   step directly). Verify `systemctl list-timers zerogex-web-ambassador-release.timer`.
3. In **staging**, set `AMBASSADOR_PROGRAM_ENABLED=1` and the terms/threshold vars;
   verify end-to-end (invite → accept → referred test subscription → accrual →
   `make ambassador-release DRY_RUN=1` → mark paid).
4. Confirm Stripe webhook events `invoice.paid`, `charge.refunded`,
   `charge.dispute.created` are delivered (already required by the creator program).
5. In **production**, set `AMBASSADOR_PROGRAM_ENABLED=1` (+ optional
   `AMBASSADOR_FEEDBACK_URL` / `AMBASSADOR_EARLY_ACCESS_URL`), rebuild, restart PM2.
6. Invite ~5–10 pilot ambassadors from `/admin/ambassadors` (90-day pilot dates set
   automatically); mark Founding Ambassadors as desired.
7. Monitor `/admin/ambassadors` analytics + `journalctl -u zerogex-web-ambassador-release`.
8. **Before broader launch**: have the Ambassador Program Terms reviewed by legal
   (the page is labeled a working implementation), then bump `AMBASSADOR_TERMS_VERSION`.
