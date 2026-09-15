# Dom Baranowski — good week, unused preset, and our own MCP server (2026-09-14)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Dom (dom.dragonsnake@gmail.com) is a **Pro** subscriber — Trade Bias, Composite
Score and EOD Pressure are all `requiredTier: 'pro'` in `core/navigation.ts`,
and he holds an API key for the MCP server he built. Converted off the
August trial; this is the same thread as the day-N trial value email.

## Thread so far

1. **2026-08-21, outbound.** Trial value email (`buildTrialValueEmail`).
2. **2026-08-26, inbound.** Trade Bias useful for 0DTE on QQQ, but the product is
   overwhelming. Asked for preconfigured "My Dashboard" templates for 0DTE.
3. **2026-08-26, outbound.** Horizon dropdown, pin-to-favorites, hand-built QQQ
   0DTE board, and an offer to build a 0DTE preset for him to review first.
4. **2026-08-26, inbound.** "Please send the preset." Uses thinkorswim, so no
   indicator integration — and *"I am in the middle of building an MCP
   integration of your API for Claude to use."*
5. **2026-08-27, outbound.** Shipped the preset instead of screenshotting it;
   rolling 0DTE fix; horizon persistence; "Regime & Playbook" rename; thinkScript
   sandbox explanation. Wrote him
   [the MCP integration page](/help/platform/mcp-integration) and set the
   reselling boundary. *"You're the first person building against this."*
6. **2026-08-27, inbound.** "My MCP server will only be for me. No reselling."
7. **2026-08-27, outbound.** Asked for two things when he got to them: the 0DTE
   preset review after a live session, and gaps in the MCP page.
8. **2026-09-14, inbound.** The mail being answered. See below.

## What Dom actually said

- Three of his best trading days in a row last week; "cautiously optimistic."
- Technicals screen for bearings. **Trade Bias and Composite Score are his go-tos.**
- Still learning the rest of the signals and metrics.
- **The EOD Pressure Signal was accurate on Friday.** He trusted it enough to
  re-enter after being stopped out, and made money on the next candle.
- **He is not using the QQQ 0DTE preset** built for him. He'll work out why and
  report back. Jumping around **favorites** suits him better.

Note what that last one is: it is the preset review requested in (7), and the
answer is "I don't use it." That is the most actionable thing in the mail.

## The read

### Yes, we shipped our own MCP server — and it does not replace his

`f95cfa8` (2026-09-08) added a hosted server at `https://zerogex.io/mcp`
(`frontend/app/mcp/route.ts`), listed in the official registry as
`io.zerogex/gamma-levels` since 2026-09-10 (`docs/mcp-registry.md`,
`server.json`). Two tools: `get_gamma_levels` and `get_market_gamma_overview`.

**It is the free, 15-minute-delayed tier — no key, no account.** Same data and
the same 900s cache entry as the public gamma-levels pages. `docs/mcp-registry.md`
is explicit that the real-time keyed feed is deliberately *not* on it, and that a
keyed server would be a separate registry entry if it ever ships.

So telling Dom "we built one" without that qualifier would read as though his
build was wasted. It wasn't: his runs on his Pro key against the real-time feed,
which is strictly more than the hosted one does. What is worth handing him is the
implementation, not the endpoint:

- **`core/mcp/levels.ts` `freshnessLine()`** is a working version of the
  age-in-the-text argument pushed at him on Aug 27, with a four-state ladder
  (undated / market-closed / running behind / stale) and the instruction half
  attached to each. The market-closed branch is the non-obvious one — it stops an
  assistant hedging about a last-snapshot-of-session reading that is fine.
- **The thresholds do not port.** `DELAY_SECONDS = 900`, `BEHIND_SECONDS` is 2×
  and `STALE_SECONDS` is 4× that — 30 and 60 minutes, scaled to the free tier's
  cadence. The Pro feed recomputes roughly once a minute, so those constants would
  let a stalled real-time feed look healthy for half an hour. He must rescale.
- **`get_market_gamma_overview`** — one call for all six symbols — exists because
  "what does positioning look like today" was six single-symbol calls.

