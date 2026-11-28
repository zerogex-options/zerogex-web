# Szabolcs Takács: real-time GEX through MCP, history, limits, alerts (2026-11-28)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

> **Status:** draft, not sent. Run the sale check under "Before sending" first.

## Thread so far

1. **Outbound, automatic.** `Quick note from Michael at ZeroGEX`
   (`sendVerifiedNeverPaidEmail`, `frontend/core/mailer.ts`). It goes about two
   hours after signup to verified accounts that never opened checkout, and
   pitches the 7-day Basic trial.
2. **Inbound, 4:50 PM.** Szabolcs Takács replied. He's building a private
   AI-assisted futures analysis system, "The Eye", for ES, MES, NQ and MNQ. He
   has already connected ZeroGEX to ChatGPT through the MCP server, and works
   with historical CME MBO (Level 3) data from Databento. All trading stays
   manual. He asks:
   1. Which plan gives real-time GEX through the MCP integration?
   2. How often are the levels updated, and what's the latency?
   3. Can he get historical intraday GEX for backtesting?
   4. Are there API or MCP request limits?
   5. Can he get automatic notifications when significant levels change?
   6. Which plan do we recommend?

## The read

- **Correct the MCP assumption first.** The server he connected
  (`https://zerogex.io/mcp`) is the free one, delayed at least 15 minutes for
  everyone, with no key. No plan makes it real-time. Real-time is the Pro API.
  He's building his own system, so the API is the better fit anyway.
- **Recommend Pro, and say why Basic doesn't fit.** The API is Pro-only. The
  trial in the email he replied to is Basic, which has no API. So he should go
  straight to Pro on the money-back guarantee.
- **Futures:** ES is the SPX book and NQ the NDX book, converted onto the
  futures price. MES and MNQ use the same levels. The levels freeze from the
  4:00 PM close to the 9:30 open. If he trades European hours, that matters.
- **History:** whole-chain levels are kept permanently. Per-strike detail
  lasts 60 days, so "start saving it now". Add the look-ahead trap, since he'll
  join our bars to tick-level MBO data.
- **Alerts:** yes for wall hits, breaks and holds, including a Pro API
  stream. No alert when a level itself moves. Say so, and tell him how to
  catch it with the API.
- **One line on terms.** A private system on his own key is personal use.
  Sharing the data or the key isn't. He said "private", so keep it light.
- **Black Friday:** one paragraph, only if he's never held a plan or trial.
  Checkout refuses the sale otherwise.

## Verified

Read from the code on `release`, 2026-11-28. zerogex-web paths unless noted.

**1. MCP**

- The hosted server is public, unauthenticated and delayed. It reads through
  `serverApiGetDelayed`, and no key is read anywhere
  (`frontend/app/mcp/route.ts`, `frontend/core/mcp/`). The delay is
  `FREE_DELAY_MINUTES = 15`, enforced by the backend, and data reaches a
  client 15 to 17 minutes old (`frontend/core/freeDelay.ts`).
- Two tools: `get_gamma_levels` and `get_market_gamma_overview`. SPX, SPY,
  QQQ, NDX, ES and NQ. Current levels only, no history
  (`help/platform/mcp-server.md`).
- Real-time is the Pro API. A self-built MCP server on a Pro key is
  documented, tool definitions included (`help/platform/mcp-integration.md`).
- Terms: a "personal or internal business use" license. No redistributing
  content and no sharing paid access (`frontend/app/terms/Client.i18n.ts`).

**2. Cadence and latency**

- Levels are recomputed about once a minute in the cash session
  (`help/platform/data-coverage.md`, "Refresh cadence by surface"). Production
  runs `ANALYTICS_INTERVAL=30`, so `data_as_of` moves every cycle, but the
  stamp is the minute bucket (zerogex-oa `src/api/freshness.py`,
  `ANALYTICS_CYCLE`). v2 marks a reading stale at 150 s.
- SPX option rows were about 18 s old at the median on Nov 6 (zerogex-oa
  `docs/runbooks/mag7_rollout.md`). The API caches responses for about 5 s.
  "Normally less than a minute old" is safe.
- ES and NQ levels freeze from the 4:00 PM close to 9:30. Open interest comes
  in at the open (`data-coverage.md`, "Market hours").

**3. History** (`data-coverage.md`, "Historical depth")

- `/api/gex/historical`: the flip, walls, net GEX and max pain. Bars of
  `1min|5min|15min|1hr|1day`, at most 90 per request (`window_units le=90`),
  newest first. Page back with `start_date` and `end_date` (zerogex-oa
  `src/api/main.py`, `get_historical_gex`). Kept permanently. SPX (so ES) from
  June 29, 2026. NDX (so NQ) from July 24, 2026.
- `/api/replay/range`: per-strike, 1-minute frames, built from
  `gex_by_strike`, kept 60 days (see
  `2026-11-21-sanjay-pro-api-es-backtest.md`).
