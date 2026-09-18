# Payment-failure follow-ups — 2026-09-17

Six members are `past_due` inside an open payment-recovery grace window. Five
are trial conversions whose first charge was declined; one is a renewal on a
paying member. All six still have full access **right now**. Four lose it on
**Saturday, September 19**; hollandsp and arnab, whose trials converted after
the first four and who were added to this document later, lose it **Sunday the
20th** and are on a different send day accordingly.

These are **1:1 founder emails, sent from your own inbox** — not `mailer.ts`
sends. That is the point: every one of these people already got the automated
nudge within an hour of their charge failing, and a second templated email
saying the same thing in the same voice is worth nothing. What each of these
adds is the one fact the automation could not know — that this exact failure
cleared itself last month, that the bank blocked the charge rather than the
card, that three retries have already been spent, that the person never
actually used the product, that this one is still on its first attempt and may
yet clear by itself.

American English, and each paragraph in the drafts is a single line with no hard
wrapping, so it pastes straight into a mail client.

---

## The six, and where each one sits

| Member | Failure | Stripe's reason | On file | Amount | Access ends (ET) |
|---|---|---|---|---|---|
| sanba1608@hotmail.com | Renewal | none usable | Link (no card) | $29.00 | Sat Sep 19, 3:38 PM |
| gsavinova81@gmail.com | Trial conversion | issuer block (`transaction_not_allowed`) | Visa ····0665 | $59.00 | Sat Sep 19, 2:48 PM |
| lmckaiden@gmail.com | Trial conversion | none usable, 3 attempts spent | Link (no card) | $59.00 | Sat Sep 19, 1:50 AM |
| sebastienmyrthil227@gmail.com | Trial conversion | `invalid_account` — card is dead | Visa ····7014 | $59.00 | Sat Sep 19, 4:54 PM |
| hollandsp@ymail.com | Trial conversion | none usable, attempt 1 only | Link (no card) | $59.00 | **Sun** Sep 20, 12:51 AM |
| arnab.kumar.roy@icloud.com | Trial conversion | issuer block (`do_not_honor`) | Visa ····1546 | **$299.00/yr** | **Sun** Sep 20, 11:23 AM |

Deadlines are `payment_grace_started_at` + `BILLING_PAYMENT_GRACE_DAYS` (3, the
default — `core/stripe.ts`), converted to Eastern. The automated emails quote
the date only, so "Saturday, September 19" in a draft agrees with what the
member already has in their inbox.

## The sequence they are already in

For the first four, whose charges failed on the 16th:

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

**hollandsp and arnab are the same sequence shifted a day later.** hollandsp's
charge failed at 11:50 PM ET on the 16th and their day-0 email went out at 12:51
AM ET on the 17th; arnab's failed at 10:22 AM ET on the 17th with the day-0 email
an hour behind it. Both get their automated warning on the **19th** and lose
access on the **20th**.

**Send the first four today, and hollandsp and arnab tomorrow.** For the four,
tomorrow the automation sends the deadline email, and a founder note arriving *after* it
is the third email in three days saying the same thing — today it is the one in
the middle that says something new. For the other two, today would put your note
within hours of an automated email they have barely read; the 18th gives it a
day of air on both sides and still lands a full day before their warning.

## What none of these drafts do

- **No retry dates.** `next_payment_attempt` is not in the `diagnose-user`
  output, so no draft names one. It *is* obtainable:
  `make audit-trial-conversions` has a "Still unpaid: is Stripe going to try
  again?" section reporting, per open invoice, whether a retry is scheduled or
  the schedule is spent. Worth running before sending if you want to name a date
  — and worth running regardless for lmckaiden, whose draft asserts the retries
  are nearly exhausted on an attempt count alone.
- **No guessed decline reasons.** The judgment about what is usable is not mine:
  `make diagnose-user` prints it from `core/declineReason.ts`, the same
  classifier the new Payment Declines panel uses, so "no usable decline code"
  means the same thing in both places. The sanba, lmckaiden and hollandsp
  invoices carry none, so those drafts say what is true — the charge didn't go
  through, no reason given — and never invent insufficient funds. gsavinova's is an issuer
  block; the draft says the bank refused the charge and never repeats the
  fraud-flavored code back to them.
- **No to-the-minute cutoff.** The drop lands on the next sync after the window
  elapses, not at the instant. Drafts say "through Saturday," and lmckaiden's —
  whose window closes at 1:50 AM — says "early Saturday morning."

