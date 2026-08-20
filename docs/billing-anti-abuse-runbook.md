# Billing Anti-Abuse & Churn Runbook

*How ZeroGEX defends against bad-card trial abuse and involuntary (payment-failure) churn — what's fixed in code, and what you must configure in the Stripe Dashboard.*

> **Context.** The subscription dashboard showed two distinct billing leaks that
> *feel* like "the product is failing" but are mechanical:
> 1. **Trial abuse** — signups charging a dead/prepaid/throwaway card to farm the
>    free trial with no intent to pay. Shows up as a spike of *payment failures at
>    trial-end conversion*.
> 2. **Involuntary churn** — real customers dropped to `public` the instant a
>    *renewal* charge fails, even though Stripe's Smart Retries would have
>    recovered many of those cards within days.
>
> These are different problems with different fixes. Neither is a product-market-fit
> problem. This doc is the single place that tracks both.

---

## 1. What is now fixed in code

Shipped on branch `claude/product-viability-strategy-j7lev6`:

### a. Bounded payment-recovery grace window (involuntary churn)
- **Before:** the first failed *renewal* → `past_due` → immediate downgrade to
  `public` + API-key revocation, in the same webhook. A momentary decline
  (insufficient funds that day, a bank fraud hold, an expired card the member is
  about to update) evicted a paying customer instantly.
- **After:** an *established* (previously `active`) subscription keeps its paid
  tier for a bounded window while Stripe retries the card.
  - New env: `BILLING_PAYMENT_GRACE_DAYS` (default **3**, clamped `[0,14]`, `0`
    restores old instant-downgrade behavior).
  - Anchored by `users.payment_grace_started_at`; decision logic in
    `frontend/core/paymentGrace.ts` (unit-tested, `tests/paymentGrace.test.ts`);
    applied in `frontend/app/api/webhooks/stripe/route.ts` (`syncSubscriptionToUser`).
  - **Deliberately excludes trial-conversion failures** (previous status
    `trialing`, never `active`) — an unvalidated trial card still downgrades
    immediately, so this does *not* extend free access to abusers.
  - *Since superseded by trial grace:* `BILLING_TRIAL_GRACE_ENABLED` (default
    **on**) gives a lapsed trial whose **first** conversion charge is declined the
    same bounded window — but only when the trial had already been granted access
    (its SetupIntent succeeded). A trial we withheld for an unvalidated card still
    downgrades instantly, so the abuse exclusion above still holds. Set
    `BILLING_TRIAL_GRACE_ENABLED=0` to restore the hard trial-end downgrade.
  - Auditable: emits `billing_payment_grace_active` / `billing_payment_grace_ended`
    audit events so you can count the involuntary-churn saves.
  - Which of the two failures opened a window is recorded in
    `users.payment_grace_reason` (`renewal` | `trial`), written and cleared in
    lockstep with the anchor. Admin → Monitoring → **Total Subscribers** uses it to
    stack the trial-conversion cohort as its own **Trial Grace** band: subscribers
    with access today who have never completed a payment. Renewal-failure grace
    stays inside **Full Subscriber** — those members already paid. Watch the band
    for the share of trials that convert on a retry versus lapse.

### b. Documentation footguns removed
- `content/help/platform/tiers-and-access.md` said **"14-day trial"** while the
  code grants **7** — a promise mismatch that drives trial-end disputes. Fixed.
- `.env.example` documented `STRIPE_PRICE_BASIC` / `STRIPE_PRICE_PRO`, but the code
  reads `STRIPE_PRICE_{BASIC,PRO}_{MONTHLY,ANNUAL}` (`core/stripe.ts`). Configuring
  from the old names makes `skuToPriceId` throw and checkout 500s. Fixed to list
  the four real keys, plus documents `BILLING_PAYMENT_GRACE_DAYS`.

**Tune the grace window against your Smart Retry schedule (§3):** set
`BILLING_PAYMENT_GRACE_DAYS` to roughly cover your first 1–2 retry attempts, so a
recoverable card is retried *before* the member ever loses access, but a truly dead
card still lapses well short of "weeks of free premium."