- Both accept `symbol=ES` and `symbol=NQ`: `/api/gex/` and `/api/replay/` are
  on the futures projection allowlist (zerogex-oa
  `src/api/futures_middleware.py`, `_PROJECTABLE_PREFIXES`). Historical rows
  are projected on their own session's basis.

**4. Limits**

- App limiter: `END_USER_RATE_LIMIT_REQUESTS=600` per 60 s. The counter is per
  uvicorn worker, and the API runs 4 (zerogex-oa `src/api/ratelimit.py`,
  `.env.example`, `setup/systemd/zerogex-oa-api.service`). nginx allows 500
  requests a second per IP (`deploy/steps/120.nginx_api`). Whether production
  enforces the app limit isn't visible from here. "Several hundred a minute"
  holds either way.
- Over the limit: `429` with `Retry-After` (`help/platform/api-access.md`).
- MCP: no key, so no per-user quota. It refreshes about once a minute.

**5. Alerts** (zerogex-oa `docs/design/wall-alerts.md`)

- Events: `hit`, `break` and `hold` on call and put walls. A hit is seen
  within about 5 s of the print (`WALL_ALERTS_POLL_SECONDS`).
- Filters: a noise profile (responsive, balanced or conservative), a strength
  percentile and a touch tolerance.
- Website: Basic and up. Delivery in-app, by email, and to a Discord or Slack
  channel (`app/account/alerts/page.tsx`, `app/api/account/alert-webhook`).
- Pro key: `/api/alerts/walls/stream` (SSE) and `/api/alerts/walls/events`.
- Symbols: SPY, QQQ, SPX and NDX only. ES and NQ are left out on purpose:
  futures traders set the alert on the index (zerogex-oa
  `src/alerts/config.py`). SPX and NDX only print in the cash session, so
  that's when alerts fire.
- No alert when a level moves. The "wall is now X (was Y)" text in
  `wall_detector.py` is only a trace line for the replay tool.

**6. Price** (`frontend/core/billingPlans.ts`, `docs/black-friday-2026-runbook.md`)

- Pro: $59 a month, $115 a quarter, $299 a year.
- Black Friday, first year: $29.50 a month for 12 payments, $149.50 for the
  first year on annual. It runs to 11:59 PM ET Tuesday, December 1, for
  accounts that have never held a plan or trial. The money-back guarantee
  covers it.

## Before sending

Check that he can buy the sale. On the EC2 box:

```bash
cd ~/zerogex-web && make diagnose-user EMAIL=takacs.sz@gmail.com
```

- **A free account that never held a plan or trial** (expected, since the
  email he replied to only goes to signups who never opened checkout): send
  as is.
- **Any past or current plan or trial:** replace the paragraph that starts
  "Pro is normally" with this line: "Pro is $59 a month or $299 a year:
  https://zerogex.io/pricing". Keep the guarantee paragraph after it.

## Draft

**Subject:** Re: Quick note from Michael at ZeroGEX

Hi Szabolcs,

Thanks for the detail on The Eye. Short answer: Pro, using our API rather than the MCP server you've connected. Here are your questions in order.

**1. Real-time GEX through MCP**

The MCP server you added to ChatGPT is our free one. It serves levels delayed at least 15 minutes, to everyone, and no plan changes that. Real-time data comes with Pro, through our API with your own key: https://api.zerogex.io/docs

For a system like yours, the API is the better route anyway: The Eye can call it directly and get the levels, per-strike gamma and history as JSON. If you also want ChatGPT to see live levels, you can run a small MCP server of your own that calls the API with your key. A private setup for your own trading is exactly what the key is for. The one thing our terms rule out is sharing the data or the key with others. This guide has tool definitions to start from: https://zerogex.io/help/platform/mcp-integration

On symbols: our ES levels come from the SPX options and our NQ levels from the NDX options, since they track the same indexes, converted onto the futures price. Pass symbol=ES or symbol=NQ and everything comes back in futures prices. MES and MNQ use the same levels as ES and NQ.

**2. Update frequency and latency**

The gamma flip, call and put walls, max pain and per-strike gamma are recomputed about once a minute during the US cash session, 9:30 AM to 4:00 PM New York time. We re-read the option chain continuously and calculate the Greeks ourselves, so the levels are normally less than a minute old when you read them. Our v2 endpoints (/api/v2/...) add a freshness block to every response with the exact age and whether the data is fresh or stale, so The Eye can check rather than assume.

Two things matter for futures. Overnight and before the open, ES and NQ trade live against the levels as they stood at the 4:00 PM close, because the options behind them are only priced during the cash session. And open interest updates once a day, entering the levels at the 9:30 open.

**3. Historical intraday GEX for backtesting**

Yes, through the API on Pro:

