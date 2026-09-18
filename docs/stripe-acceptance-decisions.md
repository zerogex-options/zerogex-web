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

*Footnote on `try_again`: 0 of 6 recovered, against copy that promised they were
"very likely to clear on the next automatic retry". Investigated and fixed — the
six had made 27 attempts between them, so the retries demonstrably ran and every
one failed. See `payment-decline-metrics.md`, "When a transient code stops being
transient". Not a Stripe-configuration question.*

## Decisions

### 1. Radar block rules — CLOSED: already configured correctly

**Proposed, then withdrawn on inspection.** The recommendation was to migrate
the CVC and postal-code block rules to Stripe's adaptive versions, which fold the
issuer response together with a risk score instead of blocking outright.
Inspecting Radar → Rules on 2026-09-17 showed that migration has already
happened. Recorded here rather than deleted, because a decision record that only
lists things worth doing teaches nothing about what was already right.

Radar → Rules, as configured (matches over Apr 21 – Sep 17 2026):

| Action | Condition | Status | Matches | Volume |
|---|---|---|---:|---:|
| Block | payment matches default Stripe block lists | Enabled | 0 | $0.00 |
| Block | **CVC verification fails based on risk score** | Enabled | 5 | $145.00 |
| Block | **Postal code verification fails based on risk score** | Enabled | 1 | $29.00 |
| Request 3DS | 3D Secure is supported for card | Disabled | 0 | $0.00 |
| Block | `:risk_level: = 'highest'` | Disabled | 0 | $0.00 |
| Review | `:risk_level: = 'elevated'` | Disabled | 0 | $0.00 |

Three things settle the question:

* **"based on risk score" IS the adaptive rule.** The blunt versions block on any
  CVC or postal mismatch; these consult the risk score as well. Nothing to
  migrate.
* **The aggressive rules are already off.** Block-on-highest-risk and
  review-on-elevated are both disabled.
* **Custom rules are not available to us anyway.** The account is on standard
  Radar, not Radar Plus, so "write a narrower rule" was never an option. The
  proposal assumed a lever we do not have.

**Leave Request 3DS disabled.** Enabling it on a subscription flow would create
`authentication_required` failures on off-session charges, where the member is
not present to complete a challenge. The France cohort — 11 declines out of 11 —
contained **zero** authentication failures, so there is no problem here for 3DS
to solve and a real one for it to cause.

**What is left: a reconciliation gap, and a five-minute manual review.**

Our ledger and Radar do not obviously describe the same events:

| Source | What it says |
|---|---|
| Radar rules | CVC 5 matches / $145, postal 1 match / $29 |
| Decline ledger | `highest_risk_level` 3 invoices / $87 (all trial conversions, none recovered), `requested_block_on_incorrect_zip` 1 invoice / recovered / $0 |

Two things do not line up, and neither is worth a code change to chase:

* The `:risk_level: = 'highest'` rule is **disabled with 0 matches**, yet three
  invoices carry `highest_risk_level` as their decline reason. Either Stripe's
  baseline Radar blocks highest-risk payments independently of that rule entry,
  or the Matches counter does not count what it appears to.
* Radar's CVC rule has 5 matches while the ledger holds no
  `requested_block_on_incorrect_cvc` at all. Those matches may be the ones
  landing in our ledger as `highest_risk_level` — a rule that fires "based on
  risk score" plausibly reports the risk reason — or they may be on payments that
  are not subscription invoices.

**The action is to look, not to configure.** Dashboard → Payments, filter to
blocked, and read the four. If they are plainly real customers, that is evidence;
at four payments over five months and $87 nothing else is. Do not change a Radar
setting on this volume.

### 2. Authorization Boost — ENABLE IF INCLUDED, do not pay much for it

**What changes.** Network tokens, card account updater and Adaptive Acceptance
are no longer three separate toggles; Stripe bundles them as Authorization Boost.
Published effect is +3.8% acceptance on average, explicitly incremental — it only
counts features not already in use.

