# Aaron B: true 1DTE levels for a backtest, and his open ES replay questions (2026-10-12)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Aaron signs "Aaron" and shows as *Aaron B* (aabbon@gmail.com). He's on Pro and
works through the v2 API. Subject: "Re: Historical ES replay price discrepancy
— clarification needed for GEX backtesting". Reply in the same thread.

> **Status:** unsent.

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
- **Answer the Sep 29 questions in the same email.** They're the subject line,
  nobody answered them in this thread, and they decide whether his ES
  backtest measures what he thinks it does. If Michael answered them somewhere
  else, cut that section.

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

## Confirm before sending

On the EC2 box, from the `zerogex-oa` directory, run `make psql`, then:

```sql
SELECT MIN(timestamp)::date AS first_day FROM gex_by_strike WHERE underlying = 'SPX';
```

It should be about 60 days back, around Aug 13. If it's far off, change
"mid-August" in the draft.

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
- **He asks why the 1DTE flip doesn't match the All flip.** They're two
  calculations, not just two books (see "Verified: 1DTE"). Compare 1DTE with
  1DTE.
- **He wants 1DTE on the website's Replay.** Today it has All and 0DTE only. A
  "next expiration" toggle is a small web change because the API already
  takes the date. No promise.
- **He asks for overnight 1DTE levels on ES.** Replay is cash session only, and
  overnight the levels are the ones from the U.S. close
  (`/help/platform/data-coverage`).
