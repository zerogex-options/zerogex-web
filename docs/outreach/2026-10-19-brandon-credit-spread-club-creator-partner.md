# Brandon (bbowling1212@icloud.com): Creator Partner for The Credit Spread Club (2026-10-19)

Brandon took the money-back refund on Pro last Thursday over how the charts
look, the heat maps most of all. Michael wrote back about the heat maps,
Brandon offered to share ZeroGEX with their Discord, and Michael offered the
creator program. On Mon Oct 19, 7:34 PM ET, Brandon said yes and asked for
the link to be named after the Discord: "The Credit Spread Club".

This is the setup, the reply, and what to watch later. Account facts are from
`make diagnose-user` (run 2026-10-19).

| | |
|---|---|
| User id | `user_75cb27e5cdf63ef51a1ad5c8` |
| Came from | organic/direct. Registered Tue Oct 6, email verified |
| History | Basic monthly 7-day trial from Oct 7, canceled during the trial, ended Wed Oct 14 with no charge. Bought Pro quarterly ($115, list price) that afternoon |
| Refund | Thu Oct 15, self-serve money-back: $115 back in full, Pro ended. Survey: low quality, "I don't like the way the charts look vs some of the other platforms. Especially the heat maps it needs improvement." |
| Now | `public` tier, no subscription. Last seen Mon Oct 19 |
| Stripe customer | `cus_VOXP7Wam7nq9qk` |

## Is Brandon's access free?

Yes, for 90 days. `grant-partner-pro` puts Pro on the account free for 90
days: no card, no Stripe subscription, nothing to cancel. On day 90 the daily
`partner-grant-expiry` timer drops the account to `public` unless Brandon has
subscribed. `partner_tier='creator'` stays set, so the link and the 30% keep
working after that.

Michael's offer email didn't promise free access, so the 90 days is a bonus.
To extend it later, re-run the same `YES=1` command: it moves the end date to
90 days from that day (`DAYS=<n>` for a different length).

## Setup (tonight)

No `comp-member` step: both of Brandon's subscriptions have already ended, so
no Stripe event can reset the grant.

```bash
cd ~/zerogex-web
make grant-partner-pro EMAIL=bbowling1212@icloud.com PROMO_CODE=CREDITSPREADCLUB DRY_RUN=1
make grant-partner-pro EMAIL=bbowling1212@icloud.com PROMO_CODE=CREDITSPREADCLUB YES=1
```

- **Check the dry run's last planned change:** `stripe promotion_code
  "CREDITSPREADCLUB" -> ensure exists on <coupon>`. If the coupon is
  `21OUViRs`, stop. That's the old monthly-only audience coupon, which means
  `STRIPE_COUPON_PARTNER_AUDIENCE` in `frontend/.env.local` was never moved to
  the 25%-off-first-year one, and Brandon's audience would get the old deal.
  Point it at the new coupon, `make restart` so checkout picks it up, then
  run the dry run again.
- `CREDITSPREADCLUB` drops "The" so it's easier to type. `THECREDITSPREADCLUB`
  also passes the script's rules if Michael wants the exact name.
- Case doesn't matter in the link (`?ref=` is uppercased before the lookup), so
  `?ref=CreditSpreadClub` works and reads better in a Discord post.
- The link always gives a new signup the 25%. The typed code works at Stripe
  checkout only when checkout isn't already applying another discount (a
  public promo on the monthly plans, a win-back rate), and it's the only way
  in for someone who already has an account. So the reply says to lead with
  the link.

## Reply to Brandon

Same thread. Each paragraph is one line so it pastes straight into a mail
client. "Through mid-January" holds if the grant runs this week.

```
Done, you're all set! Here's your setup for The Credit Spread Club:

Link: https://zerogex.io/register?ref=CreditSpreadClub
Code: CREDITSPREADCLUB

Anyone who joins through your link gets 25% off their first year on any plan, and you earn 30% of what they pay in their first 12 months. The link is the one to share. The code is there for anyone who'd rather type it in at checkout.

I've also put Pro on your account free for the next 90 days, through mid-January, so you can use it and show it to the club. No card needed and nothing to cancel. Your link and commissions keep working after that either way.

When you post it, please label it as an affiliate link or #ad.

I pay commissions out monthly. What's the best way to send yours?

Thanks again, Brandon. This means a lot.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

Optional: attach `../creator-partner-assets/commission-examples.png` (what a
partner earns at 25 to 500 paying members).

## Later

- **The win-back and return-intent digests may list Brandon.** The account
  still counts as a lapsed member (`subscription_lapsed=1`), and neither email
  skips creator partners. Win-back from about Sat Nov 14 (30 days after the
  refund); return-intent possibly sooner, since Brandon logged in after the
  refund. If a digest lists Brandon, hold that `YES=1` send until a fix that
  skips partners ships. Not urgent.
- **Around Sat Jan 2 (day 75):** stage 8 of `../creator-partner-outreach.md`.
  If Brandon is sending signups, extend the grant.
- **Month end:** `make partner-commissions EMAIL=bbowling1212@icloud.com` shows
  what's owed. Payouts are by hand, then mark the rows paid
  (`frontend/scripts/list-partner-commissions.mjs` has the SQL).
