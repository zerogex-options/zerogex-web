# Payment-failure follow-ups (2026-10-02)

Eight members are `past_due` inside the 3-day payment grace window. Five are
trial conversions whose first charge failed; three are renewals on paying
members. All eight have full access right now. Seven get a note. Carlos, who
canceled, does not (section 8). Each already got the automated payment-failed
email, and each gets the automated grace-expiry warning about a day before
access drops.

These are 1:1 founder emails from your own inbox, not `mailer.ts` sends. Each
one is short and says one thing the automated emails can't. Every paragraph is a
single line so it pastes straight into a mail client.

Everything below comes from `make diagnose-user`, run 2026-10-02 around 13:40 UTC
(alexandre around 14:45 UTC; maxii, trujillo, carlos and a lyby re-check around
03:40 UTC on October 3).

## Who, and when to send

| Member | What failed | Reason | Plan | Access ends (ET) | Send |
|---|---|---|---|---|---|
| ksquareinc@protonmail.com | Renewal | none given (Link) | Pro, $29 promo | Sun Oct 4, 5:51 PM | ✅ Sent Fri Oct 2 |
| kenmaster030684@gmail.com | Trial conversion | insufficient funds | Basic, $29 promo | Sat Oct 3, 4:53 PM | ✅ Sent Fri Oct 2 |
| fahdadrees2@gmail.com | Trial conversion | insufficient funds | Pro, $59, no discount | Mon Oct 5, 9:22 AM | ✅ Sent Fri Oct 2 (a day early) |
| alexandre@venturacap.com.br | Trial conversion | insufficient funds (Link) | Pro, $59, no discount | Mon Oct 5, 10:39 AM | ✅ Sent Fri Oct 2 (a day early) |
| lybydallh053@gmail.com | Renewal | insufficient funds | Pro, $29 promo | Mon Oct 5, 12:42 AM | **Saturday, only if still unpaid** |
| maxii1231811@gmail.com | Trial conversion | insufficient funds | Basic, $29 promo | Sun Oct 4, 8:40 PM | **Saturday, before 8 PM ET** |
| trujillolamas@gmail.com | Renewal | none given (Link) | Pro, $59, no discount | Mon Oct 5, 10:32 PM | **Saturday** |
| carlos.flanigan07@gmail.com | Trial conversion | insufficient funds (Link) | Basic, $29 promo | Mon Oct 5, 11:47 AM | **No email** (canceled) |

Access ends 3 days after the first decline (`BILLING_PAYMENT_GRACE_DAYS`). The
automated warning goes out once fewer than 24 hours are left, on the next run of
the 4-hourly timer. A founder note lands best in the gap between the two
automated emails:

- **kenmaster**: the warning becomes due at 4:53 PM ET today. Send before then,
  or skip the note: after the warning it would be their fourth email in
  three days.
- **ksquare**: the warning is due Saturday evening, so today leaves a day on
  either side.
- **fahd and alexandre**: the charges failed at 9:22 and 10:39 AM ET today, and
  the automated emails went out with them. Saturday gives those a day, still
  lands before Sunday's warnings, and shows you whether Stripe's second try
  cleared.
- **lyby**: wait. This is the third month in a row that the first try came up
  short, and the last two both cleared on a retry: 19 hours later in September,
  about 35 hours later in August. If it has not cleared by Saturday afternoon,
  send the note. Their warning is due early Sunday. *Re-checked 11:40 PM ET
  Friday: still `past_due` on attempt 1. Stripe had not retried yet, so nothing
  had changed.*
- **maxii**: the charge failed at 8:41 PM ET Friday. Their warning is due at
  8:40 PM ET Saturday, so send Saturday before then.
- **trujillo**: the charge failed at 10:32 PM ET Friday. Their warning is due
  Sunday at 10:32 PM ET, so Saturday or Sunday daytime both work.

## Before each send

Re-run `make diagnose-user EMAIL=<email>`. If the status is `active`, or the open
invoice is no longer `status=open`, the charge cleared and the payment-recovered
email has already gone out. Send nothing.

If Stripe shows a first name for the customer, put it after "Hi". Only
alexandre's address gives a name safely ("kenmaster" is a Street Fighter
handle, and "trujillolamas" is a surname).

---

## 1. ksquareinc@protonmail.com

**Renewal declined** Thu Oct 1 · Pro, $29 a month ($30 off for 6 months) · Link,
no card visible · access through **Sun Oct 4, 5:51 PM ET**

### The read