**Do it as the built-in A/B test, not as a switch.** Dashboard → Optimization →
"Test Authorization Boost" → "Test for 30 days". Stripe runs a real control /
treatment split and reports the lift against our own volume, which is a better
answer to "is this worth paying for" than anybody's published average.

**Expect the test to come back inconclusive, and run it anyway.** We charge
roughly 85 first payments a month. Split two ways that is ~42 per arm over 30
days, and a 3.8% effect is invisible at that size — the same power problem the
per-source cut has. The test costs nothing and cannot mislead us the way a
before/after comparison would, but it is not going to settle anything soon.

**The test does not measure card account updater.** CAU runs across both arms
regardless, so the experiment isolates Adaptive Acceptance and network tokens.
That is fine here, for the reason below.

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
decides entirely. Settings (gear) → Product settings → Payments → Payment methods
→ Link. **Step one is to look at whether it is already on** — the decline data
shows Link volume, so it probably is, which would make this a question about
prominence and defaults rather than activation.

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

### 4. Retry timing — UNDECIDED, gated on evidence that does not exist yet

This is the one aimed at the 62%, and it is the one with no data behind it. So
it is not a proposal yet; it is a test, and the test comes first.

**The hypothesis.** An off-session charge needs the balance to be there at that
moment. If that is why these fail, then a retry landing before payday fails for
the same reason the original did, and a retry window that closes before payday
never gets a chance at all. The lever would be the length and spacing of the
retry schedule.

**The test.** `make decline-timing`. It reports how long Stripe actually kept
trying, and whether invoices whose retry window crossed the 1st or the 15th
recovered any better than the ones that missed both.

**The proxy, and its limit.** We do not know when any member is paid. We know
when the charge landed and which dates Stripe tried on. Straddling the days
payroll clusters around is the closest observable thing, and it cannot become
proof however the numbers come out. Both rows carry a 95% interval; overlapping
intervals mean no difference was shown, not that a small one is absent.

**The instrument was calibrated before it was believed.** Run against a replica
built with no effect present it reported 17% against 17%, identical intervals,
inventing nothing. Run against one built with a large effect it reported 60%
(42–75%) against 7% (2–21%). It can say yes and it can say no.

**What each outcome means, decided in advance so the result cannot be read to
taste:**

* **Intervals separate, crossing a payday recovers better.** Timing is real.
  The change to propose is a longer retry window — in Stripe, Settings →
  Billing → Subscriptions, the failed-payment retry schedule — so that every
  invoice gets at least one attempt after a payday. Risks: a longer window
  keeps a member in limbo longer, delays the cancellation that ends the
  relationship cleanly, and on a trial conversion holds entitlement decisions
  open. None is severe; all need saying before it moves.
* **Intervals overlap.** Timing is not the lever, and lengthening the retry
  window is motion without effect. The remedy is the dunning email — already
  changed today — and the decision here is to do nothing and say so.
* **Too few resolved invoices to tell.** The likeliest outcome at 63 invoices
  with 10 recoveries. Then the honest answer is to leave retry policy alone and
  re-run when the counts support it.

**Nothing changes in Stripe on the strength of this section.** It is written
before the evidence deliberately, so the reading of the evidence is not
retrofitted to a change somebody already wanted.

#### What happened when it ran (2026-09-18): the instrument was wrong

None of the three pre-registered outcomes. The test returned a large, confident
result pointing the OPPOSITE way to the hypothesis: invoices whose retry window
crossed a payday recovered **0% (0–15%)**, against **26% (15–41%)** for those
whose window never reached one. Non-overlapping intervals, 62 invoices.

That is not a finding about paydays. It is the measure selecting on the outcome.

