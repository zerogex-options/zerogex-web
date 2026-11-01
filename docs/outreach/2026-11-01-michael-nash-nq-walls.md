# Michael Nash: NDX walls on NQ and MNQ (2026-11-01)

Michael Nash (thisjustclicks@gmail.com), on the Basic trial through Nov 6,
replied at 7:18 AM to the day-two trial email "The latest SPX levels, in plain
English":

> I'm in my free trial period. I trade nq/mnq only. The only thing im
> interested in seeing are the underlying ndx call and put walls as they
> compare to NQ/MNQ...unless you think there is something else I should be
> looking at.
>
> Thanks in advance for your help

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it pastes straight into a mail client. He shares your first name,
so "Hi Michael" and the "Michael" sign-off are both correct.

> **Status:** drafted 2026-11-01, not sent.

## The read

- **What he's asking for already exists.** NQ is in the symbol picker. Its
  levels are the NDX book carried onto the NQ price at fair value (cost of
  carry to the contract's expiry), and MNQ uses the same levels
  (`frontend/core/symbols.ts`, `content/help/platform/data-coverage.md`).
  Nothing about NQ is Pro-only, so all of it works on his Basic trial.
- **Why an NQ trader got SPX numbers.** The comeback email falls back to SPX
  when a member skips the welcome's "which market do you trade?" question
  (`frontend/core/trialComeback.ts`). He skipped it.
- **Friday's levels, from the free pages** (snapshot Oct 30, 3:59 PM ET):

  | | NDX | NQ (NQZ26) |
  |---|---|---|
  | Price | 28,385 | 28,544 |
  | Call wall | 29,675 | 29,824 |
  | Put wall | 27,500 | 27,638 |
  | Gamma flip | 30,181 | 30,332 |

  The NQ levels are the NDX ones times about 1.005, which is 138 to 151 points
  higher. NQ itself sat about 17 points rich to that fair value at the
  snapshot, which is the "slightly off" the draft mentions. These hold until
  Monday's 9:30 open, apart from the daily carry step (about 3 NQ points a day
  this far from the December expiry).
- **Where to send him: the Gamma Terminal on NQ** (`/chart?symbol=NQ`). It's
  live on Basic. It draws the walls and flip on NQ candles, and the second
  ladder starts on NDX with the walls marked at their NDX strikes
  (`content/help/platform/gamma-terminal.md`, "Gamma Ladders"). That is
  exactly "NDX walls as they compare to NQ."
- **The one addition: the flip.** The draft frames it as how price moves, not
  which way, and never says walls hold more often above it: the wall study
  tested that and it didn't predict breaks. What the flip does change is the
  follow-through: below it, a break has hedging behind it. NQ was about 1,790
  points below its flip at Friday's close.
- **The flip may go blank this week.** We don't publish a flip more than 8%
  from price. It was 6.3% away on Friday, so an NQ drop below about 28,085
  (roughly 460 points, all else equal) would hide it. Friday alone fell over
  1,000 points. Since the draft tells him to watch the flip, it gets one
  sentence on what a dash means.
- **The honest number.** He only wants walls, and on Nasdaq they're close to a
  coin flip: NDX walls broke within the hour 46.8% of the time and QQQ 50.1%,
  against about 31% for S&P (`content/articles/how-often-do-gamma-walls-break.md`).
  You gave Rod the same comparison on Oct 12. Better he hears it from you
  before a wall breaks on him than after.
- **Overnight.** NDX options only trade 9:30 to 4:00 ET, so NQ levels hold at
  the 4 PM close overnight. That's the first question an NQ-only trader asks,
  so the draft answers it up front.
- **It ends on a question about his charting platform** instead of listing all
  four integrations. His answer decides what to offer: a free manual script, or
  Pro for the auto-updating ones. See "If he replies."
