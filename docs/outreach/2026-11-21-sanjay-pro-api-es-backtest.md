# Sanjay: Pro API history for an ES intraday backtest (2026-11-21)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

> **Status:** draft, unsent. Two dates in the draft are placeholders. Fill them
> in from "Fill in before sending" first.

## Thread so far

1. **Inbound, to support.** Sanjay is evaluating the Pro API to build an
   automated intraday ES momentum system. He wants historical and real-time
   data to backtest indicators for large intraday ES moves, and asks:
   1. Historical intraday Flow Analysis (net contracts, premium, call/put
      flow) at 1- or 5-minute bars, and how far back.
   2. Historical Gamma Shift data, including regime changes and net gamma
      shift.
   3. Historical 0DTE GEX by strike, with gamma flip, call/put walls and net
      GEX.
   4. Forecast Receipt data (expected range, volatility, key levels, touch
      probabilities).
   5. Update frequency and timestamps for all of the above.

## The read

- **Yes to all four, and lead with that.** Everything he names is in the API
  on a Pro key. The real answer is in the history depth, which differs by
  dataset, so give it per item.
- **The 60-day window is the thing he most needs to know.** One-minute flow
  and per-strike (0DTE) GEX are only kept about 60 days, on a rolling basis.
  For a backtester, "start saving it now" is the most useful sentence in the
  mail: every day he waits, a day of that data is gone for good.
- **Tell him ES is SPX, once, up front.** It answers a question he hasn't
  asked yet (why do the levels freeze overnight?) and tells him he can pass
  `symbol=ES` everywhere he needs.
- **Steer him off the live Gamma Shift card.** The card on the page
  (`/api/gex/regime-shift`) only compares "now" against an earlier point. It
  can't be pointed at a past time. The series is what he wants.
- **Give him the two backtest traps.** Same as Val's reply: bar-start stamps
  carrying the bar's last value (look-ahead), and empty flips. Both fail
  silently.
- **No pricing.** He didn't ask.

## Verified

Read from the code on `release`, 2026-11-21. zerogex-oa paths unless noted.

**Access**

- **A Pro key reaches all of it.** Website keys are minted with no scopes
  (`frontend/app/api/account/api-keys/route.ts` sends none; zerogex-oa
  `src/api/routers/admin_api_keys.py`), and scope enforcement is off by
  default (`API_SCOPE_ENFORCEMENT`, `src/api/security.py`). Forecast sits
  under the `signals` scope (`src/api/main.py`, `include_router(forecast_router
  ...)`), which the Pro help page lists as included
  (`frontend/content/help/platform/api-access.md`).
- **ES works on every endpoint in the draft.** `/api/flow/series`,
  `/api/flow/by-strike`, `/api/gex/*` (regime-series, historical),
  `/api/replay/` and `/api/forecast` are all on the futures projection
  allowlist (`src/api/futures_middleware.py`, `_PROJECTABLE_PREFIXES`).
  Historical series are projected per row on their own session's basis (API
  guide, "ES / NQ and the basis a response is projected on").
