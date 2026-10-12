# Aaron B: true 1DTE levels for a backtest, and his open ES replay questions (2026-10-12)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Aaron signs "Aaron" and shows as *Aaron B* (aabbon@gmail.com). He's on Pro and
works through the v2 API. Subject: "Re: Historical ES replay price discrepancy
— clarification needed for GEX backtesting". Reply in the same thread.

> **Status:** sent 2026-10-12, after both "Confirm before sending" checks
> passed. Waiting on his reply, including where he saw "0dte_next".

## Thread so far

1. **Tue Sep 29, 6:49 PM, inbound.** He's backtesting our GEX levels against
   real futures volume profiles. For the 10:00 ET one-minute candle on
   2026-08-04, our ES replay closed at 7,695.25, real ESU26 at 7,685.50
   (TradingView, not back-adjusted), Sierra's ESU26 at 7,686.50, and our SPX
   replay at 7,658.25. His archived response said `basis_source = carry`,
   `derived_from = SPX`, `basis_ratio = 1.0048198`, and SPX × ratio rounded to
   the tick is exactly our ES close, every day of his Jul 28–Aug 31 sample. He
   asks five numbered questions (projected or real candles, which contract,
   inputs from the date or from today, whether replay shows what users saw,
   how to test against dated contracts) and whether a replay timestamp labels
   the start or the end of its minute.
2. **Sun Oct 4, inbound, replying to his own Sep 29 mail.** Prefers us to
   Quant Data. Asks for 1-minute net flow and trade filters, and describes his
   market-wide buying/selling pressure aggregate.
3. **Mon Oct 5, outbound.** 1-minute flow that night, filters need a
   trade-by-trade feed, Market Tide exists. **Nothing on the Sep 29
   questions.**
4. **Oct 6–8.** Thanks for 1-minute flow; asks about a 36 calls/minute cap
   (the real limit is several hundred); then finds `/flow/series` with
   `timeframe=1min` covers his by-contract ask.
5. **Fri Oct 9, inbound.** Asks for more than current/prior session history on
   the flow pages, and shares an all-calls / all-puts CVD chart. **Sat Oct 10,
   outbound:** noted for the development list; would love to see the code.
6. **Mon Oct 12, 8:07 AM, inbound (this reply).** Almost done with the
   aggregate and the CVD. Backtesting the GEX levels, he sees "no true 1DTE
   data. It seems it is 0dte_next which lumps the 0dte and the 1dte into one."
   Asks whether he can get, or we can make, true 1DTE-only levels.

## The read

- **Lead with yes. True 1DTE levels exist today, with nothing to build.**
  `/api/replay/range` takes any expiration date, not only `0dte`. Give it one
  date and the walls, flip and max pain come back built from that expiration
  alone, every minute of the session.
- **Ask where "0dte_next" comes from. Don't argue with it.** Neither repo has
  a field, parameter or label by that name (searched both, every spelling,
  case-insensitive). Our `0dte` scope is the session's own expiration only,
  and the default levels are the whole chain. He may be naming something in
  his own pipeline. One line from him settles it, and if anything of ours does
  mix two expirations under a 0DTE label, that's a bug to fix.
- **Give him the 60-day limit up front.** Per-expiration levels are rebuilt on
  read from per-strike data that's deleted after 60 days. So 1DTE history
  starts around mid-August and moves forward a session every day, and his
  Jul 28–Aug 31 sample is mostly outside it. Tell him to save each session as
  he pulls it.
- **No promise to keep it longer.** Offer to look at it if 60 days isn't
  enough. See "If he replies".
- **Answer the Sep 29 questions in the same email, and own the delay in one
  line.** They're the subject line, nobody answered them in this thread, and
  they decide whether his ES backtest measures what he thinks it does. If
  Michael answered them somewhere else, cut that section. If the email feels
  too long, the Sep 29 section can go as a second reply in the same thread.