- /api/gex/historical has the gamma flip, call wall, put wall, net GEX and max pain in 1-minute, 5-minute, 15-minute, hourly or daily bars. It's kept permanently and starts on June 29, 2026 for ES and July 24, 2026 for NQ. Each request returns up to 90 bars, so page back with start_date and end_date.
- /api/replay/range has every minute of a session with call, put and net gamma at each strike. That detail is only kept for a rolling 60 days, so if you'll want it later, start saving it on your side now.

Both take symbol=ES or NQ, and each historical row is converted at its own day's ratio, so a long test doesn't drift across contract rolls. Timestamps are ISO 8601 in UTC, which should line up easily with your Databento data. One trap to avoid: each bar is stamped at its start but carries the values from its end, so line it up with the bar's close, or the backtest will see a little into the future.

The free MCP server has current levels only, no history.

**4. Request limits**

The API limits requests per key per minute, set far above what a system like yours needs: several hundred requests a minute. If you ever go over, you get a 429 response with a Retry-After header saying how long to wait. Since the levels change about once a minute, polling every 5 to 10 seconds is plenty. The free MCP server has no per-user limit, but it only refreshes about once a minute.

**5. Notifications**

Yes, for the walls. You can set alerts for when price hits, breaks or holds at a call or put wall, with filters for wall strength and how much chop to ignore. On the website they arrive in the app, by email, or in a Discord or Slack channel. With a Pro key, The Eye can also keep a live stream open (/api/alerts/walls/stream) and get each alert the moment it fires. Alerts are set on SPX and NDX, the indexes behind the ES and NQ levels, so they name the index level and fire during the cash session.

We don't send an alert when a level itself moves, such as the call wall shifting to a new strike or the gamma flip jumping. The Eye can catch that by reading /api/v2/levels/ES once a minute and comparing it with the previous reading.

**Which plan**

Pro. The API is only on Pro, and it's what gives you the real-time levels, the history and the alert stream. Basic has the same live levels on the website, but nothing The Eye could connect to. The free trial in my earlier email is for Basic, so for your use I'd go straight to Pro.

Pro is normally $59 a month or $299 a year. Our Black Friday sale runs through Tuesday, December 1: 50% off your first year for first-time members who pay at signup. That's Pro at $29.50 a month for your first 12 months, or $149.50 for the first year on annual, applied automatically at https://zerogex.io/pricing

Pro comes with our 7-day money-back guarantee: if it isn't the right fit for The Eye, you can request a full refund from your account page within 7 days of your first payment. Once you're on Pro, you can generate your API key under Account → API Access.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **"Can I trial Pro first?"** No Pro trial. The 7-day trial is Basic monthly
  only, and Basic has no API key. Pro's first payment is covered by the 7-day
  money-back guarantee, one refund per customer.
- **"How do I connect my own MCP server to ChatGPT?"** That setup is
  ChatGPT's side. Our half is the guide (`help/platform/mcp-integration.md`):
  build on `/api/v2/levels/{symbol}`, put the data's age in the tool text,
  and keep the key on the server. Don't describe ChatGPT's menus from
  memory.
- **He asks for MES or MNQ as a symbol.** The API doesn't know them (the levels
  endpoint answers `404`). Use ES and NQ.
- **He wants levels that update overnight or in European hours.** Not today.
  SPX and NDX options are only priced in the cash session. Don't give a date.
- **He wants per-strike history older than 60 days.** It's gone, and nothing
  can rebuild it. Don't promise a backfill.
- **He asks for ES or NQ alert symbols.** The API answers `422` and says to use
  SPX or NDX. Futures alerts are left out on purpose (`src/alerts/config.py`).
- **He asks for alerts posted to his own server (a webhook).** Not today. The
  webhook channel only posts to Discord and Slack, on purpose (see
  `2026-10-26-aaron-wall-alerts-api.md`). The stream gives him the same
  thing, with his program connecting out.
- **He asks for a "level moved" alert.** Not built. It's a reasonable request
  from a Pro API user. If you want to build it, it's your call. No promise or
  date in the reply.
- **He asks for the exact rate limit.** Check first with
  `grep END_USER_RATE_LIMIT ~/zerogex-oa/.env`. The counter is per worker, and
  there are 4, so the real per-key ceiling is up to four times the number
  there.
- **He gets `429` while backfilling.** He's paging too fast. Slow the loop and
  honor `Retry-After`.
- **He plans to sell The Eye or share it with others.** Personal or internal
  business use only. Redistribution needs written permission. That's a
  licensing conversation, so don't agree to it in passing.

## Worth knowing (not urgent)

- **No help page covers wall alerts for members.** The Gamma Terminal page
  links the wall-alert bell to `help/platform/alerts.md`. That page is about
  signal triggers. It says alerts are "in-app, not by email" and that "a wall
  moving" isn't an alert. Someone checking the help center before buying, as
  Szabolcs might, would conclude there are no email or Discord alerts. Can
  wait.
