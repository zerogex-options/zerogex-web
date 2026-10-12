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
  them current (`docs/integrations.md`). The draft links the `/integrations`
  hub rather than both pages.
- **The YouTube offer: say yes, make the next step a call.** A walkthrough
  with ES and NQ on screen before they record anything. It also tells Michael
  what a video guide should cover.
- **No affiliate pitch yet.** Per `docs/creator-partner-outreach.md`, the link
  and commission come after there's a channel to put it on.

## Draft

*Revised 2026-10-12: levels first, especially ES; then cut to about half
length. The longer version is in this file's git history.*

**Subject:** Re: What's new at ZeroGEX, and our first Folds of Honor donation

Hi Rod,

Yes to the YouTube channel. I'd love to take you up on that, and I really appreciate the offer. It means a lot.

For ES and NQ, focus on the levels: the call wall, put wall, gamma flip and pin strike. They're at their best on ES. Across 737 wall tests this summer, S&P walls held about two times in three over the next hour, versus about half for Nasdaq.

Treat them as context, not entry signals:

- **Gamma flip:** above it, moves tend to get dampened and ranges stay tight. Below it, moves tend to run. It isn't bullish above and bearish below. It tells you whether to fade moves or go with them.
- **Call and put walls:** where price tends to stall, as resistance and support. Below the flip, a break can run further.
- **Pin strike:** where price tends to get pulled into the close, mostly when it's above the flip. A dash means nothing is pinning that day.

For a week or two, keep ES on the dashboard next to your chart and watch what price does at each level. You'll build your own feel for it quickly. The same levels apply to MES, and overnight they're as of the U.S. close. Since you're on Pro, you can also plot them live on your chart in NinjaTrader or Sierra Chart: https://zerogex.io/integrations

Two short reads if you want them:
https://zerogex.io/education/gamma-walls-explained
https://zerogex.io/education/how-to-read-a-gamma-flip

On the channel, let's start with a call. I'll walk you and your buddies through the platform with ES and NQ on screen, and you can ask me anything before you record. Send me a few times that work.

Thanks again, Rod.

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
  the exercise working, not failing. Above the flip the market can still
  fall; it just tends to do it in a contained way.
- **He asks why a wall broke.** Point him at the study's base rate: on ES
  about one test in three breaks within the hour, and nothing we measured
  (flip side, wall size, flow) predicted which ones. A wall is a prior, not a
  promise.