---

## 2. What you must configure in the Stripe Dashboard (the trial-abuse fix)

Bad-card trial abuse is best stopped **before** the card is accepted. That is
Stripe **Radar** + Checkout settings — dashboard config, not app code (the app
already collects a card at trial signup; nothing in code validates *quality*).
None of this requires a redeploy.

### a. Turn on the Radar rules that matter (Dashboard → Radar → Rules)
Recommended `Block if` rules (start in *Review*, promote to *Block* once you've
watched a week of traffic):
- **`:cvc_check: = 'fail'`** — block when the CVC verification fails.
- **`:address_postal_code_check: = 'fail'`** — block postal/AVS mismatches.
- **`:card_funding: = 'prepaid'`** — prepaid cards are the classic trial-farm
  instrument; block them from starting a trial (or at least Review them).
- **`:risk_level: = 'highest'`** (and Review `= 'elevated'`) — Stripe's ML score.
- **Velocity (Radar for Fraud Teams):** `Block if :card_number: has been used on
  more than N accounts/emails in 7 days` — directly kills same-card farming across
  throwaway emails.

### b. Force CVC + postal collection at Checkout
Dashboard → Settings → Payments → **require CVC and postal code**. Without these
signals the rules in (a) can't fire.

### c. Configure Smart Retries / dunning to match the grace window (§3).

### d. Set the billing-portal configuration
Set `STRIPE_PORTAL_CONFIG_ID` (a `bpc_...` id) so the portal actually offers
**plan switching** (Basic↔Pro, monthly↔annual). The default portal config does
not, which silently blocks self-serve upgrades. See `core/stripe.ts:getPortalConfigId`
and `scripts/setup-billing-portal.mts`.

---

## 3. Recommended Smart Retries + terminal action (Dashboard → Settings → Subscriptions and emails → Manage failed payments)

- **Smart Retries: ON.** Let Stripe's ML schedule ~4 attempts over ~2–3 weeks.
- **When all retries fail:** *Cancel the subscription* (fires
  `customer.subscription.deleted` → the webhook resets tier to `public` and marks
  the account lapsed → the win-back email path picks it up). Avoid *Mark unpaid*
  unless you specifically want the sub to linger.
- **Failed-payment emails: ON.** These stack with the app's own single
  first-attempt dunning email (`sendPaymentFailedEmail`), which names the exact
  failing card and the next retry date.
- **Reconcile with `BILLING_PAYMENT_GRACE_DAYS`:** access is retained for
  `graceDays` from the first failure regardless of retry timing, so keep the grace
  ≤ the point where you're comfortable a still-failing card has lost access
  (default 3 days ≈ first retry or two).

### The paid-after-cancel case (orphaned payments)

*Cancel the subscription* does **not** void the invoice that failed. It stays
`open`, and its hosted invoice URL is in every dunning email Stripe already sent.
So a member whose subscription was just canceled for nonpayment can still fix
their card days later and pay in full — and Stripe does **not** resurrect a
canceled subscription when its final invoice is paid out of band. Only
`invoice.paid` fires: money collected, no subscription, member left on `public`.

This is handled:

- **Automatically.** The `invoice.paid` handler runs
  `maybeRecoverOrphanPayment` (decision logic in `core/orphanPayment.ts`). When a
  paid, non-zero invoice leaves a `public` member with no live subscription, it
  re-creates the same plan with `billing_cycle_anchor` at the **end of the period
  that invoice paid for** and `proration_behavior: 'none'` — so the member gets
  exactly the access they bought, is not charged twice, and renews normally.
  Set `BILLING_ORPHAN_RECOVERY_ENABLED=0` to detect-and-log only.
- **Visibly.** Every case writes `billing_orphan_payment_detected`; recoveries
  add `billing_orphan_payment_recovered`. `make webhook-health` counts both and
  exits non-zero when a detected payment was neither recovered nor skipped.
