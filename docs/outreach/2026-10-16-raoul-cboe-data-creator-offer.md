# Raoul (sfeir.raoul@gmail.com): canceled over "no CBOE data", offered free Pro and the creator program (2026-10-16)

A Basic member canceled on Friday morning, three minutes after the open. The
survey said "Wasn't using it" and she typed "no CBOE data". Michael looked her
up, found she has an audience of some kind, and wants to offer her free Pro
and the Creator Partner program.

This is the read, one founder email from your own inbox, and the exact
commands for when she says yes. Each paragraph in the drafts is a single line
so it pastes straight into a mail client.

Everything below is from `make diagnose-user` (run 2026-10-16) unless it says
otherwise.

| | |
|---|---|
| User id | `user_e0427a3e22b238c6f1ee1303` |
| Came from | organic/direct, Google sign-up, Tue Jul 28, 3:46 AM ET |
| Plan | Basic monthly, 7-day trial, not a founder. $39 less $20 off for 6 months (coupon `d0HelzOL`) = **$19** |
| Paid so far | $19 on Aug 4, Sep 4 and Oct 4. **$57 total** |
| Canceled | Fri Oct 16, 9:33 AM ET, in-app. Last seen 9:29 AM ET, a minute before the open |
| Access | until **Wed Nov 4, 2:48 AM ET** (`sub_1Ty5kb4AOiqteMYY4fq2oO29` is `active`, cancel at period end) |
| Visible visits | Jul 28 (sign-up), Fri Aug 7 9:46 AM ET, Mon Sep 14 10:20 AM ET, Fri Oct 16. All during the US session |
| Where | every address is Telefonica Germany (O2), home and mobile (RIPE lookup). The US open is 3:30 PM her time |
| Card | Visa ending 8103 |
| Stripe customer | `cus_Uy1m9WqAGSfVKU` |

## The read

- **She barely used it, and she told us why.** Four visible visits in 80 days.
  "Wasn't using it" plus "no CBOE data" reads as one sentence: it didn't have
  the data she trades, so it sat unused.
- **"No CBOE data" can mean two very different things.**
  - **Something we have.** SPX is in the symbol picker for every tier, built
    from the SPX options chain with SPXW 0DTE included (`core/symbols.ts`;
    `stream_manager.py` in zerogex-oa ingests the SPXW root). VIX is on the
    Main Dashboard for SPX, SPY and ES (`volatilityIndexFor`). The dashboard
    opens on SPY by default, so an infrequent visitor could miss SPX.
  - **Something we don't.** Cboe's Open-Close data (volume by customer and
    market maker, opening or closing) exists only as a research harness in
    zerogex-oa (`research/mm_attributed_gex`) with no data ever bought. No VIX
    options, no RUT, no XSP. **Don't promise any of these.**
  - The email asks which one rather than guessing.
- **No discount.** Price isn't her complaint, and she's already on $19. The
  offer is free Pro instead.
- **The creator program is kept to two sentences** and framed as optional, so
  the free Pro reads as a gift and not as the price of a promotion deal.

## Verify first

- **Is the profile you found really her?** Her sign-ins are all from German
  networks, so a profile based in Germany fits. If the name on the Stripe
  customer or card doesn't match the profile, don't send the creator paragraph.
- **Her first name.** "Raoul" is read off the email address. Use the name her
  profile shows if it's different.
- **The program terms.** The email quotes the terms in
  `creator-partner-outreach.md`: 25% off the first year for her audience, 30%
  of what each one pays for 12 months. If you've changed the audience coupon
  (`STRIPE_COUPON_PARTNER_AUDIENCE`), change the line.

## Draft

**Subject:** your note about CBOE data

