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

> **Status:** sent 2026-11-01. He replied at 4:00 PM that he's on
> NinjaTrader; see "Follow-up: NinjaTrader" at the end.

## The read

- **What he's asking for already exists.** NQ is in the symbol picker. Its
  levels are the NDX book carried onto the NQ price at fair value (cost of
  carry to the contract's expiry), and MNQ uses the same levels
  (`frontend/core/symbols.ts`, `content/help/platform/data-coverage.md`).
  Nothing about NQ is Pro-only, so all of it works on his Basic trial.
- **Why an NQ trader got SPX numbers.** The comeback email falls back to SPX
  when a member hasn't answered the welcome's "which market do you trade?"
  question (`frontend/core/trialComeback.ts`). He hadn't seen it yet: he didn't
  come back after signing up until the email went out at 6:49 AM ET, then
  logged in and picked NQ at 7:08 AM (`make diagnose-user` audit trail). So
  the email is what brought him back.
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

## Follow-up: NinjaTrader (Sun Nov 1, 4:00 PM)

His reply:

> Very interesting and thanks for the detail! Im running on ninjatrader.

> **Status:** sent 2026-11-01 at 7:50 PM, lightly edited. He replied at 9:06 PM; see
> "Follow-up: his TradingView indicator, and Aurelius" below.

### The read

- **NinjaTrader is the Pro integration.** The indicator draws the flip, both
  walls, max pain and the pin strike on his chart and polls for new levels
  every 60 seconds. The download and the API key it polls with are both Pro
  (`frontend/components/PlotOnNinjaTrader.tsx`, `docs/ninjatrader-indicator.md`). He's
  on Basic, so the draft has to say that plainly.
- **Two ways onto Pro, both already built** (`frontend/core/planSwitch.ts`,
  `frontend/core/trialProUpgrade.ts`):
  1. In the last 51 hours of his trial, switching keeps the rest of it free.
     The first charge, on the trial-end date, is Pro's $59 instead of Basic's
     $39. The trial-end reminder he gets about 48 hours out carries a "Switch
     to Pro" link for exactly this (`frontend/core/mailer.ts`).
  2. Before then, switching ends the trial and charges $59 that day, under the
     7-day money-back guarantee.

  The link in the draft opens the switch for a Basic trialer and shows the
  terms that apply that day. Nothing changes until he confirms
  (`frontend/app/pricing/Client.tsx`). The promo ended Oct 1, so list prices
  apply.
- **No supported way to give him Pro free before the window, short of a
  comp.** (Corrected Nov 1: this first said `comp-member` was only for ended
  subscriptions. It isn't: it permanently comps a member onto Pro and cancels
  a live subscription first. That's more than a trial needs.) `extend-trial`
  moves the whole trial, so the two days move later with it. The draft
  doesn't hand-edit his tier, and you shouldn't need to. The partner route in
  the next follow-up is the better fit.
- **MNQ gotcha.** The page says to set *Symbol* to match the chart. On an MNQ
  chart he might type MNQ, which isn't one of our symbols. The setting
  defaults to AUTO, which maps an MNQ chart to NQ (`ChartSymbol()` in
  `frontend/public/ninjatrader/ZeroGexGammaLevels.cs`). The draft tells him
  to leave it on AUTO.
- **Desktop only.** NinjaScript runs on NinjaTrader 8 desktop, not NinjaTrader's
  web or mobile apps (`2026-10-25-todd-ninjatrader-tradingview-updates.md`).
  One sentence now saves him paying $59 for something his platform can't load.
- **Install is paste-and-compile for now.** No `.zip` package is published
  (`NT_PACKAGE_PATH` is null in `frontend/core/ninjaTraderManifest.ts`), so
  the page has Pro members download the `.cs` and compile it in the
  NinjaScript Editor. The draft links the page instead of repeating the steps.
- **Cross alerts beat site alerts for him.** "Enable cross alerts" (off by
  default) fires a NinjaTrader alert when price crosses a level, on the NQ
  chart's own price. That covers the overnight session too, which the site's
  wall alerts can't, since those are set on NDX.

### Before sending

Checked with `make diagnose-user` on Nov 1. Nothing blocks sending:

- **Trial ends Fri Nov 6, 7:46 AM ET**, before the open. The free switch opens
  **Wed Nov 4, 4:46 AM ET**, so waiting gets him Wednesday's and Thursday's
  sessions on Pro for free.
- **The reminder with the Switch to Pro link** should go out at about 7:15 AM
  ET on Wednesday. The timer runs every 6 hours at :15
  (`deploy/systemd/zerogex-web-trial-reminders.timer`, assuming the server
  clock is UTC), and that's the run inside his window.
- **$39.00 / month, no discount**, so the dollar figures stand.
- **He pays with Stripe Link, not a card.** The subscription has its own
  default payment method, so the trial-end charge and a switch today both use
  it. If a switch-today charge fails, nothing changes and he stays on the
  trial (`payment_behavior: 'error_if_incomplete'` in
  `frontend/app/api/billing/change-plan/route.ts`).

### Draft

**Subject:** Re: The latest SPX levels, in plain English

Hi Michael,

Glad it helped. NinjaTrader is the best fit for what you want. Our indicator draws the call wall, put wall and gamma flip (plus max pain and the pin strike) right on your NQ or MNQ chart, and keeps them current by itself, so there's nothing to type in. On an MNQ chart, leave the Symbol setting on AUTO and it uses the NQ levels. It runs on NinjaTrader 8 desktop, not the web or mobile app.

The catch is that it needs an API key, which comes with Pro, and you're on the Basic trial. Two ways to try it:

1. Wait for the last two days of your trial, which start Wednesday morning. Switch to Pro then and the rest of your trial stays free. Your first charge on November 6 becomes Pro's $59 instead of Basic's $39, and you can still cancel before then and pay nothing. We'll email you a link when that opens.
2. Switch today. Your trial ends and Pro starts now at $59, covered by our 7-day money-back guarantee: ask within 7 days and it's refunded in full.

Either way, this link shows you the exact terms before anything changes: https://zerogex.io/login?next=%2Fpricing%3Fplan%3Dpro%26cadence%3Dmonthly%26switch%3Dpro

Once you're on Pro, generate your API key under Account → API Access, then follow the steps at https://zerogex.io/ninjatrader-indicator. It takes a few minutes. If you want a heads-up when price reaches a level, turn on "Enable cross alerts" in the indicator's settings. And if anything doesn't show up on your chart, send me a screenshot and I'll sort it out.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

### If he replies

- **"Can I try Pro free before Wednesday?"** Not on the trial. If you want
  to give him more room, `make extend-trial` adds days, but the free Pro
  switch moves to the new last two days with it. The partner grant in the
  next follow-up is the way to give him Pro now.
- **The indicator shows an error or no lines.** Ask for a screenshot of the
  info panel (top right). Usual causes: Symbol typed as MNQ (set it to AUTO or
  NQ), the API key pasted with a missing character, or an older copy of the
  indicator already installed (two copies won't compile; see
  `2026-09-28-sulby-nq-gamma-flip.md`). The current build reads v2.4.
- **"The levels don't move overnight" / the panel says the snapshot is hours
  old.** Expected: the levels hold at the 4 PM close until the 9:30 open. The
  first email told him so.
- **He switched today and changes his mind.** The guarantee covers a full
  refund within 7 days of that payment, one per customer, and access ends when
  it's refunded.

## Follow-up: his TradingView indicator, and Aurelius (Sun Nov 1, 9:06 PM)

He sent a screenshot of a live NQ chart on TradingView (price about 28,727)
with another provider's GEX indicator on it, and wrote:

> Im trying to understand all of this. This is an indicator im looking at on
> my trading view chart that's currently live and has a put wall from Friday
> at 28709. The levels you were referring to aren't anywhere in site of this
> area. Am I missing something?...I really like your level of service and can
> throw a lot of people your way if I can figure out how to make this
> fruitful. My site is tradeaurelius.com where I have a lot of traders I
> teach. Gex levels are new for me but I LOVE them as it's almost like
> cheating 😃

> **Status:** drafted 2026-11-01, not sent.

### The read

- **The indicator isn't ours.** Our TradingView script doesn't update itself
  and labels its lines Call Wall, Put Wall, Gamma Flip and Max Pain
  (`frontend/public/tradingview/zerogex-daily-gamma-levels.pine`). His is
  live and labels lines P1, P2, P5, Ab1, Ab2, NPGE and PC. Its "P1" at 28,709
  is what he calls the put wall. We can't see how it's built, so the draft
  doesn't guess at why it lands there.
- **Why ours are far from price.** By default our walls use every expiration:
  the strikes with the heaviest gamma-weighted open interest on each side of
  spot (`frontend/content/methodology.md`). Friday's NQ put wall was 27,638
  (NDX 27,500), 906 points under Friday's close. Sunday night the free page
  had NQ at 28,786 with the put wall at 27,635 and the call wall at 29,821,
  about 1,150 points below and 1,035 above.
- **The closer comparison is our 0DTE view.** The Gamma Terminal's Expiry
  filter and the NinjaTrader indicator's Expiration setting both redraw the
  walls and flip from today's expiration alone
  (`frontend/content/help/platform/gamma-terminal.md`, "The Expiry filter").
  NDX has a same-day expiration every weekday (the models assume one,
  `frontend/core/symbols.ts`), and about 76% of its open interest is same-day
  (`2026-09-28-sulby-nq-gamma-flip.md`). On 0DTE the
  flip often reads "NO FLIP IN SELECTED EXPIRIES"; that's expected, and the
  help article explains it. On a weekend the Terminal reads "NO 0DTE TODAY ·
  SHOWING ALL EXPIRIES", which is why the draft says "during the session".
- **Who he is.** He founded Aurelius Trading Systems (tradeaurelius.com). It
  sells "Michael's Daily Levels", daily NQ zones delivered through his own
  NinjaTrader indicator ($495 a month with a code, $995 standard); "Marcus
  Aurelius", semi-automated NinjaTrader trading software ($495 to $995 a
  week); and a 90-day private one-on-one program. Everything he sells runs on
  NinjaTrader Desktop. So he teaches, but he also sells levels, and his
  clients already pay $495 or more a month for them.
- **The partner program fits, with one boundary.** The standard offer
  (`docs/creator-partner-outreach.md`) is 90 days of free Pro, then a link and
  code once it's landing: 25% off the first year for his traders, 30%
  commission for 12 months for him. He raised referrals himself, so the draft
  names the arrangement but leaves the numbers for later. The boundary: our
  terms license the data for personal or internal business use and bar
  redistributing it without written permission
  (`frontend/app/terms/Client.i18n.ts`). "Make this fruitful" could mean
  putting our levels inside his paid indicator. The draft says his traders
  would each get their own account, which sets that expectation without
  accusing him. His API key is his alone and revoking it cuts it off at once
  (`docs/ninjatrader-indicator.md`).
- **His trial has to be canceled before the grant.** `grant-partner-pro` gives
  Pro with no subscription and doesn't touch Stripe. Left running, the trial
  charges $39 on Nov 6, and that subscription sync resets him to Basic. The
  cancel has to land first, too: the subscription-deleted webhook sets the
  tier to public, so a grant made before it arrives gets wiped
  (`frontend/scripts/comp-member.mts` header). Win-back and reactivation
  emails skip creator partners (`frontend/core/excludedAccounts.ts`), so the
  cancel won't send him one.

### Before sending

1. **Decide on the partner offer (fourth and fifth paragraphs).** It commits
   you to 90 days of free Pro for someone who also sells NQ levels. The upside
   is an audience already paying $495 a month and up for levels. The downside
   is capped: the per-trader line in the draft, the terms, and a key you can
   revoke. If you'd rather talk first, cut those two paragraphs down to the
   call invitation.

### Draft

**Subject:** Re: The latest SPX levels, in plain English

Hi Michael,

You're not missing anything. That indicator isn't ours, and it's built differently, so the two sets of levels won't line up.

Our walls come from the whole NDX options book, every expiration. The put wall is the strike below price with the most put gamma across all of it. On Friday that was 27,500 on NDX, which is 27,638 on NQ, about 900 points below where NQ closed. So ours are the big structural levels, and right now they're a long way from price.

I can't see how your TradingView indicator calculates its levels, so I can't tell you exactly why it has a put wall at 28,709. But which expirations a tool counts, and how it defines a wall, can move a level by hundreds of points. If yours is built for intraday levels, the closer comparison is our 0DTE view: during the session, set Expiry to 0DTE in the Gamma Terminal and the walls and flip are drawn from today's expiration alone, which usually puts them much closer to price. The NinjaTrader indicator has the same setting (Expiration: 0DTE).

Thank you for the kind words, and I'd like that. I had a look at Aurelius, and since everything you build runs on NinjaTrader, our indicator would sit right alongside your tools. We have a partner program for educators: I'll give you Pro free for 90 days, NinjaTrader indicator included, so you can judge it properly. If it earns a place with your traders, they'd each get their own account at a discount, and you'd earn a commission on them.

If that sounds good, just say so and I'll switch your account over and cancel your trial, so you won't be charged anything. I'd also be glad to do a quick call and walk you through it with NQ on screen. Send me a couple of times that work.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

### If he says yes

Run these from `~/zerogex-web`, in this order. Nothing has been charged on
his trial, so there's nothing to refund.

1. Cancel the trial. Dry run first; `FORCE=1` is required for a trialing
   subscription.

   ```bash
   make cancel-subscription EMAIL=thisjustclicks@gmail.com FORCE=1 DRY_RUN=1
   ```

   ```bash
   make cancel-subscription EMAIL=thisjustclicks@gmail.com FORCE=1 YES=1
   ```

2. Wait for the webhook. Run this until the recent events list a
   `stripe_subscription_deleted` row, usually within a minute:

   ```bash
   make diagnose-user EMAIL=thisjustclicks@gmail.com
   ```

3. Grant partner Pro. `AURELIUS25` is the code his traders would type later;
   change it if you prefer another.

   ```bash
   make grant-partner-pro EMAIL=thisjustclicks@gmail.com PROMO_CODE=AURELIUS25 DRY_RUN=1
   ```

   ```bash
   make grant-partner-pro EMAIL=thisjustclicks@gmail.com PROMO_CODE=AURELIUS25 YES=1
   ```

4. Send the activation note below, with the expiry date the grant printed.

**Activation note** (from stage 5 of the partner playbook, no affiliate
details yet):

Hi Michael,

Done. Your trial is canceled, so nothing will be charged, and 90 days of Pro is live through [EXPIRY DATE].

To get it on your chart:

1. Generate your API key under Account → API Access. It's shown once, so copy it somewhere safe.
2. Follow the steps at https://zerogex.io/ninjatrader-indicator to add the indicator.
3. On an MNQ chart, leave Symbol on AUTO. For intraday levels, set Expiration to 0DTE.

Use it however you normally trade, and tell me what adds signal and what feels like noise. And I'm still happy to do that call whenever suits you.

Best,

Michael

### If he replies

- **He asks for the partner numbers.** 25% off the first year on any plan for
  his traders, 30% recurring commission on each conversion's first 12 months,
  and an FTC disclosure ("affiliate link" or "#ad") whenever he mentions it
  (`docs/creator-partner-outreach.md`, stage 7).
- **He wants our levels inside his own indicator or software.** That's
  redistribution, which the terms allow only with written permission. It's a
  data-licensing deal, with its own price, and better settled on a call than
  over email.
- **He sends another side-by-side.** Ask which Expiry setting he had on. Ours
  on All against an intraday tool will always look far apart.
