# Dawood (babaoption25@gmail.com) — TradingView, discount, PayPal (2026-09-15)

Cold-ish inbound reply, 2026-09-15 04:59. First exposure to GEX, not yet
registered. Three explicit questions plus one unstated objection.

> hi michael
> thanks for mail
> It is my first exposure with GAMMA GEX i dont know how useful it is. plus
> its kind expansive to start with it
> first question do you have indicator for tradingview?
> second question can you give 50% discount or promo code for first time
> third can i pay with pay pal

**Name:** the header reads `Butt Dawood`. Butt is a Punjabi/Kashmiri family
name and Dawood is the given name, so the draft opens "Hi Dawood". Worth a
glance before sending — if he signs off differently in the next reply, follow
his lead.

## The read

The three questions are the easy part. The line that actually decides this
sale is the one he did not ask as a question: *"I don't know how useful it is,
plus it's kind of expensive to start with."* Answering only the three and
leading with the discount reads as discounting a thing he is not yet convinced
works. The free indicator answers the objection better than the coupon does —
so the draft leads with it and lets the discount land second.

- **TradingView: yes, free, and already public.** The script is published
  (`docs/tradingview-indicator.md`) at
  <https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/> —
  he adds it from TradingView's own Indicators search, no download and no
  account with us. It draws Gamma Flip, Call Wall, Put Wall and Max Pain on
  SPY, SPX, QQQ, NDX, ES or NQ with optional cross-alerts.
- **State the manual-entry caveat before he finds it.** Pine Script is
  sandboxed — no script on TradingView, ours or anyone's, can open a network
  connection. So he types four numbers in each morning, and those numbers are
  on the free, ~15-minute-delayed levels pages (`/spx-gamma-levels` and the
  SPY/QQQ/NDX clones, all public per `core/auth.ts`). Saying this up front is
  also the honest framing of *why* it is free: the script is inert without
  numbers, so there is nothing to gate (`docs/integrations.md`).
- **That caveat is the answer to "expensive".** Free indicator + free levels
  = a real evaluation at zero cost, on his own charts, on the instruments he
  actually trades. It costs him nothing to find out whether the levels hold
  before any card is involved. This is the whole point of the funnel the
  integration docs describe (search → free indicator → levels page →
  dashboard trial); this reply is that funnel run by hand.
- **Mention thinkorswim/NinjaTrader/Sierra only in passing.** He asked about
  one platform. One parenthetical, not a tour.
- **Discount: the mechanism already exists — campaign code `TARGET`,
  50% off the first year.** `frontend/core/campaigns.ts` resolves
  `/register?ref=TARGET` to a Stripe coupon and checkout auto-applies it. No
  code change is needed and no one-off coupon has to be invented. **But see
  "Verify first" — the app side is wired and the Stripe side may not be.**
- **Founding is closed and must not be offered.** `FOUNDING_LOCKIN_DEADLINE_ISO`
  is 2026-07-01; that was ten weeks ago.
- **PayPal: no, and it is not a code problem.** Checkout pins no
  `payment_method_types`, so the available methods come from the Stripe
  Dashboard's payment method configuration. The blocker is upstream of us:
  Stripe offers PayPal only to accounts based in the EU (minus Hungary),
  Liechtenstein, Norway, the UK and Switzerland. A US-based account cannot
  switch it on at all. Stripe's documented US workaround is a *custom payment
  method* processed through your own PayPal account — a manual flow that does
  not fit a subscription, and not worth building for one prospect.
- **The useful half of the PayPal answer** is that a card linked to his PayPal
  account works fine at checkout, as do Apple Pay and Google Pay. He is
  probably asking "can I pay without typing a card number", not "do you
  support the PayPal brand". Answer that question too.
- **The 7-day trial is the last de-risker** and costs nothing to repeat here.

## ⚠ Verify first

1. **Is `TARGET` live in Stripe?** This is the one thing that can make the
   email wrong. `assets/business-card/README.md` flags it explicitly: the code
   grants nothing until the coupons exist and the env vars are set —

   ```
   STRIPE_CAMPAIGN_TARGET_MONTHLY = <50% off, duration: repeating, 12 months>
   STRIPE_CAMPAIGN_TARGET_ANNUAL  = <50% off, duration: once>
   ```

   `frontend/.env.example` ships both blank. If they are unset in production,
   he clicks the link, sees full price, and the reply has cost you the sale.
   Check the env on the box (or create the coupons now) **before** sending.
   If you would rather not print a reusable code in an email, the alternative
   is a one-off Stripe promotion code restricted to first-time customers.
