# First charge declined — Matheus and Sami (2026-09-20)

Two accounts fell out of **Converting** and into **Trial Grace** last night, about
ninety minutes apart (`-1 converting / +1 grace` on both alerts — the exact
transition `core/subscriberBucket.ts` describes). Both are Pro. Both have already
had the automated first nudge. This is the read on each decline and a 1:1 founder
draft, ordered by which one Stripe's retries **cannot** save.

American English, one line per paragraph, no hard wrapping, so each draft pastes
straight into a mail client. These are **1:1 replies from your own inbox** — not
campaign sends. Nothing here goes through `mailer.ts`, deliberately: the templated
dunning has already said everything a template can say (twice, once it is done),
and a third one would be filed unread.

| | **matheus.vms@gmail.com** | **egold24@pm.me** |
|---|---|---|
| Name on card | MATHEUS V M SANTOS | Sami D |
| Amount | $59.00 USD — Pro **monthly**, list | $299.00 USD — Pro **annual**, list |
| Declined | Sep 19, 7:24 PM | Sep 19, 5:42 PM |
| Card | Mastercard **credit** ••7333, exp 09/2034 | Mastercard **debit** ••8864, exp 09/2029, via **Apple Pay** |
| Issuer | NU PAGAMENTOS SA (Nubank, Brazil) | BNP PARIBAS (France) |
| Failure code | `incorrect_number` (network 79) | `card_declined` / `generic_decline` (network 83) |
| Risk level | Normal | Normal |
| Notable | Adaptive Pricing — charged in BRL, settles USD | ECI 07 — ran unauthenticated, no 3DS |
| PaymentIntent | `pi_3UHXcN4AOiqteMYY0ShV7pfB` | `pi_3UHW1p4AOiqteMYY13rK2GvY` |
| **Annualized** | **$708** | **$299** |

Prices confirmed against `core/pricing.ts:30-31` — `pro.monthly.list = 59`,
`pro.annual.list = 299`. Both are paying rack rate; neither is founding or promo.

## What they have already been sent

Both declines were `attempt_count === 1`, and the webhook routes a trial
conversion to the trial-framed sibling (`core/trialDunning` →
`isTrialConversionFailure`), so both received `sendTrialConversionFailedEmail`
within moments of the failure:

> **Subject:** Your ZeroGEX trial ended — a quick card fix to keep your access

It already named the card and the amount, quoted the grace deadline and Stripe's
next retry, linked the billing portal, and closed with *"reply to this email — I
read every one."* It is signed by you.

**So do not write that email again.** The mechanics are covered, and
`buildGraceExpiryWarningEmail` is queued to cover the deadline a second time about
24h before the window closes. What neither automated email can do is say **why
this particular card failed** — the webhook has the decline code and does nothing
with it. That diagnosis is the entire job of these two notes, and it is the only
thing in them worth the recipient's attention.

## The clock

`BILLING_PAYMENT_GRACE_DAYS=3` (`frontend/.env.example:162`, clamped to [0, 14]
in `core/stripe.ts`) and trial grace is on by default (`getTrialGraceEnabled`), so
each window runs three days from its own failure:

| | failed | grace closes | automated warning fires |
|---|---|---|---|
| Sami | Sep 19, 5:42 PM | **~Sep 22, 5:42 PM** | ~Sep 21 evening |
| Matheus | Sep 19, 7:24 PM | **~Sep 22, 7:24 PM** | ~Sep 21 evening |

That leaves one clean slot: **send today.** A personal note landing Sep 20 sits a
full day ahead of the automated deadline warning, so the two don't collide, and
the sweeper still backstops you if the note goes unread.

> **Ignore the comment above that setting in `.env.example`.** Lines 160-161 read
> *"Does NOT apply to trial-conversion failures — an unvalidated trial card gets no
> grace."* That is stale: `getTrialGraceEnabled()` defaults **on** and
> `core/stripe.ts` says plainly that the same window length is used for
> trial-conversion failures. These two alerts are the proof — `+1 grace` on a
> declined first charge is exactly the case the comment says cannot happen. Trust
> the code and the diagnose output, not that comment.

## ⚠ Verify first — this document cannot see your database

There is no `.env.local` in this checkout, so nothing below was confirmed against
production. Before you send:

