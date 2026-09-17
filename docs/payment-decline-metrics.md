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

Open declines whose closing event never arrived are reconciled on every read of
the panel, in descending order of certainty:

1. **Paid in the invoice ledger** → recovered, dated by the payment. The
   webhook's own resolve was missed (an outage, or the decline was backfilled
   after the payment cleared).
2. **The subscription was deleted**, per the audit log → lost to a cancellation,
   dated by that event. This is the real reason most declines die.
3. **Nothing has happened on the invoice for 30 days** → *unresolved*. Stripe's
   retry schedule runs out at about three weeks and both of its endings emit an
   event, so a row still open past thirty days is one whose closing event never
   arrived. "Never seen to recover" is a weaker claim than "known to be gone",
   and the report makes the weaker one.

**An unresolved close is not final** — that is the point of having made the weak
claim. Passes 1 and 2 reconsider rows already closed as *unresolved* alongside
the open ones, so evidence arriving later (most often a
`make backfill-stripe-invoices` import bringing in years of payments the ledger
could not previously see) revises them to recovered, or upgrades them to a
cancellation. A cancellation or a write-off is a **fact the log recorded** and is
never revisited; only the weak claim is revisable.

### Run order matters

A decline is settled against the payments this database can see. Run
`make backfill-stripe-invoices` **before** `make backfill-payment-declines`, or
collected money is reported as unresolved. The decline backfill prints the size
of the invoice ledger on every run and warns when it is empty. Getting the order
wrong is recoverable — re-running after the import revises those closes — but the
report is wrong in the meantime, and wrong in the direction that overstates the
loss.

The age sweep works **per invoice, not per attempt**: an invoice Stripe retried
last week is not stale because its first attempt was five weeks ago, and closing
only the old attempt would leave one invoice half open and half lost, with the
surviving attempt carrying no reason at all.

A lost invoice reports the reason of the attempt that **closed** it, not of its
last retry — closing events land against whichever attempts were open at the
time.

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

`trial_conversion` and `first_charge` are the **same loss** — a conversion that
did not close, by a member who has never paid — and the report rolls them up into
a single **First payment** figure. They are stored apart for one reason worth
keeping: the card behind a trial conversion has been sitting on file since the
trial started, while a no-trial first charge runs on a card that cleared Checkout
minutes ago, and card-on-file age is a real decline driver. Where only one path
is live, the other is simply empty and never renders.

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
    blocked_by_risk          WE declined it — Stripe Radar scored the payment too
                             risky and no bank ever saw it. Kept apart from
                             issuer_block because the remedy is the opposite one:
                             nothing the member does can help, and the decision is
                             ours to review. A false positive here is revenue
                             turned away by our own rules.
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

## Retry state — where an unpaid invoice actually stands

"Nobody has paid this" and "Stripe is going to try again" are different claims,
and only the second is a reason to wait. Reporting every open decline as in
flight quietly converts revenue that needs a human into revenue that looks
handled, so the state is read from the invoice's own fields and never inferred
from the invoice merely being unpaid:

    retry_scheduled          Stripe has a next attempt queued, in the future.
                             The only state where doing nothing is a plan.
    authentication_required  3DS was not completed. No retry clears it.
    payment_method_required  the card itself is unusable. Needs a new one.
    hard_decline             the network said do not retry.
    recovery_exhausted       no attempt queued, or the invoice is void or
                             written off. Stripe has stopped.
    manual_collection        collection_method is `send_invoice`, so Stripe will
                             never charge it at all.
    unknown                  we do not hold the invoice state needed to say —
                             notably every row reconstructed from the audit log
                             whose invoice has not been re-read.

`unknown` is a real answer, not a placeholder. Rows written before this was
captured say so rather than claiming a retry that may not exist;
`make backfill-payment-declines RECHECK=1` resolves them.

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

### Reading a reason off an invoice that was later PAID

A recovered invoice's latest charge is the one that **succeeded**, and a
successful charge carries no decline data at all. Reading only it reports every
recovered invoice as having failed for no reason — which silently breaks
recovery-by-reason, the most actionable cut on the page, because the recovered
invoices all pile into "no usable decline code" and every real reason's recovery
rate reads near zero.

So when the cheap reads come back empty, the lookup walks every payment intent
the invoice attempted through and collects the charges that FAILED, oldest first.
The first failure is the reason the invoice entered dunning, and it is what the
invoice is reported against; where several are recovered, each attempt is lined
up with its own rather than one reason being stamped across every retry.

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
and settle each against the payments and cancellations that followed. It never
recorded **why**, so those rows land in "No usable decline code" with
`source = audit_backfill`, and the coverage note states the split. A second pass
re-reads each of those invoices from Stripe to stamp on the real reason where it
is still retrievable; it never overwrites a reason the webhook already captured.

### Classifying what the audit log could not

A reconstructed decline has no billing reason, so classification falls back to
needing the $0 trial-opening invoice as proof the subscription had a trial — and
`make backfill-stripe-invoices` skips zero-amount invoices, because they are not
payments. Both decisions are right on their own, and together they leave every
reconstructed decline as `unknown`: the record that says "this was a trial" is
the one nobody imports.

Reading an invoice is recorded as a fact in its own right, and it is what stops
the enrichment worklist re-asking Stripe about a charge it already answered for.
`RECHECK=1` lifts that once, for the case it exists for: rows settled by an
earlier reader that kept less than the current one does.

