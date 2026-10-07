# Payment-failure follow-ups (2026-10-07)

`make diagnose-user` came back with 27 members. Fewer of them need you than that
number suggests:

- **9 are new since the October 2 round.** Seven are trial conversions whose
  first charge failed: four for insufficient funds, two bank blocks on non-US
  cards, and one temporary error at the bank. Two are renewals, and **one of those
  (chen) is our bug, not their bank.**
- **11 are older failures Stripe is still retrying.** Failing subscriptions now
  stay `past_due` for a week or more instead of ending at day 3 (see "Can wait"),
  so the same people stay on the list round after round. That is a big part of
  why it feels never-ending.
- **7 are failed checkouts.** Five never had access (a failed card or a Stripe
  Radar block). Two (aurora, pthiep) lost access last week and failed trying to
  come back.

Of the 27, only three are renewals (chen, bazigar, ksquare). Everything else is a
first charge after a free trial.

Fahd, lyby and trujillo from the October 2 round are off the list, which usually
means their payment went through.

**11 get a note, one more is conditional, and 15 get nothing.** These are 1:1
founder emails from your own inbox, not `mailer.ts` sends. Every paragraph is a
single line so it pastes straight into a mail client.

Everything below comes from `make diagnose-user`, run 2026-10-07 around 14:15 UTC
(10:15 AM ET).

## Who, and when to send

The automated grace-expiry warning goes out from a 4-hourly timer (12:35 AM,
4:35 AM, 8:35 AM, 12:35 PM, 4:35 PM and 8:35 PM ET). A note lands best before
the warning. After it, the note would be their fourth email in three days.

| # | Member | What failed | Reason | Plan | Send |
|---|---|---|---|---|---|
| 1 | chen.k.lloyd@gmail.com | Renewal | **no card on the subscription (our bug)** | Pro, $29 promo | **Today, after the fix** |
| 2 | flamingocorp23@gmail.com | Trial conversion | bank block | Basic, $29 promo | **Today before 12:30 PM ET**, else Friday |
| 3 | adriano.kor@gmail.com | Trial conversion | insufficient funds | Basic, $29 promo | **Today before 8:30 PM ET** |
| 4 | gardeniatattoostudio@gmail.com | Trial conversion | insufficient funds | Basic, $29 promo | Today, or Thu before 12:30 PM ET |
| 5 | ogreforbusiness@gmail.com | Trial conversion | insufficient funds | Pro, **$59, no discount** | Today or Thu |
| 6 | fatkhutdinovandrey@gmail.com | Trial conversion | bank block | Pro, $59, no discount | Today or Thu |
| 7 | yeny1974@yahoo.com | Trial conversion | insufficient funds (Link) | Basic, $39, no discount | Today or Thu |
| 8 | blueskytrader74@gmail.com | Trial conversion | insufficient funds | Basic, $39, no discount | Today or Thu |
| 9 | anasounasser1@gmail.com | Trial conversion | bank block | Basic, $29 promo | Thursday |
| 10 | jacksonbroschard@gmail.com | Trial conversion | insufficient funds | Basic, $29 promo | Thursday, if still unpaid |
| 11 | bazigar88@gmail.com | Renewal | insufficient funds (Link) | Basic, $19 promo | Thursday, if still unpaid |
| — | maxii1231811@gmail.com | Trial conversion | insufficient funds | Basic, $29 promo | Only if you skipped their Oct 2 note |

Members 5 to 8 are already past their warning, so no more automated email is
coming. Any time today or tomorrow works for them.

## Before each send

Re-run `make diagnose-user EMAIL=<email>`. If the status is `active`, or the open
invoice is no longer `status=open`, the charge cleared and the payment-recovered
email has already gone out. Send nothing.

First names are read off the email address, and used only where the address
clearly gives one (Adriano, Andrey, Jackson, Yeny). If Stripe shows a different
first name, use that.

**Don't promise a cutoff date.** The 3-day grace window is not actually removing
anyone's access right now (see "Can wait"), so none of the drafts names a date
when access ends. They say the account is "still fully on," which is true.

---

## 1. chen.k.lloyd@gmail.com: fix first, then send

**Renewal failed** Tue Oct 6 · Pro, $29 a month ($30 off for 6 months) · Visa
····9012 on file but **not attached** · 3 API keys

### The read

