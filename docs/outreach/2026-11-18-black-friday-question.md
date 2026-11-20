# Jed (the_real_scientist_1): "will you be running any Black Friday specials?" (2026-11-18)

American English, and each paragraph in the reply is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** From the_real_scientist_1@proton.me to support@zerogex.io, Wed Nov 18
at 9:46 AM, subject "Question About Pricing":

> Quick question, will you be running any black Friday specials?
>
> Thanks

No name given, so the draft opens "Hi there".

> **Status:** account checked Wed Nov 18: `make diagnose-user` says "No user
> found", so they have never subscribed and the sale applies to them. The sale
> opens early, at 12:00 AM ET Thursday, Nov 19. The first reply went out. Jed
> answered at 12:38 PM: he's buying Pro annual at the sale price. The second
> reply (end of this note, "Follow-up") was sent Wed Nov 18 afternoon, as
> drafted. Next: once he buys, his subscription in Stripe should carry the
> Black Friday coupon.
>
> **Thu Nov 19, ~8:45 AM ET:** the sale went live on the site when the setup
> ran this morning, not at midnight (`make setup-black-friday VERIFY=1`: no
> problems; the live /pricing serves the sale, ending Dec 1). From midnight
> until then the site showed regular prices, so if Jed checked out overnight he
> paid $299 for Pro annual instead of $149.50: refund the $149.50 difference in
> Stripe (a partial refund leaves his plan and access as they are; the
> `charge.refunded` webhook only logs it and reverses partner commissions, and
> he has none).
>
> **Thu Nov 19, `make diagnose-user`:** no refund needed. He registered Wed Nov
> 18 at 2:37 PM ET (`user_7d29bb37572db9d760f7194d`, verified, organic), and
> has never started a checkout: no Stripe customer, nothing paid. But he was
> last seen at 12:59 AM ET, right after midnight, while the sale was still off,
> so he most likely looked and saw $299. He's first-time
> (`hasHeldSubscriptionBefore` no), so the sale applies whenever he buys. Next:
> a short heads-up that it's live now (draft below).
>
> **Fri Nov 20:** he bought a subscription, and answered your next email with
> product feedback (Follow-up 3, at the end). He's the sale's first real buyer,
> so check that his subscription carries the Black Friday coupon before replying.

### Heads-up (Thu Nov 19)

Same thread.

Hi Jed,

Quick heads-up: the sale is live now. If you looked overnight, it hadn't switched on yet, sorry about that. Pro annual is $149.50 at https://zerogex.io/pricing (choose Annual, then "Get Pro at 50% off"), any time through December 1.

Best,
Michael

## The read

- **Yes, and it's built.** The sale is on branch `claude/black-friday-sale`: 50%
  off every payment in the first year of any plan, for first-time members who
  pay today, through Tuesday, December 1. The rules and the setup are in
  `docs/black-friday-2026-runbook.md`.
- **Open it early, tonight at midnight.** The plan was Black Friday, November 27.
  Someone asking about Black Friday nine days out is waiting for it, and a week
  is long enough to forget. Opening at midnight lets them buy tomorrow morning.
- **No code to type.** The pricing page shows the sale prices and checkout
  applies them, so the reply sends them to `/pricing` and nothing else.
- **Say the trial trade-off up front.** The sale price is paid today and never
  comes with the free trial. Someone who planned to start the Basic trial should
  hear that from us, not discover it at checkout. The 7-day money-back guarantee
  covers every sale purchase, so they still have a way out.
- **Annual is the best value**, and the most useful for the business: $99.50 for
  a year of Basic is $8.29 a month, paid up front.
- **Name the time zone.** "Midnight" is Eastern (12:00 AM ET Thursday,
  `2026-11-19T05:00:00Z`). The page shows regular prices until then, so the
  reply says "after midnight tonight" and a look at 9 PM doesn't read as a
  broken promise.

## Account check (done)

```bash
make diagnose-user EMAIL=the_real_scientist_1@proton.me
```

