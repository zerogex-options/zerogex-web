# Joaquin Rodriguez: "Can I see how your dashboard looks like?" (2026-11-21)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Sat Nov 21, from joaquinr8@gmail.com, as a reply to the automatic
"Verify your ZeroGEX email" message sent at 3:47 PM that day, so he had just
registered:

> Can I see how your dashboard looks like?

Signed "Joaquin Rodriguez, JLM Group, LLC/ Triple 8 Enterprises", with a link
to a promotional-products catalog. Nothing says what he trades.

> **Status:** draft, unsent.

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