## Verify before any of them go out

- **Re-run `make diagnose-user` on all six.** A charge that clears between now
  and sending fires the payment-recovered email and makes the matching draft
  wrong in every paragraph. This is the check that matters.
- lmckaiden is at **attempt 3** as of 01:50 UTC today. If a fourth has landed,
  the "three times" line needs a number bump — and if it cleared, drop the email.
- gsavinova's hosted invoice URL is in their draft. Confirm the invoice is still
  `open` before sending a pay-now link.
- hollandsp is the one to re-check hardest, because you are sending a day later
  and their draft rests on the charge still being on **attempt 1**. If Stripe has
  retried by then — or if it cleared, which is a live possibility here — the
  email is wrong.
- **Two of these members have an API key** (gsavinova81, hollandsp). Both drafts
  say only that a key exists, never that it is in use, because `last_seen_at` is
  written from the session-cookie path alone — `core/renewalEngagement.ts` is
  explicit that a member driving ZeroGEX through the API looks idle in this
  column. The key service's own `last_used_at` is the real signal
  (`getActiveApiKey` in `core/apiKeyAdmin.ts`, the same field the member sees on
  their account page). Check it if you want to say more than "you set up a key."

---

## Priority 1 — sanba1608@hotmail.com

**Renewal declined** 2026-09-16 · $29.00 · Link, no card resolvable · access
through **Sat Sep 19, 3:38 PM ET**

### The read

The most valuable of the six and the one needing the lightest touch. A real
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
  on this same subscription. Re-confirm it before asserting it. Note it was their
  **trial conversion**, not a renewal (their `first_payment_cleared` is that same
  date), so the draft calls it "your first payment back in August." September is
  the first true renewal, and it is the one that just failed.
- The draft tells them you looked at their billing history. In a founder voice
  that reads as attentiveness, but if you'd rather not, cut that paragraph and
  the email still stands on the deadline alone.
- They carry a $30-off-for-6-months discount, so **$29** is right and $59 is
  wrong. Do not quote list price.

### Draft

**Subject:** Your ZeroGEX payment hasn't cleared yet — last month's did on its own

Hi — this one is from me directly, not the automated notice you got yesterday.

Your September payment of $29 didn't go through when it ran on the 16th, and Stripe is still retrying it. The reason I'm not alarmed, and don't think you need to be either: the same thing happened on your first payment back in August. It failed, retried, and went through on the third attempt two days later, without you having to do anything.

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

One of two cases — arnab is the other — where the fix is unambiguous and the
member has to do something. Stripe's code is `card_declined / transaction_not_allowed` with an
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
Sunday. The draft says they *set up* a key rather than that they are using one —
see the API-key note under "Verify before any of them go out" for why that
distinction is not pedantry.

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

One thing I want to flag, since you set up an API key: it's tied to Pro access. If the account drops on Saturday the key is revoked, so anything you've built against it stops returning data, and you'd need to generate a fresh key and swap it in once access is back. Clearing the charge before Saturday avoids all of that.

If the bank gives you a hard time, reply and tell me what they said and we'll find another way through it.

Michael
Founder, ZeroGEX

---

## Priority 3 — lmckaiden@gmail.com

**Trial conversion declined** 2026-09-16 · $59.00 · Link, no card resolvable ·
access through **Sat Sep 19, 1:50 AM ET** — the earliest of the six

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

Weakest save of the six, and the draft is written to admit that rather than
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

## Priority 5 — hollandsp@ymail.com

**Trial conversion declined** 2026-09-17 · $59.00 · Link, no card resolvable ·
access through **Sun Sep 20, 12:51 AM ET** — second-latest of the six

*Fifth in send order, not in value. This one goes out on the 18th rather than
today, which is the only reason it sits at the bottom; by engagement it belongs
next to gsavinova.*

### The read

The most hopeful of the six. Their trial ended at 11:50 PM
Eastern last night, the first charge was declined, and the automated nudge went
out an hour later. The invoice carries no usable decline code and they pay
through Link, so — as with sanba and lmckaiden — the draft names no reason and
no card.

What separates this one from lmckaiden, whose situation looks superficially
identical, is the **attempt count: 1**. Nothing has been spent. Stripe's retries
are all still ahead of them, and a first-attempt decline with nothing actionable
behind it is exactly the kind that clears on a later attempt — sanba's August
invoice, same shape, cleared on attempt 3. So this draft is allowed to say the
retries may well catch it, which the lmckaiden draft is not. That single
difference sets the whole tone: a heads-up with a lever, not a rescue.

