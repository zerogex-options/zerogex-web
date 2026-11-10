# Corey: a futures scalper on Bookmap, and "too many signals" (2026-11-10)

Corey Savage replied at 14:42 to the cancellation thread ("Re: ZeroGEX
Cancellation"):

> I actually did enjoy your software but I am primarily a futures scalper. I
> use a lot of bookmap. I looked at your software often to try to find any edge
> for futures but nothing really helped with that (maybe you have some
> recommendations). There is def a lot in your platform but overall I did
> think it was easy to navigate but it seemed like quite a lot of signals. When
> I thought I found one signal I liked I saw another that contradicted it in
> the platform. But I do think you're on to something. I will continue to
> monitor your software and let me know if you have any recommendations on how
> to better utilize for futures.

Each paragraph in the draft is a single line, so it pastes straight into a mail
client.

From `make diagnose-user EMAIL=savage.corey@gmail.com` (run 2026-11-10):

| | **savage.corey@gmail.com** |
|---|---|
| User id | `user_e03e0f6addb7aa4f385baf73` |
| Came from | organic/direct |
| Plan | Pro monthly, $59 (trial Jun 13, first charge Jun 20) |
| Paid so far | 5 invoices, $235 total ($39 × 3, then $59 × 2) |
| Canceled | Thu Nov 5, 6:54 PM ET, in-app, reason `switched_service` |
| Access | until **Fri Nov 20, 1:18 PM ET** (18:18 UTC) |
| Last seen | Nov 5, the day he canceled |

## The read

- **He asked a direct question, so the reply is the answer.** No discount, no
  save pitch. Price isn't the complaint, and the cancellation email already
  carried the save button. Same call as Claudiu
  (`2026-10-05-claudiu-gamma-not-directional.md`).
- **The contradicting signals are real, and by design.** There are a lot of
  signal pages (Basic, Advanced, Trade Bias, the Composite Score), and per
  `content/help/platform/signals-overview.md` the Basic signals are *meant* to
  disagree sometimes ("their value is in agreement or disagreement"). That is
  useful to an options trader reading the session, and noise to a scalper. So
  the reply tells him to skip them, rather than defend them.
- **The levels are the part that carries over to futures.** ES levels are the
  SPX book projected onto the ES price at fair value, and MES uses the same
  levels (`content/help/platform/data-coverage.md`).
- **Bookmap is the hook.** There is no Bookmap integration, but the pairing is
  natural and is how a Bookmap trader already thinks: ZeroGEX says *where*
  dealer hedging is heaviest, Bookmap shows *what's happening* when price gets
  there (liquidity holding or pulling, aggressive orders). The draft is built
  around that.
- **Three lines, not four.** Rod's email had four levels, with the pin strike.
  Corey's complaint is too much on the screen, so the draft keeps the call wall,
  put wall and flip. The pin is an into-the-close level, which matters less to
  a scalper.
- **The flip is mode, not direction** (Claudiu's lesson): above it, fade the
  edges; below it, go with breaks.
- **Honest base rate.** Same figure you gave Rod and Michael Nash: across 737
  wall tests, S&P walls held about two in three over the next hour, Nasdaq
  about half (`content/articles/how-often-do-gamma-walls-break.md`). We don't
  know whether he trades ES or NQ, so the draft says ES is the better fit.
- **Overnight.** A futures scalper trades Globex. SPX options only trade 9:30 to
  4:00 ET, so overnight he's trading against the prior 4:00 PM levels. Say it
  before it surprises him.
- **The free morning email keeps him in touch**, which is what he offered ("I
  will continue to monitor"). The signup is on `/es-gamma-levels`; it goes out
  at 8:47 AM ET on trading days (`deploy/systemd/zerogex-web-daily-levels.timer`)
  with the walls, flip, max pain and net GEX for six symbols, ES included,
  led by the symbol he picks (`core/dailyLevelsDigest.ts`). Before the open
  those are the same numbers the live dashboard shows, since the levels aren't
  recomputed until 9:30. During the session they move, which is what the paid
  dashboard adds. That's the one light reason to come back, stated as a fact.
- **The Bookmap question is optional.** SpotGamma and MenthorQ both list Bookmap
  integrations (our own comparison articles say so), so he won't be the last to
  ask. Keep the paragraph only if you'd actually consider building one; asking
  and then not building is worse than not asking.

- **He has ten days of Pro left**, so the draft invites him to try this now,
  with nothing new to pay. That's the whole retention move. No discount: he
  picked "switched service", and his email says the switch is Bookmap, not a
  cheaper GEX tool.
- **The free email is for after the 20th.** The signup isn't tied to an
  account (`docs/daily-levels-email.md`, "Why not a user row"), so his own
  address works.

## Before sending

1. **The Bookmap paragraph** (marked optional). Cut it unless you'd build it.
2. **If you send after Nov 20**, cut the access line and the "After the 20th"
   lead-in.

## Draft

**Reply in the same thread.**

Hi Corey,

Thanks for writing back, and for being straight with me. The point about one signal contradicting another is fair, and it's the most useful thing you could have told me.

For futures scalping, here's what I'd do: skip the signal pages entirely. They read the whole market over the session, so on a scalper's timeframe they'll disagree with each other and with what you see on the tape. The part that carries over to futures is the levels. Let Bookmap handle the timing.

1. Before the open, mark three ES prices on your Bookmap chart: the call wall, the put wall and the gamma flip. These are where dealer hedging is heaviest. ZeroGEX converts them from the SPX options to ES prices, and they apply to MES as is.
2. Use the flip to set the day's mode, not direction. Above it, dealer hedging leans against moves, so ranges tend to stay tighter and fading the edges works better. Below it, hedging adds to moves, so breaks tend to run.
3. When price gets to a wall, that's when you watch Bookmap. If liquidity stacks up and absorbs the move there, that's your fade. If it pulls and aggressive orders push through, especially below the flip, that's the break to go with.

The short version: ZeroGEX tells you where to pay attention, and Bookmap tells you what's happening once price gets there.

You still have full access until Friday, Nov 20, so if you want to try it this way before then, it's all there.

A few things worth knowing:

- It works better on ES than NQ. In our study of 737 wall tests this summer, S&P walls held about two times in three over the next hour, and Nasdaq walls about half. So treat a wall as a place to expect a reaction, not a guarantee.
- The levels come from SPX options, which only trade 9:30 to 4:00 ET. Overnight and pre-market, you're trading against the levels as of the prior 4:00 PM close.

After the 20th, if you want to keep an eye on them for free, there's a morning email at 8:47 AM ET each trading day with the ES walls and flip, in time to plot them before the open. You can sign up at the bottom of this page: https://zerogex.io/es-gamma-levels. During the session the levels shift as price moves, and that's what the live dashboard keeps current.

[Optional, keep only if you'd build it:] One question back: would it change things for you if the levels drew themselves on your Bookmap chart and stayed current, the way they already do in NinjaTrader and Sierra Chart?

Thanks again, Corey. I'd love to hear how it goes.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **"Which screen should I look at if I come back?"** The Gamma Terminal on ES
  (`https://zerogex.io/chart?symbol=ES`): walls and flip on ES candles, plus the
  strike ribbons (gold means hedging leans against moves at that strike, violet
  means it adds to them). Tell him to build My Dashboard with just that and the
  ES levels, nothing else. The ribbon reading, including the correction about
  lanes swelling near price, is in `2026-10-12-rod-futures-youtube.md`.
- **"Do you have order flow or delta on ES?"** Not as a product. The feasibility
  note is `zerogex-oa/docs/design/futures-aggressor-delta.md`. Don't promise it;
  Bookmap already does that better for him.
- **"Yes to Bookmap."** That's a build decision, not a reply. Note his name as
  demand and answer honestly about timing.
- **"Your levels don't match my chart."** A few points is fair value versus
  where ES actually trades. Hundreds of points means his chart is on a
  different contract month
  (`https://zerogex.io/help/platform/futures-contract-months`). The December
  roll is around Dec 11.
- **"A wall broke on me."** About one in three ES wall tests break within the
  hour, and nothing in the study (flip side, wall size, flow) predicted which
  ones. That's why the draft pairs the wall with what Bookmap shows at it.