`windowCrossedPayday` spans the first failure to the **last failure** — and an
invoice that recovers *stops failing*, so recovering shortens its window by
construction. Crossing a payday needs a long window (the observed median is 3
days), so "crossed" largely encodes "kept failing", which is nearly the
definition of "never recovered". Regressing recovery on it is circular, and the
0% is close to guaranteed before any member is involved.

The exogenous table beside it corroborates the diagnosis: day-of-month of the
first failure — which no outcome can move — shows **no pattern at all**, every
interval overlapping every other. The clean variable says nothing; the
contaminated one says something enormous. That is the signature of the bias, not
of an effect.

**Why the calibration missed it.** Both synthetic replicas assigned outcomes
independently of window length; I set the windows per group and the recoveries
per group. Real data does not work that way — there the window is *caused* by
the outcome. A control built without the confound cannot detect the confound,
and mine was built that way twice.

**The replacement.** `daysToNextPayday` asks the same question from the first
failure date alone: when the charge failed, how long would the member have had
to wait for money? For a trial conversion that date is `trial_end`, seven days
after a signup that predates all of this, so nothing downstream can reach it.
The script now leads with that table, prints the window medians split by outcome
so the contamination is visible, and keeps the old cut underneath labelled as
the trap it is — deleting a measure because it gave an awkward answer would be
worse than showing why it is wrong.

**Still undecided.** The clean test has not been read yet. The decision tree
above stands, with a fourth branch now written into it:

* **A large result in the direction nobody predicted** → suspect the
  instrument before believing the finding, and check whether the variable can
  be moved by the thing it claims to predict.

#### The clean test, read (2026-09-18): NOT SUPPORTED — leave retry policy alone

The exogenous measure also points backwards. Invoices whose payday arrived
within three days of the failure recovered **0% (0–17%)**; those waiting eight
days or more recovered **26% (15–43%)**. Fisher's exact on 0/19 against 9/35 is
**p = 0.019**.

Nominally significant, and it is still not a finding, for three reasons that
have to be applied together:

1. **Eighteen buckets were inspected** across the four tables. At eighteen
   looks, the chance of turning up at least one p < 0.05 by luck alone is 60%.
   A Bonferroni threshold here is 0.0028, and 0.019 is nowhere near it.
2. **The same standard was already applied against a result.** Sunday against
   Friday in the weekday table is p = 0.037, and it was dismissed as chance
   because seven buckets will throw up an extreme one. Believing p = 0.019
   while dismissing p = 0.037 would mean believing the one that came with a
   story, which is how this goes wrong.
3. **The direction has no mechanism.** "Money arriving sooner makes recovery
   worse" is not a thing. Every causal story runs the other way, and the effect
   is concentrated entirely in invoices that first failed between the 16th and
   the 25th — a region with nothing special about it.

**Decision: do not change retry timing.** This lands on the second branch of the
tree above — the lever is not there, and lengthening the window would be motion
without effect. The remedy for `insufficient_funds` remains the dunning email,
already changed on 2026-09-17.

#### The 9 single-failure invoices, chased

"Never retried" was a conclusion, not an observation. There are five ways to end
up with one decline row and only one of them means Stripe declined to try again,
so `make decline-timing` now separates them:

    capture_gap          Stripe numbered the attempt above 1 — earlier attempts
                         happened and we do not hold them. OURS to fix, and it
                         means every window figure in this report understates.
    retry_was_scheduled  next_payment_attempt was set and we never recorded the
                         failure that followed. Also a capture gap.
    manual_collection    collection_method send_invoice — Stripe never
                         auto-charges these, so no retry was ever coming.
    closed_early         voided or written off before a retry could run.
    genuinely_single     one attempt, and nothing claims another was due. The
                         only category that means what "never retried" implies.

The distinction decides who owns the problem. A capture gap is a defect in our
recording and the money may well have been retried normally; a genuine single
attempt is revenue that never got the automatic second chance everything
downstream assumes it had.

