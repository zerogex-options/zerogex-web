# Trial cancel for premarket history: davebmon@gmail.com (2026-10-18)

A Basic monthly trial was canceled in-app on day 4. Survey reason "Missing
features", typed: *"need premarket historical data"*. Nothing was ever charged.
This is the read, whether the feature is worth building, and one short founder
email to send from your own inbox (one line per paragraph, so it pastes
straight into a mail client).

Everything below is from the cancellation alert and the code on `release` in
both repos. `make diagnose-user` has not been run yet.

| | |
|---|---|
| User id | `user_7ec35425bc776cf4249edd20` |
| Plan | Basic monthly trial, never charged |
| Signed up / trial started | Mon Oct 12, 7:57 PM / 7:59 PM ET |
| Canceled | Fri Oct 16, 9:39 PM ET, in-app, "Missing features" |
| Access ends | **Mon Oct 19, 7:59 PM ET**, with no charge. Monday's premarket is inside it |

## The read

- **"Premarket historical data" can mean three things, and we're in a different
  spot on each.** So the email asks before it explains.
  1. **Premarket price on past days (SPY, QQQ): we have it.** Price bars are
     stored every minute from 4:00 AM ET, every day, with no cutoff. The Gamma
     Terminal chart draws them. It keeps 400 bars, so on 15-minute candles it
     reaches back about a week, on 5-minute about two days, and on 1-minute
     not even to yesterday's premarket.
  2. **Replaying a past premarket against the levels: we don't.** Session
     Replay is 9:30 AM to 4:00 PM only. This is the real gap.
  3. **Premarket on SPX or NDX: no one has it.** The cash indexes don't print
     before 9:30. ES and NQ already cover those hours on the CME feed.
- **Full premarket bar history is in the API, but the API is Pro.** Not worth
  leading with for a Basic trial who left on day 4.
- **No discount.** Price wasn't the complaint.

## Is it worth building?

**Not now.** One trial member, four days, never paid. And we don't know which
of the three he meant. Wait for his answer, or a second member asking for the
same thing.

**If it comes up again, the build is premarket in Session Replay, SPY and QQQ
only.**

- **No new data needed.** The 4:00 AM price bars are already stored for every
  past day.
- **The work.** The 9:30 start is hard-coded in about ten places on the replay
  path: `src/api/routers/replay.py` and the replay queries in
  `src/api/database.py` (zerogex-oa), plus the replay page, scrubber and share
  cards under `frontend/app/replay/` (zerogex-web), which assume 390 frames a
  day. **About 2 to 4 days with tests, across both repos.** The live dashboard
  doesn't use this path, so the risk to paying members is low.
- **The catch on value.** Options don't trade before 9:30, so the premarket
  dealer book is yesterday's, held still. A premarket replay shows price moving
  against levels that barely move. That's useful for "did the premarket high
  stop at the call wall?" but it's a smaller feature than it sounds.
- **One check before building.** Whether premarket level snapshots are saved
  minute by minute or only now and then. On the box, `cd ~/zerogex-oa && make
  psql`, then:

  ```sql
  SELECT (timestamp AT TIME ZONE 'America/New_York')::date AS day, COUNT(*)
  FROM gex_summary
  WHERE underlying = 'SPY'
    AND (timestamp AT TIME ZONE 'America/New_York')::time >= TIME '04:00'
    AND (timestamp AT TIME ZONE 'America/New_York')::time <  TIME '09:30'
    AND timestamp > now() - interval '10 days'
  GROUP BY 1 ORDER BY 1;
  ```

  About 330 rows a day means the levels are saved every minute and the replay
  can show them moving. A handful means the replay would draw the premarket
  candles against the opening levels held flat. Either works, but it changes
  what the feature can promise.

## Verify first

- **His first name.** "Dave" is read off the email address. Check the name on
  the Stripe customer in `make diagnose-user EMAIL=davebmon@gmail.com`. If it's
  unclear, open with "Hi,".
- **Did he write in before?** Search your inbox for the address. If he already
  said what he wanted, answer that instead of asking.

## Draft

Reply to the cancellation ack email if he received it, so it lands in the same
thread. Otherwise, a new email.

**Subject:** Your note about premarket data

```
Hi Dave,

I'm Michael, the founder of ZeroGEX. You canceled your trial with a note that you need premarket historical data, and I'd like to understand it properly before you go.

What were you looking for? For example: premarket price on past days, being able to replay a past premarket against the gamma levels, or premarket on a particular symbol. One sentence is plenty.

In case part of it is already there:
- On SPY and QQQ, the Gamma Terminal chart draws the premarket from 4:00 AM ET, along with the premarket high and low. On 15-minute candles you can scroll back about a week.
- SPX and NDX don't trade before 9:30, so they have no premarket. ES and NQ cover those hours instead.
- Session Replay covers 9:30 to 4:00 only, so you can't replay a past premarket yet.

That last one is the piece I'm weighing adding, and your answer would help me decide. Your access runs until tomorrow evening, so Monday's premarket is yours to look at.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

## If he replies

- **He meant something already there (1 or 3 above).** Point him to it. If he
  wants more time to try it, extend the trial (dry run first):

  ```bash
  make extend-trial EMAIL=davebmon@gmail.com EXTEND_DAYS=7 DRY_RUN=1
  make extend-trial EMAIL=davebmon@gmail.com EXTEND_DAYS=7 YES=1
  ```

  Extending doesn't undo his cancel. Before his new end date, either send him
  `make save-url EMAIL=davebmon@gmail.com` to switch it back on himself, or run
  `make set-cancellation EMAIL=davebmon@gmail.com OFF=1` with `DRY_RUN=1` first.
- **He meant premarket replay (2).** Add him to the request list with his exact
  words. That's the second data point the build waits for. No dates.
- **He wants the raw bars.** That's the API, which is Pro. Say so plainly; no
  pitch.
- **No reply.** Nothing to do. Access ends Monday at 7:59 PM ET on its own.