- **At the right price.** The re-created subscription is a new Stripe object, so
  it starts with no discounts, and which coupons follow depends on their
  duration:
  - `forever` (founding lifetime 25%, a forever winback rate) is **carried
    across** — it is a permanent entitlement, and losing it would overcharge the
    member on every renewal from then on.
  - `once` is **not carried, and raises nothing**. It was spent in full on the
    invoice just paid — the standard Pro offer is "$229 first year, then $299" —
    so the undiscounted renewal is exactly what the member agreed to.
  - `repeating`, or a duration Stripe did not expand, is **not carried and IS
    flagged**, as `billing_orphan_payment_discount_review`, listed by
    `make webhook-health`. How much of a partly-spent coupon the member is still
    owed is a judgement call, not something to guess at.

  `make recover-orphan-payment` prints the decision for every coupon during its
  dry run, so the renewal price is visible before anything is written.
- **By hand,** for anything the automatic path declines (an unmapped price, a
  period that already elapsed, a one-off invoice) and for payments orphaned
  before this shipped — their `invoice.paid` is already in `stripe_webhook_events`,
  so re-sending it from the Dashboard is deduped, not replayed:

  ```
  make recover-orphan-payment EMAIL=<addr>          # dry run
  make recover-orphan-payment EMAIL=<addr> YES=1    # apply
  ```

If you would rather never collect on a subscription you have already canceled,
void the invoice at cancel time: `make cancel-subscription EMAIL=<addr>
--void-invoice` does this, and voiding is final.

---

## 4. Optional follow-up — app-level card-fingerprint trial dedupe (defense-in-depth)

Radar velocity rules (§2a) are the primary defense. If you want an app-level
backstop that does **not** depend on Radar for Fraud Teams:

- On the `trialing` transition in the webhook, resolve the subscription's default
  payment method → `card.fingerprint` (Stripe's stable per-card identifier,
  independent of the PAN/token).
- Look it up in a new `trial_card_fingerprints(fingerprint, user_id, first_seen_at)`
  table. If the fingerprint already granted a trial on a **different** account, end
  this trial immediately (`stripe.subscriptions.update(id, { trial_end: 'now' })`)
  so the card is charged now instead of getting another free week — a good card
  pays, a bad one declines and downgrades. Otherwise record it.
- Gate behind an env flag (default off) and validate in Stripe **test mode**
  (§5) before enabling, since it moves money earlier for flagged accounts.

Not shipped in this pass — it needs a migration + trial-grant interception and is
best added once you've confirmed Radar alone hasn't solved the farming.

---

## 5. How to test before trusting any of this in production

All of it is exercisable in **Stripe test mode** with test cards
(https://stripe.com/docs/testing):

- **Trial-end success:** `4242 4242 4242 4242` → trial converts to `active`.
- **Renewal failure → grace:** subscribe, then use the Dashboard to fail the next
  invoice (or attach `4000 0000 0000 0341`, which attaches fine then fails on
  charge). Confirm the member **keeps** their tier and you see a
  `billing_payment_grace_active` audit row; advance the test clock past
  `BILLING_PAYMENT_GRACE_DAYS` and confirm downgrade.
- **Trial-conversion failure → no grace:** start a trial with a card that will
  fail at conversion; confirm **immediate** downgrade (no grace), i.e. the abuse
  path is unchanged.
- **Radar rules:** `4000 0000 0000 0101` (CVC check fails),
  `4100 0000 0000 0019` (always-blocked/fraudulent) to confirm your Block rules fire.

Use a **Stripe test clock** to fast-forward trials and retries without waiting.

---

## 6. TL;DR priority order

1. **Deploy the code change** (grace window) + set `BILLING_PAYMENT_GRACE_DAYS`. Stops
   bleeding recoverable payers. *(done in code; needs deploy + env)*
2. **Turn on Radar rules** (§2a) + require CVC/postal (§2b). Stops bad-card trial
   farming. *(dashboard, ~30 min)*
3. **Align Smart Retries + terminal action** (§3). *(dashboard, ~10 min)*
4. **Set the portal config id** (§2d) so upgrades work. *(env + one-time script)*
5. *(Optional)* app-level fingerprint dedupe (§4) if farming persists.
