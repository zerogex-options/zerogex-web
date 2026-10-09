# Rod Deisler: "What makes ZeroGEX stand above TradeGEX?" (2026-10-09)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Rod (`rldindustries1975@gmail.com`) signs "Rod" and shows as *rod Deisler*.

> **Status:** unsent. Payment checked and cleared (see "Verified" below), so
> the draft is ready. Reply in the same thread, so it lands under his message.

## Thread so far

1. **2026-10-08 5:44 PM ET, automated: "Your ZeroGEX payment was declined."**
   His first Pro payment ($59, monthly) was declined, and the bank gave no
   reason.
2. **2026-10-09 11:59, inbound.** "I got the pro acct." He's doing a deep dive
   this weekend, has used TradeGEX for the last month, and asks what makes
   ZeroGEX stand above it. He adds that ZeroGEX "is starting to weigh above
   tradegex in my opinion."

## The read

- **He's leaning our way and asking for a reason.** The strongest answer is a
  straight one with specifics he can check this weekend. He has TradeGEX open
  next to us, so every claim about it in the reply comes from TradeGEX's own
  pages, nothing from memory or review sites.
- **Lead with the walls.** It's the most concrete difference he can see on his
  own screen. TradeGEX's key-levels guide puts its walls at the strikes with the
  most open interest. Ours weight open interest by gamma.
- **Then the wall study.** TradeGEX's guides call the call wall resistance and
  the put wall support. We measured it, and the answer is less flattering than
  that. Telling him is the most ZeroGEX thing we can say.
- **Name where TradeGEX is ahead.** More markets, faster refresh, and a
  desktop app with a simulator. He'll notice all of it anyway, and he'll trust
  the rest more if he hears it from you. Tradovate, ATAS and DEX are left out
  to keep the mail short; the comparison page covers them.
- **The weekend is a good time for Replay.** Markets are closed, and Replay lets
  him scrub any recent session, ES and NQ included, minute by minute.
- **Ask what he trades.** If it's YM, RTY, gold or crude, we don't cover it,
  and that's better learned now. Pete and Alexandru both left on 10-06 over
  symbol coverage. Don't promise new symbols.
- **Price gets one line.** He's probably paying TradeGEX $59.99 a month. On
  yearly billing, our Pro is $299 against their $599. No discount: price isn't
  his question.
- **Thank him for the referral.** A referral reward for
  richardkreger@gmail.com banked him a free month this morning, and it's now a
  $59 credit, so his November 9 renewal is $0. One line. The draft doesn't
  name the person he referred, since the name would only be a guess from the
  email address.

## What TradeGEX is

Read first-hand from tradegex.pro on 2026-10-09. The new comparison page,
[ZeroGEX vs TradeGEX](https://zerogex.io/education/zerogex-vs-tradegex), has
the full side-by-side once it's deployed.

- **Who:** a product of RDRING SERVICES LLC, under Florida law. Support is
  support@tradegex.pro. No founder is named.
- **Built for:** futures day traders. GEX and DEX bars, call and put walls, a
  gamma flip, a Key Gamma Strike and max pain on ES, NQ, YM, RTY, gold and
  crude futures, plus NVDA, TSLA, AAPL, MSFT, AMZN, META and GOOGL.
- **Extras:** its own Hedge Flow indicator, a multi-market oscillator (ES, NQ,
  VIX and options flow), a VIX line on the chart, a dual chart, a weekly COT
  report, native Mac and Windows apps (Windows in beta), a built-in trade
  simulator, and indicators for TradingView and Tradovate (Chrome extensions),
  ATAS and NinjaTrader.
- **How the levels are built:** GEX is gamma × open interest × multiplier ×
  spot², per strike. The key-levels, chart and open-interest guides put the
  walls at the strikes with the most call and put open interest. Its Greeks
  guide says "dominant gamma strikes" instead, so its own guides disagree.
  Futures levels come from ETF or index options (SPY/QQQ/IWM or SPX/NDX/RUT),
  converted with a ratio. It says it estimates open interest during the
  session and refreshes GEX "every few seconds".
- **Hours:** its terms say the service is built for regular trading hours, and
  options-derived data may be stale outside them.
- **Price:** one plan, at $59.99 a month, $299 every six months, or $599 a
  year. The 3-day free trial needs a phone number but no card, and doesn't
  convert on its own. Refunds are given "only in exceptional circumstances."
- **Not on its site:** an API, backtesting, or a GEX replay, and there's no
  Discord link. A mobile app is "in development."

## Verified

From `make diagnose-user EMAIL=rldindustries1975@gmail.com`, run 2026-10-09.
Times are ET.

- **Pro is active and paid.** The Oct 8 subscription got stuck after the
  decline, expired, and was canceled by script at 9:39 AM on Oct 9. He
  subscribed again at 10:19 AM and paid $59 through Link at 10:23 AM. He saw
  the Pro welcome at 10:28 AM.
- **His next month is free.** At 9:35 AM a manual referral reward for
  richardkreger@gmail.com banked him one free month. It became a $59 credit
  when he paid. Stripe shows the balance at -$59.00 and the November 9
  invoice at $0.00.
- **Ignore "DORMANT" in that output.** The script labels any account under 24
  hours old as dormant. He has signed in twice since signing up.

## Draft

Hi Rod,

Welcome to Pro, and sorry about the payment hiccup. Thanks too for the referral: it earned you a free month, so your November renewal is on us.

I know TradeGEX. It's a solid product, so here's the honest comparison.

Where I think we stand above it:

1. How the walls are picked. TradeGEX's guide puts its walls at the strikes with the most open interest. Ours weight open interest by gamma, which is highest near price, so a big block of contracts far away doesn't outrank a strike right next to price.
2. We show our work. How every level is calculated is published, and every daily forecast is graded in public, misses included. We even tested whether walls really hold: across 737 wall tests, S&P walls held about two times in three within an hour, and Nasdaq walls about half. https://zerogex.io/education/how-often-do-gamma-walls-break
3. Depth on the S&P and Nasdaq: fourteen signals with published methods, plus vanna and charm, hedging flow, and a gamma heatmap through the session.
4. Price: about the same month to month, and on yearly billing Pro is $299 against their $599.

Where TradeGEX is ahead: more markets (the Dow, the Russell, gold, crude, and big tech stocks), levels they say refresh every few seconds against our once a minute, and a desktop app with a trade simulator.

For the weekend, start with Replay: https://zerogex.io/replay. Pick a session from this week on ES or NQ and scrub through it to watch the flip and the walls move against price. Then try Trade Bias and the Advanced Signals, with this guide open beside them: https://zerogex.io/guides/signals-explained

One question back: what do you trade, and what do you use most in TradeGEX? If it's something we don't do, I'd like to know.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He names symbols we don't cover.** Add them to the symbol-request list,
  next to Pete's and Alexandru's. No date, no promise.
- **He asks about the refresh speed.** The levels recompute about once a
  minute and the price updates about every second. Open interest is published
  once a day, so intraday changes in the levels come from repricing the book
  as price, time and volatility move. TradeGEX says it estimates open interest
  during the session. That's a real difference to describe, not a defect on
  either side.
- **He asks to switch to yearly.** He can do it himself on the
  [Pricing](https://zerogex.io/pricing) page. It shows the exact amount
  charged that day, less a credit for the unused part of his current month,
  and asks him to confirm first. His $59 referral credit goes toward whatever
  he is billed next, so it would come off that charge instead of the November
  renewal.