A paying member. Their September charge cleared on the first try, and they
were in the app Tuesday. This is their first failure.

There is no usable decline reason
(`payment_intent_generic_payment_failed`), so the note names none. They pay
through Link, so it names no card either. It is attempt 1, so the retries may
well catch it. The one thing to offer is the `/pay` link, which takes any card
with no sign-in.

No API key on this account, so there is no key warning to give.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated one you got yesterday.

Your October Pro payment didn't go through on Thursday. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it.

Stripe will try again automatically over the coming days, and it may well go through on its own. If you'd rather settle it now, you can pay with any card here: https://zerogex.io/pay?i=in_1ULqwG4AOiqteMYY12TZrxov&t=dcJHGBMgb4VW71EfDy-BaI0MEt8O2fiyYglbtCssFRI

Your Pro access stays on through Sunday. If nothing has gone through by then, the account moves to the free Public tier. Nothing is deleted, and full access comes back automatically as soon as a payment succeeds.

If something has changed on your end, or you have a question, just reply.

Best,
Michael
Founder, ZeroGEX

---

## 2. kenmaster030684@gmail.com

**Trial conversion declined** Wed Sep 30 · Basic, $29 a month promo · Visa ····8067 ·
access through **Sat Oct 3, 4:53 PM ET** (10:53 PM in France)

### The read

The same case as Illian last week. They signed up from chatgpt.com on September
23, came back once the next day, and have not been back since. They have paid
nothing. Their sign-in IP addresses are on French ISPs.

They already have two automated emails: the original and your resend on
Thursday. The note is still worth sending for one reason. After Saturday,
Stripe keeps retrying for two to three weeks. If a retry clears on payday,
someone who used the product for one day gets charged, and that is how disputes
start. The note gives them an easy way to say "cancel it."

No amount in the draft. A French customer may be billed in euros through
Adaptive Pricing, and "$29" would not match what they saw. Basic is already the
cheapest plan and they already have the promo, so there is no cheaper offer to
make.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated emails.

Your ZeroGEX trial ended on Wednesday, and your bank declined the first Basic payment for insufficient funds.

Your access stays on through Saturday. If you'd like to keep Basic, you can pay with any card here: https://zerogex.io/pay?i=in_1ULTYb4AOiqteMYYLVF6mdhm&t=Nzucv5cul2zeoJn0yyYrNbNWcjUpLmmr0_ChziO4UWQ

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, or ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

And if something didn't work the way you expected, I'd like to hear about it. One line is plenty.

Best,
Michael
Founder, ZeroGEX

---

## 3. fahdadrees2@gmail.com (send Saturday)

**Trial conversion declined** Fri Oct 2 · Pro, **$59, no discount** · Visa ····4629 ·
access through **Mon Oct 5, 9:22 AM ET**

### The read

Engaged. They signed up from chatgpt.com on August 29 and started on Basic. They
upgraded themselves to Pro during the trial. On September 7 you extended the
trial by hand from September 9 to October 2, two seconds after you did the same
for alexandre. That was most likely the 30-day trial the August product-update
email promised, not a reply to an email from them, so a new email is fine. They
were on the site 16 minutes after today's decline, so they have seen the
automated email.

The reason is insufficient funds on a card, so naming it is fine. The automated
email already did. They pay full price (alexandre is the only other one who
does), so a cheaper plan is a real offer. Basic is $39 against $59, about a third less. The draft
says "about a third" rather than a dollar figure, because they may be billed in
a local currency.

No API key on the account. Every event since they reached Pro is in the audit
list, and none of them is a key.

### ⚠ Verify first

- Re-check before sending. If Stripe's second try cleared overnight, send
  nothing.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated email.

Your trial ended yesterday, and your bank declined the first Pro payment for insufficient funds.

Your Pro access stays on until Monday, October 5. You can pay with any card here: https://zerogex.io/pay?i=in_1UM5U14AOiqteMYYSbbRgMEo&t=euF2b4BgRh8FpkntiFhk1xz0TKXpWMGnec-LLRJaqWA

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If Pro is more than you want to spend right now, Basic costs about a third less. Reply and I'll cancel this charge so you can start on Basic instead.

And if now isn't the right time at all, that's fine too. Reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 4. lybydallh053@gmail.com (Saturday, only if still unpaid)

**Renewal declined** Fri Oct 2 · Pro, $29 a month ($30 off for 6 months) ·
Mastercard ····9311 · access through **Mon Oct 5, 12:42 AM ET**

### The read