The Stripe enrichment pass resolves it. It fetches each real invoice and stamps
the actual `billing_reason`, after which the ordinary rule applies and needs no
trial marker: a `subscription_cycle` invoice on a subscription that has never
collected money **is** the first charge at the end of a trial. A third pass then
re-runs the classifier over rows still sitting on `unknown`. It only ever moves a
row OFF `unknown`, never revises a kind decided with better evidence, and works
per invoice so retries of one charge cannot land under two different kinds.

**The amount on a reconstructed row is an estimate**, because the audit message
never carried one. It is resolved in this order, and replaced with the real
figure the moment the Stripe pass runs:

1. what that subscription was last actually charged before the failure;
2. anything that subscription was ever charged;
3. what that member pays on any other subscription;
4. the median positive invoice amount across the ledger — the product's
   prevailing charge.

Steps 3 and 4 exist because the obvious implementation returns **zero** for
exactly the cohort that matters most. A trial conversion that declined and never
recovered has, by definition, no successful positive invoice on its subscription
— only the $0 trial opener. Estimating from that subscription alone reports every
lost conversion as costing nothing, and the headline loss figure reads $0 while
real money walks out of the door. Under-reporting a loss as zero is the worst of
the available errors.

## Acquisition source — the one cut with a denominator on both sides

Every instrument breakdown on the panel (card brand, funding, issuing country,
wallet vs. typed card) is a **share of the failures**, never a rate. A successful
charge leaves no row in `payment_declines`, so the card behind it is not there to
divide by. "Debit is 40% of my declines" and "debit declines 40% of the time" are
different claims and only the first is supported.

A successful charge does leave a **member**, and a member carries a first-touch
`users.signup_utm_source`. So both sides of the ratio exist, and this cut reports
a real rate:

    declined invoices from source S
    ───────────────────────────────
    every invoice charged to a member from source S

It exists to answer a question the rest of the panel structurally cannot: whether
a slice of the lost conversions was ever a billing problem at all. If one
channel's trial signups decline at twice everyone else's rate, no retry tuning,
card-update prompt or dunning rewrite will recover them — the fix is upstream, in
what that channel is sending.

Read it in the **first payments** scope by default. A renewal that declines says
something about a card, often years after the click that won it; a trial
conversion that will not close is the campaign's own result.

    make decline-by-source                    # first payments, 90 days
    make decline-by-source SCOPE=all DAYS=0   # every charge, all time

That command is read-only: no Stripe call, no email, no write, and the report's
reconcile pass is explicitly disabled.

### Resolved at read time, not stored

The channel is joined from `users` when the report is built rather than stamped
onto each decline row. First-touch attribution is set once at signup and never
changes, so the join cannot drift from a stored copy — and unlike a column it
answers for the whole back catalogue on the first deploy instead of only for
declines recorded after a migration. On a decline table that matters more than
usual: the rows most in need of explaining are the oldest ones.

Deleted members are included. Their invoices really were charged and really did
decline; dropping them would not remove those charges from the report, it would
move them into the unattributed bucket and make coverage look worse than it is.

### Three buckets that are not channels

    (direct / none)      a member we know who arrived with no campaign on them.
                         A real channel — organic search, word of mouth, a link
                         somebody pasted — and usually the largest one.
    (before tracking)    a member we know who signed up before first-touch
                         attribution existed. Their channel was never recorded
                         and never will be.
    (no local account)   an invoice that could not be tied to an account here —
                         a deleted member, a Stripe customer created outside
                         signup. A data-quality bucket.

Collapsing the second into the first is how this report starts lying: it credits
organic with the entire pre-tracking back catalogue. The boundary between them is
the **earliest signup carrying a campaign**, which is a lower bound on when
tracking began, not the deploy date — if the first tagged signup arrived a week
after the feature shipped, that week's organic signups are filed as untracked.
That errs toward admitting ignorance rather than inventing certainty.

Unattributable invoices keep their own row rather than being dropped. Dropping
them would shrink the denominator and lift every rate on the page.

### Two guards against over-reading

**A 95% Wilson interval on every rate.** The whole job of this cut is comparing
channels, and at campaign volumes a point estimate cannot do it. Nine declines
out of twenty is 45% and also anywhere from 26% to 66%, which overlaps nearly
every other row. Wilson rather than the normal approximation because it stays
inside [0, 1] and does not collapse to zero width at 0% or 100% — exactly where
the small campaigns sit. **Two channels whose ranges overlap have not been shown
to differ, however far apart their percentages look.**

**An attribution-skew warning.** If declines resolve to a member 98% of the time
and successful charges only 60% of the time, every named channel is missing two
fifths of its denominator and every rate is inflated — uniformly enough to look
like a real signal. The panel publishes both coverage figures and refuses to
present the rates as comparable when they diverge (`sourceRatesAreSkewed`). An
empty window is *not* that condition: nothing measured is not the same as
something skewed.

Rows under 25 charges are dimmed and marked. At a ~40% base rate the 95% interval
is still wider than ±18 points at n = 30, so anything thinner is a hint to go and
look, never a finding to act on.

## Reading the panel

Color is **what happened to the money** — recovered, at risk, lost — and never
the cause or the charge kind. Cause and kind are facets: rows drawn in the same
three colors, so "do trial conversions recover as well as renewals" reads as a
shape comparison down a column rather than as a color-matching exercise. The
palette and its accessibility validation are in
`frontend/app/admin/monitoring/declines/palette.ts`.