```
Hi Raoul,

Thank you for the note you left when you canceled today. Most people leave nothing. I'd like to understand "no CBOE data" properly: which data were you after?

If it was SPX, it's in the symbol menu at the top of the dashboard, built from the SPX options chain with the 0DTE contracts included, and VIX sits on the dashboard next to it. If you couldn't find them, that's on me. If you meant something else from Cboe, like its open/close volume by customer and market maker, VIX options or RUT, you're right that ZeroGEX doesn't have it, and I won't promise a date. Tell me which, though: requests like yours go to the top of my list.

Either way, I'd like to give you three months of Pro, free. It adds Trade Bias, the advanced signals and backtesting to what you had, and nothing gets charged, now or when it ends.

I also saw that you have a following of your own. If ZeroGEX earns a place in your trading, there's a creator program: your followers get 25% off their first year, and you earn 30% of what they pay for their first 12 months. It's optional, and the free Pro doesn't depend on it.

Just reply "yes" and I'll switch Pro on.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

If it goes out tomorrow or later, change "today" to the day she canceled
(Friday).

## If she says yes

**Do not run `grant-partner-pro` on its own while her Basic plan is live.**
The grant only writes `tier='pro'` to her row. Her Basic subscription is still
`active` until Nov 4, so any Stripe sync recomputes her tier from the Basic
price, and when the subscription ends on Nov 4, `customer.subscription.deleted`
resets her to `public` (`markSubscriptionEnded` in `core/billingUser.ts`). The
grant would vanish 19 days into a 90-day promise.

`comp-member` exists for exactly this order: it ends the subscription now,
waits for Stripe's "ended" event to land, and only then sets Pro. So run it
first, then make her a partner:

```bash
cd ~/zerogex-web

# 1. End Basic now, refund October's $19, then set Pro (dry run first)
make comp-member EMAIL=sfeir.raoul@gmail.com REFUND=1 DRY_RUN=1
make comp-member EMAIL=sfeir.raoul@gmail.com REFUND=1 YES=1

# 2. Make her a Creator Partner: 90-day Pro clock, referral link, audience code
make grant-partner-pro EMAIL=sfeir.raoul@gmail.com PROMO_CODE=<HANDLE>25 DRY_RUN=1
make grant-partner-pro EMAIL=sfeir.raoul@gmail.com PROMO_CODE=<HANDLE>25 YES=1
```

- `REFUND=1` refunds the Oct 4 invoice. She paid $19 for a month you're now
  giving her free. The activation note below mentions it, so a Stripe refund
  receipt isn't a surprise.
- `PROMO_CODE` follows the house pattern (@PCB → PCB25): her handle plus 25.
  Leave it off and the script derives one from her email. If she's on X, add
  `X_HANDLE=<handle>` (no @).
- Pro lasts the program's 90 days (to about Jan 14, 2027 if run today), then the
  `partner-grant-expiry` timer drops her to free unless she subscribes. For
  longer, add `DAYS=<n>` to step 2 and change "three months" in both notes.
  Step 2 is what brings the 90-day clock. Step 1 alone would be Pro with no
  expiry, but no partner link or code.
- You may get a "Subscription ended" alert for her after step 1. That's the
  comp, not a second churn.
- **If she says yes after Nov 4,** her Basic plan has already ended on its own.
  Skip step 1 and run only step 2.

### Activation note

Fill the three brackets from step 2's output.

```
Hi Raoul,

Done: Pro is on, free until [EXPIRY DATE]. Nothing will be charged, and when it ends your account simply drops to the free tier. I've also refunded the $19 you paid on October 4, since that month is on me now.

If you'd like to share ZeroGEX, here's your setup:
Link: https://zerogex.io/register?ref=[REFERRAL CODE]
Code: [PROMO CODE]

Your followers get 25% off their first year on any plan, and you earn 30% of what each one pays for their first 12 months. If you mention it, please label it as an ad or affiliate link.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

## If she replies otherwise

- **She names the Cboe data.** If it's SPX or VIX, point her to it (symbol menu,
  dashboard). If it's Open-Close, VIX options, RUT or XSP, add it to the list
  you keep of data and symbol requests, alongside Pete's and Alexandru's
  (`2026-10-06-cancels-pete-alexandru-symbol-coverage.md`). No dates.
- **She wants to keep Basic instead.** Before Nov 4, `make set-cancellation
  EMAIL=sfeir.raoul@gmail.com OFF=1 DRY_RUN=1`, then `YES=1`. It keeps her $20
  coupon, so she renews at $19 on Nov 4 through January, then $39. It sends no
  email, so tell her that in one line.
- **No reply.** Nothing to do. Her access ends Nov 4 on its own.
