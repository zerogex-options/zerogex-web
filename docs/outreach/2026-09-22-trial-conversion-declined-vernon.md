# First charge declined — Vernon (2026-09-22)

One account fell out of **Converting** into **Trial Grace** on Monday evening.
Basic monthly, Link, already had the automated first nudge, grace closes
**Thursday, September 24**. This is the read and a 1:1 founder draft.

American English, one line per paragraph, no hard wrapping, so the draft pastes
straight into a mail client. This is a **1:1 reply from your own inbox** — not a
campaign send. Nothing here goes through `mailer.ts`, deliberately: the templated
dunning has already said what a template can say, and a second one reads as
dunning.

Everything below is confirmed against `make diagnose-user` (run 2026-09-21/22).
Where a number is quoted, it came from that output.

| | **vernondailey@icloud.com** |
|---|---|
| User id | `user_abeb12789537a346a22ed10a` |
| Plan | $39.00/mo — **Basic monthly** (`price_1TdDBn4AOiqteMYYlQt3C3fC`) |
| Signed up | 2026-09-14 21:14 UTC |
| Trial ended | 2026-09-21 21:17 UTC |
| Invoice created | 2026-09-21 21:18 UTC |
| Declined | 2026-09-21 22:19 UTC |
| Payment method | **Link**, no card resolvable (`pm_1UFhG34AOiqteMYYiW4UQiE0`, `lfsg_000`) |
| Decline | `insufficient_funds` [`payment_method_provider_decline` / `partner_insufficient_funds`] |
| Open invoice | `in_1UIEbH4AOiqteMYY6ZYg1LbJ` — $39, **attempt 1** |
| Grace opened | 2026-09-21T22:19:12Z, reason `trial` |
| **Grace closes** | **2026-09-24T22:19:12Z — Thursday Sep 24** |
| Money ever collected | **none** |
| **Last seen** | 2026-09-21 13:30 UTC — **returned after signup**, ~8h before conversion |
| Risk level | Normal |
| **Annualized** | **$468** |

The hour between invoice creation (21:18) and the charge (22:19) is Stripe's
finalize-then-charge delay, the same gap all six of the 2026-09-17 batch showed.
Not a fault, and nothing anomalous here.

## The read

**This is the hopeful shape, and it is close to hollandsp on 2026-09-17.** Link,
first charge, **attempt 1** — nothing has been spent. Stripe's retries are all
still ahead of him. A first-attempt decline is the kind that clears on a later
attempt; sanba's August invoice, same shape, cleared on attempt 3. So this draft
is allowed to say the retries may well catch it. That sets the tone: a heads-up
with a lever, not a rescue.

**He was using it when the trial ended.** Registered 2026-09-14 21:14, last seen
**2026-09-21 13:30 UTC — 9:30 AM ET the morning of the day it converted**, about
eight hours ahead of the charge. `diagnose-user` classes him "returned after
signup", and `last_seen_at` is written from the session-cookie path only, so that
is a real browser visit. He didn't drift off; the charge just failed. That is the
whole reason this one is worth a note rather than leaving it to the sweeper.

**No API key on this account** (Basic, and nothing in the audit trail), so unlike
hollandsp there is no key-revocation angle to raise, and nothing to check in
`apiKeyAdmin`.

**Do not diagnose the Link failure — this is the correction that matters most
here.** Stripe reports insufficient funds at the provider, and
`core/declineReason.ts` does map `partner_insufficient_funds → insufficient_funds`
(L163), so `diagnose-user` prints the category and its operator guidance:

> *"Account was short. Retries often clear on their own (payday); offer a cheaper
> plan or a pause rather than pressing. Do NOT tell them to call their bank."*

That string is written **for the operator choosing a follow-up, not as
customer-facing copy.** `core/paymentMethodDrift.ts` is explicit that Link never
exposes the funding card behind the wallet (L31), so "the provider declined for
insufficient funds" does **not** license telling Vernon his own account was empty
— we cannot see what is behind his wallet, and the 2026-09-17 batch already
settled this: hold the Link reading at arm's length, since Link charges
demonstrably work on this deploy. The draft therefore **names no reason and no
card**, and offers adding a card as *a different instrument to try* without
promising it will work. Same position as the hollandsp draft.

**The right lever is a card at `/account`, not the invoice link.** He is
**monthly**, so paying the open invoice from its hosted page clears September and
leaves Link pinned to the subscription — October fails the same way, which is the
Matheus lesson from 2026-09-20. Adding a card gives the next retry a different
route *and* fixes the recurrence. The invoice link stays in the note as the
settle-it-now option, second.