Also worth telling him: **the page he built from has changed.**
`mcp-integration.md` now opens with a callout pointing at the hosted server, so
the structure moved. The endpoint contract and tool shapes did not change.

### The scorecard is unreachable from the website

Michael did not know these pages existed. Checked, and he could not have:

| route | in `core/navigation.ts` | inbound links in app |
| --- | --- | --- |
| `/scorecard/*` | **0** | **0** |
| `/forecast/*` | 1 | 1 |
| `/cards/*` | 0 | 1 |
| `/replay/*` | 1 | 2 |

`/scorecard` is the **only** member of the public-receipt family with no way in.
It is not in the sidebar, not linked from any page or component, not referenced in
any help or education content, and it is absent from the sitemap — `next-sitemap`
generates one at build time from `frontend/next-sitemap.config.mjs`, whose
`additionalPaths` lists `/replay` and `/forecast` but never `/scorecard`. It was
not excluded; it was never added. It is deliberately anonymous-accessible (`core/auth.ts`
allowlists `/scorecard/*` so OG crawlers and non-members can load it), and it was
built as the landing page for the 4:15 PM ET auto-tweet — so the only entrances
are that post, the X profile link to `/scorecard/today`, and knowing the URL.

The draft says this to Dom plainly rather than presenting the link as something he
should have found. It is also the single highest-value ticket to come out of this
mail: a public, per-session, per-signal receipt page that nobody can navigate to.

### EOD Pressure: the scorecard row is mismeasured, and that is the story

Friday's page was opened before sending. It shows, for QQQ on 2026-09-11:

| | flips | wins | losses | avg fwd return |
| --- | --- | --- | --- | --- |
| Eod Pressure | 3 | 2 | 1 | **−0.00%** |

Eleventh of twelve signals, closing regime long gamma, MSI 0.7, 55 Playbook calls.

**Do not send Dom that number as a verdict — it is a measurement artifact.**

- `eod_pressure` is **structurally confined to the last 90 minutes.** Its time
  ramp is zero until 90 minutes before the close and full by 15 minutes before
  (`src/signals/advanced/eod_pressure.py`: `_WINDOW_START_MIN_TO_CLOSE = 90`,
  `_WINDOW_RAMP_END_MIN_TO_CLOSE = 15`; `SESSION_CLOSE_MIN_ET = 16*60`). Every
  non-zero reading, and therefore every flip it can register, falls in
  **14:30–16:00 ET**.
- **The scorer has no session bound.** `src/api/queries/signals.py` (~1435) takes
  the forward price from a lateral join: the first `underlying_quotes` row with
  `timestamp >= scs.timestamp + INTERVAL '60 minutes'`, ordered ascending, LIMIT 1.
  Nothing caps how far past that point it may reach and nothing requires the same
  session.
- **So any flip after 15:00 ET is scored against a post-close print.** On Friday
  2026-09-11 that is an after-hours quote or **Monday's open** — a weekend gap
  reported as a 60-minute forward return.

All three of Friday's flips were scored (3 flips, 2+1 resolved, no NULLs), which is
consistent with the join reaching past the close rather than returning nothing —
compare Trap Detection, 6 flips but only 5 scored.

Exact flip timestamps are not readable from here, so the claim in the draft is
kept to what the code guarantees: the window is unreliable **by construction** for
this signal, and at least the post-15:00 flips were scored across the close. It
does not assert that all three were.

This is the best thing in the mail. A subscriber praised a signal, and the honest
answer is that our own page cannot currently grade it — found because he wrote in.

**The remaining evidence still points the wrong way, and still ships.**
`zerogex-oa: src/strategies/catalog.py` carries `eod_pressure_drift`
("Last-Hour Hedging Drift") at **profit factor 0.55 over 163 trades**, verdict
`NO_EDGE`, from the 2026-08-09 fleet screen — 45-day window, SPY/QQQ/SPX.

**Two qualifiers make that fair rather than cherry-picked, and both go in the mail.**

1. It is **not a measurement of the signal Dom read.** The catalog note is
   explicit: it "entered on displacement from `max_pain` alone — no measurement of
   whether dealers actually had to trade toward the pin." It measures a naive way
   of trading the same idea.
