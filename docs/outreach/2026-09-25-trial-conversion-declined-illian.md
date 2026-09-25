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
  a rescue of an engaged member. The note gives an easy way to keep Pro and
  one clear way to stop, and asks what didn't click.
- **The stop line matters most.** The subscription is still `past_due`, and
  the end-of-dunning action is *cancel*, so Stripe still has retries left. If
  one clears in a couple of weeks, someone who never used the product gets
  charged. That invites a dispute. `make cancel-subscription` with
  `VOID_INVOICE=1` is the one path that stops it. The in-app cancel button only
  shows for `active`/`trialing`, and canceling without voiding leaves the
  invoice open. So the draft says "reply and I'll cancel it" and does not send
  them to a button.
- **Say why.** Stripe states it outright: insufficient funds at the payment
  provider. Our own automated emails already name this reason for card
  declines (`declineEmailCopy.ts`, `insufficient_funds`). The Vernon note held
  back because Link hides the funding source and three Link declines had come
  in at once. But Link's decline rate at trial conversion is about half the
  rate for typed-in cards (30.2% against 58.9%, `docs/stripe-acceptance-decisions.md`),
  so Link is not failing across the board, and nothing suggests its reason is
  wrong here. The reason also tells them
  what to do: add funds and let the retry clear it, or pay with another card.
  Still no "call your bank".
- **No amount.** They pay in euros, so "$59" would not match the price they
  saw at checkout.
- **Link to `/pay`, not `/account`.** The signed `/pay` link is one click to
  Stripe's page for this invoice, with no sign-in, and it takes any card.
  `/account` means signing in again, a week after their only visit.
  `make diagnose-user` now prints the link under each open invoice as
  `pay link (for emails)`.

## Verify first

- **Re-run `make diagnose-user EMAIL=illianbenzaoui@gmail.com` right before
  sending.** If `MONEY EVER COLLECTED` has flipped to yes, a retry cleared or
  they paid. Send nothing. Otherwise copy the `pay link (for emails)` line
  under `in_1UJPWz4AOiqteMYYlUE2r5RP` into the draft.
- **Send before Monday.** The draft says access lasts "until Monday". The
  automated grace-expiry warning goes out on its own about a day before the
  window closes. Leave it on.

## Draft

*Revised 2026-09-25 at Michael's request: it now gives the reason and links
`/pay`. The first version named no reason and linked `/account`.*

**Subject:** Your ZeroGEX payment didn't go through

Hi Illian,

Your ZeroGEX trial has ended, and Link declined the first Pro payment for insufficient funds.

Your full access stays on until Monday. To keep Pro, you can pay with any card here: [pay link]

Or, once the account you use with Link has the funds, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so you aren't charged later.

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
  email goes out automatically. If they paid with a card on the invoice page,
  Link is still the subscription's payment method for the October 25 renewal.
  That can wait.
- **If you cancel, the pay link stops working.** Voiding closes the invoice, so
  `/pay` shows "This invoice is closed" with a link to the pricing page.
