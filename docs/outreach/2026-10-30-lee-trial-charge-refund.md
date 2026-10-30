# Lee: trial charge cleared a week after access ended, refund (2026-10-30)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound, Fri Oct 30.** Lee Patterson (leepattersonfx@gmail.com) wrote three
times this morning, all asking for the $39 back:

- 5:48 AM ET, to support@, "Refund": "This has came out of my bank andi never
  subbed to it."
- 6:41 AM ET, to support@, "Refund": "I've had a payment come from my bank to
  yourselves & im not happy with it can I request this be refunded today
  please."
- A reply to "Your ZeroGEX trial just became a full membership": "Could this
  transaction be refunded, not happy with it at all, have bills & stuff to pay I
  have cancelled my plan."

The cancel survey at 6:37 AM ET said: "This was taken from my bank card without
my permission".

> **Status:** done, Fri Oct 30. Plan canceled at 9:38 AM ET
> (`make cancel-subscription`), marketing email turned off at 9:39, full $39
> refunded in the Stripe Dashboard at 9:40 (charge
> `ch_3USZ4q4AOiqteMYY1IXBe21i`), then the reply below went out.
> `make diagnose-user` afterward: tier `public`, `refund_issued` for 3900 of
> 3900, not counted as a subscriber. If a dispute arrives, answer it with that
> refund.

## Lee's account (`make diagnose-user`, morning of Oct 30)

| | |
|---|---|
| User id | `user_4e1df266277862f678be3022` |
| Came from | organic/direct. Signed up Tue Oct 13, 4:09 AM ET: account, email check, card and trial all within one minute |
| Trial | 7 days, Basic monthly ($39). Ended Tue Oct 20, 4:10 AM ET. The 2-day reminder went out Sun Oct 18 in the dormant version (no login since signup) |
| Declines | `insufficient_funds` at conversion and on four retries. Access ended Fri Oct 23, 5:51 AM ET |
| Paid | **$39** on the sixth try, Fri Oct 30, 5:11 AM ET (9:11 AM in the UK). Visa ending 1799. Access switched back on |
| Canceled | Fri Oct 30, 6:37 AM ET, 85 minutes after the charge. Reason "Other" |
| Access | until Fri Nov 20, 3:10 AM ET (cancel at period end) |
| Where | almost certainly the UK: "bank card", "cancelled", "Kind regards", and everything Lee did happened on a UK morning |
| Stripe | `cus_VQsXPLbPI4zHnd`, `sub_1UQ0ms4AOiqteMYYwVIFuw4N`, invoice `in_1USY8W4AOiqteMYYmxKBvPVZ` |

## The read

- **Refund the full $39 today and end access now. Don't argue.** "Without my
  permission" is how a bank dispute starts. A refund costs the $39 plus about $2
  of Stripe's fee, which you don't get back. A dispute costs the $39 if you
  lose, plus Stripe's $15 dispute fee, your time on evidence, and a mark on your
  dispute rate. Lee isn't staying either way.
- **Lee did sign up.** Account, email check, card and trial all happened within
  one minute on Oct 13, and Lee logged in with Google this morning on the same
  address. "Never subbed" is wrong.
- **But it reads as confusion, not a scam.** Lee hadn't logged in since signup
  when the 2-day reminder went out, so it was the dormant version. Its subject
  line is "Before your ZeroGEX trial converts - nothing you need to do". The
  automatic charge is in the first paragraph, so the disclosure is there, but
  the subject doesn't read as a warning. Then the card was declined at
  conversion and on four retries, and access ended Oct 23. From Lee's side, it
  was over. The sixth try cleared this morning at 9:11 AM UK time. That's a
  Friday that's very likely payday, on an account that had been short for ten
  days. Lee canceled within 90 minutes. "Without my permission" here means "I
  didn't mean to pay", not a stolen card.
- **The two stories don't fit, and it doesn't matter.** Don't quote the
  reminder or the terms back. The draft corrects "never subbed" as reassurance
  ("so you know your card is safe"), which puts the facts on the record without
  a fight.
- **End access now, not Nov 20.** That matches your own refund rule (access
  ends when the refund is issued). If the plan stayed open, Lee would also count
  as a Full Subscriber in your admin until Nov 20, because that count only knows
  about money-back refunds.
- **`make money-back-refund` can't do this one.** Basic monthly isn't covered by
  the guarantee (`not_covered`), and `FORCE=1` only lifts the 7-day window and
  the one-refund limit. So refund in Stripe, then run `make cancel-subscription`,
  which sends Lee no email. Refund first, cancel second: the orphan-payment
  check treats that order as a normal close-out, so it won't flag Lee.
- **If a dispute shows up anyway** (Lee may have called the bank this morning
  too), answer it in Stripe with the refund. That's normally enough to win it.

