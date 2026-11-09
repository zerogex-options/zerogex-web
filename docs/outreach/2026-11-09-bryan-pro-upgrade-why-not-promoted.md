# Bryan: staying and moving to Pro, asks why ZeroGEX isn't promoted more (2026-11-09)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Bryan B (bryanbans@gmail.com), Sun Nov 8, 7:00 PM ET, replying to
his cancellation email ("Sorry to see you go"). He has changed his mind, says
he's going to upgrade to Pro monthly, loves ZeroGEX, and asks why it isn't
promoted more.

> **Status:** discount applied Sun Nov 8 at night ET. `honor-winback-discount`
> ran clean, cleared his cancel, and ended with `Next charge (after all
> discounts): 29.25 USD.` (Basic, because he hasn't switched yet). Referral
> program confirmed on (`REFERRAL_PROGRAM_ENABLED=1`). Reply not sent yet.
> Best sent tonight, so he can switch before his trial ends at **8:54 AM ET
> Mon Nov 9**. If he misses that, nothing goes wrong. See "The read".

## His account (`make diagnose-user`, Nov 8)

| | |
|---|---|
| User id | `user_48245282f7ba3119e2b3a7c9` |
| Signed up | Mon Nov 2, Basic monthly with the 7-day trial |
| Canceled | Sun Nov 8 at 2:29 PM ET, in the app. Reason `switched_service`, comment: "Outstanding overall platform but needs open interest" |
| Trial ends | **Mon Nov 9 at 8:54 AM ET** (13:54 UTC) |
| Paid | Nothing yet (a $0 trial invoice only) |
| Payment method | Stripe Link, no card on file. A card was declined at setup on Nov 2 (`generic_decline`) before Link went through |
| Stripe | `cus_VYS45o8uZdokEr`, `sub_1UXLh24AOiqteMYYi4jXRuUZ` |
| Now | Basic monthly, trialing, cancel cleared, `winback-25pct-1yr-monthly` on. Next charge $29.25 at trial end, or $44.25 if he switches to Pro first |

## The read

- **The 25% for a year, on Pro, is the right thank-you.** $44.25 a month
  instead of $59 for 12 months, then $59. It costs you about $177 over the
  year. His cancellation email offered 25%, he didn't ask for it, and he's the
  kind of member who tells other traders.
- **He's inside the two-day Pro upgrade window right now.** A Basic monthly
  trialer who switches to Pro monthly in the last 51 hours of the trial keeps
  the rest of it free. Nothing is charged at the switch, and the first charge
  at trial end is Pro's price (`frontend/core/trialProUpgrade.ts`). The switch
  is in-app (`in_app_upgrade` in `frontend/app/api/billing/change-plan/route.ts`).
  It doesn't touch the discounts, and the webhook's reconcile never strips a
  win-back coupon (`reconcileSwitchDiscounts`, `frontend/core/planSwitch.ts`).
  The public promo is off, so nothing gets added next to it. The confirm step
  prices the trial-end charge with the coupon on, so it should show $44.25.
- **If he switches after 8:54 AM, nothing goes wrong.** He's charged $29.25 for
  Basic, then the switch goes through the Stripe portal and bills the
  difference for the rest of the month. From the next month on it's $44.25.
- **He canceled over open interest, and now says it has everything.** He
  probably found it. Open interest is already on Basic pages such as Max
  Pain, Option Contracts and Strike Profile. The draft
  shows him you read his note without guessing what he meant, and invites more.
- **The referral program answers his question and helps him.** His Account
  page has a Refer a friend panel with his own link. A friend gets a month free
  on monthly or quarterly (10% off the first year on annual), and he gets one
  free month per friend who subscribes, as a credit on his next bill. On Pro
  monthly that's $59 each, and they stack (`frontend/core/referrals.ts`).
- **Ask to quote him.** "I think ZeroGEX is an incredible tool" is a ready-made
  testimonial, and the site has none yet. First name only. Delete that line if
  you'd rather not ask.

## Commands

Done Nov 8, in `~/zerogex-web` on the server:

```bash
grep '^REFERRAL_PROGRAM_ENABLED=' frontend/.env.local   # REFERRAL_PROGRAM_ENABLED=1
make diagnose-user EMAIL=bryanbans@gmail.com
make honor-winback-discount EMAIL=bryanbans@gmail.com PERCENT=25 CREATE_COUPON=1 DRY_RUN=1
make honor-winback-discount EMAIL=bryanbans@gmail.com PERCENT=25 CREATE_COUPON=1 YES=1
```

**After he switches to Pro,** check it (read-only):

```bash
make diagnose-user EMAIL=bryanbans@gmail.com
```

Under "Stripe subscription", `Item 0 price` should say `$59.00 / month` and
`Discounts` should list `winback-25pct-1yr-monthly`. If the discount is
missing, run the two `honor-winback-discount` commands above again. The script
replaces an earlier win-back coupon rather than stacking a second one, so a
re-run is safe. The last line should then read `Next charge (after all
discounts): 44.25 USD.`

## Draft reply

Reply in the same thread.

Hi Bryan,

Thank you, that's really kind of you, and I'm glad you're staying. It means a lot to hear ZeroGEX has everything you need.

As a thank-you, I've added 25% off your subscription for the next 12 months and turned off the cancellation, so your account carries on as normal.

To move to Pro, go to the Pricing page, pick Monthly, and click Switch to Pro. If you do it before your trial ends at 8:54 AM Eastern on Monday, November 9, nothing is charged when you switch, and your first charge that morning is $44.25 for Pro instead of $59. The page shows you the amount before you confirm. If you switch later, that's fine too: Monday's charge will be $29.25 for Basic, and moving to Pro after that just adds the difference. Either way, Pro is $44.25 a month for the next 12 months.

I also saw your note about open interest when you canceled. If there's anything about it you'd still like to see in ZeroGEX, tell me. Feedback like that shapes what I build next.

To answer your question honestly: ZeroGEX is a one-man shop. I build the platform, keep the data running, and answer every email myself, and so far nearly all of my time has gone into making the product as good as I can. Sales and promotion have taken a back seat, and that's something I want to change.

If you'd like to help spread the word, your Account page has a Refer a friend panel with your own link. Anyone who signs up through it gets a month free on a monthly or quarterly plan, and every time one of them subscribes, you get a free month, credited to your next bill. The free months stack.

And one small ask: would you mind if I quoted your line about ZeroGEX being an incredible tool, with your first name only? A few words from a real member go further than anything I could write myself.

If you'd like pointers on getting the most out of Pro, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX

## Worth knowing

- **Monday's charge isn't under the money-back guarantee.** Trial conversions
  never are; the free days were his window. If he asks for a refund later, it's
  your call.
- **If Monday's charge fails,** the normal payment-failure emails take over.
  He pays through Link, and a card was declined once at signup, so it's
  possible but not likely. Nothing to do unless it happens.
- **If he says he runs a trading group or posts about trading,** the creator
  partner program fits better than refer-a-friend: 30% of what each referred
  member pays for 12 months, and 25% off the first year for his audience
  (`docs/creator-partner-outreach.md`, `make grant-partner-pro`). Nothing in
  his email suggests that, so the draft doesn't raise it.
- **If he agrees to be quoted,** save his reply. The site has no testimonials
  section yet, so there's nothing to update today. That can wait.
