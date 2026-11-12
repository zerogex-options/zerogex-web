# Naif: Bot Trading questions, the Trade audit 403, and the dashboard at the open (2026-11-12)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound, Thu Nov 12, 8:50 AM ET.** Naif maibd, subject "Bot Trading Features
and Platform Issues". Same member as `2026-10-27-naif-pro-chart-lag.md`: Pro
monthly at $59, free month credited Oct 27 for the chart lag, so the Nov 18
invoice is $0 and the next charge is Dec 18 (as of that file; re-run
`make diagnose-user EMAIL=na777knsa@gmail.com` if it matters). He asks three
things:

1. How Bot Trading works, and whether it gives real-time SPX call and put
   entries with exact entry prices, profit targets, stop-losses and exits.
2. His dashboard "works before the US market opens, but stops updating when
   trading begins."
3. An HTTP 403 in the Trade audit. Michael reproduced it on his own admin
   account the same morning.

> **Status:** draft, unsent. It can go out before the deploy: the Trade audit
> paragraph says the fix goes live after today's close. If the deploy slips,
> change "after today's market close" to "in the next day or two".

## The read

**Bot Trading (TradeWorkz, Pro, beta).** Michael's line for the reply: it's a
beta, and there isn't enough data yet to confirm a consistent winning strategy.

- **Paper trades only.** Nothing in `src/tradeworkz/` (zerogex-oa) talks to a
  broker, and the bots build synthetic option symbols
  (`_synthetic_option_symbol` in `bots/base.py`). No orders go anywhere.
- **Which symbols: check before sending.** The fleet trades whatever
  `TRADEWORKZ_UNIVERSE` lists. `.env.example` says `SPY,QQQ,SPX`; the code's
  fallback when the box's `.env` doesn't set it is `SPY,QQQ,IWM`
  (`src/tradeworkz/config.py`). The draft says SPX, SPY and QQQ.
- **What a member sees.** Each closed trade: contract, entry and exit price,
  P&L, outcome and close reason. Each open position: target, stop and time
  stop (the Trade audit's open-positions table). Strategies include single
  calls and puts, spreads, straddles and iron condors.
- **Alerts.** Follow, on a bot's card or in the leaderboard, sends entry and
  exit notifications in-app (the bell on the Bot Trading page) and by email.
  The webhook channel stores a preference but delivers nothing yet
  (`content/help/platform/alerts.md`), so the draft doesn't mention it.

**The Trade audit 403: ours, and it hit everyone.** The panel read
`/api/tradeworkz/admin/trades` and `/admin/positions`, behind two locks:

- **The website** maps `/api/tradeworkz/admin` to admin
  (`frontend/core/api/apiTierGate.ts`), so a Pro member like Naif got the 403
  from the website itself.
- **The API** puts every `/admin` route behind `require_admin`, which wants an
  `X-Admin-Token` the website never sends (`_ADMIN_GATE` in zerogex-oa
  `src/api/routers/tradeworkz.py`). That is the 403 Michael saw as admin.

Both locks are right for the fleet controls (reset, provision, simulate). The
two read-only feeds just shared their `/admin` prefix. The panel was built for
Pro members (non-admins were meant to see live trades only), so the fix gives
them their own routes rather than loosening either lock.

**The dashboard stopping at the open: one known cause, not yet shown to be the
whole story.**

- **Nov 6, ThetaData's index feed failed** from about 9:35 ET: SPX, NDX, ES
  and NQ levels froze from about 9:49 until it recovered between 10:08 and
  10:30 (zerogex-oa `docs/runbooks/mag7_rollout.md`). For an SPX trader that
  is exactly "stops updating when trading begins". Our code was not at fault.
- **Whether it recurred on other days is unknown.** The journal holds only
  hours, and nothing in either repo records a repeat. Today's open is the next
  look (Verify first, step 2).
- **Nothing in the website changes at 9:30.** The poll timing
  (`core/pollGate.ts`, `core/refreshProfiles.ts`) has no market-hours switch,
  so the draft asks for the page, symbol, time, what "stops" looks like, and
  his network (the October file found WebSocket blocked on some VPNs and work
  networks).

## What changed

Both on branch `claude/exciting-cori-ayw3u1`. **Deploy zerogex-oa first.** A
website that's ahead of the API asks for routes the API doesn't have yet and
shows "HTTP 404" instead of 403 until the API catches up. Deploy both after the
close: the API restart also restarts the bot engine, which runs inside it.

**zerogex-oa (API)**

- New `GET /api/tradeworkz/trades` and `GET /api/tradeworkz/positions`: the
  same data, filters, paging, summary and CSV as the `/admin` copies, live
  engine entries only. They ignore any `origin` a caller asks for.
- `/admin/trades` and `/admin/positions` are unchanged: still the admin token,
  and still every origin. Both pairs share one query each, so they can't drift.
- `tests/test_api_tradeworkz_member_audit.py`, 13 tests: the new routes answer
  a plain API key, every query they run drops seeder rows whatever `origin` is
  asked, and the admin routes still 403 without the token and still read
  everything with it. On the old code the 8 new-route tests fail and the 5
  admin ones pass.

**zerogex-web (website)**

- `apiTierGate.ts`: the two new routes are Pro. Without this they would have
  been open to anonymous visitors, because the gate passes anything it doesn't
  list. A new test in `tests/apiTierGate.test.ts` fails on the old gate.
- `TradesAuditPanel.tsx` reads the new routes. The admin-only All / Live / Sim
  toggle and the SIM/LIVE column are gone: a browser can never reach seeder rows
  now, so the toggle could only mislabel live trades. The CSV button stays
  admin-only, as before.

## Verify first

1. **The symbols line.** On the box:

   ```bash
   grep TRADEWORKZ_UNIVERSE ~/zerogex-oa/.env
   ```

   If it doesn't list SPX, change the draft's two SPX mentions in the Bot
   Trading section ("including on SPX" and "They trade SPX, SPY and QQQ") to
   the symbols it lists. With no line at all, the code falls back to SPY, QQQ
   and IWM.
2. **Today's open, if you can** (any time during the session; the journal
   rolls over within hours):

   ```bash
   cd ~/zerogex-oa && make quote-cadence
   ```

   SPX and NDX should show about 60 updates a minute with a median gap near
   1.0 s. Then look for stalls since the open:

   ```bash
   journalctl -u zerogex-oa-ingestion --since "-6h" --no-pager | grep -E "Restarting underlying bar stream|still dead|STALE"
   ```

   A line now starts with the symbol and ends with what ThetaData sent
   (`docs/runbooks/ingestion_symbol_gap.md` reads the endings). **If SPX
   stalled today**, replace the draft's last paragraph with: "I checked today's
   session, and our market data provider stopped sending SPX prices for a
   stretch after the open, which is what you saw. I'm working on it with them
   now." Then follow the runbook.
