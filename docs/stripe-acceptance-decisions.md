# Stripe acceptance settings — decision record

Live billing configuration is not changed without the proposed change being
written down here first, with what it risks and how we would know it worked.
That rule comes from the audit brief this investigation started under, and it
is what makes a later shift in the decline metrics attributable to something
rather than a mystery.

Nothing in this file is a Stripe setting *as configured*. It is what we decided
and why. The change log at the bottom records what was actually done, and when.

Companion to `payment-decline-metrics.md`, which defines every figure used here.

## The evidence these decisions rest on

Snapshot taken 2026-09-17, per DECLINED INVOICE (never per attempt — Smart
Retries re-emit a failure for every try, and counting those triples the loss):

| Category | Invoices | First payments | Recovered | Lost | Never collected |
|---|---:|---:|---:|---:|---:|
| `insufficient_funds` | 63 | 60 | 10 | 51 | **$2,177.50** |
| `issuer_block` | 29 | 29 | 5 | 21 | $649.00 |
| `unknown` | 12 | 11 | 4 | 5 | $185.00 |
| `card_problem` | 8 | 8 | 0 | 7 | $263.00 |
| `try_again` | 6 | 3 | 0 | 6 | $164.00 |
| `blocked_by_risk` | 4 | 4 | 1 | 3 | $87.00 |
| **Total** | **122** | **115** | **20** | **93** | **$3,525.50** |

Reproduce it with:

```sql
WITH latest AS (
  SELECT invoice_id, category, kind, decline_code,
         ROW_NUMBER() OVER (PARTITION BY invoice_id ORDER BY failed_at DESC, attempt_count DESC) rn
    FROM payment_declines
), inv AS (
  SELECT l.invoice_id, l.category, l.kind, l.decline_code,
         (SELECT MAX(amount_due) FROM payment_declines a WHERE a.invoice_id = l.invoice_id) amount,
         (SELECT MAX(outcome = 'recovered') FROM payment_declines a WHERE a.invoice_id = l.invoice_id) recovered,
         (SELECT MAX(outcome = 'lost') FROM payment_declines a WHERE a.invoice_id = l.invoice_id) lost
    FROM latest l WHERE l.rn = 1
)
SELECT category, COUNT(*) AS invoices,
       SUM(kind IN ('trial_conversion','first_charge')) AS first_pay,
       SUM(recovered) AS recovered,
       SUM(recovered = 0 AND lost = 1) AS lost,
       printf('$%.2f', SUM(CASE WHEN recovered = 0 AND lost = 1 THEN amount ELSE 0 END)/100.0) AS lost_money
  FROM inv GROUP BY category ORDER BY invoices DESC;
```

The `inv` CTE does not survive between statements, so any follow-up query has to
repeat the two CTEs above. Swap the final `SELECT` for this to itemize the
Radar blocks:

```sql
SELECT decline_code, kind, COUNT(*) AS invoices, SUM(recovered) AS recovered,
       printf('$%.2f', SUM(CASE WHEN recovered = 0 THEN amount ELSE 0 END)/100.0) AS never_collected
  FROM inv WHERE category = 'blocked_by_risk' GROUP BY decline_code, kind ORDER BY invoices DESC;
```

Two things to read off the table before reading any decision below.

**94% of declined invoices are first payments** (115 of 122). This is a
trial-conversion problem, not a churn problem, and every remedy has to be judged
against a card that was added seven days earlier — not one that has aged.

**The acceptance-optimizable share is small.** Everything Stripe's acceptance
products aim at is `issuer_block` + `blocked_by_risk` = $736, **21% of the
loss**. A realistic few-percent lift on that is tens of dollars. Meanwhile
`insufficient_funds` alone is $2,177.50, **62%**, and no acceptance product
touches it: none of them puts money into somebody's account on the day we charge
it.

*Footnote on `try_again`: 0 of 6 recovered, while `declineReason.ts` tells the
reader they are "very likely to clear on the next automatic retry". At n = 6
that is not conclusive, but it does contradict copy we ship. Worth a look
separately; it is not a Stripe-configuration question.*

## Decisions

### 1. Radar block rules — DO IT, but for correctness, not revenue

**What changes.** Dashboard → Radar → Rules. The `requested_block_on_incorrect_zip`
and `requested_block_on_incorrect_cvc` declines are most likely Stripe's
*default* block rules rather than anything we wrote; they are enforced on
subscription flows when Radar evaluates Setup Intents, which our trial does (we
gate on `pending_setup_intent`). Stripe now ships adaptive versions of these two
rules that combine the issuer's CVC/postal response with a risk score instead of
blocking outright, and reports +1.3pp payment success at minimal fraud cost.

**Confirm before changing.** These rules were INFERRED from decline codes. Open
Radar → Rules and check which are actually active, and whether they are Stripe
defaults or custom, before touching anything.