**Run against production it returned nine, all in the one category that would
have been a finding — and the classification was wrong.** Two flaws, both
visible in the output rather than in the code:

* **Five of the nine had RECOVERED.** They recovered at 56% against a 16% base
  rate, which is what gave it away. An invoice stops failing when the money
  arrives, so a single row is the expected shape of a healthy recovery, not a
  withheld retry. Nothing was owed a second attempt.
* **All nine were backfilled rows**, whose `collection_method` and
  `invoice_status` are NULL because those columns did not exist when the audit
  backfill wrote them. Reading that absence as "no retry was scheduled" is
  exactly the mistake `deriveRetryState` is documented to avoid: NULL means we
  did not ask, never that retries are not running.

Corrected, the nine are five healthy recoveries, one invoice still open from
yesterday, and three lost invoices ($347) about which the honest answer is that
we cannot tell whether Stripe retried them. **Zero confirmed cases of Stripe
declining to retry.** The diagnosis now carries `paid_after_one_failure` and
`retry_state_unrecorded` so neither mistake can recur silently.

The general lesson, since it has now happened twice in this section: a measure
built on the ABSENCE of a signal needs to distinguish "we looked and it was not
there" from "nobody ever looked". Both times the second case was silently read
as the first, and both times it produced a confident answer that was wrong.

## What none of this addresses

$2,177.50 — 62% of everything lost — is `insufficient_funds` on a first payment,
and the recovery rate on it is 10 of 63 (16%). Every item above is acceptance
optimization, and acceptance optimization cannot fix an empty account.

What plausibly moves it:

- **The debit timing line in the trial reminder.** Already shipped: members whose
  card on file is debit or prepaid are told the date the funds need to be
  available. Debit declined at 77% against credit's 33% in the audit, and that
  gap has a mechanism rather than a correlation.
- **Retry timing relative to payday.** Now has a test rather than a hunch —
  see decision 4 above and `make decline-timing`.
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

| Date | Change | Baseline before | Reviewed |
|---|---|---|---|
| 2026-09-17 | Authorization Boost enabled | 122 declined invoices, 115 of them first payments, $3,525.50 never collected. `issuer_block` 29 invoices / $649.00 — the bucket this aims at. First-payment decline rate 45.3%. | Due 2026-10-17 |
| 2026-09-17 | Link confirmed on at checkout | Payment-method split as `make audit-trial-conversions` reported it: card entry 58.9% decline, Link 30.2%. Trial starts are the number to watch alongside it, not just conversion. | Due 2026-10-17 |
| 2026-09-17 | Dunning emails made decline-reason-aware; hosted invoice link added | `insufficient_funds` 63 invoices, 60 first payments, **10 recovered (15.9%)**, $2,177.50 never collected. Both emails previously told every member to update their card and linked only the account page. | Due 2026-10-17 |

The third row is the one to watch. It is the only change of the three aimed at
`insufficient_funds`, which is 62% of the loss, and the only one with enough
volume behind it to show a result inside a month. The number to compare is the
recovery rate on that category, not the decline rate — the change cannot stop a
charge failing, only make the follow-up useful.

### What to run on 2026-10-17

A review nobody knows how to perform does not happen, so:

    make backfill-payment-declines   # settle anything that resolved since
    make decline-by-source           # first-payment decline rate, all channels

Then the category query at the top of this file. Compare against the baselines
above:

| Watch | Was | Means |
|---|---|---|
| `insufficient_funds` recovery rate | 10/63 (15.9%) | The dunning-email change. The one with real expected value. |
| `issuer_block` invoices | 29 / $649.00 | Authorization Boost. Expect little; the bucket is small. |
| First-payment decline rate | 45.3% | Everything together. |
| Trial STARTS, from the daily metrics rollup | — | Link. A conversion gain that costs more trials than it wins is a loss, and this is the only number that would show it. |

One month is short and these volumes are small. Read a move of a few points as
noise unless the counts moved with it.