3. **After both deploys**, open https://zerogex.io/trading-signals. The Trade
   audit lists trades with no "HTTP 403", and the open-positions table fills
   during market hours.

## Draft reply

Reply in the same thread.

**Subject:** Re: Bot Trading Features and Platform Issues

Hi Naif,

Thanks for writing. Taking your three questions in order.

**Bot Trading**

Short answer: the bots do produce real-time entries and exits with prices, targets and stops, including on SPX, but they're paper trades in a beta. We haven't collected enough trades yet to confirm that any bot has a consistent winning strategy, so please don't use them as signals for real-money trades yet.

How it works: Bot Trading runs a group of automated strategies, or bots. Each one follows its own fixed rules built on ZeroGEX data, such as the gamma levels, dealer positioning and options flow. During market hours they watch that data live and paper-trade options when their rules line up. Paper trades are simulated, so no orders are ever sent to your account or anywhere else.

Every trade shows the contract, the entry price, the exit price, the profit or loss, and why it closed (target, stop or time limit). While a trade is open, the Trade audit shows its target, stop and time limit. Some bots buy single calls or puts, and others trade spreads, straddles or iron condors. They trade SPX, SPY and QQQ.

To get alerts, click Follow on any bot's card, or next to it in the leaderboard, on the Bot Trading page. You'll be notified when it opens and closes a trade, in the bell on that page and by email.

For now, the best use is to watch how strategies built on our levels behave in different markets, alongside your own analysis.

**The Trade audit error**

You're right, and it was our bug. The Trade audit was requesting its data from an admin-only address, so it was refused for everyone, including me. I've fixed it, and the fix goes live after today's market close. From then on it will show every position the bots hold and every trade they've closed.

**The dashboard stopping when trading begins**

I'd like to see exactly what you're seeing. Could you tell me:

1. Which page and symbol (for example, the Main Dashboard on SPX)?
2. What happens when it stops: do the numbers freeze, does the chart stop moving, or do you see a message?
3. Which days, and roughly what time?
4. Does reloading the page bring it back?
5. Your browser and device, and whether you're on a VPN or a work network.

A screenshot of the page while it's stuck would help most.

One possible cause: on November 6, our market data provider had an outage that began a few minutes after the open, and SPX stopped updating for about half an hour. If that's the day you noticed it, that was the cause. If it's happening on other days too, your answers will let me trace it.

Best,
Michael
Founder, ZeroGEX

## If he replies

- **Details on the freeze.** The journal won't reach back to his days, but the
  price table will: run the gap query in step 1 of zerogex-oa
  `docs/runbooks/ingestion_symbol_gap.md` for SPX over his sessions. Check the
  page he names against the October file's checks
  (`2026-10-27-naif-pro-chart-lag.md`, Checks 2 and 3). If the feed was clean
  on those days, it's his connection or browser. Ask for what Mircea sent
  (`2026-09-28-trial-cancel-slow-page-mircea.md`): the Network tab's Protocol
  column, one slow request's Timing tab, and five minutes on a phone hotspot.
- **"Can I copy the bots with real money?"** Same answer: not yet, and say
  why. The leaderboard's win rate and profit factor are what would change it.
- **Wants a refund or another credit.** Your call. He already has the October
  free month, and the guarantee doesn't cover a converted trial.
