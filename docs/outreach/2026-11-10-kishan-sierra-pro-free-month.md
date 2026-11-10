# Kishan: a free month of Pro for his Sierra Chart testing (2026-11-10)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Kishan Hickman (kishan.hickman@gmail.com, UK, Head of Development /
CTO), replying to the automated "verified, never paid" founder note (subject
`Quick note from Michael at ZeroGEX`). He trades on Sierra Chart, all on the
sim, and wants to backtest as well as sim live. Pro feels expensive for that,
so he built his own Sierra study on the free 15-minute-delayed data. He says
"you can only pick a two hour window as it's already delayed".

> **Status:** code not created yet, reply not sent.

## The read

- **Pro already covers both of his use cases.** The Sierra Chart study
  (auto-updating, ES/NQ on the futures axis) and the API key, which his own
  study can use, plus history for backtesting.
- **The offer: one free month of Pro, through a Stripe promotion code he types
  at checkout.** He got the "verified, never paid" email, so he has an account
  but no subscription and no card on file. `reactivate-member` needs a card on
  file and `gift-month` only credits a renewal, so neither fits.
- **$59 off once, not 100% off.** Each tier is one Stripe product with all its
  billing periods. A 100%-off "once" coupon would make a whole year free if he
  picked annual. $59 off is one month on any Pro plan: $0 on monthly, $240 on
  annual.
- **The code box will show at checkout.** The public promo closed Oct 1, and
  Pro monthly has no trial (`BILLING_TRIAL_PLANS` blank means Basic monthly
  only), so his first Pro invoice is the real one the coupon applies to. The
  one exception is a referral, partner or campaign signup: checkout applies
  that discount and Stripe hides the box. Step 1 checks for this.
- **Checkout still takes his card at $0.** That's the default for a non-trial
  plan, so month two bills $59 automatically unless he cancels.
- **The guarantee follows him.** Checkout stamps Pro monthly as a guarantee
  plan, and after a free first period the 7 days run from the first real charge
  (`core/moneyBackGuarantee.ts`). In the worst case he gets the free month plus
  a refund of month two. That is by design.
- **UK currency is fine.** If Stripe shows him pounds (Adaptive Pricing), the
  session is still billed in dollars, so a USD amount-off coupon applies.
- **The "two-hour window" isn't something we could find.** Nothing in the free
  pages, the public `/chart` (5-minute bars, 180 of them), the embed or `/mcp`
  caps at two hours. The draft asks him which page his study reads. His answer
  is useful either way: a real limit we didn't know about, or a misread of
  what the free side offers.

## Steps

### 1. Check his account (on the server, in `~/zerogex-web`)

```bash
make diagnose-user EMAIL=kishan.hickman@gmail.com
```

Check for `Auth DB: /var/lib/zerogex/auth.db`, `Tier` = `public`, and
`Referred by code` = `—`. If the referral line shows a code, stop: checkout
would hide the code box. If no account is found, he signed up with another
email. Ask him for it before sending the code.

### 2. Create the code in Stripe (Live mode, not a sandbox)

Product catalog, Coupons, **+ Create coupon**:

| Field | Value |
|---|---|
| Name | `Pro first month free` (he sees this at checkout) |
| Type | Fixed amount discount, **$59.00 USD** |
| Apply to specific products | On, **Pro** only |
| Duration | **Once** |
| Use customer-facing coupon codes | On, code **`KISHANPRO`** |
| Eligible for first-time order only | On |
| Limit to a specific customer | Off (he has no Stripe customer yet) |
| Limit the number of times this code can be redeemed | **1** |
| Add an expiration date | **Tue Nov 24, 2026, 11:59 PM** ET |
| Require minimum order value | Off |

A coupon's products can't be changed after it is made, so check "Pro only"
before saving.

### 3. Send the reply below in the same thread

### 4. After he redeems it (optional, any time)

```bash
make diagnose-user EMAIL=kishan.hickman@gmail.com
```

Expect `Tier` = `pro` and the subscription `active`, with the next charge about
a month out.

## Draft reply

Hi Kishan,

Thanks for taking the time to explain, and nice work building a Sierra study on the free data. Very few people take it that far.

You're right that the free data won't work for live testing. It's kept 15 minutes behind on purpose, because that delay is what separates free from paid.

On the two-hour window: I'm not sure which part of the free site you mean, and I'd like to understand it. Which page or link is your study reading from? If something on our side is limiting it, I want to know.

Since you're building on Sierra yourself, I'd like to give you a month of Pro free so you can test it properly on the sim before deciding. Go to zerogex.io/pricing, choose Pro monthly, and enter KISHANPRO under "Add promotion code". The total due today will show $0. Stripe will still ask for a card, but nothing is charged today. The code works until November 24.

Pro covers both things you described:

- Live sim: Pro includes our own Sierra Chart study. It draws the gamma flip, call wall, put wall, max pain and pin strike, and keeps them up to date from our API. If you trade ES or NQ, it puts the levels directly on the futures price. Setup is here: zerogex.io/sierra-chart-indicator
- Your own study: the Pro API key works with your own code too, so you can point the study you've built at the live API instead of the delayed pages.
- Backtesting: the API includes history for levels, GEX, flow and signals, so you can run past sessions through your own testing.

After the free month, Pro is $59 a month. You can cancel any time from your Account page before then and you won't be charged. If you stay, your first payment is still covered by our 7-day money-back guarantee.

All I'd ask in return is your honest feedback on the Sierra study: what's missing, what doesn't work, and what you'd change.

Best,
Michael
Founder, ZeroGEX

## Worth knowing

- **If he picks annual by mistake,** the code takes $59 off and he pays $240
  on the spot, which is covered by the guarantee. The draft says "Pro monthly"
  to avoid that.
- **If the code is rejected at checkout,** the usual cause is the referral
  case from step 1 or a code made in test mode. Check the coupon is in Live
  mode and on the Pro product.
