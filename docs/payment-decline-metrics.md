# Payment decline metrics

Admin → Monitoring → **Stripe** → **Payment Declines**. Every number on that
panel is defined here, in the words the code uses. Where a definition has a sharp
edge, the edge is stated rather than smoothed over — the point of writing these
down is that two people reading the same figure should reach the same
conclusion.

Implemented in `frontend/core/paymentDeclines.ts` (pure arithmetic, unit-tested
in `frontend/tests/paymentDeclines.test.ts`) and
`frontend/core/paymentDeclinesServer.ts` (capture, resolution and the read, tested
in `frontend/tests/paymentDeclinesDb.test.ts`). The reason itself is classified by
`frontend/core/declineReason.ts`, which is the same module `make diagnose-user`
uses, so a category means the same thing in both places.

## What is being measured

Revenue that did not arrive because a card said no. It is the only kind of lost
revenue nobody chose: the member did not cancel, did not complain, and in most
cases does not know. It is also the only kind that frequently comes **back** —
Stripe's Smart Retries collect a large share of insufficient-funds declines
within days — so a decline is not a loss until it has stopped being recoverable.

## Who is counted

Customers only. The same three kinds of account the Growth page removes are
removed here — the operator's admin account, creator partners on a comped Pro
grant, and comped members (`frontend/core/excludedAccounts.ts`). A card that was
never going to be charged commercially cannot lose revenue. The rows are still
**recorded**; they are only held out of the report.

## The counting unit

Stripe re-emits `invoice.payment_failed` for every Smart Retry, so one unpaid
invoice can produce four declines.

* An **attempt** is one `invoice.payment_failed`.
* An **invoice** is one thing Stripe was trying to collect.

Attempts and invoices are counted separately everywhere, and **money is always
counted per invoice**. Summing `amount_due` over attempts would report a $49
renewal that retried three times as $147 at risk.

**Distinct invoices, not events, are the denominator too.** An invoice that
declined and was then paid is *one* attempt at collecting money, so it appears
once in "charged", not twice.

## The three outcomes

    open       still unpaid and still recoverable — Stripe has retries left,
               or the member is inside the payment-recovery grace window
    recovered  the same invoice was later PAID, by any route
    lost       the subscription was cancelled, or the invoice was voided or
               marked uncollectible, with the attempt still unpaid

They are never added together, and an open decline is never reported as a loss.

An attempt with no closing event after **30 days** is closed as *unresolved*
rather than lost-to-a-cause. Stripe's retry schedule runs out at about three
weeks and both of its endings emit an event; a row still open past thirty days is
one whose closing event never arrived. "Never seen to recover" is a weaker claim
than "known to be gone", and the report makes the weaker one.

## The three rates

Each answers a different question, and they share no denominator by accident.

**Decline rate** — how often the card says no.

    declined invoices
    ─────────────────────────────────────
    every invoice charged in the window

**Net loss rate** — what that actually costs after the retries have run.

    declined invoices that never recovered
    ──────────────────────────────────────
    every invoice charged in the window

**Recovery rate** — of the ones that *resolved*, how many came back.

    recovered
    ─────────────────
    recovered + lost

Open invoices are excluded from the recovery denominator on purpose. Counting an
invoice Stripe will retry tomorrow as "not recovered" reports every fresh decline
as a failure, and makes the rate sag whenever volume rises.

**Trend caveat.** An open decline in the current window has had less time to
recover than one in the prior window. Read a softer recovery rate as incomplete
before reading it as a regression.

## Charge kinds

The distinction the money view turns on. A declined first charge is a sale that
never closed; a declined renewal is a paying customer on the way out.

    trial_conversion  the FIRST charge at the end of a free trial — this member
                      has never paid
    first_charge      the first charge of a subscription with NO trial
                      (checkout straight to paid)
    renewal           an established paying customer's recurring charge —
                      involuntary churn in progress
    other             prorations, plan-change and manual invoices; real money,
                      but neither a conversion nor a renewal, so it is kept out
                      of both rates
    unknown           no billing reason and no subscription history to infer
                      from — never guessed into a real bucket

**Every kind is rated against its own attempt volume.** Forty declined
conversions is a catastrophe against a hundred conversion attempts and a footnote
against four thousand, and the blended rate across all charges is the wrong scale
for both — renewals usually outnumber conversions many times over.

**How the kind is decided.** Stripe's `billing_reason` is `subscription_cycle`
for a trial conversion *and* for a renewal, so it cannot be used alone. In order
of authority:

