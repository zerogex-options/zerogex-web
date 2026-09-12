# Growth metric definitions

Admin → Monitoring → **Growth**. Every number on that page is defined here, in
the words the code uses. Where a definition has a sharp edge, the edge is stated
rather than smoothed over — the point of writing these down is that two people
reading the same figure should reach the same conclusion.

Implemented in `frontend/core/cohortRetention.ts` (lifecycle),
`frontend/core/renewalRetention.ts` (renewals and risk) and
`frontend/core/growthStory.ts` (the headline arithmetic). All three are pure and
unit-tested; see `frontend/tests/`.

## Who is counted

Customers only. Three kinds of account hold a paid tier without ever having been
a commercial customer and are removed from the source rows before anything is
counted — the operator's admin account, creator partners on a comped Pro grant,
and comped members. See `frontend/core/excludedAccounts.ts`.

## Paid access

The spans during which a customer could use what they bought. A span opens on a
subscription sync carrying an entitled tier (`basic`, `pro`, `starter`, `elite`)
and closes on a sync that drops to a non-entitled tier, or on a Stripe
subscription deletion.

**A scheduled cancellation does not close a span.** The customer has paid through
the end of the period and still has everything they bought. Access ends when
Stripe actually deletes the subscription.

## Trial → paid

    customers who started a trial AND later paid
    ─────────────────────────────────────────────
           customers who started a trial

The numerator is the **intersection**, never the whole ever-paid population.
Customers who paid without a trial are reported separately as **direct to paid**
and never enter this numerator. Dividing all payers by trial starters is what
previously produced rates above 100%.

## 30 / 60 / 90-day retention

A customer is **eligible** for the N-day milestone when either:

* N days have passed since their first payment, **or**
* their paid access has already ended for good before day N.

The second clause is load-bearing. A customer who paid ten days ago and lost
access on day seven cannot reach day thirty, so the answer is known and they
belong in the denominator. Excluding them until day thirty arrives — which the
earlier implementation did — removes exactly the fastest churners and makes
retention look better the worse it gets.

**Retained** means the customer had paid access at the milestone instant, read
off the access spans above. Not current subscription status: a customer who
cancelled on day 40 was still retained at day 30.

Every figure is shown as `rate (successes / eligible)`.

## Renewal

A renewal is a **`subscription_cycle` invoice that actually cleared**. It is
never inferred from access having lasted about a month.

* `subscription_create` is the first payment, not a renewal.
* `subscription_update` is a mid-period proration from a plan change. Real money,
  not a renewal.
* The ladder follows **one subscription** — the one that took the first payment.
  A customer who lapsed and resubscribed months later has a second
  `subscription_create`, which is a new subscription, not the old one renewing.

**Renewal #1** is payment #2, **#2** is payment #3, **#3** is payment #4. Each
step is asked only of customers who cleared the step before.

Every monthly customer is in exactly one of four states per step:

| State | Meaning |
| --- | --- |
| **Eligible** | The period ended, so an outcome exists. Renewed, or not. |
| **Approaching** | The period is still running. No outcome yet, so outside every denominator. A cancellation already scheduled here is next month's rate, visible now. |
| **Settled early** | Paid access is already gone for good, so the answer is no even though the due date is in the future. Counted as eligible and not renewed. |
| **Unobservable** | The period ended before the invoice record began, or no billing period is on file. Reported as unknown — **never** as a failure. |

A non-renewal is attributed to a **failed payment** (a decline within 3 days
before to 35 days after the due date), a **voluntary** decision (a cancellation
request before the due date), or left **unattributed**.

Annual subscribers are excluded from the ladder entirely. Their first renewal is
a year out; averaging it with a 30-day question describes neither.

### Observability

`observableFrom` is the earliest paid invoice anywhere in the data. Anything due
before it is unobservable, because the absence of a renewal invoice back there is
the absence of a record, not evidence of a failure.

The app only began writing `stripe_invoice_paid` audit rows when that event type
shipped. `make backfill-stripe-invoices` imports the real invoice history from
Stripe (read-only, analytics-only) into `stripe_invoice_history`, which is what
moves most customers out of the unobservable bucket.

## Scheduled cancellation

`cancel_at_period_end` is set and paid access has not yet ended. The customer is
**still paying** and stays in the active headcount until their access actually
runs out. It is reported as a forward-looking risk, never as churn that has
happened.

## Voluntary / involuntary churn

Applied only to a loss that **still stands** — a customer who lapsed and came
back has no churn kind, because they are a current subscriber.

* **Voluntary** — a `stripe_cancellation_requested` event before access ended.
* **Involuntary (nonpayment)** — a `stripe_payment_failed` event within the 35
  days before access ended, and no cancellation request.
* **Other / unknown** — access ended with neither on record. The audit trail
  cannot attribute a cause, and the dashboard says so rather than guessing.

Cancellation-request events only exist from 2026-07-29, so losses older than
that can only be classified as unknown.

## Access interruption vs. permanent loss

Two different populations, never merged under the word "lost":

* **Interrupted within N days** — paid access stopped within N days of the first
  payment, whether or not the customer came back.
* **Still gone within N days** — it stopped and has not resumed.

The difference is customers who reactivated.

## Paid-customer states

Every customer who has ever paid is in exactly one of four current states, and
the four always sum to the ever-paid count (the report throws if they do not):

| State | Rule |
| --- | --- |
| **Active** | Has paid access right now. Includes scheduled cancellations and `past_due` grace. |
| **Voluntarily churned** | Not entitled; the standing loss was a cancellation. |
| **Involuntarily churned** | Not entitled; the standing loss followed a decline. |
| **Other / unknown** | Not entitled; the cause cannot be attributed. |

## Billing cadence

Read from the current Stripe price where there is one. A cancelled subscription
has its `stripe_price_id` nulled, so for churned customers the cadence is
recovered from the `price=` token on a paid invoice, then from the `cadence=`
token on their `billing_checkout_started` audit row. Anything still unresolved is
reported as **cadence unknown** rather than dropped — a cadence filter that
silently deletes every churned customer computes its rates over survivors only.

## Attribution

`utm_source` captured at signup, never rewritten afterwards.
**Organic / direct / unattributed** means no UTM source was captured; it can
include organic search, direct visits, untagged social and referral links, and
word of mouth.

## Revenue at risk

Scheduled cancellations priced exactly the way the MRR snapshot prices a
subscriber: map the price id to a SKU, take the founding rate where it applies,
and let an unmappable price contribute **$0 rather than a guess**. The amount
table is monthly-normalized, so an annual contract at risk is twelve of those.

## Checking it by hand

`make audit-customers` prints, for one customer of each of thirteen shapes, every
event the dashboard reads and every conclusion it draws — registration, trial,
first payment, each successful invoice with its billing reason, cancellation
request, access end, failures and reactivations — so the classification can be
checked against Stripe rather than trusted. `EMAIL=<addr>` traces one customer.
