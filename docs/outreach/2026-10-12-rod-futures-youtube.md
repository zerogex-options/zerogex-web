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

---

## Follow-up: TradeGEX's videos, and the ORB Breakout Map (Tue Oct 13, 9:21 PM)

> Hey MIcheal just wanted to give you a heads up. I had spoken with tradegex
> and use is prior to learning of your Site. I had told then the same about
> they should create some videos. Just a FYI they lunched some new videos
> today on there youtube channel that look promising. I am reviewing them.
> THis would be a great addition to your education page. Just giving you
> honest feedback. I really do like zerogex especially how you calculate your
> call and put walls they seem much more on point. Also do you have any more
> info on the ORB breakout map?

He attached My Dashboard's ORB Breakout Map and ORB Breakout tiles for ES on
Oct 13: ORB High 7,861.00, ORB Low 7,845.25, range 15.75, status "Near high"
while price sat mid-range.

### The read

- **TradeGEX is a heads-up, not a threat.** He's comparing, and he says the
  walls are why he's here. Thank him, agree on videos, don't name them, and
  don't call them copycats in writing (Michael asked; see below).
- **Why our walls look "more on point" to him:** per
  `content/articles/zerogex-vs-tradegex.md`, TradeGEX's key-levels guide puts
  its walls at the most raw call/put open interest; ours weight OI by gamma.
  The reply says what we do, without naming them.
- **What the ORB is** (backend `src/api/queries/technicals.py` in
  zerogex-oa, `get_technicals_timeseries` and `get_opening_range_breakout`):
  high and low of the symbol's own 1-minute bars from 09:30 to 09:59 ET, held
  flat for the rest of the day. For ES that's ES's own price, not SPX. No
  options data in it.
- **Status rules, in order:** close above the high = Breakout; below the low
  = Breakdown; `close >= high × 0.998` = Near high; `close <= low × 1.002` =
  Near low; else Inside.
- **That "near" band is broken on ES.** 0.2% of 7,861 is 15.7 points, and his
  range was 15.75, so every close inside the range read "Near high". Because
  Near high is tested first, once the range is under about 0.4% of price
  "Inside" can't appear and "Near low" is crowded out. ES's 30-minute range is
  often in that zone, as are SPX and SPY's. The reply owns it and says it's
  being changed to a fraction of the range. **That needs the backend fix**
  (both CASE blocks in `technicals.py`, and the `opening_range_breakout` view
  in `setup/database/schema.sql` if it carries the same rule). If you'd rather
  not commit to it, cut the "I'm changing it" sentence.
- **Small display nit, not for Rod:** the tiles print ES values with a `$`
  ("$15.75" is 15.75 points, $787.50 a contract). Fine to leave.

### Draft

**Reply in the same thread.** Adjust the videos line if "moves them up my
list" isn't true.

Hi Rod,

Thanks for the heads up, and for the honesty. You're right about videos, and hearing it again moves them up my list. I'm really glad the walls are landing for you. That's by design: we weight each strike's open interest by its gamma, so a big block of contracts sitting far from price doesn't get to define the wall. The walls land where dealer hedging is most sensitive to a move.

On the ORB Breakout Map: it's the one price-only tool on the page. It doesn't use options data at all.

- It takes ES's high and low from the first 30 minutes of the regular session (9:30 to 9:59 ET) and holds them flat for the rest of the day. That's the band on the chart.
- The cards show those two lines, the size of the range, and a status: Breakout when price is above the high, Breakdown when it's below the low, Near high or Near low when it's within 0.2% of either line, and Inside otherwise.

One honest flag, and your screenshot shows it: on ES, 0.2% is about 15 points, and Tuesday's whole opening range was 15.75. So "Near high" was showing almost anywhere inside the range, which doesn't tell you much. I'm changing it so "near" is measured against the size of the range instead.

It's most useful next to the levels. The range gives you the day's early lines in the sand, and the levels tell you what hedging does if price breaks them. Above the flip, hedging leans against a break. Below it, hedging adds to it. And if a break is heading straight into a wall or a fat gold lane, that's where I'd expect it to get tested.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

