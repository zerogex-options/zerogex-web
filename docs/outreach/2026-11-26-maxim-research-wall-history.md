# Maxim Adamenko: free research export of SPY/QQQ wall history, Jun 29 to Nov 25 (2026-11-26)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Wed Nov 25, 5:30 PM, from adamax.you@gmail.com to support.
Subject: "Non-commercial research access: original SPY/QQQ summary history,
29Jun–25Nov2026".

He's running an independent, non-commercial study of price reactions at SPY
and QQQ call and put walls, over the 106 sessions from June 29 to November 25.
He wants the walls as originally recorded, not rebuilt: symbol, as-of
timestamp, `call_wall`, `put_wall`, expiry scope, any methodology changes, and
input-availability timestamps if we keep them. He doesn't want contract quotes
or live access. He asks for a free one-time export or a temporary research key,
and for the format, usage and attribution terms. He'll publish methodology and
aggregate results (negatives included) with attribution and a link, and won't
republish the data, sell signals or build a competing service.

> **Status:** first reply sent Nov 27, Stripe code `ZGXRESEARCH` created.
> He answered the same day with two new questions. The follow-up (bottom of
> this note) answers those plus the two owed points. Unsent. One sentence to
> confirm first.

## The read

- **No custom export. What he wants is already in the Pro API.**
  `/api/gex/historical` gives the call wall, put wall, flip, net GEX and max
  pain in 1-minute rows, starting June 29, 2026 for SPY and QQQ
  (`data-coverage.md`, "Historical depth"). His count of 106 sessions is
  right. A hand-built export would mean running queries against production for
  a non-customer, with no end date on what he holds.
- **Recommended: one free month of Pro through a one-time Stripe code.** It
  costs one $59 month. When he cancels, his plan drops and the Stripe webhook
  switches his API key off by itself (`revokeApiKeysIfTierDropped`), so
  there's nothing to clean up.
- **The code only works from Wed Dec 2.** He has no account
  (`diagnose-user`, Nov 26), so he'll sign up as a first-time member. Until the
  sale closes at the end of Dec 1, checkout gives first-time members the sale
  discount and hides the promotion-code box
  (`app/api/billing/checkout/route.ts`).
- **The risk is the result, not the data.** He'll publish negative results
  with your name on them. That fits a site that publishes its own receipts.
  The draft asks for a copy beforehand, to catch data mistakes only.
