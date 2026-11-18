# Black Friday 2026 sale: operator runbook

*Half off the first year of any plan, for first-time members who pay today. From 12:00 AM ET Thursday, November 19 through Tuesday, December 1. It opens and closes by itself once configured.*

The plan was to open on Black Friday, November 27. It opens early, at midnight on November 19, after a customer asked about it on the 18th.

## 1. The offer

| Plan | Regular | Black Friday, first year |
|---|---|---|
| Basic monthly | $39/mo | $19.50/mo for 12 payments |
| Basic quarterly | $75 every 3 months | $37.50 for 4 payments |
| Basic annual | $199/yr | $99.50 for the first year |
| Pro monthly | $59/mo | $29.50/mo for 12 payments |
| Pro quarterly | $115 every 3 months | $57.50 for 4 payments |
| Pro annual | $299/yr | $149.50 for the first year |

- **Pay today, no free trial.** Every plan except Basic monthly is paid up front anyway. On Basic monthly the card offers the choice: the sale price charged today ("Get Basic at 50% off"), or the regular 7-day free trial at $39 ("Prefer to try it free first?").
- **First-time members only**: an account that has never held a subscription, the same rule as the free trial. Current and returning members don't see it, and checkout refuses it for them. This is what stops current members canceling to come back at half price.
- **Covered by the 7-day money-back guarantee**, Basic monthly included, because every plan sold paid-up-front carries it. One refund per customer, as always.
- **Never stacks.** At checkout it replaces a referral, partner or business-card discount. Partner commission still accrues, on the sale price.
- **After the first 12 months** the plan renews at the regular price. Stripe drops the coupon by itself.

The rules live in `frontend/core/blackFridaySale.ts`. Stripe is the source of truth for what is charged, and `make setup-black-friday VERIFY=1` checks the coupon against what the page shows.

## 2. Turning it on (before 12:00 AM ET Thursday, November 19)

Deploy the branch first. On its own the code changes nothing: the sale needs all three env lines below. Set up ahead of the start and the sale stays hidden until midnight, then appears on its own; no restart at midnight. Set up after midnight and it is open from the restart.

```bash
make setup-black-friday              # dry run: shows the coupon it would create and the window
make setup-black-friday YES=1        # creates the coupon, prints three .env.local lines
# paste the three lines into frontend/.env.local, replacing any existing line for the same key
make restart                         # env is read at start-up; no rebuild needed
make setup-black-friday VERIFY=1     # must end "no problems" and say "Scheduled" (or "Open now" after midnight)
```

The three lines:

```
STRIPE_COUPON_BLACK_FRIDAY=ZGX_BLACK_FRIDAY_2026_50_OFF_12M
BLACK_FRIDAY_START_AT=2026-11-19T05:00:00Z
BLACK_FRIDAY_END_AT=2026-12-02T04:59:59Z
```

That is 12:00 AM ET Thursday, November 19 to 11:59:59 PM ET Tuesday, December 1. The setup script never edits `.env.local`, never changes an existing Stripe object, and never touches a customer. Re-running it reuses the coupon.

## 3. What members see, and when

- **Before it opens:** nothing changes. The pricing page and checkout are exactly what they are today.
- **During the sale**, to anyone who could buy it (logged out, or signed in and never subscribed):
  - a Black Friday banner above the plans, ending "Ends Tuesday, December 1";
  - the sale price on every card, with the regular price struck through;
  - sale prices in the "Compare billing options" table;
  - a "Black Friday sale." entry in the Refund & Cancellation Policy, stating the terms.
- **Who does not see it:** members with a subscription, returning members, and visitors from the reactivation email (their page keeps the extended trial it promised).
- **After 11:59 PM ET on December 1:** the page and checkout go back to normal on their own. Everyone who bought keeps half off for their first year.

If a page was loaded before the sale closed and the member clicks after, checkout refuses with "The Black Friday sale isn't on right now" rather than charging a price they weren't shown.

## 4. Levers

| To… | Do |
|---|---|
| Open it right away, before the start time | Blank out `BLACK_FRIDAY_START_AT=`, then `make restart` and `make setup-black-friday VERIFY=1` |
| Extend it | Set `BLACK_FRIDAY_END_AT` later (the end of a December day in New York is `T04:59:59Z` on the next date), restart, VERIFY |
| End it early | Set `BLACK_FRIDAY_END_AT` to a past time, restart |
| Change the 50% | A code change (`BLACK_FRIDAY_SALE` in `core/blackFridaySale.ts`) plus a new coupon (`COUPON_ID=...`). Ask for it; don't just make a different coupon, or checkout would charge a price the page doesn't show |

**Leave `STRIPE_COUPON_BLACK_FRIDAY` in `.env.local` after the sale.** The end date closes the offer. The coupon line is how a later plan switch recognizes a sale member, so a future public promo can't be stacked on top of their half off.

Don't run the $10 monthly promo (`PROMO_END_AT`) at the same time. VERIFY warns if both are open.

## 5. How it did

Redemptions are on the coupon's page in Stripe (Products → Coupons → `ZGX_BLACK_FRIDAY_2026_50_OFF_12M`). Every sale subscription also carries `metadata.black_friday = 1`.

Checkouts started at the sale price, and how many of those accounts now have a subscription:

```bash
sqlite3 /var/lib/zerogex/auth.db "
SELECT COUNT(DISTINCT a.user_id) AS started,
       COUNT(DISTINCT CASE WHEN u.stripe_subscription_id IS NOT NULL THEN a.user_id END) AS subscribed
  FROM audit_events a JOIN users u ON u.id = a.user_id
 WHERE a.type = 'billing_checkout_started'
   AND (a.message LIKE '% blackFriday=chosen %' OR a.message LIKE '% blackFriday=auto %');"
```

`chosen` means they clicked the sale button; `auto` means the checkout started somewhere other than the pricing page.

## 6. Worth knowing (none of this blocks the launch)

- **The cancel flow's save offers stack on top of the sale**, as they already do on any discount. A sale member who opens the cancel flow can be offered 25% off (or 50% for "too expensive") on top of half off. Nobody can reach that until they've subscribed, so this can be decided in December.
- **Plan switches keep the sale for the rest of the first 12 months**, on the new plan too, because Stripe carries the coupon. A monthly member who moves to annual in month 11 pays half for that annual payment. That's how the November ZGX40 code behaved too.
- **Someone mid-trial when the sale opens** (a Basic trial started before it) can't buy the sale from the page, because they already have a subscription. If one asks, it's your call, by hand.

## 7. Decisions on record

- **50%:** it has to beat November's 40% code, which came with a free trial. It also equals the business-card rate, so no card holder sees a better deal than the sale.
- **Guarantee on the Basic monthly sale:** every plan sold paid up front carries it, and the copy can then say "every plan" without an exception.
- **First-time only**, matching the trial and the November code.
- **Opened early**, at midnight on November 19 rather than on Black Friday, so a customer who asked on the 18th could buy without waiting a week. The end date is unchanged.