### Did TradeGEX copy us? (checked 2026-10-14)

Michael asked whether to tell Rod TradeGEX "plagiarized" ZeroGEX. Don't, in
writing or otherwise, on this evidence:

- **They were public first.** tradegex.pro's first Wayback capture is
  2026-02-28 (domain registered 2025-12-20); zerogex.io's is 2026-04-23
  (registered 2025-11-19). Their YouTube channel dates from 2026-01-15, and a
  TradingView account "tradeGEX" from 2024-09-12.
- **No verbatim copying found** across 7 of their pages and 6 of ours. The only
  long matches are the standard risk disclaimer and stock definitions. Their
  "Gamma Exposure (GEX) Explained" title matches ours, but that's a common
  SEO pattern and the articles differ.
- **"Hedge Flow™" vs our "Hedging Flow":** theirs is dated 2026-02-01 on their
  own page metadata and they mark it ™; ours shipped 2026-09-09. If anything,
  the overlap runs the other way. Low risk, since "hedging flow" is
  descriptive, but don't pick a naming fight.
- "GEX" is common in product names (GEXbot, GEXRadar and others).

Side finding: zerogex.io's registration expires **2026-11-19** (RDAP). Confirm
auto-renew is on at Namecheap.

### Final draft (Wed Oct 14), replacing the one above

Michael held the earlier draft. Since then the "near" fix shipped
(zerogex-oa `claude/orb-near-band`, deployed Oct 14) and the Technicals
rebuild (`claude/technicals-rebuild`) is merged, to deploy after the close on
Oct 14. So the reply can say the ORB flaw is fixed and the new page is
coming. Still no TradeGEX by name, and no "copycat" anything (see above).

Michael sent it before the deploy, so it says both changes go in after
the Oct 14 session.

**Reply in the same thread.**

Hi Rod,

Thanks for the heads up, and for the honesty. You're right about videos, and hearing it again moves them up my list. I'm really glad the walls are landing for you. That's by design: we weight each strike's open interest by its gamma, so a big block of contracts sitting far from price doesn't get to define the wall. The walls land where dealer hedging is most sensitive to a move.

On the ORB breakout map: it's a price-only tool. It takes ES's high and low from the first 30 minutes of the regular session (9:30 to 9:59 ET) and holds them flat for the rest of the day. The status tells you where price is against that range: above the high, below the low, near the high, near the low, or inside.

Your screenshot also caught a flaw, so thank you. "Near" used to mean within 0.2% of the line, which on ES is about 15 points, and Tuesday's whole range was 15.75. So "Near high" showed almost anywhere inside the range. I'm changing it so near means the top or bottom fifth of the range, which scales with the day.

I also rebuilt the Technicals page, partly because of your questions. The opening range now sits on one chart with VWAP, the flip, the walls and the pin, and there's a log of every test and break of the range and whether it held. Both changes go in after today's market session, so you'll see them tomorrow morning.

That's where the range is most useful: it gives you the day's early lines in the sand, and the levels tell you what hedging does if price breaks them. Above the flip, hedging leans against a break. Below it, hedging adds to it.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

---

## Follow-up: "you need an influencer", are you a trader, and GEXbot (Thu Oct 15, 11:19 AM)

Rod, replying to Michael's Oct 14 note (community and education, the
Technicals overhaul):

> I truly believe any site that offers this kind of data will only be VERY
> successful if there are some type of influencer that can take this data
> your site provides and turn it into a actionable strategy ... my goal is to
> learn your site and utilize the tool to make profitable trades that can be
> logged and shown to potential zerogex customers ... are you a trader that
> is using this site to make profitable trades? If so what is the mechanics
> ... ALso look at Gexbot let me know what you think of them I have recently
> had subscriptions to gexbot, spot gamma, tradegex and zerogex ... SO far I
> really like zerogex and tradegex.

