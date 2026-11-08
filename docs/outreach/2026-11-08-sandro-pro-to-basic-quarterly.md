# Sandro: switch from Pro to Basic quarterly instead of a refund (2026-11-08)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Sun Nov 8, 4:38 AM, rigatosandro@yahoo.it, replying to his
welcome email. He subscribed to Pro on Sat Nov 7 at 7:47 AM EST, so his
money-back window runs until **Sat Nov 14, 7:47 AM EST** (the date his welcome
email gives). He asks:

1. What's the difference between Basic and Pro?
2. Pro is more than he needs. Can he switch to Basic?
3. Instead of you refunding him, can he move to Basic quarterly?

> **Status:** not sent. I couldn't see his account from here (no access to the
> server or Stripe). The draft works whichever Pro billing period he's on. If
> you want to check first, run `make diagnose-user EMAIL=rigatosandro@yahoo.it`:
> the Plan line should say Pro monthly.

## The read

- **Say yes. It also beats the refund he's offering to skip.** Basic quarterly
  is $75 paid up front for three months. The alternative he raises is canceling
  Pro and taking a refund. He also comes out ahead: about $25 a month instead
  of $59.
- **He can do it himself in a couple of minutes.** Account page, Manage
  Subscription, then Update plan in the Stripe portal: Basic, quarterly. The
  pricing page's "Switch to Basic" button opens the same portal, because
  `decidePlanSwitch` (`frontend/core/planSwitch.ts`) sends every tier change on
  a paid plan there.
- **What the portal should charge him.** Basic and Pro are separate Stripe
  products (`frontend/scripts/setup-pricing.mts`). Stripe only holds a
  downgrade until period end when both prices belong to the same product
  ([Stripe docs](https://docs.stripe.com/customer-management/configure-portal):
  "You can only downgrade at the end of a billing period between prices that
  have the same product."). His switch doesn't meet your portal's downgrade
  rules either: $59 to $75 is a bigger amount, and monthly to quarterly is a
  longer period (`frontend/scripts/setup-billing-portal.mts`). So it should
  happen right away. A new three-month period starts that day, billed $75 less
  a credit for his unused Pro time. On Pro monthly at $59, switching in the next
  day or two comes to **roughly $20 today**, then $75 every three months from
  the switch date. The portal shows him the exact amount before he confirms, so
  nothing surprises him even if I've read Stripe wrong.
- **His guarantee survives the switch.** It belongs to the subscription (the
  `money_back=1` stamp), and a switch in the portal keeps the same subscription.
  Inside the window, a refund covers every payment on it, the switch charge
  included (`decideMoneyBack`, `frontend/core/moneyBackGuarantee.ts`). The draft
  tells him, because that makes switching risk-free for him. If you'd rather not
  bring the refund up again, delete the paragraph that starts "Your money-back
  guarantee".
- **"The 30-minute Professional plan" doesn't match anything on the site.** It's
  most likely a translation slip for the 30-day (monthly) plan. The draft doesn't
  guess what he meant. It says both plans use the same real-time data, which
  also covers him if he thought Pro had faster data.
- He's Italian (Yahoo Italia, Italian mail client) but wrote in English, so the
  draft is in English, in short, plain sentences that machine-translate cleanly.
  It gives the Italian label for the Account page button, which the site has
  (`frontend/app/account/page.i18n.ts`).

## Draft

Reply in his thread.

Hi Sandro,

Thank you for writing. Yes, you can switch to Basic quarterly. You don't need to cancel, and you don't need a refund.

Both plans use the same real-time data. Basic includes the gamma flip, call and put walls, and max pain for SPX, SPY, QQQ, NDX, ES, and NQ. It also includes the Main Dashboard, the live Gamma Terminal, every Metrics page (options flow included), the six Basic Signals, Strategy Builder, and Live Options Quotes.

Pro adds:

- Trade Bias and the Composite Score
- The eight Advanced Signals, such as Squeeze Setup, Trap Detection, and EOD Pressure
- API access, plus the auto-updating NinjaTrader and Sierra Chart indicators
- TradeWorkz (beta): bot trading, backtesting, and pattern insights

If you don't use those, you won't miss anything on Basic.

Basic quarterly is $75 every 3 months, about $25 a month. To switch:

1. Sign in and open your Account page: https://zerogex.io/account
2. Click Manage Subscription (in Italian: Gestisci abbonamento).
3. In the billing portal, click Update plan, choose Basic with quarterly billing, and confirm.

Basic starts as soon as you confirm. You pay $75 for the first quarter, minus a credit for the Pro time you haven't used. The portal shows the exact amount before you confirm.

Your money-back guarantee also stays in place until November 14 at 7:47 AM EST. If Basic isn't right for you either, you can still get a full refund from your Account page before then.

If anything looks wrong, just reply to this email and I'll fix it.

Best,
Michael

## If he replies

- **The portal says Basic starts December 7, not today.** That's fine too. He
  keeps Pro until then and pays $75 for Basic on December 7. Still no refund.
  Tell him that's expected.
- **He'd rather pay monthly.** Basic monthly is $39. The steps are the same, but
  he picks monthly. The unused Pro time is credited on his next bill instead of
  today's.
- **He asks you to make the switch for him.** In the Stripe Dashboard, open his
  subscription, choose Update subscription, and change the price to Basic
  quarterly with proration on. The webhook moves his access to Basic.
- **He wants the refund after all.** He can request it on his Account page
  until Nov 14, 7:47 AM EST. Or run `make money-back-refund
  EMAIL=rigatosandro@yahoo.it`, which is a dry run, then the same command with
  `YES=1`. That uses up his one refund, so any plan he buys later has no
  guarantee.

## Worth knowing (can wait)

The Pricing page's refund policy and `frontend/content/help/platform/billing.md`
both say a move to a lower tier takes effect at the end of the paid period. By
the Stripe rule quoted above, that only holds within one product. So a plain
Pro to Basic switch in the portal (say, Pro monthly to Basic monthly) probably
happens right away with a credit instead. I couldn't confirm it from here. Worth
a look in Stripe the next time someone moves from Pro to Basic. Not urgent.