- **Steer the backtest to SPX against SPX.** Our ES candles and ES levels are
  both SPX times a modeled ratio, so against real ES prints they carry the
  model's error (9.75 points on Aug 4 in his pull, 4.5 at today's setting).
  SPX against SPX has nothing converted.
  If he wants ES, he re-bases with his own ES/SPX ratio.
- **Point him at replay, not `/api/gex/historical`, for a backtest.** The
  latter recalculates walls on request inside the 60-day window and serves
  stored walls outside it, so a long test changes method partway through.
- **Don't offer the traded basis.** Using ES prints for the conversion is a
  CME derived-data use we aren't licensed for (zerogex-oa `src/config.py`,
  `FUTURES_BASIS_CARRY_ONLY`).

## Verified: 1DTE

Read from the code on `release`, 2026-10-12.

- **Any expiration can be requested.** `GET /api/replay/range` (zerogex-oa
  `src/api/routers/replay.py`, `get_replay_range` and
  `_parse_expiration_filter`) takes `expirations=all` (default), `0dte`
  (resolved to the requested session's date, not today's), or a
  comma-separated list of `YYYY-MM-DD` dates. The response echoes the
  resolved list as `expiration_filter`. Every route has a v2 mirror
  (`src/api/v2.py`), so `/api/v2/replay/range` works the same way.
- **Under a date filter the levels are rebuilt from that expiration alone.**
  `call_wall`, `put_wall` and `gamma_flip` are re-derived each minute from the
  filtered per-strike ladder through the canonical helpers in
  `src/analytics/walls.py`. `max_pain` is that expiration's own, from
  `max_pain_by_expiration`. `pin_strike`, `pin_confidence` and
  `max_gamma_strike` (GEX King) stay whole-chain (`src/api/database.py`,
  `_scope_replay_frame_levels`; covered by
  `tests/test_replay_expiration_filter.py`). The website's Replay only offers
  All and 0DTE (`frontend/core/replayScope.ts`); the API takes any date.
- **ES works the same way.** `/api/replay/` is on the futures middleware's
  projectable list, and only the `symbol` value is swapped
  (`src/api/futures_middleware.py`, `_PROJECTABLE_PREFIXES`,
  `_rewrite_scope`). So `symbol=ES&expirations=<SPX expiration>` returns the
  SPX 1DTE book projected onto the ES axis.
- **SPX has an expiration every trading day,** so SPX's 1DTE is the next
  trading day (Friday's is Monday's).
- **History depth.** The rebuilt levels need `gex_by_strike`, which
  `make db-prune` deletes at `DATA_RETENTION_DAYS` (zerogex-oa `Makefile`,
  `DB_MAINTAIN_TABLES`, run nightly by `zerogex-oa-db-maintain.timer`), and
  production runs 60 (`docs/runbooks/strike_profile_timeseries_stampede.md`).
  For an older session the frames still come back, but under a date filter
  the walls and flip are null (`_scope_replay_frame_levels`, the "no in-band
  strikes in scope" branch). The whole-chain levels in `gex_summary` aren't
  pruned and start on June 29, 2026 for SPX (public:
  `/help/platform/data-coverage`, "Historical depth").
- **The filtered flip is a different calculation from the headline flip.**
  Under a filter it's where the filtered book's gamma, summed strike by strike
  from the bottom up, changes sign (`compute_gamma_flip_from_strikes`). The
  headline flip is the zero crossing of the whole chain re-priced across a
  price grid, with same-day contracts down-weighted (`main_engine.py`, the DTE
  ramp). A 1DTE flip against the All flip compares two methods as well as two
  books.
- **Null flips are real.** A filtered flip that doesn't clear the same gates as
  the canonical one comes back null rather than drawn
  (`test_a_scoped_flip_at_the_ladder_edge_is_refused_not_drawn`).
- **Strike band.** Filtered walls are ranked over strikes within
  `strike_band_pct` of the session's closing spot (default 0.04, max 0.10). A
  1DTE SPX wall more than 4% from spot is rare; `strike_band_pct=0.10` widens
  it if he asks.
- **Cash session only.** Frames run 09:30 to 15:59 ET. The 16:00 frame is left
  out because the day's 0DTE has expired by then (`REPLAY_SESSION_END`,
  `src/api/database.py`).

