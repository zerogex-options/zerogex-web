# First charge declined — Matheus and Sami (2026-09-20)

Two accounts fell out of **Converting** and into **Trial Grace** on Saturday
evening, about ninety minutes apart. Both are Pro, both have already had the
automated first nudge, and both grace windows close **Tuesday, September 22**.
This is the read on each decline and a 1:1 founder draft.

American English, one line per paragraph, no hard wrapping, so each draft pastes
straight into a mail client. These are **1:1 replies from your own inbox** — not
campaign sends. Nothing here goes through `mailer.ts`, deliberately: the templated
dunning has already said everything a template can say, and a third one would be
filed unread.

Everything below is confirmed against `make diagnose-user` for both accounts
(run 2026-09-20). Where a number is quoted, it came from that output.

| | **matheus.vms@gmail.com** | **egold24@pm.me** |
|---|---|---|
| Name on card | MATHEUS V M SANTOS | Sami D |
| User id | `user_d7769e53c4dba065d8b29d26` | `user_7b13ea617e686b2a2253208b` |
| Plan | $59.00/mo — **Pro monthly** | $299.00/yr — **Pro annual** |
| Signed up | 2026-09-12 22:15 UTC | 2026-09-12 20:38 UTC |
| Trial ended | 2026-09-19 22:22 UTC | 2026-09-19 20:41 UTC |
| Declined | 2026-09-19 23:24 UTC | 2026-09-19 21:42 UTC |
| Card | Mastercard **credit** ••7333, exp 09/2034 | Mastercard **debit** ••8864, exp 09/2029, via **Apple Pay** |
| Issuer | NU PAGAMENTOS SA (Nubank, Brazil) | BNP PARIBAS (France) |
| Decline | `incorrect_number` / `card_problem` [79] | `generic_decline` / `issuer_block` [83] |
| Open invoice | `in_1UHWfH4AOiqteMYYie54vHty` — $59, **attempt 1** | `in_1UHV5W4AOiqteMYYgzdv4eg7` — $299, **attempt 1** |
| Grace opened | 2026-09-19T23:24:32Z, reason `trial` | 2026-09-19T21:42:42Z, reason `trial` |
| **Grace closes** | **2026-09-22T23:24:32Z** | **2026-09-22T21:42:42Z** |
| Money ever collected | **none** | **none** |
| **Last seen** | 2026-09-14 — **returned after signup** | 2026-09-12 — **DORMANT, never returned** |
| **Annualized** | **$708** | **$299** |

## What the diagnoses changed

Two things, and they pull in opposite directions.

**Matheus upgraded himself, mid-trial, before paying anything.** The audit trail
has `billing_plan_switch_in_app` at 2026-09-12 22:25 UTC: *"In-app upgrade
basic/monthly → pro/monthly on sub …(trialing; trial preserved, no charge
today)"*. He checked out on **Basic** at 22:19 and moved himself to **Pro** six
minutes later. He then came back on the 14th, acknowledged the Pro welcome and
API-key modal, and reset his password — someone doing real setup, not a tourist.
He is the strongest save on this page and he is worth $708/yr.

**Sami has never used the product.** Last seen 2026-09-12 20:38 UTC, flagged
`DORMANT: no return visit after signup`. He registered, checked out Pro annual two
minutes later, clicked through the welcome modal, and has not been back in seven
days. He got the 48h trial reminder on the 17th and did nothing with it. So the
$299 that just failed is a year of a product he has not opened once.

That second fact changes what his email should be, and it is the reason his draft
below is not the card-recovery note it was going to be. See **Why I would not
chase Sami's $299** below.

## The clock

`BILLING_PAYMENT_GRACE_DAYS=3`, trial grace on, and both anchors are confirmed in
the DB — so these dates are exact, not estimated:

| | grace closes | automated warning fires |
|---|---|---|
| Sami | **Tue Sep 22, 21:42 UTC** | first sweep after Mon Sep 21, 21:42 UTC |
| Matheus | **Tue Sep 22, 23:24 UTC** | first sweep after Mon Sep 21, 23:24 UTC |

The grace-expiry sweeper runs every 4h and fires at ≤24h remaining
(`core/graceExpiryWarning.ts`), so both get the automated second touch on Monday
evening. **Send today (Sunday).** A personal note now sits a clear day ahead of
it, and the sweeper still backstops you if the note goes unread.

Worth knowing while you read the drafts: **the 3-day grace is much shorter than
Stripe's retry schedule.** Both invoices are `status=open, attempt=1` — no retry
has fired yet, and Smart Retries run for roughly three weeks. So access drops
Tuesday while the subscription stays alive retrying a card that, in Matheus's
case, cannot work. Neither diagnose output reported a `next_payment_attempt`, so
don't quote a retry date to either of them.

## What they have already been sent