- `make diagnose-user EMAIL=matheus.vms@gmail.com` and
  `make diagnose-user EMAIL=egold24@pm.me` — confirm each is `past_due`,
  `payment_grace_reason='trial'`, tier still `pro`, and read the real
  `payment_grace_started_at` rather than trusting the arithmetic above.
- The deadline you quote must match `graceWindowEndIso`. Both automated emails are
  wired to that value and the three must never disagree. The drafts leave
  `[GRACE DATE]` bracketed for exactly this reason — fill it from the diagnose
  output, not from this table.
- Check Stripe for each invoice's **next retry date**, and whether a retry has
  already fired and failed since the screenshots. That changes what Matheus's
  draft can claim as fact (see below).
- `make grace-expiry-warnings DRY_RUN=1` reports when each is due for the
  automated second touch, and why anyone is skipped.

**Ordering: Matheus first**, on both counts — $708/yr against Sami's $299, and his
is the one the retries will not fix.

---

## Priority 1 — matheus.vms@gmail.com ($59/mo Pro, Nubank)

### The read

**`incorrect_number` on a card nobody typed.** That is the whole finding.

Matheus did not re-enter a card for this charge. The number was tokenized at
checkout and it *worked* — a trial held at the payment-setup gate sits at
`trialing` with tier `public` and gets no access at all
(`core/subscriberBucket.ts`), and he was **Converting**, which means he held Pro
all week. A stored token cannot develop a typo between checkout and the trial-end
invoice.

So `incorrect_number` is not a description of the number. It is Nu Pagamentos
rejecting the charge, and Stripe mapping the issuer's response onto the nearest
decline code. The plausible causes, in order:

1. **A rotated or deleted virtual card.** Nubank pushes virtual numbers for online
   and international purchases, and the cardholder can delete or regenerate one in
   the app at any time. The instant they do, the old number stops resolving at the
   issuer — which produces exactly this code. The 09/2034 expiry is consistent with
   a recently minted virtual card.
2. **A re-issued physical card** (lost, stolen, replaced) whose old number is dead.
3. **The issuer refusing a cross-border recurring charge** and returning something
   Stripe reads as a bad number.

### Why he goes first

**The retries are wasted on him.** Stripe will keep presenting the same token, and
if the issuer does not recognize the number, every attempt fails identically until
the window closes. Sami's decline might clear by itself; this one will not.

Worse, the automated email he already has tells him *"an expired-or-replaced card
or a momentary insufficient-funds hold may simply clear on its own."* For his
decline code that sentence is actively misleading — it tells him to wait, and
waiting is the one thing that guarantees he churns. Correcting it is the reason to
write, and it is a good reason.

### Language

He signed up on an English-only site and read English emails throughout the trial,
so the draft is English. Do not machine-translate it to seem personal — a rough
pt-BR email from a founder who then can't hold the reply reads worse than a good
English one. If you'd rather send Portuguese, ask and I'll write a proper version.

### ⚠ Verify first

- **Check whether a retry has already run since 7:24 PM, and what it returned.** If
  attempt 2 also came back `incorrect_number`, say so in the email — it turns the
  hypothesis into an observation and makes "replace it, don't wait" unarguable.
  There is a bracket in the draft for that sentence.
- **`make extend-trial` does not apply here.** It only pushes `trial_end` on a sub
  Stripe still reports as `trialing`; he is `past_due`. `reactivate-member` doesn't
  either — it needs a churned member with no live sub. So do not offer him more
  time in the email: the only honest levers are a hand edit in Stripe, or letting
  the window lapse and using `make recover-orphan-payment` if he pays the open
  invoice from Stripe's own dunning mail later.

### Draft

**Subject:** That card decline isn't what Stripe says it is

Hi Matheus,

You got an automated note from us last night saying the first charge after your trial was declined. I went and looked at the actual decline, and I want to correct something in that email before it costs you your access.

Your bank returned the code "incorrect card number." That is almost certainly not what happened. You never typed a card number for this charge — the card you added at the start of the trial was stored with Stripe, and it worked, which is how you had full access all week. A stored card doesn't develop a typo.

What that code usually means with Nubank is that the number is no longer live at the bank. The two common ways that happens: the card was a virtual number and it got deleted or regenerated in the app, or the physical card was replaced and the old number retired. Either way the bank is being handed a number it no longer recognizes.