**What it is worth: $87.** Four invoices, one of which recovered. That is the
whole prize, and it is not a revenue argument.

**Why do it anyway.** It is the only category where *we* refused the money rather
than a bank, and the member cannot see or fix a rule they do not know exists —
which is exactly what the admin panel already says when it fires. It is cheap,
instantly reversible, and it is the right behaviour. Do it because it is correct,
and do not expect the metrics to move.

**What it risks.** Genuine fraud getting through. Mitigated here by population:
these are members who completed a seven-day trial on a verified email address,
which is not the anonymous-first-checkout profile the default rules are tuned for.

**How we would know.** `category = 'blocked_by_risk'` in the query above should
trend to zero. At four invoices, expect to wait a quarter before the absence
means anything.

### 2. Authorization Boost — ENABLE IF INCLUDED, do not pay much for it

**What changes.** Network tokens, card account updater and Adaptive Acceptance
are no longer three separate toggles; Stripe bundles them as Authorization Boost.
Published effect is +3.8% acceptance on average, explicitly incremental — it only
counts features not already in use.

**Check the price first.** Network tokens are 15¢ per token provisioned for
accounts without Authorization Boost on custom interchange pricing, and Stripe
quotes Boost pricing individually. This is the only item on the list with a bill
attached; confirm our account's terms before enabling.

**What it is worth.** It aims at `issuer_block` — $649, 18% of the loss. A few
percent of that. Real, small.

**What it risks.** Very little operationally. All Stripe-side, reversible.

**Card account updater specifically is worth ~$0 to us today.** It fixes stale
saved credentials, which is a renewal problem. All 8 `card_problem` invoices are
first payments, and a card added seven days ago is not stale. This will matter as
the subscriber base ages. It does not matter now.

**How we would know.** `issuer_block` invoice count and the overall first-payment
decline rate in `make decline-by-source`. Note the enable date below — without it
the comparison is unattributable.

### 3. Link prominence — MEASURE, do not flip blind

**What changes.** Nothing in code: `app/api/billing/checkout/route.ts` sets no
`payment_method_types`, so Stripe's Dashboard payment method configuration
decides entirely. Step one is to look at what is already configured.

**The evidence, and why it is weaker than it looks.** The Stripe audit put
card-entry at 58.9% against Link's 30.2%. That comparison is **confounded**, and
more so than the debit/credit one. Debit has a mechanism that holds regardless of
who chose it: an off-session charge needs the money to be in the account at that
moment. Link does not. People who use Link are people who already have a working
saved card that has succeeded elsewhere, so the gap mixes "Link makes payment
work better" with "Link users have better cards". There is a real causal
component — a previously-used card, fewer typos, network-token eligibility — but
this data cannot size it.

**It probably does not touch the 62%.** Link supplies a known-good card. It does
not supply a balance. Whatever it is worth, it is worth it against
`issuer_block` and `card_problem`, not `insufficient_funds`.

**What it risks — and it is not declines.** Link adds an email one-time-code step
at signup. The cost lands on trial STARTS, at the top of the funnel, where none
of this investigation has been looking. On a free trial that is a bad trade to
make without measuring.

**How we would know.** Both instruments already exist: trial starts in the daily
metrics rollup, and the payment-method split in the decline report. Change it,
record the date below, compare 30 days on **both** — a conversion gain that costs
more trials than it wins is a loss.

## What none of this addresses

$2,177.50 — 62% of everything lost — is `insufficient_funds` on a first payment,
and the recovery rate on it is 10 of 63 (16%). Every item above is acceptance
optimization, and acceptance optimization cannot fix an empty account.

What plausibly moves it:

- **The debit timing line in the trial reminder.** Already shipped: members whose
  card on file is debit or prepaid are told the date the funds need to be
  available. Debit declined at 77% against credit's 33% in the audit, and that
  gap has a mechanism rather than a correlation.
- **Retry timing relative to payday.** Smart Retries chooses when to retry, but
  the window and attempt count are configurable. The audit found 53 of 80
  invoices reaching five attempts, so retries are running; whether they land on
  useful days of the month is a separate question nobody has asked.
- **Recovery on the bucket, rather than acceptance.** Each 10 points of recovery
  on `insufficient_funds` is roughly $340 — more than every decision above
  combined, twice over.

Retry policy is explicitly behind approval under the audit brief and is NOT one
of the items decided here. Recorded because, on the evidence, it is worth more
than all three decisions above.

## Change log

Fill a row in when a setting actually changes. The date is the point of this
table: without it, a later move in the decline rate cannot be attributed to
anything.

| Date | Change | Made by | Baseline before | Reviewed |
|---|---|---|---|---|
| _(none yet)_ | | | | |
