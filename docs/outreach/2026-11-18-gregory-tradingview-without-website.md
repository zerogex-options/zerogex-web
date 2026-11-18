# Gregory Ian: can the levels go straight into TradingView? (2026-11-18)

American English, and each paragraph in the reply is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Tue Nov 17, 10:53 PM, from gregians@outlook.com, as a reply to the
automated win-back email `A lot has changed at ZeroGEX - and your discount's
ready` (`sendWinbackEmail` in `frontend/core/mailer.ts`, sent Nov 3). He's a
lapsed member: that email only goes to accounts whose subscription ended about
a month earlier.

> How can i integrate to trading view that way i dont have to go to website.
> is that possible or it is all manual? any help on this will be highly
> appreciated. thank you

> **Status:** sent Wed Nov 18, in the same thread. He wrote back at 1:08 AM
> to say thanks and that he's told friends to try ZeroGEX; see "Follow-up" at
> the end. No reply needed. An optional short one, with his referral link, is
> drafted there.

## The read

- **On TradingView it's manual, and that's TradingView's rule, not ours.**
  Pine Script can't make network calls, so no indicator on TradingView can
  fetch outside data (`docs/integrations.md`, "The split is a platform
  constraint"). Our script is free and public; he types the numbers into its
  settings. Don't hint that an auto-updating version is coming: the only route
  is TradingView's Pine Seeds, and TradingView isn't accepting new ones (same
  answer as `2026-10-25-todd-ninjatrader-tradingview-updates.md`).
- **"So I don't have to go to the website" has a real answer: the free morning
  email.** It goes out every trading day between 8:30 and 9:25 AM ET with the
  flip, call wall, put wall and max pain for all six symbols, in a block
  labeled for the TradingView script (`docs/daily-levels-email.md`). Sign up
  is public, at `/gex-levels#levels-email`, and double opt-in. It's a separate
  list (`levels_subscribers`), not his account, so his lapsed account doesn't
  matter and signing up doesn't start any other email.
- **The reply says "match by name", not "same order", on purpose.** The email
  called its block the "paste order" but listed Gamma Flip first, while the
  indicator's settings list Call Wall first (`callWall` is the first
  `input.float` in `frontend/public/tradingview/zerogex-daily-gamma-levels.pine`).
  Every number in the email is labeled, so matching by name avoids typing a
  call wall into the flip field. Fixed the same night: the email now lists
  Call Wall first (`claude/paste-order-matches-indicator`, merged Wed Nov 18),
  so the advice holds either way.
- **The lines don't move during the day, so the reply says so.** The email is
  a before-the-open snapshot, and the TradingView lines stay wherever he typed
  them. He was a paying member, so he's used to levels that update.
- **Wall alerts are the paid version of what he's asking for.** Any paid plan
  (Basic and up, `core/wallAlertsDelivery.ts`). A rule is a symbol and a side,
  not a strike (`WallAlertRule` in `core/wallAlerts.ts`), so it follows the
  live wall, and email is one of its channels. SPX, SPY, QQQ and NDX only, so
  the reply names those four. That paragraph is the only pitch in the reply.
- **His discount still works with no action from you.** The subject line he
  replied to is the auto variant, so he's stamped `winback_email_sent_at`. The
  coupon is standing, not time-limited, and checkout attaches it through
  `/pricing?winback=1` while his account is still lapsed (`winbackEligible` in
  `app/api/billing/checkout/route.ts`). The reply doesn't restate the
  percentage. His own copy of the original email, quoted below his reply,
  already says it.
- **Left out: NinjaTrader, Sierra Chart, Bookmap, SabrTrader.** He asked about
  TradingView. They're in "If he replies".

## Reply (sent)

**Subject:** Re: A lot has changed at ZeroGEX - and your discount's ready

Hi Gregory,

Thanks for writing back. Short answer: on TradingView you enter the levels yourself, but you can set it up so you never have to open our website.

First, add our free indicator. On your TradingView chart, open Indicators, search for "ZeroGEX Daily Gamma Levels" and add it. Then open its settings, type in the day's Gamma Flip, Call Wall, Put Wall and Max Pain, and they appear as lines on your chart. Here it is: https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/

The reason it's manual: TradingView doesn't let any indicator pull in data from outside TradingView, ours or anyone else's. So there's no way for our levels to flow into it on their own.

