# Rod: where an ES/NQ trader should start, and a YouTube offer (2026-10-12)

Rod Deisler (Pro) replied to the October product-update email. Earlier in the
thread he said video guides would help; Michael agreed and pointed him at the
education hub. Rod's reply, Sun Oct 11, 9:21 PM:

> no problem . I am a futures trader mustly NQ ans ES as well. Based on your
> opinion what would be the best thing to focus on using your platform? I
> really want to learn it well. I have a few other buddies the have asked me to
> start a youtube channel with them. It would be cool to be able to do
> something possibly showing the zerogex platform. Let me know?

Michael wants to take him up on the YouTube offer, and wants the answer to
center on the levels (call wall, put wall, pin strike, flip), especially for
ES.

## The read

- **Lead with the four levels, and say why ES.** The case for ES is our own
  wall study (`/education/how-often-do-gamma-walls-break`): over 737 tests,
  S&P walls held about two times in three within the hour, Nasdaq walls about
  half. That's a reason Rod can check, not a claim to take on trust.
- **Carry Claudiu's lesson inside the flip bullet**
  (`2026-10-05-claudiu-gamma-not-directional.md`): above or below the flip is
  how moves behave, not which way. Rod is asking before he trades it, so this
  is a head start rather than a post-mortem.
- **Don't say walls hold more often above the flip.** The study tested that
  and it didn't predict breaks. What the flip changes is what happens around
  the wall: hedging leans against the move above it and adds to a break below
  it. The draft says exactly that.
- **Pin strike is an into-the-close, above-the-flip level**, and a dash is a
  real answer (`/education/pin-strike-explained`). ES rides on SPX, which has
  same-day expirations every day, so it's there to use.
- **Two futures facts from `/help/platform/data-coverage`:** ES/NQ levels come
  from the SPX/NDX books projected onto the futures price (MES/MNQ use the same
  levels), and overnight they're as of the U.S. close.
- **He's on Pro, so point him at the chart indicators.** NinjaTrader and Sierra
  Chart plot the flip, walls, max pain and pin strike on an ES chart and keep
  them current (`docs/integrations.md`). Asking which platform he uses also
  sets up the call.
- **The YouTube offer: say yes, make the next step a call.** A walkthrough
  with ES and NQ on screen before they record anything. It also tells Michael
  what a video guide should cover.
- **No affiliate pitch yet.** Per `docs/creator-partner-outreach.md`, the link
  and commission come after there's a channel to put it on.

## Draft

*Revised 2026-10-12: levels first, especially ES.*

**Subject:** Re: What's new at ZeroGEX, and our first Folds of Honor donation

Hi Rod,

Yes to the YouTube channel. I'd love to take you up on that, and I really appreciate the offer. It means a lot. More on that at the end.

For ES and NQ, I'd focus on the levels: the call wall, the put wall, the gamma flip and the pin strike. They're the heart of the platform, and they're at their best on ES. We measured it this summer across 737 wall tests: when price tested an S&P wall, the wall held about two times in three over the next hour. Nasdaq walls held about half the time. The levels work the same way on NQ, but a wall there is closer to a coin flip, so give it less weight.

The one thing to know before you trade them: they're context, not triggers. They tell you where price is more likely to stall, chop or run, not when to get in. Here's how I read each one:

- **Gamma flip:** the line between two kinds of market. Above it, dealers' hedging tends to sell rallies and buy dips, so moves get dampened and ranges stay tighter. Below it, their hedging tends to buy rallies and sell dips, so moves keep going in whichever direction they start. It isn't bullish above and bearish below. ES can sell off above the flip and rally hard below it. What it tells you is whether to fade moves or go with them, and how much room your stops need.
- **Call wall and put wall:** the strikes above and below price with the most call and put gamma. They tend to act as resistance and support. Above the flip, hedging leans against a move into a wall, which can slow price down or pin it there. Below the flip, if a wall gives way, hedging adds to the break instead of fading it.
- **Pin strike:** where the same-day options are most likely to pull price into the close. It matters most in the last hour or two, when price is above the flip. When it shows a dash, nothing is pinning that day, and that's worth knowing too.

Here's how I'd learn them. For a week or two, keep ES up on the dashboard next to your chart. Before the open, note which side of the flip price is on and where the walls are. During the day, watch what happens when price reaches a wall: does it stall, or does it break and run? Into the close, watch the pin strike. It won't play out the same way every day, because these are tendencies and not rules, but after a couple of weeks you'll have your own feel for how ES behaves around each level.

Two things specific to futures:

- The ES levels come from the S&P 500 options and the NQ levels from the Nasdaq 100 options, carried over onto the futures price for you. MES and MNQ use the same levels.
- Those options trade during U.S. hours, so overnight you're trading against the levels as they stood at the close, not a fresh read.

Since you're on Pro, you can also put the levels right on your ES chart and have them update on their own, in NinjaTrader (https://zerogex.io/ninjatrader-indicator) or Sierra Chart (https://zerogex.io/sierra-chart-indicator). TradingView and thinkorswim don't let scripts pull in data, so there it's a free script you type the day's levels into. Which platform do you chart on?

If you want to read up, in this order:

1. https://zerogex.io/education/how-to-read-a-gamma-flip
2. https://zerogex.io/education/gamma-walls-explained
3. https://zerogex.io/education/how-often-do-gamma-walls-break (the study behind the ES and NQ numbers above)
4. https://zerogex.io/education/pin-strike-explained (the "When Pin Strike comes into play" section is the practical part)

On the channel: I'd be glad to help however I can. A good first step would be a call with you and your buddies where I walk through the platform with ES and NQ on screen and you can ask me anything, before you record a thing. Send me a few times that work for you. You're already on Pro, so you have everything you'd want to show.

Thanks again, Rod. I'm looking forward to this.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He sends times for a call.** Nothing to set up on the account; he's on
  Pro. Have ES open on the dashboard and on whichever chart platform he named.
- **He asks about a link or code for viewers.** That's the affiliate setup in
  `docs/creator-partner-outreach.md`, stage 5b. FTC disclosure applies once
  they mention it on the channel.
- **He comes back with "price was above the flip and ES sold off".** That's
  the exercise working, not failing. The answer is in the flip bullet: above
  the flip the market can still fall, it just tends to do it in a contained
  way.
- **He asks why a wall broke.** Point him at the study's base rate: on ES
  about one test in three breaks within the hour, and nothing we measured
  (flip side, wall size, flow) predicted which ones. A wall is a prior, not a
  promise.
