# Nilesh Chand: replaying past days of the Gamma Ladder, and an API for it (2026-11-07)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Nilesh Chand (nilesh.chand11@gmail.com) wrote to support@zerogex.io at
3:32 PM, subject "Gamma Ladder":

> First of all, GREAT PRODUCT. My first week using it. I wanted to do some back
> testing and I really like the Gamma Terminal and the Gamma Ladder where I can
> see both ES and NQ active strikes and dollar value. It gives me an option to
> rewind the current day and that is great.
>
> I wanted to back test and look at Monday. Is there a way to do that. Can I
> replay more than 1 day of the gamma ladder for back testing.
>
> or is there an API that can provide that data for me. Appreciate your help.
>
> Thank you and Again its a really awesome product.
>
> -Nilesh.

No earlier thread with Nilesh in this folder.

> **Status:** not sent. Nothing has to be checked first: the draft reads
> correctly whatever plan he's on. Reply in the same thread.

## The answer

Yes to both, with nothing to build. Session Replay (`/replay`) opens any
session from about the last two months, ES and NQ included, minute by minute.
Monday Nov 2 is a full session for both. The API serves the same per-strike
data, one call per day, on Pro.

## The read

- **Lead with Monday's two links.** He asked about one day by name. Two
  clicks answer it.
- **Say how it differs from the ladder.** Replay is one symbol per page, and
  the strikes are bars on a dollar scale, not the ladder's numbered rows. He
  named the dollar figures as what he likes, so he'd notice. The API has the
  exact numbers.
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
- **He's probably on the Basic trial.** "My first week", and the 7-day trial
  is Basic monthly only, while API keys are Pro only
  (`/help/platform/tiers-and-access`). The draft says "API access comes with
  the Pro plan" rather than assuming either way. See the optional check below.
- **No promise of a past-date ladder view.** The ES-and-NQ side-by-side
  ladders he likes exist in replay form only for the latest session (Pair
  Comparison). Noted under "If he replies".

## Verified

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
  `strike`, `call_gex`, `put_gex` and `net_gex`
  (`_shape_range_strike`): dollars per 1% move, the ladder's default unit.
  Pair Comparison's replay builds its ladder columns from these same frames
  (`frontend/hooks/usePairReplay.ts`). Both endpoints are in the public docs at
  https://api.zerogex.io/openapi.json (checked). The router is mounted under
  the `gex` scope (zerogex-oa `src/api/main.py`), the same scope as
  `/api/v1/levels`, so any Pro key that pulls levels can pull replay.
- **API keys are Pro only, self-serve.** Account → API Access
  (`/help/platform/api-access`).

## Optional: his plan

Doesn't change the draft. Run it if you want to know whether he can use the
API today. From `~/zerogex-web` on the box:

```bash
AUTH_DB_PATH=/var/lib/zerogex/auth.db make diagnose-user EMAIL=nilesh.chand11@gmail.com
```

- **Basic, on the trial:** send as written. Moving to Pro ends the trial and
  bills Pro that day, covered by the money-back guarantee
  (`/help/platform/tiers-and-access`, "When you're on a trial"). Only mention
  that if he asks.
- **Pro:** you can change "API access comes with the Pro plan, and on Pro you
  create your own key" to "You're on Pro, so you can create your own key".

## Draft

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

## If he replies

- **"Can I see ES and NQ side by side for a past day, like the ladders?"**
  Not today. Pair Comparison's replay draws both ladders but only plays the
  latest session (`frontend/hooks/usePairReplay.ts` asks for
  `/api/replay/sessions?...&limit=1`). Two tabs of Session Replay is the
  answer for now. Note it; no date.
- **He's on Pro and back testing against his own ES or NQ prices.** Steer him
  to SPX and NDX against SPX and NDX, or to re-basing with his own ratio: the
  ES and NQ values are SPX and NDX times a modeled fair-value ratio, so
  against real futures prints they carry that model's error. Same advice as
  Aaron's note, which also covers `/api/v2/replay/range` and one-expiration
  books via `expirations=YYYY-MM-DD`.
- **He asks for more than two months of strike history.** No promise. Offer
  to look at it if the window is what stops his test, as with Aaron.
- **He asks about the overnight session.** The SPX and NDX books aren't
  recomputed overnight, so an overnight replay would only show the 4:00 PM
  book against a moving futures price. Live, the terminal already draws that.
