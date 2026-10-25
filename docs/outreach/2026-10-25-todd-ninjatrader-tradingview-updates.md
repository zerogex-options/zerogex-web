# Todd: NinjaTrader web/app, TradingView app, and how often levels update (2026-10-25)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Todd Williams replied on Sat Oct 24, 10:18 PM, to the founder note
`Quick note from Michael at ZeroGEX` (`sendVerifiedNeverPaidEmail` in
`frontend/core/mailer.ts`). That note goes only to accounts that verified
their email but never opened checkout, so Todd is a prospect choosing a plan,
not a member. He signs "TW".

> **Status:** draft, unsent. Reply in the same thread.

His questions:

> I see where the levels can be used in NinjaTrader (desktop? How about the
> web version or app?)
>
> On TradingView - web version (usually they also show up on the app too) is
> that the case with zerogex?
>
> Are these levels updated automatically once set up? Do they update during
> the day? How often? Any delay if on the pro subscription?

He also says the site is "unbelievably informative" and that he wants to teach
his kids what he does and help them build a second income stream.

## The read

- **He's deciding between plans, so answer in a way that settles it.** The
  real split is by platform: auto-updating levels need NinjaTrader Desktop
  (or Sierra Chart) and Pro. On TradingView every plan means typing the
  numbers in. One short paragraph at the end says which plan fits which
  platform, plus the trial and refund terms, and stops there.
- **NinjaTrader: desktop only.** Our indicator is a NinjaScript (C#) file
  (`frontend/public/ninjatrader/ZeroGexGammaLevels.cs`). NinjaScript runs only
  on NinjaTrader Desktop (NinjaTrader 8). NinjaTrader's web and mobile
  platforms use a separate JavaScript indicator system, so the `.cs` can't
  load there. The draft doesn't mention that JavaScript system: we haven't
  assessed it and have nothing for it.
- **TradingView: yes on the app, but it's manual everywhere.** The script is
  public and added from the Indicators search
  (<https://www.tradingview.com/script/FyyCXQwa-ZeroGEX-Daily-Gamma-Levels/>).
  TradingView saves indicators and their inputs with the chart layout on the
  account, so it should appear on the app too. The draft says "should" because
  we haven't tested it on a phone. The part he'll care about more: Pine Script
  can't make network calls, so the levels never update themselves on
  TradingView (`docs/integrations.md`, "The split is a platform constraint").
- **Don't hint that auto-updating TradingView is coming.** The only route is
  Pine Seeds, and TradingView has suspended new Seeds repos. It's shelved
  (zerogex-oa `docs/design/pine-seeds-gamma-levels-exporter.md`).
- **Update cadence.** The analytics recompute about once a minute
  (`/help/platform/data-coverage`). The NinjaTrader indicator polls
  `/api/v1/levels/{symbol}` every 60 seconds by default, with a 30-second floor
  (`docs/ninjatrader-indicator.md`, "Poll interval").
- **No delay on Pro.** `/api/v1/levels` serves the newest snapshot. The
  `delay_minutes` option exists only on the reads behind the free public pages
  (zerogex-oa `src/api/main.py`), which run about 15 minutes behind. Basic and
  Pro both see live numbers on the site (`/help/platform/tiers-and-access`).
- **Do levels move intraday?** Yes. They're recomputed as price, time and
  implied volatility move. Open interest itself updates only overnight
  (`/help/platform/data-coverage`, "Refresh cadence by surface"). The walls
  are discrete strikes, so they change less often than the gamma flip.
- **One warm line about his kids, no more.** He shared something personal.
  Thank him for it without turning it into a pitch.

## Draft

**Subject:** Re: Quick note from Michael at ZeroGEX

Hi Todd,

Thank you, that means a lot. Teaching your kids what you do is a great reason to dig in, and I'm glad the site helps.

Here are your answers:

**NinjaTrader:** Our indicator works on NinjaTrader Desktop (NinjaTrader 8) only. It's written in NinjaTrader's desktop programming language, which their web version and mobile app can't run, so it won't show up there.

**TradingView:** Yes. Add our indicator once on the web version and it should show up in the TradingView app too, because TradingView saves your chart layout to your account. The catch is that on TradingView you enter the levels yourself. TradingView doesn't let any indicator pull in outside data, ours or anyone's, so you type the day's numbers into the indicator's settings, and the lines stay where you put them until you change them.

**Do they update automatically?**

- **NinjaTrader Desktop:** Yes, all day. Paste in your API key once and the indicator checks for new levels every minute, which is how often we recalculate them.
- **TradingView:** No, for the reason above. If a level moves during the day, your TradingView lines won't move with it until you type in the new number.
- **Do they change during the day?** Yes. We recalculate them as price, time and volatility move. The walls sit on specific option strikes, so they change less often than the gamma flip.
- **Any delay on Pro?** None. Both paid plans, Basic and Pro, get live numbers. Only the free levels pages on our site run about 15 minutes behind.

So the choice comes down to your platform. The auto-updating NinjaTrader indicator comes with Pro, because it runs on the API key that's included with Pro. If you mainly use TradingView, Basic gives you the live levels on zerogex.io to copy from, and the site works in your phone's browser too. Basic monthly comes with a 7-day free trial, and Pro has a 7-day money-back guarantee.

Happy to help you get set up either way. Just reply here.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **"Will you make one for NinjaTrader web or mobile?"** No promise. Their
  web/mobile platform has its own JavaScript indicators, but we haven't checked
  whether those can call an outside API. Say it's noted, nothing more.
- **"Can TradingView ever update on its own?"** Not today. The only route is
  TradingView's Pine Seeds, and TradingView isn't accepting new ones (zerogex-oa
  `docs/design/pine-seeds-gamma-levels-exporter.md`). Don't give a date.
- **"It doesn't show on my TradingView app."** Make sure he's signed in to the
  same TradingView account and opened the same saved chart layout. If it still
  isn't there, he can add it from the app's Indicators search ("ZeroGEX Daily
  Gamma Levels") and re-enter the numbers.
- **He trades ES or NQ overnight.** Those levels come from the SPX and NDX
  options books, which price during U.S. hours, so overnight they hold at the
  4 PM close plus overnight chain updates (`/help/platform/data-coverage`).
- **He uses Sierra Chart, SabrTrader or thinkorswim.** Sierra Chart and
  SabrTrader also auto-update on the Pro key. thinkorswim is manual like
  TradingView, but its study comes with that day's numbers already filled in.
  All of it is on `/integrations`.
- **He asks where to start learning, for his kids.** The Education Hub and
  articles are public. Point him there rather than to a paid plan.