Confirmed in both audit trails: `payment_failed_email_sent` — *"Sent
trial-conversion payment-failed email"* — within four seconds of each decline.
That is `sendTrialConversionFailedEmail`:

> **Subject:** Your ZeroGEX trial ended — a quick card fix to keep your access

It already named the card and the amount, quoted the grace deadline, linked the
billing portal, and closed with *"reply to this email — I read every one."* It is
signed by you. Both also had `trial_reminder_email_sent` on the 17th.

**So do not write that email again.** The mechanics are covered, and
`buildGraceExpiryWarningEmail` will cover the deadline again Monday. What no
automated email does is read the decline code — the webhook has it and does
nothing with it. That diagnosis is the entire content of these two notes.

---

## Priority 1 — matheus.vms@gmail.com ($59/mo Pro, Nubank)

### The read

**`incorrect_number` on a card nobody typed.** That is the whole finding.

Matheus did not re-enter a card for this charge. `pm_1UEzJZ4AOiqteMYY3szlTPcb` was
attached at checkout on the 12th, the $0 trial invoice cleared on it, and it
carried him through a week of access plus a self-service plan upgrade. A stored
payment method cannot develop a typo between then and Saturday's invoice.

So `incorrect_number` is not a description of the number. It is Nu Pagamentos
rejecting the charge, and Stripe mapping the issuer's response onto the nearest
decline code. The plausible causes, in order:

1. **A rotated or deleted virtual card.** Nubank pushes virtual numbers for online
   and international purchases, and the cardholder can delete or regenerate one in
   the app at any time. The moment they do, the old number stops resolving at the
   issuer. The 09/2034 expiry is consistent with a recently minted virtual card.
2. **A re-issued physical card** (lost, stolen, replaced) whose old number is dead.
3. **The issuer refusing a cross-border recurring charge** and returning something
   Stripe reads as a bad number.

The diagnose tool reaches the same operational conclusion from the code alone:
*"The card itself is unusable… they need to update it — the one case where 'update
your card' is the right ask."* Agreed on the action. The draft adds the two things
the code alone cannot give him: **why**, and **that waiting will not fix it**.

### Why he is first

**The retries are wasted on him.** The invoice is at attempt 1 and Stripe will
keep presenting the same dead token. Every attempt fails identically until Tuesday.

Worse, the automated email he already has says *"an expired-or-replaced card or a
momentary insufficient-funds hold may simply clear on its own."* For his decline
code that sentence is actively misleading — it tells him to wait, and waiting is
the one thing that guarantees he churns. He is an engaged member who upgraded
himself to a higher tier before paying a cent, and he is on track to lose access
on Tuesday because of a sentence in our own dunning email. Correcting it is the
reason to write, and it is a good one.

### Language

He signed up on an English-only site and read English emails throughout the trial,
so the draft is English. Do not machine-translate it to seem personal — a rough
pt-BR email from a founder who then cannot hold the reply reads worse than a good
English one. Ask and I'll write a proper version.

### Notes before you send

- **Confirmed, so the draft states it as fact:** invoice `attempt=1`, no retry has
  run yet. If one fires before you send, say so — it makes the argument
  unarguable.
- **Do not offer him more time.** `extend-trial` only pushes `trial_end` on a sub
  Stripe still reports as `trialing`; his is `past_due`. `reactivate-member` needs
  a churned member with no live sub. Neither applies.
- Paying the open invoice from its hosted Stripe link would clear *this* month but
  leave the dead card on the subscription, so October fails the same way. The
  portal card update is the right ask for him.
- **Unrelated data-quality nit:** his subscription metadata still reads
  `tier=basic, cadence=monthly` from checkout, while the price is Pro monthly. The
  in-app plan switch does not rewrite subscription metadata. Harmless for billing
  (tier is recomputed from the price on every sync) but it will mislead anyone
  reading Stripe directly. Worth a separate look.

### Draft

**Subject:** That card decline isn't what Stripe says it is

Hi Matheus,

You got an automated note from us on Saturday saying the first charge after your trial was declined. I went and looked at the actual decline, and I need to correct something in that email before it costs you your access.

Your bank returned the code "incorrect card number." That is almost certainly not what happened. You never typed a card number for this charge — the card you added on the 12th was stored with Stripe, it cleared the trial invoice, and it carried you through the week, including when you moved yourself from Basic up to Pro. A stored card doesn't develop a typo.

What that code usually means with Nubank is that the number is no longer live at the bank. The two common ways that happens: the card was a virtual number and it got deleted or regenerated in the app, or the physical card was replaced and the old number retired. Either way the bank is being handed a number it no longer recognizes.

Here's why I'm writing rather than leaving it to the automatic retries. That first email says a retry may clear it on its own. For an insufficient-funds hold, that's true. For this, it isn't — Stripe will keep presenting the same number and the bank will keep not finding it. Nothing has retried yet, and when it does, it will fail the same way. Waiting doesn't fix this one.