### The read

- **He hits every positive signal in the creator playbook**
  (`docs/creator-partner-outreach.md`, stage 7): explicit praise, comparisons,
  substantive questions, and he wants to show ZeroGEX to other traders. Michael
  agrees an influencer is exactly the missing piece and the program exists for
  it, so the reply pitches it, once, lightly.
- **Good candidate, small audience.** His channel isn't live yet, so expect
  little near-term revenue. Cost is close to nothing: commission is paid only
  on conversions. The bigger upside may be his network: the YouTube buddy and
  the platform-hopping traders he talks to. Ask for introductions.
- **He already pays for Pro.** `make grant-partner-pro` also stamps a 90-day
  Pro grant, which adds nothing for a paying member and doesn't pause his
  billing. Run it for the link, code and commission tracking. Comping his
  subscription while he makes content is a separate call.
- **Trade logs and an affiliate link together are a paid endorsement.** He
  has to disclose it, and results should be his full record, not a highlight
  reel. The reply puts that as advice ("log every one"). Before ZeroGEX uses
  his results in its own marketing, get a lawyer's read.
- **Trading answer is Michael's own:** busy, trades occasionally, quick
  in-and-out at wall bounces and rejections; the long-range "trading engine"
  idea is stated as far off with regulatory work in the way.
- **GEXbot: no knocking anyone.** Turn it into a question about why he left
  the others.

### Verify first

- The 25% off / first 3 months audience discount is the playbook's number.
  Confirm the `STRIPE_COUPON_PARTNER_AUDIENCE` coupon in Stripe says the same
  before sending.

### Draft

**Reply in the same thread.**

Hi Rod,

First, thank you. Truly. Your feedback this week has been honest, specific and encouraging all at once, and as a one-person shop, that means more than I can say. It's already made ZeroGEX better; the Technicals rebuild came partly out of your questions.

You nailed it on the bigger picture. The data only goes so far on its own. It takes someone who can turn it into a plan people can follow, and that's exactly why I built a creator partner program. Honestly, I haven't found the right person for it yet.

To your question: I don't trade as much as I used to since starting ZeroGEX. Building it takes most of my time. I still take trades here and there, mostly quick in-and-out trades off a bounce or rejection at the put or call wall: price runs into the wall, stalls or turns, and I take the move off it. On the S&P that's the setup our own numbers favor. In our study, walls held about two times in three over the next hour.

Longer term, and I mean way off, the pipe dream is something like a trading engine: you set up and configure what you want, connect your brokerage, and ZeroGEX trades it for you. There's a lot of regulatory and legal work between here and there, so take it as the very high-level direction, not a plan.

On logging trades: log every one, wins and losses. An honest record convinces people far more than a highlight reel, and I'm happy to help you read the levels as you go.

On GEXbot and the others: I'd rather not knock anyone. We're mostly working from the same options data and making different calls about what to show. The test you're already using is the right one: which one gives you the clearest read you can act on. I'd really like to hear what made you leave the ones you left, because clarity is exactly what I'm working on.

Which brings me back to the creator program. You'd be a natural fit. You'd get your own link and code: anyone who signs up through it gets 25% off their first three months on a monthly plan, and you earn 30% of what they pay for their first 12 months. No commitment and nothing you have to post. If you share it publicly, you'd just say it's an affiliate link. Want me to set it up? And if your buddy with the YouTube experience, or any of the traders you talk to, would be a good fit too, I'd love an introduction.

Thanks again, Rod.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

### If he says yes

He's already registered and verified. Dry run, then apply:

```bash
make grant-partner-pro EMAIL=rldindustries1975@gmail.com PROMO_CODE=<CODE> DRY_RUN=1
make grant-partner-pro EMAIL=rldindustries1975@gmail.com PROMO_CODE=<CODE> YES=1
```

Pick a code he'd say out loud on a video. Then send him the link and code
from the script's output, using the stage 5b wording in
`docs/creator-partner-outreach.md`.
