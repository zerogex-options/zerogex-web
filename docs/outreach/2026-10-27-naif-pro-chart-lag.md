# Naif: Pro chart freezing and lagging (2026-10-27)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound, Tue Oct 27, 1:34 PM ET.** Naif maibd (na777knsa@gmail.com), subject
"Urgent Complaint – Chart Lag and Freezing on ZeroGamma Pro". Recently paid for
and upgraded to Pro; "constant chart freezing, lagging, and significant delays
in chart updates during live trading hours". Asks for the cause, a fix, and a
prompt reply. No page, browser, device or location named. "ZeroGamma" is his
name for ZeroGEX; nothing on the site is called that.

> **Status:** fixed, deployed, and his free month credited; the draft below is
> the reply. Both branches deployed Tue Oct 27 after the close (website
> restarted 7:38 PM ET); the memory brake was already off
> (`MemoryHigh=infinity`). Free month credited the same evening (His account).
> The chart still moved only every 5 to 40 seconds on Wed Oct 28: the price
> feed itself was slow. Fixed and deployed mid-session the same day; every
> symbol now updates about once a second (Follow-up, Oct 28).
>
> **On the box, found during the deploy:** zerogex-oa's `.env` set
> `LATEST_QUOTE_CACHE_TTL_SECONDS=5`, not the 1.5 in `.env.example`, so the API
> held each price for 5 seconds on top of nginx's 5. Edited before the restart;
> reads 0.1 (checked the same evening).
>
> **Verified from outside, 7:46 PM ET:** a request carrying `fresh=` comes back
> `cache-control: no-store` and `X-Cache-Status: MISS` every time, an unmarked
> one still caches, and the live chart's JavaScript builds its candle URL with
> `withFresh`.

## His account (`make diagnose-user`, Oct 27)

Pro monthly at $59, upgraded from Basic on Oct 25 ($16.06 prorated). Trial Oct
11 to 18; the $39 conversion charge was declined three times for insufficient
funds and cleared Oct 24. $55.06 collected in all. Next charge $59 on Nov 18.
His subscription has no `money_back=1` (a converted trial), so the 7-day
guarantee doesn't apply; the free month is goodwill.

**Free month: done**, evening of Oct 27, with
`make gift-month EMAIL=na777knsa@gmail.com NOTE="chart lag" YES=1` after a dry
run. One month of his plan, $59.00, credited to his Stripe balance (balance
transaction `cbtxn_1UVMFV4AOiqteMYYAwwXtXwh`, "Goodwill: 1 free month (chart
lag)", tag `goodwill-2026-10-27`). Its output: balance -$59.00, and the Nov 18
invoice at $0.00 due. He is charged again Dec 18. Don't run it again: the
same-day guard would not stop a second gift on a later day.

## The read

**He's right, and it's ours, twice over.**