- **The Terms need your written permission to publish** (Section 6, "redistribute
  content without our written permission"). The publishing paragraph is that
  permission, with his own limits written back to him.
- **"DEFAULT_CHAIN" isn't ours.** It's not in this repo or the public API
  schema. With no account, he's reading the free pages or the free MCP server.
  The draft doesn't repeat the term.

## What's verified, and what isn't

Checked against the public API schema (`api.zerogex.io/openapi.json`) and this
repo on Nov 26.

- **Verified: one timestamp per row.** The history row (`GEXSummary`) has a
  single `timestamp` field. Nothing else is a time. Historical endpoints stamp
  the bucket start, and `/api/gex/historical` returns "the last snapshot
  inside" each bucket. Parameters: `symbol`, `start_date`, `end_date`,
  `timeframe` (default `1min`), `window_units` (max 90), newest first.
- **Verified: the chain today is the ten nearest expirations** around the
  price (`content/methodology.md`; production env checked Nov 4 in the Paolo
  note: `INGEST_EXPIRATIONS=10`). The two extra monthlies are SPX and NDX only.
  So the first draft's "every listed expiration" was wrong.
- **Not verified: whether the depth was always ten.** Several zerogex-oa docs
  said production kept only the three nearest expirations (Ron note). If
  that was true at some point after June 29, the walls in his window were
  built from different chains. That's exactly the methodology change he asked
  about.
- **Not verified: whether recent rows are stored or rebuilt.** The endpoint's
  own description says "buckets older than [the per-strike window] carry the
  walls and `net_gex` stored with the snapshot". That implies newer rows
  (roughly the last 60 days, so about Sept 27 onward) are built from
  strike-level detail. If so, the first draft's "the summary history isn't
  recomputed" was wrong for a third of his window.
- **Your git log doesn't answer either question.** It ran in `zerogex-web`,
  the website. Wall and chain logic live in `zerogex-oa`, which this session
  couldn't open.

## Owed after sending

The draft promises him answers to points 3 and 5. To get them, open a Claude
session on zerogex-oa and paste:

> For /api/gex/historical (`src/api`), do rows inside the per-strike
> retention window return the call_wall and put_wall stored in gex_summary,
> or are they recomputed from gex_by_strike at request time? Then list every
> change between 2026-06-29 and 2026-11-25 that affects how gex_summary's
> call_wall and put_wall are computed for SPY and QQQ, with dates. Include any
> change to how many expirations are ingested (INGEST_EXPIRATIONS), and how
> strikes are aggregated across expirations.

Bring me the answer and I'll write the follow-up email.

## Steps

1. **Create the code in Stripe** (Live mode, not a sandbox). Product catalog,
   Coupons, **+ Create coupon**:

   | Field | Value |
   |---|---|
   | Name | `Pro research month` (he sees this at checkout) |
   | Type | Fixed amount discount, **$59.00 USD** |
   | Apply to specific products | On, **Pro** only |
   | Duration | **Once** |
   | Use customer-facing coupon codes | On, code **`ZGXRESEARCH`** |
   | Eligible for first-time order only | Off |
   | Limit to a specific customer | Off |
   | Limit the number of times this code can be redeemed | **1** |
   | Add an expiration date | **Thu Dec 31, 2026, 11:59 PM** ET |
   | Require minimum order value | Off |

   $59 off once is one free month of Pro monthly. On annual he'd pay $240,
   which is why the draft says monthly. A coupon's products can't be changed
   after it's made, so check "Pro only" before saving.

2. **Send the draft** in his thread.

3. **Later (optional):** once he's redeemed it,
   `make diagnose-user EMAIL=adamax.you@gmail.com` should show `pro`. If he
   forgets to cancel, month two bills $59, and the 7-day money-back guarantee
   runs from that first real charge.

## Draft

Hi Maxim,

Thanks for the careful note, and for asking before pulling anything.

You don't need a custom export: what you're describing is already in our Pro API. /api/gex/historical returns the call wall, put wall, gamma flip, net GEX and max pain for SPY and QQQ, one row per minute with timeframe=1min. That history starts on June 29, 2026, so all 106 of your sessions are there. It's JSON, newest first, up to 90 rows per request, and you page back with start_date and end_date. That's several hundred requests per symbol, which fits within the rate limit if you pace them. The reference is at api.zerogex.io/docs.

I'm glad to support the study, so a month of Pro is on me. Go to zerogex.io/pricing, choose Pro monthly, and enter ZGXRESEARCH under "Add promotion code". The total due today will show $0. The code works from Wednesday, December 2, once our holiday sale ends (the sale takes over checkout until then), through December 31. Stripe will still ask for a card. Generate your key under Account, then API Access, pull what you need, and cancel from the Account page before the month is up so you won't be charged. Canceling also switches the key off.

Some details that matter for your design:

1. Timestamps. Each row has one timestamp, the start of its minute, and carries the last snapshot taken during that minute. Treat it as known at the end of the minute, not the start. Lining rows up by their stamp with price from inside the same minute gives the test a small look-ahead. We don't store a separate input-availability time.

2. Expiry scope. The walls come from the chain we load for each symbol, which today is the ten nearest expirations, at the strikes around the price. That includes the day's 0DTE options until the close.

3. Recorded versus rebuilt. Rows older than about 60 days carry the walls exactly as they were stored with that minute's snapshot. For newer rows, I'm confirming whether the history returns those stored walls or rebuilds them from the strike-level detail we keep for 60 days. Either way, save your pull once and work from that file, so your record doesn't shift as rows age past that line.

4. Daily Replay. Use the history rather than Replay. Replay's strike detail only goes back about 60 days, and its per-strike gamma was restated for every past session in a fix this November, so it isn't a record of what was published at the time.

5. Methodology changes. I'm putting together the list of changes in your window that affect the walls, including whether the number of expirations in the chain changed. I'll send it along with the answer to point 3.

On publishing: you have my permission to publish your methodology, aggregate findings and limitations, including negative or inconclusive results, credited as "Data: ZeroGEX" with a link to zerogex.io. A few example sessions in a chart are fine. The full series isn't, and please keep the key and the data to yourself. I'd appreciate a copy a few days before it goes up, only so I can check that the data is described correctly. I won't ask you to change your conclusions.

You may also want to read our own wall study, which covers late June through early September and defines a test, a break and a hold precisely: zerogex.io/education/how-often-do-gamma-walls-break. I'd be interested to see how an independent design compares.

Best,
Michael

## If you'd rather not give it free

Replace the "I'm glad to support the study" paragraph with:

Access is through a Pro plan, which is $59 a month. Through Tuesday, December 1, our holiday sale makes your first month $29.50. Choose Pro monthly at zerogex.io/pricing, generate your key under Account, then API Access, pull what you need, and cancel from the Account page whenever you like.

Skip Step 1.

## If he replies

- **"Can you just send a CSV?"** No. The API is the export.
- **He wants per-strike history, or the call/put split, for the whole window.**
  Not available. Per-strike data is kept about 60 days, so most of his window
  is gone.
- **He wants contract quotes after all.** Not on any plan. Point him to his
  broker or a data vendor.
- **He needs more than a month.** Make a second one-use code the same way.
  Don't comp the account: a comp has no end date, so the key would stay live
  until you remembered to revoke it.
- **He sends the draft study.** Check that he used the history and not
  Replay, that he lined rows up at the end of the minute, and that the credit
  and link are there. Anything else is his call.

---

# Second inbound (Thu Nov 27, 3:15 PM) and the follow-up

He'll follow the attribution and data terms. Two new questions:

1. For SPY and QQQ, do the walls from the Pro history match the
   "DEFAULT_CHAIN series, expiry scope and methodology" the public MCP shows?
2. His saved MCP observations arrive about 15 to 18 minutes after the as-of
   time. Is there a documented delay to apply when backtesting the public feed,
   or should he rely on his receipts and treat everything else as unknown?

He's waiting on the two owed answers. The zerogex-oa session found them
(Nov 28), plus backfills and gaps. Its draft is the base of the reply below,
with the edits listed here.

## The read

- **The first email's point 4 was wrong. The reply says so.** It said to use
  the history rather than Replay. zerogex-oa found it's the other way around
  for walls. `/api/gex/historical` recalculates minutes inside the 60-day
  per-strike window with the pre-October rule. `/api/replay/range` at its
  default expirations returns the walls as stored.
- **The MCP reads `/api/gex/summary` with no expiration filter**, through
  `serverApiGetDelayed` (`app/mcp/route.ts`, `fetchSnapshot`). Its `as_of` is
  that row's `timestamp` (`core/mcp/levels.ts`, `structuredSnapshot`). So it
  shows the stored, published walls: the whole chain, with the October rules.
  That matches replay, not the recalculated history.
- **The free delay changed during his window.** Before the change, the only
  delay was a 900-second cache, so free data was anywhere from seconds to 15
  minutes old. `032245c4` ("Make the free surfaces' 15-minute delay real")
  reached `release` on the evening of Sep 29. Since then the backend serves
  nothing newer than 15 minutes, and data reaches a visitor 15 to 17 minutes
  old (`core/freeDelay.ts`). His 15 to 18 is that, plus his own polling. The
  MCP itself started Sep 8 (`f95cfa8f`). Deploy times aren't logged, so the
  reply tells him to check the switch against his own receipts.
- **Vendor names are taken out.** The zerogex-oa draft named both data vendors
  and the equity feed. `help/platform/data-coverage.md` says "We don't
  disclose specific vendor names publicly", and he'll publish a methodology.
  Put them back only if you've decided to change that.
- **The open-interest defect stays in.** It moved the call wall in a
  simulation, so it matters for his results, and leaving it out would surface
  later as a surprise.
- **Your whole-session query returned no rows**, so every session in the
  window has data. Section 6 says so.

## Confirm before sending

Section 2 says the MCP shows the same rows as replay. This repo proves the MCP
reads `/api/gex/summary`. zerogex-oa said stored walls are what was
published. What isn't checked is that the summary read passes the stored row
through unchanged. In the zerogex-oa session, paste:

> Does /api/gex/summary?symbol=SPY&delay_minutes=15, with no expiration
> filter (what the free MCP reads), return the call_wall and put_wall stored
> in gex_summary unchanged during 09:30-16:00 ET, the same values
> /api/replay/range returns at its default? Or does it recalculate anything at
> read time? Answer with file:line.

If yes, send as is. If no, bring me the answer.

## Follow-up draft

Reply in his thread (his Nov 27, 3:15 PM message), to adamax.you@gmail.com.

Hi Maxim,

Here are the answers I owed you, along with your two new questions.

First, a correction to my last email: I said to use the history endpoint rather than Replay. For the walls, it's the other way around. Section 1 explains why.

The short version:
- For the walls exactly as published, use /api/replay/range, not /api/gex/historical.
- The public MCP served those same published walls, delayed. From September 30 on, a level reached it 15 to 17 minutes after its as-of time.
- Our wall rule changed on October 8, our data feed on October 19, and an open-interest defect was fixed on November 16.
- We never backfilled stored walls, and missing data is small, mostly in late July and August.

1. Where to get the walls as published

/api/gex/historical (and its v2 version) handles minutes differently depending on their age:
- Minutes older than our per-strike retention window (about 60 days, so roughly before late September as of today) return the call_wall and put_wall we stored at the time. Those are the walls we published.
- Newer minutes are recalculated from our stored per-strike data when you make the request, using our older rule: the call wall is the strike with the most gamma-weighted open interest at or above that minute's last price, and the put wall is the same at or below it. It doesn't apply the stability rules we added in October (section 4), so from October 8 on it can differ from what we published, sometimes by a lot. Before October 8 it can also occasionally differ, because it splits strikes on the minute's last price rather than the price our engine used.
- The cutoff moves forward a day every night, so the same minute can come back recalculated in one pull and stored in a later one.

To get the walls exactly as stored, for any day in your window:
- GET /api/replay/range?symbol=SPY&date=2026-10-15 returns every stored minute from 09:30 to 15:59 ET for that session, with call_wall and put_wall exactly as stored. Leave the expirations parameter at its default, because setting it recalculates the walls.
- GET /api/replay/frame?symbol=SPY&ts=... returns a single minute. Times without a time zone are read as UTC.

Both work with the Pro key, and both have /api/v2/replay/... versions. At one request per session, the whole window is about 212 requests for the two symbols.

2. The public MCP and the Pro API

DEFAULT_CHAIN isn't a name we use, so I've read it as the MCP's default levels, with no expiration filter. On that reading, yes: the MCP reads the same stored one-minute summary that /api/replay/range returns at its default. That means the same series, the same whole-chain expiry scope, and the same methodology, including the October changes, because the MCP showed what we published. It won't match /api/gex/historical for the recent minutes described in section 1. The MCP's as_of is the timestamp of the row it served, so your saved MCP observations should match the replay rows at the same times. If any don't, please send me a few examples.

3. Publication delay on the public feed

There is a designed delay, and it changed once during your window:
- From the MCP's launch in early September until the evening of September 29, the only delay was a 15-minute cache, so it could serve data anywhere from a few seconds to 15 minutes old. There's no fixed delay you can apply for those weeks.
- From then on, the free feed (the MCP and our free levels pages) serves nothing newer than 15 minutes old. With our one-minute buckets and a one-minute cache on top, a level reaches it 15 to 17 minutes after its as-of time, which matches the 15 to 18 minutes you measured. We don't log deploy times, so treat September 30 as the first full session under this rule, and check it against your receipts: before the switch, some of your observations should be less than 15 minutes old.

For a backtest of the public feed, I'd use your recorded receipts where you have them. Elsewhere, from September 30 on, treat a level as available no earlier than its as-of time plus 15 minutes, or plus your observed 18 if you want to be conservative. Before September 30, treat availability outside your observations as unknown. The Pro API has no built-in delay, so for the Pro data your minute-end rule is the right one.

4. Changes during your window

Dates are when each change was released; go-live dates weren't always recorded.

October 8: new wall rule. Before this, the walls were the biggest strike on each side of the current price, re-picked every minute, and a strike switched from call wall to put wall the moment price crossed it. From October 8:
- The price we split strikes on only moves once price closes beyond a buffer: the larger of 0.1% of price and 0.4 times the typical 30-minute range. A strike keeps its role while price hovers around it.
- Strikes within 10% of the biggest count as tied, and the tied strike closest to price wins.
- Walls are re-checked only when price breaks out, or every 15 minutes, and held in between. This part went live during October 8, so treat that day as a transition. It was fully in place from October 9.

October 12 at the earliest: a wall in place keeps its spot unless a rival is at least 25% bigger. This was released after the close on October 9; the go-live date wasn't recorded.

October 19, before the open: we switched data vendors for option quotes, open interest and the SPY/QQQ price.
- We now calculate implied volatility ourselves; the previous vendor supplied its own.
- The SPY/QQQ price is now the midpoint of the real-time bid and ask.
- In a September side-by-side test on SPY, the two feeds gave the same put wall 58 times out of 58 and the same call wall 49 times out of 58.

From the start of your window until the night of November 16: an open-interest defect. Each contract's open interest in our system could only go up, so when a contract's open interest fell overnight, we kept using the old, higher number. It was fixed the night of November 16. In a simulation it changed the call wall at 6 of 16 checkpoints and the put wall at none. We haven't measured its effect on production data.

November 22: contracts with no solvable implied volatility, such as options with no bid or deep in-the-money same-day options, stopped contributing estimated gamma. That lowers gamma at strikes near the price on days heavy in same-day options, which can move the walls. The code was finished on Sunday, November 22, and I can't confirm when it went live, so treat November 23 to 25 with care.

What didn't change:
- Gamma times open interest is summed across all expirations for each strike, never averaged.
- The strike range: within 3% of price by default, up to 40 strikes per expiration.
- The gamma formula. Walls rank call and put gamma separately, so the dealer-sign convention doesn't affect them.
- The day's expiring options count until 16:15 ET, so walls during the session include same-day contracts.
- Open interest is a once-a-day figure from both vendors, never intraday. Before October 19, our records don't show whether a session used the prior day's figure or the one from the day before.

Number of expirations: we load the nearest expirations at those strikes. When we checked on November 19, production was set to the nearest 10. Our records don't show when it was set to 10. Some of our September notes said 3, but data counts from mid-October show more than 3 by then. I can't give you an exact number for July through September.

5. Backfills and rewrites

We never backfilled, migrated or recalculated stored wall values. One known issue: until October 1, our engine sometimes re-saved a row after its minute had closed. We checked the database: since September 8, when we started recording write times, every SPY and QQQ row re-saved that way was outside 09:30 to 16:00 ET, so none of your regular-session rows were affected. Before September 8 we can't check directly, but the only known cause would have hit an after-hours row.

6. Gaps

Stored history starts June 29, and every session from June 29 to November 25 has data. Across those 106 sessions, SPY is missing 172 regular-session minutes (0.4%) and QQQ is missing 469 (1.1%), almost all before September 4. Sessions with missing minutes, with the number missing in parentheses:

SPY: Jul 17 (3), Jul 28 (2), Jul 29 (60), Jul 30 (4), Aug 10 (4), Aug 14 (29), Aug 18 (6), Aug 19 (46), Aug 20 (1), Aug 21 (7), Aug 24 (1), Sep 23 (2), Oct 13 (1), Nov 6 (2), Nov 10 (1), Nov 17 (3)

QQQ: Jul 7 (11), Jul 13 (1), Jul 22 (1), Jul 24 (1), Jul 27 (23), Jul 31 (4), Aug 3 (1), Aug 4 (4), Aug 5 (42), Aug 6 (50), Aug 7 (43), Aug 13 (3), Aug 17 (2), Aug 18 (34), Aug 25 (70), Aug 26 (69), Aug 27 (4), Aug 28 (1), Aug 31 (69), Sep 1 (3), Sep 3 (18), Sep 23 (2), Oct 23 (1), Nov 6 (2), Nov 17 (10)

Known causes: a QQQ data outage on August 18 (09:30 to 10:03), a QQQ outage near the August 25 close, and a bad deploy around the September 23 open. The others have no recorded cause.

If you compare periods, I'd treat October 8, October 19 and November 16 as break points, and September 30 for anything that depends on the public feed's timing.

Best,
Michael