- **Left out:** wall alerts (they're set on NDX, not NQ, and only fire in the
  cash session, so they're better as a follow-up), pricing, and the contract
  roll (not until about Dec 11, after his trial).

## Before sending

1. **The three numbers are Friday's close.** They stay current until Monday's
   9:30 AM ET open. If you send after that, refresh them from
   https://zerogex.io/nq-gamma-levels (it lists NQ and NDX both) or drop the
   list, and check that "where NQ is now" (below the flip) still holds.
2. **The walls-caveat paragraph is a judgment call.** It's your published
   number and you've told a customer before, but it's the one paragraph that
   cuts against the sale. Cut it if you'd rather save it for a follow-up.

## Draft

**Subject:** Re: The latest SPX levels, in plain English

Hi Michael,

You can see exactly that, already converted. Pick NQ in the symbol picker and the NDX call and put walls come back in NQ prices. They apply to MNQ as is: same index, same price, a tenth the size.

Here's where they stood at Friday's 4:00 PM ET close, with NQ at 28,544:

- Call wall: 29,824 on NQ (29,675 on NDX)
- Put wall: 27,638 on NQ (27,500 on NDX)
- Gamma flip: 30,332 on NQ (30,181 on NDX)

To watch them live, open the Gamma Terminal on NQ: https://zerogex.io/chart?symbol=NQ. The walls are drawn on the NQ chart, and the ladder beside it shows the same walls at their NDX strikes.

We convert at fair value (the cost of carry to the December contract), which right now puts the NQ levels about 140 to 150 points above NDX. When NQ trades a little rich or cheap to fair value, a level can sit slightly off. Overnight, the levels hold where they were at the 4:00 PM close until the 9:30 open, since NDX options only trade during the day.

The one other thing I'd watch is the gamma flip. It tells you how price tends to move, not which way. Above it, dealer hedging leans against moves. Below it, where NQ is now, hedging adds to them, so when a wall gives way, the move can run. If the flip ever shows a dash, price is usually too far from it for us to place it reliably, and the SHORT Γ or LONG Γ tag on the chart still tells you which side you're on.

One honest number, since you'd be trading off the walls: in our study of 737 wall tests this summer, Nasdaq walls held about half the time over the next hour, versus about two in three for S&P. So plan around them rather than count on them to hold. The study is here: https://zerogex.io/education/how-often-do-gamma-walls-break

What do you chart NQ on? Some platforms can draw these levels right on your chart, and I can point you to the setup for yours.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **"I use NinjaTrader" or "Sierra Chart."** Both draw the walls and flip on
  an NQ chart and keep them current, but they need an API key, which is Pro.
  NinjaTrader's Symbol setting defaults to AUTO, which maps an MNQ chart to NQ
  by itself (`ChartSymbol()` in
  `frontend/public/ninjatrader/ZeroGexGammaLevels.cs`). From 51 hours before
  his trial ends (about Wednesday), he can switch to Pro and keep the rest of
  the trial free. Before that, switching ends the trial and charges Pro the
  same day, under the 7-day money-back guarantee
  (`frontend/core/trialProUpgrade.ts`). Pages:
  https://zerogex.io/ninjatrader-indicator and
  https://zerogex.io/sierra-chart-indicator.
- **"I use TradingView" or "thinkorswim."** The scripts are free but manual:
  neither platform lets a script fetch data, so he types each day's NQ levels
  into the settings. https://zerogex.io/tradingview-indicator and
  https://zerogex.io/thinkorswim-indicator.
- **"I use SabrTrader."** ZeroGEX is built in under Connections → Levels with a
  Pro API key. It does the NQ conversion itself, so its numbers can differ from
  ours by a few points (`2026-10-12-jp-sabrtrader-levels.md`).
- **"Can I get an alert when NQ hits a wall?"** Yes, on Basic, but the alert is
  set on NDX (the alerts page tells futures traders to), so it only fires while
  NDX trades, 9:30 to 4:00 ET. In-app, email, or Discord/Slack. The bell on the
  Call Wall and Put Wall cards in the Gamma Terminal opens it prefilled.
- **"Your levels are off from my chart."** A few points is fair value versus
  where NQ actually trades, plus the daily carry step overnight. Hundreds of
  points means his chart is on a different contract month. Ours is NQZ26
  (https://zerogex.io/help/platform/futures-contract-months).
- **"Why is the flip blank?"** See the read above. The Sept 28 write-up for
  Sulby (`2026-09-28-sulby-nq-gamma-flip.md`) is the template for explaining it.