Every charge on this subscription has failed on the first try for insufficient
funds, then cleared on a retry:

| Invoice | First decline | Cleared |
|---|---|---|
| August | Aug 2 | Aug 3, on attempt 3 (~35 h) |
| September | Sep 2 | Sep 2, on attempt 2 (19 h) |
| October | Oct 2 | not yet |

So the most likely outcome is that it clears by itself this weekend. Don't
email until you know it hasn't.

**If it hasn't cleared by Saturday afternoon, there is one real reason to
write: API keys.** They created two keys in August. Their last web login was
August 27, but `last_seen_at` only tracks browser sessions, so an API user looks
idle there. If access drops, every key is revoked
(`revokeApiKeysIfTierDropped`). When the payment later clears, Pro comes back
but the keys do not, so anything they built stops working until they make a new
key. The automated grace warning does not mention keys. This note does.

The draft does not repeat "insufficient funds." The automated email already
said it, and saying it a third month running is unkind.

### Draft

**Subject:** Your ZeroGEX payment, and your API keys

Hi,

A quick note from me, not the automated email.

Your October Pro payment was declined yesterday, and Stripe's retries haven't cleared it yet. The same thing happened the last two months, and both times a retry went through a day or so later, so this may well sort itself out.

The reason I'm writing: your Pro access stays on until early Monday, October 5. If nothing has gone through by then, the account moves to the free Public tier, and that also switches off your API keys. Pro comes back on its own once the payment succeeds, but you'd need to create a new API key and put it into anything that uses the old one.

To avoid that, you can pay with any card here: https://zerogex.io/pay?i=in_1ULxMT4AOiqteMYYLLU47Ah9&t=xTclN3_Na9s62sLQq4VXNHtww8A_rn6Lgu0ZlKNhG14

Or, if the funds will be in that account before Monday, the next automatic retry should take care of it.

Best,
Michael
Founder, ZeroGEX

---

## 5. alexandre@venturacap.com.br (send Saturday)

**Trial conversion declined** Fri Oct 2 · Pro, **$59, no discount** · Link, no
card visible · access through **Mon Oct 5, 10:39 AM ET**

### The read

Fahd's case again, on Link instead of a card. They signed up August 4 and
abandoned checkout that day. Your August 25 reactivation email promised them a
30-day trial, but the September 2 checkout gave them only 7 days, so on
September 7 you extended it to October 2. They used the trial and were in the
app Thursday, the day before it ended. They are in Brazil (a `.com.br` address
and Brazilian IP addresses).

The decline is `partner_insufficient_funds`: insufficient funds at Link's
funding source. As with Illian, the note names that reason. It names no card,
because Link hides the one behind it. It gives no amount, since a Brazilian
customer may be billed in reais. Like Fahd, they pay full price, so Basic is a
real offer.

No API key on the account.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi Alexandre,

A quick note from me, not the automated email.

Your trial ended yesterday, and Link declined the first Pro payment for insufficient funds.

Your Pro access stays on until Monday, October 5. You can pay with any card here: https://zerogex.io/pay?i=in_1UM6fG4AOiqteMYYLTgWQEVa&t=BXP3o6O37ZvmdcmZcwOplomh3wR96PUcJQz1FTicGAQ

Or, once the account you use with Link has the funds, Stripe's next automatic retry should go through on its own.

If Pro is more than you want to spend right now, Basic costs about a third less. Reply and I'll cancel this charge so you can start on Basic instead.

And if now isn't the right time at all, that's fine too. Reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 6. maxii1231811@gmail.com (Saturday, before 8 PM ET)

**Trial conversion declined** Fri Oct 2 · Basic, $29 a month promo · Visa ····1340 ·
access through **Sun Oct 4, 8:40 PM ET**

### The read

Kenmaster's case. They signed up September 25, came back once on the 27th, and
have not been back since. They have paid nothing. Insufficient funds on a card,
so the note names the reason. Basic is already the cheapest plan and they
already have the promo, so there is nothing cheaper to offer. The point of the
note is the clean way out, so a retry two weeks from now doesn't charge someone
who had stopped using it. No amount, since they may be billed in a local
currency.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated email.

Your ZeroGEX trial ended yesterday, and your bank declined the first Basic payment for insufficient funds.

Your access stays on through Sunday. If you'd like to keep Basic, you can pay with any card here: https://zerogex.io/pay?i=in_1UMG3I4AOiqteMYYUzOBWi8z&t=BiOTFT1EFHDTQmpBlocNyq6MBYifHb0Qw49gQ7lGBWk

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, or ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

