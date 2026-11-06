# Corey: early member since June, canceled for another service (2026-11-06)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from him, only the cancellation alert. Thu Nov 5, 6:54 PM
ET: savage.corey@gmail.com (`user_e03e0f6addb7aa4f385baf73`), Pro monthly,
paying, signed up and subscribed Sat Jun 13, survey reason "Switched service",
nothing typed.

> **Status:** not sent. `make diagnose-user` ran on Nov 6 (below), so the draft
> is final. **Send before Fri Nov 20, 1:18 PM ET**, when his access ends. If he
> takes the $39 offer, the steps under "If he says yes" have to run before that
> time too.

## His account (`make diagnose-user`, Nov 6)

| | |
|---|---|
| Plan | **Pro monthly**, $59 list, no discount (`price_1TdDBo4AOiqteMYYQtZgAbha`) |
| Paid | $39 on Jun 20, Jul 20 and Aug 20, then $59 on Sep 20 and Oct 20. $235 in all, paid with Stripe Link |
| Founding | **No.** Never invited (`Founding eligible: no`) and never redeemed (`Founding started at: —`) |
| Canceled | Thu Nov 5, 6:54 PM ET, through the in-app cancel flow, reason `switched_service` |
| Ends | Fri Nov 20, 1:18 PM ET (cancel at period end) |
| Emails | The automatic cancel email went out the same minute (`cancellation_ack_email_sent`) |
| Stripe | `cus_UhKn8L7CqSQ8RX`, `sub_1Thw8W4AOiqteMYYxwyjqcm1` |

## The read

- **He isn't a founding member, so the email doesn't call him one.** The
  founding offer ($19 a month for Pro) was invitation-only, and he was never
  invited. He signed up two weeks after paid plans opened at the end of May
  (`956060ac`), so "since June, when ZeroGEX was just getting started" is what
  the email says instead.
- **His bill went up by $20 in September.** He signed up on the public launch
  offer: Pro at $39 for the first three months, then $59. The pricing page said
  so ("First 3 months at this rate, then $59/mo.", `58ce60d7`), so nothing was
  hidden. Still, his September renewal jumped from $39 to $59, and he canceled
  16 days after his second $59 charge. It's the only billing change on his
  account since June.
- **The 25% he turned down wouldn't have gotten him back to $39.** The in-app
  cancel flow and the automatic email both offered 25% off for a year, which is
  $44.25. So the draft offers $39 instead: the price he joined at, for as long
  as he stays. A price that ran out is what changed his bill, so this one has no
  end date. If you'd rather cap it (say, at 12 months), say so in that sentence.
  If you don't want to make the offer at all, delete the paragraph that starts
  "One more thing" and the rest still works.
- The automatic email also asked what he switched to. The draft asks again in
  different words, because that's still the answer that matters most.

## Draft

Send it as a new email from your own inbox, not as a reply to the automatic one.
If he has already replied to the automatic one, answer his reply instead.

**Subject:** Thank you, Corey

Hi Corey,

I saw that you canceled, and I wanted to write to you myself. You signed up back in June, when ZeroGEX was just getting started, and you've been with me ever since. Thank you for that.

If the new service fits the way you trade better, that's the right call, and I mean it. But I'd really like to know what you moved to, and what it does for you that ZeroGEX doesn't. A lot of what I build starts with a short email from a member, and after five months, your answer carries real weight with me. One line is plenty.

One more thing. Your price went from $39 to $59 in September, when your three-month intro rate ended. If that played any part, I'd like to put you back at $39, and keep you there for as long as you're a member. Just reply and I'll set it up before your access ends on November 20. There's nothing for you to re-enter.

Best,
Michael

## If he says yes to $39

All of this has to happen before **Fri Nov 20, 1:18 PM ET**. After that his
subscription has ended and the tool refuses.

1. **Make the coupon once**, in the Stripe Dashboard in live mode: Product
   catalog, Coupons, Create coupon. Fixed amount off, **$20.00 USD**, duration
   **Forever**, ID `early-member-39`, name "Early member rate". The name shows
   on his invoices.

2. **Preview, no writes:**

   ```bash
   make honor-winback-discount EMAIL=savage.corey@gmail.com COUPON=early-member-39 DRY_RUN=1
   ```

   The plan should show `Stripe: LIVE mode`, `Coupon to apply: 20.00 USD off,
   forever` and `cancel_at_period_end: true → false`. It also prints a WARNING
   that the coupon isn't "N% off for one year". That's expected: this isn't
   the standard win-back coupon.

3. **Apply:**

   ```bash
   make honor-winback-discount EMAIL=savage.corey@gmail.com COUPON=early-member-39 YES=1
   ```

   The last line should read `Next charge (after all discounts): 39.00 USD.`
   If it shows any other amount, don't send the confirmation below.

4. **Confirm:** `make diagnose-user EMAIL=savage.corey@gmail.com` shows
   `Cancel at period end` as `no` in both sections, and `Discounts` lists the
   coupon. Nothing emails him when the cancellation is undone, so the
   confirmation below is his only notice.

**Confirmation reply**, in his thread:

Hi Corey,

Done. I've taken off the cancellation and put you back at $39 a month. Your next renewal, on November 20, will be $39, and it stays at $39 for as long as you're a member.

Nothing changes on your end: same account, same login.

Best,
Michael

If he also told you what he switched to, add a line about it above "Best,".

## If he replies some other way

- **He names a feature or a data gap.** Check whether we already have it, and
  how big a job it is, before promising anything. If it ships before Nov 20,
  tell him: his access is still on.
- **He says the other tool is simply better.** Thank him and leave it there.
