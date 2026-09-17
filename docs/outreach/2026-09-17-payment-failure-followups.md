# Payment-failure follow-ups — 2026-09-17

Four members are `past_due` inside an open payment-recovery grace window. Three
are trial conversions whose first charge was declined; one is a renewal on a
paying member. All four still have full access **right now**, and all four lose
it on **Saturday, September 19** unless a charge clears.

These are **1:1 founder emails, sent from your own inbox** — not `mailer.ts`
sends. That is the point: every one of these people already got the automated
nudge on the 16th, and a second templated email saying the same thing in the
same voice is worth nothing. What each of these adds is the one fact the
automation could not know — that this exact failure cleared itself last month,
that the bank blocked the charge rather than the card, that three retries have
already been spent, that the person never actually used the product.

American English, and each paragraph in the drafts is a single line with no hard
wrapping, so it pastes straight into a mail client.

---

## The four, and where each one sits

| Member | Failure | Stripe's reason | On file | Amount | Access ends (ET) |
|---|---|---|---|---|---|
| sanba1608@hotmail.com | Renewal | none usable | Link (no card) | $29.00 | Sat Sep 19, 3:38 PM |
| gsavinova81@gmail.com | Trial conversion | issuer block (`transaction_not_allowed`) | Visa ····0665 | $59.00 | Sat Sep 19, 2:48 PM |
| lmckaiden@gmail.com | Trial conversion | none usable, 3 attempts spent | Link (no card) | $59.00 | Sat Sep 19, 1:50 AM |
| sebastienmyrthil227@gmail.com | Trial conversion | `invalid_account` — card is dead | Visa ····7014 | $59.00 | Sat Sep 19, 4:54 PM |

Deadlines are `payment_grace_started_at` + `BILLING_PAYMENT_GRACE_DAYS` (3, the
default — `core/stripe.ts`), converted to Eastern. The automated emails quote
the date only, so "Saturday, September 19" in a draft agrees with what the
member already has in their inbox.

## The sequence they are already in