What does fix it takes about thirty seconds: add a different card. If you were using a virtual card, generate a fresh one in the Nubank app, or use the physical card number instead. Sign in at https://zerogex.io/account and hit Manage Subscription — that opens Stripe's billing portal, where the payment method lives.

One thing worth checking while you're in the app: make sure international purchases are enabled on whichever card you use. We bill in US dollars, so even though you were charged in reais, the payment still crosses the border.

The deadline, so it isn't a surprise. Your full Pro access stays on through Tuesday the 22nd. If nothing clears by then the account simply moves to the free tier — nothing is deleted, your settings and history stay exactly as they are, and Pro switches back on by itself the moment a charge goes through, whether that's this week or next month.

And if the timing is just bad, or you've decided ZeroGEX isn't for you, reply and tell me straight. You upgraded yourself to Pro three days into a trial you hadn't paid for yet, so I'd rather hear it from you than guess it from a card decline.

Michael
Founder, ZeroGEX

---

## Priority 2 — egold24@pm.me ($299/yr Pro, BNP Paribas via Apple Pay)

### Why I would not chase Sami's $299

This is a recommendation, not a fact, so here is the reasoning in full.

He has **never used the product**. Registered 20:38, checked out Pro annual at
20:40, clicked the welcome modal at 20:42, gone. Seven days, no return, no second
session. The 48h trial reminder on the 17th did not bring him back either.

Now read `docs/disputes/du_1U6cn34AOiqteMYYYCr2OaKn.md`, which is our own
post-mortem on a **lost** dispute:

> The gap was never the documentation: it was that **no post-charge usage existed
> to show**. The cardholder signed up on 2026-08-06, used the product for roughly
> half an hour, and never returned… Against a debit issuer, "he never canceled and
> we told him clearly" is a weaker position than "he used what he paid for", and
> only the second one was unavailable to us.

Sami is that exact shape, and worse on every axis. Never returned at all rather
than half an hour. **A debit card**, like the one that beat us. And **$299 instead
of $29** — ten times the exposure, on a charge the cardholder would have no
memory of authorizing, for a year of a product they never opened.

So the downside of a successful recovery here is not zero, it is a likely dispute
we have already documented ourselves losing. The upside is $299 from someone with
no demonstrated intent to use it.

That does not mean write him off. It means **sell him the thing he hasn't had
yet** — the product — instead of the invoice. He still has access until Tuesday.
The email below spends that access rather than the card, offers monthly at $59 as
the de-risked way in, and tells him plainly that doing nothing costs him nothing.
If he comes back and uses it, a $59/mo who logs in beats a $299 chargeback. If he
doesn't, we learn that for free and the window closes quietly.

Keep the card-fix path in the note — it is his account and his call — but do not
lead with it.

### The read on the decline itself

Stripe got **no reason**: `generic_decline`, network code 83, classified
`issuer_block`, *"The bank did not return any further details with this decline."*
Risk level Normal, so this is not Radar and not us. The diagnose tool's own
guidance is worth repeating because the draft follows it:

> Issuer refused an otherwise-valid card — common for cross-border recurring
> charges… **Never repeat a fraud-flavoured reason back to the member; say the bank
> declined it.**

Everything else has to be inferred from the shape of the charge, and it is unusual
in three ways at once. It is a **debit** card, so the money had to be there on the
day and it counts against a cardholder-set ceiling (*plafond de paiement*), which
French banks often set lower for foreign and online payments. It is **$299**, the
largest single amount we bill — five times the monthly. And it is an
**unauthenticated, merchant-initiated charge on an Apple Pay token**: he approved
the setup with Face ID, but the trial-end charge has no cardholder present, which
is normal for a subscription and also the shape European issuers are strictest
about under PSD2.

One mechanical detail that makes a suggestion in the draft real rather than
superstition: **Apple Pay never gives the bank the card number.** It presents a
device-specific token, a different number from the one on the card. Re-adding the
same card by typing the number is genuinely a different attempt.

None of these is confirmable from a bare `generic_decline`. They are ranked
hypotheses, and the draft presents them as limits and rules rather than as the
bank suspecting him of anything.

### Notes before you send

- **If he takes the monthly offer, you are hand-rolling it.** `decidePlanSwitch`
  routes every cadence change to the Stripe portal (`core/planSwitch.ts`), and the
  portal schedules downgrades at period end — which does nothing for a first
  invoice that was never paid. `upgrade-at-current-price` is a basic → pro tier
  move, not a cadence move. Doing this means editing the subscription in Stripe
  directly: swap to `price_1TdDBo4AOiqteMYYQtZgAbha` (Pro monthly) and void the
  open $299 invoice so the monthly one generates clean. **Work out exactly what
  you'll do before you send**, because the draft promises he won't have to do
  anything.