They are also genuinely engaged, on the only evidence that is trustworthy here.
They were **in the app yesterday afternoon**, 1:18 PM ET, about ten hours before
the trial converted —
and `last_seen_at` only records web sessions, so that is a real browser visit,
not an API call. They generated an API key two minutes after the welcome modal
on signup night.

### ⚠ Verify first

- **Attempt count is the load-bearing fact.** You are sending a day later than
  the rest, so re-check it. If a second attempt has failed by then, cut the "this
  was the first attempt" paragraph and the optimism with it. If the charge
  cleared, don't send at all — the payment-recovered email will have gone out.
- Do not diagnose the Link failure. Stripe reports insufficient funds at the
  provider, but flags the code as unusable, and `core/paymentMethodDrift.ts` is
  explicit that Link never exposes the funding card behind the wallet. The draft
  therefore offers adding a card as *a different instrument to try*, and never
  promises it will work.
- Their key is `2ZXfTYOH`. As with gsavinova, the draft claims only that it
  exists. Check `last_used_at` if you want to say more.
- The deadline wording is "Saturday night," which is how 12:51 AM Sunday reads
  to a person. That is deliberate — but it also means this is the one draft
  where the date you write and the date the automated warning writes
  (September 20) are not the same word. Keep both, they agree.

### Draft

**Subject:** Your first ZeroGEX charge didn't go through — and the bank didn't say why

Hi — this is me directly, not the automated notice that went out overnight.

Your trial ended just before midnight Eastern and the first charge of $59 was declined. Let me be straight about what I know and what I don't: the bank turned it down and returned nothing I can act on — no expired card, no wrong number, no stated reason. I'd rather tell you that than invent a cause and send you chasing the wrong fix.

The encouraging part is that this was the first attempt. Stripe retries automatically over the next few days, and a first-time decline with nothing specific behind it quite often goes through on a later try with nothing needed from you.

If you'd rather not leave it to chance, there's one lever worth knowing about. Your subscription pays through Link rather than a card saved with us, which means the funding source behind it isn't something I can see or check from here. Adding a card directly at https://zerogex.io/account takes about a minute and gives the next attempt a different route to run against.

The date that matters: your full access is on right now and runs through Saturday night — the window closes just after midnight, early Sunday the 20th. If nothing has cleared by then the account moves to the free Public tier. Nothing is deleted, your account and history stay exactly as they are, and full access switches back on automatically the moment a charge succeeds.

One thing worth flagging since you set up an API key: it's tied to Pro access, so if the account drops the key is revoked and you'd generate a fresh one when access comes back. Sorting the payment before Sunday avoids that entirely.

And if something's holding you back, or the timing is just wrong, reply and tell me. I read every one.

Michael
Founder, ZeroGEX

---

## Priority 6 — arnab.kumar.roy@icloud.com

**Trial conversion declined** 2026-09-17 · **$299.00 / year** · Visa ····1546 ·
access through **Sun Sep 20, 11:23 AM ET**

*Deliberately the shortest draft in this document — written plain and simple on
request. Send it on the 18th, with hollandsp.*

### The read

Three things set this one apart, and only the first changes the copy.

**The decline is an issuer block**, `do_not_honor` [59] — the same class as
gsavinova's, a bank refusing an otherwise-valid card. The card is fine: Visa
····1546, good through 2030, correct details. So there is a real, specific ask
here, and it is not "update your card": get the bank to allow the charge, or
pay the invoice with a different one. The invoice is still `open`, so both work.

**It is the largest amount in the batch by five times** — $299 annual, not $59
monthly, and the only annual plan of the six. Worth knowing when you decide how
much of your day this one gets. It is also a plausible reason a bank balked,
though the draft does not say so, because a guess about why is exactly what
`core/declineReason.ts` tells you not to put in customer mail.

**They were in the app twenty minutes before the charge ran** — last seen 10:00
AM ET today, the trial converted at 10:22. Nobody here is drifting away; they
were using it this morning and the bank said no this morning.

### ⚠ Verify first

- `in_1UGgCy4AOiqteMYYAga8XS9Q` must still be `open` — the draft links its
  hosted invoice page as the pay-now path.
- Say "your bank declined it," never `do_not_honor`. The code reads as an
  accusation and means nothing to a member.