And if something didn't work the way you expected, I'd like to hear about it. One line is plenty.

Best,
Michael
Founder, ZeroGEX

---

## 7. trujillolamas@gmail.com (Saturday)

**Renewal declined** Fri Oct 2 · Pro, $59 a month, no discount · Link, no card
visible · access through **Mon Oct 5, 10:32 PM ET**

### The read

The most valuable member in this batch. They have paid since June, four
invoices, $167.19 in all, and every one cleared on the first try. They were in
the app on Friday. Their sign-ins come from Mexico.

This is ksquare's case: Link, no usable decline reason, attempt 1. So the note
names no reason and no card, and offers the `/pay` link. It adds one true,
reassuring fact: nothing has failed before. No cheaper-plan offer, because
nothing says money is the problem, and suggesting it would read as a guess.

### ⚠ Verify first

- **API key:** the audit list only reaches back to June 30, and they have been
  on Pro since June 3, so a key made in June would not show. If their account
  has one, add the API-key paragraph from lyby's draft. If it drops, the key is
  revoked.
- Their charge went from $39 (June and August; July was $30.19) to $59 in
  September, and nothing in the visible audit events says why. Not for the email, but know it if they
  reply about price.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated one.

Your October Pro payment didn't go through on Friday. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. You've been with ZeroGEX since June and every payment before this one went through the first time, so it may just be a one-off.

Stripe will try again automatically over the coming days. If you'd rather settle it now, you can pay with any card here: https://zerogex.io/pay?i=in_1UMHnT4AOiqteMYYTQyleku4&t=M3_QcK1SlCEgnB0Ip0b53NhrWLrsgQk2brEbPNLVuDM

Your Pro access stays on through Monday. If nothing has gone through by then, the account moves to the free Public tier. Nothing is deleted, and full access comes back automatically as soon as a payment succeeds.

If something has changed on your end, or you have a question, just reply.

Best,
Michael
Founder, ZeroGEX

---

## 8. carlos.flanigan07@gmail.com: no email

**Trial conversion declined** Fri Oct 2 · Basic, $29 a month promo · Link ·
**canceled in-app 28 minutes after the trial ended**

### The read

Their trial ended at 10:46 AM ET Friday. They canceled at 11:14 AM (reason
"other", so the cancellation alert you got at 11:22 has whatever they typed).
The charge then ran at 11:47 AM and failed for insufficient funds at Link.

This is a case the code already handles on purpose. A cancel after the trial
has expired still owes that period (`core/trialDunning.ts`). The cancellation
email they got says so: the trial had already ended, one final charge will go
through, nothing renews after it, and access lasts until November 2. So they
were told, and a founder email asking for that $29 would be chasing someone who
just said goodbye.

Leave it to Stripe. The grace-expiry warning skips anyone who has canceled, so
they get no more automated email. Access drops Monday around 11:47 AM ET. If a
retry clears later, they get Basic back until November 2, which matches what
they were told.

If they write in about the charge and you'd rather waive it, run the cancel and
void below. That ends access at once and stops every retry.

---

## If they reply

- **"Cancel it"** (kenmaster, fahd, alexandre or maxii), **or waiving carlos's
  charge**: run
  `make cancel-subscription EMAIL=<email> VOID_INVOICE=1 DRY_RUN=1`, then the
  same with `YES=1` in place of `DRY_RUN=1`. It ends access at once, voids the
  open invoice so no retry can charge them, and sends no email. Reply yourself
  to confirm they won't be charged.
- **"Basic, please"** (fahd or alexandre): cancel and void as above first, then send them
  https://zerogex.io/pricing for Basic monthly. Two things to know. There is no
  trial, because they have already had one, so Basic is charged at checkout.
  And the $10-off promo closed October 1, so it is the full $39. Void before
  they check out: an open invoice next to a new subscription is a double-pay
  trap (the Mckaiden lesson).
- **They pay:** nothing to do. Access carries on and the payment-recovered email
  goes out automatically. After a cancel and void, the `/pay` link shows "This
  invoice is closed."

## Can wait

- **ksquare:** if they pay through `/pay` with a card, Link stays the payment
  method on the subscription, so the November 1 renewal runs through Link again.
  Only worth raising if November fails too.
- **lyby:** first-try failures every month suggest the 2nd is a bad day for
  their account. Moving the billing date has no script behind it, and the
  dashboard route (a short trial period) would set off the trial emails. Don't
  offer it unless they ask.