This one is our bug. Chen's September invoice failed and was then paid on Sep 14,
after the old subscription had already ended. The orphan-payment recovery created
a new subscription for them. Until October 1 (commit `d9e58a7`, "Renew a recovered
subscription on the card that actually paid"), that recovery did not attach the
paying card to the new subscription. So on Tuesday Stripe had nothing to charge.
The diagnose output fits: no default payment method on the subscription or the
customer, and the failed invoice has no charge and no decline reason.

The automated email they got told them their payment failed. The note owns the
mistake.

They made three API keys in September. Their last web login was Sep 26, but
`last_seen_at` only tracks browser sessions, so an API user looks idle there.

### Fix it before sending

1. Attach the card. Either:
   - **Stripe Dashboard:** Customers → chen.k.lloyd@gmail.com → Payment methods →
     the "…" next to Visa ending 9012 → **Set as default**. Stripe falls back to
     the customer's default when the subscription has none.
   - **Stripe CLI:**
     `stripe subscriptions update sub_1UFdpm4AOiqteMYYxCGBxKMH --default-payment-method pm_1UAAEo4AOiqteMYY2Amt2lcf`
2. Check it: `make diagnose-user EMAIL=chen.k.lloyd@gmail.com` should now show
   Visa ····9012 on the "Sub default PM" or "Customer default PM" line.
3. Run `make scan-payment-method-drift`. It only reads, and it lists every other
   subscription with no card attached or the wrong one. Any other subscription
   recovered before October 1 may have the same hole. Anything it lists under
   **NO DEFAULT ANYWHERE** or **BROKEN** will fail its next renewal the same way,
   whatever the card behind it says.

If Stripe retries on its own once the card is attached and the charge clears,
the payment-recovered email goes out. That's fine, and the note still makes sense.

### Draft

**Subject:** Your ZeroGEX renewal: my mistake

Hi,

A quick note from me about the payment-failed email you got on Tuesday.

That one was my fault, not your bank's. When your September payment went through, a bug on my side left your subscription without a card attached, so Stripe had nothing to charge for October. I've fixed it, and future renewals will go to your Visa ending in 9012 as normal.

Nothing changes on your account in the meantime. Pro and your API keys stay on.

To settle October, you can pay here with any card: https://zerogex.io/pay?i=in_1UNZsR4AOiqteMYYfZtPAMrP&t=yhNcSGu8ddk9LiY_amlusltHOGFH918o1ZvkdA8dSBk

Or just reply "go ahead" and I'll put it through on the Visa ending in 9012.

Sorry for the confusion.

Best,
Michael
Founder, ZeroGEX

---

## 2. flamingocorp23@gmail.com (today before 12:30 PM ET, else Friday)

**Trial conversion declined** Mon Oct 5 · Basic, $29 a month promo · Visa ····0448 ·
bank block (`transaction_not_allowed`)

### The read

Active. They were in the app this morning. This is a bank block, not an empty
account, so Stripe's retries won't clear it. The automated email already told
them to call the bank or use another card. The note adds that it won't sort
itself out, plus a clean way out. Their sign-ins come from outside the US, so
the draft gives no amount. They may be billed in a local currency.

Their warning is due at 12:35 PM ET today. If you miss that, wait until Friday
rather than sending a fourth email in three days.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated emails.

Your trial ended on Monday, and your bank declined the first Basic payment.

Stripe's automatic retries won't get past this kind of bank decline, so it won't sort itself out. Two ways to fix it: pay with a different card here, or ask your bank to allow the charge from ZeroGEX and then use the same link: https://zerogex.io/pay?i=in_1UND8c4AOiqteMYYzwgDhadd&t=u_Qq3Vbi9YPTmgR74mv0tWSpMzS1A9b7PWUpQMwJc3c

Your account is still fully on in the meantime.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 3. adriano.kor@gmail.com (today before 8:30 PM ET)

**Trial conversion declined** Mon Oct 5 · Basic, $29 a month promo · Mastercard
····4550 · insufficient funds · attempt 1

### The read

Active. They were in the app at 8:30 AM ET today. They're in Brazil, so no
amount. Basic is the cheapest plan and they already have the promo, so there's
nothing cheaper to offer. Their warning is due at 8:35 PM ET today.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi Adriano,

A quick note from me, not the automated emails.

Your trial ended on Monday, and your bank declined the first Basic payment for insufficient funds.

Your account is still fully on. When you're ready, you can pay with any card here: https://zerogex.io/pay?i=in_1UNJP24AOiqteMYYsyAUXGuB&t=QskdZl5IXefHtZB8XQO3pfjf4pAhhy9Esq3tKJM2BjU

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 4. gardeniatattoostudio@gmail.com (today, or Thursday before 12:30 PM ET)

**Trial conversion declined** Tue Oct 6 · Basic, $29 a month promo · Visa ····5635 ·
insufficient funds · attempt 1

### The read

**This is the same person as tradingteorema@gmail.com,** or at least the same
household or business. It's the same card (Visa ····5635, exp 5/2028) and the same
IP address (190.141.38.28).

- tradingteorema took a **Pro** trial on Sep 21. Its first charge failed for
  insufficient funds on Sep 28 and has failed four more times since. That account
  still has Pro, and its $59 invoice is still being retried.
- The next day they made this account, opened Pro checkout, then took a **Basic**
  trial on the same card instead.

That reads like someone short on money stepping down to the cheaper plan. Someone
farming free trials would have used a different card. The risk is the two open
invoices on one card. If it gets funded, Stripe could take $59 and $29 from it
within days of each other, and that's how disputes start.

**Recommended:** cancel and void tradingteorema first. They left that account on
Sep 29. It sends no email.

```
make cancel-subscription EMAIL=tradingteorema@gmail.com VOID_INVOICE=1 DRY_RUN=1
make cancel-subscription EMAIL=tradingteorema@gmail.com VOID_INVOICE=1 YES=1
```

Then send the note below to gardenia only. It doesn't mention the other account.
They were in the app this morning.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated email.

Your trial ended on Tuesday, and your bank declined the first Basic payment for insufficient funds.

Your account is still fully on. When you're ready, you can pay with any card here: https://zerogex.io/pay?i=in_1UNYNN4AOiqteMYYo9E26RTl&t=j1Pgt4RBF_njUopRi1Hl-xql5cPTpJ5mR2MmsFdVsDQ

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 5. ogreforbusiness@gmail.com (today or Thursday)

**Trial conversion declined** Sat Oct 3 · Pro, **$59, no discount** · Visa ····6130 ·
insufficient funds · API key made Sep 4

### The read

Fahd's case from October 2. They signed up Aug 3 and came back through your
Aug 24 reactivation email and its 30-day Pro trial. They used it, and were in the
app on Tuesday. Their sign-ins come from outside the US, so no amount.

They pay full price, so Basic is a real offer, at about a third less. **But Basic
has no API access**, and their API key would stop working. The draft says so,
so it doesn't come as a surprise.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated emails.

Your Pro trial ended on Saturday, and your bank declined the first Pro payment for insufficient funds.

Your account is still fully on. You can pay with any card here: https://zerogex.io/pay?i=in_1UMa1s4AOiqteMYYEeP6nQT7&t=HJFVNUlxItD9TC3etGZU-P-pbWzrNA3PUhaouB_IH5o

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If Pro is more than you want to spend right now, Basic costs about a third less. It doesn't include API access, so your API key would stop working. Reply and I'll cancel this charge so you can start on Basic instead.

And if now isn't the right time at all, that's fine too. Reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 6. fatkhutdinovandrey@gmail.com (today or Thursday)

**Trial conversion declined** Mon Sep 28 · Pro, $59, no discount · Visa ····1167 ·
bank block (`transaction_not_allowed`) · 5 attempts

### The read

Engaged. They were in the app Monday. Their sign-ins come from outside the US,
so no amount. Five attempts have failed since Sep 28, and the latest reason is a bank block, so more
retries won't help. As with flamingo, the note's one new fact is that it won't
sort itself out. No cheaper-plan offer, because nothing says price is the
problem. No API key.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi Andrey,

A quick note from me, not the automated emails.

Your Pro trial ended on September 28, and the first payment hasn't gone through. Your bank declined it, and Stripe's retries since then haven't gotten past that.

Stripe's automatic retries won't get past this kind of bank decline, so it won't sort itself out. Two ways to fix it: pay with a different card here, or ask your bank to allow the charge from ZeroGEX and then use the same link: https://zerogex.io/pay?i=in_1UKeOD4AOiqteMYYnMzTnj6z&t=jLfIMtuoMCpnJuvAW797wm4OR1DPSRIfGeimu8aCxf0

Your account is still fully on in the meantime.

If ZeroGEX isn't something you want to keep, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 7. yeny1974@yahoo.com (today or Thursday)

**Trial conversion declined** Tue Sep 29 · Basic, $39, no discount · Link ·
insufficient funds at Link's funding source · 4 attempts

### The read

They signed up Sep 22, just before the $10-off promo started, so they're on full
Basic. That's still the cheapest plan, so there's nothing cheaper to offer, and
the draft makes no price promise. They came back and signed in on Tuesday. The
sign-ins come from outside the US, so no amount. Link hides the card, so the
draft names none.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi Yeny,

A quick note from me, not the automated emails.

Your trial ended on September 29, and the first Basic payment hasn't gone through. Link declined it for insufficient funds.

Your account is still fully on. When you're ready, you can pay with any card here: https://zerogex.io/pay?i=in_1UL0qZ4AOiqteMYYnHX7y1kD&t=x-nCmDeR47yJZciMkVpMLk9rV02iVoRuReGVyaO7tw0

Or, once the account you use with Link has the funds, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 8. blueskytrader74@gmail.com (today or Thursday)

**Trial conversion declined** Tue Sep 29 · Basic, $39, no discount · Mastercard
····6079 · insufficient funds · 6 attempts

### The read

Kenmaster's case from October 2. They signed up Sep 22, came back once the next
day, and haven't been back since. They have paid nothing. Their sign-ins come
from outside the US, so no amount.

Stripe is still retrying. If a retry clears on payday, someone who used the
product for a day gets charged, and that's how disputes start. The note is the
easy way for them to say "cancel it."

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated emails.

Your ZeroGEX trial ended on September 29, and your bank declined the first Basic payment for insufficient funds. Stripe has been retrying since.

If you'd like to keep Basic, you can pay with any card here: https://zerogex.io/pay?i=in_1UKxsh4AOiqteMYYUdOdXy2s&t=uUHOU-8wtt4-L5wZcZqZ89Zsd2rzFcuGLTqVeR69EXQ

If ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

And if something didn't work the way you expected, I'd like to hear about it. One line is plenty.

Best,
Michael
Founder, ZeroGEX

---

## 9. anasounasser1@gmail.com (Thursday)

**Trial conversion declined** Wed Oct 7 · Basic, $29 a month promo · Mastercard
····2045 · bank block (`transaction_not_allowed`) · attempt 1

### The read

Flamingo's case. Their sign-ins come from outside the US, so no amount. They
were last in the app Monday. They got the automated email and the resend today, so Thursday spaces
the note out. Their warning is due Friday at 8:35 AM ET.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated emails.

Your trial ended on Wednesday, and your bank declined the first Basic payment.

Stripe's automatic retries won't get past this kind of bank decline, so it won't sort itself out. Two ways to fix it: pay with a different card here, or ask your bank to allow the charge from ZeroGEX and then use the same link: https://zerogex.io/pay?i=in_1UNsyr4AOiqteMYYyzBbG0Sd&t=wIoY8Wxg71KZk6AZdsfj59GvXuXYiQ2zVy7XRMLHLMs

Your account is still fully on in the meantime.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 10. jacksonbroschard@gmail.com (Thursday, if still unpaid)

**Trial conversion declined** Tue Oct 6, 10:57 PM ET · Basic, $29 a month promo ·
Visa ····1974 · insufficient funds · attempt 1

### The read

A US customer (Comcast sign-ins), so the amount is safe to name. They were last
in the app Monday. It's attempt 1, so give Stripe's retry a day. Their warning is
due at 12:35 AM ET Friday, so Thursday daytime is the window.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi Jackson,

A quick note from me, not the automated emails.

Your trial ended Tuesday night, and your bank declined the first $29 Basic payment for insufficient funds.

Your account is still fully on. When you're ready, you can pay with any card here: https://zerogex.io/pay?i=in_1UNk6D4AOiqteMYYkUipIbIz&t=M9bKl6QEu1LOg1fnk09BzWM7dvIwKOEeOKgikxtYiFQ

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX

---

## 11. bazigar88@gmail.com (Thursday, if still unpaid)

**Renewal declined** Wed Oct 7 · Basic, $19 a month ($20 off for 6 months) · Link ·
insufficient funds at Link's funding source · attempt 1

### The read

A paying member. Their September charge cleared on the first try, and this is
their first failure. They were in the app Tuesday, and their sign-ins come from
outside the US. Link hides the card, so the draft names none. No API key, since API
keys are Pro only. It's attempt 1 and the retries may well catch it, so wait a
day. Their warning is due Friday at 8:35 AM ET.

### Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated one.

Your October Basic payment didn't go through on Wednesday. Link declined it for insufficient funds.

Stripe will try again automatically over the coming days, so it may well go through on its own once the funds are there. If you'd rather settle it now, you can pay with any card here: https://zerogex.io/pay?i=in_1UNskT4AOiqteMYYBObL9ZcK&t=XYWLYRs6ywGn6kj7kcM1Uw1-NGayTKWl4ENWTEEbbiE

Your account is still fully on in the meantime.

If something has changed on your end, or you have a question, just reply.

Best,
Michael
Founder, ZeroGEX

---

## maxii1231811@gmail.com: only if you skipped their October 2 note

If you sent the Saturday note from the October 2 doc, send nothing more. If you
didn't, send them blueskytrader's draft (section 8) with "September 29" changed
to "October 2" and this link. They're the same case: one return visit, nothing
since Sep 27, insufficient funds, still being retried.

https://zerogex.io/pay?i=in_1UMG3I4AOiqteMYYUzOBWi8z&t=BiOTFT1EFHDTQmpBlocNyq6MBYifHb0Qw49gQ7lGBWk

---

## No email (15)

- **tradingteorema@gmail.com:** cancel and void instead (section 4).
- **sacfelipeferreira@gmail.com:** three automated emails in two days, the
  warning among them this morning. The reason is `try_again_later`, a temporary
  error at the bank, and Stripe hasn't retried yet. If it's still failing next
  round, it'll be on the list then.
- **alexandre@venturacap.com.br, ksquareinc@protonmail.com,
  kenmaster030684@gmail.com:** you wrote to all three on October 2, and all
  three are still failing. A second unanswered note reads as pressure.
  Kenmaster's card now comes back as invalid, so no later retry can charge them.
- **carlos.flanigan07@gmail.com, d.shehan2014@gmail.com:** both canceled after
  the trial had ended. The cancellation email told them the one charge still
  applies (the carlos reasoning from October 2).
- **akramkanhna@gmail.com:** no visits since Sep 22. Stripe Radar is now
  blocking the retries, so the retries won't charge them. Nothing to do.
- **249f9b0c5f@emailnox.live, hussainibell.o35.3.3@gmail.com,
  jacfx1404@gmail.com:** Radar blocked the checkout, so they never had access.
  249f used a throwaway email domain and an expired card that failed repeatedly
  first, so Radar was right about that one.
- **yusreal2027@gmail.com:** the checkout failed, they never had access, and they
  haven't been back.
- **mjojo9154@gmail.com:** deleted their own account a minute after the checkout
  failed.
- **aurorawfamily2022@hotmail.com, pthiep95@gmail.com:** see "Can wait."

---

## If they reply

- **"Cancel it":** run
  `make cancel-subscription EMAIL=<email> VOID_INVOICE=1 DRY_RUN=1`, then the
  same with `YES=1` in place of `DRY_RUN=1`. It ends access at once, voids the
  open invoice so no retry can charge them, and sends no email. Reply yourself
  to confirm they won't be charged.
- **"Basic, please"** (ogre): cancel and void as above first, then send them
  https://zerogex.io/pricing for Basic monthly. There's no trial, since they've
  already had one, and the $10-off promo closed October 1, so it's the full $39.
  Void before they check out: an open invoice next to a new subscription is a
  double-pay trap (the Mckaiden lesson).
- **Chen says "go ahead":** in the Stripe Dashboard, open invoice
  `in_1UNZsR4AOiqteMYYfZtPAMrP` and charge it to the Visa ending 9012. Do the
  card fix in section 1 first.
- **They pay:** nothing to do. The payment-recovered email goes out
  automatically.

## Can wait

- **The 3-day grace window isn't removing access anymore.** Our code only drops
  a member to Public when Stripe sends a subscription update. The two members on
  this list who failed before Sep 27 (aurora, pthiep) had their subscriptions
  ended by Stripe about 72 hours after the first failure, right as their window
  closed. For everyone who failed from Sep 28 on, Stripe is still retrying a
  week later and sends no update between tries. So the window lapses on paper
  and nothing happens: tradingteorema has kept Pro 6 days past its window, and
  akramkanhna has kept Basic 5. Meanwhile the automated grace-expiry warning
  still tells people their access ends at day 3. I can't see your Stripe
  settings from here, so check whether the retry setting was changed around
  Sep 27. Either way it costs little right now, and it can wait. The fix is
  either to enforce the cutoff or to change what the warning promises.
- **aurora and pthiep tried to come back.** Both lost access last week when the
  retries ran out. Each tried to resubscribe the next day, and that failed too
  (aurora's bank has blocked the card, and pthiep's Link payment failed again).
  They're the most motivated people on this list, but this is a win-back note,
  not a payment-failed one. Their old invoices only buy a few weeks now, and the
  promo price they tried for has closed. Worth a short note when you have time.