- The draft offers to re-run the charge once the bank clears it. That is the
  Stripe dashboard retry on the open invoice; fine to promise, just know you are
  promising it.
- $299 is annual. Quoting $59 here would be wrong twice over.

### Draft

**Subject:** Your bank declined the ZeroGEX charge

Hi,

A quick note from me, not an automated one.

Your free trial ended this morning, and the $299 annual charge did not go through. The problem is not your card details. Your Visa ending in 1546 is valid and on file. Your bank turned down this particular charge.

There are two easy ways to fix it.

The first is to call your bank, or approve the charge in their app, and ask them to allow it. It shows up as ZeroGEX, billed through Stripe. Once you have done that, reply to this email and I will run the charge again from my end.

The second is to pay the invoice right now with a different card: https://invoice.stripe.com/i/acct_1TOi5O4AOiqteMYY/live_YWNjdF8xVE9pNU80QU9pcXRlTVlZLF9WSEVnY2haVUQ2UVNPT3pvTmUwbENSUTZhR285b3UxLDE4MDE5OTUzOA02004RK7FaDH?s=ap

Either one works. Your Pro access stays on through Sunday, September 20. If nothing has gone through by then, your account moves to the free Public plan. Nothing is deleted, and full access comes back as soon as a payment succeeds.

If you get stuck, reply and tell me what your bank said. Happy to help.

Michael
Founder, ZeroGEX

---

## The declines-panel check for 9/16–9/17

Two things to know before reading any number off it.

**The panel cannot slice two days.** `app/api/admin/monitoring/declines/route.ts`
accepts only `days` of 7, 30, 90, 180, 365 or `all`, and silently falls back to
90 on anything else. Use **`days=7`** and read its `daily` series, which carries
one row per day with `trialConversion`, `renewal`, `paidInvoices` (the
denominator) and `declineRate`.

**Its days are Eastern, not UTC** (`etDayKey`, `core/paymentDeclines.ts`), and
each decline buckets on the attempt's own `failedAt`, not on when the invoice
was created. That matters here: Stripe charges these invoices about an hour
after finalizing them, so hollandsp's invoice was created at 11:50 PM ET on the
16th but its decline landed at 12:51 AM ET on the **17th**.

So the six members in this document should appear as **four declined invoices on
9/16 and two on 9/17**:

| ET day | Declined invoices | Attempts | Who |
|---|---|---|---|
| 2026-09-16 | 4 | 6 | lmckaiden 1:50 AM (+ retries 10:50 AM and 9:50 PM), gsavinova 2:48 PM, sanba 3:38 PM, sebastien 4:54 PM |
| 2026-09-17 | 2 | 2 | hollandsp 12:51 AM, arnab 11:23 AM |

**Treat that as a known-answer test.** These counts are hand-derived from the
`stripe_payment_failed` audit rows in six `diagnose-user` outputs. If the panel
reports the same shape, the tracker is capturing live declines correctly on its
first week. If it reports fewer, something in the capture path is dropping rows
and every number on the panel is soft until that is explained. Either way you
learn something worth more than the two counts.

The question the counts are *for* is the denominator: `paidInvoices` on those
two days, and `byKind` for `trial_conversion`. Five consecutive trial
conversions declining is either a bad run of cards or a real problem, and only
the successes tell you which.

To print exactly those rows, from `~/zerogex-web/frontend`:

```bash
cat > /tmp/decline-days.mts <<'SCRIPT'
import fs from 'node:fs';
import path from 'node:path';

// core/db.ts reads AUTH_DB_PATH at MODULE scope, so .env.local has to be loaded
// before the report module is imported — hence the dynamic import below.
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const { getPaymentDeclineReport } = await import(
  path.join(process.cwd(), 'core', 'paymentDeclinesServer.ts')
);

const WANT = new Set(['2026-09-16', '2026-09-17']);
const pct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);

// reconcile:false keeps this a pure read — no write pass.
const report = getPaymentDeclineReport({ windowDays: 7, reconcile: false });

console.log('Days bucket in America/New_York, same as the panel.\n');
for (const d of report.daily) {
  if (!WANT.has(d.day)) continue;
  console.log(
    `${d.day}  declined_invoices=${d.invoices}  attempts=${d.attempts}  ` +
      `trial_conv=${d.trialConversion}  renewal=${d.renewal}  ` +
      `paid_that_day=${d.paidInvoices}  decline_rate=${pct(d.declineRate)}  ` +
      `recovered=${d.recoveredInvoices}  open=${d.openInvoices}  lost=${d.lostInvoices}`,
  );
}

console.log('\nBy kind, 7-day window:');
for (const k of report.byKind) {
  console.log(
    `  ${k.label}: invoices=${k.invoices}  recovered=${k.recoveredInvoices}  ` +
      `open=${k.openInvoices}  lost=${k.lostInvoices}`,
  );
}

console.log(
  `\nReason coverage: withCodes=${report.coverage.withCodes} ` +
    `withoutCodes=${report.coverage.withoutCodes}`,
);
SCRIPT

node --experimental-strip-types --no-warnings /tmp/decline-days.mts
```

