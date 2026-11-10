# Kishan: a free month of Pro for his Sierra Chart testing (2026-11-10)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Kishan Hickman (kishan.hickman@gmail.com, UK, Head of Development /
CTO), replying to the automated "verified, never paid" founder note (subject
`Quick note from Michael at ZeroGEX`). He trades on Sierra Chart, all on the
sim, and wants to backtest as well as sim live. Pro feels expensive for that,
so he built his own Sierra study on the free 15-minute-delayed data. He says
"you can only pick a two hour window as it's already delayed".

> **Status:** first reply sent Nov 10; he redeemed `PROFREEMONTH` at 10:41 AM ET
> and is on Pro monthly. Coupon `G4Mgsdy9` "Pro first month free": $59.00 off
> once, ZeroGEX Pro only, 1 redemption, expires Nov 24. Second reply (the
> Sierra study, below) sent Nov 10 before the deploy, telling him to download
> tomorrow morning. **`claude/sierra-study-build-fix` must be deployed tonight**
> (reminder set for 4:30 PM ET): the study as first served doesn't build on
> current Sierra Chart.

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

## His account (`make diagnose-user`, Nov 10)

| | |
|---|---|
| User id | `user_bc478db1a5c11722af179669` |
| Signed up | Mon Nov 9, verified the same minute, organic |
| Referred by code | none, so checkout applies no discount and shows the code box |
| Stripe | no customer yet, nothing ever paid, never held a subscription |
| Trial on Pro | none. Pro monthly isn't a trial plan, and the reactivation email (the one other way to get a trial on any plan) only goes out 21 days after signup, Nov 30, after the code expires |

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
| Use customer-facing coupon codes | On, code **`PROFREEMONTH`** |
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

Since you're building on Sierra yourself, I'd like to give you a month of Pro free so you can test it properly on the sim before deciding. Go to zerogex.io/pricing, choose Pro monthly, and enter PROFREEMONTH under "Add promotion code". The total due today will show $0. Stripe will still ask for a card, but nothing is charged today. The code works until November 24.

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

## Nov 10, 10:43 AM: he subscribed and asks for the Sierra DLL

**Inbound.** "I have just subscribed for the one month trial. Is there a
sierra study that you guys have which will superceded my coded version? If so
let me know where I can download the DLL and add it in, if not ill work more
on my code to make it even better."

### His subscription (`make diagnose-user`, Nov 10)

| | |
|---|---|
| Stripe | `cus_VbU81QqteOlWB9`, `sub_1UaHAn4AOiqteMYYtEBqnNMF`, Pro monthly ($59), `active`, `money_back=1` |
| First invoice | `in_1UaHAn4AOiqteMYYOTlU5Uyk`, $0.00 paid (the coupon, now used up) |
| Next charge | $59.00 on Thu Dec 10, through Stripe Link (no card object, so the reminder names no card) |
| Admin bucket | "Converting" until Dec 10: a $0 first invoice doesn't stamp a first payment. Expected. |
| Guarantee | covers the Dec 10 charge for 7 days |

### The read

- **We have a study, but it's a `.cpp`, not a DLL.** He builds it inside
  Sierra Chart with Remote Build.
- **The study as first served did not build on current Sierra Chart.** Sierra
  removed `sc.FreeDLL` in 2969 (Oct 9). Where it did build, the levels froze
  after the first load. Both are fixed on `claude/sierra-study-build-fix` (see
  `docs/sierra-chart-indicator.md`, "Fixed 2026-11-10"). It's compiled against
  ACSIL header copies, not yet inside a real install, so he is in effect the
  first real build, and the draft asks him to send any error.
- **It doesn't replace his code for backtesting.** It draws today's live
  levels only. Past sessions are in `/api/replay/range` (per-minute bars with
  `gamma_flip`, `call_wall`, `put_wall`, `max_pain`), which needs the key in a
  header. Only `/api/v1|v2/levels` takes `?api_key=`, and ACSIL can send
  headers only on POST (`sc.MakeHTTPPOSTRequest`), so he'd pull history from
  outside Sierra.
- **He hasn't said what the two-hour window is.** The draft asks once more,
  lightly.

### Draft reply

Hi Kishan,

Great, welcome aboard.

Yes, we have one. It comes as source code (a .cpp file) rather than a ready-made DLL, and Sierra Chart builds the DLL for you.

One timing note: I'm publishing an update to it tonight so it builds on the latest Sierra Chart release, so please download it tomorrow morning rather than today. Here's the setup for when you do:

1. Get your API key: on zerogex.io, go to Account → API Access and click Generate API Key. It's only shown once, so copy it somewhere safe. You can do this one now.
2. Download the study from zerogex.io/sierra-chart-indicator. The Download button shows when you're logged in on Pro.
3. Put the .cpp in your ACS_Source folder, then go to Analysis → Build Custom Studies DLL and choose Build → Remote Build.
4. Analysis → Studies → Add Custom Study → "ZeroGEX Gamma Levels". Paste your key into ZeroGEX API Key and set Symbol to match your chart (ES, NQ, SPX, SPY, QQQ or NDX).

It draws the gamma flip, call wall, put wall, max pain and pin strike, and refreshes them every 60 seconds by default. On ES or NQ the levels land directly on the futures price, and each level is a normal subgraph, so you can use it in spreadsheet studies and alerts.

Whether it replaces yours depends on what yours does. It only shows today's live levels, so it won't help with backtesting. For that, your own code is the way to go: the API has minute-by-minute history for past sessions, including the walls, the flip and max pain. One catch for Sierra: only the levels endpoint accepts the key in the URL (?api_key=), which is all sc.MakeHTTPRequest can send. The history endpoints need the key in an X-API-Key header, so you'd pull those from outside Sierra. The docs are at https://api.zerogex.io/docs

You're one of the first people to build it on the latest Sierra Chart, so if the build or the study shows any error, send me the message and I'll fix it quickly.

And when you get a minute, I'm still curious which page gave you the two-hour window.

Best,
Michael
