# Trial conversion declined: Illian (2026-09-25)

A Pro monthly trial converted today and the first charge failed twice on Link.
Trial Grace is open until Monday. This is the read and a short 1:1 founder
draft, sent from your own inbox, one line per paragraph so it pastes straight
into a mail client.

Everything below is from `make diagnose-user EMAIL=illianbenzaoui@gmail.com`
(run 2026-09-25) and the Stripe dashboard view of the failed payment.

| | **illianbenzaoui@gmail.com** |
|---|---|
| User id | `user_39d613a49a9a69192928cf74` |
| Name (Stripe) | illian benzaoui |
| Plan | $59.00/mo, **Pro monthly** (`price_1TdDBo4AOiqteMYYQtZgAbha`), no discount |
| Signed up | 2026-09-18 03:06 UTC, trial started 03:09 on **Link** |
| Last seen | 2026-09-18, the signup session. **Never came back.** |
| Declined | 2026-09-25 04:11 UTC (attempt 1) and 13:11 UTC (attempt 2) |
| Decline | `insufficient_funds` [`payment_method_provider_decline` / `partner_insufficient_funds`] |
| Open invoice | `in_1UJPWz4AOiqteMYYlUE2r5RP`, $59, `open` |
| Grace | opened 2026-09-25 04:11 UTC, **closes Monday 2026-09-28 04:11 UTC** (6:11 AM in France) |
| Money ever collected | **none** |
| Currency | paid in **euros** through Adaptive Pricing; signup IP is on a French ISP |

## The read

- **They never used it.** Their only visit was the signup session: checkout,
  the disclaimer and the welcome modal, all within three minutes. So this is not
  a rescue of an engaged member. The note gives one clear way to keep Pro and
  one clear way to stop, and asks what didn't click.
- **The stop line matters most.** The subscription is still `past_due`, and
  the end-of-dunning action is *cancel*, so Stripe still has retries left. If
  one clears in a couple of weeks, someone who never used the product gets
  charged. That invites a dispute. `make cancel-subscription` with
  `VOID_INVOICE=1` is the one path that stops it. The in-app cancel button only
  shows for `active`/`trialing`, and canceling without voiding leaves the
  invoice open. So the draft says "reply and I'll cancel it" and does not send
  them to a button.
- **No reason named, no amount.** Same rule as Vernon: Link hides the funding
  source, and the insufficient-funds guidance is for us, not for them. No "call
  your bank". They pay in euros, so "$59" would not match the price they saw
  at checkout.
- **The pay path is `/account`.** Its banner tells a past-due member to open
  the billing portal and pay the open invoice with any card. The automated
  payment-failed email (04:11 UTC today) also carries a one-click `/pay`
  button, if they would rather use that.

## Verify first

- **Re-run `make diagnose-user EMAIL=illianbenzaoui@gmail.com` right before
  sending.** If `MONEY EVER COLLECTED` has flipped to yes, a retry cleared or
  they paid. Send nothing.
- **Send before Monday.** The draft says access lasts "until Monday". The
  automated grace-expiry warning goes out on its own about a day before the
  window closes. Leave it on.

## Draft

**Subject:** Your ZeroGEX payment didn't go through

Hi Illian,

Your ZeroGEX trial has ended, and the first Pro payment from your Link account didn't go through.

Your full access stays on until Monday. If you'd like to keep Pro, you can pay with any card from your account page: https://zerogex.io/account

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so you aren't charged later. Otherwise, Stripe will keep retrying the payment over the next couple of weeks.

And if ZeroGEX wasn't what you expected, I'd like to hear why. One line is plenty.

Best,
Michael
Founder, ZeroGEX

## If they reply

- **"Cancel."** Run
  `make cancel-subscription EMAIL=illianbenzaoui@gmail.com VOID_INVOICE=1 DRY_RUN=1`,
  then the same with `YES=1` in place of `DRY_RUN=1`. It ends access right away
  and sends no email, so reply yourself to confirm they won't be charged.
- **Price.** Cancel and void first (above), then point them to
  https://zerogex.io/pricing. If the page still shows the promo, signups by
  October 1 get Pro at $49 and Basic at $29 a month for the first year. Voiding
  first is the Mckaiden lesson: an open invoice next to a fresh checkout is a
  double-pay trap.
- **They pay.** Nothing to do. Access carries on, and the payment-recovered
  email goes out automatically. If they paid on the invoice page, Link is still
  the subscription's payment method for the October 25 renewal. That can wait.