Nov 18: "No user found with email the_real_scientist_1@proton.me". No account
means no earlier trial or plan, so they sign up fresh and get the sale price.

## Before sending

The reply promises the sale opens tonight, so set it up first: merge, deploy,
then section 2 of the runbook. `make setup-black-friday VERIFY=1` must end "no
problems" and say "Scheduled: opens in about N hour(s)" (or "Open now" after
midnight).

## Draft reply

Reply in the same thread.

Hi there,

Yes, we are! I was planning to start the sale on Black Friday, but I'll go ahead and open it tonight at midnight Eastern so you don't have to wait. It runs through Tuesday, December 1, and every ZeroGEX plan is 50% off for your first year.

That's Basic at $19.50 a month instead of $39, or Pro at $29.50 instead of $59. Annual is the best value: $99.50 for your first year of Basic (normally $199), or $149.50 for Pro (normally $299). Quarterly plans are half off too.

The sale is for first-time subscribers who pay when they sign up, so it can't be combined with the 7-day free trial. You're still covered, though: every sale purchase comes with our 7-day money-back guarantee, so if ZeroGEX isn't for you, you can get a full refund from your Account page within 7 days.

There's no code to enter. Just visit https://zerogex.io/pricing any time after midnight tonight and the sale prices are applied automatically.

If you'd like help picking the plan that fits how you trade, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX

## Follow-up: Jed's reply (Wed Nov 18, 12:38 PM)

> Thank you so much. I almost went with unusual whales then I been binge
> reading all the articles. I need up to date info because I need it to plan
> for collecting premium. Thats all I do is collect premium and maybe a
> butterfly. credit spreads 90% of time and 10% butterflies or broken wing. Try
> to collect 40 to 60% of premium and close trade. one and done as that is the
> goal.
>
> Zerogex is what I feel will help me. It seems you made something nice. Now
> what I did like at unusual whales was the periscope but I think you do have
> something like that. Plus from reading how its calculated, not sure if it was
> right.
>
> Anyway will be purchasing the pro yearly for $150 and I wont be refunding as
> this seems like where I need to be.
>
> Have you considered a discord or a community chat within the website for
> members and you to discuss strategies and issues?
>
> Thanks,
>
> Jed

### The read

- **Make sure he pays $149.50, not $299.** He has no account yet, and the sale
  opens at midnight ET. Signing up now is fine (he has to verify his email
  before checkout anyway), but a checkout before midnight charges the regular
  price. The reply says so plainly.