Read-only: `reconcile: false` skips the report's write pass, and nothing else in
it writes. If the daily rows come back empty, the capture path has no history
yet — run `make backfill-payment-declines SKIP_STRIPE=1 DRY_RUN=1` first and see
what it says it would reconstruct.

**The Stripe-side complement is `make audit-trial-conversions`** (`DAYS=14`).
The panel reports what our own tables recorded; that script goes back to Stripe
and reports what actually happened — the payment method type behind each
conversion, whether its SetupIntent completed, how many attempts were really
made, and whether each still-unpaid invoice has another retry coming. Between
the two, every open question in the asides below is answerable today, and
neither one writes anything.

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
- **Five consecutive trial conversions were declined**: three from the September
  9 signups, converting on the 16th within fifteen hours of each other, and both
  of the September 10 signups, converting on the 17th. Five different decline
  codes — `invalid_account`, `transaction_not_allowed`, `do_not_honor` and two
  distinct no-detail failures — argue for coincidence rather than anything
  systemic, and a two-day cohort is small. But five for five is worth ten
  minutes, and as of today there are two purpose-built places to spend them,
  both landed on `release` while this document was being written.

  **`make audit-trial-conversions`** is the direct answer — read-only, writes
  nothing anywhere, and its headline is literally "trials examined / reached a
  real first charge / of those, declined at least once / eventually paid." Use
  `DAYS=14` to cover this batch and its neighbours. Start here.

  **Admin → Monitoring → Stripe → Payment Declines** is the money view over the
  same events: `trial_conversion` as its own kind, recovery counted per invoice
  rather than per retry (`docs/payment-decline-metrics.md`). Run
  `make backfill-payment-declines` first if its history is thin.

  If some conversions cleared this week, this is a bad run of cards. If none
  did, it is a different conversation, and these emails are the wrong response
  to it.
- **Three of the six pay through Link, and all three failed** — two of them
  reporting `partner_insufficient_funds`. Tempting to read as a Link problem,
  and worth holding at arm's length: sanba's Link method has successfully
  collected on this deploy before — their August trial conversion, which cleared
  on attempt 3 — so Link charges demonstrably work here. And there is now a way
  to settle it rather than argue it: `make audit-trial-conversions` breaks its
  decline rate down **by payment method type**, under a heading saying
  off-session reliability differs sharply between them, and reports SetupIntent
  completion — the mechanism that would explain a wallet that cannot be charged
  off-session at all. Note `core/paymentMethodDrift.ts`
  would not flag any of these — drift is a subscription pin disagreeing with a
  customer default, and every one of these accounts has no customer default set
  at all, which is the ordinary arrangement.
- **hollandsp started checkout twice** on signup night — 03:10:47, which created
  the Stripe customer and went no further, then 03:48:03, which completed. That
  is 37 minutes apart and could be nothing more than an abandoned tab. It stays
  out of their email for exactly that reason, but it is a second friction point
  on the same payment path, and it is part of why "add a card directly" is the
  right lever to offer them rather than "wait and see."
- Four grace windows close across a fifteen-hour span on Saturday (1:50 AM to
  4:54 PM ET) and two more on Sunday (12:51 AM and 11:23 AM), so the warning
  sweep has to run at least once inside each. The timer is every 4h, so it
  will.
- **Every one of these invoices was charged about an hour after it was
  created** — 03:50 → 04:51 for hollandsp, 19:53 → 20:54 for sebastien, the same
  gap in all six. That is Stripe's finalize-then-charge delay, not a fault, but
  it is why the decline's own timestamp and the invoice's creation time fall on
  different ET days for hollandsp, and it is worth knowing before reconciling
  any of this against the tracker.