2. It was **one of a whole fleet that was underwater.** `_fleet_screen()`'s
   default note: "best PF in the fleet was 0.78." Quoting 0.55 without that would
   single out the strategy he likes.

The successor, `charm_close_magnet` ("Charm Close Magnet"), adds the forced-flow
test and screens at **PF 1.31 — on 11 trades, verdict `INSUFFICIENT`**. Not a
result. All of this is readable by him at Pattern Insights (`/backtesting/insights`,
Pro, beta), which shows research stage and evidence including failures (`1e85370`).

This is the FirmTape move applied to ourselves: publish the number that costs us,
with its denominator, in the same sentence as its sample size.

### The unused preset is the review, and favorites has a trap

Do not push him back onto the board. He offered to work out why himself, and the
useful feedback is the one that comes after he notices it.

One hypothesis worth putting to him: Technicals → Trade Bias → Composite Score is
a **sequence**, and a board is a single fused view. Boards are bad at sequences.
If that is what is happening, it is a design answer, not a layout bug.

**The trap:** favorites live in `localStorage` under `zg.nav.favorites.v1`
(`components/Navigation.tsx:31`) — per browser, not per account. New machine, new
browser, or cleared site data and the list is gone. Worth one sentence now that
favorites is his actual workflow.

## Verify first

**Send this after the fixes are deployed, not before.** The draft says the
scorer is fixed and the Scorecard is in the sidebar, and it describes what Dom
will see when he clicks. If it goes out against the old build, he clicks
through to the `−0.00%` the mail spends four paragraphs disowning, and to a
sidebar with no Scorecard in it.

Once deployed, check in this order:

1. **`https://zerogex.io/scorecard/QQQ/2026-09-11`** — the EOD Pressure row
   should now show a `Scored` count below its 3 flips, and read "not scorable"
   if none of the three could be graded. If it still shows `−0.00%`, the
   backend did not deploy; do not send.
2. **The sidebar** — "Daily Scorecard" under Strategy Tools, and `/scorecard`
   should open the card grid with one tile per recent session. Check the
   symbol picker switches the list, and that a tile opens its dated page.
3. **A signal page** (`/eod-pressure`) — the last-30-sessions line under the
   event timeline. If the trailing endpoint is not live the line simply does
   not render, which is safe, but the mail promises it, so confirm it.
4. The 0.55 / 163 / 0.78 / 1.31 / 11 figures are read from `catalog.py` as
   committed. If the catalog has been re-screened since, re-read it.

Dom's symbol is QQQ throughout the thread and the screenshot confirms the QQQ
page is the right one.

## Links used

- https://zerogex.io/scorecard/QQQ/2026-09-11
- https://zerogex.io/backtesting/insights
- https://zerogex.io/mcp
- https://zerogex.io/help/platform/mcp-server
- https://zerogex.io/help/platform/mcp-integration

## Draft

**Subject:** Re: Getting a real read out of your ZeroGEX trial

Hi Dom,

That's good to hear, and thank you for saying it. The part that stands out to me isn't the three days — it's that you got stopped out and still took the next signal. That's the hard half, and most people can't do it.

"Cautiously optimistic" is the right register, so let me give you the material to stay cautious with, because I'd rather do that than take a victory lap on your week.

On Friday's EOD Pressure call, I went and looked. What I owe you is a link, an admission, and a bug you found without knowing it.

The link: https://zerogex.io/scorecard/QQQ/2026-09-11

Every session gets one. It breaks out each signal's flips, wins, losses and average forward return, alongside the closing regime and how many Playbook calls fired. Friday was 55 calls, closed long gamma.

The admission, because it's the embarrassing half: until this week you could not have found that page. There was no link to it anywhere on the site — not in the sidebar, not in the help center, and it wasn't even in our sitemap. It was built as the landing page for the daily recap post, so the only ways in were that post or already knowing the URL. I didn't notice until I went looking for your Friday. Every other page of that kind — the replay, the morning forecast, the card permalinks — you could reach from inside the product. That one got missed. It's in the sidebar now, under Strategy Tools next to Daily Replay, and it opens on a list of every recent session rather than dropping you on one date — so you can go straight to the day you want to look at.

