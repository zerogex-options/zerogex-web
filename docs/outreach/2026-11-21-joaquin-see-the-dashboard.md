# Joaquin Rodriguez: "Can I see how your dashboard looks like?" (2026-11-21)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Sat Nov 21, from joaquinr8@gmail.com, as a reply to the automatic
"Verify your ZeroGEX email" message sent at 3:47 PM that day, so he had just
registered:

> Can I see how your dashboard looks like?

Signed "Joaquin Rodriguez, JLM Group, LLC/ Triple 8 Enterprises", with a link
to a promotional-products catalog. Nothing says what he trades.

> **Status:** first reply sent as drafted (confirmed Tue Nov 24). He wrote
> back that he trades ES and asked whether the levels are converted for it.
> The second draft ("Follow-up: he trades ES", at the end) is unsent.

## The read

- **He hasn't seen the dashboard anywhere yet.** Registering lands on the
  pricing page (`app/register/RegisterClient.tsx`), which lists features but
  shows no dashboard. Signing in later lands on `/dashboard`, a Basic page, so
  a free account gets the "choose a plan" screen instead (`core/basicWall.ts`),
  with a four-card picture. He wants to see the real thing before he pays.
- **Answer with a picture, a free look, then the way in.**
  - *Picture:* there's no full-dashboard screenshot on file
    (`assets/blog/zerogex-dashboard-overview.png` is four cards,
    `docs/ad-assets/cold-1-dashboard.png` is an ad), so you take one.
  - *Free look:* the Gamma Terminal's free preview at `/chart`. SPY, about 15
    minutes delayed, no plan or sign-in needed (`app/chart/page.tsx`). It's the
    same chart that sits in the middle of the dashboard. Checked Sat Nov 21 at
    about 5 PM ET: it renders for a logged-out visitor and shows Friday's close.
- **Two ways in, and they exclude each other. Say so once.** He's a brand-new
  account that has never held a subscription, so the Black Friday sale applies
  to him (`docs/black-friday-2026-runbook.md`): Basic at $19.50 a month for 12
  payments, paid today, under the 7-day money-back guarantee. The free trial
  runs at the regular $39. Starting the trial costs him the sale: the page
  won't sell it while he holds a subscription, and after the trial he's no
  longer first-time. Either way he has seven days to back out at no cost.