1. the subscription's own `trial_end` versus this invoice
   (`frontend/core/trialDunning.ts`) — the webhook's answer, and the only source
   event ordering cannot corrupt;
2. money already collected on that subscription → renewal;
3. a $0 `subscription_create` invoice seen first → the subscription had a trial,
   so its first real charge is the conversion;
4. `subscription_create` with a real amount → no trial, first charge.

The $0 trial-opening invoice is never a charge. A proration never consumes the
"first money on this subscription" slot either, or a member who upgraded during
their trial would have their real conversion reported as a renewal.

## Decline reasons

Grouped by what each one means you should **do**, not by Stripe's raw code — a
bank blocking an unfamiliar recurring charge and an account that was simply short
are opposite problems with opposite remedies.

    insufficient_funds       account was short. Retries often clear on their own.
                             Do NOT tell them to call their bank.
    issuer_block             the issuer refused an otherwise-valid card. The
                             member has to approve it with their bank.
    card_problem             the card is unusable (expired / mistyped /
                             unsupported). The one case where "update your card"
                             is the right ask.
    authentication_required  3DS/SCA was not completed.
    try_again                transient on Stripe or the issuer.
    unknown                  no usable decline code. Never guessed.

Three alphabets feed this, read most-specific first: Stripe's normalized
`outcome.reason`, then the raw ISO-8583 `outcome.network_decline_code` (`51`,
`05`, …), then the coarse `failure_code`. They are kept apart deliberately —
mixing them means a numeric lands in a string lookup and silently classifies as
`unknown`. `card_declined` is a bucket, not a reason, and is never mapped.

**An invoice is attributed to the reason of its LAST attempt.** A card that was
short on Monday and blocked by the issuer on Thursday is stuck on the block;
telling the member to wait for payday would be the wrong advice. Attempt-level
counts sit beside it, which is why attempts exceed invoices.

## Recovery route

Whether Stripe's own retry collected the money or the member had to act. Only the
second half is addressable — it is the cohort a better dunning email actually
moves.

**Inferred, not reported.** Stripe publishes no "who paid this" field, and asking
for one would cost an API call per paid invoice on the hot webhook path. A
payment landing at or after the retry Stripe had queued is credited to the retry;
one landing before it to the member, with 15 minutes of slack for clock skew. An
invoice with no scheduled retry to compare against is left unattributed.

## Recovery lag

Time from an invoice's **first** failure to the money clearing — not from its
last retry. The member was without a settled invoice for the whole span, and that
is what an "at risk" balance is worth waiting for. Reported as a median, a 90th
percentile and five buckets.

## Where the data comes from

**Declines** are captured by the Stripe webhook the moment a charge fails
(`app/api/webhooks/stripe/route.ts` → `recordPaymentDecline`). This is not
optional timing: Stripe puts the decline reason on the charge and never hands it
to you again, so a reason missed at failure time can only be recovered one API
read at a time. The row is stamped again when the invoice is later paid
(`invoice.paid`), when the subscription is deleted
(`customer.subscription.deleted`), or when the invoice is voided or written off.

Capture is **best-effort everywhere**. The Stripe lookup swallows its own errors
and the DB write swallows its own; a 500 in the webhook would make Stripe retry
the event, which re-sends the member's dunning email. Reporting must never be
able to break billing.

**Successful invoices** — the denominator — are read from two sources, deduped on
invoice id: `stripe_invoice_history` (imported from Stripe by
`make backfill-stripe-invoices`) and the `stripe_invoice_paid` audit rows the
webhook writes.

**History that predates the tracker** is reconstructed by
`make backfill-payment-declines`. The audit log recorded that a charge failed,
with its invoice, subscription and attempt number — enough to count declines,
place them in time, split conversions from renewals against the invoice ledger,
and settle each against the payments that followed. It never recorded **why**, so
those rows land in "No usable decline code" with `source = audit_backfill`, and
the coverage note states the split. A second pass re-reads each of those invoices
from Stripe to stamp on the real reason where it is still retrievable; it never
overwrites a reason the webhook already captured.

## Reading the panel

Color is **what happened to the money** — recovered, at risk, lost — and never
the cause or the charge kind. Cause and kind are facets: rows drawn in the same
three colors, so "do trial conversions recover as well as renewals" reads as a
shape comparison down a column rather than as a color-matching exercise. The
palette and its accessibility validation are in
`frontend/app/admin/monitoring/declines/palette.ts`.
