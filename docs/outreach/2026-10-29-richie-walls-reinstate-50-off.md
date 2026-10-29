# Richie: walls snapping back, kept on at 50% off (2026-10-29)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound, Wed Oct 28, 7:55 PM.** Richie Singh (richiesingh@gmail.com),
replying to your Oct 8 email, which offered to reinstate him at 50% off for 12
months if he changed his mind before October 29: "The walls do seem more stable
now. Happy to stay on and see how things evolve. Thanks for the offer." That's
a yes.

> **Status:** not applied, reply not sent. **Run the commands below before Thu
> Oct 29, 10:45 PM ET** (`2026-10-30T02:45:25Z`), when his subscription is set
> to end. After that, `honor-winback-discount` refuses, and bringing him back
> means a new subscription through `make reactivate-member`, which starts with a
> free trial of at least two days. Send the reply as soon as the run succeeds.

## His account (`make diagnose-user`, night of Oct 28)

| | |
|---|---|
| User id | `user_d2cf8ffc198609a2ac260125` |
| Plan | **Pro monthly**, $59 list, with the October promo `ZGX_MONTHLY_10_OFF_12M` ($10 off for 12 months), so **$49** |
| Paid | $49 once, Tue Sep 29. Amex ending 4001 |
| Canceled | Wed Oct 7, 3:15 PM ET, in-app, reason "other": "Thrice now I've seen rapid changes in put/call wall that are reversed minutes later. That looks like a glitch" |
| Ends | Thu Oct 29, 10:45 PM ET (cancel at period end) |
| Since | Made two API keys the afternoon of your Oct 8 email; last seen Wed Oct 28 |
| Stripe | `cus_VLvMmtEkAl2vwE`, `sub_1ULDWL4AOiqteMYYZQlCSb0x` |

## The read

- **He pays $24.50 a month for his next 12 bills, then $59.** The tool keeps
  his $10 promo and adds the 50% after it, and Stripe applies discounts in
  order: $59 − $10 = $49, then half of that, $24.50. That is half of what he
  pays now, and the same rate the in-app "Too expensive" save gives a promo
  member. If you meant half of the $59 list ($29.50), don't run this: the tool
  never removes another discount, so that needs a different change.
- **Both discounts end together, in October 2027.** The tool re-adds his $10
  promo as a fresh 12 months instead of keeping the one he has, which would
  have run out a month earlier. So all 12 bills are $24.50, starting with
  tonight's, and the first $59 bill is in late October 2027. That costs you $5
  against the old end date. It's a quirk of the tool; see the end.
- **Nothing tells him on its own.** Neither the tool nor the webhook emails him
  when the cancellation is undone, so the reply below is his only notice before
  tonight's charge. His API keys keep working: his access never lapses.

## Commands

In `~/zerogex-web` on the server.

1. Preview, no writes:

   ```bash
   make honor-winback-discount EMAIL=richiesingh@gmail.com PERCENT=50 CREATE_COUPON=1 DRY_RUN=1
   ```

   The plan should show `Auth DB: /var/lib/zerogex/auth.db`, `Stripe: LIVE
   mode`, `Status: active`, a `Coupon to apply` of `50% off, 12 mo`, a
   `Resulting stack` with both coupons, and `cancel_at_period_end: true →
   false`.

2. Apply:

   ```bash
   make honor-winback-discount EMAIL=richiesingh@gmail.com PERCENT=50 CREATE_COUPON=1 YES=1
   ```

   The last line should read `Next charge (after all discounts): 24.50 USD.`
   If it shows another amount, don't send the reply as written.

3. Confirm:

   ```bash
   make diagnose-user EMAIL=richiesingh@gmail.com
   ```

   `Cancel at period end` reads `no` in both the DB and Stripe sections,
   `Discounts` lists both coupons, and `Upcoming invoice` is
   `$24.50 (next charge, after all discounts)`.

## Draft reply

Reply in the same thread.

Hi Richie,

Thank you, and I'm glad the walls feel steadier. Your note is a big part of why they changed.

I've reinstated your subscription at 50% off. Your renewal tonight will be $24.50 instead of $49, on the same Amex card, and it stays at $24.50 a month for the next 12 months. After that it goes back to the regular $59.

Nothing changes on your end: same account, same API keys.

If you ever see a wall jump and snap back again, reply with the symbol and roughly the time, and I'll look into it.

Best,
Michael
Founder, ZeroGEX

Written to go out on Thu Oct 29 before 10:45 PM ET. If it goes out later,
change "Your renewal tonight will be" to "Your renewal last night was".

## Worth knowing (not urgent)

- **The tool and both in-app save offers re-add every coupon a member already
  has as a new one.** `frontend/core/subscriptionDiscounts.ts` (TRAP 2) says
  why that's wrong: a 12-month promo restarts its 12 months, and Stripe rejects
  the whole change if an older coupon can no longer be redeemed. For Richie it
  only adds the $5 above. The webhook already avoids it;
  `frontend/scripts/honor-winback-discount.mts`, `frontend/app/save/route.ts`
  and `frontend/app/api/billing/cancel-flow/route.ts` don't. It can wait.
