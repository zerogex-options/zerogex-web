# Pre-renewal dormancy reminder — scope

*A dormancy-aware notice before a **renewal** charge, mirroring what
`core/trialEngagement.ts` already does before a **trial conversion**.*

> **Status:** scoped, not built. Ship §6 (read-only scan) first and read the
> cohort size before writing a single email.

---

## 1. The gap

`core/trialEngagement.ts` classifies a member as `engaged` / `dormant` /
`unknown` and picks the reminder copy sent 48h before a **trial converts**. It
exists because of the lost chargeback in
`docs/disputes/du_1U6cn34AOiqteMYYYCr2OaKn.md`: a charge landing on someone who
has not used the product is the highest-risk charge there is.

That logic stops at the trial boundary. Nothing applies it to renewal N. A
member who paid for three months and quietly stopped logging in is re-billed
with no dormancy-aware touch at all. The only cron that reaches active
subscribers before a billing event is `scripts/send-card-expiry-reminders.mts`,
and it only cares whether the card is about to expire.

The risk does not stop at the trial boundary, so the mitigation should not
either.

**This would not have caught the Preston King case (2026-09-03).** That was a
trial conversion, already covered — `trial_reminder_email_sent` fired
2026-09-01, 48h ahead, exactly as designed. The renewal gap is real on its own
merits; it is not that case's fix, and it should not be justified by it.

## 2. Where the risk actually sits

Three costs, and they do not point the same way:

| Outcome | Cost |
| --- | --- |
| Chargeback on a dormant renewal | charge + dispute-received fee + counter fee + dispute-ratio damage |
| Refund request | charge + retained processing fee |
| Prompted cancellation | the member's whole remaining LTV |

The third is the biggest and the easiest to cause by accident. A cancel-forward
email to a dormant *paying* member manufactures churn that would not otherwise
have happened — a far worse trade than the dispute it avoids. §5 is where this
gets resolved, and it is the part of this scope most worth arguing about.

## 3. New files, mirroring the card-expiry shape

`scripts/send-card-expiry-reminders.mts` is the closest existing analogue —
active-sub cohort, pre-billing-event, per-cycle latch — and its structure is the
one to copy.

| Path | Role |
| --- | --- |
| `core/renewalEngagement.ts` | Pure decision. No imports, injected clock. Same discipline as `core/cardExpiry.ts` / `core/paymentGrace.ts`. |
| `tests/renewalEngagement.test.ts` | Locks the decision table, including every `unknown` path. |
| `scripts/send-renewal-reminders.mts` | Cohort query + latch/audit I/O + mailer call. `--dry-run` / `--yes` / `--preview-to` / `--limit` / `--lead-hours`. |
| `scripts/scan-renewal-engagement.mts` | Read-only cohort report (§6). Mirrors `scan-trial-engagement.mts`. |
| `core/mailer.ts` | `sendRenewalReminderEmail()` — value-forward copy per §5. |
| `core/db.ts` | `ensureColumn('users', 'renewal_dormancy_notified_period', 'TEXT')` |
| `deploy/systemd/zerogex-web-renewal-reminders.{service,timer}` | Daily 05:10 — clear of trial-reminders (00/06:15), card-expiry (04:20), reactivation (:40), auth backup (:00). `RandomizedDelaySec=10m`, `Persistent=true`. |
| `deploy/steps/098.renewal-reminders` | Idempotent unit install. Copy `097.card-expiry`, including the `AUTH_DB_PATH` sandbox drop-in. |
| `Makefile` | `renewal-reminders` (send) and `renewal-engagement` (scan). |

## 4. The decision

```
renewalEngagement(input) -> 'engaged' | 'dormant' | 'unknown'
```

**Inputs:** `lastSeenAtIso` (`users.last_seen_at`), `currentPeriodEndIso`,
`firstPaymentClearedAtIso`, `nowMs`, `alreadyNotifiedPeriod`
(`users.renewal_dormancy_notified_period`), `leadHours`, `dormancyDays`.

**Eligibility** — every one required:

- `subscription_status = 'active'`, both Stripe ids present, `deleted_at IS NULL`
  (the cohort query is verbatim from `send-card-expiry-reminders.mts:311`).
- `cancel_at_period_end = 0`. Already canceling means no renewal is coming;
  mailing them is noise at best.