1. **Sep 16 — sent.** The day-0 dunning email. Trial conversions got
   `sendTrialConversionFailedEmail` ("Your ZeroGEX trial ended — a quick card fix
   to keep your access"); sanba got `sendPaymentFailedEmail` ("We couldn't
   process your ZeroGEX payment"). Confirmed in each audit log.
2. **Sep 17 — these.** The middle touch, and the only human one.
3. **Sep 18 — automatic.** `send-grace-expiry-warnings` fires ~24h before the
   window closes (timer runs every 4h). All four qualify: `past_due`, no
   cancellation, window open well past the 12h floor. Subject will be *"Your
   ZeroGEX access ends September 19, 2026 — the first charge didn't go through"*
   (renewal variant for sanba). It leads with the deadline and states that the
   downgrade is non-destructive.
4. **Sep 19 — access drops** to the free Public tier on the next subscription
   sync after the window elapses.

**Send these today.** Tomorrow the automation sends the deadline email, and a
founder note arriving *after* it is the third email in three days saying the
same thing. Today it is the one in the middle that says something new.

## What none of these drafts do

- **No retry dates.** `next_payment_attempt` is not in the `diagnose-user`
  output, so no draft names one. If you want to say "Stripe tries again on X,"
  pull it from the invoice first.
- **No guessed decline reasons.** sanba's and lmckaiden's invoices carry no
  usable code, so the drafts say what is true — the charge didn't go through, no
  reason given — and never invent insufficient funds. gsavinova's is an issuer
  block; the draft says the bank refused the charge and never repeats the
  fraud-flavored code back to them.
- **No to-the-minute cutoff.** The drop lands on the next sync after the window
  elapses, not at the instant. Drafts say "through Saturday," and lmckaiden's —
  whose window closes at 1:50 AM — says "early Saturday morning."

## Verify before any of them go out

- **Re-run `make diagnose-user` on all four.** A charge that clears between now
  and sending fires the payment-recovered email and makes the matching draft
  wrong in every paragraph. This is the check that matters.
- lmckaiden is at **attempt 3** as of 01:50 UTC today. If a fourth has landed,
  the "three times" line needs a number bump — and if it cleared, drop the email.
- gsavinova's hosted invoice URL is in their draft. Confirm the invoice is still
  `open` before sending a pay-now link.

---

## Priority 1 — sanba1608@hotmail.com

**Renewal declined** 2026-09-16 · $29.00 · Link, no card resolvable · access
through **Sat Sep 19, 3:38 PM ET**

### The read

The most valuable of the four and the one needing the lightest touch. A real
paying member since August 18, logging in on a dozen-plus separate days in the
visible audit window and last seen **last night**. Monitoring counts them as a
Full Subscriber precisely because access never dropped.

The fact that makes this email worth sending: **this already happened last
month and fixed itself.** The August invoice (`in_1U58wJ…`, $29) failed, retried,
and cleared on **attempt 3** two days later with nothing required from them.
Same subscription, same payment method, same shape of decline. So the honest
message is not "your card is broken, act now" — it is "this is the same thing as
last month, here's the deadline, and here's the one lever if you'd rather not
wait."

Their invoice carries no usable decline code, so the draft names no reason at
all. They pay through Link, so it names no card either.

### ⚠ Verify first

- The August recovery is the load-bearing claim. It is in the invoice list from
  `diagnose-user` — `in_1U58wJ4AOiqteMYYmeRZoiHX`, `attempt=3`, `paid=2026-08-18`,
  on this same subscription. Re-confirm it before asserting it.
- The draft tells them you looked at their billing history. In a founder voice
  that reads as attentiveness, but if you'd rather not, cut that paragraph and
  the email still stands on the deadline alone.
- They carry a $30-off-for-6-months discount, so **$29** is right and $59 is
  wrong. Do not quote list price.

### Draft

**Subject:** Your ZeroGEX payment hasn't cleared yet — last month's did on its own

Hi — this one is from me directly, not the automated notice you got yesterday.

Your September payment of $29 didn't go through when it ran on the 16th, and Stripe is still retrying it. The reason I'm not alarmed, and don't think you need to be either: the same thing happened on your August renewal. It failed, retried, and went through on the third attempt two days later, without you having to do anything.

There's a fair chance this one resolves the same way. What I do want you to have is the deadline, because that part is real. Your Pro access is on right now and stays on through Saturday, September 19. If nothing has cleared by then the account moves to the free Public tier — nothing is deleted, your settings and history stay exactly as they are, and full access switches back on automatically the moment a charge succeeds.

One detail that might matter: your subscription pays through Link rather than a card saved with us, so whatever Link draws from is what has to go through. If you'd rather not leave it to the retries, you can add a card directly at https://zerogex.io/account and the next attempt will run against that instead. Takes about a minute.

You're in the app most days, which is the only reason this note exists rather than another automated one. If something else is going on, or this month is just bad timing, reply and tell me.

Michael
Founder, ZeroGEX

---

## Priority 2 — gsavinova81@gmail.com

**Trial conversion declined** 2026-09-16 · $59.00 · Visa ····0665 · access
through **Sat Sep 19, 2:48 PM ET**

### The read

The only one of the four where the fix is unambiguous and the member has to do
something. Stripe's code is `card_declined / transaction_not_allowed` with an
`issuer_block` flavor: the card is valid and the details are right, and the bank
refused this particular charge. That is the classic cross-border recurring
decline, and it does **not** clear on retries — it repeats until the cardholder
authorizes it. Telling them to "wait for the retry" would be false comfort.

They are also engaged: returned on the 15th, acknowledged the onboarding, and
**generated an API key** (`O0uJYcbR`) within four minutes of signing up. That
makes the lapse consequence concrete in a way it isn't for the others — leaving
Pro runs `revokeApiKeysIfTierDropped` (`core/apiKeyAdmin.ts`) and every key on
the account is revoked. Anything they have wired up stops returning data, and
they should hear that from you before Saturday rather than discover it on
Sunday.

Two paths in the draft, because the invoice is still `open`: get the bank to
allow it, or pay that invoice outright with a different card. Both resolve the
`past_due` and keep the subscription.

### ⚠ Verify first

- **Never repeat the code back to them.** `transaction_not_allowed` reads as
  fraud, and it isn't. The draft says their bank refused the charge, which is
  what happened.
- The draft says the block is common on recurring charges from an overseas
  merchant. Their signup and sessions come from `2.134.194.16`, which is not
  US-based, so the framing fits — but if you know otherwise, change that clause
  to "a recurring charge your bank didn't recognize" and the rest holds.
- The draft offers to push the retry from your side once the bank clears it —
  that's the Stripe dashboard retry on the open invoice. Fine to promise, just
  know you're promising it.
- Confirm `in_1UGMvw4AOiqteMYY8cagTBrp` is still `open` before sending the link.

### Draft

**Subject:** Your bank declined the ZeroGEX charge — it needs their OK, not a new card

Hi — a personal note from me, not the automated one from yesterday.

When your trial converted on the 16th, the $59 charge came back declined — but the decline wasn't really about the card. Your Visa ending in 0665 is valid and the details we have are right. Your bank refused this particular charge. That's a common one on recurring charges from an overseas merchant, and the important part is that it usually repeats on every automatic retry until someone tells the bank to let it through.

So there are two ways to clear it, and both are quick.

One: ask your bank to approve it — a phone call, or often a tap in their app — and tell them to allow recurring charges from ZeroGEX, which they'll see billed through Stripe. Once they've cleared it, tell me and I'll push the charge through from my side rather than making you wait for the next automatic attempt.

Two: or pay the open invoice directly with a different card, here: https://invoice.stripe.com/i/acct_1TOi5O4AOiqteMYY/live_YWNjdF8xVE9pNU80QU9pcXRlTVlZLF9WR3VsNGluTk41eDdpWjg2b2w1S1poYm1JYmFydVJiLDE4MDE1MjQ5Mg0200TIf9BB4A?s=ap — that settles it on the spot and your subscription carries on normally.

On timing: your full access is on right now and runs through Saturday, September 19. If nothing has cleared by then the account moves to the free Public tier — nothing is deleted, and full access comes back automatically the moment a charge succeeds.

One thing I want to flag, because you're actually using the API: your API key is tied to Pro access. If the account drops on Saturday the key is revoked, so anything you've built against it stops returning data, and you'd need to generate a fresh key and swap it in once access is back. Clearing the charge before Saturday avoids all of that.

If the bank gives you a hard time, reply and tell me what they said and we'll find another way through it.

Michael
Founder, ZeroGEX

---

## Priority 3 — lmckaiden@gmail.com

**Trial conversion declined** 2026-09-16 · $59.00 · Link, no card resolvable ·
access through **Sat Sep 19, 1:50 AM ET** — the earliest of the four

### The read

Engaged (signed up from `chatgpt.com`, came back repeatedly, last seen the 16th)
and the hardest to help, because the bank returned nothing usable:
`payment_intent_generic_payment_failed`, "the bank did not return any further
details with this decline."

What is unusual here is the **attempt count: 3 already**, the last at 01:50 UTC
today — roughly 10 PM Eastern last night. Attempts 2 and 3 sent no email at all;
the webhook gates dunning on `attempt_count === 1` by design, which is exactly
the hole the grace-expiry warning was built to cover. So this member has heard
nothing since day 0 while their charge failed twice more.

Two consequences for the draft. First, "the retry will probably catch it" is not
a credible thing to tell someone whose charge has now failed three times — the
draft says so plainly. Second, their deadline is **13 to 15 hours earlier** than
the other three: 1:50 AM Saturday means the practical cutoff is Friday night.
The draft says that rather than letting them read "Saturday" as "any time
Saturday."

Since there is no diagnosable cause, the draft asks for the one thing that
changes the outcome — put a card on directly rather than routing through Link —
without claiming to know why Link is failing.

### ⚠ Verify first

- **Check the attempt count again before sending.** A fourth attempt may have
  landed overnight; if it cleared, this email is wrong end to end.
- Do not diagnose the Link failure. There is no code, and the draft deliberately
  stops at "no reason given" and "here's the lever."
- The "roughly 2 AM Eastern" line is more precise than the automated emails,
  which quote the date only. That's intentional here and correct — just don't
  promise an exact cutoff, since the drop lands on the next sync after it.

### Draft

**Subject:** Three failed attempts on your ZeroGEX charge — and no reason given

Hi — this is me writing directly, not the automated notice from yesterday.

Your trial converted on the 16th and the first charge of $59 still hasn't gone through. Stripe has now tried three times, the most recent around 10 PM Eastern last night, and not one of them came back with a reason I can act on — no expired card, no wrong number, no insufficient funds. The bank simply declined without detail. I'd rather tell you that than guess at a cause and send you chasing the wrong fix.

Here's the one lever I'd pull. Your subscription pays through Link rather than a card saved with us, which means the funding source behind it is something I can't see or check from here. Adding a card directly at https://zerogex.io/account takes about a minute, and it gives the next attempt something different to run against instead of repeating the same path that keeps failing.

On timing, your window is tighter than it looks: your access runs out early Saturday morning, around 2 AM Eastern on the 19th, so realistically Friday night. After that the account moves to the free Public tier. Nothing is deleted, your history stays, and full access switches back on the moment a charge succeeds.

And to be straight with you — after three failed attempts, I wouldn't count on the automatic retries to rescue this one.

If you've decided ZeroGEX isn't for you, that's genuinely fine. You don't need to reply and nothing will be charged. But if you do want it, reply and tell me what you're seeing on your end, and I'll work it out with you.

Michael
Founder, ZeroGEX

---

## Priority 4 — sebastienmyrthil227@gmail.com

**Trial conversion declined** 2026-09-16 · $59.00 · Visa ····7014 · access
through **Sat Sep 19, 4:54 PM ET**

### The read

Weakest save of the four, and the draft is written to admit that rather than
paper over it.

The card is genuinely dead: `card_declined / invalid_account`, the bank saying
the account behind the card isn't valid. This is the one case in the set where
"update your card" is the correct and only ask — retries cannot recover it.

But the usage tells the real story. Registered September 9 at 19:51 UTC, last
seen 20:51 UTC the same day, **nothing since**. One hour, one session, no API
key, no return visit — `diagnose-user` flags them DORMANT. They are not a member
weighing whether to keep a tool they rely on; they are someone who signed up,
looked once, and left.

Pressing that person toward $59/month would be the third email in four days
pushing a product they have used for an hour. The draft instead gives them a
clean, explicit out — do nothing, you won't be charged, because the card
*cannot* be charged — and pairs it with a real offer to help if the reason they
never came back was that they didn't know where to start. That is the only
version of this email that can produce something useful: either a re-engaged
member or an honest answer about why the first hour didn't land.

### ⚠ Verify first

- `make extend-trial` is **not** a lever here. It only pushes out `trial_end` on
  a subscription Stripe still reports as `trialing`, and this one is `past_due`.
  Don't offer more trial time you can't grant with one command.
- The "you won't be charged" promise rests on the card being unchargeable. It is
  (`invalid_account`), but if they add a working card the subscription bills
  normally — which the draft says.
- Confirm they're still on `pro` with the window open, so "your access is still
  on" is true when it lands.

### Draft

**Subject:** Your card can't be charged — and an honest question

Hi — this is me, not the automated email.

Two things, and the second matters more than the first.

The card on file, the Visa ending in 7014, can't be charged at all. This wasn't a "not enough money today" decline or a temporary hold — the bank's answer was that the account behind the card isn't valid. Automatic retries won't fix that one. It needs a different card, or nothing.

Which brings me to the honest part. You signed up on September 9, spent about an hour in the app that day, and haven't been back since. Your trial ended on the 16th. I'm not going to send you a third email nudging you toward $59 a month for something you've used for an hour.

So, genuinely — what would you like to do?

If you want it: add a working card at https://zerogex.io/account. Your access is still on through Saturday, September 19, so doing it before then means nothing is interrupted.

If you don't: do nothing at all. The card can't be charged, so you won't be charged. On Saturday the account moves to the free Public tier, nothing is deleted, and you can pick it back up any time you want.

And if the real answer is that you opened it, didn't know where to start, or something didn't work the way you expected — reply and tell me that. It's the most useful email I could get today, and I'll help you get set up personally, card or no card.

Michael
Founder, ZeroGEX

---

## Ops asides — not customer-facing

- **sanba1608's subscription metadata says `tier=basic`** while the price is the
  Pro price and the DB row is `pro`. Harmless: nothing reads the subscription's
  `metadata.tier` (tier is recomputed from the price on every sync — see the
  note in `scripts/upgrade-at-current-price.mts`). Worth a glance only if you
  ever start trusting that field.
- **lmckaiden's attempts 2 and 3 sent nothing**, which is the `attempt_count === 1`
  gate working as designed and the exact gap `core/graceExpiryWarning.ts` exists
  to close. This case is a clean illustration that the second touch is doing real
  work: without it, a member three failed attempts deep would have heard nothing
  for three days and then silently lost access.
- **Three of the four registered on September 9** and their trials therefore all
  converted on the 16th, within fifteen hours of each other — and all three
  first charges were declined. Three different decline codes (`invalid_account`,
  `transaction_not_allowed`, and a generic no-detail failure) argue for
  coincidence on a small cohort rather than anything systemic, but it is worth
  knowing whether any 9/9 trial converted *successfully* before concluding that.
  If none did, that is a different conversation from four unlucky cards.
- Their three grace windows close across a fifteen-hour span on Saturday (1:50
  AM to 4:54 PM ET), so the warning sweep has to run at least once inside it to
  catch all three. The timer is every 4h, so it will.