Now the part I'd rather you heard from me. When I opened Friday to check it before writing this, EOD Pressure was sitting near the bottom of the table at 2 wins, 1 loss, average −0.00%. That number was wrong, and not in my favor.

EOD Pressure is the only signal there that can't fire during most of the day — it's zero until ninety minutes before the close, by construction. The scorecard graded every signal on where price sat sixty minutes after it fired. For anything firing after 15:00, sixty minutes later is past the bell, so it was being graded against an after-hours print — and Friday being a Friday, potentially against Monday's open. A weekend gap was being reported as an hour of trading.

So that −0.00% was never the signal being flat. It was my scorer measuring the wrong window for the one signal that only lives near the close, and it had been doing that on every session since the page shipped. Your email is the only reason I found it. It mattered more than one page, too: that same number picks the best and worst signal in the recap post that goes out every afternoon, so a mismeasured signal could get named in public.

It's fixed. The forward price now has to come from the same session, and a flip too close to the bell to grade shows as "not scorable" instead of a number. You'll see a new Scored column next to Flips — that's how many of a signal's flips could actually be graded. For EOD Pressure it will often be well under its flip count, and on some sessions it will be none at all. That reads worse than a tidy −0.00%. It's also the truth, which is the only version worth having.

The other half of that gap is fixed too, and it's the one I think you'll actually use. Nothing in the product aggregated a signal across sessions — the scorecard was one day, so "is EOD Pressure any good?" was a question my own product couldn't answer. Each signal's page now carries its last 30 sessions underneath the event timeline: flips, how many were scorable, the win/loss split and the average. That's the number to judge a signal on. Friday is an anecdote.

What I do have, and you should have it rather than not, is one measurement that points the wrong way.

We screened a mechanical strategy built on that last-hour drift — "Last-Hour Hedging Drift" — over a 45-day window across SPY, QQQ and SPX in August. 163 trades, profit factor 0.55. It lost money and we shelved it.

Two things stop that from being the whole story, and you should have both rather than only the scary half. That strategy entered on displacement from max pain alone — it never tested whether dealers actually had to trade toward the pin — so it measures a naive way of trading the idea, not the signal you read on Friday. And it was one of an entire fleet screened that day, where the best profit factor of anything was 0.78. Everything was underwater, not just that one. The successor that adds the forced-flow test screens at 1.31, but on 11 trades, which isn't a result yet.

You can read all of it yourself rather than take my summary: Pattern Insights lists every strategy with its research stage and a line of measured evidence, failures included. https://zerogex.io/backtesting/insights

None of that says Friday was luck. It says I can't tell you it wasn't, and I'd rather you hear that from me than discover it at size.

On the QQQ board — you not using it is the review. That's the honest answer to what I asked for, and it's more useful than a list of widgets you'd reorder. Don't force yourself back onto it before you know why; the version of that feedback I can act on is the one you give me after you catch yourself doing something else.

One guess, for you to confirm or kill: Technicals for bearings, then Trade Bias, then Composite Score is a sequence, and a board is one fused view. Boards are bad at sequences. If that's what's going on, that's a real design answer and not something I fix by moving tiles around.

Since favorites is your workflow now, one thing to know before it bites you: that pinned list is stored in the browser, not on your account. A new machine, a different browser, or cleared site data and it's gone. It's a minute to rebuild, but not a minute you want to spend at 9:30.

And yes — since we last talked I shipped an MCP server, which I should tell you plainly does not replace yours.

https://zerogex.io/mcp is hosted, free, no key, no account, and it's in the official registry as io.zerogex/gamma-levels. But it serves the 15-minute-delayed levels, the same data as the public pages. It's for people who don't have a key. Yours runs on your Pro key against the real-time feed, so it does something mine can't, and you should keep it.

What's worth your time is how it handles freshness, because that's the thing I pushed hardest at you in August and now there's a working version rather than advice. Every tool result opens with a line that states the snapshot's age in the text and tells the model what it may say about it, across four states: no timestamp, market closed, running behind, and stale. The market-closed branch is the one I'd lift — it's what stops the assistant hedging about a last-snapshot-of-the-session reading that's perfectly good at 7pm.