**The deadline is shorter than the retries.** Grace is 3 days
(`BILLING_PAYMENT_GRACE_DAYS=3`, trial grace on, anchor confirmed), so access
holds through **Thursday Sep 24**, while Smart Retries run roughly three weeks.
So access drops Thursday with the subscription still alive and retrying — and if
a later attempt clears, the sync back to `active` CAS-consumes
`payment_recovery_pending` and re-grants the tier automatically, plus the
payment-recovered email. **That asymmetry is the most useful thing in the note**:
it turns "I'm about to lose it" into "it comes back by itself."

**Every lever `declineGuidance` recommends is closed while he is `past_due`**, so
the draft promises none of them:

| Lever | Status |
|---|---|
| In-app pause | **Refuses** — `cancel-flow/route.ts` returns `not_pausable` (409) for anything but `active`/`trialing`: *"a past_due member should fix payment, not pause"* |
| Retention discount (25%/yr) | **Refuses** — `canOfferRetentionDiscount` allows only `trialing`/`active` |
| `make honor-winback-discount` | **Refuses** — hard-gated to `trialing`/`active` (L509) |
| `make extend-trial` | **Refuses** — hard-gated to `trialing` (L310, L339) |
| Cheaper monthly plan | **None exists** — Basic $39 is the floor. Annual is $199/yr (~$16.58/mo), a *larger* upfront charge, which is the wrong shape for a charge that just failed |

So: no discount, no pause, no promise of more time. Once a retry clears and the
sub is `active` again, every row above opens up.

## ⚠ Verify first

> **Re-verified 2026-09-22 (second `diagnose-user` run). Everything below still
> holds and the draft is good to send as written.** Status still `past_due`;
> `MONEY EVER COLLECTED` still **NO**; invoice `in_1UIEbH4AOiqteMYY6ZYg1LbJ`
> still `status=open` at **attempt=1**, so no retry has fired and the optimistic
> paragraph stands; grace anchor unchanged; last seen still 2026-09-21 13:30
> UTC, so he has not been back since; and no new audit rows — in particular no
> `grace_expiry_warning_email_sent`, which is expected, since it does not become
> eligible until 2026-09-23 22:19 UTC.
>
> **Send today.** That puts a clear day between this note and the automated
> warning, the same spacing the 2026-09-20 batch used.

- **Attempt count is the load-bearing fact.** The whole optimistic tone rests on
  this still being **attempt 1**. Re-check before sending; if a second attempt
  has failed, cut the "first attempt" paragraph and the optimism with it.
- **Re-run `make diagnose-user EMAIL=vernondailey@icloud.com`.** This is the
  check that matters. If `MONEY EVER COLLECTED` has flipped to yes the charge
  cleared, the payment-recovered email has gone out, and this draft is wrong in
  every paragraph — send nothing.
- **No retry date is named**, because `next_payment_attempt` is not in the
  `diagnose-user` output. If you want to name one,
  `make audit-trial-conversions` has the "Still unpaid: is Stripe going to try
  again?" section. Worth running anyway — it breaks the decline rate down by
  payment method type and reports SetupIntent completion, which is the open
  question about Link off-session reliability from the 2026-09-17 batch.
- **Confirm the name.** `diagnose-user` prints no name and the Stripe Name field
  was cut off in the dashboard view. "Vernon" is inferred from the address alone.
  If Stripe disagrees, open with `Hi —` as the hollandsp draft did.
- **Confirm the invoice is still `open`** before sending a pay-now link.
- **Do not paste a `hosted_invoice_url` you copied earlier — it rotates.** The
  two `diagnose-user` runs a day apart returned *different* URLs for the same
  unchanged invoice. Base64-decoding the path shows why: the account and the
  invoice's own token (`_VIqHAw4pMldecHmUl9sYN4c1HJD5DV9`) are byte-identical
  across both, and only a trailing number moved, `180582741` → `180586178` —
  and **both** invoices on the account, including the settled $0 trial one,
  picked up the *same* new number. So it is minted per fetch, not per invoice,
  and it carries no information about invoice state. This is the reason the
  draft says *"reply and I'll send you a payment link"* rather than pasting one:
  a URL copied today may not be the one Stripe would serve when he clicks it.
  Worth knowing for the 2026-09-17 batch's practice of pasting the URL straight
  into a draft — pull it fresh at send time, or let Stripe's own dunning mail
  carry it.
- **No to-the-minute cutoff in the copy.** The drop lands on the next sync after
  the window elapses, not at the instant, so the draft says "Thursday" and not
  "6:19 PM."

## What this draft does not do

- **No guessed decline reason, and no claim about his money.** See above. This is
  the one thing to preserve if you rewrite it.
- **No "update your card."** He has no card on file to update — the automated
  email's neutral branch already made that mistake for him (below).
- **No "call your bank."** `declineGuidance` forbids it for this category.
- **No apology for the decline.** Not our fault, and an apology invites a refund
  conversation about money we never took.