**Today's freezing: the API's memory brake.** Found by another session the
same afternoon (zerogex-oa `87271c89` on `release`, "API: drop the 1800M memory
brake that was freezing it"). Today the API sat right at its 1800M soft memory
limit, and the kernel kept putting its workers to sleep: in today's journal,
`/api/market/quote` took 5 seconds or more 12,859 times and `/api/gex/summary`
15,657 times, and in one stall requests some 20 seconds old all finished in the
same second. That is "constant chart freezing during live trading hours". It
fixes on the running API without a restart; see check 0.

**The lag behind it: nginx's cache.** The Gamma Terminal asks for its price and its
last candles every second, but nginx keeps every `/api/` answer for 5 seconds
per member and serves the old copy while it refreshes (`deploy/steps/070.ssl`,
`proxy_cache_valid 200 5s` with background updates). So:

- **The candles** moved only every 5 to 6 seconds, for everyone, and each new
  candle appeared about 4 seconds after its minute began.
- **The price** was live for members whose WebSocket connects (it bypasses
  nginx's cache), but for anyone whose WebSocket doesn't (some networks, VPNs
  and corporate firewalls block it) it also moved only every 5 to 6 seconds and
  ran up to 7 seconds behind.

**Measured today**, on a test copy of the whole stack with production's nginx
cache settings and a feed that publishes a new SPY price every second, in a real
browser on the Gamma Terminal (1-minute candles, HTTP path):

| | Before (release) | After (the branches) |
|---|---|---|
| Longest the headline price stood still | 6.1 s | 1.1 s |
| Price behind the newest (median / worst) | 3.1 s / 7.2 s | 0.4 s / 0.9 s |
| Longest the newest candle stood still | 6.0 s | 1.1 s |
| New candle on screen after its minute's first price | 4.1 s | 0.5 s |
| Price/candle answers served from nginx's cache | 399 of 407 | 0 of 405 |

When I probed the live API from outside, 2:05 to 2:22 PM ET, it answered in
80 ms at the median with no errors, apart from one 2.8-second stall at 2:05 PM
on a request that does no work at all, which fits the memory brake. The cache
lag is not an outage: the chart has worked this way since the cache went into
nginx's `/api/` block on 2026-05-05 ("add proxy_cache for heavy historical
queries").

## What changed

Both on branch `claude/relaxed-gates-ywtv20`. **Deploy zerogex-oa first.** The
website change sends the candle polls to the API every second instead of every
five, which is only safe once the candle query is cheap.

**zerogex-oa (API)**

- **Candle query** (`get_historical_quotes`, `get_historical_futures`): finding
  "the last 3 candles" read the symbol's whole price history first, 72 ms for
  SPY with three months of 1-minute bars, and growing daily. It now looks in a
  short recent window first and falls back to the full scan only when it must.
  Same bars in all 360 checked cases, gaps included
  (`tests/test_historical_bucket_floor_parity.py`); 1.3 ms instead of 72.
- **"Has today's close landed"**: asked once a second per symbol per API process,
  and before every WebSocket price tick. It read the whole history to answer
  "no" all day, 40 ms each time. Now reads today only, 1.4 ms, same answer at
  all 199 clock times checked.
- **Price cache** 1.5 s → 0.1 s, so a once-a-second poll gets the newest price
  (79 polls in 80 in testing, against about 7 in 8 at 0.5 s). A refresh costs
  under a millisecond. If the box's `.env` sets `LATEST_QUOTE_CACHE_TTL_SECONDS`,
  it overrides this; set it to 0.1.
- **Technicals tail** (`intervals=N`) now returns the same VWAP as the full read.
  It used to average only the last ~3 hours; nothing used it until the website
  fix below.
- **`make quote-cadence`**: listens to the live price feed and reports, per
  symbol, updates per minute and the worst gap. Read-only.

**zerogex-web (website)**

- The price and candle polls carry a `fresh=<token>` marker and the website
  answers those with `Cache-Control: no-store`, so nginx never caches them.
  Tested first: marking the answers no-store by *path* instead would have frozen
  every open chart for good (nginx keeps serving its expired copy when every
  refresh comes back unstorable). Tabs still on the old code keep today's
  behavior until they reload. No nginx change needed.
- A new candle opens from the live price the second its minute begins, instead
  of waiting for the next candle poll.
- The technicals poll sent `interval=3`, which the API ignores, so every poll
  downloaded the whole day (about 72 KB a second per open chart). It now sends
  `intervals=3`.

## Follow-up, Oct 28: the price feed itself was slow

The first session after the deploy, the candles still moved only about every
5 seconds. `make quote-cadence` at 9:44 AM ET: SPY 3 updates a minute, QQQ 4,
NDX 2, SPX 1, NVDA 8. The website and API were passing each price on within a
second; the collectors that fetch prices from ThetaData were not producing
them. Last night's measurement used a stand-in feed that ticked every second,
so it never saw this.

- **They fetched every 5 seconds.** The every-second setting,
  `THETADATA_BAR_POLL_SECONDS`, was never added to the box's `.env`, and when
  unset it fell back to the 5-second options cadence.
- **They saved one price per options pass.** Each collector stored the newest
  price once per pass over its option chain, and with the collector service
  pinned at its CPU limit a pass took 17 to 19 s for SPY and QQQ and 36 to 39 s
  for SPX and NDX.

**Fixed** in zerogex-oa `c3687f07`: the poll defaults to every second, and each
price is saved and pushed to the WebSocket the moment it is fetched, on its own
thread, whatever the options pass is doing. Deployed with a collector restart
mid-session; at 11:24 AM ET `make quote-cadence` read 57 to 59 updates a minute
for every symbol, median gap 1.0 s, and no failed ThetaData requests. The
collector's CPU limit then went from 1.5 to 3 cores (`6adda930`, applied without
a restart) to speed up the options passes. The database server has 2 CPUs and
serves the API too, so watch it after any further raise.

## Checks

0. **The memory brake is off**, now, during the session:
   `systemctl show zerogex-oa-api -p MemoryHigh` must print
   `MemoryHigh=infinity`. If it prints a number, lift it on the running API,
   no restart: `sudo systemctl set-property --runtime zerogex-oa-api.service MemoryHigh=infinity`.
   That lasts until the next restart; to make it stick, pull `release` (it
   carries `87271c89`) and run `make api-install-service`, which copies the
   edited unit file and reloads systemd without restarting the API.
1. **His free month landed**: done (His account). To look again,
   `make diagnose-user EMAIL=na777knsa@gmail.com` (in `~/zerogex-web`) should
   show `Balance -$59.00` and `Upcoming invoice $0.00`.
2. **During market hours**: `make quote-cadence` (in `~/zerogex-oa`). Every
   symbol should show about 60 a minute with a median gap near 1.0 s (57 to 59
   on Oct 28 after the follow-up fix). If one falls short, count failed polls:
   `sudo journalctl -u zerogex-oa-ingestion --since "30 min ago" --no-pager | grep -cE "bar poll for [^ ]+ failed|bar listener for [^ ]+ failed"`.
   Each failed poll backs off 2 to 16 seconds. Zero failures with long gaps
   means a collector is not fetching or saving often enough, which was the
   Oct 28 cause, not a feed outage.
3. **In your own browser**: Gamma Terminal, DevTools Network. The
   `market/quote` and `market/historical` requests carry `fresh=` and their
   response headers say `X-Cache-Status: MISS`.

## Draft reply

**Subject:** Re: Urgent Complaint – Chart Lag and Freezing on ZeroGamma Pro

Hi Naif,

Thank you for writing, and I'm sorry. You were right: the chart was not updating every second.

I found two causes today. The first was the freezing: a memory limit on our data server was forcing it to pause, and during those pauses every chart waited, sometimes for many seconds. That limit has been removed.

The second was a lag that was there even when the server was running smoothly. A cache meant to reduce load was holding chart updates for up to five seconds, so the candles refreshed about every five seconds instead of every second, each new candle appeared a few seconds after its minute began, and on some connections the price itself lagged the same way.

The fix for that is now live. I measured it before shipping: the price and the newest candle now move every second, and a new candle appears within a second of its minute starting.

To make up for the trouble, I've added a free month to your account. Your November 18 renewal won't be charged, and your subscription continues as normal after that.

If you see any lag tomorrow, reply with the page you were on, your browser, and roughly where you're connecting from, and I'll look into it the same day.

Best,
Michael
Founder, ZeroGEX

## If he replies

- **Still lagging after the deploy.** Run check 2 first. If the feed is clean,
  ask for the same three things Mircea sent (`2026-09-28-trial-cancel-slow-page-mircea.md`):
  the Protocol column, one slow request's Timing tab, and five minutes on a
  phone hotspot.
- **Wants a refund.** The guarantee doesn't cover him (see His account), so
  it's your call; the free month is already on his balance.

## Worth knowing (not urgent)

- **The API logs one line per request, so its journal fills faster.** The
  candle polls now reach it every second instead of every five, so the 300M
  journal cap will hold fewer hours of history than the ~16 it held in
  September. Save logs the same day when investigating, as before.
