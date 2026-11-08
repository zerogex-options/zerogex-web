# Nilesh Chand: replaying past days of the Gamma Ladder, and building his own (2026-11-07)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Nilesh Chand (nilesh.chand11@gmail.com) wrote to support@zerogex.io, subject
"Gamma Ladder". He's on Pacific time (his screenshot labels times PT).

> **Status:** first reply sent Sat Nov 7. Second reply (see "Second reply:
> building his own ladder") unsent. Reply in the same thread.

## Thread so far

1. **Sat Nov 7, 3:32 PM, inbound.** Loves the ES and NQ ladders; asks to
   replay Monday, to replay more than one day, and whether an API serves it.
2. **Sat Nov 7, outbound.** The first reply below, sent as drafted except the
   opening line ("Thank you so much, that's great to hear, and it means a lot
   to me."), "Receipts -> Session replay", and the full signature with the
   tagline. **One claim in it was wrong:** `/api/replay/range` averages each
   strike across its expirations rather than summing them (see "Correction").
3. **Sun Nov 8, 11:04 AM, inbound.** He used the API on Saturday, so he's on
   Pro. He's building his own ES and NQ ladder in Python, with the change over
   five minutes and since the open, and asks whether his two-call plan is
   right. Full-time ES futures trader, 3+ years on Gexbot, running both side by
   side for now.

## Correction (Nov 8)

`/api/replay/range`, the Session Replay bars, the two-pin comparison drawn from
them, and Pair Comparison's replay columns do **not** carry the ladder's
per-strike totals. zerogex-oa `get_gex_frames_for_session` takes
`AVG(gbs.net_gex)` per strike over the strike's (strike, expiration) rows, where
the live ladder (`/api/gex/strike-profile-timeseries`) takes `SUM`. Checked on
the live site for ES, Fri Nov 6, 13:20 ET: the five strikes from 7408.5 to
7428.75 each had 12 expirations, and the replay page's value was exactly
the sum divided by 12 (7428.75: −6,499,081,384 summed from the public snapshot
page's rows, −541,590,115 on the replay page). The factor changes from strike
to strike with the number of expirations listed, so the replay's shape is off
as well as its scale. The second reply corrects it. The fix is queued as a
separate task; it is not part of this note.

## First reply: the answer

Yes to both, with nothing to build. Session Replay (`/replay`) opens any
session from about the last two months, ES and NQ included, minute by minute.
Monday Nov 2 is a full session for both. The API serves the same per-strike
data on Pro (per-expiration rows from `/api/replay/frame`; `/api/replay/range`
averages them, see "Correction").

## First reply: the read

- **Lead with Monday's two links.** He asked about one day by name. Two
  clicks answer it.
- **Say how it differs from the ladder.** Replay is one symbol per page, and
  the strikes are bars on a dollar scale, not the ladder's numbered rows. He
  named the dollar figures as what he likes, so he'd notice.
- **Give the three things that bite a back test.** Regular session only. The
  ES and NQ candles in replay are SPX and NDX converted at fair value, not
  traded futures prices (Aaron saw 4.5 to 9.75 points against real ES:
  `2026-10-12-aaron-1dte-levels-and-es-replay.md`). Per-strike data stops at
  about 60 days, and older dates on the list show levels with empty strikes.
- **API: Pro only, and point him at replay, not `/api/gex/historical`.** The
  latter recalculates walls inside the 60-day window and serves stored walls
  outside it, so a long test changes method partway through (same reasoning
  as Aaron's note). It also has no per-strike data, which is what he asked
  for.
- **No promise of a past-date ladder view.** The ES-and-NQ side-by-side
  ladders he likes exist in replay form only for the latest session (Pair
  Comparison).

## First reply: verified

Read from the code on `release` and the live site, 2026-11-07.

- **Monday is there for both.** https://zerogex.io/replay/ES/2026-11-02 and
  https://zerogex.io/replay/NQ/2026-11-02 answer 200 with 380 and 388
  one-minute frames, marked "historical", with per-strike data. The picker
  calls 380 or more a "Full session" (`frontend/app/replay/page.tsx`,
  `sessionLabel`).
- **Replay is free and public.** `/replay/*` is on the public route list
  (`frontend/core/auth.ts`), and the landing page says "Free, no login". It
  lists up to 60 sessions per symbol (`/api/replay/sessions?...&limit=60`).
  The menu entry is **Receipts → Session replay**
  (`frontend/core/navigation.ts`).
- **Rewind only covers today.** It reaches back as far as the chart's gamma
  history, about six and a half hours (`/help/platform/gamma-terminal`,
  "Rewind"). Its "full session" link only appears when that floor is after the
  open, and only goes to today's replay (`GammaTerminalChart.tsx`,
  `rewindFloorLabel`), so the draft gives links instead.
- **What a replay shows.** Candles beside the per-strike profile on one price
  axis; Call Wall, Put Wall, Gamma Flip, Max Pain and Pin Strike per minute;
  All, 0DTE or the coming Friday's expiry; two pins for a strike-by-strike
  difference (`frontend/app/replay/[symbol]/[date]/page.tsx`, "How to use").
  The main chart has no per-strike number on hover, only a ± dollar scale
  (`ReplayScrubber.tsx`); the two-pin difference chart does show values.
- **ES and NQ replay is SPX and NDX, converted.** Candles and levels are both
  the index's values carried onto the futures axis at fair value
  (`frontend/core/symbols.ts`, `futuresReplayExplainer`; zerogex-oa
  `src/api/futures_middleware.py` lists `/api/replay/` as projectable).
- **Regular session only.** 09:30 to 16:00 ET (zerogex-oa
  `src/api/routers/replay.py`, `_et_session_window`).
- **The strike data stops at 60 days.** Production runs
  `DATA_RETENTION_DAYS=60`, and `gex_by_strike` is pruned at it; `gex_summary`
  is not. The live ES picker lists 60 sessions, Aug 14 to Nov 6. Sep 8 and
  later carry strike data; Sep 4 and earlier have none (checked by fetching
  Aug 14, Sep 4, Sep 8, Sep 10 and Nov 2). So right now the strikes go back
  to early September, and the boundary moves forward a day every day.
- **The API endpoints.** `GET /api/replay/sessions` (`symbol`, `limit` up to
  180) and `GET /api/replay/range` (`symbol`, `date`, plus `expirations`,
  `strike_band_pct` from 0.005 to 0.10, default 0.04). Each strike carries
  `strike`, `call_gex`, `put_gex` and `net_gex` (`_shape_range_strike`), in
  dollars per 1% move, **averaged across the strike's expirations** (corrected
  Nov 8; the Nov 7 version of this note called them the ladder's figures).
  Both endpoints are in the public docs at https://api.zerogex.io/openapi.json
  (checked). The router is mounted under the `gex` scope (zerogex-oa
  `src/api/main.py`), the same scope as `/api/v1/levels`, so any Pro key that
  pulls levels can pull replay.
- **API keys are Pro only, self-serve.** Account → API Access
  (`/help/platform/api-access`).

## First reply (sent Sat Nov 7)

As drafted below, except for the changes listed under "Thread so far".

**Subject:** Re: Gamma Ladder

Hi Nilesh,

Thank you, that's great to hear, especially in your first week.

Yes, you can look at Monday. Rewind on the Gamma Terminal only covers the current day, but Session Replay opens any recent session and lets you scrub through it minute by minute. Here's Monday for both:

ES: https://zerogex.io/replay/ES/2026-11-02
NQ: https://zerogex.io/replay/NQ/2026-11-02

For other days, go to https://zerogex.io/replay (it's also in the menu under Receipts → Session replay) and pick ES or NQ at the top. You can go through as many days as you like, one at a time.

Each replay puts the price candles beside the per-strike gamma on the same price axis, with the Call Wall, Put Wall, Gamma Flip, Max Pain and Pin Strike moving as you scrub. You can narrow it to that day's 0DTE options, and drop two pins to see how each strike changed between any two moments.

A few things to know for back testing:

- It covers the regular session, 9:30 AM to 4:00 PM ET, not the overnight futures session.
- ES and NQ come from the SPX and NDX options. In the replay, the candles are SPX and NDX converted to the futures price at fair value, so they can sit a few points off your own ES or NQ chart.
- The per-strike gamma goes back about two months, to early September right now. Older days on the list still show the levels and candles, but not the strikes.
- It's one symbol per page, so open ES and NQ in two tabs to compare them. The strikes are drawn as bars on a dollar scale rather than the ladder's numbered rows; the API below gives the exact figures.

On the API: yes. API access comes with the Pro plan, and on Pro you create your own key under Account → API Access (https://zerogex.io/account#api-access). Two calls cover the ladder data:

- GET /api/replay/sessions?symbol=ES lists the days available.
- GET /api/replay/range?symbol=ES&date=2026-11-02 returns every minute of that session: the call, put and net gamma in dollars at each strike, the levels, and the price bars. It's one call per day, so loop over the dates for more than one.

Since the per-strike history rolls forward, save each day as you pull it. The full reference is at https://api.zerogex.io/docs.

If anything looks off, or you'd like a hand getting set up, just reply here.

Best,
Michael
Founder, ZeroGEX

## Second reply: building his own ladder (2026-11-08)

Sun Nov 8, 11:04 AM, same thread:

> Hello Michael,
>
> Thank you so much for the detailed response. Every day I learn something new
> about this product and it is amazing. My Thanks to you and your team for such
> an amazing product.
>
> Yesterday I used the API and I really like it a lot. Let me describe what I
> am trying to build so you can point me in the right direction. I want to
> build something similar to the gamma ladder on your gamma terminal where I
> can see two tickers like ES and NQ, along with their gamma $ values and
> optionally, an up or down arrow showing the change since market open. That's
> valuable info.
>
> I am trying to build a similar dashboard where I can see the current $ value
> and compare it against the previous five-minute values, displaying the
> difference. I also want to flag any large gamma changes with an L1.
>
> I plan to make two calls from my Python script.
>
> - Current: /api/gex/by-strike gives the strikes nearest price and $ value
> - Earlier: /api/replay/frame gives the snapshot 5 minutes before that.
>
> This would run during the RTH session and I assume the data for the replay
> frame would be available for comparison.
>
> This is a sample screen of what I am looking for and I wanted to know if my
> approach is correct. Or if you would suggest something else.
>
> For example what I look for is let's say we are at a put wall and
> consolidating, I like to see what is building above or below, and whether
> gamma at the wall is increasing or decreasing. This helps me identify if the
> put wall is a trapdoor or strong support. If large gamma is building below,
> that tells me that once the wall breaks we might flush to the next large
> node.
>
> I am a full time ES futures trader and have been using Gexbot for all my
> trading for 3+ years. However, I find ZeroGex very easy to use and its data
> easy to understand. I am currently using both and plan to continue until I
> am fully comfortable in trading with ZeroGex.
>
> Thanks again for an amazing product and any guidance you can provide would
> be greatly appreciated.

His sample screen, "ZEROGEX FRAME": ES ($7,400.25) and NQ ($27,108) side by
side, 20 strikes each, columns Strike, Δ 5m and Net Γ $, an "L1" badge on each
column's biggest change (ES 7407.5: +23.7B on −13.1B; NQ 27015: +41.5M), and a
header reading "LIVE snapshot 11/06, 10:20 PT · vs 11/06, 10:15".

### The read

- **Yes, with one change: one call for "now" and "5 minutes ago".** Both of
  his endpoints return one row per (strike, expiration), and both limits
  count rows. `/api/gex/by-strike` stops at 200 rows: about 16 strikes near
  price on ES, where near-money strikes had 12 expirations on Friday. His
  screen shows 20. The outer strikes come back partly summed, and the two
  calls cut off at different strikes as price moves, which reads as false
  changes at the edges. `strike-profile-timeseries` returns every strike
  already summed, for several minutes at once. It's what the live ladder
  reads.
- **His since-open plan is exactly ours.** The ladder's Session Δ baseline is
  one `/api/replay/frame` at 09:30 ET with `strike_limit=4000`, summed by
  strike. Tell him so; it's reassuring and it's true.
- **Give him our marking rule for L1.** A concrete starting point beats
  "tune it".
- **The put-wall read needs the open-interest caveat.** It's the most useful
  thing in the reply for how he trades. Intraday "building" on the OI book is
  re-pricing (spot, time, vol), not new positions. Volume-weighted gamma is
  the closer read on today's activity, with its limits.
- **Own the replay mistake in one line.** He's building on these numbers; a
  back test on `/api/replay/range` would be off by a different factor at
  every strike.
- **Don't try to diagnose his screenshot's numbers.** His clock and ours
  don't line up: at 13:20 ET (10:20 PT) our ES replay closed at 7,418.50, not
  7,400.25, and his ES strikes sit about a point off ours (7402.5 against
  7403.5), consistent with a Saturday "current" call projected on a different
  session's carry than Friday's frame. His −13.1B is plausible for a summed
  strike near the close (our sum at 7428.75 was −6.5B at 13:20 ET). Not worth
  a paragraph unless he asks.
- **Leave out `/api/replay/diff`.** It keeps only one expiration per strike
  (see Verified), so it's no help to him until that's fixed.

### Verified

Read from the code on `release` and the live site, 2026-11-08.

- **`/api/gex/by-strike`** (zerogex-oa `src/api/main.py`; `get_gex_by_strike`
  in `src/api/database.py`): latest snapshot, one row per (strike,
  expiration), ordered by distance from spot (`sort_by=distance`, default) or
  by |net| (`impact`), `limit` default 50, max 200, rows not strikes. Dollar
  figures scaled by the newest spot quote.
- **`/api/replay/frame`** (`src/api/routers/replay.py`, `get_replay_frame`;
  `get_gex_by_strike_at_ts`): the frame at or before `ts`, one row per
  (strike, expiration) with an `expiration` field, ordered by distance from
  that minute's spot, `strike_limit` default 60, max 4000, rows not strikes.
  Today's frames are written live, minute by minute.
- **`/api/gex/strike-profile-timeseries`** (`src/api/main.py`;
  `_get_strike_profile_timeseries_uncached`): `timeframe` 1min, 5min or 15min;
  `window_units` up to 480 (operator cap `STRIKE_PROFILE_TIMESERIES_MAX_WINDOW_UNITS`,
  480 in `.env.example`); buckets ascending, newest last, counted back from
  the newest bucket with data; SPX and NDX (so ES and NQ) restricted to the
  cash session. Per strike, `SUM` across expirations. The strike fields are
  named `call_gamma` / `put_gamma` / `net_gamma` but carry the same dollar
  figures as by-strike's `*_gex` (`StrikeProfileStrike` in
  `src/api/models.py`). The ladder reads it with `timeframe=5min&window_units=3`
  (`frontend/hooks/useGammaLadder.ts`, `tipUrl`); `1min` with `window_units=6`
  gives an exact five-minute gap.
- **The ladder's since-open arrows.** `baselineUrl` in `useGammaLadder.ts`:
  `/api/replay/frame?ts=<09:30 ET>&strike_limit=4000`, re-summed per strike in
  `frontend/core/sessionDelta.ts` (`baselineNetByStrike`). On Nov 6 the first
  replay frame was stamped exactly 14:30:00 UTC, so a 09:30 `ts` lands on the
  day's first frame.
- **The marking rule.** `sessionDeltaMark` (`core/sessionDelta.ts`) skips a
  change under 5% of the strike's own baseline, and under a noise floor of 2%
  (`DELTA_NOISE_FRACTION`, `components/PairGammaHeatmap.tsx`) of the column's
  98th-percentile |value| (`clip`).
- **Cadence.** Per-strike values recompute about once a minute, with a ~5 s
  server cache (`useGammaLadder.ts`, header comment). The rate limit is off by
  default and, when on, 600 requests a minute per caller, counted per worker
  (`src/api/ratelimit.py`); he needs a handful.
- **ES and NQ strikes match within a session.** The futures middleware uses
  one carry basis per futures trading day (rolling at the 18:00 ET reopen) and
  rounds projected prices to the tick (`_row_anchor`, `projection_tick` in
  `src/api/futures_middleware.py`), so the same index strike maps to the same
  ES price in every call that day. Across days it shifts with the carry.
- **Volume basis.** `/api/gex/volume-gamma-by-strike`: same units and signs,
  weighted by today's traded volume, latest snapshot only, summed per strike
  (`API_Guide.md`). Can't tell opening from closing trades; a contract side
  with no open interest adds no dollars.
- **The open-interest caveat** is the site's own wording:
  `/help/platform/gamma-terminal`, "New positions during the day".
- **`/api/replay/diff` drops expirations.** `get_replay_diff` indexes the
  per-(strike, expiration) rows by strike in a dict, so each strike keeps one
  arbitrary expiration's row. The website doesn't call it (searched
  `frontend/`).
- **All recommended routes are in the public docs with v2 mirrors**
  (`/api/v2/...`, which adds the freshness block): checked against
  https://api.zerogex.io/openapi.json.

### Draft

**Subject:** Re: Gamma Ladder

Hi Nilesh,

Thank you, and I'm glad the API is working for you. Your screen looks great, and the way you read a put wall is exactly what this data is for.

Your plan works, with one change: get "now" and "5 minutes ago" from a single call. The two endpoints you picked return one row per strike per expiration, and their limits count rows, not strikes. /api/gex/by-strike stops at 200 rows, which on ES covers only about 16 strikes near price, since each one has 12 or so expirations. So the outer strikes come back partly added up, and the two calls can cut off at different strikes as price moves, which shows up as false changes at the edges.

Here's how I'd do it, with the same data our own ladder reads:

1. Every minute, one call per symbol:
GET /api/gex/strike-profile-timeseries?symbol=ES&timeframe=1min&window_units=6
It returns the last six minutes, oldest first, with each strike already added up across all its expirations. Each strike's net_gamma is the dollar figure our ladder shows (it's named gamma, but it's dollars per 1% move). Use the newest minute as current and the one five minutes before it as your comparison, matching on the timestamp.

2. Once a day, a few minutes after the open, for your since-open arrows:
GET /api/replay/frame?symbol=ES&ts=2026-11-09T09:30:00-05:00&strike_limit=4000
Add up net_gex by strike and keep that as the day's baseline. And yes, today's frames are available as the session goes; this is exactly how our ladder's arrows work.

The numbers are recomputed about once a minute, so polling every 30 to 60 seconds is plenty. Within a session, ES and NQ strikes come back at the same prices in every call, so matching on them is safe. If you call /api/v2/ instead of /api/, each response also tells you how fresh the data is.

For your L1 flag: our arrows skip any change smaller than about 2% of the largest value in the column, or 5% of that strike's own value at the open. That's a reasonable place to start, then tune it to your eye.

One thing that matters for the put wall read. Open interest only updates once a day, after the close. So during the session these numbers move because price, time and volatility re-price positions that are already open, not because new ones are being added. Gamma "building" at a strike mostly means price is moving toward it, or that same-day options are sharpening into the afternoon. To see where today's trading is adding gamma, also poll /api/gex/volume-gamma-by-strike?symbol=ES. It's the same units, weighted by contracts traded today instead (the Volume setting on our ladders). It can't tell opening trades from closing ones, or who was on each side, and it only returns the latest snapshot, so keep the last few minutes in your script for the 5-minute change.

And one correction to my last email, sorry about that: /api/replay/range and the bars on Session Replay average each strike across its expirations instead of adding them up. So they come out smaller than the ladder by a different amount at each strike (on Friday, ES strikes near price had 12 expirations, so the replay showed a twelfth). For exact per-strike numbers at any minute, today or a past day, use /api/replay/frame with strike_limit=4000 and add up the rows by strike, as in step 2.

Happy to look over your script if anything doesn't line up. And thank you for giving ZeroGEX a real run next to Gexbot. I'd love to hear how it compares after a few more weeks.

Best,
Michael
Founder, ZeroGEX

### If the replay fix ships first

If `/api/replay/range` and Session Replay are switched to summing before this
goes out, replace the correction paragraph with:

And one correction to my last email: until yesterday, /api/replay/range and the bars on Session Replay averaged each strike across its expirations instead of adding them up. That's fixed now, so they match the ladder. If you pulled any days before the fix, pull them again.

If it ships after, send this in the same thread once it's live:

Hi Nilesh, a quick follow-up: /api/replay/range and Session Replay now add each strike up across its expirations, so they match the ladder. If you saved any days before today, pull them again.

### If he replies

- **Back testing past days with exact figures.** `/api/replay/frame` per
  minute he needs, summed by strike, within the ~60-day window. At 5-minute
  steps that's 78 calls per symbol per day, well inside the rate limit. Match
  strikes within a day, not across days (the carry moves them).
- **He asks why his ES −13.1B is so large.** See "The read": likely real for a
  summed near-money strike late on a Friday 0DTE, but his clock and strike
  grid don't line up with ours, so ask for the exact call he made before
  answering.
- **He asks about `/api/replay/diff`.** Don't recommend it until it sums
  across expirations; two `/api/replay/frame` calls, each summed, do the same
  job.
- **He wants the ES and NQ ladders side by side on a past day, on the site.**
  Pair Comparison replays only the latest session
  (`frontend/hooks/usePairReplay.ts`, `limit=1`), and its replay columns use
  the averaged frames. Note it; no date.
- **He asks for more than two months of strike history.** No promise. Offer
  to look at it if the window is what stops his test, as with Aaron.
- **He asks about the overnight session.** The SPX and NDX books aren't
  recomputed overnight, so an overnight series would only show the 4:00 PM
  book against a moving futures price. Live, the terminal already draws that.