To skip the website, sign up for our free morning email. Every trading day before the open, it sends that day's levels for SPX, SPY, QQQ, NDX, ES and NQ, each one labeled, so you just match the names to the indicator's settings. You sign up once, here: https://zerogex.io/gex-levels#levels-email. Click the link in the confirmation email, and the levels start the next trading morning. After that, your routine is: open the email, type four numbers into TradingView.

One thing to know: the lines stay where you put them. The levels can shift during the day, but your TradingView lines won't move unless you type in new numbers.

If you'd like something that keeps up with those moves without the website, that's what our wall alerts do, on any paid plan. Pick SPX, SPY, QQQ or NDX and a call or put wall, and we email you when price hits it, breaks through it or bounces off it. They follow the walls as they move, so there's nothing to update. You set them up once, and after that the emails come to you. The discount from my last email is still on your account if you'd like to come back: https://zerogex.io/pricing?winback=1

If anything doesn't work when you set it up, just reply here.

Best,
Michael

## If he replies

- **"Can it alert me inside TradingView?"** Yes. The script has four alert
  conditions ("Price crossed Call Wall", "Price crossed Gamma Flip", "Price
  crossed Put Wall", "Price crossed Max Pain"). In TradingView: Create Alert,
  then pick ZeroGEX Levels as the condition. TradingView alerts keep the
  numbers they were created with, so he has to set them up again each time he
  types in new levels.
- **"The morning email never came."** Nothing arrives until he clicks the
  confirmation link, and Outlook may file it under Junk. After that it starts
  the next trading morning, between 8:30 and 9:25 AM ET. If he says he did
  both, check the list:

  ```bash
  sudo sqlite3 -readonly /var/lib/zerogex/auth.db "SELECT email, confirmed_at, unsubscribed_at, last_sent_at FROM levels_subscribers WHERE lower(email) = 'gregians@outlook.com';"
  ```

  No row: the signup never went through, so ask him to try again. Empty
  `confirmed_at`: he hasn't clicked the confirmation. A filled
  `unsubscribed_at`: he opted out, and the form won't restart it.
- **"Can't you make TradingView update on its own?"** Not today, for the reason
  in the reply. Don't give a date.
- **"Is there any chart where the levels update by themselves?"** Yes, but not
  TradingView: the NinjaTrader 8, Sierra Chart and Bookmap indicators on Pro
  fetch them with the API key, and SabrTrader has ZeroGEX built in on the same
  key. All on https://zerogex.io/integrations
- **"Does it show in the TradingView phone app?"** It should. TradingView saves
  indicators and their settings with the chart layout, so it follows him to the
  app if he opens the same layout. Not tested on a phone, so say "should".
- **"The morning numbers don't match the site later in the day."** The email is
  the free, delayed snapshot from before the open. Before the open, the SPX,
  NDX, ES and NQ rows still carry the previous close, because index options
  don't trade pre-market. The paid site is live and moves through the day.

## Follow-up: his thank-you (Wed Nov 18, 1:08 AM)

> Thank you for the fast reply. Looking forward to using this and i have told
> my friends to give it a try and we are getting an understanding of it slowly
> but surely. Looking forward To ending the year strong and a proper 2027.
> Thank you once more

- **Nothing in it needs an answer.** It closes the thread. He doesn't say
  whether "using this" means the free indicator and morning email or coming
  back on a paid plan.
- **He's already telling friends, so his referral link is worth handing
  him.** The program is on (`REFERRAL_PROGRAM_ENABLED=1`, checked Nov 9 in
  `2026-11-09-bryan-pro-upgrade-why-not-promoted.md`). The Account page's
  Refer a friend panel shows for any signed-in account, lapsed included: the
  page is open to every tier (`core/auth.ts`), and the panel depends only on
  the program being on (`app/api/account/referrals/route.ts`). A friend who
  signs up through his link gets a month free on a monthly or quarterly plan,
  or 10% off the first year on annual. Because he isn't subscribed, each
  friend who subscribes banks him a free month (`referral_credit_months`),
  paid out as account credit when he next subscribes
  (`redeemBankedReferralCredit` in `core/referrals.ts`). That credit is
  separate from his win-back discount.

### Optional reply

Same thread. Skip it if you'd rather let the thread end on his thanks.

Hi Gregory,

Thank you, and thanks for telling your friends about ZeroGEX. Word of mouth means a lot to a small business like mine.

If they'd like to sign up, your Account page has a Refer a friend panel with your own link. Anyone who signs up through it gets a month free on a monthly or quarterly plan, and each time one of them subscribes, you earn a free month. While you're not subscribed, we hold those months for you and apply them if you come back.

Here's to ending the year strong and a great 2027.

Best,
Michael