## Verified: the Sep 29 questions

All zerogex-oa, on `release`, 2026-10-12.

1. **Replay candles are projected, not CME bars.** For `symbol=ES` the
   middleware rewrites the request to SPX (`src/api/futures_middleware.py`,
   `_rewrite_scope`), `/range` reads SPX `underlying_quotes`, and every price
   is multiplied by one ratio and rounded to the 0.25 tick
   (`src/jobs/futures_projection.py`, `Basis.project`). `/api/market/quote`,
   `/historical`, `/session-closes` and `/session-levels` are on
   `_NATIVE_PATHS` and serve real `@ES` bars from `futures_quotes`. On live
   projected responses only the top-level spot is swapped for the real futures
   close; the levels stay projected.
2. **The ratio is always carry.** `FUTURES_BASIS_CARRY_ONLY` defaults on
   (`src/config.py`), because the measured basis is derived from CME prints
   and needs a CME licence. Carry is `e^((RISK_FREE_RATE − q) × days/365)`,
   with days from the anchor date to the active contract's expiry
   (`theoretical_ratio`). Rate and yield are static settings applied at
   request time, nothing is stored, so changing them moves all projected
   history too. A `date=` request anchors at 16:00 ET that day, one ratio for
   the session. His 1.0048198 is exactly `e^(0.039 × 45/365)`: production's
   r − q was 3.90% when he pulled it. It's 3.36% today (`RISK_FREE_RATE`
   0.044, SPX q 0.0104, from `make futures-carry-check` on 2026-10-12), so
   the same Aug 4 request now returns 1.0041511 and ES 7,690.00.
3. **Contract.** `active_contract_expiry`: the first quarterly third Friday
   more than 7 days after the date (7 measured from TradeStation's Sep 2026
   roll). Aug 4 → Sep 18, ESU26, 45 days. `data_contract` /
   `data_contract_expiry` are added only to `/api/gex/summary` and
   `/api/v1/levels/*` among projected routes (`_labels_contract`, since
   2026-10-01, commit 733fda0), and natively on `/api/market/quote` and
   `/historical`. Not on replay or `/api/gex/historical`.