- **No discount and no pause.** He never objected to the price, and neither lever
  works on a `past_due` sub anyway.

## What he has already been sent

- `trial_value_nudge_sent` 2026-09-16 · `trial_reminder_email_sent` 2026-09-19
- `payment_failed_email_sent` **2026-09-21 22:19:16 UTC** — four seconds after
  the decline, correctly classified as the trial-conversion variant
  (`sendTrialConversionFailedEmail` via `isTrialConversionFailure`):

  > **Subject:** Your ZeroGEX trial ended — a quick card fix to keep your access

  It quoted the $39 and the grace deadline and linked the portal. But
  `resolveSubscriptionCard` returned null for his Link method, so it fell to the
  neutral branch — which still says **"your card was declined"** and still
  buttons **"Update your card."** For a Link-only customer every noun in that
  sentence is wrong, and correcting it is part of why this note is worth sending.

**So do not write that email again.** The mechanics are covered.

## After you send

- **The automated grace-expiry warning becomes eligible 2026-09-23 22:19 UTC**
  (`LEAD_HOURS=24`, `MIN_OPEN_HOURS=12`) and the sweeper runs every 4h, so it
  lands within ~4h of that — roughly 36h after this note. He is fully eligible:
  `past_due`, anchor set, not cancelling, never warned.
  **Leave it on.** It is the backstop if this note goes unread, and it quotes the
  same `graceWindowEndIso`, so it cannot contradict what you sent. (It will say
  "card" again — that is the copy bug below, not a reason to suppress the send.)
- If he replies asking for more time or a lower price, **do the Stripe work
  before promising anything** — every lever is gated on `past_due`, so the
  sequence is: get the invoice paid or a retry cleared → status returns to
  `active` → then `honor-winback-discount` or the in-app pause will take.
- If the window lapses and he later pays the open invoice from Stripe's own
  dunning mail, that is the orphan-payment path:
  `make scan-orphan-payments`, then `make recover-orphan-payment`.
- If the reply turns into anything substantive, it belongs in its own
  `docs/outreach/` note.

## Draft

**Subject:** Your first ZeroGEX charge didn't go through

Hi Vernon,

This is me directly, not the automated notice that went out on Monday night.

Your trial ended Monday evening and the first charge of $39 was declined. That automatic email asked you to update your card, and I want to correct it: you don't have a card saved with us. Your subscription pays through Link, so there's nothing on file for you to go and fix.

The encouraging part is that this was the first attempt. Stripe retries automatically over the next couple of weeks, and a first-time decline quite often goes through on a later try with nothing needed from you. If one does, your full access switches straight back on by itself — you don't have to redo anything or tell me.

If you'd rather not leave it to chance, there's one lever worth knowing about. Because the subscription pays through Link, the funding source behind it isn't something I can see or check from here, so I'm not going to guess at what happened. Adding a card directly at https://zerogex.io/account takes about a minute and gives the next attempt a different route to run against. It's also the thing that stops next month going the same way.

The date that matters: your Basic access is on right now and runs through Thursday the 24th. If nothing has cleared by then the account moves to the free Public tier. Nothing is deleted — your login, your settings and your history all stay exactly as they are, and full access comes back automatically the moment a charge succeeds.

If you'd rather just settle this month now and be done with it, reply and I'll send you a payment link you can pay with any card.

And I'd rather say this than not: if $39 a month isn't the right call right now, or the timing is simply bad, reply and tell me. You were in the app the morning your trial ended, so I'd sooner hear it from you than guess it from a card decline. If ZeroGEX didn't earn its keep during the week, that's the more useful answer for me anyway.

Michael
Founder, ZeroGEX

## Worth a separate ticket

- **The no-card fallback still says "card."** When `resolveSubscriptionCard`
  returns null for a wallet/Link/bank method, both `sendPaymentFailedEmail` and
  `sendTrialConversionFailedEmail` fall back to *"your card was declined"* with an
  **"Update your card"** button, and `buildGraceExpiryWarningEmail` repeats it.
  For a Link-only customer every noun is wrong, and this is now the **second**
  Link account it has misdirected (hollandsp, 2026-09-17). The neutral branch
  should say "payment method" and drop the card-specific ask.
- **`declineReason.ts` is not wired into the dunning emails.** The classifier
  exists, `diagnose-user` and the Payment Declines panel both use it, and the
  webhook's `invoice.payment_failed` branch has the charge in hand — but
  `failedEmailArgs` carries only `amountFormatted` / `cardBrand` / `cardLast4` /
  `nextAttemptIso` / `graceUntilIso`. So an `insufficient_funds` trialer and a
  `card_problem` trialer get byte-identical copy, and both are told to update a
  card. Note the copy would have to be written for the *member*, not lifted from
  `declineGuidance`, whose strings are operator-facing by design — the whole
  Link correction above turns on that distinction.
