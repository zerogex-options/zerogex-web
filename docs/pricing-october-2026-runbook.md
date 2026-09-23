# October 2026 pricing: operator runbook

*What changed, how to turn it on without touching anyone already subscribed, and the levers if something needs to be backed out.*

## 1. The policy

| Plan | Monthly | Quarterly | Annual |
|---|---|---|---|
| Basic | $39 (**7-day free trial**) | $75 (≈ $25/mo) | $199 (≈ $16.58/mo) |
| Pro | $59 | $115 (≈ $38.33/mo) | $299 (≈ $24.92/mo) |

- **Basic monthly is the only plan with a free trial.** A card goes on file and nothing is charged until day 7.
- **Every other plan is paid up front under a 7-day money-back guarantee.** The member asks from the Account page within 7 days of paying, gets a full refund, and loses access immediately. **Limit one refund per customer.** A customer is matched by account, by email (Gmail dots and `+tags` ignored) or by card, so a new email on the same card still counts as a repeat.
- **Promo:** $10 off either monthly plan for the first 12 months, for signups by October 1 (Basic $29, Pro $49). A promo member who switches between the two monthly plans keeps it for the rest of their 12 months.
- **Auto-renewal notices:** checkout states the renewal terms next to the Subscribe button. A reminder email goes out 7 days before a quarterly plan renews and 30 days before an annual one.

The catalogue and the policy live in one file, `frontend/core/billingPlans.ts`. Stripe is the source of truth for what is charged. `make setup-pricing VERIFY=1` checks the two against each other.

## 2. What deploying the code changes on its own

Before any env change:

- **Trial policy: live at once.** New Pro monthly and annual checkouts are charged up front and covered by the guarantee. Basic monthly keeps its trial. Subscriptions that already exist are untouched: a member mid-trial keeps that trial. One exception by design: a never-paid signup who comes back through the reactivation email still gets the extended trial that email promised, on any plan.
- **Quarterly: hidden.** It appears only once both `STRIPE_PRICE_*_QUARTERLY` are set. Checkout refuses a quarterly plan until then.
- **Promo: off.** It appears only while `PROMO_END_AT` is in the future and both monthly promo coupons are set.
- **Account page:** the money-back panel appears only within 7 days of a purchase made under the guarantee. Checkout marks those purchases, so no existing member sees it.
- **Renewal reminders:** installed by `deploy/steps/099.renewal-reminders`. The first daily run emails existing annual members who renew within 30 days. Preview who with `make renewal-reminders` (a dry run).

## 3. Turning it on, in order

```bash
make setup-pricing                   # dry run: shows what it would create
make setup-pricing YES=1             # creates the quarterly prices and the $10 coupon, prints .env.local lines
# paste the printed lines into frontend/.env.local, replacing any existing line for the same key
make restart                         # server env is read at start-up; no rebuild needed
make setup-billing-portal YES=1      # portal offers the quarterly plans; a mid-trial switch ends the trial
make setup-pricing VERIFY=1          # must end "no problems"
```

**Why the portal step comes after the restart.** The webhook maps a subscription's price to a tier through the same `STRIPE_PRICE_*` env. If the portal offered a quarterly price before the running app knew it, a member who switched to it would drop to public access. VERIFY flags any portal price the env does not know.

`setup-pricing` never edits `.env.local`, never changes or archives an existing Stripe object, and never touches a customer or subscription. It is idempotent: prices carry lookup keys (`zgx_basic_quarterly`, `zgx_pro_quarterly`) and the coupon has a fixed id (`ZGX_MONTHLY_10_OFF_12M`), so a re-run reuses them.

### Env keys

| Key | Value |
|---|---|
| `STRIPE_PRICE_BASIC_QUARTERLY` / `STRIPE_PRICE_PRO_QUARTERLY` | from `make setup-pricing YES=1` |
| `STRIPE_COUPON_PROMO_BASIC_MONTHLY` / `STRIPE_COUPON_PROMO_PRO_MONTHLY` | `ZGX_MONTHLY_10_OFF_12M` (one coupon serves both) |
| `PROMO_END_AT` | `2026-10-02T03:59:59Z`, the end of October 1 in New York. The page shows "Offer ends October 1, 2026". |
| `STRIPE_COUPON_PROMO_*_ANNUAL` | blank. The promo is monthly-only, and checkout ignores these. |
| `STRIPE_COUPON_PROMO_RETIRED` | printed by setup when it replaces an older promo coupon. A member still holding an old coupon has it swapped out on a plan switch, instead of getting it on top of the new promo. |
| `BILLING_TRIAL_PLANS` | blank means Basic monthly only (see levers) |
| `REFUND_ALERT_EMAIL` | who is emailed about each refund (falls back to `CANCELLATION_ALERT_EMAIL`) |

