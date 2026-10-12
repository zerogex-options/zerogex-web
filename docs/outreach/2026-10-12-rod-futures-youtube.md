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

---

## Follow-up: the ribbon readout (Mon Oct 12, 2:36 PM)

Rod's group is "kicking the idea around" for the channel and will report back
(Sun 11:25 PM; Michael replied "Sounds great!" Mon 7:40 AM). Then Rod sent an
ES Gamma Terminal screenshot with the crosshair card's ribbon section circled
(`RIBBON · 7,848.25 STRIKE`, `Net dealer Γ +$3.07B`,
`Long Γ · magnet / brake strong · 99%`, `share of the heaviest strike on
screen`) and asked:

> on the screenshot the ribbon has long magnet /brake then strong 99% can you
> explain that and how it changes at different time lines?

### What the card actually says (from the code)

All in `components/GammaTerminalChart.tsx` (`hoverRibbon` and the tape card)
and `core/gexRibbons.ts`:

- **The row is about one strike, not the market.** The nearest strike lane to
  the cursor (within half a strike step), in the 5-minute bucket the hovered
  bar falls in. "Long Γ · magnet / brake" is just the sign: positive net
  dealer gamma at that strike. Negative reads "Short Γ · accelerant".
- **99% is relative, not absolute.** |net gamma| divided by the largest
  |net gamma| of any orb drawn on screen (all visible bars, all strikes in the
  visible price range). Tiers from `tierFor`: strong ≥ 50%, mid 15–50%, weak
  under 15%; under 5% isn't drawn and the card says "under floor".
- **Timeframes.** The data is always the 5-minute strike-profile timeseries.
  A 1-minute bar shares its bucket with four neighbors; a 15-minute or hourly
  bar reads the bucket at its own start (not an average). So the dollar figure
  is timeframe-independent, but the % and the tier move with whatever the
  timeframe, zoom and scroll put on screen.
- **Expiry filter.** The ribbons follow it (`railExpParam`), so 0DTE-only
  ribbons are a different book from all expirations.
- **The red −$3.57B line above it** is the "STRIKE Γ NEAR" readout: the
  Gaussian-smoothed net-gamma density at the cursor price, which sums
  neighbors whose signs alternate, so it can disagree with one strike. The
  card already says it's not the regime; the shaded band is.
- **In his screenshot the strike was also the put wall** (`PUT WALL 0.56
  away` from the cursor at 7,848.81 puts it at 7,848.25) and price had just
  slid down into it. That's the teaching moment, without claiming it held.

"Different time lines" is ambiguous: chart timeframe, through the session,
or expirations. The draft covers all three in one bullet each.

### Draft

**Reply in the same thread.**

Hi Rod,

Good question. That line describes the single strike under your cursor, at that moment:

- **Long Γ · magnet / brake:** dealers are net long gamma at that strike, so their hedging sells into rallies and buys dips there. Price tends to get pulled toward it and slow down at it. Those are the gold orbs. Violet orbs are the opposite, "Short Γ · accelerant": there, hedging chases price, so moves through that strike tend to speed up.
- **strong · 99%:** how big that strike is compared with the heaviest strike on your screen. 99% means it's essentially the biggest one in view. Strong is 50% and up, mid is 15–50%, weak is under 15%.

In your screenshot that strike was also the put wall, and price had just slid into it. That's a spot where you'd expect price to slow down or chop rather than slice through. Not a guarantee, but that's what the ribbon is telling you.

How it changes:

- **Through the day:** each orb is that strike's gamma for a 5-minute window. A lane getting fatter means positioning is building at that strike, thinning means it's fading, and gold turning violet means the strike went from brake to accelerant.
- **Across timeframes:** the data underneath is the same. On a 1-minute chart, five bars share each reading. On 15-minute or hourly, each bar shows the reading at its start. The dollar figure doesn't change with the timeframe, but the % and strong/mid/weak can, because they're measured against whatever is on screen. Zoom out and a bigger strike may come into view, which shrinks the rest.
- **Across expirations:** the Expiry filter changes the ribbons too. Pick only today's expiration and you see just the same-day positioning.

One last thing: the red -$3.57B line above it is a smoothed total of the strikes around your cursor, so it can disagree with a single strike. Neither one is the overall regime. For that, use the shaded background, which shows which side of the flip price is on.

Happy to walk through this live whenever you and the guys are ready.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

---

## Follow-up: "was the fattening ribbon the reversal signal?" (Mon Oct 12, 4:57 PM)

Rod sent an ES 5-minute Gamma Terminal screenshot (expiry filter on) with the
top gold lane circled, around 7,868.5, where price rallied to about 7,866
late in the morning, stalled, and dropped about ten points:

> so the ribbon growing fatter as the spot approached that strike price was a
> potential signal for the reversal that happened. Can you walk me through
> your thoughts on that? This is were some videos would help so much
> understanding this a little better in my opinion,

### The read

- **His chart is a clean long-gamma brake.** The heaviest gold lane on screen,
  price walks up into it, stalls two or three points short, reverses. Say so.
- **But the swelling isn't positioning, and our last email said it was.** The
  previous reply carried the in-app guide's line "a lane getting fatter means
  positioning is building". Per-strike dollar gamma is
  `gamma × OI × 100 × S² × 0.01` (`content/methodology.md`), OI is an
  end-of-session clearing figure, and the GEX engine doesn't re-weight it with
  intraday flow (`/education/pin-strike-explained`, "Why 0DTE only, and why
  open interest"). So within a session a lane fattens mainly because gamma
  peaks at the money: any strike swells as price nears it and thins as price
  leaves. Measured off his screenshot, the lane's orbs roughly double in the
  circled stretch and collapse to a sliver once price falls away. The reply
  owns the correction in one paragraph.
- **What actually made it a spot to watch:** the strike was already the
  heaviest on screen, it was gold, and price was walking into it.
- **Don't promise reversals, and don't borrow the wall study here.** The
  7,868.5 lane isn't the labeled call wall (that's 7,858.25 on his chart), so
  the "two in three" figure doesn't apply to it.
- **The video ask is a gift.** His screenshot is a ready-made first example;
  the reply asks to use it.

### Draft

**Reply in the same thread.**

Hi Rod,

You read that chart well. Price ran up under the heaviest gold lane on the screen, stalled a couple of points below it, and reversed. That's the long-gamma brake doing its job: dealers' hedging at that strike sells into strength, and the closer price gets, the harder it leans.

One correction to my last email. I said a lane getting fatter means positioning is building. During the day, that isn't really what it shows. The positions behind the ribbon (open interest) are only updated once a day, after the close. What changes intraday is how much hedging those same positions need, and that peaks when price is right at the strike. So a lane will usually swell as price approaches it and thin as price moves away. You can see the second half in your chart: once price dropped, that lane faded fast.

So the swelling on its own isn't the signal. What made that spot worth watching was three things lining up:

1. That strike was already the heaviest lane on your chart before price got close.
2. It was gold, so hedging there leans against the move. A violet lane would have meant the opposite: if price pushed through, hedging would add to the move rather than fade it.
3. Price was walking straight into it.

It won't work every time. Price pressing into a heavy gold lane is a reason to tighten up, or to look for a fade once the candles confirm it. It isn't a guaranteed reversal.

And I agree, this is exactly where a video would help. Your chart is a perfect example. Would you mind if I used it in one?

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