Here's why I'm writing instead of leaving it to the automatic retries. That first email says a retry may clear it on its own. For an insufficient-funds hold, that's true. For this, it isn't — Stripe will keep presenting the same number and the bank will keep not finding it. [IF ATTEMPT 2 HAS ALSO FAILED: It already tried again on [DATE] and got the same answer.] Waiting doesn't fix this one.

What does fix it takes about thirty seconds: add a different card. If you were using a virtual card, generate a fresh one in the Nubank app, or use the physical card number instead. Sign in at https://zerogex.io/account and hit Manage Subscription — that opens Stripe's billing portal, where the payment method lives.

One thing worth checking while you're in the app: make sure international purchases are enabled on whichever card you use. We bill in US dollars, so even though you were charged in reais, the payment still crosses the border.

The deadline, so it isn't a surprise. Your full Pro access stays on through [GRACE DATE]. If nothing clears by then the account simply moves to the free tier — nothing is deleted, your settings and history stay exactly as they are, and Pro switches back on by itself the moment a charge goes through, whether that's this week or next month.

And if the timing is just bad, or you've decided ZeroGEX isn't for you, reply and tell me straight. I'd rather know than guess it from a card decline.

Michael
Founder, ZeroGEX

---

## Priority 2 — egold24@pm.me ($299/yr Pro, BNP Paribas via Apple Pay)

### The read

Stripe got **no reason at all**: `generic_decline`, network code 83, *"the bank
returned the decline code and did not provide any other information."* Risk level
Normal, so this is not Radar and not us. Everything useful has to be inferred from
the shape of the charge — and this charge is unusual in three ways at once:

1. **It's a debit card.** The money has to be sitting there on the day. A credit
   line absorbs a $299 hit; a current account may not. French debit cards also
   carry a cardholder-set spending ceiling (*plafond de paiement*), often with a
   separate, lower one for online or foreign payments, that a single $299
   international charge can breach on its own.
2. **It's the largest charge we make.** $299 annual is five times the $59 monthly.
   He picked the plan most likely to trip a ceiling or a fraud model — and the
   trial gave no warning, because the trial charged nothing.
3. **It's an unauthenticated, merchant-initiated charge on an Apple Pay token.** At
   checkout he authorized it with Face ID. The trial-end charge has no cardholder
   present, so there is no authentication to present — the indicator Stripe
   recorded (ECI 07) is the no-3DS value, which is normal and correct for a
   recurring charge. European issuers under PSD2 are the ones most likely to
   decline that shape when they don't take the exemption, and to say nothing about
   why. `generic_decline` with no detail is what that looks like from our side.

A fourth thing worth knowing, and the reason one of the suggestions below isn't
superstition: **Apple Pay never gives the bank the card number.** It presents a
device-specific token — a different number from the one printed on the card. So
"add the same card again, by typing the number" is a genuinely different attempt,
not the same one twice.

None of the three above is confirmable from a `generic_decline`. They are ranked
hypotheses, and the draft presents them as such rather than telling him what his
bank did.

### The offer that makes this note worth sending

**Move him to $59/month.** If a ceiling or a fraud model is what killed it — and on
a debit card, at the largest amount we bill, that is the leading hypothesis — then
the most effective fix isn't a different card, it's a smaller charge. It keeps a
customer we are otherwise about to lose over an *amount*, and he can go back to
annual whenever he likes.

Don't send him to the portal to do it. Offer to do it for him.

### ⚠ Verify first

- **There is no clean target for an annual → monthly move on a `past_due` sub.**
  `decidePlanSwitch` routes every cadence change to the Stripe portal
  (`core/planSwitch.ts`), and the portal schedules downgrades at period end — which
  does nothing for a first invoice that was never paid. `upgrade-at-current-price`
  is a basic → pro tier move, not a cadence move. Doing this means editing the
  subscription in Stripe by hand: swap to the monthly price, and decide what
  happens to the open $299 invoice (voiding it and letting the monthly invoice
  generate is the clean version). **Work out exactly what you'll do before you
  offer it** — the draft promises "you won't need to do anything," and that promise
  has to hold.
- Confirm the $299 invoice is still open and unpaid, and whether a retry has run
  since 5:42 PM.
- If you'd rather not hand-roll the cadence switch, cut that one paragraph. The
  rest of the draft stands without it.