- **The trial asks for a card right now.** The live pricing page renders the
  card-first wording ("Your card is collected at signup but isn't charged until
  the trial ends") and its `noCardTrial` is false, checked at the same time.
  The draft says so. If you turn the no-card trial back on before sending, use
  the swap under the draft.
- **Verification comes first.** Checkout needs a verified email. His link
  expires 24 hours after 3:47 PM, so Sunday afternoon. Signed in, the pricing
  page shows a yellow banner with a Resend button
  (`components/VerifyEmailBanner.tsx`). The draft says "if you haven't
  already", so it works whether or not he has clicked it.
- **Automatic mail will cross with yours. Nothing to do.** Still unverified two
  hours after signup, he gets "Finish setting up your ZeroGEX account".
  Verified with no checkout, he gets "Quick note from Michael at ZeroGEX",
  which pitches the trial. Neither contradicts the draft.
- **Ask what he trades.** The dashboard covers SPX, SPY, QQQ, NDX, ES and NQ.
  His answer says which pages to point him to, and whether we cover his market
  at all.

## Check first (10 seconds)

The draft offers the trial and the sale, which only fit if he hasn't started
either. Read-only:

```bash
sudo sqlite3 -readonly /var/lib/zerogex/auth.db "SELECT email, tier, created_at, email_verified_at, stripe_subscription_id, subscription_status FROM users WHERE lower(email) = 'joaquinr8@gmail.com';"
```

`tier` should read `public` and `stripe_subscription_id` should be empty. If it
has a value, he has already started a trial or bought a plan: send only the
first two paragraphs and the last one.

## Before sending: the screenshot

Open the Main Dashboard on SPX from your own account and take one screenshot of
the top of the page: the Key Levels strip and the Gamma Chart. Crop it to the
page itself (no browser bar, no admin menu) and attach it to the reply. If
you'd rather not attach one, use the no-screenshot first paragraph under the
draft.

## Draft

Reply in the same thread.

Hi Joaquin,

Thanks for signing up! I've attached a screenshot of the Main Dashboard. The key levels run across the top: the gamma flip, the call and put walls, and max pain. Below them, the Gamma Chart draws those same levels right on the price candles, and further down are the flow, volatility and signal readings.

You can also try the chart yourself right now, free and without a plan. The free version shows SPY, delayed about 15 minutes: https://zerogex.io/chart

To use the full dashboard with live data, first click the yellow "Verify email" button in the email you replied to, if you haven't already. If that link has expired, sign in and click "Resend" on the pricing page for a new one. Then there are two ways in, both at https://zerogex.io/pricing:

1. A 7-day free trial of Basic. You enter a card to start it, but nothing is charged until the trial ends, and if you cancel before then you pay nothing. After the trial, Basic is $39 a month.

2. Our Black Friday sale, through Tuesday, December 1: 50% off your first year, so Basic is $19.50 a month for your first 12 months, then $39. You pay when you sign up instead of starting with a trial, but you're covered by our 7-day money-back guarantee: if ZeroGEX isn't for you, you can get a full refund from your Account page within 7 days of paying.

One thing to know: the sale is only for members who haven't had a trial or a plan before, so if you'd like the half-price year, choose it instead of the trial.

The dashboard covers SPX, SPY, QQQ, NDX, ES and NQ. What do you trade? Tell me and I'll point you to the pages that fit best.

Best,
Michael
Founder, ZeroGEX

**No screenshot?** Replace the first paragraph with:

Thanks for signing up! The Main Dashboard puts the key levels across the top: the gamma flip, the call and put walls, and max pain. Below them, the Gamma Chart draws those same levels right on the price candles, and further down are the flow, volatility and signal readings.

**No-card trial back on?** Replace item 1 with:

1. A 7-day free trial of Basic, with no card needed. Nothing is charged: add a card before it ends to keep the plan, or let it end and pay nothing. After the trial, Basic is $39 a month.

## If he replies

- **He asks what something on the screenshot means.** "Reading the Dashboard"
  walks through every section: https://zerogex.io/help/platform/dashboard
- **He wants to see it move before paying.** GEX Replay is free with no
  sign-in: pick a symbol and a recent session and step through it minute by
  minute. https://zerogex.io/replay
- **He starts the trial, then asks for the sale price.** The page won't sell it
  mid-trial. The runbook leaves that to you, by hand (section 6).
- **He takes the trial and says it felt short.** A trial started now spans
  Thanksgiving week (closed Thursday, early close Friday). Extending is
  `make extend-trial EMAIL=joaquinr8@gmail.com EXTEND_DAYS=2 DRY_RUN=1`, then
  the same with `YES=1`.
- **He trades something we don't cover** (anything outside SPX, SPY, QQQ, NDX,
  ES, NQ, NVDA and MSFT). Say so plainly, with no dates.
- **He asks for a call or a demo.** Same answer as Mahesh (Nov 5): a
  one-person company, so no calls, but happy to answer anything by email.

## Follow-up: he trades ES (received by Tue Nov 24)

Same thread:

> Hi Michael,
>
> Sorry, I must have missed your previous email.
>
> I trade ES and am interested to know how this could help me. Do you have the
> levels converted for ES?
>
> Thanks,
> Joaquin

### The read