2. **Is the public promo window open** (`PROMO_END_AT`)? If it is, the site
   already shows Basic $19 / Pro $29 monthly — roughly the same 50% — but only
   for 6 monthly invoices, where `TARGET` runs a full 12. Quoting "50% off the
   first year" while the page shows $19 is fine; quoting a *worse* number than
   the page shows is not. Glance at `/pricing` as a logged-out visitor first.
3. **Confirm the ZeroGEX Stripe account country is US.** The PayPal paragraph
   is written for a US account. If the account is actually EU/UK-based, PayPal
   *can* be enabled in the Dashboard (Settings → Payment methods, then request
   recurring — Stripe notes it can take ~5 business days), and that paragraph
   needs rewriting into a "not today, but I can look into it".

## Numbers, if `TARGET` is live

| | List | 50% off, first year |
| --- | --- | --- |
| Basic monthly | $39/mo | $19.50/mo |
| Pro monthly | $59/mo | $29.50/mo |
| Basic annual | $199/yr | $99.50 |
| Pro annual | $299/yr | $149.50 |

Both cadences are covered as long as both env vars are set; the annual coupon
is `duration: once`, which is exactly "the first year".

## Links used

- <https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/> — the published script
- <https://zerogex.io/tradingview-indicator> — the landing page, if he wants the how-to
- <https://zerogex.io/spx-gamma-levels> — free, delayed levels (SPY/QQQ/NDX clones exist)
- <https://zerogex.io/education/gamma-exposure-explained> — "first exposure to GEX" explainer
- <https://zerogex.io/register?ref=TARGET> — the 50%-off signup link
- <https://docs.stripe.com/payments/paypal> — Stripe's PayPal country list, for your own reference

## Draft

> **Subject:** Re: ZeroGEX — TradingView, pricing, and payment
>
> Hi Dawood,
>
> Thanks for writing back. Three straight answers, and one suggestion you
> did not ask for.
>
> **1. TradingView — yes, and it's free.**
>
> It's published on TradingView here:
> https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/
>
> Open the Indicators search in TradingView, type "ZeroGEX Daily Gamma
> Levels", add it. It draws the Gamma Flip, Call Wall, Put Wall and Max Pain
> as horizontal lines on SPY, SPX, QQQ, NDX, ES or NQ, and it can alert you
> when price crosses one.
>
> One caveat I'd rather you hear from me than discover on your own: you type
> the four numbers in yourself. TradingView sandboxes Pine Script, so no
> indicator on the platform — mine or anyone else's — can pull live data from
> outside. The numbers come from the free levels pages:
>
> https://zerogex.io/spx-gamma-levels  (also /spy-, /qqq-, /ndx-)
>
> No account, no card, delayed about 15 minutes. It's a 20-second job before
> the open.
>
> **2. Which is also my answer to "I don't know how useful it is."**
>
> Don't pay yet. Put the free indicator on your chart, take the levels off
> that page each morning, and watch them for a week or two on whatever you
> actually trade. Either price respects those levels often enough to be worth
> something to you, or it doesn't — and you'll know which without spending a
> dollar. I'd rather you find out that way than take a discount on something
> you're not yet convinced works.
>
> (If you also use thinkorswim, there's a free script for that too. The
> NinjaTrader 8 and Sierra Chart versions update themselves automatically —
> those need a paid plan, because they pull from the API.)
>
> **3. Discount — yes, 50% off your first year.**
>
> Sign up through this link and it applies automatically at checkout:
>
> https://zerogex.io/register?ref=TARGET
>
> That's Basic at $19.50/month instead of $39, or Pro at $29.50 instead of
> $59. Annual works out cheaper still — $99.50 for the first year on Basic,
> $149.50 on Pro.
>
> Every plan also starts with a 7-day free trial. Cancel before it ends and
> you are not charged at all.
>
> **4. PayPal — no, I'm sorry.**
>
> Billing runs through Stripe, and Stripe doesn't offer PayPal to US-based
> businesses like mine. It's their restriction, not a setting I can flip.
>
> What does work: any Visa, Mastercard or Amex, plus Apple Pay and Google
> Pay. If what you wanted was to avoid typing a card number, Apple Pay or
> Google Pay will do that. And if your card is linked to your PayPal account,
> that card works normally at checkout — it's only the PayPal button itself
> that isn't available.
>
> If GEX is new to you, this is the one I'd start with:
> https://zerogex.io/education/gamma-exposure-explained
>
> Any questions, just reply — happy to walk you through reading the levels.
>
> Michael

## If he writes back asking for PayPal again

Don't build anything for it. The honest line is that the only US route Stripe
documents is processing PayPal through a separate PayPal account as a custom
payment method, which doesn't work for a recurring subscription — so it would
mean invoicing him by hand every month, and that is worse for both of you than
a card on file. If he genuinely cannot use a card, a manual annual invoice paid
once is the only version worth considering, and only if he asks twice.