One thing to change if you do lift it. My thresholds are scaled to a 15-minute cadence: "running behind" is 30 minutes, "stale" is an hour, because that's two and four refresh cycles at the free tier. Your feed recomputes about once a minute, so those same numbers would let a genuinely stalled feed look healthy for half an hour. Scale them to your cadence, not mine.

The other thing worth stealing is a second tool that returns spot, regime and flip for all six symbols in one call. "What does positioning look like today" was making the assistant call the single-symbol tool six times in a row.

Worth knowing too: the page I wrote you has changed since you read it. It now opens by pointing at the hosted server, so the layout moved around. The endpoint and the tool shapes are the same — nothing you built against has moved.

Which brings me to the only thing I still want from you, and it's the same one from August: was anything on that page wrong or missing when you actually built against it? You're still the only person who's done this. I'd rather fix it from your build than guess at where the gaps are.

Best,
Michael
Founder, ZeroGEX

## What was built, and what was not

Both P1s and two of the three follow-ups are implemented on
`claude/upbeat-carson-bnw2qc` in both repos.

**Fixed — forward returns are session-bounded** (`zerogex-oa`). All three
forward-return queries now bound the forward price to the event's own session:
`get_daily_scorecard`, `get_signal_component_events` (the per-signal Event
Timeline — same bug, found by the regression test) and the new trailing-record
query. A flip too near the close is counted in `flips` and absent from
`scored`, which the aggregate already modeled. Half-days resolve through the
shared `session_close_for`, so an early close bounds at 13:00 ET.
`tests/test_scorecard_session_bound.py` pins the boundary arithmetic, both DST
sides, the half-day path, the calendar-failure fallback, and asserts every
`q1` join carries a bound — it is what caught the second instance.

**Fixed — the Scorecard is reachable** (`zerogex-web`). `/scorecard` is now a
landing page built to match Daily Replay: the same shell, header, symbol
picker, card grid and about-panel, with one tile per recent session. Each tile
carries the date, the regime the day closed in (colored bull / bear / warning,
and "unknown" in muted text when the engine wrote no regime — it must not
borrow the color of a real one) and the Playbook call count, with the same
`useLinkStatus` click feedback the replay tiles use. Backed by a new
`GET /api/scorecard/sessions`, mirroring the `/api/replay/sessions` and
`/api/forecast/available-dates` contract so a card renders without a fetch per
day. Plus: a "Daily Scorecard" entry under Strategy Tools in all five locales;
`matchPrefix` on nav items so a section whose real pages are dated permalinks
still highlights (now on Replay and Forecast too, which had the same gap);
`/scorecard` added to `next-sitemap.config.mjs` (`additionalPaths` and
`DAILY_TOOL_PATHS`); and a link from every signal page via the shared
`SignalEventsPanel`.

**Fixed — a signal's record across sessions** (both repos).
`GET /api/scorecard/signal-record` aggregates the same flips over 2–120
sessions, and every signal page now shows its last 30 underneath the event
timeline. `win_rate` is `null` rather than `0` when nothing was scorable, so an
unmeasurable signal never reads as a 0% win rate.

**Fixed in passing — signal labels.** `_humanize_signal_name` was `.title()`,
which produced "Eod Pressure" and "Zero Dte Position Imbalance" on the public
page *and* in the 4:15 PM ET post. Now "EOD Pressure" and "0DTE Position
Imbalance".

**Fixed — preset adoption is measured.** `dashboard_preset_applied` on apply,
and `dashboard_preset_retained` at most once a day on any later day the
preset-seeded board is still in use, carrying `days_since_applied`. An emptied
board clears the stamp rather than counting as retention. The retention check
is gated on `hydrated` — unguarded it would read the pre-hydration empty layout
as abandonment and wipe the record on every page load.

**Not built — server-side user preferences.** The original ticket said
favorites should persist server-side "like dashboard layouts". That premise was
wrong: `saveLayout` writes to `localStorage` too. No user preference in the
product survives a new browser, and `zerogex-oa` has no preferences table or
endpoint to sync to. This needs new infrastructure plus a product decision —
what syncs, what wins on conflict, what happens to existing local state — so it
is left for a deliberate change rather than improvised here.