4. **Stored or recomputed.** Whole-chain replay levels are the stored
   `gex_summary` columns (`get_gex_frames_for_session`).
   `/api/gex/historical` recomputes call/put walls from `gex_by_strike` while
   its rows exist (max gamma above or below the bucket's close, no wall hold),
   and serves the stored walls only after the prune (`src/api/database.py`,
   the `summary_call_wall` fallback). The only writer of `gex_summary` is the
   engine's upsert, but the engine itself rewrote the 15:59 row on 14 of 15
   sessions from Sep 8, and Sep 30's row again at the Oct 1 restart, from
   data ingested after the close. Fixed going forward by commits 69bbcdf
   (Sep 30) and 7bc662d (Oct 1); the overwritten rows weren't restored
   (comment above the settled-bucket guard in `src/analytics/main_engine.py`).
   Wall picking changed Oct 7–10 (687a100, 5d9246d, db2bf4b, ae8c29e); older
   rows keep the old method. `created_at`, `computed_at` and `data_as_of` are
   stored per row, but neither replay nor `/api/gex/historical` returns them.
5. **Timestamps are bar-start.** Ingestion files each bar under its own minute,
   and the replay window is [09:30, 16:00). A frame's timestamp is the newest
   option-chain bucket when the cycle ran, and its spot is that minute's close
   so far (`src/analytics/main_engine.py`, the snapshot read), so the 10:00
   frame was computed during 10:00, while the 10:00 candle's close is the end
   of the minute. Acting from the next candle avoids look-ahead.

## Confirm before sending

On the EC2 box, from the `zerogex-oa` directory:

1. `make psql`, then:

   ```sql
   SELECT MIN(timestamp)::date AS first_day FROM gex_by_strike WHERE underlying = 'SPX';
   ```

   It should be about 60 days back, around Aug 13. If it's far off, change
   "mid-August" in the draft.
2. `git merge-base --is-ancestor 7bc662d HEAD && echo deployed`. If it prints
   nothing, the 3:59 PM fix isn't on the box yet: change "That's fixed" to
   "A fix is on the way".

Both ran on 2026-10-12: `first_day` was 2026-08-13 and 7bc662d printed
`deployed`, so the draft went out as worded.

## Draft

Hi Aaron,

Glad the aggregate and the CVD are coming together. I'm looking forward to seeing them.

**True 1DTE levels**

You can get these today from the replay endpoint. Besides all and 0dte, its expirations parameter takes any expiration date. Give it one date and the call wall, put wall, gamma flip and max pain are rebuilt from that expiration alone, minute by minute. For 1DTE on October 8, ask for the October 9 expiration:

/api/v2/replay/range?symbol=SPX&date=2026-10-08&expirations=2026-10-09

SPX has an expiration every trading day, so 1DTE is the next trading day (from a Friday, it's Monday). The response repeats the date back in expiration_filter, so you can confirm what you got. It works for ES too, with symbol=ES and the same SPX dates, but read point 5 below before you test ES levels against real ES prices.

A few things to know for the backtest:

1. These levels are rebuilt from our per-strike data, which we keep for about 60 days. Right now that means 1DTE history starts in mid-August, and the start moves forward a session every day. Older dates still return frames, but under a date filter their walls and flip come back empty. I'd save each session as you pull it.
2. Pin Strike and GEX King don't follow the filter. They always describe the whole chain.
3. Under a filter, the flip is where that expiration's gamma, added up strike by strike, changes sign. The main flip is calculated a different way, so compare 1DTE flips with each other rather than with the all-expiration flip.
4. Some minutes have no flip. Skip those rather than treating them as zero.

I couldn't find anything called 0dte_next on our side. Our 0dte scope is only the session's own expiration, and with no filter the levels use every expiration. Which endpoint and field are you seeing it in? If something of ours is mixing two expirations, I want to fix it.

If 60 days isn't enough history for your test, let me know. Keeping the 1DTE levels permanently is something I can look at.

**Your September 29 questions**

I owe you answers on these, and I'm sorry they took this long.

1. Projected or real candles: projected. Our ES and NQ replay candles are the SPX and NDX candles multiplied by one ratio for the session and rounded to the tick, exactly as you worked out. The ratio is a modeled fair value (an interest rate less the index's dividend yield, over the days left to the contract's expiry), not the basis ES actually traded at. Live, the ES price we show is the real futures price, but the levels next to it are converted the same way.
2. Which contract: the front quarterly, switching to the next one a week before expiry. On August 4 that was ESU26, expiring September 18. /api/gex/summary and /api/v1/levels return it as data_contract and data_contract_expiry. Replay doesn't include those fields, but the same rule gives you the contract for any date.
3. Historical or current inputs: the levels in replay are the values our engine stored at that minute. Two things are worked out when you ask: the ES/NQ ratio, which uses that date's days to expiry but our current rate and dividend settings rather than that day's market, and any levels you filter by expiration, which are rebuilt with current code. For a backtest, use replay rather than /api/gex/historical. For the last 60 days that endpoint recalculates its walls when you ask, with a simpler rule, then switches to the stored walls, so its walls change method partway through a long test.
4. What users saw at the time: yes, with one known exception. On most sessions from September 8 to September 30, the 3:59 PM row was overwritten after the close by a later recalculation. That's fixed, but those rows weren't restored, so drop the 3:59 PM frame on those days. We record when each row was computed, but replay doesn't return it. Also, we changed how the walls are picked between October 7 and 10 (a wall now holds until a rival is clearly bigger), so walls before and after that behave a little differently. Older rows weren't rewritten.
5. Testing against real futures: the cleanest test is SPX levels against SPX prices. It's the same dealer book with nothing converted. For ES, request the SPX levels (or divide our ES levels by projection.basis_ratio), multiply by the actual ESU26-to-SPX ratio at that minute from your own data, and round to 0.25. I wouldn't use our ES levels unchanged against real ES prices: on August 4 our model sat 9.75 points above where ESU26 traded, and that gap changes through the quarter.

On timestamps: a candle or frame stamped 10:00 covers 10:00:00 to 10:00:59. The levels stamped 10:00 were computed during that minute, so to stay clear of look-ahead, act on them from the 10:01 candle onward.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He says where "0dte_next" comes from.** If it's in one of our responses,
  find the field and check whether its expiration set is really one date. If
  it's his own name for the `0dte` scope, the answer in the draft stands.
- **He needs more than 60 days of 1DTE.** Cheapest first:
  1. He saves each session as he pulls it. Already in the draft, and it costs
     us nothing.
  2. A nightly job that writes each session's 0DTE and 1DTE levels, minute by
     minute, to a small permanent table before the prune runs (about 390 rows
     per symbol per scope per day). It can only save what is still inside the
     60-day window on the day it first runs, so every day it doesn't exist the
     earliest session it could ever keep moves forward by one. It's a real
     change (schema, job, read path, tests) in zerogex-oa. Not needed to send
     this reply.
  3. Rebuilding older sessions from `option_chains_archive` (retention-exempt,
     SPX from April 20, 2026). It stores gamma per contract per minute but has
     no open interest column, and GEX needs open interest. Check where that
     would come from before promising anything.
- **He asks for a `1dte` shortcut like `0dte`.** Small change in
  `_parse_expiration_filter`: resolve it to the next listed expiration after
  the session date. Not needed, since he can pass the date.
- **He asks why the 1DTE flip doesn't match the All flip.** They're two
  calculations, not just two books (see "Verified: 1DTE"). Compare 1DTE with
  1DTE.
- **He wants 1DTE on the website's Replay.** Today it has All and 0DTE only. A
  "next expiration" toggle is a small web change because the API already
  takes the date. No promise.
- **He asks for overnight 1DTE levels on ES.** Replay is cash session only, and
  overnight the levels are the ones from the U.S. close
  (`/help/platform/data-coverage`).
- **He asks for the compute timestamp in replay.** `computed_at` and
  `data_as_of` are already stored per row, so exposing them is a small change.
  No promise or date.
- **He asks us to convert with the traded basis instead.** No. That's a CME
  derived-data use we aren't licensed for. Re-basing with his own ES data on
  his side is the answer.
- **His re-pulled ES history doesn't match his archive.** Expected, and answer
  3 already told him why: the ratio is recomputed from the current setting,
  which changed after his pull. Aug 4 at 10:00 now projects to 7,690.00
  (ratio 1.0041511) instead of 7,695.25, so 4.5 points above ESU26 rather
  than 9.75. It moves again whenever the rate or yield setting does. SPX
  levels, or his own re-basing (answer 5), don't move.

## The carry rate (checked 2026-10-12, nothing to do)

The first version of this doc said the ES/NQ conversion rate looked about a
point high. That was wrong for today's setting. `make futures-carry-check` on
2026-10-12 showed `RISK_FREE_RATE` 0.044 and SPX q 0.0104, so r − q is 3.36%
against 3.42% implied by the tape (gap −1.1bp, about 1 ES point). NDX is 3.88%
against 4.03% (−2.7bp). Both read "ok". The 3.90% in Aaron's ratio came from
the setting in force when he pulled his data.

The rate the tape implies also moves on its own: about 2.9% for the Aug 4
window, 3.4–3.5% in September and October. One fixed setting can't follow
that, so a few points of offset on a given day are expected. That's the "fair
value, not the traded price" caveat `/help/platform/data-coverage` already
gives.
