# Rod: where an NQ/ES trader should start, and a YouTube offer (2026-10-12)

Rod Deisler replied to the October product-update email. Earlier in the
thread he said video guides would help; Michael agreed and pointed him at the
education hub. Rod's reply, Sun Oct 11, 9:21 PM:

> no problem . I am a futures trader mustly NQ ans ES as well. Based on your
> opinion what would be the best thing to focus on using your platform? I
> really want to learn it well. I have a few other buddies the have asked me to
> start a youtube channel with them. It would be cool to be able to do
> something possibly showing the zerogex platform. Let me know?

Michael wants to take him up on the YouTube offer.

## The read

- **The answer is the same one Claudiu needed** (`2026-10-05-claudiu-gamma-not-directional.md`):
  learn the gamma regime first, and learn that it describes how moves behave,
  not which way they go. Claudiu learned that by losing trades on US100. Rod is
  asking before he trades it, so this is the same lesson as a head start rather
  than a post-mortem. The bullets and the range-day/trend-day exercise are
  carried over nearly word for word.
- **Two futures facts he should hear now**, both from
  `/help/platform/data-coverage`: NQ levels come from the NDX book and ES from
  SPX, projected onto the futures price (MNQ/MES use the same levels); and
  overnight the levels are as of the U.S. close, not a fresh read. A futures
  trader who trades Globex will otherwise find this out the hard way.
- **The YouTube offer: say yes, make the next step a call.** The cheapest,
  most useful thing Michael can give is a walkthrough with NQ and ES on screen,
  before they record anything. It also tells Michael what a video guide should
  cover, which is on his list anyway.
- **Access is promised loosely on purpose.** The draft says his account will be
  able to show whatever they want to show, not "free Pro for 90 days". Rod's
  tier isn't known from the thread, and the right mechanism differs (see Verify
  first). Decide after the call.
- **No affiliate pitch yet.** Per `docs/creator-partner-outreach.md`, the
  link and commission come after they've used it and there's a channel to put
  it on.

## Verify first

- **Run `make diagnose-user EMAIL=<Rod's email>`.** If he has no paid plan, the
  exercise paragraph points at a dashboard he can't open: swap "pull up NQ on
  the main dashboard" for the free, delayed page at
  https://zerogex.io/nq-gamma-levels (and drop "the Long γ / Short γ chip in
  the Key Levels strip"; say "the gamma flip, and whether NQ is above or below
  it" instead).

## Draft

**Subject:** Re: What's new at ZeroGEX, and our first Folds of Honor donation

Hi Rod,

Yes to the YouTube channel. I'd love to take you up on that, and I really appreciate the offer. It means a lot. More on that at the end.

For NQ and ES, the one thing I'd focus on first is the gamma regime: whether the market is in long gamma or short gamma. Everything else on the platform builds on it.

The most common trap is reading it as a direction call, as if long gamma means bullish and short gamma means bearish. Neither is true. The regime tells you how the market is likely to move, not which way.

- **Long (positive) gamma:** dealers' hedging tends to sell rallies and buy dips. Moves get dampened, ranges stay tighter, and price tends to come back toward the middle. Fading the extremes works better and chasing breakouts works worse. The market can still drift lower in long gamma.
- **Short (negative) gamma:** dealers' hedging tends to buy rallies and sell dips, so moves keep going in whichever direction they start. Ranges get wider and trends follow through. The market can rally hard in short gamma.

So it isn't telling you to buy or sell. It answers a different question: should I fade moves today or go with them, and how much room do my stops need?

Here's how I'd learn it. For a week or two, pull up NQ on the main dashboard before the open and note whether the Long γ / Short γ chip in the Key Levels strip says long or short. At the close, ask one question: was today a range day or a trend day? Ignore the direction. It won't match every day, because it's a tendency and not a rule, but after a couple of weeks you'll have your own feel for what it's telling you. Once that clicks, add the gamma flip (the level where the regime changes) and the call and put walls (where moves tend to stall).

Two things specific to futures:

- The NQ levels come from the Nasdaq 100 options and the ES levels from the S&P 500 options, carried over onto the futures price for you. MNQ and MES use the same levels.
- Those options trade during U.S. hours, so overnight you're trading against the levels as they stood at the close, not a fresh read.

If you want to read up, in this order:

1. https://zerogex.io/education/what-is-negative-gamma (especially "Common misconceptions" near the end)
2. https://zerogex.io/education/gamma-exposure-explained
3. https://zerogex.io/education/how-to-trade-around-gamma-flip

On the channel: I'd be glad to help however I can. A good first step would be a call with you and your buddies where I walk through the platform with NQ and ES on screen and you can ask me anything, before you record a thing. Send me a few times that work for you. And whatever you'd want to show on the channel, I'll make sure your account can show it.

Thanks again, Rod. I'm looking forward to this.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He sends times for a call.** Before it, run `make diagnose-user` and decide
  access. If he has no paid plan, the Creator Partner grant is the established
  path: `make grant-partner-pro EMAIL=<email> DRY_RUN=1`, then `YES=1` (90 days
  of Pro; see `docs/creator-partner-outreach.md` for the promo code and what to
  say on activation). If he's already paying, read the dry run's planned
  changes before applying anything: the grant doesn't touch his Stripe
  subscription, so he'd keep being billed.
- **He asks about a link or code for viewers.** That's the affiliate setup in
  `docs/creator-partner-outreach.md`, stage 5b. FTC disclosure applies once
  they mention it on the channel.
- **He comes back with "it said long gamma and NQ sold off".** That's the
  exercise working, not failing. The answer is the last line of the long gamma
  bullet: it can still drift lower, it just tends to do it in a contained way.