- The site has a French locale (`page.i18n.ts`) if he turns out to prefer it — but
  a BNP card is not evidence of language, so the draft doesn't presume. Mention the
  language switcher only if he replies in French.

### Draft

**Subject:** Your bank declined the ZeroGEX charge without telling us why

Hi Sami,

You had an automated note from us last night about the first charge after your trial being declined. I looked at the decline itself, and there's more worth saying than that email could.

Your bank — BNP Paribas — rejected the charge and sent back no reason whatsoever. Not insufficient funds, not an expired card, nothing. Stripe records that as a "generic decline," which really does mean the bank said no and declined to say why. So as far as anyone here can see there's nothing wrong with your card, and nothing went wrong on our end either.

What I can tell you is what was unusual about this particular charge, because three things about it make a European bank nervous at once. It was $299 in US dollars — the annual plan, and the largest single amount we ever bill. It went to a debit card rather than a credit card, so it needed the money to be there on the day and it counts against whatever online payment ceiling your account carries. And it was a recurring charge, so there was no Face ID prompt the way there was when you first set it up. That's normal for a subscription, but it's also the exact shape banks in Europe are strictest about.

Three things that would each fix it, easiest first.

Open your BNP app and look for a blocked or pending payment, and check your ceiling for online and international payments. A single $299 charge can sit above a monthly limit you've never had reason to notice. Approving the payment, or raising the ceiling, is usually all it takes.

Or add a different card at https://zerogex.io/account — sign in, hit Manage Subscription, and the payment method is in there. One thing worth knowing: Apple Pay doesn't hand the bank your card number, it hands over a separate device number. So adding that same card the ordinary way, by typing the number in, really is a different attempt and not the same one twice. A credit card would also clear this more reliably than a debit card.

Or — and this is the one I'd suggest if the size of the charge is what tripped it — let me move you to the monthly plan at $59. Five times smaller, far less likely to hit a ceiling, and you can move back to annual whenever you want. Just reply with "monthly" and I'll take care of it; you won't need to do anything.

The deadline, so it isn't a surprise. Your full Pro access stays on through [GRACE DATE]. If nothing clears by then the account simply moves to the free tier — nothing is deleted, your settings and history stay exactly where they are, and Pro comes back on automatically the moment a charge succeeds.

And if you do end up calling the bank, give them the date and time (September 19, 5:42 PM), the amount ($299.00 USD) and the name on the statement (ZEROGEX), and tell them it's a recurring international card payment. That's the phrase that gets them to the right screen.

Michael
Founder, ZeroGEX

---

## What not to say

- **Don't re-explain the decline mechanics, and don't lead with the portal link.**
  The automated email did both, and the grace-expiry warning will do them again. If
  these notes read as a third dunning email they get filed as one, and the
  diagnosis — the only part worth sending — goes unread with them.
- **Don't tell Matheus a retry may clear it.** True for most declines, specifically
  wrong for his, and it is the sentence that would cost him the account.
- **Don't apologize for the decline.** Neither one is our fault, and an apology
  invites a refund conversation about money we never took.
- **Don't offer a discount.** Neither objected to the price — both chose a plan and
  lost it to a card. A discount answers a question they didn't ask and reprices
  them permanently. The monthly-plan offer to Sami is not a discount: it's the same
  rack rate at a cadence his bank will actually pass.
- **Don't promise more time.** `extend-trial` cannot touch a `past_due`
  subscription, so "I'll extend you" is a promise the tooling won't keep.
- **Don't blind-copy the two.** They share a failure mode and nothing else: one
  needs a different card, the other needs a smaller charge.

## After you send

- The automated grace-expiry warning still fires ~Sep 21 for both. **Leave it on.**
  It is the backstop for a note that goes unread, and it quotes the same
  `graceWindowEndIso`, so it cannot contradict what you sent.
- If Sami takes the monthly offer, do the Stripe edit before replying "done" — see
  the verify-first note above.
- If either window lapses and they later pay the open invoice from Stripe's own
  dunning mail, that's the orphan-payment path: `make scan-orphan-payments`, then
  `make recover-orphan-payment`.
- If a reply turns into anything substantive — a feature gap, a reason they were
  going to churn anyway — it belongs in its own `docs/outreach/` note, same as the
  cancellation follow-ups.