- **He sells premium**: credit spreads, sometimes butterflies and broken wings,
  taking 40 to 60% and closing. Point him at the four things built for that,
  each named the way the app names it:
  - the walls and the gamma flip, and the Gamma Terminal's **Dealer Gamma @
    Spot** box (long gamma: hedging modeled to lean against moves; short
    gamma: to add to them), which is the help center's own wording;
  - **Pin Strike** for butterflies (the reachable 0DTE strike with the
    strongest restoring dealer gamma into the close);
  - the **Strategy Builder**: verticals, iron condors and butterflies from
    the live chain, with breakevens. There is no broken-wing preset, but
    every leg's strike is adjustable, so the reply says that instead;
  - the **Spread Monitor**, for when fills will cost him.
  - Pro adds **Backtesting** with "defined-risk verticals and iron condors"
    (the help page's words), tested against gamma conditions.
- **Periscope.** Unusual Whales' GEX Periscope shows market-maker gamma per
  strike and expiry. The closest view here is **GEX Heatmap · Strike × DTE**
  on the Dealer Positioning page: net dealer gamma by strike for each
  expiration out to 7DTE. His doubt about how it's calculated is the opening
  for `/methodology`: nobody can see which side a dealer holds, so every tool
  models it, and ZeroGEX says how. No claims about Unusual Whales beyond that.
- **Discord: your call.** Nothing in the repo plans one, so the draft says
  "not yet, noted" and invites him to email you directly. Change it if you
  have plans.

### Draft reply

Same thread.

Hi Jed,

Thank you, that's great to hear, and welcome aboard. Selling premium is a good fit for what ZeroGEX does.

One thing on timing so you get the $149.50: the sale starts at midnight Eastern tonight. You can create your account now at https://zerogex.io/register and verify your email, then after midnight go to https://zerogex.io/pricing, choose Annual, and click "Get Pro at 50% off". If you check out before midnight, it charges the regular $299.

For credit spreads and butterflies, here's where I'd start:

- The call and put walls and the gamma flip, on the Main Dashboard and in the Gamma Terminal. The Terminal's "Dealer Gamma @ Spot" box shows whether dealers are modeled long gamma, where their hedging tends to lean against moves, or short gamma, where it tends to add to them. That's useful context for where to put your short strikes and how much room to give them.
- Pin Strike, for butterflies: the reachable same-day strike with the strongest modeled dealer gamma into the close.
- The Strategy Builder has verticals, iron condors and butterflies built from the live chain, with breakevens and the P&L chart. Every leg's strike is adjustable, so you can skew a butterfly into a broken wing.
- The Spread Monitor shows how wide the chain is quoted, so you can tell when fills are going to cost you.
- With Pro you also get Backtesting, which tests defined-risk verticals and iron condors against the gamma conditions you choose.

On Periscope: the closest thing here is the "GEX Heatmap · Strike × DTE" on the Dealer Positioning page. It shows net dealer gamma by strike for each expiration out to 7 days. You're right to look at how these are calculated: nobody can see which side dealers actually hold, so every tool is modeling it. Here's exactly how ZeroGEX does it: https://zerogex.io/methodology

On a Discord or community chat: not yet, but it's a good idea and I've noted it. Until then, anything you send comes straight to me, and I'm happy to talk through how you're using the levels for your spreads.

Thanks again for choosing ZeroGEX.

Best,
Michael
Founder, ZeroGEX

### Worth knowing

- **A credit-spread community already uses ZeroGEX.** Brandon, a creator
  partner, runs a Discord called The Credit Spread Club
  (`docs/outreach/2026-10-19-brandon-credit-spread-club-creator-partner.md`).
  If you want to give Jed somewhere to talk spreads now, that's an option,
  but it's Brandon's room, not yours, so it's left out of the draft.
- **He may be the sale's first real buyer.** After he buys, his subscription
  in Stripe should show the coupon "Black Friday: 50% off your first year" and
  the metadata `black_friday = 1`. That's the first live check that checkout
  applied the sale.

## Follow-up 2: Jed (Wed Nov 18, 2:37 PM)

> I appreciate the insight and tips. I am about to register and wait for
> midnight or it may be tomorrow morning but its going to get purchased.
>
> I cant wait to get deep into doing this and I am sure I will have many more
> questions. I am extremely pleased to support a project like this. Some of
> these tools out here are not good as advertised.
>
> Again cant wait. I get zerogex and GTA 6 LOL!!!!!

### The read

- **Nothing to fix.** He's registering now and buying tonight or tomorrow
  morning. Both are inside the sale, which runs through December 1, so the
  reply takes the rush out of it.
- **Short reply, warm.** He'll have questions; say yes to them. The GTA 6 line
  gets a light nod, without naming a release date in a business email.

### Draft reply

Same thread.

Hi Jed,

That means a lot, thank you, especially from someone who has compared the alternatives.

No rush on the timing: the sale price is there through Tuesday, December 1, so after midnight tonight or tomorrow morning both work.

And please do send the questions as they come up. They're how I find out what to build next, and I'm happy to help you get the most out of it for your spreads.

Enjoy both, and don't let GTA 6 eat into your trading time!

Best,
Michael
Founder, ZeroGEX

## Follow-up 3: Jed's feedback after buying (Fri Nov 20, 1:25 PM)

Same thread, answering your email after his purchase:

> Michael, Love the tools you created. I want to start with that. Its fantastic
> and i see a lot of work went into it.
>
> Now I want to give some feedback as you have asked for it which is good as
> many can not take constructive criticism anymore.
>
> The issues I will touch on or easy resolutions.
>
> 1. As much information you have provided and its very detailed its also an
>    issue. Its lmost too long. The reason I say too long is in the articles we
>    have no pictures of the charts pointing to what you are discussing. So when
>    someone is trying to learn and having to switch tabs in a browser it will
>    cause some people to lose focus. I find myself very focused and it even
>    distracts me. Solution is to simplify the articles if possible and put some
>    pictures of what is being discussed. In the diagram show where to click on
>    the sidebar then show the information you are discussing in the picture.
> 2. The other issue is maybe show some trades on how to use the information
>    with pictures. Show a debit and credit vertical, show a butterfly, show an
>    iron condor to get people to understand. Show when its possible to
>    speculate late in day with a far OTM call our put for a squeeze.
> 3. All of this can be resolved with videos, make short 5 to 10 minute videos
>    discussing theory and basics then the tools itself with trades. Its a lot
>    and like I stated with time it will be so very helpful. Thats what makes
>    unusual whales and some of these others successful is there education.
>    They keep it somewhat short and have videos. Some vids are long others
>    short and to the point. Many people are visual learners.
> 4. And last one is a community. A community is important. People tend to
>    teach one another. We discussed this already.
>
> And thats it!!! Thats my feedback. You have a solid foundation with your tools
> and I would say the best in business. And for the price its a no brainer.
> Again great job and so happy i found you.
>
> Jed

### Check first: did checkout apply the sale?

His purchase is the first live test of the sale at checkout.

```bash
make diagnose-user EMAIL=the_real_scientist_1@proton.me
```

The `Discounts` line should read `ZGX_BLACK_FRIDAY_2026_50_OFF_12M — 50% off for
12 months`. For Pro annual, `MONEY EVER COLLECTED` should come to $149.50 (that
total comes from Stripe's invoice history, which syncs on a timer, so it can
lag; the discount line is the one that settles it). If `Discounts` says `none`,
he paid $299: refund the $149.50 difference in Stripe before replying (his plan
stays as it is), and flag it, because checkout should have applied the sale.

### The read

- **He's right, and the numbers back him.** 35 of the 42 English articles have
  no pictures, they average about 1,900 words (8 to 9 minutes of reading), and
  none walks through a vertical, a butterfly or an iron condor. The seven with
  pictures (gamma exposure, gamma walls, reading the gamma flip, max pain, vanna
  and charm, hedging flow, 0DTE dealer positioning) already use the format he's
  asking for: a screenshot of the tool next to the text about it.
- **Short videos are already planned.** `core/quickStarts.ts` lists 25
  walkthroughs of 1:30 to 3:20, from "ZeroGEX in 90 seconds" to "Strategy
  Builder walkthrough" and "Running your first backtest". None is recorded, so
  the Quick Start page stays hidden. The draft says they're planned, with no
  date.
- **What the draft commits you to:** pictures in the articles and worked trade
  examples for the trades he named, with no dates. Videos are "planned" and the
  community is "on my list", the same answer as last time. Cut any of it you
  don't want to promise.

### Draft reply

Same thread.

Hi Jed,

Thank you for taking the time to write all this out. Feedback this specific is rare, and it's exactly what I need.

You're right about the articles. They run long, and most of them explain a chart without ever showing it, so you end up reading in one tab and hunting for the tool in another. I'm going to add pictures: the tool being discussed, where to find it in the sidebar, and what to look at. I'll trim them where I can, too.

The trade examples are a great idea, and today there aren't any. I'm going to put together worked examples from real days, with pictures: credit and debit verticals set against the walls and the gamma flip, a butterfly at the pin, an iron condor between the walls, and the late-day squeeze setups you mentioned for far out-of-the-money calls and puts.

Short videos are already planned, from a 90-second tour of the platform to planning a trade from the open, and your note moves them up. And I agree on community: people teach each other a lot, and it's still on my list.

Thanks again for the kind words. I'm really glad you found us too. If anything else gets in your way as you dig in, just tell me.

Best,
Michael
Founder, ZeroGEX