- `first_payment_cleared` is set and the current period is **not** the trial
  conversion. Trial conversions belong to `send-trial-reminders.mts`; the two
  cohorts must not overlap or a member gets both emails.
- `current_period_end` within `RENEWAL_REMINDER_LEAD_HOURS` (default **72**,
  clamped `[24, 168]`). Longer than the trial's 48h on purpose: there is no
  unconditional-refund promise behind a renewal, so the member needs real room
  to act.
- `renewal_dormancy_notified_period != current_period_end`. Latching on the ISO
  of the period about to renew re-arms once per cycle, for free, for monthly and
  annual alike — the same trick as `card_expiry_notified_ym`.

**Dormancy:** `dormant` when `last_seen_at` is older than
`RENEWAL_DORMANCY_DAYS` (default **30**, clamped `[7, 90]`). For a monthly plan
that reads "has not shown up this cycle." For annual it fires well before the
renewal, which is the point.

`last_seen_at` supports this: `core/serverAuth.ts:1159` rewrites it on
authenticated requests, throttled to 15 minutes
(`AUTH_LAST_SEEN_THROTTLE_SECONDS`), which is far finer than a day-level
threshold needs. This is a real improvement over the
`sessions.last_rotated_at` coarseness the dispute doc complained about.

**Keep the `unknown` asymmetry.** `trialEngagement.ts:32` is explicit: absence
of data is not evidence of dormancy. NULL `last_seen_at` is a pre-cutover
account, so `unknown` → **never send**. This is the single most important
inherited constraint. Read a NULL as dormancy and the first run mails the whole
legacy book at once.

## 5. The copy — the actual design risk

The trial email can open "you haven't had a chance to use ZeroGEX yet" because
no money has moved. Saying that to a *paying* member, next to a cancel link, is
a churn machine: it informs someone who was quietly renewing that they are
paying for something they do not use, and hands them the exit.

Resolve it by noticing that the dispute defense and the retention goal want
different things, and only one of them is load-bearing. What wins a Visa
13.2/13.6 dispute is **documented notice** — a timestamped record that you named
the date and the amount before charging. A cancel CTA adds nothing to that
defense. So:

- **Lead with what they have not seen.** This week's signals, what moved on the
  dashboard. It is a re-engagement email that happens to constitute notice.
- **One factual line:** renews on `DATE` for `$X`.
- **Link the billing portal** (they can already self-serve per
  `/pricing` → "Cancel anytime"). Do **not** add a "cancel now" button, and do
  not use the word dormant, unused, or inactive anywhere in the copy.
- **Never name a card.** Many of these members pay via Link with no resolvable
  card — see the `Card on file: none resolvable` path already handled in
  `send-trial-reminders.mts`. Reuse that neutral wording.

Net effect: the same notice that defends a dispute, without the churn the
cancel-forward version would cause.

## 6. Ship order

1. **`make renewal-engagement`** — read-only, sends nothing. Prints the active
   cohort by engagement with idle days, `DORMANT_ONLY=1` to filter. **Run this
   before building anything else.** If the dormant-renewal cohort is three
   people, this whole feature is a doc and a cron nobody needs; if it is three
   hundred, it is the highest-leverage retention work available.
2. `core/renewalEngagement.ts` + tests. Pure, fast, no infrastructure.
3. Mailer copy, reviewed against §5, previewed with `PREVIEW_TO=`.
4. The cron behind `--dry-run`, verified against the scan's numbers.
5. Timer + deploy step. `YES=1` only once a dry run has been eyeballed twice.

## 7. Measurement

Emit `renewal_dormancy_reminder_sent` audit rows so the cohort is queryable
after the fact. The three numbers that decide whether this was worth building:

- share of warned members who log in before the renewal (the win),
- share who cancel after the email (the cost — watch this one closely, and kill
  the send if it climbs),
- share who dispute or ask for a refund, against the pre-ship rate.

Instrument the second before the first. It is the one that can make this
feature net-negative, and the only one that argues for reverting it.

## 8. Consider factoring first

This would be the **third** script carrying the same preamble — `parseEnvFile`,
the active-sub cohort query, the latch-and-audit write, the
`--dry-run/--yes/--preview-to/--limit` parser (`send-card-expiry-reminders.mts`,
`send-trial-reminders.mts`, and now this). A small
`core/subscriberCron.ts` extracted from the two existing scripts would make this
one mostly decision logic plus copy. Worth doing as step 0 — or explicitly
deciding not to, and noting why.