- **Levels only change 9:30 to 16:00 ET for ES.** They come from SPX, which
  prints only in the cash session (API guide, "Cash indexes owe nothing
  outside 09:30–16:00 ET"; help page `data-coverage.md`).

**Retention** (`Makefile`, `DB_MAINTAIN_TABLES` and the notes above it;
production runs `DATA_RETENTION_DAYS=60`, `.env.example`)

- Pruned at 60 days: `option_chains`, `gex_by_strike`, `flow_contract_facts`,
  `flow_by_contract`, `flow_smart_money`, `trade_signals`.
- Kept forever: `gex_summary`, `underlying_quotes`, `hedging_flow_5min`,
  `gamma_regime_5min`, `flow_series_5min`, `daily_forecast`,
  `option_chains_archive`.

**1. Flow**

- `/api/flow/series`: session-cumulative call/put premium, call/put volume,
  net volume (calls bought minus sold, less puts bought minus sold), net
  premium, put/call ratio. `timeframe=5min|1min`, `date=YYYY-MM-DD`,
  `strikes`, `expirations`. `/api/flow/sessions` lists days (up to 60).
  `/api/flow/by-strike`: calls and puts bought and sold per strike per bar.
- **1-minute bars** always run the live query on `flow_contract_facts`
  (`src/api/database.py`, `_get_flow_series_1min`), so they reach back only
  60 days.
- **5-minute bars** read the kept-forever `flow_series_5min` snapshot ONLY
  when `FLOW_SERIES_USE_SNAPSHOT` is on (default off, `database.py` ~line
  980) and no strike/expiration filter is passed. Otherwise they run the
  query on `flow_by_contract`, which is pruned at 60 days. Whether production
  has it on isn't knowable from here. The draft says 60 days for everything
  until you check (see below).

**2. Gamma Shift**

- `/api/gex/regime-series` takes `date=YYYY-MM-DD` (`src/api/main.py`
  ~line 2158; the API guide's entry omits `date`, a doc gap that can wait).
  Reads `gamma_regime_5min`, retention-exempt, 5-minute bars. Per bar:
  `anchored_*` (versus the session's first bar) and `rolling_*` (versus a few
  bars back) for `stability` and `lean`, plus `gamma_flip`, flip distance,
  `cushion_state` (`SECURE` / `NORMAL` / `THIN` / `CROSSING` / `NO_FLIP`).
- `/api/gex/regime-history`: one stored regime read per session, `limit` up
  to 180 (`src/api/routers/gamma_shift.py`).
- `/api/gex/regime-shift` (the card the Gamma Shift page shows,
  `frontend/hooks/useRegimeShift.ts`) always diffs the current snapshot
  against a lookback. No timestamp parameter.

**3. 0DTE GEX by strike**

- `/api/replay/range?symbol=&date=&expirations=0dte`: every minute of the
  session (the `timeframe` parameter is accepted but ignored, always 1-minute
  frames), per-strike `call_gex`, `put_gex`, `net_gex`, with walls, flip and
  max pain re-derived from the scoped strikes. `strike_band_pct` default 4%,
  max 10% (`src/api/routers/replay.py`). Built from `gex_by_strike`, so 60
  days. A one-date scope reads the same before and after the November
  per-strike fix (API guide, Replay).
- `/api/gex/historical`: whole-chain `gamma_flip`, `call_wall`, `put_wall`,
  `net_gex`, `max_pain` per bar, `1min|5min|15min|1hr|1day`, 90 rows per
  request, from `gex_summary`. Starts June 29, 2026 for SPX, so for ES
  (published in `data-coverage.md`, "Historical depth").

**4. Forecast**

- `/api/forecast/{date}?symbol=` returns `morning` and `receipt`
  (`src/api/routers/forecast.py`, `_shape_row`). Morning: `projected_low`,
  `projected_high`, `projected_close`, `implied_move`, `expected_vol_state`,
  `expected_vol_ratio`, `gamma_flip`, `call_wall`, `put_wall`, `regime`,
  `flip_cross_prob`, `level_touch_probs` (`{"call_wall": p, "put_wall": p}`,
  `setup/database/schema.sql`). Receipt: `actual_low/high/close`,
  `range_respected`, `realized_vol_ratio`, `vol_state_correct`,
  `flip_crossed`, `level_touch_outcomes`, `levels_brier`.
- Also `/api/forecast/available-dates` (limit up to 365) and
  `/api/forecast/history/recent` (up to 180).
- **Times:** morning writer 08:30 ET Mon to Fri
  (`setup/systemd/zerogex-oa-forecast-writer.timer`; the code comments that
  still say 07:00 are stale), receipt 16:05 ET
  (`zerogex-oa-forecast-receipt.timer`).
- **Vol grading changed 2026-08-04** (`_DEFAULT_VOL_SCALE_FIX_DATE` in
  `forecast.py`). Before it, `vol_state_correct` measured a scale bug, so
  grades before that date aren't comparable.

**5. Cadence and timestamps**

- API guide, "Cadence profiles": GEX and levels 60 s, `/api/flow/*` 5-minute
  bars (1-minute on request), forecast once per session. Timestamps are
  ISO 8601 UTC (`api-access.md`). v2 adds the freshness envelope.
- `/api/gex/historical` rows are "stamped at the bar's start and carrying
  its last snapshot" (API guide). Flow rows carry `bar_start` and `bar_end`,
  with totals through the end of the bar.
- `gamma_flip` is null when the book has no honest crossing near spot
  (`src/api/models.py`, `GEXSummary`).

## Fill in before sending

On the EC2 box, from the `zerogex-oa` directory:

```bash
grep -E "DATA_RETENTION_DAYS|FLOW_SERIES_USE_SNAPSHOT" .env
make psql
```

Then in psql:

```sql
-- [GAMMA SHIFT START]: first day of the Gamma Shift series
SELECT MIN(bar_start AT TIME ZONE 'America/New_York')::date
FROM gamma_regime_5min WHERE symbol = 'SPX';

-- [FORECAST START]: first forecast, and first with touch odds
SELECT MIN(date) AS first_forecast,
       MIN(date) FILTER (WHERE level_touch_probs IS NOT NULL) AS first_touch_odds
FROM daily_forecast WHERE symbol = 'SPX';

-- Only matters if FLOW_SERIES_USE_SNAPSHOT=true above
SELECT MIN(bar_start AT TIME ZONE 'America/New_York')::date
FROM flow_series_5min WHERE symbol = 'SPX';
```

- Put the first query's date into `[GAMMA SHIFT START]`.
- Put `first_forecast` into `[FORECAST START]`. If `first_touch_odds` is a
  later date, change that sentence to: "It goes back to [first_forecast];
  the touch odds start on [first_touch_odds]."
- **If `DATA_RETENTION_DAYS` isn't 60**, change every "60 days" in the draft
  to the real number.
- **If `FLOW_SERIES_USE_SNAPSHOT=true` and the third query is more than 60
  days ago**, add this after the "How far back" sentence in section 1: "The
  exception is 5-minute bars across all strikes and expirations, which are
  kept permanently and go back to [that date]." Otherwise leave section 1 as
  it is.
- If any query returns nothing for SPX, try `symbol = 'ES'`.

## Draft

Reply in the same thread.

Hi Sanjay,

Thanks for the clear questions. Short answer: yes to all four. How far back each one goes differs, and some of it only reaches back about 60 days, so I've given that per item. Endpoint names match the docs at https://api.zerogex.io/docs, and they all work with a Pro API key.

One note first, since you're working with ES. Our ES levels come from the SPX options book (ES and SPX track the same index), converted onto the ES price. Pass symbol=ES and everything comes back on the futures price already. Historical rows are each converted at their own day's ratio, so a long backtest doesn't drift across contract rolls. The options-based numbers only change during the cash session, 9:30 AM to 4:00 PM ET, so overnight ES trades against the levels as they stood at the close.

**1. Flow Analysis**

Yes. /api/flow/series returns net contracts, call and put premium, call and put volume, net premium and the put/call ratio, in 1-minute or 5-minute bars (timeframe=1min or 5min). Values are running totals for the session, so the change from one bar to the next is that bar's flow. Add date=YYYY-MM-DD for a past day; /api/flow/sessions lists the days available. /api/flow/by-strike breaks the same flow down by strike (calls and puts bought and sold), and both take an expirations filter if you want 0DTE only.

How far back: about the last 60 days. That window moves forward every day, so if you want a longer history, start saving it on your side now.

**2. Gamma Shift**

Yes, as a series. /api/gex/regime-series gives the Gamma Shift read at every 5-minute bar of a session: stability (whether dealers are damping moves or adding to them) and lean (whether the change is supportive or capping), each measured against the session open and against a few bars earlier. Each bar also carries the gamma flip and how much room price has before crossing it, labeled secure, normal, thin or crossing. Add date=YYYY-MM-DD for a past day. This history is kept permanently and goes back to [GAMMA SHIFT START].

/api/gex/regime-history gives one regime read per session, up to 180 sessions per request. The card at the top of the Gamma Shift page (/api/gex/regime-shift) only compares the present moment with an earlier one, so it can't be pointed at a past time. For backtesting, use the series.

**3. 0DTE GEX by strike**

Yes, for about the last 60 days. /api/replay/range?symbol=ES&date=YYYY-MM-DD&expirations=0dte returns every minute of a session with call, put and net GEX at each strike for that day's expiration only, plus the call wall, put wall, gamma flip and max pain recalculated from those 0DTE options alone. It covers strikes within 4% of price by default (strike_band_pct goes up to 10%). Per-strike data is kept on the same rolling 60-day window as the flow.

For the whole options book (all expirations), /api/gex/historical has the gamma flip, call wall, put wall, net GEX and max pain in 1-minute, 5-minute, 15-minute, hourly or daily bars. That history is kept permanently and starts on June 29, 2026. It returns up to 90 bars per request, so page back with start_date and end_date.

**4. Forecast Receipt**

Yes. /api/forecast/{date}?symbol=ES returns that day's morning forecast and, after the close, its receipt. The forecast is written at 8:30 AM ET: projected low, high and close, the implied move, the expected volatility, the gamma flip and walls, the odds of touching the call wall and the put wall, and the odds of crossing the flip. The receipt is added at 4:05 PM ET: the actual low, high and close, whether price stayed in the range, realized versus implied volatility, whether the flip was crossed, and which walls were touched. /api/forecast/available-dates lists the days, and /api/forecast/history/recent gives a compact row per day. It goes back to [FORECAST START]. If you test the volatility call, start from August 4, 2026, when we corrected how it's graded; earlier grades aren't comparable.

**5. Update frequency and timestamps**

- GEX, walls, flip and per-strike GEX: recalculated about once a minute during the cash session.
- Flow: 1-minute and 5-minute bars.
- Gamma Shift series: 5-minute bars.
- Forecast: once a day, at 8:30 AM ET, with the receipt at 4:05 PM ET.

Every row carries a timestamp in ISO 8601, UTC. For live polling, use the v2 paths (/api/v2/...): each response adds a freshness block with when the data was observed, its age, and whether it's fresh or stale, so your system can tell a stalled feed from a closed market. It's a request-and-response API rather than a stream, and polling every few seconds is fine.

Two things that will save you a headache in the backtest:

1. Bars are stamped at their start but carry the value as of their end. Line each row up with the bar that closes at the end of it. Otherwise your backtest sees a few minutes into the future and will look better than it should.
2. Some bars have no gamma flip (the value is empty). That happens when the options book doesn't cross zero near price, so there's no honest level to give. Skip those bars rather than treating them as zero.

If you tell me which of these you plan to rely on most, I can suggest bar sizes and the order to download them in, so nothing ages out before you've saved it.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He wants an intraday forecast, not a daily one.** The intraday cone
  (`/api/cone/session/{date}`, `/api/cone/latest`) re-forecasts the range
  every 15 minutes from 9:45 AM to 3:30 PM ET and grades each claim
  (`src/jobs/intraday_cone_writer.py`; `/api/cone/reliability` is its track
  record). **SPX only through the API:** `/api/cone` is not on the futures
  projection allowlist, so `symbol=ES` answers 400. He'd use SPX and convert
  himself, or you'd add the prefix after auditing its fields.
- **He asks for dealer hedging flow.** `/api/flow/hedging` (estimated hedge
  pressure, 1- or 5-minute bars, 5-minute kept forever) is also
  **not** on the ES allowlist, so it's SPX only. Its `disclosure` field must
  travel with it: it's estimated from trade sides, not observed dealer flow.
- **He wants per-strike or 1-minute flow older than 60 days.** It's gone;
  nothing can rebuild it. Don't promise a backfill.
- **He asks why `/api/replay/range` ignores `timeframe=5min`.** It always
  returns 1-minute frames today. He can downsample on his side.
- **He gets `429 Too Many Requests` while backfilling.** He's paging too
  fast. Slow the loop and honor the `Retry-After` header.
- **He asks which flip to use.** `gamma_flip` is the one the site and
  integrations draw. `gamma_flip_raw` is the nearest zero crossing, which
  other dashboards publish and which often sits much closer to price.
- **He asks for a price or a trial.** Check the current pricing page before
  quoting; prices changed in October (`docs/pricing-october-2026-runbook.md`).
