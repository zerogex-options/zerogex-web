# Alexander: Pro at 25% off after his trial ended (2026-11-03)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Alexander De Jesus Contreras Arellana (acontrerasarellana@gmail.com),
replying to the Nov 2 cancellation email ("Sorry to see you go - mind sharing
why?"). He liked the trial, trades the Nasdaq, and asks whether the 25% coupon
is still available so he can sign up for Pro.

> **Status:** applied Tue Nov 3 at 12:07 AM ET (all four commands ran clean;
> the last line read `Next charge (after all discounts): 44.25 USD.`). Reply
> not sent yet. Best sent today, so it reaches him before the automatic
> trial-end reminder that goes out around midnight tonight.

## His account (`make diagnose-user`, Nov 3)

| | |
|---|---|
| User id | `user_c790e66c64e3b445bddc75f1` |
| Signed up | Mon Oct 26, Basic monthly with the 7-day trial |
| Pro interest | Opened the locked Pro screen twice. Got the Pro interest email Oct 30 and the trial reminder with the two-day Pro offer Oct 31 |
| Canceled | Mon Nov 2 at 8:36 AM ET, in the app, no reason given |
| Trial ended | Mon Nov 2 at 9:59 AM ET. Subscription deleted, now on the free tier |
| Paid | Nothing, ever (a $0 trial invoice only) |
| Card | Visa ending 8983, exp 5/2028, still attached |
| Stripe | `cus_VVqP1SkYZnY2ot`, old sub `sub_1UUpMy4AOiqteMYYBxsQXSSh` (ended) |
| Now | Pro monthly, trialing, `sub_1UXZwV4AOiqteMYYLkg0THCe`, with `winback-25pct-1yr-monthly`. Trial ends **Fri Nov 6 at 12:07 AM ET**; first charge $44.25 |

## The read

- **The 25% he means is the one-click "25% off for a full year" button in his
  cancellation email.** It discounted the subscription he had, so it stopped
  working when his trial ended, about an hour and a half after he canceled.
- **The pricing page won't give it to him.** He has had his trial, so checkout
  charges Pro's full $59 on the spot.
- **Two existing tools do it, with nothing for him to do.** `reactivate-member`
  puts him on Pro monthly on the Visa already on file, starting with a short
  free trial. `honor-winback-discount` then adds 25% off for 12 months. That is
  the same coupon his cancellation email offered (`winback-25pct-1yr-monthly`).
- **He pays $44.25 a month for 12 months, then $59.** The trial ends at 12:07
  AM ET on Fri Nov 6 and Stripe bills about an hour later. The last discounted
  charge is in October 2027.
- **Three free days, not two.** The tool won't go under two. About 48 hours
  before a trial ends, the automatic reminder emails him the exact upcoming
  charge. With three days it goes out a day after the discount is on, so it
  says $44.25. With two it could go out within hours and say $59.
- **What he gets automatically:** the "Welcome back to ZeroGEX!" email as soon
  as step 2 runs (generic, says his access is restored), and the trial-end
  reminder around midnight on Tue Nov 3, quoting $44.25 on the Visa ending 8983.

## Commands (done Nov 3)

In `~/zerogex-web` on the server, in this order.

1. Preview, no writes:

   ```bash
   make reactivate-member EMAIL=acontrerasarellana@gmail.com TIER=pro CADENCE=monthly DAYS=3 DRY_RUN=1
   ```

   Check for `Auth DB: /var/lib/zerogex/auth.db`, a `Plan` of `$59.00 / month`
   from `STRIPE_PRICE_PRO_MONTHLY (pro/monthly)`, `Card: Visa ····8983 exp
   5/2028`, and `Trial: 3 days, ending 2026-11-06T…`. `First charge` says
   $59.00 because the discount isn't on yet; step 4 changes that. The `value
   nudge` time is already in the past. That email only fires on longer trials,
   so it won't send.

2. Apply:

   ```bash
   make reactivate-member EMAIL=acontrerasarellana@gmail.com TIER=pro CADENCE=monthly DAYS=3 YES=1
   ```

   It should end with `Webhook landed: tier=pro, status=trialing, lapsed=no.`
   If it says the webhook hasn't landed, stop and run `make diagnose-user
   EMAIL=acontrerasarellana@gmail.com`. He is on a free trial, so nothing is
   charged while that gets sorted out.

3. Preview the discount, no writes:

   ```bash
   make honor-winback-discount EMAIL=acontrerasarellana@gmail.com PERCENT=25 CREATE_COUPON=1 DRY_RUN=1
   ```

   Check for `Stripe: LIVE mode`, `Status: trialing`, `Plan: pro/monthly — list
   59.00 USD`, `Current discounts: none`, and `Coupon to apply:
   winback-25pct-1yr-monthly (25% off, 12 mo)`. The preview says "would
   create" even if that coupon already exists; the real run reuses it.

4. Apply:

   ```bash
   make honor-winback-discount EMAIL=acontrerasarellana@gmail.com PERCENT=25 CREATE_COUPON=1 YES=1
   ```

   The last line should read `Next charge (after all discounts): 44.25 USD.`
   If it shows another amount, don't send the reply as written.

## Draft reply

Reply in the same thread. The trial ends at 12:07 AM ET on Friday, so the
draft says "free through Thursday" and "cancel by Thursday evening". By Friday
morning he has already been charged.

Hi Alexander,

Thank you, that's really good to hear, and I'm glad ZeroGEX has been useful for your Nasdaq trading.

The 25% link in my email only worked while your trial was running, so I've set it up for you by hand, on Pro.

Pro is already on your account, and it's free through Thursday, November 5. After that it's $44.25 a month instead of $59 for the next 12 months, on your Visa ending in 8983, and then the regular $59.

There's nothing you need to do: no checkout and no card to enter. Just log in and the Pro pages are open. If you change your mind, cancel from your Account page by Thursday evening and you won't be charged anything.

Pro adds Trade Bias and the Composite Score, all eight Advanced Signals, backtesting and pattern insights, and API access. If you chart the Nasdaq in NinjaTrader or Sierra Chart, Pro's indicators draw the levels right on your chart.

If you'd like a pointer on where to start, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX

## Worth knowing

- **The Nov 6 charge isn't under the money-back guarantee.** Trial conversions
  never are; the free days are his window to cancel. The Account page won't
  offer him a refund, so if he asks for one after the charge, it's your call.
