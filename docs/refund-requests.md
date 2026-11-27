# Refund requests: the courtesy rule

For a refund the money-back guarantee doesn't cover: a free trial that turned
into a paid month, or a renewal. (A first payment on a plan with the guarantee
refunds itself from the Account page within 7 days.) The Terms say these
charges are non-refundable, and the help pages no longer invite exceptions.

## The rule

Give **one courtesy refund per customer**, and only when all of these hold:

1. They canceled.
2. They asked within a day of the charge.
3. They haven't used the time since the charge. The visit to cancel doesn't
   count.
4. They've never had a refund before, of any kind.

Then refund the latest payment in full, end the plan now, and say in the reply
that it's a one-time courtesy.

Anyone else gets no refund. Their cancel already stops the next charge, and
they keep access until the end of the period they paid for. Reply politely with
the terms.

**Why refund at all:** a refused customer can dispute the charge with their
bank. A dispute costs a $15 fee and counts against your dispute rate even when
you win, and with a small number of charges, one or two disputes move that rate
a lot. Unused paid time is the line between an honest mistake and mooching.

## Checking it

```bash
make diagnose-user EMAIL=<their email>
```

- **The charge:** the newest line under "Stripe invoices", `status=paid`, and
  its `paid=` time.
- **Canceled:** `Cancel at period end` reads yes, or the status is `canceled`.
  The `billing_cancel_flow_submitted` line gives the time.
- **Asked within a day:** their email's time, against the charge.
- **Unused:** `Last seen`, and any `login_success` lines after the charge. The
  login right before the cancel is fine. Days of use before canceling is a no.
- **Never refunded:** no `refund_issued` or `money_back_refund_issued` line in
  the recent events, and no refunded payment on their Stripe customer page.
  You'll be on that page anyway for the refund.

## A yes

1. **Refund in the Stripe Dashboard.** Open the customer and the payment
   they're asking about. Not an earlier one: on a renewal, there's more than
   one. Choose Refund, full amount, reason **Requested by customer**. Never
   "Fraudulent", which puts their card and email on your block list. If the
   payment shows as disputed, stop and answer the dispute instead.
2. **Preview the cancel**, in `~/zerogex-web` on the server:

   ```bash
   make cancel-subscription EMAIL=<their email> FORCE=1 DRY_RUN=1
   ```

   Check for `Auth DB: /var/lib/zerogex/auth.db`, `Open invoices: 0` and a
   tier going to `public`.
3. **Apply** with `YES=1` in place of `DRY_RUN=1`. Access ends, API keys are
   revoked, and they get no email from it.
4. **Send the reply.**

Never use `make money-back-refund` for these. The guarantee doesn't cover
trial conversions or renewals, and with `FORCE=1` it refunds every payment on
the plan, not just the last one.

## Replies

Each paragraph is one line, so it pastes cleanly. Keep the "why" question only
if they gave no reason when they canceled.

**Yes:**

Hi <name>,

I've refunded the <amount> and closed your plan. The refund usually shows up within 5 to 10 business days.

Just so you know, <charges after the free trial ends | renewals> aren't refundable under our terms, so this was a one-time courtesy.

One question, if you don't mind: why did you cancel? One line is plenty.

Best,
Michael

**No:**

Hi <name>,

<Charges after the free trial ends | Renewals> aren't refundable under our terms, so I'm going to leave this charge in place. Your cancellation went through: you won't be charged again, and you keep full access until <end of the paid period>.

One question, if you don't mind: why did you cancel? One line is plenty.

Best,
Michael

If someone who got a no mentions their bank or a chargeback, refunding is
usually cheaper than the dispute. Your call.

## Cases so far

All four fit the rule and were refunded: Lee (Oct 30), Jose (Nov 18), Nolan
(Nov 26) and Jesse (Nov 27). Notes in `docs/outreach/`.

## Worth knowing (can wait)

The money-back guarantee's one-refund limit reads only its own ledger
(`hasPriorMoneyBackRefund` in `frontend/core/moneyBackServer.ts`), and a
Dashboard refund never reaches that ledger. So a customer who got a courtesy
refund and later buys a plan with the guarantee could still get a second
refund through it. Rare. The fix is to have that check count these refunds
too.