- **Yes, and lead with it.** ES is a first-class symbol. Its levels are the
  SPX book projected onto the ES price at fair value (cost of carry to the
  contract's expiry), on the contract carrying the volume, ESZ26 until the
  December roll. MES takes the same levels. Source: the help center's Data
  Coverage page (`content/help/platform/data-coverage.md`), which also says
  they "can sit slightly off when futures trade rich or cheap" to fair value.
- **"Converted" tells you he knows the basis.** So the draft names the method
  in one phrase (fair value, cost of carry) and stops there. An ES trader can
  reason from that. No number for the gap: we don't have a typical one.
- **The free ES page answers it on the spot.** `/es-gamma-levels`, about 15
  minutes delayed, checked Tue Nov 24 at about 3:40 PM ET: it renders, shows
  ESZ26, and says the conversion in its intro.
- **Expect "Gamma Flip Unresolved" when he clicks.** Friday's SPX page and
  today's ES page were both deep short gamma (net GEX about −$33B and −$35B)
  and published no flip. The page explains why, but the draft says it once so
  it doesn't read as broken, in close to the words JP got (Oct 12).
- **Overnight is the honest caveat for a futures trader.** We price the SPX
  options in the regular session only, so ES trades overnight against the
  4:00 PM ET levels until the 9:30 AM ET open. Careful with the wording: SPX
  options do trade overnight (Cboe's extended hours). It's our computation
  that stops, so the draft says "we compute".
- **The platform decides the plan.** NinjaTrader, Sierra Chart and Bookmap
  indicators update themselves and need Pro. TradingView and thinkorswim
  can't fetch data, so their free scripts take the numbers by hand
  (`docs/integrations.md`). Ask which he uses.
- **One line on the sale, with Pro's price.** First-time members only,
  through Tue Dec 1. Pro is $29.50 a month for 12 payments, then $59 (live
  pricing page, checked Tue Nov 24). Basic's sale price was in the first
  reply.
- **Wall study, quoted the way the site does.** 737 tests, "S&P walls held
  about two times in three within the hour"
  (`content/articles/how-often-do-gamma-walls-break.md`). It's a base rate,
  and the article says so.

### Check first (10 seconds)

Same query as before:

```bash
sudo sqlite3 -readonly /var/lib/zerogex/auth.db "SELECT email, tier, created_at, email_verified_at, stripe_subscription_id, subscription_status FROM users WHERE lower(email) = 'joaquinr8@gmail.com';"
```

If `stripe_subscription_id` has a value, he's already on a trial or a plan:
drop the last paragraph (the sale). A trial can't take the sale price from the
page.

### Draft

Reply in the same thread.

Hi Joaquin,

No problem at all, thanks for getting back to me.

Yes, ES is its own symbol on ZeroGEX. Since ES and SPX track the same index, the levels come from the SPX options and are converted to ES prices at fair value (the cost of carry to expiry), on the contract carrying the volume, which is December right now. They work on MES as is. Here are today's ES levels, free and delayed about 15 minutes: https://zerogex.io/es-gamma-levels

How it can help an ES trader comes down to two things:

1. Where price may react. The call wall and put wall are the strikes with the most call and put gamma, and they often act as resistance and support. In our study of 737 wall tests, S&P walls held about two times in three within the hour: https://zerogex.io/education/how-often-do-gamma-walls-break. You see them in ES prices before price gets there.

2. What kind of day it is. Above the gamma flip, dealer hedging tends to dampen moves, so ranges and pinning are more common. Below it, hedging tends to amplify moves, so trends can run. If the flip reads "unresolved" when you look, that's deliberate: when it sits too far from price to be tradable, we leave it blank rather than draw a misleading line.

One thing to know as a futures trader: we compute the levels from the SPX options during the regular session, so overnight they hold where they stood at the 4:00 PM ET close and update again at the 9:30 AM ET open. The ES price itself stays live through the night.

Which platform do you chart ES on? With Pro, our NinjaTrader, Sierra Chart and Bookmap indicators draw the levels on your chart and keep them current through the day. On TradingView and thinkorswim, our free script plots them, but you type in the day's numbers yourself, because those platforms can't pull in outside data. Setup for each is here: https://zerogex.io/integrations

If Pro fits, it's $29.50 a month for your first 12 months (then $59) in our Black Friday sale, which runs through Tuesday, December 1.

Best,
Michael
Founder, ZeroGEX

### If he replies

- **NinjaTrader, Sierra Chart or Bookmap.** That's Pro. Send the platform's
  page (https://zerogex.io/ninjatrader-indicator,
  https://zerogex.io/sierra-chart-indicator or
  https://zerogex.io/bookmap-indicator). On an ES chart he sets the
  indicator's Symbol to ES (`docs/ninjatrader-indicator.md`, "ES and NQ").
  If he'd rather pay once, Pro annual is $149.50 for the first year in the
  sale.
- **SabrTrader.** Also Pro: SabrTrader built its own ZeroGEX connector, so
  he pastes his Pro API key under Connections → Levels. Steps are on
  https://zerogex.io/integrations.
- **TradingView or thinkorswim.** Basic covers the live levels on the site,
  and the free script takes them by hand:
  https://zerogex.io/tradingview-indicator or
  https://zerogex.io/thinkorswim-indicator. Don't promise auto-updating
  there: the platforms block it.
- **Another platform** (Tradovate, TopstepX, Quantower, MotiveWave). No
  indicator for it. Say so plainly, with no dates; the website runs next to
  any platform.
- **Our ES levels differ from his own conversion or another site's.** Ours
  are the SPX book at carry. A traded-basis conversion, or levels built from
  SPY, land elsewhere, and ours can sit a little off when ES trades rich or
  cheap to fair value.
- **He started the trial and asks for the sale price.** As before: the page
  won't sell it mid-trial, so it's your call, by hand (runbook section 6).