- The $299 invoice `in_1UHV5W4AOiqteMYYgzdv4eg7` is still open with a live
  `hosted_invoice_url`. Because he's annual, paying that one invoice with another
  card is genuinely sufficient — the next charge isn't until 2027. The draft
  offers to send the link rather than pasting a long Stripe URL into a cold email.
- His subscription metadata is correct (`tier=pro, cadence=annual`).
- The site has a French locale if he replies in French. A BNP card is not evidence
  of language, so the draft doesn't presume.
- Confirm the two product links before sending, and replace the bracketed line
  with the one thing you'd actually put in front of a new Pro user.

### Draft

**Subject:** Your card declined — and I'd rather you didn't rush to fix it

Hi Sami,

You had an automated note from us on Saturday about the first charge after your trial being declined. I looked at it properly, and I'd rather send you this than the follow-up that was queued up.

First, what happened, because the automated email couldn't tell you. Your bank — BNP Paribas — refused the charge and sent back no reason at all. Not insufficient funds, not an expired card, nothing. So there's no evidence anything is wrong with your card, and nothing went wrong on our end either. It's a $299 international charge on a debit card with no cardholder present, which is the exact shape banks in Europe apply the tightest rules to.

Now the part I think matters more. Before you go and fix anything, I looked at your account, and you haven't been back since the day you signed up. So that failed charge was about to buy you a full year of something you've never actually opened. I don't want your $299 on those terms.

Here's what I'd suggest instead.

Your Pro access is still switched on until Tuesday the 22nd. Use it this week — that's what it's for. [ONE CONCRETE THING TO LOOK AT FIRST.] Sign in at https://zerogex.io and it's all live right now, with nothing to pay and nothing to fix.

If it earns a place in how you trade, tell me and I'll move you to the monthly plan at $59 instead of the annual. Five times smaller, far less likely to be refused by your bank, and you don't have to commit to a year to find out whether this is for you. Just reply with "monthly" and I'll take care of it — you won't need to do anything.

And if it isn't for you, do nothing at all. The card will keep being declined, the account moves to the free tier on Tuesday, and you will never be charged. Nothing gets deleted — your account and settings stay exactly as they are, and if you come back in six months it's all still here.

If you did want the annual plan and the card is the only thing in the way, that's easy too: reply and I'll send you a direct payment link you can settle with any card, or check your BNP app for a blocked payment and for your online and international payment ceiling — a single $299 charge often sits above a limit you've never had reason to notice. Worth knowing that Apple Pay hands the bank a separate device number rather than your card number, so adding the same card the ordinary way, by typing it in, really is a different attempt.

Either way, no rush and no hard feelings. Reply if you want the monthly switch or the payment link, and ignore this if you'd rather let it go.

Michael
Founder, ZeroGEX

---

## What not to say

- **Don't re-explain the decline mechanics, and don't lead with the portal link.**
  The automated email did both, and the grace-expiry warning will do them again on
  Monday. If these notes read as a third dunning email they get filed as one.
- **Don't tell Matheus a retry may clear it.** True for most declines,
  specifically wrong for his, and it is the sentence that would cost him the
  account.
- **Don't give Sami a fraud-flavoured reason.** The diagnose tool says this
  outright. The bank declined it; that's all we know and all we should say.
- **Don't apologize for the decline.** Neither is our fault, and an apology invites
  a refund conversation about money we never took.
- **Don't offer a discount.** Neither objected to the price. Matheus upgraded
  himself *to* a higher one. The monthly offer to Sami is not a discount — it's the
  same rack rate at a cadence his bank will actually pass.
- **Don't promise more time.** `extend-trial` cannot touch a `past_due`
  subscription, so "I'll extend you" is a promise the tooling won't keep.
- **Don't send these as one thread.** They share a failure mode and nothing else:
  one needs a different card, the other needs a reason to log in.

## After you send

- The automated grace-expiry warning fires Monday evening for both. **Leave it on.**
  It is the backstop for a note that goes unread, and it quotes the same
  `graceWindowEndIso`, so it cannot contradict what you sent.
- If Sami takes the monthly offer, do the Stripe edit before replying "done."
- If either window lapses and they later pay the open invoice from Stripe's own
  dunning mail, that's the orphan-payment path: `make scan-orphan-payments`, then
  `make recover-orphan-payment`.
- If Sami never replies and the charge later clears on a Smart Retry, that is the
  dispute-shaped outcome described above. Worth watching the invoice rather than
  treating a late success as a win.
- If a reply turns into anything substantive — a feature gap, a reason they were
  going to churn anyway — it belongs in its own `docs/outreach/` note, same as the
  cancellation follow-ups.