The coupon deliberately has **no redeem-by date**: `PROMO_END_AT` is the only clock. A coupon that expired first would make monthly checkouts fail.

## 4. Running the guarantee

- **Self-serve:** the Account page shows the guarantee panel while the member is eligible. One click refunds the covered payment in full, cancels the subscription immediately, removes paid access and API keys, emails a confirmation, and emails you an alert.
- **Request by email:** `make money-back-refund EMAIL=<address>` runs the same path. It is a dry run by default. `YES=1` applies, `REASON=` and `COMMENT="..."` are optional, and `FORCE=1` makes a goodwill exception to the window or the one-refund limit.
- **Something failed part-way:** you get an alert with ACTION NEEDED in the subject. Re-run the same command. It resumes and never refunds twice. Every step is recorded in the `money_back_refunds` table, which survives account deletion so the one-refund rule does too.
- **The app died mid-request** (for example a restart between the refund and the cancel): the hourly `money-back-sweep` timer (deploy step 099) reports any request still pending 30 minutes after its last activity. `make money-back-sweep` lists them.
- **Goodwill refunds:** `FORCE=1` gives back what the guarantee covered (the first payment and any upgrade inside the window), never later renewals. The dry run lists exactly which payments it would refund.
- **What is not covered:** renewals, trial conversions and Basic monthly. The panel does not appear for them.

## 5. Levers

| To… | Do | Effect |
|---|---|---|
| Give every plan a trial again | `BILLING_TRIAL_PLANS=basic:monthly,pro:monthly,basic:annual,pro:annual`, then `make restart` | Those plans trial and leave the guarantee. The page follows. |
| Remove the only free trial | `BILLING_TRIAL_PLANS=none`, then restart | Every plan is paid up front under the guarantee. |
| End the promo early | set `PROMO_END_AT` to a past time, then restart | New signups pay list price. Existing promo members keep theirs. |
| Stop all paid signups | `BILLING_PAID_SIGNUP_DISABLED=1`, then restart | Checkout is refused. |

**Never blank a `STRIPE_PRICE_*` value that anyone is subscribed on.** The webhook would stop recognising that price and drop those members to public access on their next event. To stop *selling* quarterly, archive the price in Stripe instead.

**Leave the promo coupon lines in place after October 1.** `PROMO_END_AT` closes the offer. The lines are how the app recognises the promo on existing members' plan switches during their 12 months.

## 6. Manual operator commands

Every `make` command that looks at a member's plan knows about quarterly. Notes on the ones where it matters:

- `fix-plan-switch-discount` uses the same coupon rules as the automatic plan-switch fix, so a promo member moving between the two monthly plans keeps the $10 off for the rest of their 12 months, even after October 1.
- `honor-winback-discount` on a quarterly member: a "one year" win-back coupon covers four quarterly invoices. It uses `STRIPE_COUPON_WINBACK_<TIER>_QUARTERLY` if set, otherwise `CREATE_COUPON=1` makes one.
- `upgrade-at-current-price` keeps a quarterly member on quarterly billing.
- `grant-founding-on-existing-sub` and `activate-late-founder` only offer monthly or annual targets, because the founding offer has no quarterly rate. A quarterly member can still be moved onto a founding plan.
- The July 2026 product-update newsletter can no longer be sent (`--dry-run` still counts its audience). Its copy says both plans start with a free trial.

## 7. Open items

- **Terms version.** The Terms page now describes the trial, the guarantee and auto-renewal, but `TERMS_VERSION` was not bumped, because a bump makes every member re-accept. Bump it if counsel wants existing members to accept the new wording.
- **Quarterly referral bonus.** None unless `STRIPE_COUPON_REFERRAL_REFEREE_QUARTERLY` is set. The monthly coupon (100% off) must never be reused there, because it would give a free quarter.