## Commands

1. **Refund, in the Stripe Dashboard.** Open the customer (`cus_VQsXPLbPI4zHnd`,
   or search leepattersonfx@gmail.com), open the $39.00 payment from Oct 30, and
   choose Refund. Full amount, reason **Requested by customer**. Don't pick
   "Fraudulent": that tells Stripe the charge was fraud and puts Lee's card and
   email on your block list. If Stripe says the payment is disputed and won't
   refund it, Lee has already gone to the bank: stop here and don't send the
   reply as written.

The rest run in `~/zerogex-web` on the server.

2. Preview the cancel, no writes:

   ```bash
   make cancel-subscription EMAIL=leepattersonfx@gmail.com FORCE=1 DRY_RUN=1
   ```

   It should show `Auth DB: /var/lib/zerogex/auth.db`,
   `Subscription: sub_1UQ0ms4AOiqteMYYwVIFuw4N`,
   `Status: active (current period end 2026-11-20T08:10:18.000Z)`,
   `Open invoices: 0` and `Tier (DB): basic → public`. If the Auth DB line shows
   another path, stop. `FORCE=1` is needed because the plan is still active.

3. Apply:

   ```bash
   make cancel-subscription EMAIL=leepattersonfx@gmail.com FORCE=1 YES=1
   ```

   It should end with `Done. leepattersonfx@gmail.com: subscription canceled
   (now 'canceled'), tier reset to public.` Lee gets no email from this.

4. Confirm:

   ```bash
   make diagnose-user EMAIL=leepattersonfx@gmail.com
   ```

   Tier reads `public`, and the recent events include `refund_issued`
   (`Full refund on charge ...: 3900 of 3900 usd charged`) and
   `billing_subscription_canceled`.

5. Optional: stop marketing email to Lee.

   ```bash
   sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET marketing_unsubscribed_at = COALESCE(marketing_unsubscribed_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'leepattersonfx@gmail.com';"
   ```

   This is the same write the unsubscribe link makes
   (`frontend/app/unsubscribe/route.ts`). It keeps Lee out of product updates
   and return-intent emails. It does **not** stop the win-back email; see below.

## Draft reply

Reply once, to Lee's latest email. It covers all three. Send it after step 3.

Hi Lee,

I've refunded the full $39 today and closed your subscription, so nothing more will be charged.

So you know your card is safe: the charge came from the 7-day free trial on your ZeroGEX account, started on October 13 with this email address. When the trial ended on October 20, it moved to the monthly plan. Your card was declined at the time, the payment was retried automatically, and it went through this morning, which is why it came out of the blue. I'm sorry for the surprise.

Refunds usually show on your statement within 5 to 10 business days, depending on your bank. The charge was in US dollars, so the amount back may differ slightly from what left your account because of the exchange rate.

There's nothing else you need to do.

Best,
Michael
Founder, ZeroGEX

## Worth knowing (not urgent)

- **The win-back email ignores the unsubscribe flag.**
  `frontend/scripts/send-winback.mts` never checks `marketing_unsubscribed_at`,
  and the email's only opt-out is deleting your account. Product updates,
  return-intent, reactivation and plan offers all check it. Lee enters the
  win-back window around Nov 29, 30 days after
  the cancel. The timer only sends you the review digest, so nothing goes out
  before you approve a batch. It can wait until then. Queued as a separate
  task.
- **Lee got two emails two seconds apart about the same $39:** "You're all set -
  your ZeroGEX payment went through" and "Your ZeroGEX trial just became a full
  membership". The webhook holds the second one back after an orphan recovery,
  but not when a declined trial conversion finally clears. Worth deciding
  whether that case needs both.
- **Late recoveries on dormant trials.** This charge cleared a week after
  access ended, on a trial that got the dormant reminder. If more "I never
  subscribed" emails follow late recoveries like this one, that's the pattern to
  look at. One case isn't a pattern yet.
- **Refunds are logged without their invoice, so partner commissions never
  reverse.** Lee's refund was logged as `Full refund on charge
  ch_3USZ4q4AOiqteMYY1IXBe21i: 3900 of 3900 usd charged (no invoice — one-off
  charge)`, though that charge paid invoice `in_1USY8W4AOiqteMYYmxKBvPVZ`. The
  `charge.refunded` handler in `frontend/app/api/webhooks/stripe/route.ts`
  reads `charge.invoice` off the event. Events arrive in the webhook endpoint's
  API version, and Stripe removed that field there (basil; see the header of
  `frontend/core/stripeInvoice.ts`). For Lee it's only a wrong label, since
  there's no referrer. For a creator partner's referral, the commission on a
  refunded invoice stays `accrued`, money-back refunds included. Queued as a
  separate task.
